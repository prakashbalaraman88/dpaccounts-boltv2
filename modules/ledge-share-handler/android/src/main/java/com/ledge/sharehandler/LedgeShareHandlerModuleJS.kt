package com.ledge.sharehandler

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap

class LedgeShareHandlerModuleJS(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {

    override fun getName(): String = "LedgeShareHandler"

    @ReactMethod
    fun getPendingShares(promise: Promise) {
        try {
            val shares = LedgeShareHandlerModule.pendingShares.toList()
            val result = WritableNativeArray()
            for (share in shares) {
                val map = WritableNativeMap()
                for ((key, value) in share) {
                    map.putString(key, value)
                }
                result.pushMap(map)
            }
            LedgeShareHandlerModule.pendingShares.clear()
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e("LedgeShareHandler", "getPendingShares failed", e)
            promise.reject("ERR_SHARE", e.message, e)
        }
    }

    @ReactMethod
    fun clearPendingShares(promise: Promise) {
        LedgeShareHandlerModule.pendingShares.clear()
        promise.resolve(null)
    }

    @ReactMethod
    fun hasPendingShares(promise: Promise) {
        promise.resolve(LedgeShareHandlerModule.pendingShares.isNotEmpty())
    }
}
