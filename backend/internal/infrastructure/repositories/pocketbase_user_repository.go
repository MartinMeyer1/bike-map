package repositories

import (
	"context"
	"fmt"
	"strings"

	"bike-map-backend/internal/domain/entities"
	"bike-map-backend/internal/domain/repositories"
	
	"github.com/pocketbase/pocketbase/core"
)

// PocketBaseUserRepository implements UserRepository using PocketBase
type PocketBaseUserRepository struct {
	app core.App
}

// NewPocketBaseUserRepository creates a new PocketBase user repository
func NewPocketBaseUserRepository(app core.App) repositories.UserRepository {
	return &PocketBaseUserRepository{
		app: app,
	}
}

// Create creates a new user in PocketBase
func (r *PocketBaseUserRepository) Create(ctx context.Context, user *entities.User) error {
	collection, err := r.app.FindCollectionByNameOrId("users")
	if err != nil {
		return fmt.Errorf("failed to find users collection: %w", err)
	}

	record := core.NewRecord(collection)
	record.Set("email", user.Email)
	record.Set("name", user.Name)
	record.Set("avatar", user.Avatar)
	record.Set("role", string(user.Role))
	record.Set("verified", user.Verified)

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to create user: %w", err)
	}

	user.ID = record.Id
	return nil
}

// GetByID retrieves a user by their ID
func (r *PocketBaseUserRepository) GetByID(ctx context.Context, id string) (*entities.User, error) {
	record, err := r.app.FindRecordById("users", id)
	if err != nil {
		return nil, fmt.Errorf("failed to find user by ID: %w", err)
	}

	return r.recordToUser(record), nil
}

// Update updates a user in PocketBase
func (r *PocketBaseUserRepository) Update(ctx context.Context, user *entities.User) error {
	record, err := r.app.FindRecordById("users", user.ID)
	if err != nil {
		return fmt.Errorf("failed to find user for update: %w", err)
	}

	record.Set("email", user.Email)
	record.Set("name", user.Name)
	record.Set("avatar", user.Avatar)
	record.Set("role", string(user.Role))
	record.Set("verified", user.Verified)

	if err := r.app.Save(record); err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	return nil
}

// Delete deletes a user from PocketBase
func (r *PocketBaseUserRepository) Delete(ctx context.Context, id string) error {
	record, err := r.app.FindRecordById("users", id)
	if err != nil {
		return fmt.Errorf("failed to find user for deletion: %w", err)
	}

	if err := r.app.Delete(record); err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	return nil
}

// GetByEmail retrieves a user by their email address
func (r *PocketBaseUserRepository) GetByEmail(ctx context.Context, email string) (*entities.User, error) {
	records, err := r.app.FindRecordsByFilter(
		"users",
		"email = {:email}",
		"",
		1,
		0,
		map[string]any{"email": email},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find user by email: %w", err)
	}

	if len(records) == 0 {
		return nil, fmt.Errorf("user not found with email: %s", email)
	}

	return r.recordToUser(records[0]), nil
}

// GetByRole retrieves users by their role
func (r *PocketBaseUserRepository) GetByRole(ctx context.Context, role entities.UserRole) ([]*entities.User, error) {
	records, err := r.app.FindRecordsByFilter(
		"users",
		"role = {:role}",
		"-created",
		0,
		0,
		map[string]any{"role": string(role)},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find users by role: %w", err)
	}

	return r.recordsToUsers(records), nil
}

// GetVerified retrieves verified users with pagination
func (r *PocketBaseUserRepository) GetVerified(ctx context.Context, limit, offset int) ([]*entities.User, error) {
	records, err := r.app.FindRecordsByFilter(
		"users",
		"verified = true",
		"-created",
		limit,
		offset,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find verified users: %w", err)
	}

	return r.recordsToUsers(records), nil
}

// GetUnverified retrieves unverified users with pagination
func (r *PocketBaseUserRepository) GetUnverified(ctx context.Context, limit, offset int) ([]*entities.User, error) {
	records, err := r.app.FindRecordsByFilter(
		"users",
		"verified = false",
		"-created",
		limit,
		offset,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to find unverified users: %w", err)
	}

	return r.recordsToUsers(records), nil
}

// Search searches users by name or email
func (r *PocketBaseUserRepository) Search(ctx context.Context, query string) ([]*entities.User, error) {
	records, err := r.app.FindRecordsByFilter(
		"users",
		"name ~ {:query} || email ~ {:query}",
		"-created",
		0,
		0,
		map[string]any{"query": query},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to search users: %w", err)
	}

	return r.recordsToUsers(records), nil
}

// List retrieves users with pagination
func (r *PocketBaseUserRepository) List(ctx context.Context, limit, offset int) ([]*entities.User, error) {
	records, err := r.app.FindRecordsByFilter(
		"users",
		"",
		"-created",
		limit,
		offset,
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list users: %w", err)
	}

	return r.recordsToUsers(records), nil
}

// Exists checks if a user exists by ID
func (r *PocketBaseUserRepository) Exists(ctx context.Context, id string) (bool, error) {
	_, err := r.app.FindRecordById("users", id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			return false, nil
		}
		return false, fmt.Errorf("failed to check user existence: %w", err)
	}
	return true, nil
}

// ExistsByEmail checks if a user with the given email exists
func (r *PocketBaseUserRepository) ExistsByEmail(ctx context.Context, email string) (bool, error) {
	records, err := r.app.FindRecordsByFilter(
		"users",
		"email = {:email}",
		"",
		1,
		0,
		map[string]any{"email": email},
	)
	if err != nil {
		return false, fmt.Errorf("failed to check user email existence: %w", err)
	}

	return len(records) > 0, nil
}

// GetUserCount returns the total number of users
func (r *PocketBaseUserRepository) GetUserCount(ctx context.Context) (int, error) {
	records, err := r.app.FindRecordsByFilter(
		"users",
		"",
		"",
		0,
		0,
		nil,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to count users: %w", err)
	}

	return len(records), nil
}

// GetUserCountByRole returns the number of users with a specific role
func (r *PocketBaseUserRepository) GetUserCountByRole(ctx context.Context, role entities.UserRole) (int, error) {
	records, err := r.app.FindRecordsByFilter(
		"users",
		"role = {:role}",
		"",
		0,
		0,
		map[string]any{"role": string(role)},
	)
	if err != nil {
		return 0, fmt.Errorf("failed to count users by role: %w", err)
	}

	return len(records), nil
}

// GetVerifiedUserCount returns the number of verified users
func (r *PocketBaseUserRepository) GetVerifiedUserCount(ctx context.Context) (int, error) {
	records, err := r.app.FindRecordsByFilter(
		"users",
		"verified = true",
		"",
		0,
		0,
		nil,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to count verified users: %w", err)
	}

	return len(records), nil
}

// GetByIDs retrieves multiple users by their IDs
func (r *PocketBaseUserRepository) GetByIDs(ctx context.Context, ids []string) ([]*entities.User, error) {
	if len(ids) == 0 {
		return []*entities.User{}, nil
	}

	var conditions []string
	params := make(map[string]any)
	
	for i, id := range ids {
		paramKey := fmt.Sprintf("id%d", i)
		conditions = append(conditions, fmt.Sprintf("id = {:"+paramKey+"}"))
		params[paramKey] = id
	}
	
	filter := strings.Join(conditions, " || ")

	records, err := r.app.FindRecordsByFilter("users", filter, "-created", 0, 0, params)
	if err != nil {
		return nil, fmt.Errorf("failed to find users by IDs: %w", err)
	}

	return r.recordsToUsers(records), nil
}

// recordToUser converts a PocketBase record to a User entity
func (r *PocketBaseUserRepository) recordToUser(record *core.Record) *entities.User {
	return &entities.User{
		ID:       record.Id,
		Email:    record.GetString("email"),
		Name:     record.GetString("name"),
		Avatar:   record.GetString("avatar"),
		Role:     entities.UserRole(record.GetString("role")),
		Created:  record.GetDateTime("created").Time(),
		Updated:  record.GetDateTime("updated").Time(),
		Verified: record.GetBool("verified"),
	}
}

// recordsToUsers converts multiple PocketBase records to User entities
func (r *PocketBaseUserRepository) recordsToUsers(records []*core.Record) []*entities.User {
	users := make([]*entities.User, len(records))
	for i, record := range records {
		users[i] = r.recordToUser(record)
	}
	return users
}