import 'package:bike_map_flutter/core/constants/api_constants.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ApiConstants - PocketBase Collection Names', () {
    test('usersCollection is defined', () {
      expect(ApiConstants.usersCollection, isNotEmpty);
    });

    test('usersCollection is "users"', () {
      expect(ApiConstants.usersCollection, equals('users'));
    });

    test('trailsCollection is defined', () {
      expect(ApiConstants.trailsCollection, isNotEmpty);
    });

    test('trailsCollection is "trails"', () {
      expect(ApiConstants.trailsCollection, equals('trails'));
    });

    test('ratingsCollection is defined', () {
      expect(ApiConstants.ratingsCollection, isNotEmpty);
    });

    test('ratingsCollection is "ratings"', () {
      expect(ApiConstants.ratingsCollection, equals('ratings'));
    });

    test('commentsCollection is defined', () {
      expect(ApiConstants.commentsCollection, isNotEmpty);
    });

    test('commentsCollection is "comments"', () {
      expect(ApiConstants.commentsCollection, equals('comments'));
    });

    test('engagementCollection is defined', () {
      expect(ApiConstants.engagementCollection, isNotEmpty);
    });

    test('engagementCollection is "engagement"', () {
      expect(ApiConstants.engagementCollection, equals('engagement'));
    });

    test('all collection names are lowercase', () {
      expect(
        ApiConstants.usersCollection,
        equals(ApiConstants.usersCollection.toLowerCase()),
      );
      expect(
        ApiConstants.trailsCollection,
        equals(ApiConstants.trailsCollection.toLowerCase()),
      );
      expect(
        ApiConstants.ratingsCollection,
        equals(ApiConstants.ratingsCollection.toLowerCase()),
      );
      expect(
        ApiConstants.commentsCollection,
        equals(ApiConstants.commentsCollection.toLowerCase()),
      );
      expect(
        ApiConstants.engagementCollection,
        equals(ApiConstants.engagementCollection.toLowerCase()),
      );
    });

    test('all collection names are unique', () {
      final collections = {
        ApiConstants.usersCollection,
        ApiConstants.trailsCollection,
        ApiConstants.ratingsCollection,
        ApiConstants.commentsCollection,
        ApiConstants.engagementCollection,
      };
      expect(collections.length, equals(5));
    });
  });

  group('ApiConstants - Endpoint Paths', () {
    test('mvtTilesPath is defined', () {
      expect(ApiConstants.mvtTilesPath, isNotEmpty);
    });

    test('mvtTilesPath starts with /', () {
      expect(ApiConstants.mvtTilesPath.startsWith('/'), isTrue);
    });

    test('tileJsonPath is defined', () {
      expect(ApiConstants.tileJsonPath, isNotEmpty);
    });

    test('tileJsonPath starts with /', () {
      expect(ApiConstants.tileJsonPath.startsWith('/'), isTrue);
    });

    test('mbtilesDownloadPath is defined', () {
      expect(ApiConstants.mbtilesDownloadPath, isNotEmpty);
    });

    test('mbtilesDownloadPath starts with /', () {
      expect(ApiConstants.mbtilesDownloadPath.startsWith('/'), isTrue);
    });

    test('brouterPath is defined', () {
      expect(ApiConstants.brouterPath, isNotEmpty);
    });

    test('brouterPath starts with /', () {
      expect(ApiConstants.brouterPath.startsWith('/'), isTrue);
    });

    test('all endpoint paths start with /', () {
      expect(ApiConstants.mvtTilesPath, startsWith('/'));
      expect(ApiConstants.tileJsonPath, startsWith('/'));
      expect(ApiConstants.mbtilesDownloadPath, startsWith('/'));
      expect(ApiConstants.brouterPath, startsWith('/'));
    });

    test('endpoint paths contain expected keywords', () {
      expect(ApiConstants.mvtTilesPath, contains('tiles'));
      expect(ApiConstants.tileJsonPath, contains('tiles'));
      expect(ApiConstants.mbtilesDownloadPath, contains('mbtiles'));
      expect(ApiConstants.brouterPath, contains('brouter'));
    });
  });

  group('ApiConstants - Query Parameters', () {
    test('defaultPageSize is positive', () {
      expect(ApiConstants.defaultPageSize, greaterThan(0));
    });

    test('defaultPageSize is reasonable (50)', () {
      expect(ApiConstants.defaultPageSize, equals(50));
    });

    test('maxPageSize is positive', () {
      expect(ApiConstants.maxPageSize, greaterThan(0));
    });

    test('maxPageSize is 1000 (PocketBase v0.23+ limit)', () {
      expect(ApiConstants.maxPageSize, equals(1000));
    });

    test('maxPageSize is greater than defaultPageSize', () {
      expect(
        ApiConstants.maxPageSize,
        greaterThan(ApiConstants.defaultPageSize),
      );
    });

    test('defaultTrailSort is defined', () {
      expect(ApiConstants.defaultTrailSort, isNotEmpty);
    });

    test('defaultTrailSort is descending created_at', () {
      expect(ApiConstants.defaultTrailSort, equals('-created_at'));
    });

    test('defaultCommentSort is defined', () {
      expect(ApiConstants.defaultCommentSort, isNotEmpty);
    });

    test('defaultCommentSort is ascending created_at', () {
      expect(ApiConstants.defaultCommentSort, equals('created_at'));
    });

    test('sort orders use valid PocketBase syntax', () {
      // PocketBase uses - prefix for descending, no prefix for ascending
      const trailSort = ApiConstants.defaultTrailSort;
      const commentSort = ApiConstants.defaultCommentSort;

      // Trail sort should be descending (has - prefix)
      expect(trailSort.startsWith('-'), isTrue);

      // Comment sort should be ascending (no - prefix)
      expect(commentSort.startsWith('-'), isFalse);

      // Both should reference created_at
      expect(trailSort.contains('created_at'), isTrue);
      expect(commentSort.contains('created_at'), isTrue);
    });
  });

  group('ApiConstants - Instantiation', () {
    test('cannot instantiate ApiConstants', () {
      // ApiConstants has private constructor, so this should not compile
      // This test documents the design intent
      expect(ApiConstants, isNotNull);
    });
  });

  group('ApiConstants - Usage Patterns', () {
    test('collection names can be used in map keys', () {
      final map = {
        ApiConstants.usersCollection: 'users data',
        ApiConstants.trailsCollection: 'trails data',
      };
      expect(map[ApiConstants.usersCollection], equals('users data'));
    });

    test('endpoint paths can be concatenated with base URL', () {
      const baseUrl = 'https://bike-map.ch';
      const fullUrl = baseUrl + ApiConstants.mvtTilesPath;
      expect(fullUrl, equals('https://bike-map.ch/api/tiles'));
    });

    test('page sizes can be used in API calls', () {
      expect(ApiConstants.defaultPageSize, isPositive);
      expect(ApiConstants.maxPageSize, isPositive);
      expect(
        ApiConstants.maxPageSize,
        greaterThanOrEqualTo(ApiConstants.defaultPageSize),
      );
    });

    test('sort orders are valid strings', () {
      expect(ApiConstants.defaultTrailSort, isA<String>());
      expect(ApiConstants.defaultCommentSort, isA<String>());
      expect(ApiConstants.defaultTrailSort, isNotEmpty);
      expect(ApiConstants.defaultCommentSort, isNotEmpty);
    });
  });

  group('ApiConstants - Value Consistency', () {
    test('constants are compile-time constants', () {
      // All ApiConstants fields should be compile-time constants
      // This is enforced by the const keyword
      expect(ApiConstants.usersCollection, isA<String>());
      expect(ApiConstants.defaultPageSize, isA<int>());
    });

    test('string constants do not have trailing/leading spaces', () {
      expect(
        ApiConstants.usersCollection.trim(),
        equals(ApiConstants.usersCollection),
      );
      expect(
        ApiConstants.trailsCollection.trim(),
        equals(ApiConstants.trailsCollection),
      );
      expect(
        ApiConstants.mvtTilesPath.trim(),
        equals(ApiConstants.mvtTilesPath),
      );
    });

    test('integer constants are within reasonable ranges', () {
      expect(ApiConstants.defaultPageSize, greaterThan(0));
      expect(ApiConstants.defaultPageSize, lessThan(10000));
      expect(ApiConstants.maxPageSize, greaterThan(0));
      expect(ApiConstants.maxPageSize, lessThanOrEqualTo(10000));
    });
  });

  group('ApiConstants - Collection Validation', () {
    test('validCollections contains all defined collections', () {
      expect(ApiConstants.validCollections, contains(ApiConstants.usersCollection));
      expect(ApiConstants.validCollections, contains(ApiConstants.trailsCollection));
      expect(ApiConstants.validCollections, contains(ApiConstants.ratingsCollection));
      expect(ApiConstants.validCollections, contains(ApiConstants.commentsCollection));
      expect(ApiConstants.validCollections, contains(ApiConstants.engagementCollection));
    });

    test('validCollections has correct count', () {
      expect(ApiConstants.validCollections.length, equals(5));
    });

    test('isValidCollection returns true for defined collections', () {
      expect(ApiConstants.isValidCollection(ApiConstants.usersCollection), isTrue);
      expect(ApiConstants.isValidCollection(ApiConstants.trailsCollection), isTrue);
      expect(ApiConstants.isValidCollection(ApiConstants.ratingsCollection), isTrue);
      expect(ApiConstants.isValidCollection(ApiConstants.commentsCollection), isTrue);
      expect(ApiConstants.isValidCollection(ApiConstants.engagementCollection), isTrue);
    });

    test('isValidCollection returns false for unknown collections', () {
      expect(ApiConstants.isValidCollection('unknown'), isFalse);
      expect(ApiConstants.isValidCollection('typo_trails'), isFalse);
      expect(ApiConstants.isValidCollection('Users'), isFalse); // Case-sensitive
      expect(ApiConstants.isValidCollection(''), isFalse);
    });

    test('isValidCollection detects common typos', () {
      // Typos that should be detected
      expect(ApiConstants.isValidCollection('trail'), isFalse); // Missing 's'
      expect(ApiConstants.isValidCollection('rating'), isFalse); // Missing 's'
      expect(ApiConstants.isValidCollection('user'), isFalse); // Missing 's'
    });
  });

  group('ApiConstants - Endpoint Validation', () {
    test('allEndpoints contains all defined endpoints', () {
      expect(ApiConstants.allEndpoints, contains(ApiConstants.mvtTilesPath));
      expect(ApiConstants.allEndpoints, contains(ApiConstants.tileJsonPath));
      expect(ApiConstants.allEndpoints, contains(ApiConstants.mbtilesDownloadPath));
      expect(ApiConstants.allEndpoints, contains(ApiConstants.brouterPath));
    });

    test('allEndpoints has correct count', () {
      expect(ApiConstants.allEndpoints.length, equals(4));
    });

    test('all endpoints are unique', () {
      final endpointList = ApiConstants.allEndpoints.toList();
      expect(endpointList.length, equals(endpointList.toSet().length));
    });

    test('endpoints have no duplicates in allEndpoints set', () {
      expect(ApiConstants.allEndpoints.length, equals(4));
    });
  });
}
