package com.app.m3expressive.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

// 严格使用声明的 Green 系 High Contrast 角色
val LightGreenColorScheme = lightColorScheme(
    primary = Color(0xFF00391C),
    onPrimary = Color(0xFFFEFFFE),
    primaryContainer = Color(0xFF12512E),
    onPrimaryContainer = Color(0xFFFEFFFE),
    secondary = Color(0xFF243429),
    secondaryContainer = Color(0xFF3A4B3F),
    onSecondaryContainer = Color(0xFFFEFFFE),
    tertiaryContainer = Color(0xFF1E4D54),
    onTertiaryContainer = Color(0xFFFEFFFF),
    surface = Color(0xFFF5FBF6),
    surfaceContainerLow = Color(0xFFEFF5F1),
    surfaceContainer = Color(0xFFEAEFEB),
    surfaceContainerHigh = Color(0xFFE4EAE5),
    surfaceContainerHighest = Color(0xFFDEE4E0),
    onSurface = Color(0xFF000000),
    onSurfaceVariant = Color(0xFF141E17),
    outline = Color(0xFF28332B),
    outlineVariant = Color(0xFF28332B),
    inverseSurface = Color(0xFF2D312E),
    inverseOnSurface = Color(0xFFECF2EE),
    inversePrimary = Color(0xFF96D5A9),
    error = Color(0xFFB3261E),
    onError = Color(0xFFFFFFFF),
    errorContainer = Color(0xFFF9DEDC),
    onErrorContainer = Color(0xFF410E0B)
)

@Composable
fun M3ExpressiveTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val context = LocalContext.current
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        else -> LightGreenColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography, // 遵循 Roboto 并对 Title/Button 采用 Emphasized 字重
        shapes = Shapes,
        content = content
    )
}