import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bike_map_flutter/features/auth/screens/login_screen.dart';

void main() {
  group('LoginScreen', () {
    testWidgets('should render placeholder with correct title', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoginScreen(),
        ),
      );

      expect(find.text('Login'), findsOneWidget);
      expect(find.text('Login Screen - Coming Soon'), findsOneWidget);
    });

    testWidgets('should display AppBar', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoginScreen(),
        ),
      );

      expect(find.byType(AppBar), findsOneWidget);
    });

    testWidgets('should display content in center', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: LoginScreen(),
        ),
      );

      final centerFinder = find.byType(Center);
      expect(centerFinder, findsOneWidget);
    });
  });
}
