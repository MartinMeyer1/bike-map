/// Application configuration using compile-time constants
///
/// This file provides centralized configuration for the application using
/// Flutter's --dart-define build arguments. This approach is more secure than
/// .env files and better suited for CI/CD pipelines.
///
/// ## Usage
///
/// **Development Build:**
/// ```bash
/// flutter run --dart-define=API_URL=http://localhost:8090
/// ```
///
/// **Production Build:**
/// ```bash
/// flutter build web --release --dart-define=API_URL=https://bike-map.ch
/// ```
///
/// **Android Emulator:**
/// ```bash
/// # Use 10.0.2.2 instead of localhost for Android emulator
/// flutter run -d emulator --dart-define=API_URL=http://10.0.2.2:8090
/// ```
///
/// **Multiple Variables:**
/// ```bash
/// flutter build web --release \
///   --dart-define=API_URL=https://bike-map.ch \
///   --dart-define=TILES_URL=https://bike-map.ch/api/tiles \
///   --dart-define=ENVIRONMENT=production
/// ```
class AppConfig {
  // Private constructor to prevent instantiation
  AppConfig._();

  /// PocketBase API base URL
  ///
  /// Development: http://localhost:8090
  /// Production: https://bike-map.ch
  /// Android Emulator: http://10.0.2.2:8090
  static const apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:8090',
  );

  /// MVT tiles URL for MapLibre
  ///
  /// Development: http://localhost:8090/api/tiles
  /// Production: https://bike-map.ch/api/tiles
  /// Android Emulator: http://10.0.2.2:8090/api/tiles
  static const tilesUrl = String.fromEnvironment(
    'TILES_URL',
    defaultValue: 'http://localhost:8090/api/tiles',
  );

  /// Current environment (development, staging, production)
  static const environment = String.fromEnvironment(
    'ENVIRONMENT',
    defaultValue: 'development',
  );

  /// Check if running in production
  ///
  /// Returns true only if ENVIRONMENT is explicitly set to 'production'
  static bool get isProduction => environment == 'production';

  /// Check if running in development
  ///
  /// Returns true if ENVIRONMENT is 'development' (the default)
  /// Returns false for other values like 'staging' or unknown values
  static bool get isDevelopment => environment == 'development';

  /// Check if running in staging
  ///
  /// Returns true if ENVIRONMENT is 'staging'
  static bool get isStaging => environment == 'staging';

  /// Get environment name for logging/analytics
  ///
  /// Use this to display which environment is active
  static String get environmentName {
    switch (environment) {
      case 'development':
        return 'Development (localhost)';
      case 'staging':
        return 'Staging';
      case 'production':
        return 'Production (bike-map.ch)';
      default:
        return 'Unknown ($environment)';
    }
  }
}
