plugins {
    // AGP 8.7.3 + Kotlin 2.0.21 (compileSdk 35).
    // Android 16 Live Updates / ColorOS 流体云 通过运行时反射调用，无需 compileSdk 36，
    // 因此同一份 APK 可在 Android 16 设备上直接进入流体云。
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
}
