# BikeMap Theme System

This directory contains the Material 3 theme configuration for BikeMap, implementing the **"Outdoor Enduro with Sober Sophistication"** visual identity.

## Design Philosophy

- **90% Clean, Sober Interface**: SwissTopo-inspired minimalism, letting the map dominate
- **10% Enduro Spirit Moments**: Strategic color and energy at key interaction points

## Files

### `app_colors.dart`
Complete color palette for BikeMap, designed to harmonize with topographic base maps.

**Primary Colors:**
- `primaryOrangeTerre`: `#B7410E` - Primary action color (FAB, buttons, CTAs)
- `secondaryTurquoise`: `#069494` - Secondary color (selected states, progress)
- `accentJaune`: `#FFCE1B` - Accent color (celebration moments, badges)

**Trail Difficulty Colors (S0-S5):**
- `s0VertMousse`: `#738F77` - Easy (blends with vegetation greens)
- `s1BleuGris`: `#7A94A3` - Moderate (recalls water features)
- `s2TerreOcre`: `#A87D52` - Intermediate (harmonizes with beige terrain)
- `s3RougeTerrecuite`: `#A8685A` - Difficult (natural reddish-brown)
- `s4VioletRoche`: `#7D637F` - Very Difficult (desaturated mauve)
- `s5Anthracite`: `#3A3A3A` - Extreme (near-black for contrast)

**Neutral Palette:**
- `backgroundWarm`: `#FAFAF8` - Off-white with subtle beige warmth
- `surfaceWarm`: `#F5F5F3` - Warm light grey for cards
- `textPrimary`: `#2A2622` - Dark warm grey for text
- `textSecondary`: `#6B6660` - Medium warm grey for hierarchy

### `app_spacing.dart`
Spacing and shape constants for consistent layouts.

**Spacing Scale:**
- `spacingXs`: `4dp` - Minimal gaps, tight layouts
- `spacingS`: `8dp` - Standard element spacing
- `spacingM`: `12dp` - Comfortable vertical spacing
- `spacingL`: `16dp` - Card padding, comfortable touch
- `spacingXl`: `24dp` - Section separation, bottom sheet padding

**Border Radius:**
- `radiusS`: `8dp` - Buttons (approachable but not aggressive)
- `radiusM`: `12dp` - Cards (modern without being bubbly)
- `radiusL`: `16dp` - Difficulty badges, bottom sheet top corners

### `app_theme.dart`
Material 3 ThemeData configuration with BikeMap design tokens applied.

**Current Theme:**
- `lightTheme`: Light mode theme with custom color scheme

**Configuration:**
- Material 3 enabled (`useMaterial3: true`)
- Custom ColorScheme with BikeMap colors
- Scaffold background set to `backgroundWarm`

## Usage

Import the theme in your app:

```dart
import 'package:bike_map_flutter/core/theme/app_theme.dart';

MaterialApp(
  theme: AppTheme.lightTheme,
  // ...
);
```

Use design tokens in widgets:

```dart
import 'package:bike_map_flutter/core/theme/app_colors.dart';
import 'package:bike_map_flutter/core/theme/app_spacing.dart';

Container(
  padding: EdgeInsets.all(AppSpacing.spacingL),
  decoration: BoxDecoration(
    color: AppColors.surfaceWarm,
    borderRadius: BorderRadius.circular(AppSpacing.radiusM),
  ),
  child: Text(
    'BikeMap',
    style: TextStyle(color: AppColors.textPrimary),
  ),
);
```

## Design Principles

### Color Strategy: "Natural Topo Integration"
Colors are designed to harmonize with topographic base maps (soft beiges, pale greens) rather than compete with them. Trail difficulty colors are heavily desaturated and naturalistic.

### Spacing Strategy: "Generous Breathing Room"
SwissTopo's clean aesthetic comes from generous spacing. BikeMap adopts this with comfortable padding and clear visual hierarchy.

### Shape Strategy: "Refined Material 3"
Material 3 defaults refined for BikeMap's outdoor aesthetic - rounded but not bubbly, modern but not aggressive.
