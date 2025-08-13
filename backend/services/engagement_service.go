package services

import (
	"context"
	"fmt"
	"log"

	"bike-map-backend/entities"
	"bike-map-backend/events"
	"bike-map-backend/events/types"
	"bike-map-backend/interfaces"
	"bike-map-backend/validation"

	"github.com/pocketbase/pocketbase/core"
)

// EngagementService handles all engagement-related operations (ratings, comments)
type EngagementService struct {
	engagementRepo  interfaces.EngagementRepository
	trailRepo       interfaces.TrailRepository
	userRepo        interfaces.UserRepository
	validator       *validation.ValidatorSuite
	eventDispatcher *events.Dispatcher
}

// NewEngagementService creates a new engagement service
func NewEngagementService(
	engagementRepo interfaces.EngagementRepository,
	trailRepo interfaces.TrailRepository,
	userRepo interfaces.UserRepository,
	validator *validation.ValidatorSuite,
	eventDispatcher *events.Dispatcher,
) *EngagementService {
	return &EngagementService{
		engagementRepo:  engagementRepo,
		trailRepo:       trailRepo,
		userRepo:        userRepo,
		validator:       validator,
		eventDispatcher: eventDispatcher,
	}
}

// Rating Operations

// CreateRating creates a new rating for a trail
func (s *EngagementService) CreateRating(ctx context.Context, trailID, userID string, ratingValue int) (*entities.Rating, error) {
	// Validate input
	if err := s.validator.Engagement.ValidateRatingCreation(ratingValue); err.HasErrors() {
		return nil, fmt.Errorf("validation failed: %v", err.Errors)
	}

	// Check if trail exists
	if exists, err := s.trailRepo.Exists(ctx, trailID); err != nil {
		return nil, fmt.Errorf("failed to check trail existence: %w", err)
	} else if !exists {
		return nil, fmt.Errorf("trail not found: %s", trailID)
	}

	// Check if user exists
	if exists, err := s.userRepo.Exists(ctx, userID); err != nil {
		return nil, fmt.Errorf("failed to check user existence: %w", err)
	} else if !exists {
		return nil, fmt.Errorf("user not found: %s", userID)
	}

	// Check if user has already rated this trail
	if hasRated, err := s.engagementRepo.Ratings().UserHasRated(ctx, userID, trailID); err != nil {
		return nil, fmt.Errorf("failed to check existing rating: %w", err)
	} else if hasRated {
		return nil, fmt.Errorf("user has already rated this trail")
	}

	// Create rating entity
	rating := entities.NewRating("", trailID, userID, ratingValue)

	// Validate entity
	if err := rating.Validate(); err != nil {
		return nil, fmt.Errorf("rating validation failed: %w", err)
	}

	// Save to repository
	if err := s.engagementRepo.Ratings().Create(ctx, rating); err != nil {
		return nil, fmt.Errorf("failed to create rating: %w", err)
	}

	// Publish event
	event := types.NewRatingCreated(rating)
	if err := s.eventDispatcher.Publish(ctx, event); err != nil {
		log.Printf("Failed to publish rating created event: %v", err)
	}

	log.Printf("Created rating: %s for trail %s by user %s", rating.ID, trailID, userID)
	return rating, nil
}

// UpdateRating updates an existing rating
func (s *EngagementService) UpdateRating(ctx context.Context, ratingID string, userID string, newRatingValue int) (*entities.Rating, error) {
	// Validate input
	if err := s.validator.Engagement.ValidateRatingCreation(newRatingValue); err.HasErrors() {
		return nil, fmt.Errorf("validation failed: %v", err.Errors)
	}

	// Get existing rating
	existing, err := s.engagementRepo.Ratings().GetByID(ctx, ratingID)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing rating: %w", err)
	}

	// Check ownership
	if !existing.IsOwnedBy(userID) {
		user, err := s.userRepo.GetByID(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("failed to get user: %w", err)
		}
		if !user.IsAdmin() {
			return nil, fmt.Errorf("access denied: cannot update rating")
		}
	}

	// Create updated copy
	previous := *existing
	existing.UpdateRating(newRatingValue)

	// Validate updated entity
	if err := existing.Validate(); err != nil {
		return nil, fmt.Errorf("rating validation failed: %w", err)
	}

	// Save to repository
	if err := s.engagementRepo.Ratings().Update(ctx, existing); err != nil {
		return nil, fmt.Errorf("failed to update rating: %w", err)
	}

	// Publish event
	event := types.NewRatingUpdated(existing, &previous)
	if err := s.eventDispatcher.Publish(ctx, event); err != nil {
		log.Printf("Failed to publish rating updated event: %v", err)
	}

	log.Printf("Updated rating: %s", ratingID)
	return existing, nil
}

// DeleteRating deletes a rating
func (s *EngagementService) DeleteRating(ctx context.Context, ratingID, userID string) error {
	// Get existing rating
	existing, err := s.engagementRepo.Ratings().GetByID(ctx, ratingID)
	if err != nil {
		return fmt.Errorf("failed to get existing rating: %w", err)
	}

	// Check ownership
	if !existing.IsOwnedBy(userID) {
		user, err := s.userRepo.GetByID(ctx, userID)
		if err != nil {
			return fmt.Errorf("failed to get user: %w", err)
		}
		if !user.IsAdmin() {
			return fmt.Errorf("access denied: cannot delete rating")
		}
	}

	// Delete from repository
	if err := s.engagementRepo.Ratings().Delete(ctx, ratingID); err != nil {
		return fmt.Errorf("failed to delete rating: %w", err)
	}

	// Publish event
	event := types.NewRatingDeleted(ratingID, existing.TrailID, existing.UserID)
	if err := s.eventDispatcher.Publish(ctx, event); err != nil {
		log.Printf("Failed to publish rating deleted event: %v", err)
	}

	log.Printf("Deleted rating: %s", ratingID)
	return nil
}

// GetRatingsByTrail gets all ratings for a trail
func (s *EngagementService) GetRatingsByTrail(ctx context.Context, trailID string) ([]*entities.Rating, error) {
	return s.engagementRepo.Ratings().GetByTrail(ctx, trailID)
}

// GetRatingsByUser gets all ratings by a user
func (s *EngagementService) GetRatingsByUser(ctx context.Context, userID string) ([]*entities.Rating, error) {
	return s.engagementRepo.Ratings().GetByUser(ctx, userID)
}

// GetUserRatingForTrail gets a specific user's rating for a trail
func (s *EngagementService) GetUserRatingForTrail(ctx context.Context, userID, trailID string) (*entities.Rating, error) {
	return s.engagementRepo.Ratings().GetByUserAndTrail(ctx, userID, trailID)
}

// Comment Operations

// CreateComment creates a new comment for a trail
func (s *EngagementService) CreateComment(ctx context.Context, trailID, userID, content string) (*entities.Comment, error) {
	// Validate input
	if err := s.validator.Engagement.ValidateCommentCreation(content); err.HasErrors() {
		return nil, fmt.Errorf("validation failed: %v", err.Errors)
	}

	// Check if trail exists
	if exists, err := s.trailRepo.Exists(ctx, trailID); err != nil {
		return nil, fmt.Errorf("failed to check trail existence: %w", err)
	} else if !exists {
		return nil, fmt.Errorf("trail not found: %s", trailID)
	}

	// Check if user exists
	if exists, err := s.userRepo.Exists(ctx, userID); err != nil {
		return nil, fmt.Errorf("failed to check user existence: %w", err)
	} else if !exists {
		return nil, fmt.Errorf("user not found: %s", userID)
	}

	// Create comment entity
	comment := entities.NewComment("", trailID, userID, content)

	// Validate entity
	if err := comment.Validate(); err != nil {
		return nil, fmt.Errorf("comment validation failed: %w", err)
	}

	// Save to repository
	if err := s.engagementRepo.Comments().Create(ctx, comment); err != nil {
		return nil, fmt.Errorf("failed to create comment: %w", err)
	}

	// Publish event
	event := types.NewCommentCreated(comment)
	if err := s.eventDispatcher.Publish(ctx, event); err != nil {
		log.Printf("Failed to publish comment created event: %v", err)
	}

	log.Printf("Created comment: %s for trail %s by user %s", comment.ID, trailID, userID)
	return comment, nil
}

// UpdateComment updates an existing comment
func (s *EngagementService) UpdateComment(ctx context.Context, commentID, userID, newContent string) (*entities.Comment, error) {
	// Validate input
	if err := s.validator.Engagement.ValidateCommentCreation(newContent); err.HasErrors() {
		return nil, fmt.Errorf("validation failed: %v", err.Errors)
	}

	// Get existing comment
	existing, err := s.engagementRepo.Comments().GetByID(ctx, commentID)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing comment: %w", err)
	}

	// Check permissions
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	if !existing.CanBeEditedBy(userID, user.IsAdmin()) {
		return nil, fmt.Errorf("access denied: cannot edit comment")
	}

	// Create updated copy
	previous := *existing
	existing.UpdateContent(newContent)

	// Validate updated entity
	if err := existing.Validate(); err != nil {
		return nil, fmt.Errorf("comment validation failed: %w", err)
	}

	// Save to repository
	if err := s.engagementRepo.Comments().Update(ctx, existing); err != nil {
		return nil, fmt.Errorf("failed to update comment: %w", err)
	}

	// Publish event
	event := types.NewCommentUpdated(existing, &previous)
	if err := s.eventDispatcher.Publish(ctx, event); err != nil {
		log.Printf("Failed to publish comment updated event: %v", err)
	}

	log.Printf("Updated comment: %s", commentID)
	return existing, nil
}

// DeleteComment deletes a comment
func (s *EngagementService) DeleteComment(ctx context.Context, commentID, userID string) error {
	// Get existing comment
	existing, err := s.engagementRepo.Comments().GetByID(ctx, commentID)
	if err != nil {
		return fmt.Errorf("failed to get existing comment: %w", err)
	}

	// Check permissions
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("failed to get user: %w", err)
	}

	if !existing.CanBeDeletedBy(userID, user.IsAdmin()) {
		return fmt.Errorf("access denied: cannot delete comment")
	}

	// Delete from repository
	if err := s.engagementRepo.Comments().Delete(ctx, commentID); err != nil {
		return fmt.Errorf("failed to delete comment: %w", err)
	}

	// Publish event
	event := types.NewCommentDeleted(commentID, existing.TrailID, existing.UserID)
	if err := s.eventDispatcher.Publish(ctx, event); err != nil {
		log.Printf("Failed to publish comment deleted event: %v", err)
	}

	log.Printf("Deleted comment: %s", commentID)
	return nil
}

// GetCommentsByTrail gets comments for a trail with pagination
func (s *EngagementService) GetCommentsByTrail(ctx context.Context, trailID string, limit, offset int) ([]*entities.Comment, error) {
	return s.engagementRepo.Comments().GetByTrail(ctx, trailID, limit, offset)
}

// GetCommentsByUser gets comments by a user with pagination
func (s *EngagementService) GetCommentsByUser(ctx context.Context, userID string, limit, offset int) ([]*entities.Comment, error) {
	return s.engagementRepo.Comments().GetByUser(ctx, userID, limit, offset)
}

// GetRecentComments gets the most recent comments across all trails
func (s *EngagementService) GetRecentComments(ctx context.Context, limit int) ([]*entities.Comment, error) {
	return s.engagementRepo.Comments().GetRecent(ctx, limit)
}

// Statistics Operations

// GetEngagementStats gets comprehensive engagement statistics for a trail
func (s *EngagementService) GetEngagementStats(ctx context.Context, trailID string) (*entities.EngagementStats, error) {
	return s.engagementRepo.GetEngagementStats(ctx, trailID)
}

// GetEngagementStatsBatch gets engagement statistics for multiple trails
func (s *EngagementService) GetEngagementStatsBatch(ctx context.Context, trailIDs []string) (map[string]*entities.EngagementStats, error) {
	return s.engagementRepo.GetEngagementStatsBatch(ctx, trailIDs)
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

	// Publish stats updated event
	stats := &entities.EngagementStats{
		TrailID:     trailId,
		RatingCount: ratingCount,
		RatingAvg:   ratingAvg,
	}

	event := types.NewEngagementStatsUpdated(stats)
	if err := s.eventDispatcher.Publish(ctx, event); err != nil {
		log.Printf("Failed to publish engagement stats updated event: %v", err)
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
