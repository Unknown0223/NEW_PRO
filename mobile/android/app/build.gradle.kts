import java.util.Properties
import java.io.FileInputStream
import java.security.KeyStore
import java.security.MessageDigest

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

/** Production OTA — PC dan mustaqil, o‘zgarmas imzo. */
val expectedOtaSha1 = "21FC3148B49A8928A2C2F04F6EDBA8CF36A8F882"

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val otaKeystoreFile = rootProject.file("keystore/salesdoc-ota.jks")

fun failSigning(msg: String): Nothing {
    throw GradleException(
        "\n\n=== SALES ARENA OTA SIGNING ===\n$msg\n" +
            "Kalit: android/keystore/salesdoc-ota.jks (repo ichida, PC dan mustaqil).\n" +
            "Uni o‘chirmang / qayta yaratmang — telefonda yangilash sinadi.\n" +
            "================================\n",
    )
}

if (!keystorePropertiesFile.exists()) {
    failSigning("android/key.properties topilmadi. Repo dan qayta oling (git pull).")
}
if (!otaKeystoreFile.exists()) {
    failSigning("android/keystore/salesdoc-ota.jks topilmadi. Repo dan qayta oling (git pull).")
}

keystoreProperties.load(FileInputStream(keystorePropertiesFile))

val otaStorePassword = (keystoreProperties["storePassword"] as String?)?.takeIf { it.isNotBlank() }
    ?: failSigning("key.properties: storePassword yo‘q")
val otaKeyAlias = (keystoreProperties["keyAlias"] as String?)?.takeIf { it.isNotBlank() }
    ?: failSigning("key.properties: keyAlias yo‘q")
val otaKeyPassword = (keystoreProperties["keyPassword"] as String?)?.takeIf { it.isNotBlank() }
    ?: failSigning("key.properties: keyPassword yo‘q")
val otaStoreFileProp = (keystoreProperties["storeFile"] as String?)?.takeIf { it.isNotBlank() }
    ?: failSigning("key.properties: storeFile yo‘q")

val otaStoreFile = rootProject.file(otaStoreFileProp)
if (!otaStoreFile.exists()) {
    failSigning("storeFile topilmadi: ${otaStoreFile.absolutePath}")
}

// Fingerprint pin — boshqa PC debug.keystore ga “silib” ketmasin.
run {
    val ks = KeyStore.getInstance(KeyStore.getDefaultType())
    otaStoreFile.inputStream().use { ks.load(it, otaStorePassword.toCharArray()) }
    val cert = ks.getCertificate(otaKeyAlias)
        ?: failSigning("Alias topilmadi: $otaKeyAlias")
    val md = MessageDigest.getInstance("SHA-1")
    val sha1 = md.digest(cert.encoded).joinToString("") { "%02X".format(it) }
    if (!sha1.equals(expectedOtaSha1, ignoreCase = true)) {
        failSigning(
            "NOTO‘G‘RI KALIT!\n" +
                "  kutilgan SHA-1: $expectedOtaSha1\n" +
                "  hozirgi SHA-1:  $sha1\n" +
                "salesdoc-ota.jks ni almashtirmang — git dagi nusxani qayta qo‘ying.",
        )
    }
    logger.lifecycle("OTA signing OK — SHA-1 $sha1 (pinned)")
}

android {
    namespace = "uz.salesdoc.salesdoc_mobile"
    compileSdk = flutter.compileSdkVersion
    buildToolsVersion = "35.0.0"
    ndkVersion = "27.0.12077973"

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        applicationId = "uz.salesdoc.salesdoc_mobile"
        minSdk = 26
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        // Nomlar SigningConfig property lari bilan to‘qnashmasin (storePassword shadow).
        create("ota") {
            storeFile = otaStoreFile
            storePassword = otaStorePassword
            keyAlias = otaKeyAlias
            keyPassword = otaKeyPassword
        }
    }

    buildTypes {
        // Debug va release BIR XIL OTA kalit — PC o‘zgarsa ham yangilash ishlaydi.
        debug {
            signingConfig = signingConfigs.getByName("ota")
        }
        release {
            signingConfig = signingConfigs.getByName("ota")
            // R8: flutter_local_notifications Gson TypeToken
            isMinifyEnabled = true
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    // lintVital Metaspace OOM (webview_flutter_android) — release APK uchun o'chiriladi
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

flutter {
    source = "../.."
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
