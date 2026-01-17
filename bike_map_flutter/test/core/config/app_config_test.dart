import 'package:bike_map_flutter/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AppConfig', () {
    group('Default Values', () {
      test('apiUrl defaults to localhost:8090', () {
        expect(AppConfig.apiUrl, equals('http://localhost:8090'));
      });

      test('tilesUrl defaults to localhost:8090/api/tiles', () {
        expect(AppConfig.tilesUrl, equals('http://localhost:8090/api/tiles'));
      });

      test('environment defaults to development', () {
        expect(AppConfig.environment, equals('development'));
      });

      test('isDevelopment is true by default', () {
        expect(AppConfig.isDevelopment, isTrue);
      });

      test('isProduction is false by default', () {
        expect(AppConfig.isProduction, isFalse);
      });
    });

    group('Environment Flags', () {
      test('isDevelopment matches environment value', () {
        expect(
          AppConfig.isDevelopment,
          equals(AppConfig.environment == 'development'),
        );
      });

      test('isProduction matches environment value', () {
        expect(
          AppConfig.isProduction,
          equals(AppConfig.environment == 'production'),
        );
      });
    });

    group('URL Format', () {
      test('apiUrl starts with http', () {
        expect(AppConfig.apiUrl.startsWith('http'), isTrue);
      });

      test('tilesUrl starts with http', () {
        expect(AppConfig.tilesUrl.startsWith('http'), isTrue);
      });

      test('tilesUrl contains /api/tiles path', () {
        expect(AppConfig.tilesUrl.contains('/api/tiles'), isTrue);
      });
    });

    group('Configuration Consistency', () {
      test('environment value is lowercase', () {
        expect(
          AppConfig.environment,
          equals(AppConfig.environment.toLowerCase()),
        );
      });

      test('only one of isDevelopment or isProduction can be true', () {
        // If both are false, that's ok (could be staging)
        // But they can't both be true
        if (AppConfig.isDevelopment) {
          expect(AppConfig.isProduction, isFalse);
        }
        if (AppConfig.isProduction) {
          expect(AppConfig.isDevelopment, isFalse);
        }
      });
    });

    group('Environment Detection Methods', () {
      test('isStaging returns false when environment is development', () {
        expect(AppConfig.environment, equals('development'));
        expect(AppConfig.isStaging, isFalse);
      });

      test('isStaging returns false when environment is production', () {
        // This test documents expected behavior
        // In actual deployment, would need different build flags
        if (AppConfig.environment == 'production') {
          expect(AppConfig.isStaging, isFalse);
        }
      });

      test('environmentName returns human-readable name', () {
        final name = AppConfig.environmentName;
        expect(name, isNotEmpty);
        expect(name, isA<String>());
      });

      test('environmentName includes environment description', () {
        // Check that the human-readable name contains the environment value
        // Note: environmentName uses Title Case (e.g., "Development (localhost)")
        // so we check lowercase version is in the lowercase environment name
        expect(
          AppConfig.environmentName.toLowerCase(),
          contains(AppConfig.environment.toLowerCase()),
        );
      });

      test('environmentName is stable across calls', () {
        final name1 = AppConfig.environmentName;
        final name2 = AppConfig.environmentName;
        expect(name1, equals(name2));
      });
    });

    group('Environment Flag Combinations', () {
      test('development flags are mutually exclusive with staging', () {
        if (AppConfig.isDevelopment) {
          expect(AppConfig.isStaging, isFalse);
        }
      });

      test('development flags are mutually exclusive with production', () {
        if (AppConfig.isDevelopment) {
          expect(AppConfig.isProduction, isFalse);
        }
      });

      test('staging and production are mutually exclusive', () {
        if (AppConfig.isStaging) {
          expect(AppConfig.isProduction, isFalse);
        }
        if (AppConfig.isProduction) {
          expect(AppConfig.isStaging, isFalse);
        }
      });
    });
  });
}
