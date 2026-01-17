import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bike_map_flutter/features/auth/screens/profile_screen.dart';

void main() {
  group('ProfileScreen', () {
    testWidgets('should render placeholder with correct title', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ProfileScreen(),
        ),
      );

      expect(find.text('Profile'), findsOneWidget);
      expect(find.text('Profile Screen - Coming Soon'), findsOneWidget);
    });

    testWidgets('should display AppBar', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ProfileScreen(),
        ),
      );

      expect(find.byType(AppBar), findsOneWidget);
    });

    testWidgets('should display content in center', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: ProfileScreen(),
        ),
      );

      final centerFinder = find.byType(Center);
      expect(centerFinder, findsOneWidget);
    });
  });
}
