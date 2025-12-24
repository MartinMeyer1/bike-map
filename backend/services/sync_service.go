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

// SyncService handles synchronization between PocketBase, MVTGenerator, and MVTStorages
// It acts as the controller coordinating GPXService, MVTGenerator, MVTStorages, and EngagementService
type SyncService struct {
	mvtGenerator      interfaces.MVTGenerator
	gpxService        *GPXService
	storages          []interfaces.MVTStorage
	engagementService interfaces.EngagementService
}

// NewSyncService creates a new sync service
func NewSyncService(
	mvtGenerator interfaces.MVTGenerator,
	gpxService *GPXService,
	engagementService interfaces.EngagementService,
	storages []interfaces.MVTStorage,
) *SyncService {
	return &SyncService{
		mvtGenerator:      mvtGenerator,
		gpxService:        gpxService,
		storages:          storages,
		engagementService: engagementService,
	}
}

// HandleTrailCreated handles trail creation: sync to generator and generate tiles
func (s *SyncService) HandleTrailCreated(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Handling trail creation: %s", trailID)

	if err := s.syncTrailFromPBToGenerator(ctx, app, trailID); err != nil {
		return fmt.Errorf("failed to sync trail to generator: %w", err)
	}

	// Get tiles for the new trail and generate them
	tiles, err := s.mvtGenerator.GetTrailTiles(trailID)
	if err != nil {
		log.Printf("Failed to get trail tiles: %v", err)
		return nil
	}

	s.generateAndPushTiles(tiles)
	log.Printf("Successfully handled trail creation: %s", trailID)
	return nil
}

// HandleTrailUpdated handles trail update: get old tiles, update generator, get new tiles, generate all
func (s *SyncService) HandleTrailUpdated(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Handling trail update: %s", trailID)

	// Get tiles for old trail position
	oldTiles, err := s.mvtGenerator.GetTrailTiles(trailID)
	if err != nil {
		log.Printf("Could not get old tiles for trail %s: %v", trailID, err)
		oldTiles = nil
	}

	// Update trail in generator
	if err := s.syncTrailFromPBToGenerator(ctx, app, trailID); err != nil {
		return fmt.Errorf("failed to sync trail to generator: %w", err)
	}

	// Get tiles for new trail position
	newTiles, err := s.mvtGenerator.GetTrailTiles(trailID)
	if err != nil {
		log.Printf("Could not get new tiles for trail %s: %v", trailID, err)
		newTiles = nil
	}

	// Aggregate tiles and generate
	allTiles := mergeTiles(oldTiles, newTiles)
	s.generateAndPushTiles(allTiles)

	log.Printf("Successfully handled trail update: %s", trailID)
	return nil
}

// HandleTrailDeleted handles trail deletion: get tiles, delete from generator, regenerate tiles
func (s *SyncService) HandleTrailDeleted(ctx context.Context, trailID string) error {
	log.Printf("Handling trail deletion: %s", trailID)

	// Get tiles for the trail before deletion
	tiles, err := s.mvtGenerator.GetTrailTiles(trailID)
	if err != nil {
		log.Printf("Could not get tiles for trail %s before deletion: %v", trailID, err)
		tiles = nil
	}

	// Delete from generator
	if err := s.mvtGenerator.DeleteTrail(trailID); err != nil {
		return fmt.Errorf("failed to delete trail from generator: %w", err)
	}

	// Regenerate tiles (without the deleted trail)
	s.generateAndPushTiles(tiles)

	log.Printf("Successfully handled trail deletion: %s", trailID)
	return nil
}

// HandleRatingCreated handles rating creation: update PocketBase average, sync to generator, regenerate tiles
func (s *SyncService) HandleRatingCreated(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Handling rating creation for trail: %s", trailID)

	if s.engagementService != nil {
		if err := s.engagementService.UpdateRatingAverage(app, trailID); err != nil {
			log.Printf("Failed to update rating average: %v", err)
		}
	}

	return s.updateEngagementAndRegenerateTiles(ctx, trailID)
}

// HandleRatingUpdated handles rating update: update PocketBase average, sync to generator, regenerate tiles
func (s *SyncService) HandleRatingUpdated(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Handling rating update for trail: %s", trailID)

	if s.engagementService != nil {
		if err := s.engagementService.UpdateRatingAverage(app, trailID); err != nil {
			log.Printf("Failed to update rating average: %v", err)
		}
	}

	return s.updateEngagementAndRegenerateTiles(ctx, trailID)
}

// HandleRatingDeleted handles rating deletion: update PocketBase average, sync to generator, regenerate tiles
func (s *SyncService) HandleRatingDeleted(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Handling rating deletion for trail: %s", trailID)

	if s.engagementService != nil {
		if err := s.engagementService.DeleteRatingAverage(app, trailID); err != nil {
			log.Printf("Failed to delete rating average: %v", err)
		}
	}

	return s.updateEngagementAndRegenerateTiles(ctx, trailID)
}

// HandleCommentCreated handles comment creation: sync engagement to generator, regenerate tiles
func (s *SyncService) HandleCommentCreated(ctx context.Context, trailID string) error {
	log.Printf("Handling comment creation for trail: %s", trailID)
	return s.updateEngagementAndRegenerateTiles(ctx, trailID)
}

// HandleCommentDeleted handles comment deletion: sync engagement to generator, regenerate tiles
func (s *SyncService) HandleCommentDeleted(ctx context.Context, trailID string) error {
	log.Printf("Handling comment deletion for trail: %s", trailID)
	return s.updateEngagementAndRegenerateTiles(ctx, trailID)
}

// updateEngagementAndRegenerateTiles updates engagement stats in generator and regenerates affected tiles
func (s *SyncService) updateEngagementAndRegenerateTiles(ctx context.Context, trailID string) error {
	if err := s.updateEngagementStatsInGenerator(ctx, trailID); err != nil {
		return err
	}

	// Get tiles for the trail and regenerate them
	tiles, err := s.mvtGenerator.GetTrailTiles(trailID)
	if err != nil {
		log.Printf("Could not get tiles for trail %s: %v", trailID, err)
		return nil
	}

	s.generateAndPushTiles(tiles)
	return nil
}

// generateAndPushTiles generates tiles using the generator and pushes them to all storages
func (s *SyncService) generateAndPushTiles(tiles []entities.TileCoordinates) {
	if len(tiles) == 0 {
		return
	}

	log.Printf("Generating and pushing %d tiles to %d storages", len(tiles), len(s.storages))

	for _, tile := range tiles {
		data, err := s.mvtGenerator.GetTile(tile)
		if err != nil {
			log.Printf("Failed to generate tile %d/%d/%d: %v", tile.Z, tile.X, tile.Y, err)
			continue
		}

		for _, storage := range s.storages {
			if err := storage.StoreTile(tile, data); err != nil {
				log.Printf("Failed to store tile %d/%d/%d: %v", tile.Z, tile.X, tile.Y, err)
			}
		}
	}

	log.Printf("Generated and pushed %d tiles", len(tiles))
}

// mergeTiles merges two tile slices, removing duplicates
func mergeTiles(a, b []entities.TileCoordinates) []entities.TileCoordinates {
	seen := make(map[string]bool)
	var result []entities.TileCoordinates

	for _, tile := range a {
		key := fmt.Sprintf("%d-%d-%d", tile.Z, tile.X, tile.Y)
		if !seen[key] {
			seen[key] = true
			result = append(result, tile)
		}
	}

	for _, tile := range b {
		key := fmt.Sprintf("%d-%d-%d", tile.Z, tile.X, tile.Y)
		if !seen[key] {
			seen[key] = true
			result = append(result, tile)
		}
	}

	return result
}

// syncTrailFromPBToGenerator synchronizes a trail with full GPX processing
func (s *SyncService) syncTrailFromPBToGenerator(ctx context.Context, app core.App, trailID string) error {
	log.Printf("Syncing trail %s to generator", trailID)

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
	gpxData, err := s.gpxService.GetTrailGPXFromPB(trail, gpxFile)
	if err != nil {
		return fmt.Errorf("failed to download GPX: %w", err)
	}

	// 4. Parse GPX via GPXService
	parsedGPX, err := s.gpxService.ParseGPXFile(gpxData)
	if err != nil {
		return fmt.Errorf("failed to parse GPX: %w", err)
	}

	// 5. Get engagement data
	ratingAvg, ratingCount, commentCount := s.getTrailEngagementDataFromPB(app, trailID)

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

	// 8. Create trail data and update generator
	trailData := entities.Trail{
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

	if err := s.mvtGenerator.UpdateTrail(ctx, trailData); err != nil {
		return fmt.Errorf("failed to update trail in generator: %w", err)
	}

	log.Printf("Successfully synced trail %s to generator", trailID)
	return nil
}

// updateEngagementStatsInGenerator updates only the engagement statistics for a trail in the generator
func (s *SyncService) updateEngagementStatsInGenerator(ctx context.Context, trailID string) error {
	log.Printf("Updating engagement stats for trail %s in generator", trailID)

	// Get engagement statistics from service
	stats, err := s.engagementService.GetEngagementStats(ctx, trailID)
	if err != nil {
		return fmt.Errorf("failed to get engagement stats: %w", err)
	}

	engagementData := entities.EngagementStatsData{
		RatingAvg:    stats.RatingAvg,
		RatingCount:  stats.RatingCount,
		CommentCount: stats.CommentCount,
	}

	if err := s.mvtGenerator.UpdateEngagementStats(ctx, trailID, engagementData); err != nil {
		return fmt.Errorf("failed to update engagement stats in generator: %w", err)
	}

	log.Printf("Updated engagement stats for trail %s in generator", trailID)
	return nil
}

// SyncAllTrails synchronizes all trails from PocketBase to generator and generates all tiles
func (s *SyncService) SyncAllTrails(ctx context.Context, app core.App) error {
	log.Println("Starting full trail synchronization")

	// Clear all existing trails from generator first
	if err := s.mvtGenerator.ClearAllTrails(ctx); err != nil {
		return fmt.Errorf("failed to clear existing trails: %w", err)
	}

	// Clear all tiles from all storages
	for _, storage := range s.storages {
		if err := storage.ClearAllTiles(); err != nil {
			log.Printf("Failed to clear storage: %v", err)
		}
	}

	// Get all trails from PocketBase
	trails, err := app.FindAllRecords("trails")
	if err != nil {
		return fmt.Errorf("failed to get trails from PocketBase: %w", err)
	}

	log.Printf("Syncing %d trails from PocketBase to generator\n", len(trails))

	// Collect all unique tiles from all trails
	allTiles := make(map[string]entities.TileCoordinates)

	for i, trail := range trails {
		log.Printf("Importing trail %d/%d: %s\n", i+1, len(trails), trail.GetString("name"))

		if err := s.syncTrailFromPBToGenerator(ctx, app, trail.Id); err != nil {
			log.Printf("Failed to import trail %s (%s): %v\n", trail.Id, trail.GetString("name"), err)
			continue
		}

		// Get tiles for this trail
		tiles, err := s.mvtGenerator.GetTrailTiles(trail.Id)
		if err != nil {
			log.Printf("Failed to get tiles for trail %s: %v", trail.Id, err)
			continue
		}

		// Add to unique tiles set
		for _, tile := range tiles {
			key := fmt.Sprintf("%d-%d-%d", tile.Z, tile.X, tile.Y)
			allTiles[key] = tile
		}

		log.Printf("Successfully imported trail: %s\n", trail.GetString("name"))
	}

	// Convert map to slice
	var uniqueTiles []entities.TileCoordinates
	for _, tile := range allTiles {
		uniqueTiles = append(uniqueTiles, tile)
	}

	// Generate and push all tiles
	log.Printf("Generating %d unique tiles", len(uniqueTiles))
	s.generateAndPushTiles(uniqueTiles)

	log.Println("Completed full trail synchronization")
	return nil
}

// getTrailEngagementDataFromPB retrieves rating and comment engagement data for a trail from PocketBase
func (s *SyncService) getTrailEngagementDataFromPB(app core.App, trailId string) (float64, int, int) {
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
var _ interfaces.SyncTrailsService = (*SyncService)(nil)
