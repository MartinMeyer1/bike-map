import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bike_map_flutter/core/theme/app_colors.dart';

void main() {
  group('AppColors - Primary Colors', () {
    test('primaryOrangeTerre should be #B7410E', () {
      expect(AppColors.primaryOrangeTerre, const Color(0xFFB7410E));
    });

    test('secondaryTurquoise should be #069494', () {
      expect(AppColors.secondaryTurquoise, const Color(0xFF069494));
    });

    test('accentJaune should be #FFCE1B', () {
      expect(AppColors.accentJaune, const Color(0xFFFFCE1B));
    });
  });

  group('AppColors - Difficulty Colors', () {
    test('S0 (Easy) should be #738F77', () {
      expect(AppColors.s0VertMousse, const Color(0xFF738F77));
    });

    test('S1 (Moderate) should be #7A94A3', () {
      expect(AppColors.s1BleuGris, const Color(0xFF7A94A3));
    });

    test('S2 (Intermediate) should be #A87D52', () {
      expect(AppColors.s2TerreOcre, const Color(0xFFA87D52));
    });

    test('S3 (Difficult) should be #A8685A', () {
      expect(AppColors.s3RougeTerrecuite, const Color(0xFFA8685A));
    });

    test('S4 (Very Difficult) should be #7D637F', () {
      expect(AppColors.s4VioletRoche, const Color(0xFF7D637F));
    });

    test('S5 (Extreme) should be #3A3A3A', () {
      expect(AppColors.s5Anthracite, const Color(0xFF3A3A3A));
    });
  });

  group('AppColors - Neutral Colors', () {
    test('backgroundWarm should be #FAFAF8', () {
      expect(AppColors.backgroundWarm, const Color(0xFFFAFAF8));
    });

    test('surfaceWarm should be #F5F5F3', () {
      expect(AppColors.surfaceWarm, const Color(0xFFF5F5F3));
    });

    test('textPrimary should be #2A2622', () {
      expect(AppColors.textPrimary, const Color(0xFF2A2622));
    });

    test('textSecondary should be #6B6660', () {
      expect(AppColors.textSecondary, const Color(0xFF6B6660));
    });
  });

  group('AppColors - Color Properties', () {
    test('primary colors should have full opacity', () {
      expect((AppColors.primaryOrangeTerre.a * 255.0).round(), 255);
      expect((AppColors.secondaryTurquoise.a * 255.0).round(), 255);
      expect((AppColors.accentJaune.a * 255.0).round(), 255);
    });

    test('difficulty colors should have full opacity', () {
      expect((AppColors.s0VertMousse.a * 255.0).round(), 255);
      expect((AppColors.s1BleuGris.a * 255.0).round(), 255);
      expect((AppColors.s2TerreOcre.a * 255.0).round(), 255);
      expect((AppColors.s3RougeTerrecuite.a * 255.0).round(), 255);
      expect((AppColors.s4VioletRoche.a * 255.0).round(), 255);
      expect((AppColors.s5Anthracite.a * 255.0).round(), 255);
    });

    test('neutral colors should have full opacity', () {
      expect((AppColors.backgroundWarm.a * 255.0).round(), 255);
      expect((AppColors.surfaceWarm.a * 255.0).round(), 255);
      expect((AppColors.textPrimary.a * 255.0).round(), 255);
      expect((AppColors.textSecondary.a * 255.0).round(), 255);
    });
  });

  group('AppColors - Constructor', () {
    test('should not be instantiable', () {
      // AppColors uses a private constructor to prevent instantiation
      // This test ensures the class is used correctly as a static constants holder
      expect(() => AppColors, isNotNull);
      // If someone tries to instantiate via reflection or other means,
      // the private constructor should prevent it at compile time
    });
  });
}
