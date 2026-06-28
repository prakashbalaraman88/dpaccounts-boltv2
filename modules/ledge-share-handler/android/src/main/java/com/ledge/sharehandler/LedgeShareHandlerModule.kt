package com.ledge.sharehandler

import android.content.Intent
import android.net.Uri
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
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
            processIntent(activity.intent, activity.contentResolver, activity.cacheDir)
        }

        OnNewIntent { intent ->
            val activity = appContext.currentActivity ?: return@OnNewIntent
            processIntent(intent, activity.contentResolver, activity.cacheDir)
        }

        // ---------------------------------------------------------------
        // JS-callable functions
        // ---------------------------------------------------------------

        Function("hasPendingShares") {
            pendingShares.isNotEmpty()
        }

        AsyncFunction("getPendingShares") {
            pendingShares.toList().also { pendingShares.clear() }
        }

        Function("clearPendingShares") {
            pendingShares.clear()
        }
    }

    companion object {
        private const val TAG = "LedgeShareHandler"

        // Shares waiting to be consumed by JS. Access is always on the
        // main/JS thread so a plain mutableListOf is safe here.
        val pendingShares = mutableListOf<Map<String, String>>()

        fun processIntent(
            intent: Intent?,
            contentResolver: android.content.ContentResolver,
            cacheDir: File
        ) {
            if (intent == null) return
            when (intent.action) {
                Intent.ACTION_SEND -> handleSingle(intent, contentResolver, cacheDir)
                Intent.ACTION_SEND_MULTIPLE -> handleMultiple(intent, contentResolver, cacheDir)
            }
        }

        private fun handleSingle(
            intent: Intent,
            contentResolver: android.content.ContentResolver,
            cacheDir: File
        ) {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)

            if (uri != null) {
                val path = copyUriToCache(uri, contentResolver, cacheDir)
                if (path != null) {
                    pendingShares.add(
                        mapOf(
                            "type" to "file",
                            "path" to path,
                            "mimeType" to (contentResolver.getType(uri) ?: "image/jpeg"),
                            "text" to (text ?: "")
                        )
                    )
                    Log.d(TAG, "Copied share to cache: $path")
                } else {
                    Log.w(TAG, "Failed to copy URI $uri — dropping share")
                }
            } else if (!text.isNullOrBlank()) {
                pendingShares.add(
                    mapOf(
                        "type" to "text",
                        "text" to text
                    )
                )
                Log.d(TAG, "Stored text share (${text.length} chars)")
            }
        }

        private fun handleMultiple(
            intent: Intent,
            contentResolver: android.content.ContentResolver,
            cacheDir: File
        ) {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            val uris = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
            // For receipt sharing we only need the first image.
            uris?.firstOrNull()?.let { uri ->
                val path = copyUriToCache(uri, contentResolver, cacheDir)
                if (path != null) {
                    pendingShares.add(
                        mapOf(
                            "type" to "file",
                            "path" to path,
                            "mimeType" to (contentResolver.getType(uri) ?: "image/jpeg"),
                            "text" to (text ?: "")
                        )
                    )
                    Log.d(TAG, "Copied multi-share (first image) to cache: $path")
                }
            }
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
