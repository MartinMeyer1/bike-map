package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	"bike-map-backend/entities"
	"bike-map-backend/interfaces"

	"github.com/pocketbase/pocketbase/core"
)

// SyncService handles synchronization between PocketBase and PostGIS
type SyncService struct {
	trailRepo       interfaces.TrailRepository
	engagementRepo  interfaces.EngagementRepository
	postgisDB       *sql.DB
	gpxService      *GPXService // For GPX processing and geometry extraction
}

// NewSyncService creates a new sync service
func NewSyncService(
	trailRepo interfaces.TrailRepository,
	engagementRepo interfaces.EngagementRepository,
	postgisDB *sql.DB,
	gpxService *GPXService,
) *SyncService {
	return &SyncService{
		trailRepo:       trailRepo,
		engagementRepo:  engagementRepo,
		postgisDB:       postgisDB,
		gpxService:      gpxService,
	}
}

// SyncTrailToPostGIS synchronizes a trail from PocketBase to PostGIS (for interface compatibility)
func (s *SyncService) SyncTrailToPostGIS(ctx context.Context, trailID string) error {
	// This method is kept for interface compatibility but should not be used directly
	// Use SyncTrailToPostGISWithApp for full GPX processing including geometry
	return fmt.Errorf("SyncTrailToPostGIS requires PocketBase app instance - use SyncTrailToPostGISWithApp instead")
}

// SyncTrailToPostGISWithGeometry synchronizes a trail with full GPX processing (for hook handlers)
func (s *SyncService) SyncTrailToPostGISWithGeometry(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Syncing trail %s to PostGIS with full GPX processing", trailID)

	// Use the GPXService to import the full trail with geometry data
	// This ensures MVT tiles have the proper geometry data
	if s.gpxService != nil {
		return s.gpxService.ImportTrailFromPocketBase(app, trailID)
	}

	return fmt.Errorf("GPXService not available for trail sync")
}

// SyncTrailToPostGISWithApp synchronizes a trail from PocketBase to PostGIS with geometry data
func (s *SyncService) SyncTrailToPostGISWithApp(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Syncing trail %s to PostGIS with geometry", trailID)

	// Use the GPXService to import the full trail with geometry data
	// This ensures MVT tiles have the proper geometry data
	if s.gpxService != nil {
		return s.gpxService.ImportTrailFromPocketBase(app, trailID)
	}

	return fmt.Errorf("GPXService not available for trail sync")
}

// insertTrailMetadataToPostGIS inserts a new trail into PostGIS without geometry (for events)
func (s *SyncService) insertTrailMetadataToPostGIS(ctx context.Context, trail *entities.Trail, stats *entities.EngagementStats) error {
	query := `
		INSERT INTO trails (
			id, name, description, level, tags, owner_id, gpx_file,
			distance_m, rating_average, rating_count, comment_count,
			ridden, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		)`

	var tagsJSON interface{} = nil
	if len(trail.Tags) > 0 {
		tagsBytes, err := json.Marshal(trail.Tags)
		if err != nil {
			return fmt.Errorf("failed to marshal tags: %w", err)
		}
		tagsJSON = string(tagsBytes)
	}

	var distanceM interface{} = nil
	if trail.DistanceM != nil {
		distanceM = *trail.DistanceM
	}

	_, err := s.postgisDB.ExecContext(ctx, query,
		trail.ID,
		trail.Name,
		trail.Description,
		string(trail.Level),
		tagsJSON,
		trail.OwnerID,
		trail.GPXFile,
		distanceM,
		stats.RatingAvg,
		stats.RatingCount,
		stats.CommentCount,
		trail.Ridden,
		trail.CreatedAt,
		trail.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to insert trail metadata into PostGIS: %w", err)
	}

	log.Printf("Inserted trail metadata %s into PostGIS (geometry will be added by GPX processing)", trail.ID)
	return nil
}

// insertTrailToPostGIS inserts a new trail into PostGIS
func (s *SyncService) insertTrailToPostGIS(ctx context.Context, trail *entities.Trail, stats *entities.EngagementStats) error {
	query := `
		INSERT INTO trails (
			id, name, description, level, tags, owner_id, gpx_file,
			distance_m, rating_average, rating_count, comment_count,
			ridden, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
		)`

	var tagsJSON interface{} = nil
	if len(trail.Tags) > 0 {
		tagsBytes, err := json.Marshal(trail.Tags)
		if err != nil {
			return fmt.Errorf("failed to marshal tags: %w", err)
		}
		tagsJSON = string(tagsBytes)
	}

	var distanceM interface{} = nil
	if trail.DistanceM != nil {
		distanceM = *trail.DistanceM
	}

	_, err := s.postgisDB.ExecContext(ctx, query,
		trail.ID,
		trail.Name,
		trail.Description,
		string(trail.Level),
		tagsJSON,
		trail.OwnerID,
		trail.GPXFile,
		distanceM,
		stats.RatingAvg,
		stats.RatingCount,
		stats.CommentCount,
		trail.Ridden,
		trail.CreatedAt,
		trail.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to insert trail into PostGIS: %w", err)
	}

	log.Printf("Inserted trail %s into PostGIS", trail.ID)
	return nil
}

// updateTrailInPostGIS updates an existing trail in PostGIS
func (s *SyncService) updateTrailInPostGIS(ctx context.Context, trail *entities.Trail, stats *entities.EngagementStats) error {
	query := `
		UPDATE trails SET
			name = $2,
			description = $3,
			level = $4,
			tags = $5,
			owner_id = $6,
			gpx_file = $7,
			distance_m = $8,
			rating_average = $9,
			rating_count = $10,
			comment_count = $11,
			ridden = $12,
			updated_at = $13
		WHERE id = $1`

	var tagsJSON interface{} = nil
	if len(trail.Tags) > 0 {
		tagsBytes, err := json.Marshal(trail.Tags)
		if err != nil {
			return fmt.Errorf("failed to marshal tags: %w", err)
		}
		tagsJSON = string(tagsBytes)
	}

	var distanceM interface{} = nil
	if trail.DistanceM != nil {
		distanceM = *trail.DistanceM
	}

	_, err := s.postgisDB.ExecContext(ctx, query,
		trail.ID,
		trail.Name,
		trail.Description,
		string(trail.Level),
		tagsJSON,
		trail.OwnerID,
		trail.GPXFile,
		distanceM,
		stats.RatingAvg,
		stats.RatingCount,
		stats.CommentCount,
		trail.Ridden,
		trail.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to update trail in PostGIS: %w", err)
	}

	log.Printf("Updated trail %s in PostGIS", trail.ID)
	return nil
}

// RemoveTrailFromPostGIS removes a trail from PostGIS
func (s *SyncService) RemoveTrailFromPostGIS(ctx context.Context, trailID string) error {
	log.Printf("Removing trail %s from PostGIS", trailID)

	query := `DELETE FROM trails WHERE id = $1`
	result, err := s.postgisDB.ExecContext(ctx, query, trailID)
	if err != nil {
		return fmt.Errorf("failed to delete trail from PostGIS: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		log.Printf("Trail %s not found in PostGIS (already deleted?)", trailID)
	} else {
		log.Printf("Removed trail %s from PostGIS", trailID)
	}

	return nil
}

// UpdateEngagementStats updates only the engagement statistics for a trail in PostGIS
func (s *SyncService) UpdateEngagementStats(ctx context.Context, trailID string) error {
	log.Printf("Updating engagement stats for trail %s in PostGIS", trailID)

	// Get engagement statistics
	stats, err := s.engagementRepo.GetEngagementStats(ctx, trailID)
	if err != nil {
		return fmt.Errorf("failed to get engagement stats: %w", err)
	}

	query := `
		UPDATE trails SET 
			rating_average = $2,
			rating_count = $3,
			comment_count = $4,
			updated_at = NOW()
		WHERE id = $1`

	result, err := s.postgisDB.ExecContext(ctx, query,
		trailID,
		stats.RatingAvg,
		stats.RatingCount,
		stats.CommentCount,
	)

	if err != nil {
		return fmt.Errorf("failed to update engagement stats in PostGIS: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		log.Printf("Trail %s not found in PostGIS for engagement stats update", trailID)
		// Try to sync the entire trail if it doesn't exist
		return s.SyncTrailToPostGIS(ctx, trailID)
	}

	log.Printf("Updated engagement stats for trail %s in PostGIS", trailID)
	return nil
}

// ClearAllTrails removes all trails from PostGIS (like the old GPXService implementation)
func (s *SyncService) ClearAllTrails(ctx context.Context) error {
	log.Println("Clearing all trails from PostGIS")

	query := `DELETE FROM trails`
	result, err := s.postgisDB.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to clear all trails from PostGIS: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected for trail clearing: %w", err)
	}

	log.Printf("Cleared %d trails from PostGIS", rowsAffected)
	return nil
}

// SyncAllTrails synchronizes all trails from PocketBase to PostGIS
func (s *SyncService) SyncAllTrails(ctx context.Context) error {
	return fmt.Errorf("SyncAllTrails requires PocketBase app instance - use SyncAllTrailsWithApp instead")
}

// SyncAllTrailsWithApp synchronizes all trails from PocketBase to PostGIS with geometry data
func (s *SyncService) SyncAllTrailsWithApp(ctx context.Context, app core.App) error {
	log.Println("Starting full trail synchronization to PostGIS with geometry")

	// Use the legacy GPXService approach for full compatibility
	if s.gpxService != nil {
		return s.gpxService.SyncAllTrails(app)
	}

	return fmt.Errorf("GPXService not available for trail sync")
}

// CleanupOrphanedTrails removes trails from PostGIS that no longer exist in PocketBase
func (s *SyncService) CleanupOrphanedTrails(ctx context.Context) error {
	log.Println("Cleaning up orphaned trails in PostGIS")

	// Get all trail IDs from PostGIS
	postgisQuery := `SELECT id FROM trails`
	rows, err := s.postgisDB.QueryContext(ctx, postgisQuery)
	if err != nil {
		return fmt.Errorf("failed to query PostGIS trails: %w", err)
	}
	defer rows.Close()

	var postgisTrailIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("failed to scan trail ID: %w", err)
		}
		postgisTrailIDs = append(postgisTrailIDs, id)
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error iterating PostGIS trails: %w", err)
	}

	// Check each trail ID against PocketBase
	orphanedCount := 0
	for _, trailID := range postgisTrailIDs {
		exists, err := s.trailRepo.Exists(ctx, trailID)
		if err != nil {
			log.Printf("Failed to check trail existence in PocketBase for %s: %v", trailID, err)
			continue
		}

		if !exists {
			// Trail is orphaned, remove from PostGIS
			if err := s.RemoveTrailFromPostGIS(ctx, trailID); err != nil {
				log.Printf("Failed to remove orphaned trail %s: %v", trailID, err)
			} else {
				orphanedCount++
			}
		}
	}

	log.Printf("Cleaned up %d orphaned trails from PostGIS", orphanedCount)
	return nil
}

// GetSyncStatus returns the synchronization status between PocketBase and PostGIS
func (s *SyncService) GetSyncStatus(ctx context.Context) (*SyncStatus, error) {
	// Count trails in PocketBase
	pocketbaseTrails, err := s.trailRepo.List(ctx, 0, 0) // Get all trails
	if err != nil {
		return nil, fmt.Errorf("failed to count PocketBase trails: %w", err)
	}
	pocketbaseCount := len(pocketbaseTrails)

	// Count trails in PostGIS
	var postgisCount int
	err = s.postgisDB.QueryRowContext(ctx, "SELECT COUNT(*) FROM trails").Scan(&postgisCount)
	if err != nil {
		return nil, fmt.Errorf("failed to count PostGIS trails: %w", err)
	}

	// Check for mismatches
	var mismatched []string
	if pocketbaseCount != postgisCount {
		// Detailed comparison would go here
		log.Printf("Trail count mismatch: PocketBase=%d, PostGIS=%d", pocketbaseCount, postgisCount)
	}

	return &SyncStatus{
		PocketBaseCount: pocketbaseCount,
		PostGISCount:    postgisCount,
		InSync:          pocketbaseCount == postgisCount,
		MismatchedIDs:   mismatched,
	}, nil
}

// SyncStatus represents the synchronization status
type SyncStatus struct {
	PocketBaseCount int      `json:"pocketbase_count"`
	PostGISCount    int      `json:"postgis_count"`
	InSync          bool     `json:"in_sync"`
	MismatchedIDs   []string `json:"mismatched_ids"`
}

// Legacy compatibility methods

// InsertTrailToPostGIS provides legacy compatibility (delegate to SyncTrailToPostGIS)
func (s *SyncService) InsertTrailToPostGIS(app core.App, trailId string) error {
	return s.SyncTrailToPostGIS(context.Background(), trailId)
}

// UpdateTrailInPostGIS provides legacy compatibility (delegate to SyncTrailToPostGIS)
func (s *SyncService) UpdateTrailInPostGIS(app core.App, trailId string) error {
	return s.SyncTrailToPostGIS(context.Background(), trailId)
}

// DeleteTrailFromPostGIS provides legacy compatibility (delegate to RemoveTrailFromPostGIS)
func (s *SyncService) DeleteTrailFromPostGIS(app core.App, trailId string) error {
	return s.RemoveTrailFromPostGIS(context.Background(), trailId)
}

// Compile-time check to ensure SyncService implements interfaces.SyncService
var _ interfaces.SyncService = (*SyncService)(nil)
