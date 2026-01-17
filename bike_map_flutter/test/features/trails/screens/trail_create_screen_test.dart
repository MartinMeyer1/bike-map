import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bike_map_flutter/features/trails/screens/trail_create_screen.dart';

void main() {
  group('TrailCreateScreen', () {
    testWidgets('should render placeholder with correct title', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: TrailCreateScreen(),
        ),
      );

      expect(find.text('Create Trail'), findsOneWidget);
      expect(find.text('Trail Create Screen - Coming Soon'), findsOneWidget);
    });

    testWidgets('should display AppBar', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: TrailCreateScreen(),
        ),
      );

      expect(find.byType(AppBar), findsOneWidget);
    });

    testWidgets('should display content in center', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: TrailCreateScreen(),
        ),
      );

      final centerFinder = find.byType(Center);
      expect(centerFinder, findsOneWidget);
    });
  });
}
