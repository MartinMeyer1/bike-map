package services

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"bike-map-backend/entities"
	"bike-map-backend/interfaces"

	"github.com/pocketbase/pocketbase/core"
)

// SyncService handles synchronization between PocketBase and PostGIS
// It acts as the controller coordinating GPXService, PostGISService, MVTService, and EngagementService
type SyncService struct {
	engagementRepo    interfaces.EngagementRepository
	postgisService    interfaces.PostGISService
	gpxService        *GPXService
	mvtService        interfaces.MVTService
	engagementService *EngagementService
}

// NewSyncService creates a new sync service
func NewSyncService(
	engagementRepo interfaces.EngagementRepository,
	postgisService interfaces.PostGISService,
	gpxService *GPXService,
	mvtService interfaces.MVTService,
	engagementService *EngagementService,
) *SyncService {
	return &SyncService{
		engagementRepo:    engagementRepo,
		postgisService:    postgisService,
		gpxService:        gpxService,
		mvtService:        mvtService,
		engagementService: engagementService,
	}
}

// HandleTrailCreated handles trail creation: sync to PostGIS and invalidate cache
func (s *SyncService) HandleTrailCreated(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Handling trail creation: %s", trailID)

	if err := s.SyncTrailToPostGIS(ctx, app, trailID); err != nil {
		return fmt.Errorf("failed to sync trail to PostGIS: %w", err)
	}

	s.invalidateCacheForTrail(ctx, trailID)
	log.Printf("Successfully handled trail creation: %s", trailID)
	return nil
}

// HandleTrailUpdated handles trail update: get old bbox, sync, invalidate old and new positions
func (s *SyncService) HandleTrailUpdated(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Handling trail update: %s", trailID)

	// Get old bounding box before update
	oldBBox, err := s.postgisService.GetTrailBoundingBox(ctx, trailID)
	if err != nil {
		log.Printf("Could not get old bbox for trail %s: %v", trailID, err)
	}

	// Sync trail to PostGIS
	if err := s.SyncTrailToPostGIS(ctx, app, trailID); err != nil {
		return fmt.Errorf("failed to sync trail to PostGIS: %w", err)
	}

	// Invalidate cache for old position if we got it
	if oldBBox != nil && s.mvtService != nil {
		s.mvtService.InvalidateTilesForBBox(*oldBBox)
	}

	// Invalidate cache for new position
	s.invalidateCacheForTrail(ctx, trailID)
	log.Printf("Successfully handled trail update: %s", trailID)
	return nil
}

// HandleTrailDeleted handles trail deletion: get bbox, delete from PostGIS, invalidate cache
func (s *SyncService) HandleTrailDeleted(ctx context.Context, trailID string) error {
	log.Printf("Handling trail deletion: %s", trailID)

	// Get bounding box before deletion
	oldBBox, err := s.postgisService.GetTrailBoundingBox(ctx, trailID)
	if err != nil {
		log.Printf("Could not get bbox for trail %s before deletion: %v", trailID, err)
	}

	// Delete from PostGIS
	if err := s.RemoveTrailFromPostGIS(ctx, trailID); err != nil {
		return fmt.Errorf("failed to delete trail from PostGIS: %w", err)
	}

	// Invalidate cache
	if s.mvtService != nil {
		if oldBBox != nil {
			s.mvtService.InvalidateTilesForBBox(*oldBBox)
		} else {
			s.mvtService.InvalidateAllCache()
		}
	}

	log.Printf("Successfully handled trail deletion: %s", trailID)
	return nil
}

// HandleRatingCreated handles rating creation: update PocketBase average, sync to PostGIS, invalidate cache
func (s *SyncService) HandleRatingCreated(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Handling rating creation for trail: %s", trailID)

	if s.engagementService != nil {
		if err := s.engagementService.UpdateRatingAverage(app, trailID); err != nil {
			log.Printf("Failed to update rating average: %v", err)
		}
	}

	return s.updateEngagementAndInvalidate(ctx, trailID)
}

// HandleRatingUpdated handles rating update: update PocketBase average, sync to PostGIS, invalidate cache
func (s *SyncService) HandleRatingUpdated(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Handling rating update for trail: %s", trailID)

	if s.engagementService != nil {
		if err := s.engagementService.UpdateRatingAverage(app, trailID); err != nil {
			log.Printf("Failed to update rating average: %v", err)
		}
	}

	return s.updateEngagementAndInvalidate(ctx, trailID)
}

// HandleRatingDeleted handles rating deletion: update PocketBase average, sync to PostGIS, invalidate cache
func (s *SyncService) HandleRatingDeleted(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Handling rating deletion for trail: %s", trailID)

	if s.engagementService != nil {
		if err := s.engagementService.DeleteRatingAverage(app, trailID); err != nil {
			log.Printf("Failed to delete rating average: %v", err)
		}
	}

	return s.updateEngagementAndInvalidate(ctx, trailID)
}

// HandleCommentCreated handles comment creation: sync engagement to PostGIS, invalidate cache
func (s *SyncService) HandleCommentCreated(ctx context.Context, trailID string) error {
	log.Printf("Handling comment creation for trail: %s", trailID)
	return s.updateEngagementAndInvalidate(ctx, trailID)
}

// HandleCommentDeleted handles comment deletion: sync engagement to PostGIS, invalidate cache
func (s *SyncService) HandleCommentDeleted(ctx context.Context, trailID string) error {
	log.Printf("Handling comment deletion for trail: %s", trailID)
	return s.updateEngagementAndInvalidate(ctx, trailID)
}

// updateEngagementAndInvalidate updates engagement stats in PostGIS and invalidates cache
func (s *SyncService) updateEngagementAndInvalidate(ctx context.Context, trailID string) error {
	if err := s.UpdateEngagementStats(ctx, trailID); err != nil {
		return err
	}
	s.invalidateCacheForTrail(ctx, trailID)
	return nil
}

// invalidateCacheForTrail invalidates MVT cache for a trail's bounding box
func (s *SyncService) invalidateCacheForTrail(ctx context.Context, trailID string) {
	if s.mvtService == nil {
		return
	}

	bbox, err := s.postgisService.GetTrailBoundingBox(ctx, trailID)
	if err != nil || bbox == nil {
		log.Printf("Could not get bbox for trail %s, invalidating full cache: %v", trailID, err)
		s.mvtService.InvalidateAllCache()
		return
	}

	s.mvtService.InvalidateTilesForBBox(*bbox)
	log.Printf("Invalidated MVT cache for trail %s", trailID)
}

// SyncTrailToPostGIS synchronizes a trail with full GPX processing
func (s *SyncService) SyncTrailToPostGIS(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Syncing trail %s to PostGIS", trailID)

	// 1. Get trail record from PocketBase
	trail, err := app.FindRecordById("trails", trailID)
	if err != nil {
		return fmt.Errorf("failed to find trail %s: %w", trailID, err)
	}

	// 2. Get GPX file name
	gpxFile := trail.GetString("file")
	if gpxFile == "" {
		return fmt.Errorf("trail %s has no GPX file", trailID)
	}

	// 3. Download GPX file via GPXService
	gpxData, err := s.gpxService.DownloadGPXFromPocketBase(trail, gpxFile)
	if err != nil {
		return fmt.Errorf("failed to download GPX: %w", err)
	}

	// 4. Parse GPX via GPXService
	parsedGPX, err := s.gpxService.ParseGPXFile(gpxData)
	if err != nil {
		return fmt.Errorf("failed to parse GPX: %w", err)
	}

	// 5. Get engagement data
	ratingAvg, ratingCount, commentCount := s.getTrailEngagementData(app, trailID)

	// 6. Serialize elevation data
	elevationJSON, err := json.Marshal(parsedGPX.ElevationData)
	if err != nil {
		return fmt.Errorf("failed to marshal elevation data: %w", err)
	}

	// 7. Prepare tags JSON
	tagsJSON := trail.GetString("tags")
	if tagsJSON == "" {
		tagsJSON = "[]"
	}

	// 8. Insert into PostGIS via PostGISService
	trailData := entities.TrailInsertData{
		ID:            trail.Id,
		Name:          trail.GetString("name"),
		Description:   trail.GetString("description"),
		Level:         trail.GetString("level"),
		Tags:          tagsJSON,
		OwnerID:       trail.GetString("owner"),
		GPXFile:       gpxFile,
		LineStringWKT: parsedGPX.LineStringWKT,
		ElevationJSON: string(elevationJSON),
		CreatedAt:     trail.GetDateTime("created").Time(),
		UpdatedAt:     trail.GetDateTime("updated").Time(),
		RatingAvg:     ratingAvg,
		RatingCount:   ratingCount,
		CommentCount:  commentCount,
		Ridden:        trail.GetBool("ridden"),
	}

	if err := s.postgisService.InsertTrail(ctx, trailData); err != nil {
		return fmt.Errorf("failed to insert trail into PostGIS: %w", err)
	}

	log.Printf("Successfully synced trail %s to PostGIS", trailID)
	return nil
}

// RemoveTrailFromPostGIS removes a trail from PostGIS
func (s *SyncService) RemoveTrailFromPostGIS(ctx context.Context, trailID string) error {
	log.Printf("Removing trail %s from PostGIS", trailID)
	return s.postgisService.DeleteTrail(ctx, trailID)
}

// UpdateEngagementStats updates only the engagement statistics for a trail in PostGIS
func (s *SyncService) UpdateEngagementStats(ctx context.Context, trailID string) error {
	log.Printf("Updating engagement stats for trail %s in PostGIS", trailID)

	// Get engagement statistics from repository
	stats, err := s.engagementRepo.GetEngagementStats(ctx, trailID)
	if err != nil {
		return fmt.Errorf("failed to get engagement stats: %w", err)
	}

	engagementData := entities.EngagementStatsData{
		RatingAvg:    stats.RatingAvg,
		RatingCount:  stats.RatingCount,
		CommentCount: stats.CommentCount,
	}

	if err := s.postgisService.UpdateEngagementStats(ctx, trailID, engagementData); err != nil {
		return fmt.Errorf("failed to update engagement stats in PostGIS: %w", err)
	}

	log.Printf("Updated engagement stats for trail %s in PostGIS", trailID)
	return nil
}

// SyncAllTrails synchronizes all trails from PocketBase to PostGIS
func (s *SyncService) SyncAllTrails(ctx context.Context, app core.App) error {
	log.Println("Starting full trail synchronization to PostGIS")

	// Clear all existing trails from PostGIS first
	if err := s.postgisService.ClearAllTrails(ctx); err != nil {
		return fmt.Errorf("failed to clear existing trails: %w", err)
	}

	// Get all trails from PocketBase
	trails, err := app.FindAllRecords("trails")
	if err != nil {
		return fmt.Errorf("failed to get trails from PocketBase: %w", err)
	}

	log.Printf("Syncing %d trails from PocketBase to PostGIS\n", len(trails))

	for i, trail := range trails {
		log.Printf("Importing trail %d/%d: %s\n", i+1, len(trails), trail.GetString("name"))

		if err := s.SyncTrailToPostGIS(ctx, app, trail.Id); err != nil {
			log.Printf("Failed to import trail %s (%s): %v\n", trail.Id, trail.GetString("name"), err)
			continue
		}
		log.Printf("Successfully imported trail: %s\n", trail.GetString("name"))
	}

	return nil
}

// GetTrailBoundingBox retrieves the bounding box of a trail from PostGIS
func (s *SyncService) GetTrailBoundingBox(ctx context.Context, trailID string) (*entities.BoundingBox, error) {
	return s.postgisService.GetTrailBoundingBox(ctx, trailID)
}

// getTrailEngagementData retrieves rating and comment engagement data for a trail from PocketBase
func (s *SyncService) getTrailEngagementData(app core.App, trailId string) (float64, int, int) {
	var ratingAvg float64 = 0.0
	var ratingCount int = 0
	var commentCount int = 0

	// Get rating average and count from rating_average collection
	ratingAverageCollection, err := app.FindCollectionByNameOrId("rating_average")
	if err == nil {
		averageRecords, err := app.FindRecordsByFilter(ratingAverageCollection, fmt.Sprintf("trail = '%s'", trailId), "", 1, 0)
		if err == nil && len(averageRecords) > 0 {
			record := averageRecords[0]
			ratingAvg = record.GetFloat("average")
			ratingCount = int(record.GetFloat("count"))
		}
	}

	// Get comment count from trail_comments collection
	commentsCollection, err := app.FindCollectionByNameOrId("trail_comments")
	if err == nil {
		commentRecords, err := app.FindRecordsByFilter(commentsCollection, fmt.Sprintf("trail = '%s'", trailId), "", 0, 0)
		if err == nil {
			commentCount = len(commentRecords)
		}
	}

	return ratingAvg, ratingCount, commentCount
}

// Compile-time check to ensure SyncService implements interfaces.SyncService
var _ interfaces.SyncService = (*SyncService)(nil)
