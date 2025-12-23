package repositories

import (
	"context"
	"fmt"

	"bike-map-backend/entities"
	"bike-map-backend/interfaces"

	"github.com/pocketbase/pocketbase/core"
)

// PocketBaseEngagementRepository implements EngagementRepository using PocketBase
type PocketBaseEngagementRepository struct {
	app      core.App
	ratings  interfaces.RatingRepository
	comments interfaces.CommentRepository
	averages interfaces.RatingAverageRepository
}

// NewPocketBaseEngagementRepository creates a new PocketBase engagement repository
func NewPocketBaseEngagementRepository(app core.App) interfaces.EngagementRepository {
	return &PocketBaseEngagementRepository{
		app:      app,
		ratings:  NewPocketBaseRatingRepository(app),
		comments: NewPocketBaseCommentRepository(app),
		averages: NewPocketBaseRatingAverageRepository(app),
	}
}

// Ratings returns the rating repository
func (r *PocketBaseEngagementRepository) Ratings() interfaces.RatingRepository {
	return r.ratings
}

// Comments returns the comment repository
func (r *PocketBaseEngagementRepository) Comments() interfaces.CommentRepository {
	return r.comments
}

// RatingAverages returns the rating average repository
func (r *PocketBaseEngagementRepository) RatingAverages() interfaces.RatingAverageRepository {
	return r.averages
}

// GetEngagementStats gets aggregated engagement statistics for a trail
func (r *PocketBaseEngagementRepository) GetEngagementStats(ctx context.Context, trailID string) (*entities.EngagementStats, error) {
	// Get rating statistics
	ratingCount, err := r.ratings.GetRatingCount(ctx, trailID)
	if err != nil {
		return nil, fmt.Errorf("failed to get rating count: %w", err)
	}

	ratingAvg, err := r.ratings.GetAverageRating(ctx, trailID)
	if err != nil {
		return nil, fmt.Errorf("failed to get average rating: %w", err)
	}

	// Get comment count
	commentCount, err := r.comments.GetCommentCount(ctx, trailID)
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


// PocketBaseRatingRepository implements RatingRepository using PocketBase
type PocketBaseRatingRepository struct {
	app core.App
}

// NewPocketBaseRatingRepository creates a new PocketBase rating repository
func NewPocketBaseRatingRepository(app core.App) interfaces.RatingRepository {
	return &PocketBaseRatingRepository{
		app: app,
	}
}

// GetByID retrieves a rating by its ID
func (r *PocketBaseRatingRepository) GetByID(ctx context.Context, id string) (*entities.Rating, error) {
	record, err := r.app.FindRecordById("trail_ratings", id)
	if err != nil {
		return nil, fmt.Errorf("failed to find rating by ID: %w", err)
	}

	return r.recordToRating(record), nil
}

// GetAverageRating calculates the average rating for a trail
func (r *PocketBaseRatingRepository) GetAverageRating(ctx context.Context, trailID string) (float64, error) {
	records, err := r.app.FindRecordsByFilter(
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

// GetRatingCount returns the number of ratings for a trail
func (r *PocketBaseRatingRepository) GetRatingCount(ctx context.Context, trailID string) (int, error) {
	records, err := r.app.FindRecordsByFilter(
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

// recordToRating converts a PocketBase record to a Rating entity
func (r *PocketBaseRatingRepository) recordToRating(record *core.Record) *entities.Rating {
	return &entities.Rating{
		ID:      record.Id,
		TrailID: record.GetString("trail"),
		UserID:  record.GetString("user"),
		Rating:  record.GetInt("rating"),
	}
}

// recordsToRatings converts multiple PocketBase records to Rating entities
func (r *PocketBaseRatingRepository) recordsToRatings(records []*core.Record) []*entities.Rating {
	ratings := make([]*entities.Rating, len(records))
	for i, record := range records {
		ratings[i] = r.recordToRating(record)
	}
	return ratings
}

// PocketBaseCommentRepository implements CommentRepository using PocketBase
type PocketBaseCommentRepository struct {
	app core.App
}

// NewPocketBaseCommentRepository creates a new PocketBase comment repository
func NewPocketBaseCommentRepository(app core.App) interfaces.CommentRepository {
	return &PocketBaseCommentRepository{
		app: app,
	}
}

// GetCommentCount returns the number of comments for a trail
func (r *PocketBaseCommentRepository) GetCommentCount(ctx context.Context, trailID string) (int, error) {
	records, err := r.app.FindRecordsByFilter(
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

// recordToComment converts a PocketBase record to a Comment entity
func (r *PocketBaseCommentRepository) recordToComment(record *core.Record) *entities.Comment {
	return &entities.Comment{
		ID:      record.Id,
		TrailID: record.GetString("trail"),
		UserID:  record.GetString("user"),
		Content: record.GetString("content"),
	}
}
// PocketBaseRatingAverageRepository implements RatingAverageRepository using PocketBase
type PocketBaseRatingAverageRepository struct {
	app core.App
}

// NewPocketBaseRatingAverageRepository creates a new PocketBase rating average repository
func NewPocketBaseRatingAverageRepository(app core.App) interfaces.RatingAverageRepository {
	return &PocketBaseRatingAverageRepository{
		app: app,
	}
}

// Create creates a new rating average entry in PocketBase
func (r *PocketBaseRatingAverageRepository) Create(ctx context.Context, ratingAverage *entities.RatingAverage) error {
	collection, err := r.app.FindCollectionByNameOrId("rating_average")
	if err != nil {
		return fmt.Errorf("failed to find rating_average collection: %w", err)
	}

	record := core.NewRecord(collection)
	record.Set("trail", ratingAverage.TrailID)
	record.Set("average", ratingAverage.Average)
	record.Set("count", ratingAverage.Count)

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to create rating average: %w", err)
	}

	ratingAverage.ID = record.Id
	return nil
}

// GetByTrailID retrieves the rating average for a specific trail
func (r *PocketBaseRatingAverageRepository) GetByTrailID(ctx context.Context, trailID string) (*entities.RatingAverage, error) {
	records, err := r.app.FindRecordsByFilter(
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

	return r.recordToRatingAverage(records[0]), nil
}

// Update updates a rating average entry in PocketBase
func (r *PocketBaseRatingAverageRepository) Update(ctx context.Context, ratingAverage *entities.RatingAverage) error {
	record, err := r.app.FindRecordById("rating_average", ratingAverage.ID)
	if err != nil {
		return fmt.Errorf("failed to find rating average for update: %w", err)
	}

	record.Set("average", ratingAverage.Average)
	record.Set("count", ratingAverage.Count)

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to update rating average: %w", err)
	}

	return nil
}

// Delete deletes a rating average entry from PocketBase
func (r *PocketBaseRatingAverageRepository) Delete(ctx context.Context, trailID string) error {
	records, err := r.app.FindRecordsByFilter(
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

	if err := r.app.Delete(records[0]); err != nil {
		return fmt.Errorf("failed to delete rating average: %w", err)
	}

	return nil
}

// Exists checks if a rating average exists for a specific trail
func (r *PocketBaseRatingAverageRepository) Exists(ctx context.Context, trailID string) (bool, error) {
	records, err := r.app.FindRecordsByFilter(
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
func (r *PocketBaseRatingAverageRepository) recordToRatingAverage(record *core.Record) *entities.RatingAverage {
	return &entities.RatingAverage{
		ID:      record.Id,
		TrailID: record.GetString("trail"),
		Average: record.GetFloat("average"),
		Count:   record.GetInt("count"),
	}
}