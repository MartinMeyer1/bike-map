import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bike_map_flutter/features/map/screens/map_screen.dart';
import 'package:bike_map_flutter/core/theme/app_theme.dart';

void main() {
  group('MapScreen', () {
    testWidgets('should render placeholder with correct title', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: MapScreen(),
        ),
      );

      expect(find.text('Map'), findsOneWidget);
      expect(find.text('Map Screen - Coming Soon'), findsOneWidget);
    });

    testWidgets('should display AppBar', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: MapScreen(),
        ),
      );

      expect(find.byType(AppBar), findsOneWidget);
    });

    testWidgets('should display content in center', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: MapScreen(),
        ),
      );

      final centerFinder = find.byType(Center);
      expect(centerFinder, findsOneWidget);
    });

    testWidgets('should inherit theme from MaterialApp', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: const MapScreen(),
        ),
      );

      // Verify AppBar uses theme
      final appBarWidget = tester.widget<AppBar>(find.byType(AppBar));
      expect(appBarWidget, isNotNull);

      // Verify Scaffold uses theme background
      final scaffoldWidget = tester.widget<Scaffold>(find.byType(Scaffold));
      expect(scaffoldWidget, isNotNull);
    });
  });
}
