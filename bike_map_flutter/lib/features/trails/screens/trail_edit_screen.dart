import 'package:flutter/material.dart';

/// Trail edit screen placeholder - Full implementation in Story 6.1
///
/// This screen will eventually implement trail editing with geometry
/// modification. For now, it serves as a placeholder for routing configuration
/// and demonstrates dynamic route parameters.
class TrailEditScreen extends StatelessWidget {
  const TrailEditScreen({
    required this.trailId,
    super.key,
  });

  final String trailId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Trail'),
      ),
      body: Center(
        child: Text('Trail Edit Screen - Coming Soon\nTrail ID: $trailId'),
      ),
    );
  }
}
