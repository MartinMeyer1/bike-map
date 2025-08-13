package repositories

import (
	"context"
	"fmt"
	"strings"

	"bike-map-backend/internal/domain/entities"
	"bike-map-backend/internal/domain/repositories"
	
	"github.com/pocketbase/pocketbase/core"
)

// PocketBaseTrailRepository implements TrailRepository using PocketBase
type PocketBaseTrailRepository struct {
	app core.App
}

// NewPocketBaseTrailRepository creates a new PocketBase trail repository
func NewPocketBaseTrailRepository(app core.App) repositories.TrailRepository {
	return &PocketBaseTrailRepository{
		app: app,
	}
}

// Create creates a new trail in PocketBase
func (r *PocketBaseTrailRepository) Create(ctx context.Context, trail *entities.Trail) error {
	collection, err := r.app.FindCollectionByNameOrId("trails")
	if err != nil {
		return fmt.Errorf("failed to find trails collection: %w", err)
	}

	record := core.NewRecord(collection)
	record.Set("name", trail.Name)
	record.Set("description", trail.Description)
	record.Set("level", string(trail.Level))
	record.Set("tags", trail.Tags)
	record.Set("owner", trail.OwnerID)
	record.Set("gpx_file", trail.GPXFile)
	
	if trail.DistanceM != nil {
		record.Set("distance_m", *trail.DistanceM)
	}

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to create trail: %w", err)
	}

	trail.ID = record.Id
	return nil
}

// GetByID retrieves a trail by its ID
func (r *PocketBaseTrailRepository) GetByID(ctx context.Context, id string) (*entities.Trail, error) {
	record, err := r.app.FindRecordById("trails", id)
	if err != nil {
		return nil, fmt.Errorf("failed to find trail by ID: %w", err)
	}

	return r.recordToTrail(record), nil
}

// Update updates a trail in PocketBase
func (r *PocketBaseTrailRepository) Update(ctx context.Context, trail *entities.Trail) error {
	record, err := r.app.FindRecordById("trails", trail.ID)
	if err != nil {
		return fmt.Errorf("failed to find trail for update: %w", err)
	}

	record.Set("name", trail.Name)
	record.Set("description", trail.Description)
	record.Set("level", string(trail.Level))
	record.Set("tags", trail.Tags)
	record.Set("owner", trail.OwnerID)
	record.Set("gpx_file", trail.GPXFile)
	
	if trail.DistanceM != nil {
		record.Set("distance_m", *trail.DistanceM)
	}

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to update trail: %w", err)
	}

	return nil
}

// Delete deletes a trail from PocketBase
func (r *PocketBaseTrailRepository) Delete(ctx context.Context, id string) error {
	record, err := r.app.FindRecordById("trails", id)
	if err != nil {
		return fmt.Errorf("failed to find trail for deletion: %w", err)
	}

	if err := r.app.Delete(record); err != nil {
		return fmt.Errorf("failed to delete trail: %w", err)
	}

	return nil
}

// GetByOwner retrieves trails by owner ID
func (r *PocketBaseTrailRepository) GetByOwner(ctx context.Context, ownerID string) ([]*entities.Trail, error) {
	records, err := r.app.FindRecordsByFilter(
		"trails",
		"owner = {:owner}",
		"-created",
		0,
		0,
		map[string]any{"owner": ownerID},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find trails by owner: %w", err)
	}

	return r.recordsToTrails(records), nil
}

// GetByLevel retrieves trails by difficulty level
func (r *PocketBaseTrailRepository) GetByLevel(ctx context.Context, level entities.TrailLevel) ([]*entities.Trail, error) {
	records, err := r.app.FindRecordsByFilter(
		"trails",
		"level = {:level}",
		"-created",
		0,
		0,
		map[string]any{"level": string(level)},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find trails by level: %w", err)
	}

	return r.recordsToTrails(records), nil
}

// GetByTags retrieves trails that contain any of the specified tags
func (r *PocketBaseTrailRepository) GetByTags(ctx context.Context, tags []string) ([]*entities.Trail, error) {
	if len(tags) == 0 {
		return []*entities.Trail{}, nil
	}

	// Build filter for tags - check if any of the provided tags match
	var conditions []string
	params := make(map[string]any)
	
	for i, tag := range tags {
		paramKey := fmt.Sprintf("tag%d", i)
		conditions = append(conditions, fmt.Sprintf("tags ~ {:"+paramKey+"}"))
		params[paramKey] = tag
	}
	
	filter := strings.Join(conditions, " || ")

	records, err := r.app.FindRecordsByFilter(
		"trails",
		filter,
		"-created",
		0,
		0,
		params,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find trails by tags: %w", err)
	}

	return r.recordsToTrails(records), nil
}

// Search searches trails by name or description
func (r *PocketBaseTrailRepository) Search(ctx context.Context, query string) ([]*entities.Trail, error) {
	records, err := r.app.FindRecordsByFilter(
		"trails",
		"name ~ {:query} || description ~ {:query}",
		"-created",
		0,
		0,
		map[string]any{"query": query},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to search trails: %w", err)
	}

	return r.recordsToTrails(records), nil
}

// List retrieves trails with pagination
func (r *PocketBaseTrailRepository) List(ctx context.Context, limit, offset int) ([]*entities.Trail, error) {
	records, err := r.app.FindRecordsByFilter(
		"trails",
		"",
		"-created",
		limit,
		offset,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list trails: %w", err)
	}

	return r.recordsToTrails(records), nil
}

// Exists checks if a trail exists by ID
func (r *PocketBaseTrailRepository) Exists(ctx context.Context, id string) (bool, error) {
	_, err := r.app.FindRecordById("trails", id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return false, nil
		}
		return false, fmt.Errorf("failed to check trail existence: %w", err)
	}
	return true, nil
}

// ExistsByName checks if a trail with the given name exists (excluding a specific ID)
func (r *PocketBaseTrailRepository) ExistsByName(ctx context.Context, name string, excludeID string) (bool, error) {
	filter := "name = {:name}"
	params := map[string]any{"name": name}
	
	if excludeID != "" {
		filter += " && id != {:excludeId}"
		params["excludeId"] = excludeID
	}

	records, err := r.app.FindRecordsByFilter("trails", filter, "", 1, 0, params)
	if err != nil {
		return false, fmt.Errorf("failed to check trail name existence: %w", err)
	}

	return len(records) > 0, nil
}

// GetByIDs retrieves multiple trails by their IDs
func (r *PocketBaseTrailRepository) GetByIDs(ctx context.Context, ids []string) ([]*entities.Trail, error) {
	if len(ids) == 0 {
		return []*entities.Trail{}, nil
	}

	var conditions []string
	params := make(map[string]any)
	
	for i, id := range ids {
		paramKey := fmt.Sprintf("id%d", i)
		conditions = append(conditions, fmt.Sprintf("id = {:"+paramKey+"}"))
		params[paramKey] = id
	}
	
	filter := strings.Join(conditions, " || ")

	records, err := r.app.FindRecordsByFilter("trails", filter, "-created", 0, 0, params)
	if err != nil {
		return nil, fmt.Errorf("failed to find trails by IDs: %w", err)
	}

	return r.recordsToTrails(records), nil
}

// CreateBatch creates multiple trails in a batch
func (r *PocketBaseTrailRepository) CreateBatch(ctx context.Context, trails []*entities.Trail) error {
	collection, err := r.app.FindCollectionByNameOrId("trails")
	if err != nil {
		return fmt.Errorf("failed to find trails collection: %w", err)
	}

	for _, trail := range trails {
		record := core.NewRecord(collection)
		record.Set("name", trail.Name)
		record.Set("description", trail.Description)
		record.Set("level", string(trail.Level))
		record.Set("tags", trail.Tags)
		record.Set("owner", trail.OwnerID)
		record.Set("gpx_file", trail.GPXFile)
		
		if trail.DistanceM != nil {
			record.Set("distance_m", *trail.DistanceM)
		}

		if err := r.app.Save(record); err != nil {
			return fmt.Errorf("failed to create trail in batch: %w", err)
		}

		trail.ID = record.Id
	}

	return nil
}

// recordToTrail converts a PocketBase record to a Trail entity
func (r *PocketBaseTrailRepository) recordToTrail(record *core.Record) *entities.Trail {
	trail := &entities.Trail{
		ID:          record.Id,
		Name:        record.GetString("name"),
		Description: record.GetString("description"),
		Level:       entities.TrailLevel(record.GetString("level")),
		Tags:        record.GetStringSlice("tags"),
		OwnerID:     record.GetString("owner"),
		GPXFile:     record.GetString("gpx_file"),
		CreatedAt:   record.GetDateTime("created").Time(),
		UpdatedAt:   record.GetDateTime("updated").Time(),
	}

	if distance := record.GetFloat("distance_m"); distance > 0 {
		trail.DistanceM = &distance
	}

	return trail
}

// recordsToTrails converts multiple PocketBase records to Trail entities
func (r *PocketBaseTrailRepository) recordsToTrails(records []*core.Record) []*entities.Trail {
	trails := make([]*entities.Trail, len(records))
	for i, record := range records {
		trails[i] = r.recordToTrail(record)
	}
	return trails
}