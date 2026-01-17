import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:bike_map_flutter/routing/app_router.dart';
import 'package:bike_map_flutter/routing/route_names.dart';
import 'package:bike_map_flutter/features/map/screens/map_screen.dart';
import 'package:bike_map_flutter/features/auth/screens/login_screen.dart';
import 'package:bike_map_flutter/features/auth/screens/profile_screen.dart';
import 'package:bike_map_flutter/features/trails/screens/trail_detail_screen.dart';
import 'package:bike_map_flutter/features/trails/screens/trail_create_screen.dart';
import 'package:bike_map_flutter/features/trails/screens/trail_edit_screen.dart';
import 'package:bike_map_flutter/routing/not_found_screen.dart';

void main() {
  group('AppRouter Configuration', () {
    testWidgets('should initialize with home route as initial location', (tester) async {
      await tester.pumpWidget(
        MaterialApp.router(
          routerConfig: appRouter,
        ),
      );
      await tester.pumpAndSettle();

      // Initial location should be home (MapScreen)
      expect(find.byType(MapScreen), findsOneWidget);
    });

    testWidgets('should navigate to login screen', (tester) async {
      await tester.pumpWidget(
        MaterialApp.router(
          routerConfig: appRouter,
        ),
      );
      await tester.pumpAndSettle();

      // Navigate to login
      appRouter.goNamed(RouteNames.login);
      await tester.pumpAndSettle();

      expect(find.byType(LoginScreen), findsOneWidget);
    });

    testWidgets('should navigate to profile screen', (tester) async {
      await tester.pumpWidget(
        MaterialApp.router(
          routerConfig: appRouter,
        ),
      );
      await tester.pumpAndSettle();

      // Navigate to profile
      appRouter.goNamed(RouteNames.profile);
      await tester.pumpAndSettle();

      expect(find.byType(ProfileScreen), findsOneWidget);
    });

    testWidgets('should navigate to trail detail with ID parameter', (tester) async {
      await tester.pumpWidget(
        MaterialApp.router(
          routerConfig: appRouter,
        ),
      );
      await tester.pumpAndSettle();

      const testTrailId = 'trail-123';

      // Navigate to trail detail
      appRouter.goNamed(
        RouteNames.trailDetail,
        pathParameters: {'id': testTrailId},
      );
      await tester.pumpAndSettle();

      expect(find.byType(TrailDetailScreen), findsOneWidget);
      expect(find.textContaining('Trail ID: $testTrailId'), findsOneWidget);
    });

    testWidgets('should navigate to trail create screen', (tester) async {
      await tester.pumpWidget(
        MaterialApp.router(
          routerConfig: appRouter,
        ),
      );
      await tester.pumpAndSettle();

      // Navigate to trail create
      appRouter.goNamed(RouteNames.trailCreate);
      await tester.pumpAndSettle();

      expect(find.byType(TrailCreateScreen), findsOneWidget);
    });

    testWidgets('should navigate to trail edit with ID parameter', (tester) async {
      await tester.pumpWidget(
        MaterialApp.router(
          routerConfig: appRouter,
        ),
      );
      await tester.pumpAndSettle();

      const testTrailId = 'trail-456';

      // Navigate to trail edit
      appRouter.goNamed(
        RouteNames.trailEdit,
        pathParameters: {'id': testTrailId},
      );
      await tester.pumpAndSettle();

      expect(find.byType(TrailEditScreen), findsOneWidget);
      expect(find.textContaining('Trail ID: $testTrailId'), findsOneWidget);
    });

    testWidgets('should show 404 screen for unknown routes', (tester) async {
      await tester.pumpWidget(
        MaterialApp.router(
          routerConfig: appRouter,
        ),
      );
      await tester.pumpAndSettle();

      // Navigate to invalid route
      appRouter.go('/invalid-route-that-does-not-exist');
      await tester.pumpAndSettle();

      expect(find.byType(NotFoundScreen), findsOneWidget);
      expect(find.text('404'), findsOneWidget);
    });

    testWidgets('should navigate home when Go Home button is tapped on 404 screen', (tester) async {
      await tester.pumpWidget(
        MaterialApp.router(
          routerConfig: appRouter,
        ),
      );
      await tester.pumpAndSettle();

      // Navigate to invalid route to show 404
      appRouter.go('/invalid-route-that-does-not-exist');
      await tester.pumpAndSettle();

      expect(find.byType(NotFoundScreen), findsOneWidget);

      // Tap the "Go Home" button
      await tester.tap(find.text('Go Home'));
      await tester.pumpAndSettle();

      // Should navigate back to home (MapScreen)
      expect(find.byType(MapScreen), findsOneWidget);
      expect(find.byType(NotFoundScreen), findsNothing);
    });

    testWidgets('should navigate back to home from other screens', (tester) async {
      await tester.pumpWidget(
        MaterialApp.router(
          routerConfig: appRouter,
        ),
      );
      await tester.pumpAndSettle();

      // Navigate to login
      appRouter.goNamed(RouteNames.login);
      await tester.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);

      // Navigate back to home
      appRouter.goNamed(RouteNames.home);
      await tester.pumpAndSettle();
      expect(find.byType(MapScreen), findsOneWidget);
    });

    testWidgets('should handle invalid route name gracefully', (tester) async {
      await tester.pumpWidget(
        MaterialApp.router(
          routerConfig: appRouter,
        ),
      );
      await tester.pumpAndSettle();

      // Should start at home
      expect(find.byType(MapScreen), findsOneWidget);

      // Try to navigate with invalid route name - go_router throws AssertionError
      expect(
        () => appRouter.goNamed('non-existent-route-name'),
        throwsA(isA<AssertionError>()),
      );
    });
  });

  group('Route Names', () {
    test('should have all required route name constants', () {
      expect(RouteNames.home, 'home');
      expect(RouteNames.login, 'login');
      expect(RouteNames.profile, 'profile');
      expect(RouteNames.trailDetail, 'trail-detail');
      expect(RouteNames.trailCreate, 'trail-create');
      expect(RouteNames.trailEdit, 'trail-edit');
    });
  });
}
