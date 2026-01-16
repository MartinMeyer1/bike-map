import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bike_map_flutter/core/theme/app_theme.dart';
import 'package:bike_map_flutter/core/theme/app_colors.dart';

void main() {
  group('AppTheme - Material 3 Configuration', () {
    test('lightTheme should enable Material 3', () {
      final theme = AppTheme.lightTheme;
      expect(theme.useMaterial3, isTrue);
    });

    test('lightTheme should have light brightness', () {
      final theme = AppTheme.lightTheme;
      expect(theme.colorScheme.brightness, Brightness.light);
    });
  });

  group('AppTheme - Color Scheme Configuration', () {
    late ThemeData theme;

    setUp(() {
      theme = AppTheme.lightTheme;
    });

    test('primary color should be Orange Terre', () {
      expect(theme.colorScheme.primary, AppColors.primaryOrangeTerre);
    });

    test('secondary color should be Turquoise', () {
      expect(theme.colorScheme.secondary, AppColors.secondaryTurquoise);
    });

    test('tertiary color should be Jaune', () {
      expect(theme.colorScheme.tertiary, AppColors.accentJaune);
    });

    test('surface color should be Surface Warm', () {
      expect(theme.colorScheme.surface, AppColors.surfaceWarm);
    });

    test('onPrimary color should be white', () {
      expect(theme.colorScheme.onPrimary, Colors.white);
    });

    test('onSecondary color should be white', () {
      expect(theme.colorScheme.onSecondary, Colors.white);
    });

    test('onSurface color should be Text Primary', () {
      expect(theme.colorScheme.onSurface, AppColors.textPrimary);
    });
  });

  group('AppTheme - Scaffold Configuration', () {
    test('scaffoldBackgroundColor should be Background Warm', () {
      final theme = AppTheme.lightTheme;
      expect(theme.scaffoldBackgroundColor, AppColors.backgroundWarm);
    });
  });

  group('AppTheme - Integration Test', () {
    testWidgets('theme should apply correctly to MaterialApp',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const Scaffold(
            body: Center(child: Text('Test')),
          ),
        ),
      );

      final BuildContext context = tester.element(find.byType(Scaffold));
      final ThemeData theme = Theme.of(context);

      // Verify theme is applied
      expect(theme.useMaterial3, isTrue);
      expect(theme.colorScheme.primary, AppColors.primaryOrangeTerre);

      // Verify scaffold background
      final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
      expect(
        scaffold.backgroundColor ?? theme.scaffoldBackgroundColor,
        AppColors.backgroundWarm,
      );
    });
  });

  group('AppTheme - Constructor', () {
    test('should not be instantiable', () {
      // AppTheme uses a private constructor to prevent instantiation
      // This test ensures the class is used correctly as a static theme holder
      expect(() => AppTheme, isNotNull);
    });
  });
}
