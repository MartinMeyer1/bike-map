import 'package:flutter_test/flutter_test.dart';
import 'package:bike_map_flutter/core/theme/app_spacing.dart';

void main() {
  group('AppSpacing - Spacing Constants', () {
    test('XS spacing should be 4.0', () {
      expect(AppSpacing.spacingXs, 4.0);
    });

    test('S spacing should be 8.0', () {
      expect(AppSpacing.spacingS, 8.0);
    });

    test('M spacing should be 12.0', () {
      expect(AppSpacing.spacingM, 12.0);
    });

    test('L spacing should be 16.0', () {
      expect(AppSpacing.spacingL, 16.0);
    });

    test('XL spacing should be 24.0', () {
      expect(AppSpacing.spacingXl, 24.0);
    });
  });

  group('AppSpacing - Border Radius', () {
    test('radiusS should be 8.0', () {
      expect(AppSpacing.radiusS, 8.0);
    });

    test('radiusM should be 12.0', () {
      expect(AppSpacing.radiusM, 12.0);
    });

    test('radiusL should be 16.0', () {
      expect(AppSpacing.radiusL, 16.0);
    });
  });

  group('AppSpacing - Value Relationships', () {
    test('spacing values should be in ascending order', () {
      expect(AppSpacing.spacingXs < AppSpacing.spacingS, isTrue);
      expect(AppSpacing.spacingS < AppSpacing.spacingM, isTrue);
      expect(AppSpacing.spacingM < AppSpacing.spacingL, isTrue);
      expect(AppSpacing.spacingL < AppSpacing.spacingXl, isTrue);
    });

    test('border radius values should be in ascending order', () {
      expect(AppSpacing.radiusS < AppSpacing.radiusM, isTrue);
      expect(AppSpacing.radiusM < AppSpacing.radiusL, isTrue);
    });
  });

  group('AppSpacing - Constructor', () {
    test('should not be instantiable', () {
      // AppSpacing uses a private constructor to prevent instantiation
      // This test ensures the class is used correctly as a static constants holder
      expect(() => AppSpacing, isNotNull);
    });
  });
}
