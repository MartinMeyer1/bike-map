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
	engagementRepo  interfaces.EngagementRepository
}

// NewEngagementService creates a new engagement service
func NewEngagementService(engagementRepo interfaces.EngagementRepository) *EngagementService {
	return &EngagementService{
		engagementRepo:  engagementRepo,
	}
}


// UpdateRatingAverage updates the rating average for a trail (for legacy PocketBase compatibility)
func (s *EngagementService) UpdateRatingAverage(app core.App, trailId string) error {
	ctx := context.Background()

	// Get current rating statistics
	ratingCount, err := s.engagementRepo.Ratings().GetRatingCount(ctx, trailId)
	if err != nil {
		return fmt.Errorf("failed to get rating count: %w", err)
	}

	ratingAvg, err := s.engagementRepo.Ratings().GetAverageRating(ctx, trailId)
	if err != nil {
		return fmt.Errorf("failed to get average rating: %w", err)
	}

	// Check if rating average record exists
	exists, err := s.engagementRepo.RatingAverages().Exists(ctx, trailId)
	if err != nil {
		return fmt.Errorf("failed to check rating average existence: %w", err)
	}

	if exists {
		// Update existing record
		existing, err := s.engagementRepo.RatingAverages().GetByTrailID(ctx, trailId)
		if err != nil {
			return fmt.Errorf("failed to get existing rating average: %w", err)
		}

		existing.UpdateStats(ratingAvg, ratingCount)
		if err := s.engagementRepo.RatingAverages().Update(ctx, existing); err != nil {
			return fmt.Errorf("failed to update rating average: %w", err)
		}
	} else {
		// Create new record
		ratingAverage := entities.NewRatingAverage("", trailId)
		ratingAverage.UpdateStats(ratingAvg, ratingCount)

		if err := s.engagementRepo.RatingAverages().Create(ctx, ratingAverage); err != nil {
			return fmt.Errorf("failed to create rating average: %w", err)
		}
	}

	return nil
}

// DeleteRatingAverage removes the rating average record for a trail if no ratings exist (for legacy PocketBase compatibility)
func (s *EngagementService) DeleteRatingAverage(app core.App, trailId string) error {
	ctx := context.Background()

	// Check if there are any ratings for this trail
	ratingCount, err := s.engagementRepo.Ratings().GetRatingCount(ctx, trailId)
	if err != nil {
		return fmt.Errorf("failed to get rating count: %w", err)
	}

	// If ratings still exist, update the average instead of deleting
	if ratingCount > 0 {
		return s.UpdateRatingAverage(app, trailId)
	}

	// No ratings exist, remove the rating average record
	if err := s.engagementRepo.RatingAverages().Delete(ctx, trailId); err != nil {
		return fmt.Errorf("failed to delete rating average: %w", err)
	}

	return nil
}
