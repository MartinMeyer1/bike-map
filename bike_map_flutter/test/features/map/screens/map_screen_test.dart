import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bike_map_flutter/features/map/screens/map_screen.dart';

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
  });
}
