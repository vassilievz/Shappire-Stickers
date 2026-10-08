package com.shappire.stickers

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Modelo e leitura do `contents.json` gerado pelo frontend.
 *
 * O arquivo fica em `files/sticker_packs/contents.json` (armazenamento privado do
 * app) e segue exatamente o formato exigido pelo WhatsApp:
 * https://github.com/WhatsApp/stickers (Android/app/src/main/assets/contents.json).
 *
 * Os nomes dos campos abaixo são parte do contrato com o WhatsApp e não podem
 * ser alterados.
 */
data class StickerEntry(
    val imageFile: String,
    val emojis: List<String>,
    val accessibilityText: String,
) {
    companion object {
        const val KEY_IMAGE_FILE = "image_file"
        const val KEY_EMOJIS = "emojis"
        const val KEY_ACCESSIBILITY_TEXT = "accessibility_text"
    }
}

data class StickerPackEntry(
    val identifier: String,
    val name: String,
    val publisher: String,
    val trayImageFile: String,
    val imageDataVersion: String,
    val avoidCache: Boolean,
    val animatedStickerPack: Boolean,
    val playStoreLink: String,
    val appStoreLink: String,
    val publisherEmail: String,
    val publisherWebsite: String,
    val privacyPolicyWebsite: String,
    val licenseAgreementWebsite: String,
    val stickers: List<StickerEntry>,
) {
    companion object {
        const val KEY_IDENTIFIER = "identifier"
        const val KEY_NAME = "name"
        const val KEY_PUBLISHER = "publisher"
        const val KEY_TRAY_IMAGE_FILE = "tray_image_file"
        const val KEY_IMAGE_DATA_VERSION = "image_data_version"
        const val KEY_AVOID_CACHE = "avoid_cache"
        const val KEY_ANIMATED = "animated_sticker_pack"
        const val KEY_PUBLISHER_EMAIL = "publisher_email"
        const val KEY_PUBLISHER_WEBSITE = "publisher_website"
        const val KEY_PRIVACY_POLICY = "privacy_policy_website"
        const val KEY_LICENSE_AGREEMENT = "license_agreement_website"
        const val KEY_STICKERS = "stickers"
    }
}

/** Leitura e resolução de caminhos dos arquivos consumidos pelo WhatsApp. */
object StickerContents {

    const val DIRECTORY_NAME = "sticker_packs"
    const val FILE_NAME = "contents.json"

    @Volatile
    private var cache: List<StickerPackEntry> = emptyList()

    @Volatile
    private var cacheStamp: Long = -1L

    fun directory(context: Context): File = File(context.filesDir, DIRECTORY_NAME)

    fun contentsFile(context: Context): File = File(directory(context), FILE_NAME)

    fun packDirectory(context: Context, identifier: String): File =
        File(directory(context), identifier)

    fun stickerFile(context: Context, identifier: String, fileName: String): File =
        File(packDirectory(context, identifier), fileName)

    /**
     * Lê o índice de pacotes. O resultado é cacheado enquanto o arquivo não muda,
     * o que evita reparsear o JSON em cada consulta do WhatsApp.
     */
    fun read(context: Context): List<StickerPackEntry> {
        val file = contentsFile(context)
        val stamp = if (file.exists()) file.lastModified() else -1L
        if (stamp == cacheStamp) return cache

        val parsed = if (file.exists()) parse(file.readText()) else emptyList()
        cache = parsed
        cacheStamp = stamp
        return parsed
    }

    fun invalidate() {
        cacheStamp = -1L
    }

    fun findPack(context: Context, identifier: String): StickerPackEntry? =
        read(context).firstOrNull { it.identifier == identifier }

    fun parse(raw: String): List<StickerPackEntry> {
        val root = JSONObject(raw)
        val packs = root.optJSONArray("sticker_packs") ?: JSONArray()
        val result = ArrayList<StickerPackEntry>(packs.length())
        for (index in 0 until packs.length()) {
            val pack = packs.optJSONObject(index) ?: continue
            val identifier = pack.optString(StickerPackEntry.KEY_IDENTIFIER, "")
            if (identifier.isEmpty()) continue
            result.add(
                StickerPackEntry(
                    identifier = identifier,
                    name = pack.optString(StickerPackEntry.KEY_NAME, ""),
                    publisher = pack.optString(StickerPackEntry.KEY_PUBLISHER, ""),
                    trayImageFile = pack.optString(StickerPackEntry.KEY_TRAY_IMAGE_FILE, ""),
                    imageDataVersion = pack.optString(StickerPackEntry.KEY_IMAGE_DATA_VERSION, "1"),
                    avoidCache = pack.optBoolean(StickerPackEntry.KEY_AVOID_CACHE, false),
                    animatedStickerPack = pack.optBoolean(StickerPackEntry.KEY_ANIMATED, false),
                    playStoreLink = root.optString("android_play_store_link", ""),
                    appStoreLink = root.optString("ios_app_store_link", ""),
                    publisherEmail = pack.optString(StickerPackEntry.KEY_PUBLISHER_EMAIL, ""),
                    publisherWebsite = pack.optString(StickerPackEntry.KEY_PUBLISHER_WEBSITE, ""),
                    privacyPolicyWebsite = pack.optString(StickerPackEntry.KEY_PRIVACY_POLICY, ""),
                    licenseAgreementWebsite = pack.optString(StickerPackEntry.KEY_LICENSE_AGREEMENT, ""),
                    stickers = parseStickers(pack.optJSONArray(StickerPackEntry.KEY_STICKERS)),
                ),
            )
        }
        return result
    }

    private fun parseStickers(array: JSONArray?): List<StickerEntry> {
        if (array == null) return emptyList()
        val result = ArrayList<StickerEntry>(array.length())
        for (index in 0 until array.length()) {
            val sticker = array.optJSONObject(index) ?: continue
            val imageFile = sticker.optString(StickerEntry.KEY_IMAGE_FILE, "")
            if (imageFile.isEmpty()) continue
            val emojis = sticker.optJSONArray(StickerEntry.KEY_EMOJIS)
            val emojiList = ArrayList<String>()
            if (emojis != null) {
                for (emojiIndex in 0 until emojis.length()) {
                    val value = emojis.optString(emojiIndex, "").trim()
                    if (value.isNotEmpty()) emojiList.add(value)
                }
            }
            result.add(
                StickerEntry(
                    imageFile = imageFile,
                    emojis = emojiList,
                    accessibilityText = sticker.optString(StickerEntry.KEY_ACCESSIBILITY_TEXT, ""),
                ),
            )
        }
        return result
    }
}
