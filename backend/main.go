package main

import (
	"fmt"
	"log"
	"os"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/golang-jwt/jwt/v5"
)

// Global MVT service for cache invalidation
var globalMVTService *MVTService

func main() {
	app := pocketbase.New()

	// Ensure only Editor or Admin users can create trails
	app.OnRecordCreateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
		if e.Collection.Name == "users" {
			// Set default role to "Viewer" for new users
			e.Record.Set("role", "Viewer")
			// Don't call app.Save here - let the normal flow handle it
		}
		if e.Collection.Name == "trails" {
			// ignore for superusers
			if e.HasSuperuserAuth(){
				return e.Next()
			}

			reqInfo, _ := e.RequestInfo()
			
			// Check if authenticated user exists
			if reqInfo.Auth == nil {
				return apis.NewForbiddenError("Authentication required", nil)
			}
			
			// Check if user has Editor or Admin role
			userRole := reqInfo.Auth.GetString("role")
			if userRole != "Editor" && userRole != "Admin" {
				return apis.NewForbiddenError("Only users with Editor or Admin role can create trails", nil)
			}
		}
		
		return e.Next()
	})

	// Ensure not Admin user can't update their own roles
	app.OnRecordUpdateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
		if e.Collection.Name == "users" {
			// ignore for superusers
			if e.HasSuperuserAuth(){
				return e.Next()
			}

			reqInfo, err := e.RequestInfo()
			if err != nil{
				return err
			}

			// Get the current record from the DB
			origRecord := e.Record.Original()

			// Check if the "role" field is being changed
			oldRole := origRecord.GetString("role")
			newRole := e.Record.GetString("role")

			if oldRole != newRole {
				// Check if the current user is an admin
				if reqInfo.Auth.GetString("role") != "Admin" {
					return apis.NewForbiddenError("You are not allowed to change your own role.", nil)
				}
			}
			return e.Next()
		}
		return e.Next()
	})

	app.OnRecordAfterCreateSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trails" {
			// Sync to PostGIS after trail is created (in goroutine to avoid blocking)
			go func() {
				// Give some time for the record to be fully committed
				gpxImporter, err := NewGPXImporter(GetDefaultPostGISConfig())
				if err != nil {
					log.Printf("Failed to initialize GPX importer for sync: %v", err)
					return
				}
				defer gpxImporter.Close()

				if err := gpxImporter.ImportTrailFromPocketBase(app, e.Record.Id); err != nil {
					log.Printf("Failed to sync trail %s to PostGIS: %v", e.Record.Id, err)
				} else {
					log.Printf("Successfully synced trail %s to PostGIS", e.Record.GetString("name"))
					
					// Invalidate MVT cache after successful sync
					if globalMVTService != nil {
						globalMVTService.InvalidateCache()
						log.Printf("MVT cache invalidated after trail creation")
					}
				}
			}()
		}
		return e.Next()
	})

	app.OnRecordAfterUpdateSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trails" {
			// Sync to PostGIS after trail is updated
			go func() {
				gpxImporter, err := NewGPXImporter(GetDefaultPostGISConfig())
				if err != nil {
					log.Printf("Failed to initialize GPX importer for sync: %v", err)
					return
				}
				defer gpxImporter.Close()

				if err := gpxImporter.ImportTrailFromPocketBase(app, e.Record.Id); err != nil {
					log.Printf("Failed to sync updated trail %s to PostGIS: %v", e.Record.Id, err)
				} else {
					log.Printf("Successfully synced updated trail %s to PostGIS", e.Record.GetString("name"))
					
					// Invalidate MVT cache after successful sync
					if globalMVTService != nil {
						globalMVTService.InvalidateCache()
						log.Printf("MVT cache invalidated after trail update")
					}
				}
			}()
		}
		return e.Next()
	})

	app.OnRecordAfterDeleteSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trails" {
			// Remove trail from PostGIS when deleted from PocketBase
			go func() {
				gpxImporter, err := NewGPXImporter(GetDefaultPostGISConfig())
				if err != nil {
					log.Printf("Failed to initialize GPX importer for delete sync: %v", err)
					return
				}
				defer gpxImporter.Close()

				if err := gpxImporter.DeleteTrailFromPostGIS(e.Record.Id); err != nil {
					log.Printf("Failed to delete trail %s from PostGIS: %v", e.Record.Id, err)
				} else {
					log.Printf("Successfully deleted trail %s from PostGIS", e.Record.GetString("name"))
					
					// Invalidate MVT cache after successful deletion
					if globalMVTService != nil {
						globalMVTService.InvalidateCache()
						log.Printf("MVT cache invalidated after trail deletion")
					}
				}
			}()
		}
		return e.Next()
	})

	// Add CORS middleware for frontend integration
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {

		// Create default collections and base setup
		if err := ensureTrailsCollection(app); err != nil {
			return err
		}
		if err := configureUsersCollection(app); err != nil {
			return err
		}
		if err := configureGoogleOAuth(app); err != nil {
			return err
		}
		if err := ensureAdminAccount(app); err != nil {
			return err
		}

		// Initialize MVT service
		mvtService, err := NewMVTService(GetDefaultPostGISConfig())
		if err != nil {
			log.Printf("⚠️  Failed to initialize MVT service: %v", err)
			log.Printf("MVT endpoints will not be available")
		} else {
			log.Println("✅ MVT service initialized successfully")
			globalMVTService = mvtService // Set global reference for cache invalidation
			SetupMVTRoutes(e, mvtService)
		}

		// Sync all trails to PostGIS at startup
		log.Println("🔄 Starting initial sync of all trails to PostGIS...")
		go func() {
			gpxImporter, err := NewGPXImporter(GetDefaultPostGISConfig())
			if err != nil {
				log.Printf("⚠️  Failed to initialize GPX importer for startup sync: %v", err)
				return
			}
			defer gpxImporter.Close()

			if err := gpxImporter.SyncAllTrails(app); err != nil {
				log.Printf("⚠️  Failed to sync trails at startup: %v", err)
			} else {
				log.Println("✅ Successfully synced all trails to PostGIS at startup")
				
				// Invalidate MVT cache after startup sync
				if globalMVTService != nil {
					globalMVTService.InvalidateCache()
					log.Printf("MVT cache invalidated after startup sync")
				}
			}
		}()

		// Add ForwardAuth validation endpoint
		e.Router.GET("/api/auth/validate", func(e *core.RequestEvent) error {
			// Get Authorization header
			authHeader := e.Request.Header.Get("Authorization")
			if authHeader == "" {
				e.Response.WriteHeader(401)
				return nil
			}

			// Extract Bearer token
			if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
				e.Response.WriteHeader(401)
				return nil
			}
			tokenString := authHeader[7:]

			// Validate JWT token's signature
			_, err := app.FindAuthRecordByToken(tokenString)
			if err != nil {
				e.Response.WriteHeader(401)
				return nil
			}

			// Parse the JWT token without verifying the signature (using ParseUnverified)
			token, _, err := jwt.NewParser().ParseUnverified(tokenString, jwt.MapClaims{})
			if err != nil {
				e.Response.WriteHeader(401)
				return nil
			}
		
			// Extract the user ID from the token claims
			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				e.Response.WriteHeader(401)
				return nil
			}
		
			// Get user id from the claim (ensure your JWT contains the "id" field)
			userId, ok := claims["id"].(string)
			log.Println("User ID from token:", userId)
			if !ok || userId == "" {
				e.Response.WriteHeader(401)
				return nil
			}

			// Get the user from user id (look in users collection)
			user, err := app.FindRecordById("users", userId)
			if err != nil {
				e.Response.WriteHeader(401)
				return nil
			}

			// Check user role
			userRole := user.GetString("role")
			if userRole != "Editor" && userRole != "Admin" {
				e.Response.WriteHeader(401)
				return nil
			}

			// User is authorized
			e.Response.WriteHeader(200)
			return nil
		})

		// Add custom CORS handling
		e.Router.GET("/*", func(e *core.RequestEvent) error {
			e.Response.Header().Set("Access-Control-Allow-Origin", "*")
			e.Response.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			e.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			return e.Next()
		})
		
		return e.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

func ensureTrailsCollection(app core.App) error {
	// Check if trails collection already exists
	_, err := app.FindCollectionByNameOrId("trails")
	if err == nil {
		// Collection already exists
		return nil
	}

	// Create new collection
	collection := core.NewBaseCollection("trails")
	publicRule := ""
	createRule := "@request.auth.id != \"\" && (@request.auth.role = \"Editor\" || @request.auth.role = \"Admin\")"
	updateRule := "@request.auth.id = owner || @request.auth.role = \"Admin\""
	deleteRule := "@request.auth.id = owner || @request.auth.role = \"Admin\""
	
	collection.ListRule = &publicRule  // Allow public read access
	collection.ViewRule = &publicRule  // Allow public read access
	collection.CreateRule = &createRule
	collection.UpdateRule = &updateRule
	collection.DeleteRule = &deleteRule

	// Define schema fields
	collection.Fields.Add(&core.AutodateField{
		Name: "created",
		OnCreate: true,
	})
	collection.Fields.Add(&core.AutodateField{
		Name: "updated",
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
		Name: "level",
		Values: []string{"S0", "S1", "S2", "S3", "S4", "S5"},
		MaxSelect: 1,
		Required: true,
	})
	collection.Fields.Add(&core.JSONField{
		Name:     "tags",
		MaxSize:  1000,
		Required: false,
	})
	collection.Fields.Add(&core.FileField{
		Name: "file",
		MaxSelect: 1,
		MaxSize:   5485760,
		MimeTypes: []string{"application/gpx+xml", "application/xml", "text/xml"},
		Required: true,
	})
	collection.Fields.Add(&core.RelationField{
		Name: "owner",
		CollectionId: "_pb_users_auth_",
		MaxSelect:    1,
		Required: true,
	})

	// Save collection
	if err := app.Save(collection); err != nil {
		return fmt.Errorf("failed to create trails collection: %w", err)
	}

	log.Println("✅ Created trails collection successfully")
	return nil
}

func configureUsersCollection(app core.App) error {
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
	updateRule := "@request.auth.id = id || @request.auth.role = \"Admin\""
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
	for _, field := range usersCollection.Fields {
		if field.GetName() == "role" {
			roleFieldExists = true
			break
		}
	}
	
	if !roleFieldExists {
		// Add role field with default value "Viewer"
		roleField := &core.SelectField{
			Name: "role",
			Values: []string{"Viewer", "Editor", "Admin"},
			MaxSelect: 1,
			Required: false, //So empty is allowed, will be replaced by Viewer anyway
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

func configureGoogleOAuth(app core.App) error {
	// Get Google OAuth credentials from environment variables
	clientId := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")
	
	if clientId == "" || clientSecret == "" {
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
			ClientId:     clientId,
			ClientSecret: clientSecret,
			DisplayName:  "Google",
		},
	}
	
	// Configure field mappings
	usersCollection.OAuth2.MappedFields = core.OAuth2KnownFields{
		Name:      "name", 
		Username:  "email",
		AvatarURL: "picture",
	}



	//Disable other login methods
	usersCollection.PasswordAuth.Enabled = false
	
	// Save the collection
	if err := app.Save(usersCollection); err != nil {
		return fmt.Errorf("failed to save OAuth2 configuration: %w", err)
	}
	
	log.Println("✅ Configured Google OAuth provider")
	return nil
}

func ensureAdminAccount(app core.App) error {
	// Get admin credentials from environment variables
	adminEmail := os.Getenv("ADMIN_EMAIL")
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	
	if adminEmail == "" || adminPassword == "" {
		log.Println("⚠️  Admin credentials not found in environment variables - skipping admin account creation")
		return nil // Don't fail startup, just log warning
	}
	
	// Get superusers collection
	superusersCol, err := app.FindCachedCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		return fmt.Errorf("failed to fetch superusers collection: %w", err)
	}

	// Check if admin already exists
	superuser, err := app.FindAuthRecordByEmail(superusersCol, adminEmail)
	if err != nil {
		// Create new superuser if not found
		superuser = core.NewRecord(superusersCol)
		log.Printf("Creating new admin user: %s", adminEmail)
	} else {
		log.Printf("Admin user already exists, updating password: %s", adminEmail)
	}

	// Set credentials
	superuser.SetEmail(adminEmail)
	superuser.SetPassword(adminPassword)

	// Save the superuser
	if err := app.Save(superuser); err != nil {
		return fmt.Errorf("failed to save admin user: %w", err)
	}
	
	log.Printf("✅ Successfully created/updated admin account: %s", adminEmail)
	return nil
}