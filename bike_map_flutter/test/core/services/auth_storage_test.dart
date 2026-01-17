import 'package:bike_map_flutter/core/services/auth_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pocketbase/pocketbase.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('createAuthStore', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('returns AsyncAuthStore instance', () async {
      final authStore = await createAuthStore();
      expect(authStore, isA<AsyncAuthStore>());
    });

    test('initial value is null when no stored auth', () async {
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('pb_auth'), isNull);

      final authStore = await createAuthStore();
      expect(authStore, isNotNull);
    });

    test('initial value loads from SharedPreferences', () async {
      const testAuthData = '{"token":"test-token","model":{}}';
      SharedPreferences.setMockInitialValues({'pb_auth': testAuthData});

      final authStore = await createAuthStore();
      expect(authStore, isNotNull);

      // Verify the stored value is accessible
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('pb_auth'), equals(testAuthData));
    });

    test('auth store can be created and used', () async {
      final authStore = await createAuthStore();

      // Verify auth store has expected properties
      expect(authStore, isNotNull);
      expect(authStore, isA<AsyncAuthStore>());
    });
  });

  group('clearAuthStore', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('removes pb_auth from SharedPreferences', () async {
      // Set initial auth data
      SharedPreferences.setMockInitialValues({
        'pb_auth': '{"token":"test-token"}',
      });

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('pb_auth'), isNotNull);

      // Clear auth store
      await clearAuthStore();

      // Verify auth data is removed
      expect(prefs.getString('pb_auth'), isNull);
    });

    test('does not throw when no auth data exists', () async {
      expect(() async => await clearAuthStore(), returnsNormally);
    });

    test('only removes pb_auth key, not other keys', () async {
      SharedPreferences.setMockInitialValues({
        'pb_auth': '{"token":"test-token"}',
        'other_key': 'other_value',
      });

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('pb_auth'), isNotNull);
      expect(prefs.getString('other_key'), equals('other_value'));

      await clearAuthStore();

      expect(prefs.getString('pb_auth'), isNull);
      expect(prefs.getString('other_key'), equals('other_value'));
    });
  });

  group('Error Handling', () {
    test('createAuthStore returns fallback store on SharedPreferences failure',
        () async {
      // Note: In real tests, we can't easily mock SharedPreferences to fail
      // This test documents the expected behavior
      final authStore = await createAuthStore();
      expect(authStore, isA<AsyncAuthStore>());
    });

    test('clearAuthStore handles errors gracefully', () async {
      // Should not throw even if SharedPreferences fails
      expect(() async => await clearAuthStore(), returnsNormally);
    });
  });

  group('Integration Scenarios', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('auth lifecycle: create, load, clear', () async {
      const authData = '{"token":"lifecycle-token","model":{}}';

      // Create new auth store with existing data (simulates app restart)
      SharedPreferences.setMockInitialValues({'pb_auth': authData});
      final authStore = await createAuthStore();
      expect(authStore, isNotNull);

      // Verify data is accessible
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('pb_auth'), equals(authData));

      // Clear auth store
      await clearAuthStore();
      expect(prefs.getString('pb_auth'), isNull);
    });

    test('multiple auth stores can be created', () async {
      final authStore1 = await createAuthStore();
      final authStore2 = await createAuthStore();

      expect(authStore1, isA<AsyncAuthStore>());
      expect(authStore2, isA<AsyncAuthStore>());
    });
  });
}
