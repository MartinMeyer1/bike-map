import 'package:flutter/material.dart';
import 'app_colors.dart';

/// BikeMap Material 3 theme configuration
///
/// Implements "Outdoor Enduro with Sober Sophistication" visual identity:
/// - 90% Clean, Sober Interface (SwissTopo-inspired minimalism)
/// - 10% Enduro Spirit Moments (strategic color and energy)
class AppTheme {
  /// Light theme configuration with BikeMap design tokens
  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      colorScheme: const ColorScheme.light(
        primary: AppColors.primaryOrangeTerre,
        secondary: AppColors.secondaryTurquoise,
        tertiary: AppColors.accentJaune,
        surface: AppColors.surfaceWarm,
        error: Colors.red, // Material default
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: AppColors.textPrimary,
      ),
      scaffoldBackgroundColor: AppColors.backgroundWarm,
      // Component-level customization comes in later stories
    );
  }

  // Prevent instantiation
  const AppTheme._();
}
