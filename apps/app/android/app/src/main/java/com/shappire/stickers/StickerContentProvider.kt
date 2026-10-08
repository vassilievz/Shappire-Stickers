package com.shappire.stickers

import android.content.ContentProvider
import android.content.ContentResolver
import android.content.ContentValues
import android.content.Context
import android.content.UriMatcher
import android.content.res.AssetFileDescriptor
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.text.TextUtils
import java.io.File

/**
 * ContentProvider consumido pelo WhatsApp para ler os pacotes deste aplicativo.
 *
 * Implementa exatamente o contrato público do app de exemplo oficial
 * (https://github.com/WhatsApp/stickers — `StickerContentProvider.java`):
 *
 * - `content://<authority>/metadata`          → metadados de todos os pacotes;
 * - `content://<authority>/metadata/<id>`      → metadados de um pacote;
 * - `content://<authority>/stickers/<id>`      → lista de figurinhas;
 * - `content://<authority>/stickers_asset/<id>/<arquivo>` → bytes da imagem.
 *
 * A diferença em relação ao exemplo oficial é a origem dos dados: em vez de
 * `assets/` (somente leitura, definida na compilação), lemos o diretório privado
 * do app `files/sticker_packs/`, que é onde o editor grava as figurinhas.
 *
 * Os nomes das colunas e as constantes do `UriMatcher` são parte do contrato e
 * NÃO devem ser alterados.
 */
class StickerContentProvider : ContentProvider() {

    private lateinit var matcher: UriMatcher

    override fun onCreate(): Boolean {
        val ctx = context ?: return false
        val authority = authority(ctx)
        require(authority.startsWith(ctx.packageName)) {
            "A authority ($authority) do ContentProvider deve começar com o package name (${ctx.packageName})."
        }
        matcher = UriMatcher(UriMatcher.NO_MATCH).apply {
            addURI(authority, METADATA, METADATA_CODE)
            addURI(authority, "$METADATA/*", METADATA_CODE_FOR_SINGLE_PACK)
            addURI(authority, "$STICKERS/*", STICKERS_CODE)
            addURI(authority, "$STICKERS_ASSET/*/*", STICKERS_ASSET_CODE)
        }
        return true
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor {
        val ctx = context ?: throw IllegalStateException("Contexto indisponível")
        return when (matcher.match(uri)) {
            METADATA_CODE -> packsCursor(uri, StickerContents.read(ctx))
            METADATA_CODE_FOR_SINGLE_PACK -> {
                val identifier = uri.lastPathSegment.orEmpty()
                packsCursor(uri, StickerContents.read(ctx).filter { it.identifier == identifier })
            }
            STICKERS_CODE -> {
                val identifier = uri.lastPathSegment.orEmpty()
                val pack = StickerContents.findPack(ctx, identifier)
                stickersCursor(uri, pack)
            }
            else -> throw IllegalArgumentException("URI desconhecida: $uri")
        }
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor? {
        if (!mode.startsWith("r")) return null
        val file = resolveAssetFile(uri) ?: return null
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    }

    override fun openAssetFile(uri: Uri, mode: String): AssetFileDescriptor? {
        if (!mode.startsWith("r")) return null
        val file = resolveAssetFile(uri) ?: return null
        val descriptor = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
        return AssetFileDescriptor(descriptor, 0, file.length())
    }

    override fun getType(uri: Uri): String? {
        val ctx = context
        val authority = if (ctx != null) authority(ctx) else uri.authority.orEmpty()
        return when (matcher.match(uri)) {
            METADATA_CODE -> "vnd.android.cursor.dir/vnd.$authority.$METADATA"
            METADATA_CODE_FOR_SINGLE_PACK -> "vnd.android.cursor.item/vnd.$authority.$METADATA"
            STICKERS_CODE -> "vnd.android.cursor.dir/vnd.$authority.$STICKERS"
            STICKERS_ASSET_CODE -> {
                val fileName = uri.lastPathSegment.orEmpty()
                if (fileName.lowercase().endsWith(".png")) "image/png" else "image/webp"
            }
            else -> throw IllegalArgumentException("URI desconhecida: $uri")
        }
    }

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int =
        throw UnsupportedOperationException("Operação não suportada")

    override fun insert(uri: Uri, values: ContentValues?): Uri? =
        throw UnsupportedOperationException("Operação não suportada")

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?,
    ): Int = throw UnsupportedOperationException("Operação não suportada")

    /* --------------------------------------------------------------- helpers */

    private fun packsCursor(uri: Uri, packs: List<StickerPackEntry>): Cursor {
        val cursor = MatrixCursor(PACK_COLUMNS)
        for (pack in packs) {
            cursor.newRow()
                .add(pack.identifier)
                .add(pack.name)
                .add(pack.publisher)
                .add(pack.trayImageFile)
                .add(pack.playStoreLink)
                .add(pack.appStoreLink)
                .add(pack.publisherEmail)
                .add(pack.publisherWebsite)
                .add(pack.privacyPolicyWebsite)
                .add(pack.licenseAgreementWebsite)
                .add(pack.imageDataVersion)
                .add(if (pack.avoidCache) 1 else 0)
                .add(if (pack.animatedStickerPack) 1 else 0)
        }
        notifyUri(uri, cursor)
        return cursor
    }

    private fun stickersCursor(uri: Uri, pack: StickerPackEntry?): Cursor {
        val cursor = MatrixCursor(STICKER_COLUMNS)
        if (pack != null) {
            for (sticker in pack.stickers) {
                cursor.addRow(
                    arrayOf(
                        sticker.imageFile,
                        TextUtils.join(",", sticker.emojis),
                        sticker.accessibilityText,
                    ),
                )
            }
        }
        notifyUri(uri, cursor)
        return cursor
    }

    private fun notifyUri(uri: Uri, cursor: Cursor) {
        val resolver = context?.contentResolver ?: return
        cursor.setNotificationUri(resolver, uri)
    }

    /**
     * Valida o caminho antes de servir o arquivo: apenas imagens declaradas no
     * `contents.json` são expostas (evita leitura arbitrária de arquivos).
     */
    private fun resolveAssetFile(uri: Uri): File? {
        val ctx = context ?: return null
        val segments = uri.pathSegments
        if (segments.size != 3) {
            throw IllegalArgumentException("O caminho deve ter 3 segmentos: $uri")
        }
        val identifier = segments[1]
        val fileName = segments[2]
        if (TextUtils.isEmpty(identifier) || TextUtils.isEmpty(fileName)) {
            throw IllegalArgumentException("Identificador ou nome de arquivo vazio: $uri")
        }
        val pack = StickerContents.findPack(ctx, identifier) ?: return null
        val allowed = pack.trayImageFile == fileName ||
            pack.stickers.any { it.imageFile == fileName }
        if (!allowed) return null

        val file = StickerContents.stickerFile(ctx, identifier, fileName)
        return if (file.exists()) file else null
    }

    companion object {
        /* Colunas — contrato com o WhatsApp (não alterar). */
        const val STICKER_PACK_IDENTIFIER_IN_QUERY = "sticker_pack_identifier"
        const val STICKER_PACK_NAME_IN_QUERY = "sticker_pack_name"
        const val STICKER_PACK_PUBLISHER_IN_QUERY = "sticker_pack_publisher"
        const val STICKER_PACK_ICON_IN_QUERY = "sticker_pack_icon"
        const val ANDROID_APP_DOWNLOAD_LINK_IN_QUERY = "android_play_store_link"
        const val IOS_APP_DOWNLOAD_LINK_IN_QUERY = "ios_app_download_link"
        const val PUBLISHER_EMAIL = "sticker_pack_publisher_email"
        const val PUBLISHER_WEBSITE = "sticker_pack_publisher_website"
        const val PRIVACY_POLICY_WEBSITE = "sticker_pack_privacy_policy_website"
        const val LICENSE_AGREEMENT_WEBSITE = "sticker_pack_license_agreement_website"
        const val IMAGE_DATA_VERSION = "image_data_version"
        const val AVOID_CACHE = "whatsapp_will_not_cache_stickers"
        const val ANIMATED_STICKER_PACK = "animated_sticker_pack"
        const val STICKER_FILE_NAME_IN_QUERY = "sticker_file_name"
        const val STICKER_FILE_EMOJI_IN_QUERY = "sticker_emoji"
        const val STICKER_FILE_ACCESSIBILITY_TEXT_IN_QUERY = "sticker_accessibility_text"

        private const val METADATA = "metadata"
        private const val STICKERS = "stickers"
        private const val STICKERS_ASSET = "stickers_asset"

        private const val METADATA_CODE = 1
        private const val METADATA_CODE_FOR_SINGLE_PACK = 2
        private const val STICKERS_CODE = 3
        private const val STICKERS_ASSET_CODE = 4

        private val PACK_COLUMNS = arrayOf(
            STICKER_PACK_IDENTIFIER_IN_QUERY,
            STICKER_PACK_NAME_IN_QUERY,
            STICKER_PACK_PUBLISHER_IN_QUERY,
            STICKER_PACK_ICON_IN_QUERY,
            ANDROID_APP_DOWNLOAD_LINK_IN_QUERY,
            IOS_APP_DOWNLOAD_LINK_IN_QUERY,
            PUBLISHER_EMAIL,
            PUBLISHER_WEBSITE,
            PRIVACY_POLICY_WEBSITE,
            LICENSE_AGREEMENT_WEBSITE,
            IMAGE_DATA_VERSION,
            AVOID_CACHE,
            ANIMATED_STICKER_PACK,
        )

        private val STICKER_COLUMNS = arrayOf(
            STICKER_FILE_NAME_IN_QUERY,
            STICKER_FILE_EMOJI_IN_QUERY,
            STICKER_FILE_ACCESSIBILITY_TEXT_IN_QUERY,
        )

        /** Authority usada no AndroidManifest e no Intent do WhatsApp. */
        fun authority(context: Context): String = "${context.packageName}.stickercontentprovider"

        fun metadataUri(context: Context): Uri =
            Uri.Builder()
                .scheme(ContentResolver.SCHEME_CONTENT)
                .authority(authority(context))
                .appendPath(METADATA)
                .build()
    }
}
