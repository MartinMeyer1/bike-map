import 'package:go_router/go_router.dart';
import 'route_names.dart';
import '../features/map/screens/map_screen.dart';
import '../features/auth/screens/login_screen.dart';
import '../features/auth/screens/profile_screen.dart';
import '../features/trails/screens/trail_detail_screen.dart';
import '../features/trails/screens/trail_create_screen.dart';
import '../features/trails/screens/trail_edit_screen.dart';
import 'not_found_screen.dart';

/// Main application router configuration using go_router
///
/// This router defines all application routes with clean URLs for web deep linking.
/// Authentication guards will be added in Story 2.x.
final GoRouter appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      name: RouteNames.home,
      builder: (context, state) => const MapScreen(),
    ),
    GoRoute(
      path: '/login',
      name: RouteNames.login,
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/profile',
      name: RouteNames.profile,
      builder: (context, state) => const ProfileScreen(),
    ),
    // IMPORTANT: Specific paths must come before parameterized paths
    // to avoid conflicts. /trail/create must be before /trail/:id
    GoRoute(
      path: '/trail/create',
      name: RouteNames.trailCreate,
      builder: (context, state) => const TrailCreateScreen(),
    ),
    GoRoute(
      path: '/trail/:id',
      name: RouteNames.trailDetail,
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return TrailDetailScreen(trailId: id);
      },
    ),
    GoRoute(
      path: '/trail/:id/edit',
      name: RouteNames.trailEdit,
      builder: (context, state) {
        final id = state.pathParameters['id']!;
        return TrailEditScreen(trailId: id);
      },
    ),
  ],
  errorBuilder: (context, state) => const NotFoundScreen(),
);
