package services

import (
	"context"
	"fmt"

	"bike-map-backend/entities"
	"bike-map-backend/interfaces"

	"github.com/pocketbase/pocketbase/core"
)

// EngagementService handles all engagement-related operations (ratings, comments)
type EngagementService struct {
	app core.App
}

// NewEngagementService creates a new engagement service
func NewEngagementService(app core.App) *EngagementService {
	return &EngagementService{
		app: app,
	}
}

// GetEngagementStats gets aggregated engagement statistics for a trail
func (s *EngagementService) GetEngagementStats(ctx context.Context, trailID string) (*entities.EngagementStats, error) {
	// Get rating statistics
	ratingCount, err := s.getRatingCountFromPB(ctx, trailID)
	if err != nil {
		return nil, fmt.Errorf("failed to get rating count: %w", err)
	}

	ratingAvg, err := s.calculateAverageRatingFromPB(ctx, trailID)
	if err != nil {
		return nil, fmt.Errorf("failed to get average rating: %w", err)
	}

	// Get comment count
	commentCount, err := s.getCommentCountFromPB(ctx, trailID)
	if err != nil {
		return nil, fmt.Errorf("failed to get comment count: %w", err)
	}

	return &entities.EngagementStats{
		TrailID:      trailID,
		RatingCount:  ratingCount,
		RatingAvg:    ratingAvg,
		CommentCount: commentCount,
	}, nil
}

// UpdateRatingAverage updates the rating average for a trail
func (s *EngagementService) UpdateRatingAverage(app core.App, trailId string) error {
	ctx := context.Background()

	// Get current rating statistics
	ratingCount, err := s.getRatingCountFromPB(ctx, trailId)
	if err != nil {
		return fmt.Errorf("failed to get rating count: %w", err)
	}

	ratingAvg, err := s.calculateAverageRatingFromPB(ctx, trailId)
	if err != nil {
		return fmt.Errorf("failed to get average rating: %w", err)
	}

	// Check if rating average record exists
	exists, err := s.ratingAverageExistsInPB(ctx, trailId)
	if err != nil {
		return fmt.Errorf("failed to check rating average existence: %w", err)
	}

	if exists {
		// Update existing record
		existing, err := s.getRatingAverageByTrailIdFromPB(ctx, trailId)
		if err != nil {
			return fmt.Errorf("failed to get existing rating average: %w", err)
		}

		existing.Average = ratingAvg
		existing.Count = ratingCount

		if err := s.updateRatingAverageRecordToPB(ctx, existing); err != nil {
			return fmt.Errorf("failed to update rating average: %w", err)
		}
	} else {
		// Create new record
		ratingAverage := &entities.RatingAverage{
			ID: 		"",
			TrailID: 	trailId,
			Average: 	ratingAvg,
			Count: 		ratingCount,
		}

		if err := s.createRatingAverageToPB(ctx, ratingAverage); err != nil {
			return fmt.Errorf("failed to create rating average: %w", err)
		}
	}

	return nil
}

// DeleteRatingAverage removes the rating average record for a trail if no ratings exist (for legacy PocketBase compatibility)
func (s *EngagementService) DeleteRatingAverage(app core.App, trailId string) error {
	ctx := context.Background()

	// Check if there are any ratings for this trail
	ratingCount, err := s.getRatingCountFromPB(ctx, trailId)
	if err != nil {
		return fmt.Errorf("failed to get rating count: %w", err)
	}

	// If ratings still exist, update the average instead of deleting
	if ratingCount > 0 {
		return s.UpdateRatingAverage(app, trailId)
	}

	// No ratings exist, remove the rating average record
	if err := s.deleteRatingAverageRecordFromPB(ctx, trailId); err != nil {
		return fmt.Errorf("failed to delete rating average: %w", err)
	}

	return nil
}

// Private helper methods below

// calculateAverageRatingFromPB calculates the average rating for a trail
func (s *EngagementService) calculateAverageRatingFromPB(_ context.Context, trailID string) (float64, error) {
	records, err := s.app.FindRecordsByFilter(
		"trail_ratings",
		"trail = {:trail}",
		"",
		0,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return 0, fmt.Errorf("failed to find ratings for average: %w", err)
	}

	if len(records) == 0 {
		return 0, nil
	}

	var sum int
	for _, record := range records {
		sum += record.GetInt("rating")
	}

	return float64(sum) / float64(len(records)), nil
}

// getRatingCountFromPB returns the number of ratings for a trail
func (s *EngagementService) getRatingCountFromPB(_ context.Context, trailID string) (int, error) {
	records, err := s.app.FindRecordsByFilter(
		"trail_ratings",
		"trail = {:trail}",
		"",
		0,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return 0, fmt.Errorf("failed to count ratings: %w", err)
	}

	return len(records), nil
}

// getCommentCountFromPB returns the number of comments for a trail
func (s *EngagementService) getCommentCountFromPB(_ context.Context, trailID string) (int, error) {
	records, err := s.app.FindRecordsByFilter(
		"trail_comments",
		"trail = {:trail}",
		"",
		0,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return 0, fmt.Errorf("failed to count comments: %w", err)
	}

	return len(records), nil
}

// createRatingAverageToPB creates a new rating average entry in PocketBase
func (s *EngagementService) createRatingAverageToPB(_ context.Context, ratingAverage *entities.RatingAverage) error {
	collection, err := s.app.FindCollectionByNameOrId("rating_average")
	if err != nil {
		return fmt.Errorf("failed to find rating_average collection: %w", err)
	}

	record := core.NewRecord(collection)
	record.Set("trail", ratingAverage.TrailID)
	record.Set("average", ratingAverage.Average)
	record.Set("count", ratingAverage.Count)

	if err := s.app.Save(record); err != nil {
		return fmt.Errorf("failed to create rating average: %w", err)
	}

	ratingAverage.ID = record.Id
	return nil
}

// getRatingAverageByTrailIdFromPB retrieves the rating average for a specific trail
func (s *EngagementService) getRatingAverageByTrailIdFromPB(_ context.Context, trailID string) (*entities.RatingAverage, error) {
	records, err := s.app.FindRecordsByFilter(
		"rating_average",
		"trail = {:trail}",
		"",
		1,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find rating average by trail ID: %w", err)
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("rating average not found for trail: %s", trailID)
	}

	return s.recordToRatingAverage(records[0]), nil
}

// updateRatingAverageRecordToPB updates a rating average entry in PocketBase
func (s *EngagementService) updateRatingAverageRecordToPB(_ context.Context, ratingAverage *entities.RatingAverage) error {
	record, err := s.app.FindRecordById("rating_average", ratingAverage.ID)
	if err != nil {
		return fmt.Errorf("failed to find rating average for update: %w", err)
	}

	record.Set("average", ratingAverage.Average)
	record.Set("count", ratingAverage.Count)

	if err := s.app.Save(record); err != nil {
		return fmt.Errorf("failed to update rating average: %w", err)
	}

	return nil
}

// deleteRatingAverageRecordFromPB deletes a rating average entry from PocketBase
func (s *EngagementService) deleteRatingAverageRecordFromPB(_ context.Context, trailID string) error {
	records, err := s.app.FindRecordsByFilter(
		"rating_average",
		"trail = {:trail}",
		"",
		1,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return fmt.Errorf("failed to find rating average for deletion: %w", err)
	}

	if len(records) == 0 {
		return fmt.Errorf("rating average not found for trail: %s", trailID)
	}

	if err := s.app.Delete(records[0]); err != nil {
		return fmt.Errorf("failed to delete rating average: %w", err)
	}

	return nil
}

// ratingAverageExistsInPB checks if a rating average exists for a specific trail
func (s *EngagementService) ratingAverageExistsInPB(_ context.Context, trailID string) (bool, error) {
	records, err := s.app.FindRecordsByFilter(
		"rating_average",
		"trail = {:trail}",
		"",
		1,
		0,
		map[string]any{"trail": trailID},
	)
	if err != nil {
		return false, fmt.Errorf("failed to check rating average existence: %w", err)
	}

	return len(records) > 0, nil
}

// recordToRatingAverage converts a PocketBase record to a RatingAverage entity
func (s *EngagementService) recordToRatingAverage(record *core.Record) *entities.RatingAverage {
	return &entities.RatingAverage{
		ID:      record.Id,
		TrailID: record.GetString("trail"),
		Average: record.GetFloat("average"),
		Count:   record.GetInt("count"),
	}
}

// Compile-time check to ensure EngagementService implements interfaces.EngagementService
var _ interfaces.EngagementService = (*EngagementService)(nil)
