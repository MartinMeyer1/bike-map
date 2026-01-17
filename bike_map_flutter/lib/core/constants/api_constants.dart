/// API constants for PocketBase backend
///
/// This file defines all PocketBase collection names and endpoint paths
/// used throughout the app for backend communication.
///
/// ## Example Usage
///
/// ```dart
/// // Fetch trails using collection name constant
/// final records = await pb.collection(ApiConstants.trailsCollection)
///   .getFullList(sort: ApiConstants.defaultTrailSort);
///
/// // Create a rating
/// final rating = await pb.collection(ApiConstants.ratingsCollection)
///   .create(body: {
///     'trail_id': trailId,
///     'user_id': userId,
///     'rating': 5,
///   });
///
/// // Construct MVT tile URL for MapLibre
/// final tileUrl = '${AppConfig.tilesUrl}/{z}/{x}/{y}.mvt';
/// ```
class ApiConstants {
  // Private constructor to prevent instantiation
  ApiConstants._();

  // ============================================================
  // PocketBase Collection Names
  // ============================================================

  /// Users collection (authentication and user profiles)
  ///
  /// Schema: id, email, name, avatar, role (Viewer/Editor/Admin)
  static const String usersCollection = 'users';

  /// Trails collection (trail geometries and metadata)
  ///
  /// Schema: id, name, description, difficulty_rating (0-5),
  ///         geometry (GeoJSON), distance_km, elevation_gain_m,
  ///         elevation_loss_m, tags[], is_confirmed (ridden),
  ///         user_id (creator), created_at, updated_at
  static const String trailsCollection = 'trails';

  /// Ratings collection (1-5 star trail ratings)
  ///
  /// Schema: id, trail_id, user_id, rating (1-5), created_at
  static const String ratingsCollection = 'ratings';

  /// Comments collection (text comments on trails)
  ///
  /// Schema: id, trail_id, user_id, text, created_at, updated_at
  static const String commentsCollection = 'comments';

  /// Engagement collection (likes, favorites - future)
  ///
  /// Schema: id, trail_id, user_id, type (like/favorite), created_at
  static const String engagementCollection = 'engagement';

  // ============================================================
  // API Endpoint Paths (Non-PocketBase)
  // ============================================================

  /// MVT tiles endpoint pattern
  ///
  /// URL pattern: {baseUrl}/api/tiles/{z}/{x}/{y}.mvt
  /// Used by MapLibre for vector tile rendering
  static const String mvtTilesPath = '/api/tiles';

  /// TileJSON metadata endpoint
  ///
  /// URL: {baseUrl}/api/tiles.json
  /// Returns TileJSON 3.0.0 specification for MVT tiles
  static const String tileJsonPath = '/api/tiles.json';

  /// MBTiles download endpoint (offline maps - Phase 2)
  ///
  /// URL: {baseUrl}/api/mbtiles/download/latest
  /// Returns MBTiles snapshot for offline use
  static const String mbtilesDownloadPath = '/api/mbtiles/download/latest';

  /// BRouter routing service proxy
  ///
  /// URL pattern: {baseUrl}/brouter/*
  /// Proxied to BRouter 1.7.8 for trail path routing
  static const String brouterPath = '/brouter';

  // ============================================================
  // Query Parameters & Defaults
  // ============================================================

  /// Default page size for list queries
  static const int defaultPageSize = 50;

  /// Maximum page size for list queries (PocketBase v0.23+ limit)
  static const int maxPageSize = 1000;

  /// Default sort order for trails (most recent first)
  static const String defaultTrailSort = '-created_at';

  /// Default sort order for comments (oldest first)
  static const String defaultCommentSort = 'created_at';

  /// List of all valid collection names
  ///
  /// Use this to validate collection names at runtime
  static const Set<String> validCollections = {
    usersCollection,
    trailsCollection,
    ratingsCollection,
    commentsCollection,
    engagementCollection,
  };

  /// Validates if a collection name is recognized
  ///
  /// Returns true if the collection is defined, false otherwise
  ///
  /// ```dart
  /// if (ApiConstants.isValidCollection(collectionName)) {
  ///   // Safe to use
  /// } else {
  ///   // Log warning - typo in collection name?
  /// }
  /// ```
  static bool isValidCollection(String collectionName) {
    return validCollections.contains(collectionName);
  }

  /// Get all endpoint paths
  ///
  /// Useful for documentation or dynamic path generation
  static const Set<String> allEndpoints = {
    mvtTilesPath,
    tileJsonPath,
    mbtilesDownloadPath,
    brouterPath,
  };
}
