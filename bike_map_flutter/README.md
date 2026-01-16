# BikeMap Flutter

Mountain bike trail sharing application for Switzerland.

## Overview

BikeMap allows users to discover, create, and share mountain bike trails. The app features:
- Interactive vector map with Swiss topographic data
- Trail creation via GPX upload or map drawing
- Difficulty ratings (S0-S5 scale)
- Community features (ratings, comments)
- Cross-platform support (Web, Android, iOS)

## Getting Started

### Prerequisites

- Flutter SDK (3.x or later)
- Dart SDK
- For iOS: Xcode and CocoaPods
- For Android: Android Studio and Android SDK

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bike_map_flutter

# Install dependencies
flutter pub get

# Run the app
flutter run
```

### Build Commands

```bash
# Web
flutter build web

# Android
flutter build apk

# iOS
flutter build ios
```

## Project Structure

```
lib/
├── main.dart              # Application entry point
├── app.dart               # App configuration (Story 1.4)
├── core/                  # Shared utilities (Story 1.2)
├── features/              # Feature modules (Story 1.2)
└── routing/               # Navigation (Story 1.4)
```

## Configuration

Environment configuration via `--dart-define` flags:

```bash
# Development
flutter run --dart-define=API_URL=http://localhost:8090

# Production
flutter run --dart-define=API_URL=https://bike-map.ch/api
```

## Tech Stack

- **State Management:** Riverpod
- **Routing:** go_router
- **Maps:** MapLibre GL
- **Backend:** PocketBase
- **Serialization:** json_serializable
