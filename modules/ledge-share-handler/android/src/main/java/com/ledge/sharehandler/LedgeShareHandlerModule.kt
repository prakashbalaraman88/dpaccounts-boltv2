package com.ledge.sharehandler

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class LedgeShareHandlerModule : Module() {

    override fun definition() = ModuleDefinition {
        Name("LedgeShareHandler")

        // ---------------------------------------------------------------
        // Lifecycle hooks — the key fix.
        //
        // OnCreate fires when the module is instantiated (during RN bridge
        // start-up). At this point the Activity is alive and its intent
        // still has valid content:// URI read permissions. We copy the
        // shared file to our app's internal cache immediately, so by the
        // time any JS code runs the URI is already a stable file:// path.
        //
        // OnNewIntent fires whenever the Activity receives a new intent
        // while already running (warm-start share). Same treatment: copy
        // before the sender can revoke the permission.
        // ---------------------------------------------------------------

        OnCreate {
            val activity = appContext.currentActivity ?: return@OnCreate
            processIntent(activity.intent, activity.contentResolver, activity.cacheDir, sharePrefs(activity))
        }

        OnNewIntent { intent ->
            val activity = appContext.currentActivity ?: return@OnNewIntent
            processIntent(intent, activity.contentResolver, activity.cacheDir, sharePrefs(activity))
        }

        // ---------------------------------------------------------------
        // JS-callable functions
        // ---------------------------------------------------------------

        Function("hasPendingShares") {
            val activity = appContext.currentActivity
            pendingShares.isNotEmpty() || loadPersistedShares(activity?.let { sharePrefs(it) }).isNotEmpty()
        }

        AsyncFunction("getPendingShares") {
            val activity = appContext.currentActivity
            val prefs = activity?.let { sharePrefs(it) }
            (loadPersistedShares(prefs) + pendingShares)
                .distinctBy { "${it["type"]}:${it["path"]}:${it["text"]}" }
                .also {
                    pendingShares.clear()
                    clearPersistedShares(prefs)
                }
        }

        Function("clearPendingShares") {
            val activity = appContext.currentActivity
            pendingShares.clear()
            clearPersistedShares(activity?.let { sharePrefs(it) })
        }
    }

    companion object {
        private const val TAG = "LedgeShareHandler"
        private const val PREFS_NAME = "ledge_share_handler"
        private const val PREF_PENDING_SHARES = "pending_shares"

        // Shares waiting to be consumed by JS. Access is always on the
        // main/JS thread so a plain mutableListOf is safe here.
        val pendingShares = mutableListOf<Map<String, String>>()

        fun processIntent(
            intent: Intent?,
            contentResolver: android.content.ContentResolver,
            cacheDir: File,
            prefs: SharedPreferences? = null
        ) {
            if (intent == null) return
            when (intent.action) {
                Intent.ACTION_SEND -> handleSingle(intent, contentResolver, cacheDir, prefs)
                Intent.ACTION_SEND_MULTIPLE -> handleMultiple(intent, contentResolver, cacheDir, prefs)
            }
        }

        private fun handleSingle(
            intent: Intent,
            contentResolver: android.content.ContentResolver,
            cacheDir: File,
            prefs: SharedPreferences? = null
        ) {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
                ?: firstClipDataUri(intent)

            if (uri != null) {
                val path = copyUriToCache(uri, contentResolver, cacheDir)
                if (path != null) {
                    addPendingShare(
                        mapOf(
                            "type" to "file",
                            "path" to path,
                            "mimeType" to (contentResolver.getType(uri) ?: "image/jpeg"),
                            "text" to (text ?: "")
                        ),
                        prefs
                    )
                    Log.d(TAG, "Copied share to cache: $path")
                } else {
                    Log.w(TAG, "Failed to copy URI $uri — dropping share")
                }
            } else if (!text.isNullOrBlank()) {
                addPendingShare(
                    mapOf(
                        "type" to "text",
                        "text" to text
                    ),
                    prefs
                )
                Log.d(TAG, "Stored text share (${text.length} chars)")
            }
        }

        private fun handleMultiple(
            intent: Intent,
            contentResolver: android.content.ContentResolver,
            cacheDir: File,
            prefs: SharedPreferences? = null
        ) {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            val uris = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
            val firstUri = uris?.firstOrNull() ?: firstClipDataUri(intent)
            // For receipt sharing we only need the first image.
            firstUri?.let { uri ->
                val path = copyUriToCache(uri, contentResolver, cacheDir)
                if (path != null) {
                    addPendingShare(
                        mapOf(
                            "type" to "file",
                            "path" to path,
                            "mimeType" to (contentResolver.getType(uri) ?: "image/jpeg"),
                            "text" to (text ?: "")
                        ),
                        prefs
                    )
                    Log.d(TAG, "Copied multi-share (first image) to cache: $path")
                }
            }
        }

        private fun firstClipDataUri(intent: Intent): Uri? {
            val clipData = intent.clipData ?: return null
            for (i in 0 until clipData.itemCount) {
                val uri = clipData.getItemAt(i)?.uri
                if (uri != null) return uri
            }
            return null
        }

        private fun sharePrefs(context: Context): SharedPreferences =
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        private fun addPendingShare(share: Map<String, String>, prefs: SharedPreferences?) {
            val key = "${share["type"]}:${share["path"]}:${share["text"]}"
            if (pendingShares.none { "${it["type"]}:${it["path"]}:${it["text"]}" == key }) {
                pendingShares.add(share)
            }
            persistShares((loadPersistedShares(prefs) + share).distinctBy {
                "${it["type"]}:${it["path"]}:${it["text"]}"
            }, prefs)
        }

        private fun loadPersistedShares(prefs: SharedPreferences?): List<Map<String, String>> {
            if (prefs == null) return emptyList()
            val raw = prefs.getString(PREF_PENDING_SHARES, null) ?: return emptyList()
            return try {
                val array = JSONArray(raw)
                buildList {
                    for (i in 0 until array.length()) {
                        val item = array.optJSONObject(i) ?: continue
                        val map = mutableMapOf<String, String>()
                        item.keys().forEach { key ->
                            map[key] = item.optString(key, "")
                        }
                        if (map.isNotEmpty()) add(map)
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to read persisted shares", e)
                emptyList()
            }
        }

        private fun persistShares(shares: List<Map<String, String>>, prefs: SharedPreferences?) {
            if (prefs == null) return
            val array = JSONArray()
            shares.takeLast(8).forEach { share ->
                val item = JSONObject()
                share.forEach { (key, value) -> item.put(key, value) }
                array.put(item)
            }
            prefs.edit().putString(PREF_PENDING_SHARES, array.toString()).apply()
        }

        private fun clearPersistedShares(prefs: SharedPreferences?) {
            prefs?.edit()?.remove(PREF_PENDING_SHARES)?.apply()
        }

        private fun copyUriToCache(
            uri: Uri,
            contentResolver: android.content.ContentResolver,
            cacheDir: File
        ): String? {
            return try {
                contentResolver.openInputStream(uri)?.use { input ->
                    val ext = mimeToExtension(contentResolver.getType(uri))
                    val dest = File(cacheDir, "ledge_share_${System.currentTimeMillis()}.$ext")
                    FileOutputStream(dest).use { output ->
                        input.copyTo(output)
                    }
                    if (dest.length() == 0L) {
                        dest.delete()
                        Log.w(TAG, "Copied file is empty, discarding")
                        return null
                    }
                    "file://${dest.absolutePath}"
                }
            } catch (e: Exception) {
                Log.e(TAG, "Copy failed for $uri: ${e.message}", e)
                null
            }
        }

        private fun mimeToExtension(mimeType: String?): String {
            return when (mimeType) {
                "image/jpeg" -> "jpg"
                "image/png" -> "png"
                "image/webp" -> "webp"
                "image/gif" -> "gif"
                "image/heic", "image/heif" -> "jpg"
                "video/mp4" -> "mp4"
                "text/plain" -> "txt"
                else -> "jpg"
            }
        }
    }
}
