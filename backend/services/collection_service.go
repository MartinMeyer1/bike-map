package services

import (
	"fmt"
	"log"

	"bike-map-backend/config"

	"github.com/pocketbase/pocketbase/core"
)

// CollectionService handles PocketBase collection setup and configuration
type CollectionService struct {
	config      *config.Config
	authService *AuthService
}

// NewCollectionService creates a new collection service
func NewCollectionService(cfg *config.Config, authService *AuthService) *CollectionService {
	return &CollectionService{
		config:      cfg,
		authService: authService,
	}
}

// EnsureTrailsCollection creates the trails collection if it doesn't exist
func (c *CollectionService) EnsureTrailsCollection(app core.App) error {
	// Check if trails collection already exists
	trails, err := app.FindCollectionByNameOrId("trails")
	if err == nil {
		// Collection already exists
		if _, exists := trails.Fields.AsMap()["ridden"]; !exists {
			// Add the ridden field to existing collection
			trails.Fields.Add(&core.BoolField{
				Name:     "ridden",
				Required: false,
			})
			if err := app.Save(trails); err != nil {
				return fmt.Errorf("failed to add ridden field to trails collection: %w", err)
			}
			log.Println("✅ Added ridden field to existing trails collection")

			// Set all existing records to ridden=true
			records, err := app.FindAllRecords("trails")
			if err != nil {
				return fmt.Errorf("failed to query trails for migration: %w", err)
			}

			updatedCount := 0
			for _, record := range records {
				record.Set("ridden", true)
				if err := app.Save(record); err != nil {
					log.Printf("⚠️  Failed to update trail %s: %v", record.Id, err)
					continue
				}
				updatedCount++
			}
			log.Printf("✅ Migration complete: set ridden=true for %d existing trails", updatedCount)
		}
		return nil
	}

	// Create new collection
	collection := core.NewBaseCollection("trails")
	publicRule := ""
	createRule := `@request.auth.id != "" && (@request.auth.role = "Editor" || @request.auth.role = "Admin")`
	updateRule := `@request.auth.id = owner || @request.auth.role = "Admin"`
	deleteRule := `@request.auth.id = owner || @request.auth.role = "Admin"`

	collection.ListRule = &publicRule // Allow public read access
	collection.ViewRule = &publicRule // Allow public read access
	collection.CreateRule = &createRule
	collection.UpdateRule = &updateRule
	collection.DeleteRule = &deleteRule

	// Define schema fields
	collection.Fields.Add(&core.AutodateField{
		Name:     "created",
		OnCreate: true,
	})
	collection.Fields.Add(&core.AutodateField{
		Name:     "updated",
		OnUpdate: true,
	})
	collection.Fields.Add(&core.TextField{
		Name:     "name",
		Required: true,
	})
	collection.Fields.Add(&core.TextField{
		Name:     "description",
		Required: false,
	})
	collection.Fields.Add(&core.SelectField{
		Name:      "level",
		Values:    []string{"S0", "S1", "S2", "S3", "S4", "S5"},
		MaxSelect: 1,
		Required:  true,
	})
	collection.Fields.Add(&core.JSONField{
		Name:     "tags",
		MaxSize:  1000,
		Required: false,
	})
	collection.Fields.Add(&core.FileField{
		Name:      "file",
		MaxSelect: 1,
		MaxSize:   5485760, // 5MB
		MimeTypes: []string{"application/gpx+xml", "application/xml", "text/xml"},
		Required:  true,
	})
	collection.Fields.Add(&core.RelationField{
		Name:         "owner",
		CollectionId: "_pb_users_auth_",
		MaxSelect:    1,
		Required:     true,
	})
	collection.Fields.Add(&core.BoolField{
		Name:     "ridden",
		Required: false,
	})

	// Save collection
	if err := app.Save(collection); err != nil {
		return fmt.Errorf("failed to create trails collection: %w", err)
	}

	log.Println("✅ Created trails collection successfully")
	return nil
}

// ConfigureUsersCollection configures the users collection for OAuth and roles
func (c *CollectionService) ConfigureUsersCollection(app core.App) error {
	// Get the existing users collection
	usersCollection, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return fmt.Errorf("failed to find users collection: %w", err)
	}

	// Configure access rules for users collection
	// Allow public read access to user records (fields are filtered by the API query)
	viewRule := ""
	// Allow OAuth users to be created automatically, admins can also create users
	createRule := ""
	// Users can update their own records but cannot change their role.
	updateRule := `@request.auth.id = id || @request.auth.role = "Admin"`
	// Users can delete their own records
	deleteRule := `@request.auth.id = id`
	// List is restricted to authenticated users only
	listRule := `@request.auth.id != ""`

	usersCollection.ViewRule = &viewRule
	usersCollection.CreateRule = &createRule
	usersCollection.UpdateRule = &updateRule
	usersCollection.DeleteRule = &deleteRule
	usersCollection.ListRule = &listRule

	// Add role field to users collection if it doesn't exist
	roleFieldExists := false
	for _, field := range usersCollection.Fields {
		if field.GetName() == "role" {
			roleFieldExists = true
			break
		}
	}

	if !roleFieldExists {
		// Add role field with default value "Viewer"
		roleField := &core.SelectField{
			Name:      "role",
			Values:    []string{"Viewer", "Editor", "Admin"},
			MaxSelect: 1,
			Required:  false, // So empty is allowed, will be replaced by Viewer anyway
		}
		usersCollection.Fields.Add(roleField)
	}

	// Save the updated collection
	if err := app.Save(usersCollection); err != nil {
		return fmt.Errorf("failed to configure users collection: %w", err)
	}

	log.Println("✅ Configured users collection for OAuth-only authentication")
	return nil
}

// ConfigureGoogleOAuth sets up Google OAuth provider
func (c *CollectionService) ConfigureGoogleOAuth(app core.App) error {
	// Check if OAuth credentials are available
	if c.config.OAuth.Google.ClientID == "" || c.config.OAuth.Google.ClientSecret == "" {
		log.Println("⚠️  Google OAuth credentials not found in environment variables")
		return nil // Don't fail startup, just log warning
	}

	// Get the users collection
	usersCollection, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return fmt.Errorf("failed to find users collection: %w", err)
	}

	// Configure OAuth2 settings
	usersCollection.OAuth2.Enabled = true
	usersCollection.OAuth2.Providers = []core.OAuth2ProviderConfig{
		{
			Name:         "google",
			ClientId:     c.config.OAuth.Google.ClientID,
			ClientSecret: c.config.OAuth.Google.ClientSecret,
			DisplayName:  "Google",
		},
	}

	// Configure field mappings
	usersCollection.OAuth2.MappedFields = core.OAuth2KnownFields{
		Name:      "name",
		Username:  "email",
		AvatarURL: "picture",
	}

	// Disable other login methods
	usersCollection.PasswordAuth.Enabled = false

	// Save the collection
	if err := app.Save(usersCollection); err != nil {
		return fmt.Errorf("failed to save OAuth2 configuration: %w", err)
	}

	log.Println("✅ Configured Google OAuth provider")
	return nil
}

// EnsureAdminAccount creates or updates the admin account
func (c *CollectionService) EnsureAdminAccount(app core.App) error {
	// Check if admin credentials are available
	if c.config.Admin.Email == "" || c.config.Admin.Password == "" {
		log.Println("⚠️  Admin credentials not found in environment variables - skipping admin account creation")
		return nil // Don't fail startup, just log warning
	}

	// Get superusers collection
	superusersCol, err := app.FindCachedCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		return fmt.Errorf("failed to fetch superusers collection: %w", err)
	}

	// Check if admin already exists
	superuser, err := app.FindAuthRecordByEmail(superusersCol, c.config.Admin.Email)
	if err != nil {
		// Create new superuser if not found
		superuser = core.NewRecord(superusersCol)
		log.Printf("Creating new admin user: %s", c.config.Admin.Email)
	} else {
		log.Printf("Admin user already exists, updating password: %s", c.config.Admin.Email)
	}

	// Set credentials
	superuser.SetEmail(c.config.Admin.Email)
	superuser.SetPassword(c.config.Admin.Password)

	// Save the superuser
	if err := app.Save(superuser); err != nil {
		return fmt.Errorf("failed to save admin user: %w", err)
	}

	log.Printf("✅ Successfully created/updated admin account: %s", c.config.Admin.Email)
	return nil
}

// EnsureTrailRatingsCollection creates the trail_ratings collection if it doesn't exist
func (c *CollectionService) EnsureTrailRatingsCollection(app core.App) error {
	// Check if trail_ratings collection already exists
	_, err := app.FindCollectionByNameOrId("trail_ratings")
	if err == nil {
		// Collection already exists
		return nil
	}

	// Get the trails collection to reference it
	trailsCollection, err := app.FindCollectionByNameOrId("trails")
	if err != nil {
		return fmt.Errorf("trails collection not found: %w", err)
	}

	// Create new collection
	collection := core.NewBaseCollection("trail_ratings")

	// Access rules - Viewers+ can read, create, update their own; Admins can delete any
	publicRule := ""
	createRule := `@request.auth.id != "" && @request.auth.role != "" && (@request.auth.role = "Viewer" || @request.auth.role = "Editor" || @request.auth.role = "Admin")`
	updateRule := `@request.auth.id = user || @request.auth.role = "Admin"`
	deleteRule := `@request.auth.role = "Admin"`

	collection.ListRule = &publicRule   // Allow public read access
	collection.ViewRule = &publicRule   // Allow public read access
	collection.CreateRule = &createRule // Viewers+ can create
	collection.UpdateRule = &updateRule // Users can update their own ratings
	collection.DeleteRule = &deleteRule // Only Admins can delete

	// Define schema fields
	collection.Fields.Add(&core.AutodateField{
		Name:     "created",
		OnCreate: true,
	})
	collection.Fields.Add(&core.AutodateField{
		Name:     "updated",
		OnUpdate: true,
	})

	// Reference to trail
	collection.Fields.Add(&core.RelationField{
		Name:         "trail",
		CollectionId: trailsCollection.Id,
		MaxSelect:    1,
		Required:     true,
		CascadeDelete: true,
	})

	// Reference to user who created the rating
	collection.Fields.Add(&core.RelationField{
		Name:         "user",
		CollectionId: "_pb_users_auth_",
		MaxSelect:    1,
		Required:     true,
	})

	// Rating value (1-5 stars)
	collection.Fields.Add(&core.NumberField{
		Name:     "rating",
		Min:      float64Ptr(1),
		Max:      float64Ptr(5),
		Required: true,
	})

	// Add unique constraint index to prevent duplicate ratings per user per trail
	collection.AddIndex("idx_unique_trail_user_rating", true, "trail,user", "")

	// Save collection
	if err := app.Save(collection); err != nil {
		return fmt.Errorf("failed to create trail_ratings collection: %w", err)
	}

	log.Println("✅ Created trail_ratings collection successfully")
	return nil
}

// EnsureTrailCommentsCollection creates the trail_comments collection if it doesn't exist
func (c *CollectionService) EnsureTrailCommentsCollection(app core.App) error {
	// Check if trail_comments collection already exists
	_, err := app.FindCollectionByNameOrId("trail_comments")
	if err == nil {
		// Collection already exists
		return nil
	}

	// Get the trails collection to reference it
	trailsCollection, err := app.FindCollectionByNameOrId("trails")
	if err != nil {
		return fmt.Errorf("trails collection not found: %w", err)
	}

	// Create new collection
	collection := core.NewBaseCollection("trail_comments")

	// Access rules - Viewers+ can read, create, update their own; Admins can delete any
	publicRule := ""
	createRule := `@request.auth.id != "" && @request.auth.role != "" && (@request.auth.role = "Viewer" || @request.auth.role = "Editor" || @request.auth.role = "Admin")`
	updateRule := `@request.auth.id = user || @request.auth.role = "Admin"`
	deleteRule := `@request.auth.id = user || @request.auth.role = "Admin"`

	collection.ListRule = &publicRule   // Allow public read access
	collection.ViewRule = &publicRule   // Allow public read access
	collection.CreateRule = &createRule // Viewers+ can create
	collection.UpdateRule = &updateRule // Users can update their own comments
	collection.DeleteRule = &deleteRule // Users can delete their own, Admins can delete any

	// Define schema fields
	collection.Fields.Add(&core.AutodateField{
		Name:     "created",
		OnCreate: true,
	})
	collection.Fields.Add(&core.AutodateField{
		Name:     "updated",
		OnUpdate: true,
	})

	// Reference to trail
	collection.Fields.Add(&core.RelationField{
		Name:         "trail",
		CollectionId: trailsCollection.Id,
		MaxSelect:    1,
		Required:     true,
		CascadeDelete: true,
	})

	// Reference to user who created the comment
	collection.Fields.Add(&core.RelationField{
		Name:         "user",
		CollectionId: "_pb_users_auth_",
		MaxSelect:    1,
		Required:     true,
	})

	// Comment text
	collection.Fields.Add(&core.TextField{
		Name:     "comment",
		Max:      1000,
		Required: true,
	})

	// Save collection
	if err := app.Save(collection); err != nil {
		return fmt.Errorf("failed to create trail_comments collection: %w", err)
	}

	log.Println("✅ Created trail_comments collection successfully")
	return nil
}

// EnsureRatingAverageCollection creates the rating_average collection if it doesn't exist
func (c *CollectionService) EnsureRatingAverageCollection(app core.App) error {
	// Check if rating_average collection already exists
	_, err := app.FindCollectionByNameOrId("rating_average")
	if err == nil {
		// Collection already exists
		return nil
	}

	// Get the trails collection to reference it
	trailsCollection, err := app.FindCollectionByNameOrId("trails")
	if err != nil {
		return fmt.Errorf("trails collection not found: %w", err)
	}

	// Create new collection
	collection := core.NewBaseCollection("rating_average")

	// Access rules - Public read access, only system/admin can write
	publicRule := ""
	adminOnlyRule := `@request.auth.role = "Admin"`

	collection.ListRule = &publicRule      // Allow public read access
	collection.ViewRule = &publicRule      // Allow public read access
	collection.CreateRule = &adminOnlyRule // Only admins can create (system will handle this)
	collection.UpdateRule = &adminOnlyRule // Only admins can update (system will handle this)
	collection.DeleteRule = &adminOnlyRule // Only admins can delete

	// Define schema fields
	collection.Fields.Add(&core.AutodateField{
		Name:     "created",
		OnCreate: true,
	})
	collection.Fields.Add(&core.AutodateField{
		Name:     "updated",
		OnUpdate: true,
	})

	// Reference to trail (unique constraint)
	collection.Fields.Add(&core.RelationField{
		Name:          "trail",
		CollectionId:  trailsCollection.Id,
		MaxSelect:     1,
		Required:      true,
		CascadeDelete: true,
	})

	// Average rating (0.0 to 5.0)
	collection.Fields.Add(&core.NumberField{
		Name:     "average",
		Min:      float64Ptr(0),
		Max:      float64Ptr(5),
		Required: true,
	})

	// Count of ratings
	collection.Fields.Add(&core.NumberField{
		Name:     "count",
		Min:      float64Ptr(0),
		Required: true,
	})

	// Add unique constraint index to ensure one record per trail
	collection.AddIndex("idx_unique_trail_rating_average", true, "trail", "")

	// Save collection
	if err := app.Save(collection); err != nil {
		return fmt.Errorf("failed to create rating_average collection: %w", err)
	}

	log.Println("✅ Created rating_average collection successfully")
	return nil
}

// Helper function to create float64 pointer
func float64Ptr(f float64) *float64 {
	return &f
}
