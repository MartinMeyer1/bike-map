package event_types

import (
	"bike-map-backend/internal/domain/entities"
	"github.com/google/uuid"
)

// Event types for engagement
const (
	RatingCreatedEvent    = "rating.created"
	RatingUpdatedEvent    = "rating.updated"
	RatingDeletedEvent    = "rating.deleted"
	CommentCreatedEvent   = "comment.created"
	CommentUpdatedEvent   = "comment.updated"
	CommentDeletedEvent   = "comment.deleted"
	EngagementStatsEvent  = "engagement.stats_updated"
)

// RatingCreated represents a rating creation event
type RatingCreated struct {
	BaseEvent
	Rating *entities.Rating `json:"rating"`
}

// RatingUpdated represents a rating update event
type RatingUpdated struct {
	BaseEvent
	Rating   *entities.Rating `json:"rating"`
	Previous *entities.Rating `json:"previous,omitempty"`
}

// RatingDeleted represents a rating deletion event
type RatingDeleted struct {
	BaseEvent
	RatingID string `json:"rating_id"`
	TrailID  string `json:"trail_id"`
	UserID   string `json:"user_id"`
}

// CommentCreated represents a comment creation event
type CommentCreated struct {
	BaseEvent
	Comment *entities.Comment `json:"comment"`
}

// CommentUpdated represents a comment update event
type CommentUpdated struct {
	BaseEvent
	Comment  *entities.Comment `json:"comment"`
	Previous *entities.Comment `json:"previous,omitempty"`
}

// CommentDeleted represents a comment deletion event
type CommentDeleted struct {
	BaseEvent
	CommentID string `json:"comment_id"`
	TrailID   string `json:"trail_id"`
	UserID    string `json:"user_id"`
}

// EngagementStatsUpdated represents an engagement statistics update event
type EngagementStatsUpdated struct {
	BaseEvent
	Stats *entities.EngagementStats `json:"stats"`
}

// NewRatingCreated creates a new rating created event
func NewRatingCreated(rating *entities.Rating) *RatingCreated {
	return &RatingCreated{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			RatingCreatedEvent,
			rating.TrailID,
			rating,
		),
		Rating: rating,
	}
}

// NewRatingUpdated creates a new rating updated event
func NewRatingUpdated(rating, previous *entities.Rating) *RatingUpdated {
	return &RatingUpdated{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			RatingUpdatedEvent,
			rating.TrailID,
			rating,
		),
		Rating:   rating,
		Previous: previous,
	}
}

// NewRatingDeleted creates a new rating deleted event
func NewRatingDeleted(ratingID, trailID, userID string) *RatingDeleted {
	return &RatingDeleted{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			RatingDeletedEvent,
			trailID,
			map[string]string{
				"rating_id": ratingID,
				"trail_id":  trailID,
				"user_id":   userID,
			},
		),
		RatingID: ratingID,
		TrailID:  trailID,
		UserID:   userID,
	}
}

// NewCommentCreated creates a new comment created event
func NewCommentCreated(comment *entities.Comment) *CommentCreated {
	return &CommentCreated{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			CommentCreatedEvent,
			comment.TrailID,
			comment,
		),
		Comment: comment,
	}
}

// NewCommentUpdated creates a new comment updated event
func NewCommentUpdated(comment, previous *entities.Comment) *CommentUpdated {
	return &CommentUpdated{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			CommentUpdatedEvent,
			comment.TrailID,
			comment,
		),
		Comment:  comment,
		Previous: previous,
	}
}

// NewCommentDeleted creates a new comment deleted event
func NewCommentDeleted(commentID, trailID, userID string) *CommentDeleted {
	return &CommentDeleted{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			CommentDeletedEvent,
			trailID,
			map[string]string{
				"comment_id": commentID,
				"trail_id":   trailID,
				"user_id":    userID,
			},
		),
		CommentID: commentID,
		TrailID:   trailID,
		UserID:    userID,
	}
}

// NewEngagementStatsUpdated creates a new engagement stats updated event
func NewEngagementStatsUpdated(stats *entities.EngagementStats) *EngagementStatsUpdated {
	return &EngagementStatsUpdated{
		BaseEvent: NewBaseEvent(
			uuid.New().String(),
			EngagementStatsEvent,
			stats.TrailID,
			stats,
		),
		Stats: stats,
	}
}