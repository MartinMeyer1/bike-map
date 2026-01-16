/// BikeMap spacing and shape system
///
/// BikeMap adopts generous spacing for clean aesthetic (SwissTopo influence)
class AppSpacing {
  // ============================================================================
  // Spacing Constants
  // ============================================================================

  /// XS spacing - 4dp
  ///
  /// Usage: Minimal gaps, tight layouts
  static const double spacingXs = 4.0;

  /// S spacing - 8dp
  ///
  /// Usage: Standard element spacing
  static const double spacingS = 8.0;

  /// M spacing - 12dp
  ///
  /// Usage: Comfortable vertical spacing
  static const double spacingM = 12.0;

  /// L spacing - 16dp
  ///
  /// Usage: Card padding, comfortable touch
  static const double spacingL = 16.0;

  /// XL spacing - 24dp
  ///
  /// Usage: Section separation, bottom sheet padding
  static const double spacingXl = 24.0;

  // ============================================================================
  // Border Radius - Shape System
  // ============================================================================
  //
  // Material 3 defaults refined for BikeMap

  /// Small border radius - 8dp
  ///
  /// Usage: Buttons (approachable but not aggressive)
  static const double radiusS = 8.0;

  /// Medium border radius - 12dp
  ///
  /// Usage: Cards (modern without being bubbly)
  static const double radiusM = 12.0;

  /// Large border radius - 16dp
  ///
  /// Usage: Difficulty badges, bottom sheet top corners
  static const double radiusL = 16.0;

  // Prevent instantiation
  const AppSpacing._();
}
