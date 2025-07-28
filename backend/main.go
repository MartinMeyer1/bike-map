package main

import (
	"fmt"
	"log"
	"os"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/models/settings"
)

func main() {
	app := pocketbase.New()

	// Create trails collection and configure users collection on startup
	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		if err := ensureTrailsCollection(app); err != nil {
			return err
		}
		if err := configureUsersCollection(app); err != nil {
			return err
		}
		if err := configureGoogleOAuth(app); err != nil {
			return err
		}
		return ensureAdminAccount(app)
	})

	// Set default role for new OAuth users
	app.OnRecordAfterCreateRequest("users").Add(func(e *core.RecordCreateEvent) error {
		// Set default role to "Viewer" for new users
		if e.Record.GetString("role") == "" {
			e.Record.Set("role", "Viewer")
			return app.Dao().SaveRecord(e.Record)
		}
		return nil
	})

	// Ensure only Editor or Admin users can create trails
	app.OnRecordBeforeCreateRequest("trails").Add(func(e *core.RecordCreateEvent) error {
		admin, _ := e.HttpContext.Get(apis.ContextAdminKey).(*models.Admin)
		record, _ := e.HttpContext.Get(apis.ContextAuthRecordKey).(*models.Record)
		
		if admin != nil {
			return nil // Allow admin to set any owner
		}
		
		if record == nil {
			return apis.NewForbiddenError("Authentication required", nil)
		}
		
		// Check if user has Editor or Admin role
		userRole := record.GetString("role")
		if userRole != "Editor" && userRole != "Admin" {
			return apis.NewForbiddenError("Only users with Editor or Admin role can create trails", nil)
		}
		
		return nil
	})

	// Add CORS middleware for frontend integration
	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		e.Router.Use(apis.ActivityLogger(app))
		
		// Add CORS headers
		e.Router.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
			return func(c echo.Context) error {
				c.Response().Header().Set("Access-Control-Allow-Origin", "*")
				c.Response().Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				c.Response().Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
				
				if c.Request().Method == "OPTIONS" {
					return c.NoContent(204)
				}
				
				return next(c)
			}
		})
		
		return nil
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func ensureTrailsCollection(app *pocketbase.PocketBase) error {
	// Check if trails collection already exists
	_, err := app.Dao().FindCollectionByNameOrId("trails")
	if err == nil {
		// Collection already exists
		return nil
	}

	// Create new collection
	collection := &models.Collection{}
	collection.Name = "trails"
	collection.Type = models.CollectionTypeBase
	publicRule := ""
	createRule := "@request.auth.id != \"\" && (@request.auth.role = \"Editor\" || @request.auth.role = \"Admin\")"
	updateRule := "@request.auth.id = owner || @request.auth.role = \"Admin\""
	deleteRule := "@request.auth.id = owner || @request.auth.role = \"Admin\""
	
	collection.ListRule = &publicRule  // Allow public read access
	collection.ViewRule = &publicRule  // Allow public read access
	collection.CreateRule = &createRule
	collection.UpdateRule = &updateRule
	collection.DeleteRule = &deleteRule

	// Define schema fields - simplified, no processed elevation data
	collection.Schema = schema.NewSchema(
		&schema.SchemaField{
			Name:     "name",
			Type:     schema.FieldTypeText,
			Required: true,
		},
		&schema.SchemaField{
			Name:     "description",
			Type:     schema.FieldTypeText,
			Required: false,
		},
		&schema.SchemaField{
			Name: "level",
			Type: schema.FieldTypeSelect,
			Options: &schema.SelectOptions{
				MaxSelect: 1,
				Values:    []string{"S0", "S1", "S2", "S3", "S4", "S5"},
			},
			Required: true,
		},
		&schema.SchemaField{
			Name:     "tags",
			Type:     schema.FieldTypeJson,
			Options:  &schema.JsonOptions{MaxSize: 1000},
			Required: false,
		},
		&schema.SchemaField{
			Name:     "file",
			Type:     schema.FieldTypeFile,
			Options:  &schema.FileOptions{
				MaxSelect: 1,
				MaxSize:   5485760,
				MimeTypes: []string{"application/gpx+xml", "application/xml", "text/xml"},
			},
			Required: true,
		},
		&schema.SchemaField{
			Name: "owner",
			Type: schema.FieldTypeRelation,
			Options: &schema.RelationOptions{
				CollectionId: "_pb_users_auth_",
				MaxSelect:    &[]int{1}[0],
			},
			Required: true,
		},
	)

	// Save collection
	if err := app.Dao().SaveCollection(collection); err != nil {
		return fmt.Errorf("failed to create trails collection: %w", err)
	}

	log.Println("✅ Created trails collection successfully")
	return nil
}

func configureUsersCollection(app *pocketbase.PocketBase) error {
	// Get the existing users collection
	usersCollection, err := app.Dao().FindCollectionByNameOrId("users")
	if err != nil {
		return fmt.Errorf("failed to find users collection: %w", err)
	}

	// Configure access rules for users collection  
	// Allow public read access to user records (fields are filtered by the API query)
	viewRule := ""
	// Allow OAuth users to be created automatically, admins can also create users
	createRule := ""
	// Users can update their own records but cannot change their role
	updateRule := "@request.auth.id = id && @request.data.role:isset = false"
	// Users can delete their own records
	deleteRule := "@request.auth.id = id"
	// List is restricted to authenticated users only
	listRule := "@request.auth.id != \"\""

	usersCollection.ViewRule = &viewRule
	usersCollection.CreateRule = &createRule
	usersCollection.UpdateRule = &updateRule
	usersCollection.DeleteRule = &deleteRule
	usersCollection.ListRule = &listRule

	// Add role field to users collection if it doesn't exist
	roleFieldExists := false
	for _, field := range usersCollection.Schema.Fields() {
		if field.Name == "role" {
			roleFieldExists = true
			break
		}
	}
	
	if !roleFieldExists {
		// Add role field with default value "Viewer"
		roleField := &schema.SchemaField{
			Name: "role",
			Type: schema.FieldTypeSelect,
			Options: &schema.SelectOptions{
				MaxSelect: 1,
				Values:    []string{"Viewer", "Editor", "Admin"},
			},
			Required: false, //So empty is allowed, will be replaced by Viewer anyway
		}
		usersCollection.Schema.AddField(roleField)
	}

	// Get current authentication options
	currentAuthOptions := usersCollection.AuthOptions()
	
	// Create new auth options based on current ones
	newAuthOptions := &models.CollectionAuthOptions{
		ManageRule:         currentAuthOptions.ManageRule,
		AllowOAuth2Auth:    true,  // Enable OAuth2
		AllowUsernameAuth:  false, // Disable username auth
		AllowEmailAuth:     false, // Disable email auth
		RequireEmail:       currentAuthOptions.RequireEmail,
		ExceptEmailDomains: currentAuthOptions.ExceptEmailDomains,
		OnlyVerified:       currentAuthOptions.OnlyVerified,
		OnlyEmailDomains:   currentAuthOptions.OnlyEmailDomains,
		MinPasswordLength:  currentAuthOptions.MinPasswordLength,
	}
	
	// Apply the new authentication options to the collection
	usersCollection.SetOptions(newAuthOptions)

	// Save the updated collection
	if err := app.Dao().SaveCollection(usersCollection); err != nil {
		return fmt.Errorf("failed to configure users collection: %w", err)
	}

	log.Println("✅ Configured users collection for OAuth-only authentication")
	return nil
}

func configureGoogleOAuth(app *pocketbase.PocketBase) error {
	// Get Google OAuth credentials from environment variables
	clientId := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	
	if clientId == "" || clientSecret == "" {
		log.Println("⚠️  Google OAuth credentials not found in environment variables")
		return nil // Don't fail startup, just log warning
	}
	
	// Get current app settings
	appSettings, err := app.Settings().Clone()
	if err != nil {
		return fmt.Errorf("failed to get app settings: %w", err)
	}
	
	// Configure Google OAuth provider
	googleProvider := &settings.AuthProviderConfig{
		Enabled:      true,
		ClientId:     clientId,
		ClientSecret: clientSecret,
	}
	
	// Set the Google OAuth provider in settings
	appSettings.GoogleAuth = *googleProvider
	
	// Save the updated settings
	if err := app.Settings().Merge(appSettings); err != nil {
		return fmt.Errorf("failed to update Google OAuth settings: %w", err)
	}
	
	log.Println("✅ Configured Google OAuth provider")
	return nil
}

func ensureAdminAccount(app *pocketbase.PocketBase) error {
	// Get admin credentials from environment variables
	adminEmail := os.Getenv("ADMIN_EMAIL")
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	
	if adminEmail == "" || adminPassword == "" {
		log.Println("⚠️  Admin credentials not found in environment variables - skipping admin account creation")
		return nil // Don't fail startup, just log warning
	}
	
	// Check if admin already exists
	_, err := app.Dao().FindAdminByEmail(adminEmail)
	if err == nil {
		log.Println("✅ Admin account already exists")
		return nil // Admin already exists
	}
	
	// Create new admin account
	admin := &models.Admin{}
	admin.Email = adminEmail
	admin.SetPassword(adminPassword)
	
	if err := app.Dao().SaveAdmin(admin); err != nil {
		return fmt.Errorf("failed to create admin account: %w", err)
	}
	
	log.Printf("✅ Created admin account: %s", adminEmail)
	return nil
}