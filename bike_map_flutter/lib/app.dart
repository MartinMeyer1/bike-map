import 'package:flutter/material.dart';
import 'core/theme/app_theme.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BikeMap',
      theme: AppTheme.lightTheme,
      home: const Scaffold(
        body: Center(
          child: Text('BikeMap - Structure Ready'),
        ),
      ),
    );
  }
}
