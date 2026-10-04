package com.shappire.stickers

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile

/**
 * Ponte entre o frontend (TypeScript) e a integração oficial com o WhatsApp.
 *
 * Baseada na documentação pública https://github.com/WhatsApp/stickers:
 * - valida os arquivos exportados antes de entregá-los;
 * - dispara o Intent `com.whatsapp.intent.action.ENABLE_STICKER_PACK`;
 * - consulta a whitelist oficial para saber se o pacote já foi adicionado
 *   (classe `WhitelistCheck` do exemplo oficial);
 * - expõe capacidades do dispositivo para a interface.
 */
@CapacitorPlugin(name = "StickerPackPlugin")
class StickerPackPlugin : Plugin() {

    /* ------------------------------------------------------------- status */

    @PluginMethod
    fun getStatus(call: PluginCall) {
        val ctx = context
        val result = JSObject()
            .put("available", true)
            .put("platform", "android")
            .put("authority", StickerContentProvider.authority(ctx))
            .put("filesDirectory", ctx.filesDir.absolutePath)
            .put("androidSdk", Build.VERSION.SDK_INT)
            .put("whatsappConsumerInstalled", isPackageInstalled(ctx, CONSUMER_PACKAGE))
            .put("whatsappBusinessInstalled", isPackageInstalled(ctx, BUSINESS_PACKAGE))
        call.resolve(result)
    }

    /* --------------------------------------------------------- validação */

    @PluginMethod
    fun validateStickerPack(call: PluginCall) {
        val identifier = call.getString("identifier")
        if (identifier.isNullOrEmpty()) {
            call.reject("Informe o identificador do pacote.")
            return
        }
        val ctx = context
        val errors = JSArray()
        val warnings = JSArray()

        val pack = StickerContents.findPack(ctx, identifier)
        if (pack == null) {
            errors.put(issue("PACK_NOT_FOUND", "O pacote não foi encontrado nos arquivos exportados."))
            call.resolve(validationResult(false, errors, warnings))
            return
        }

        val maxStickerBytes = if (pack.animatedStickerPack) ANIMATED_STICKER_MAX_BYTES else STATIC_STICKER_MAX_BYTES

        if (pack.stickers.size < MIN_STICKERS || pack.stickers.size > MAX_STICKERS) {
            errors.put(
                issue(
                    "PACK_STICKER_COUNT",
                    "Um pacote precisa ter entre $MIN_STICKERS e $MAX_STICKERS figurinhas (atual: ${pack.stickers.size}).",
                ),
            )
        }

        // Ícone da bandeja (tray).
        if (pack.trayImageFile.isEmpty()) {
            errors.put(issue("TRAY_MISSING", "O pacote não tem imagem de ícone (tray)."))
        } else {
            val tray = StickerContents.stickerFile(ctx, identifier, pack.trayImageFile)
            if (!tray.exists()) {
                errors.put(issue("TRAY_FILE_MISSING", "O arquivo do ícone do pacote não existe: ${pack.trayImageFile}"))
            } else {
                if (tray.length() > TRAY_MAX_BYTES) {
                    errors.put(
                        issue(
                            "TRAY_TOO_LARGE",
                            "O ícone do pacote tem ${tray.length() / 1024} KB e o limite é ${TRAY_MAX_BYTES / 1024} KB.",
                        ),
                    )
                }
                val size = imageDimensions(tray)
                if (size != null && (size.first < TRAY_MIN_DIMENSION || size.first > TRAY_MAX_DIMENSION ||
                        size.second < TRAY_MIN_DIMENSION || size.second > TRAY_MAX_DIMENSION)
                ) {
                    errors.put(
                        issue(
                            "TRAY_INVALID_DIMENSIONS",
                            "O ícone do pacote deve ter entre ${TRAY_MIN_DIMENSION}x$TRAY_MIN_DIMENSION e ${TRAY_MAX_DIMENSION}x$TRAY_MAX_DIMENSION (atual: ${size.first}x${size.second}).",
                        ),
                    )
                }
            }
        }

        // Figurinhas.
        for (sticker in pack.stickers) {
            val file = StickerContents.stickerFile(ctx, identifier, sticker.imageFile)
            if (!file.exists()) {
                errors.put(issue("STICKER_FILE_MISSING", "Arquivo ausente: ${sticker.imageFile}"))
                continue
            }
            if (!file.name.lowercase().endsWith(".webp")) {
                errors.put(issue("STICKER_NOT_WEBP", "${sticker.imageFile} precisa estar em WebP."))
            }
            if (!isWebPFile(file)) {
                errors.put(
                    issue("STICKER_NOT_WEBP_ENCODED", "${sticker.imageFile} não é um WebP válido (cabeçalho RIFF/WEBP ausente)."),
                )
            }
            if (file.length() > maxStickerBytes) {
                errors.put(
                    issue(
                        "STICKER_TOO_LARGE",
                        "${sticker.imageFile} tem ${file.length() / 1024} KB e o limite é ${maxStickerBytes / 1024} KB.",
                    ),
                )
            } else if (file.length() > maxStickerBytes * 0.85) {
                warnings.put(
                    issue(
                        "STICKER_NEAR_LIMIT",
                        "${sticker.imageFile} está próximo do limite de ${maxStickerBytes / 1024} KB.",
                    ),
                )
            }
            val size = imageDimensions(file)
            if (size == null) {
                errors.put(issue("STICKER_UNREADABLE", "Não foi possível ler ${sticker.imageFile}."))
            } else if (size.first != STICKER_DIMENSION || size.second != STICKER_DIMENSION) {
                errors.put(
                    issue(
                        "STICKER_INVALID_DIMENSIONS",
                        "${sticker.imageFile} deve ter exatamente ${STICKER_DIMENSION}x$STICKER_DIMENSION (atual: ${size.first}x${size.second}).",
                    ),
                )
            }
            if (sticker.emojis.isEmpty()) {
                errors.put(issue("EMOJI_REQUIRED", "${sticker.imageFile} não tem emoji."))
            } else if (sticker.emojis.size > MAX_EMOJIS) {
                errors.put(issue("EMOJI_TOO_MANY", "${sticker.imageFile} tem mais de $MAX_EMOJIS emojis."))
            }
        }

        call.resolve(validationResult(errors.length() == 0, errors, warnings))
    }

    /* -------------------------------------------------------- atualização */

    /**
     * Avisa o sistema (e portanto o WhatsApp) de que o índice mudou.
     * É o mecanismo padrão de notificação de ContentProvider no Android.
     */
    @PluginMethod
    fun refreshStickerPacks(call: PluginCall) {
        val ctx = context
        StickerContents.invalidate()
        val uri = StickerContentProvider.metadataUri(ctx)
        ctx.contentResolver.notifyChange(uri, null)
        for (pack in StickerContents.read(ctx)) {
            ctx.contentResolver.notifyChange(
                Uri.Builder()
                    .scheme("content")
                    .authority(StickerContentProvider.authority(ctx))
                    .appendPath("stickers")
                    .appendPath(pack.identifier)
                    .build(),
                null,
            )
        }
        call.resolve(JSObject().put("reloaded", true))
    }

    /* --------------------------------------------------- adicionar ao app */

    @PluginMethod
    fun addStickerPackToWhatsApp(call: PluginCall) {
        val identifier = call.getString("identifier")
        val packName = call.getString("packName") ?: ""
        if (identifier.isNullOrEmpty()) {
            call.reject("Informe o identificador do pacote.")
            return
        }

        val ctx = context
        val consumerInstalled = isPackageInstalled(ctx, CONSUMER_PACKAGE)
        val businessInstalled = isPackageInstalled(ctx, BUSINESS_PACKAGE)
        if (!consumerInstalled && !businessInstalled) {
            call.resolve(
                JSObject()
                    .put("outcome", "unavailable")
                    .put("message", "O WhatsApp não está instalado neste aparelho."),
            )
            return
        }

        val variant = call.getString("variant")
        val targetPackage = when {
            variant == "business" && businessInstalled -> BUSINESS_PACKAGE
            variant == "consumer" && consumerInstalled -> CONSUMER_PACKAGE
            consumerInstalled -> CONSUMER_PACKAGE
            else -> BUSINESS_PACKAGE
        }

        val intent = Intent(ACTION_ENABLE_STICKER_PACK).apply {
            putExtra(EXTRA_STICKER_PACK_ID, identifier)
            putExtra(EXTRA_STICKER_PACK_AUTHORITY, StickerContentProvider.authority(ctx))
            putExtra(EXTRA_STICKER_PACK_NAME, packName)
            setPackage(targetPackage)
        }

        try {
            startActivityForResult(call, intent, "handleAddStickerPackResult")
        } catch (error: ActivityNotFoundException) {
            call.resolve(
                JSObject()
                    .put("outcome", "unavailable")
                    .put("message", "Não foi possível abrir o WhatsApp neste aparelho."),
            )
        }
    }

    @ActivityCallback
    private fun handleAddStickerPackResult(call: PluginCall?, result: ActivityResult) {
        val pluginCall = call ?: return
        val data = result.data
        when (result.resultCode) {
            Activity.RESULT_OK -> pluginCall.resolve(
                JSObject()
                    .put("outcome", "added")
                    .put("message", "Pacote adicionado ao WhatsApp."),
            )

            Activity.RESULT_CANCELED -> {
                val validationError = data?.getStringExtra(EXTRA_VALIDATION_ERROR)
                if (!validationError.isNullOrEmpty()) {
                    pluginCall.resolve(
                        JSObject().put("outcome", "failed").put("message", validationError),
                    )
                } else {
                    pluginCall.resolve(
                        JSObject()
                            .put("outcome", "cancelled")
                            .put("message", "Adição cancelada no WhatsApp."),
                    )
                }
            }

            else -> pluginCall.resolve(
                JSObject()
                    .put("outcome", "failed")
                    .put("message", "O WhatsApp não concluiu a operação (código ${result.resultCode})."),
            )
        }
    }

    /* ------------------------------------------------------------ whitelist */

    /** `null` quando o aplicativo correspondente não está instalado. */
    @PluginMethod
    fun isStickerPackAdded(call: PluginCall) {
        val identifier = call.getString("identifier")
        if (identifier.isNullOrEmpty()) {
            call.reject("Informe o identificador do pacote.")
            return
        }
        val ctx = context
        val result = JSObject()
        // `JSONObject.NULL` mantém as chaves `consumer`/`business` no objeto JS
        // (null indica "não foi possível verificar": app ausente ou versão antiga).
        result.put(
            "consumer",
            if (isPackageInstalled(ctx, CONSUMER_PACKAGE)) {
                isWhitelisted(ctx, identifier, CONSUMER_PACKAGE)
            } else {
                JSONObject.NULL
            },
        )
        result.put(
            "business",
            if (isPackageInstalled(ctx, BUSINESS_PACKAGE)) {
                isWhitelisted(ctx, identifier, BUSINESS_PACKAGE)
            } else {
                JSONObject.NULL
            },
        )
        call.resolve(result)
    }

    /**
     * Consulta a whitelist oficial do WhatsApp
     * (`<pacote>.provider.sticker_whitelist_check` → `is_whitelisted`).
     */
    private fun isWhitelisted(ctx: Context, identifier: String, whatsappPackage: String): Boolean {
        val authority = "$whatsappPackage$WHITELIST_PROVIDER_SUFFIX"
        val providerInfo = try {
            ctx.packageManager.resolveContentProvider(authority, PackageManager.GET_META_DATA)
        } catch (error: Exception) {
            null
        }
        // WhatsApp antigo não expõe o provider: não há como confirmar.
        if (providerInfo == null) return false

        val uri = Uri.Builder()
            .scheme("content")
            .authority(authority)
            .appendPath(WHITELIST_QUERY_PATH)
            .appendQueryParameter("authority", StickerContentProvider.authority(ctx))
            .appendQueryParameter("identifier", identifier)
            .build()

        return try {
            ctx.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val index = cursor.getColumnIndex(WHITELIST_RESULT_COLUMN)
                    index >= 0 && cursor.getInt(index) == 1
                } else {
                    false
                }
            } ?: false
        } catch (error: Exception) {
            false
        }
    }

    /* ---------------------------------------------------------- Play Store */

    @PluginMethod
    fun openPlayStore(call: PluginCall) {
        val packageName = call.getString("packageName") ?: CONSUMER_PACKAGE
        val market = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$packageName"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(market)
            call.resolve(JSObject().put("opened", true))
            return
        } catch (error: ActivityNotFoundException) {
            // Sem a Play Store: tenta o navegador.
        }
        try {
            context.startActivity(
                Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=$packageName"),
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
            call.resolve(JSObject().put("opened", true))
        } catch (error: ActivityNotFoundException) {
            call.resolve(JSObject().put("opened", false))
        }
    }

    /* -------------------------------------------------------------- helpers */

    private fun validationResult(valid: Boolean, errors: JSArray, warnings: JSArray): JSObject =
        JSObject().put("valid", valid).put("errors", errors).put("warnings", warnings)

    private fun issue(code: String, message: String): JSObject =
        JSObject().put("code", code).put("message", message)

    private fun isPackageInstalled(ctx: Context, packageName: String): Boolean = try {
        ctx.packageManager.getApplicationInfo(packageName, 0).enabled
    } catch (error: PackageManager.NameNotFoundException) {
        false
    }

    /** Lê as dimensões sem decodificar a imagem inteira (economia de memória). */
    private fun imageDimensions(file: File): Pair<Int, Int>? {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, options)
        if (options.outWidth <= 0 || options.outHeight <= 0) return null
        return options.outWidth to options.outHeight
    }

    /** Verifica o cabeçalho `RIFF....WEBP` (codificação WebP real). */
    private fun isWebPFile(file: File): Boolean = try {
        RandomAccessFile(file, "r").use { raf ->
            val header = ByteArray(12)
            if (raf.read(header) != 12) return false
            val riff = String(header, 0, 4, Charsets.US_ASCII)
            val webp = String(header, 8, 4, Charsets.US_ASCII)
            riff == "RIFF" && webp == "WEBP"
        }
    } catch (error: Exception) {
        false
    }

    companion object {
        const val CONSUMER_PACKAGE = "com.whatsapp"
        const val BUSINESS_PACKAGE = "com.whatsapp.w4b"

        private const val ACTION_ENABLE_STICKER_PACK =
            "com.whatsapp.intent.action.ENABLE_STICKER_PACK"
        private const val EXTRA_STICKER_PACK_ID = "sticker_pack_id"
        private const val EXTRA_STICKER_PACK_AUTHORITY = "sticker_pack_authority"
        private const val EXTRA_STICKER_PACK_NAME = "sticker_pack_name"
        private const val EXTRA_VALIDATION_ERROR = "validation_error"

        private const val WHITELIST_PROVIDER_SUFFIX = ".provider.sticker_whitelist_check"
        private const val WHITELIST_QUERY_PATH = "is_whitelisted"
        private const val WHITELIST_RESULT_COLUMN = "result"

        private const val STICKER_DIMENSION = 512
        private const val STATIC_STICKER_MAX_BYTES = 100 * 1024L
        private const val ANIMATED_STICKER_MAX_BYTES = 500 * 1024L
        private const val TRAY_MAX_BYTES = 50 * 1024L
        private const val TRAY_MIN_DIMENSION = 24
        private const val TRAY_MAX_DIMENSION = 512
        private const val MIN_STICKERS = 3
        private const val MAX_STICKERS = 30
        private const val MAX_EMOJIS = 3
    }
}
