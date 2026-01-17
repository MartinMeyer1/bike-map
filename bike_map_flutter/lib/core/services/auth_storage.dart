import 'dart:developer' as developer;

import 'package:pocketbase/pocketbase.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Creates a persistent auth store using SharedPreferences
///
/// This allows the PocketBase authentication token to persist
/// across app restarts, keeping users logged in automatically.
///
/// The auth store uses two callbacks:
/// - `save`: Called when auth state changes (login, token refresh, logout)
/// - `initial`: Loaded at app start to restore previous session
///
/// ## How It Works
///
/// 1. On login: SDK calls `save()` with serialized auth data
/// 2. On app start: SDK loads `initial` value to restore session
/// 3. On logout: Call `pb.authStore.clear()` + optional `clearAuthStore()`
/// 4. Automatic: SDK handles all token management internally
///
/// ## Example Usage
///
/// ```dart
/// // Initialize PocketBase with persistent auth
/// final authStore = await createAuthStore();
/// final pb = PocketBase('https://bike-map.ch', authStore: authStore);
///
/// // Login (auth data is automatically saved)
/// await pb.collection('users').authWithPassword('test@example.com', 'password');
///
/// // Logout (clears auth store)
/// pb.authStore.clear();
/// await clearAuthStore(); // Optional: also clear from SharedPreferences
/// ```
Future<AsyncAuthStore> createAuthStore() async {
  try {
    final prefs = await SharedPreferences.getInstance();

    return AsyncAuthStore(
      // Save callback - called when auth state changes
      save: (String data) async {
        try {
          await prefs.setString('pb_auth', data);
        } catch (e) {
          // Log error to developer console but don't throw
          // This allows the app to continue operating even if storage fails
          developer.log(
            'Failed to save PocketBase auth data to SharedPreferences',
            error: e,
            name: 'AuthStorage',
          );
        }
      },

      // Initial value - loaded at app start
      initial: prefs.getString('pb_auth'),
    );
  } catch (e) {
    // If SharedPreferences fails entirely, log the error and return fallback store
    // NOTE: The fallback store is NON-PERSISTENT - users will lose their session
    // on app restart if SharedPreferences is unavailable
    developer.log(
      'Failed to create persistent auth store - using non-persistent fallback',
      error: e,
      name: 'AuthStorage',
    );

    return AsyncAuthStore(
      save: (_) async {
        // Non-persistent fallback: don't actually save anything
        developer.log(
          'Auth save attempted but SharedPreferences unavailable - session will be lost on restart',
          name: 'AuthStorage.Fallback',
        );
      },
      initial: null,
    );
  }
}

/// Clears the persisted auth data (for logout)
///
/// This function should be called after `pb.authStore.clear()` to ensure
/// the auth data is also removed from SharedPreferences.
///
/// ## Example Usage
///
/// ```dart
/// // Logout
/// pb.authStore.clear();
/// await clearAuthStore();
/// ```
Future<void> clearAuthStore() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('pb_auth');
  } catch (e) {
    // Log error to developer console but don't throw
    // Logout should succeed even if clearing storage fails
    developer.log(
      'Failed to clear auth data from SharedPreferences',
      error: e,
      name: 'AuthStorage',
    );
  }
}
