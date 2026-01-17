import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'core/providers/pocketbase_provider.dart';

Future<void> main() async {
  // Required for async operations before runApp()
  WidgetsFlutterBinding.ensureInitialized();

  try {
    // Initialize PocketBase with persistent auth storage
    final pb = await initializePocketBase();

    runApp(
      ProviderScope(
        overrides: [
          // Provide the initialized PocketBase instance
          pocketbaseProvider.overrideWithValue(pb),
        ],
        child: const App(),
      ),
    );
  } catch (e) {
    // Handle initialization failure gracefully
    runApp(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'Initialization Error',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),
                Text(
                  'Failed to initialize the app:\n$e',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
