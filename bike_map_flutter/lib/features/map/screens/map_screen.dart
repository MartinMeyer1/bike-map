import 'package:flutter/material.dart';

/// Map screen placeholder - Full implementation in Story 3.1
///
/// This screen will eventually display the MapLibre map view with vector tiles.
/// For now, it serves as a placeholder for routing configuration.
class MapScreen extends StatelessWidget {
  const MapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Map'),
      ),
      body: const Center(
        child: Text('Map Screen - Coming Soon'),
      ),
    );
  }
}
