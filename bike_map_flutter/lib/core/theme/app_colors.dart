import 'package:flutter/material.dart';

/// BikeMap color palette - "Natural Topo Integration"
///
/// This color system is designed to harmonize with the topographic base map
/// (soft beiges, pale greens, subtle terrain features) rather than compete with it.
///
/// Color Philosophy: "Outdoor Enduro with Sober Sophistication"
/// - 90% Clean, Sober Interface (SwissTopo-inspired minimalism)
/// - 10% Enduro Spirit Moments (strategic color and energy)
class AppColors {
  // ============================================================================
  // Primary Colors
  // ============================================================================

  /// Orange Terre #B7410E - Primary action color
  ///
  /// Usage: FAB (Add Trail), primary buttons, CTAs, interactive elements
  /// Rationale: Evokes earth/terrain, outdoor spirit. Warm and inviting without being aggressive
  static const Color primaryOrangeTerre = Color(0xFFB7410E);

  /// Turquoise #069494 - Secondary color
  ///
  /// Usage: Selected states, progress indicators, success confirmations
  /// Rationale: Represents water/nature, provides cool contrast to warm primary
  static const Color secondaryTurquoise = Color(0xFF069494);

  /// Jaune #FFCE1B - Accent color (use sparingly!)
  ///
  /// Usage: Celebration moments, "New" badges, special highlights
  /// Rationale: High energy, attention-grabbing. Reserved for maximum impact moments
  static const Color accentJaune = Color(0xFFFFCE1B);

  // ============================================================================
  // Trail Difficulty Palette (S0-S5) - "Natural Topo Integration"
  // ============================================================================
  //
  // Heavily desaturated, naturalistic colors designed to integrate seamlessly
  // with the beige/green topographic base map. These colors appear both on map
  // (trail lines) and UI (difficulty badges).

  /// S0 (Easy) - Vert Mousse #738F77
  ///
  /// Blends with map vegetation greens
  static const Color s0VertMousse = Color(0xFF738F77);

  /// S1 (Moderate) - Bleu-Gris #7A94A3
  ///
  /// Recalls water features on topo maps
  static const Color s1BleuGris = Color(0xFF7A94A3);

  /// S2 (Intermediate) - Terre Ocre #A87D52
  ///
  /// Harmonizes with map's beige terrain
  static const Color s2TerreOcre = Color(0xFFA87D52);

  /// S3 (Difficult) - Rouge Terre Cuite #A8685A
  ///
  /// Natural reddish-brown like rocky terrain
  static const Color s3RougeTerrecuite = Color(0xFFA8685A);

  /// S4 (Very Difficult) - Violet Roche #7D637F
  ///
  /// Desaturated mauve like shadowed rock
  static const Color s4VioletRoche = Color(0xFF7D637F);

  /// S5 (Extreme) - Anthracite #3A3A3A
  ///
  /// Near-black for maximum contrast and seriousness
  static const Color s5Anthracite = Color(0xFF3A3A3A);

  // ============================================================================
  // Neutral Palette - Warm Greys
  // ============================================================================
  //
  // Background and text colors with subtle warmth to complement earth tones

  /// Background Warm #FAFAF8
  ///
  /// Off-white with subtle beige warmth (not pure white)
  static const Color backgroundWarm = Color(0xFFFAFAF8);

  /// Surface Warm #F5F5F3
  ///
  /// Warm light grey for cards (subtle separation from background)
  static const Color surfaceWarm = Color(0xFFF5F5F3);

  /// Text Primary #2A2622
  ///
  /// Dark warm grey for readable text (not harsh pure black)
  static const Color textPrimary = Color(0xFF2A2622);

  /// Text Secondary #6B6660
  ///
  /// Medium warm grey for hierarchy
  static const Color textSecondary = Color(0xFF6B6660);

  // Prevent instantiation
  const AppColors._();
}
