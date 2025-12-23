package interfaces

import (
	"context"

	"bike-map-backend/entities"
)

// RatingRepository defines the interface for rating data access
type RatingRepository interface {
	// Statistics operations
	GetAverageRating(ctx context.Context, trailID string) (float64, error)
	GetRatingCount(ctx context.Context, trailID string) (int, error)
}

// CommentRepository defines the interface for comment data access
type CommentRepository interface {
	// Statistics operations
	GetCommentCount(ctx context.Context, trailID string) (int, error)
}

// RatingAverageRepository defines the interface for rating average data access
type RatingAverageRepository interface {
	// Basic CRUD operations
	Create(ctx context.Context, ratingAverage *entities.RatingAverage) error
	GetByTrailID(ctx context.Context, trailID string) (*entities.RatingAverage, error)
	Update(ctx context.Context, ratingAverage *entities.RatingAverage) error
	Delete(ctx context.Context, trailID string) error
	Exists(ctx context.Context, trailID string) (bool, error)
}

// EngagementRepository combines all engagement-related repositories
type EngagementRepository interface {
	Ratings() RatingRepository
	Comments() CommentRepository
	RatingAverages() RatingAverageRepository

	// Aggregated operations across all engagement types
	GetEngagementStats(ctx context.Context, trailID string) (*entities.EngagementStats, error)
}
