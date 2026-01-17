import 'package:flutter/material.dart';

/// Trail creation screen placeholder - Full implementation in Story 5.1
///
/// This screen will eventually implement a multi-step wizard with GPX upload
/// or map drawing functionality. For now, it serves as a placeholder for
/// routing configuration.
class TrailCreateScreen extends StatelessWidget {
  const TrailCreateScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Trail'),
      ),
      body: const Center(
        child: Text('Trail Create Screen - Coming Soon'),
      ),
    );
  }
}
