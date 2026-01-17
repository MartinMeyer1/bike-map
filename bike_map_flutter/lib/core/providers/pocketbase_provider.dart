import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pocketbase/pocketbase.dart';
import '../config/app_config.dart';
import '../services/auth_storage.dart';

/// Provider for the PocketBase client instance
///
/// This provider must be initialized in main.dart before runApp().
/// Access throughout the app via: ref.read(pocketbaseProvider)
///
/// ## Example Usage
///
/// ```dart
/// // In a ConsumerWidget
/// class MyWidget extends ConsumerWidget {
///   @override
///   Widget build(BuildContext context, WidgetRef ref) {
///     final pb = ref.read(pocketbaseProvider);
///     // Use pb for API calls
///     return Container();
///   }
/// }
/// ```
final pocketbaseProvider = Provider<PocketBase>((ref) {
  throw UnimplementedError(
    'PocketBase must be initialized in main.dart before runApp(). '
    'Call initializePocketBase() and pass the instance via '
    'ProviderScope(overrides: [pocketbaseProvider.overrideWithValue(pb)])',
  );
});

/// Initializes PocketBase with persistent auth storage
///
/// This function should be called once in main.dart before runApp():
///
/// ```dart
/// Future<void> main() async {
///   WidgetsFlutterBinding.ensureInitialized();
///   try {
///     final pb = await initializePocketBase();
///     runApp(
///       ProviderScope(
///         overrides: [
///           pocketbaseProvider.overrideWithValue(pb),
///         ],
///         child: const App(),
///       ),
///     );
///   } catch (e) {
///     // Handle initialization failure
///     runApp(MyErrorApp(error: e));
///   }
/// }
/// ```
///
/// ## Features
///
/// - **Persistent Auth**: Uses AsyncAuthStore with SharedPreferences
/// - **Performance**: Enables reuseHTTPClient to reuse HTTP connections
///   across all requests, reducing overhead on mobile networks
/// - **Configuration**: Uses AppConfig.apiUrl for flexible environment setup
/// - **Automatic Token Management**: SDK handles token refresh automatically
///
/// ## Error Handling
///
/// This function may throw if:
/// - SharedPreferences fails to initialize (very rare)
/// - PocketBase SDK initialization fails
///
/// Wrap main() in try-catch to handle gracefully.
Future<PocketBase> initializePocketBase() async {
  try {
    final authStore = await createAuthStore();

    return PocketBase(
      AppConfig.apiUrl,
      authStore: authStore,
      reuseHTTPClient: true, // Reuses HTTP client for performance (v0.23.0+)
    );
  } catch (e) {
    throw Exception(
      'Failed to initialize PocketBase: $e. '
      'Ensure SharedPreferences is available and AppConfig.apiUrl is valid.',
    );
  }
}
