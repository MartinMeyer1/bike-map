import 'package:flutter/material.dart';

/// Trail detail screen placeholder - Full implementation in Story 4.5
///
/// This screen will eventually display complete trail details with ratings,
/// comments, and map preview. For now, it serves as a placeholder for routing
/// configuration and demonstrates dynamic route parameters.
class TrailDetailScreen extends StatelessWidget {
  const TrailDetailScreen({
    required this.trailId,
    super.key,
  });

  final String trailId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Trail Detail'),
      ),
      body: Center(
        child: Text('Trail Detail Screen - Coming Soon\nTrail ID: $trailId'),
      ),
    );
  }
}
