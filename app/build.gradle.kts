plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.app.m3expressive"
    // 本机可用的 SDK 平台为 android-35；Android 16（API 36）的 Live Updates / 流体云
    // 通过运行时反射调用，因此在 Android 16 设备上依然会进入流体云。
    // 若已安装 platforms;android-36，把下面两行改为 36 即可获得 targetSdk 36 构建。
    compileSdk = 35

    defaultConfig {
        applicationId = "com.app.m3expressive"
        minSdk = 26
        targetSdk = 35
        versionCode = 4
        versionName = "1.0.3"

        ndk {
            // 天玑 9400（MT6991）为 arm64-v8a
            abiFilters += "arm64-v8a"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    debugImplementation("androidx.compose.ui:ui-tooling")
}
