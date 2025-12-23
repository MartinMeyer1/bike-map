package services

import (
	"context"
	"database/sql"
	"fmt"
	"log"

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

// SyncAllTrailsWithApp synchronizes all trails from PocketBase to PostGIS with geometry data
func (s *SyncService) SyncAllTrailsWithApp(ctx context.Context, app core.App) error {
	log.Println("Starting full trail synchronization to PostGIS with geometry")

	// Use the legacy GPXService approach for full compatibility
	if s.gpxService != nil {
		return s.gpxService.SyncAllTrails(app)
	}

	return fmt.Errorf("GPXService not available for trail sync")
}

// Compile-time check to ensure SyncService implements interfaces.SyncService
var _ interfaces.SyncService = (*SyncService)(nil)
