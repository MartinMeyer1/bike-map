import 'package:flutter/material.dart';

/// Login screen placeholder - Full implementation in Story 2.1
///
/// This screen will eventually implement Google OAuth integration with PocketBase.
/// For now, it serves as a placeholder for routing configuration.
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Login'),
      ),
      body: const Center(
        child: Text('Login Screen - Coming Soon'),
      ),
    );
  }
}
