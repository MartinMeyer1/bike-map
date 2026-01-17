import 'package:flutter/material.dart';

/// Profile screen placeholder - Full implementation in Story 2.2
///
/// This screen will eventually display user profile view/edit with PocketBase data.
/// For now, it serves as a placeholder for routing configuration.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
      ),
      body: const Center(
        child: Text('Profile Screen - Coming Soon'),
      ),
    );
  }
}
