import 'package:bike_map_flutter/core/config/app_config.dart';
import 'package:bike_map_flutter/core/providers/pocketbase_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pocketbase/pocketbase.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('initializePocketBase', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('returns PocketBase instance', () async {
      final pb = await initializePocketBase();
      expect(pb, isA<PocketBase>());
    });

    test('uses correct API URL from AppConfig', () async {
      final pb = await initializePocketBase();
      expect(pb.baseURL, equals(AppConfig.apiUrl));
    });

    test('creates AsyncAuthStore', () async {
      final pb = await initializePocketBase();
      expect(pb.authStore, isA<AsyncAuthStore>());
    });

    test('has valid authStore', () async {
      final pb = await initializePocketBase();
      expect(pb.authStore, isNotNull);
    });

    test('initializes with no auth by default', () async {
      final pb = await initializePocketBase();
      expect(pb.authStore.isValid, isFalse);
    });

    test('can be initialized multiple times', () async {
      final pb1 = await initializePocketBase();
      final pb2 = await initializePocketBase();

      expect(pb1, isA<PocketBase>());
      expect(pb2, isA<PocketBase>());
      expect(pb1.baseURL, equals(pb2.baseURL));
    });
  });

  group('pocketbaseProvider', () {
    test('throws UnimplementedError when not initialized', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(
        () => container.read(pocketbaseProvider),
        throwsA(isA<UnimplementedError>()),
      );
    });

    test('throws with helpful error message', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      try {
        container.read(pocketbaseProvider);
        fail('Should have thrown UnimplementedError');
      } catch (e) {
        expect(e, isA<UnimplementedError>());
        expect(
          e.toString(),
          contains('must be initialized in main.dart'),
        );
      }
    });

    test('is accessible after overrideWithValue', () async {
      final pb = await initializePocketBase();
      final container = ProviderContainer(
        overrides: [
          pocketbaseProvider.overrideWithValue(pb),
        ],
      );
      addTearDown(container.dispose);

      final providedPb = container.read(pocketbaseProvider);
      expect(providedPb, equals(pb));
    });

    test('multiple reads return same instance', () async {
      final pb = await initializePocketBase();
      final container = ProviderContainer(
        overrides: [
          pocketbaseProvider.overrideWithValue(pb),
        ],
      );
      addTearDown(container.dispose);

      final pb1 = container.read(pocketbaseProvider);
      final pb2 = container.read(pocketbaseProvider);

      expect(pb1, same(pb2));
    });
  });

  group('Persistent Auth Integration', () {
    setUp(() {
      SharedPreferences.setMockInitialValues({});
    });

    test('auth store persists after initialization', () async {
      const authData = '{"token":"test-token","model":{}}';
      SharedPreferences.setMockInitialValues({'pb_auth': authData});

      final pb = await initializePocketBase();
      expect(pb.authStore, isNotNull);

      // Verify SharedPreferences still has the data
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('pb_auth'), equals(authData));
    });

    test('auth store is configured for persistence', () async {
      final pb = await initializePocketBase();
      final prefs = await SharedPreferences.getInstance();

      // Verify auth store is async (supports persistence)
      expect(pb.authStore, isA<AsyncAuthStore>());

      // In real scenario, auth data would be saved after login
      // by the PocketBase SDK automatically
      expect(prefs.getString('pb_auth'), isNull);
    });
  });

  group('Configuration', () {
    test('baseURL matches AppConfig.apiUrl', () async {
      final pb = await initializePocketBase();
      expect(pb.baseURL, equals(AppConfig.apiUrl));
    });

    test('baseURL is valid URL format', () async {
      final pb = await initializePocketBase();
      expect(pb.baseURL.startsWith('http'), isTrue);
    });

    test('authStore is async type for persistence', () async {
      final pb = await initializePocketBase();
      expect(pb.authStore, isA<AsyncAuthStore>());
    });
  });

  group('Provider Lifecycle', () {
    test('provider works in nested containers', () async {
      final pb = await initializePocketBase();
      final parentContainer = ProviderContainer(
        overrides: [
          pocketbaseProvider.overrideWithValue(pb),
        ],
      );
      addTearDown(parentContainer.dispose);

      final childContainer = ProviderContainer(
        parent: parentContainer,
      );
      addTearDown(childContainer.dispose);

      final providedPb = childContainer.read(pocketbaseProvider);
      expect(providedPb, equals(pb));
    });

    test('override persists across multiple reads', () async {
      final pb = await initializePocketBase();
      final container = ProviderContainer(
        overrides: [
          pocketbaseProvider.overrideWithValue(pb),
        ],
      );
      addTearDown(container.dispose);

      for (var i = 0; i < 10; i++) {
        final providedPb = container.read(pocketbaseProvider);
        expect(providedPb, equals(pb));
      }
    });
  });
}
