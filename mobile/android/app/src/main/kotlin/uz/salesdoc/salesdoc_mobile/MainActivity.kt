package uz.salesdoc.salesdoc_mobile

import android.app.DownloadManager
import android.content.ContentUris
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterFragmentActivity() {
    private val channelName = "uz.salesdoc/app_update"
    private val exportedApkName = "SalesArena-update.apk"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "canInstallPackages" -> {
                        result.success(canInstallPackages())
                    }
                    "openInstallPermissionSettings" -> {
                        try {
                            openInstallPermissionSettings()
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("SETTINGS", e.message, null)
                        }
                    }
                    "checkApkCompatible" -> {
                        val path = call.argument<String>("path")
                        if (path.isNullOrBlank()) {
                            result.error("NO_PATH", "APK path missing", null)
                            return@setMethodCallHandler
                        }
                        try {
                            result.success(checkApkCompatible(path))
                        } catch (e: Exception) {
                            result.error("CHECK_FAILED", e.message, null)
                        }
                    }
                    "installApk" -> {
                        val path = call.argument<String>("path")
                        if (path.isNullOrBlank()) {
                            result.error("NO_PATH", "APK path missing", null)
                            return@setMethodCallHandler
                        }
                        try {
                            val compat = checkApkCompatible(path)
                            if (compat["compatible"] != true) {
                                val details = HashMap(compat)
                                details["apkPath"] = path
                                result.error(
                                    "SIGNATURE_MISMATCH",
                                    compat["message"]?.toString()
                                        ?: "APK signature does not match installed app",
                                    details,
                                )
                                return@setMethodCallHandler
                            }
                            installApkFromFile(path)
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("INSTALL_FAILED", e.message, null)
                        }
                    }
                    "exportApkToDownloads" -> {
                        val path = call.argument<String>("path")
                        if (path.isNullOrBlank()) {
                            result.error("NO_PATH", "APK path missing", null)
                            return@setMethodCallHandler
                        }
                        try {
                            result.success(exportApkToDownloads(path))
                        } catch (e: Exception) {
                            result.error("EXPORT_FAILED", e.message, null)
                        }
                    }
                    "requestUninstall" -> {
                        try {
                            requestUninstall()
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("UNINSTALL_FAILED", e.message, null)
                        }
                    }
                    "openDownloads" -> {
                        try {
                            openDownloads()
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("OPEN_DOWNLOADS", e.message, null)
                        }
                    }
                    "installExportedApk" -> {
                        val uriStr = call.argument<String>("uri")
                        val path = call.argument<String>("path")
                        try {
                            when {
                                !uriStr.isNullOrBlank() -> installApkFromUri(Uri.parse(uriStr))
                                !path.isNullOrBlank() -> installApkFromFile(path)
                                else -> {
                                    result.error("NO_PATH", "Exported APK uri/path missing", null)
                                    return@setMethodCallHandler
                                }
                            }
                            result.success(true)
                        } catch (e: Exception) {
                            result.error("INSTALL_FAILED", e.message, null)
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun canInstallPackages(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    private fun openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                data = Uri.parse("package:$packageName")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        }
    }

    /**
     * Yuklangan APK paket nomi va imzosi joriy ilova bilan mosligini tekshiradi.
     * Mos kelmasa Android ustiga yangilashni rad etadi — foydalanuvchiga aniq xabar.
     */
    private fun checkApkCompatible(path: String): Map<String, Any?> {
        val file = File(path)
        if (!file.exists()) {
            return mapOf(
                "compatible" to false,
                "reason" to "missing",
                "message" to "APK fayli topilmadi",
            )
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            @Suppress("DEPRECATION")
            PackageManager.GET_SIGNATURES
        }

        @Suppress("DEPRECATION")
        val apkInfo = packageManager.getPackageArchiveInfo(path, flags)
            ?: return mapOf(
                "compatible" to false,
                "reason" to "unreadable",
                "message" to "APK o‘qib bo‘lmadi",
            )

        val apkPackage = apkInfo.packageName
        if (apkPackage != null && apkPackage != packageName) {
            return mapOf(
                "compatible" to false,
                "reason" to "package_mismatch",
                "message" to "APK paket nomi mos emas ($apkPackage)",
                "apkPackage" to apkPackage,
                "installedPackage" to packageName,
            )
        }

        val installedSigs = installedSignatureBytes()
        val apkSigs = apkSignatureBytes(apkInfo)
        if (installedSigs.isEmpty() || apkSigs.isEmpty()) {
            // Imzo o‘qilmasa — Android o‘zi rad etadi; o‘rnatishga ruxsat beramiz.
            return mapOf("compatible" to true, "reason" to "unchecked")
        }

        val match = installedSigs.any { inst -> apkSigs.any { apk -> inst.contentEquals(apk) } }
        if (match) {
            return mapOf("compatible" to true, "reason" to "ok")
        }

        return mapOf(
            "compatible" to false,
            "reason" to "signature_mismatch",
            "message" to (
                "Yangilash imkonsiz: telefoningizdagi ilova boshqa kalit bilan o‘rnatilgan. " +
                    "APK Downloads ga saqlanadi — avval Downloads ni oching, keyin ilovani o‘chiring " +
                    "va Downloads dagi SalesArena-update.apk ni oching."
                ),
        )
    }

    private fun installedSignatureBytes(): List<ByteArray> {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val info = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNING_CERTIFICATES)
                val signingInfo = info.signingInfo ?: return emptyList()
                val signers = if (signingInfo.hasMultipleSigners()) {
                    signingInfo.apkContentsSigners
                } else {
                    signingInfo.signingCertificateHistory
                }
                signers?.map { it.toByteArray() } ?: emptyList()
            } else {
                @Suppress("DEPRECATION")
                val info = packageManager.getPackageInfo(packageName, PackageManager.GET_SIGNATURES)
                @Suppress("DEPRECATION")
                info.signatures?.map { it.toByteArray() } ?: emptyList()
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun apkSignatureBytes(apkInfo: android.content.pm.PackageInfo): List<ByteArray> {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val signingInfo = apkInfo.signingInfo ?: return emptyList()
                val signers = if (signingInfo.hasMultipleSigners()) {
                    signingInfo.apkContentsSigners
                } else {
                    signingInfo.signingCertificateHistory
                }
                signers?.map { it.toByteArray() } ?: emptyList()
            } else {
                @Suppress("DEPRECATION")
                apkInfo.signatures?.map { it.toByteArray() } ?: emptyList()
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    /** Public Downloads — uninstall dan keyin ham qoladi. */
    private fun exportApkToDownloads(sourcePath: String): Map<String, Any?> {
        val src = File(sourcePath)
        if (!src.exists()) throw IllegalStateException("APK file not found")

        // 1) Klassik Downloads fayl (Files / emulator uchun ishonchliroq)
        @Suppress("DEPRECATION")
        val publicDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
        var absolutePath: String? = null
        var fileProviderUri: Uri? = null
        try {
            if (!publicDir.exists()) publicDir.mkdirs()
            val dest = File(publicDir, exportedApkName)
            src.copyTo(dest, overwrite = true)
            absolutePath = dest.absolutePath
            MediaScannerConnection.scanFile(this, arrayOf(dest.absolutePath), null, null)
            fileProviderUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", dest)
        } catch (_: Exception) {
            // Android 10+ cheklov — MediaStore ga o‘tamiz
        }

        // 2) MediaStore (Q+ tavsiya) — Downloads ilovasida ko‘rinadi
        var mediaUri: Uri? = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val resolver = contentResolver
            resolver.query(
                MediaStore.Downloads.EXTERNAL_CONTENT_URI,
                arrayOf(MediaStore.Downloads._ID),
                "${MediaStore.Downloads.DISPLAY_NAME}=?",
                arrayOf(exportedApkName),
                null,
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    val id = cursor.getLong(0)
                    resolver.delete(
                        ContentUris.withAppendedId(MediaStore.Downloads.EXTERNAL_CONTENT_URI, id),
                        null,
                        null,
                    )
                }
            }

            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, exportedApkName)
                put(MediaStore.MediaColumns.MIME_TYPE, "application/vnd.android.package-archive")
                put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                put(MediaStore.MediaColumns.IS_PENDING, 1)
            }
            mediaUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: throw IllegalStateException("Cannot create Downloads entry")
            resolver.openOutputStream(mediaUri)?.use { out ->
                src.inputStream().use { input -> input.copyTo(out) }
            } ?: throw IllegalStateException("Cannot write to Downloads")

            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(mediaUri, values, null, null)
        }

        val uri = mediaUri ?: fileProviderUri
            ?: throw IllegalStateException("APK ni Downloads ga yozib bo‘lmadi")

        return mapOf(
            "uri" to uri.toString(),
            "displayName" to exportedApkName,
            "path" to (absolutePath ?: "${Environment.DIRECTORY_DOWNLOADS}/$exportedApkName"),
        )
    }

    private fun requestUninstall() {
        val intent = Intent(Intent.ACTION_DELETE).apply {
            data = Uri.parse("package:$packageName")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
    }

    private fun openDownloads() {
        try {
            val intent = Intent(DownloadManager.ACTION_VIEW_DOWNLOADS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        } catch (_: Exception) {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(
                    Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADownload"),
                    "vnd.android.document/directory",
                )
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)
        }
    }

    private fun installApkFromFile(path: String) {
        val file = File(path)
        if (!file.exists()) throw IllegalStateException("APK file not found")
        val uri = FileProvider.getUriForFile(
            this,
            "$packageName.fileprovider",
            file,
        )
        installApkFromUri(uri)
    }

    private fun installApkFromUri(uri: Uri) {
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
            putExtra(Intent.EXTRA_RETURN_RESULT, true)
        }
        startActivity(intent)
    }
}
