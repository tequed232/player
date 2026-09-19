package com.app.m3expressive.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

private val LightGreenColorScheme = lightColorScheme(
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
        darkTheme -> darkColorScheme()
        else -> LightGreenColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography(),
        shapes = Shapes(),
        content = content
    )
}
