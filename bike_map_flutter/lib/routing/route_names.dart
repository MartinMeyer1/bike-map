/// Route name constants for type-safe navigation throughout the app.
///
/// Use these constants with go_router's `goNamed()` method to ensure
/// compile-time safety when navigating between screens.
///
/// Example:
/// ```dart
/// context.goNamed(RouteNames.home);
/// context.goNamed(RouteNames.trailDetail, pathParameters: {'id': 'trail-123'});
/// ```
class RouteNames {
  RouteNames._(); // Private constructor prevents instantiation

  static const String home = 'home';
  static const String login = 'login';
  static const String profile = 'profile';
  static const String trailDetail = 'trail-detail';
  static const String trailCreate = 'trail-create';
  static const String trailEdit = 'trail-edit';
}
