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

        Function("hasPendingShares") {
            return@Function pendingShares.isNotEmpty()
        }

        Function("getPendingShares") {
            return@Function pendingShares.toList().also { pendingShares.clear() }
        }

        Function("clearPendingShares") {
            pendingShares.clear()
        }
    }

    companion object {
        private val pendingShares = mutableListOf<Map<String, String>>()

        fun handleIntent(intent: Intent?, contentResolver: android.content.ContentResolver, cacheDir: File) {
            if (intent == null) return
            when (intent.action) {
                Intent.ACTION_SEND -> handleSingle(intent, contentResolver, cacheDir)
                Intent.ACTION_SEND_MULTIPLE -> handleMultiple(intent, contentResolver, cacheDir)
            }
        }

        private fun handleSingle(intent: Intent, contentResolver: android.content.ContentResolver, cacheDir: File) {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)
            val uri = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)

            if (uri != null) {
                val path = copyUriToCache(uri, contentResolver, cacheDir)
                if (path != null) {
                    pendingShares.add(mapOf(
                        "type" to "file",
                        "path" to path,
                        "mimeType" to (contentResolver.getType(uri) ?: "image/*")
                    ))
                }
            } else if (text != null) {
                pendingShares.add(mapOf(
                    "type" to "text",
                    "text" to text
                ))
            }
        }

        private fun handleMultiple(intent: Intent, contentResolver: android.content.ContentResolver, cacheDir: File) {
            val uris = intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
            uris?.forEach { uri ->
                copyUriToCache(uri, contentResolver, cacheDir)?.let { path ->
                    pendingShares.add(mapOf(
                        "type" to "file",
                        "path" to path,
                        "mimeType" to (contentResolver.getType(uri) ?: "image/*")
                    ))
                }
            }
        }

        private fun copyUriToCache(uri: Uri, contentResolver: android.content.ContentResolver, cacheDir: File): String? {
            return try {
                contentResolver.openInputStream(uri)?.use { input ->
                    val ext = getExtension(contentResolver.getType(uri))
                    val dest = File(cacheDir, "ledge_share_${System.currentTimeMillis()}.$ext")
                    FileOutputStream(dest).use { output ->
                        input.copyTo(output)
                    }
                    // Return absolute path with file:// prefix for React Native
                    "file://${dest.absolutePath}"
                }
            } catch (e: Exception) {
                Log.e("LedgeShareHandler", "Copy failed for $uri: ${e.message}", e)
                null
            }
        }

        private fun getExtension(mimeType: String?): String {
            return when (mimeType) {
                "image/jpeg" -> "jpg"
                "image/png" -> "png"
                "image/webp" -> "webp"
                "image/gif" -> "gif"
                "video/mp4" -> "mp4"
                "text/plain" -> "txt"
                else -> "bin"
            }
        }
    }
}
