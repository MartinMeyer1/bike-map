package services

import (
	"log"

	"bike-map-backend/internal/config"
	"bike-map-backend/internal/handlers"
	"bike-map-backend/internal/models"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// AppService coordinates all application services and handles PocketBase events
type AppService struct {
	config            *config.Config
	authService       *AuthService
	collectionService *CollectionService
	gpxService        *GPXService
	mvtService        *MVTService
	mvtHandler        *handlers.MVTHandler
	authHandler       *handlers.AuthHandler
}

// NewAppService creates a new application service with all dependencies
func NewAppService(cfg *config.Config) (*AppService, error) {
	// Initialize services
	authService := NewAuthService(cfg)
	collectionService := NewCollectionService(cfg, authService)

	gpxService, err := NewGPXService(cfg)
	if err != nil {
		log.Printf("⚠️  Failed to initialize GPX service: %v", err)
		log.Printf("PostGIS sync will not be available")
	}

	mvtService, err := NewMVTService(cfg)
	if err != nil {
		log.Printf("⚠️  Failed to initialize MVT service: %v", err)
		log.Printf("MVT endpoints will not be available")
	}

	// Initialize handlers
	var mvtHandler *handlers.MVTHandler
	if mvtService != nil {
		mvtHandler = handlers.NewMVTHandler(mvtService)
	}

	authHandler := handlers.NewAuthHandler(authService)

	return &AppService{
		config:            cfg,
		authService:       authService,
		collectionService: collectionService,
		gpxService:        gpxService,
		mvtService:        mvtService,
		mvtHandler:        mvtHandler,
		authHandler:       authHandler,
	}, nil
}

// SetupHooks configures all PocketBase event hooks
func (a *AppService) SetupHooks(app core.App) {
	// User creation hook - set default role
	app.OnRecordCreateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
		if e.Collection.Name == "users" {
			// Set default role to "Viewer" for new users
			e.Record.Set("role", a.authService.GetDefaultRole())
		}

		if e.Collection.Name == "trails" {
			// Ignore for superusers
			if e.HasSuperuserAuth() {
				return e.Next()
			}

			reqInfo, _ := e.RequestInfo()

			// Check if authenticated user exists
			if reqInfo.Auth == nil {
				return apis.NewForbiddenError("Authentication required", nil)
			}

			// Check if user has permission to create trails
			if !a.authService.CanCreateTrails(reqInfo.Auth) {
				return apis.NewForbiddenError("Only users with Editor or Admin role can create trails", nil)
			}
		}

		return e.Next()
	})

	// User update hook - prevent role changes by non-admins
	app.OnRecordUpdateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
		if e.Collection.Name == "users" {
			// Ignore for superusers
			if e.HasSuperuserAuth() {
				return e.Next()
			}

			reqInfo, err := e.RequestInfo()
			if err != nil {
				return err
			}

			// Get the current record from the DB
			origRecord := e.Record.Original()

			// Check if the "role" field is being changed
			oldRole := origRecord.GetString("role")
			newRole := e.Record.GetString("role")

			if oldRole != newRole {
				// Check if the current user is an admin
				if !a.authService.CanManageUsers(reqInfo.Auth) {
					return apis.NewForbiddenError("You are not allowed to change your own role.", nil)
				}
			}
			return e.Next()
		}
		return e.Next()
	})

	// Trail lifecycle hooks with PostGIS sync and cache invalidation
	if a.gpxService != nil {
		a.setupTrailSyncHooks(app)
	}
}

// setupTrailSyncHooks sets up hooks for trail synchronization with PostGIS
func (a *AppService) setupTrailSyncHooks(app core.App) {
	// After trail creation
	app.OnRecordAfterCreateSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trails" {
			go a.syncTrailToPostGIS(app, e.Record.Id, "creation")
		}
		return e.Next()
	})

	// After trail update
	app.OnRecordAfterUpdateSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trails" {
			go a.syncTrailToPostGIS(app, e.Record.Id, "update")
		}
		return e.Next()
	})

	// After trail deletion
	app.OnRecordAfterDeleteSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trails" {
			go a.deleteTrailFromPostGIS(e.Record.Id, e.Record.GetString("name"))
		}
		return e.Next()
	})
}

// syncTrailToPostGIS handles trail synchronization to PostGIS
func (a *AppService) syncTrailToPostGIS(app core.App, trailID, operation string) {
	if a.gpxService == nil {
		return
	}

	if err := a.gpxService.ImportTrailFromPocketBase(app, trailID); err != nil {
		log.Printf("Failed to sync trail %s to PostGIS after %s: %v", trailID, operation, err)
	} else {
		log.Printf("Successfully synced trail to PostGIS after %s", operation)

		// Invalidate specific MVT tiles affected by this trail
		if a.mvtService != nil {
			if bbox, err := a.gpxService.GetTrailBoundingBox(trailID); err == nil {
				a.mvtService.InvalidateTilesForTrail(*bbox)
				log.Printf("Invalidated MVT tiles for trail %s after %s", trailID, operation)
			} else {
				log.Printf("Could not get trail bounding box, falling back to full cache invalidation: %v", err)
				a.mvtService.InvalidateAllCache()
			}
		}
	}
}

// deleteTrailFromPostGIS handles trail deletion from PostGIS
func (a *AppService) deleteTrailFromPostGIS(trailID, trailName string) {
	if a.gpxService == nil {
		return
	}

	// Get bounding box before deletion for targeted cache invalidation
	var trailBBox *models.BoundingBox
	if a.mvtService != nil {
		if bbox, err := a.gpxService.GetTrailBoundingBox(trailID); err == nil {
			trailBBox = bbox
		}
	}

	if err := a.gpxService.DeleteTrailFromPostGIS(trailID); err != nil {
		log.Printf("Failed to delete trail %s from PostGIS: %v", trailID, err)
	} else {
		log.Printf("Successfully deleted trail %s from PostGIS", trailName)

		// Invalidate specific MVT tiles affected by the deleted trail
		if a.mvtService != nil {
			if trailBBox != nil {
				a.mvtService.InvalidateTilesForTrail(*trailBBox)
				log.Printf("Invalidated MVT tiles for deleted trail %s", trailName)
			} else {
				log.Printf("Could not get trail bounding box before deletion, falling back to full cache invalidation")
				a.mvtService.InvalidateAllCache()
			}
		}
	}
}

// SetupCollections initializes all required collections
func (a *AppService) SetupCollections(app core.App) error {
	if err := a.collectionService.EnsureTrailsCollection(app); err != nil {
		return err
	}

	if err := a.collectionService.ConfigureUsersCollection(app); err != nil {
		return err
	}

	if err := a.collectionService.ConfigureGoogleOAuth(app); err != nil {
		return err
	}

	if err := a.collectionService.EnsureAdminAccount(app); err != nil {
		return err
	}

	return nil
}

// SetupRoutes configures all HTTP routes
func (a *AppService) SetupRoutes(e *core.ServeEvent, app core.App) {
	if a.mvtHandler != nil {
		a.mvtHandler.SetupRoutes(e)
	}

	if a.authHandler != nil {
		a.authHandler.SetupRoutes(e, app)
	}

	// Add custom CORS handling
	e.Router.GET("/*", func(re *core.RequestEvent) error {
		re.Response.Header().Set("Access-Control-Allow-Origin", "*")
		re.Response.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		re.Response.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		return re.Next()
	})
}

// SyncAllTrailsAtStartup performs initial sync of all trails to PostGIS
func (a *AppService) SyncAllTrailsAtStartup(app core.App) {
	if a.gpxService == nil {
		return
	}

	log.Println("🔄 Starting initial sync of all trails to PostGIS...")
	go func() {
		if err := a.gpxService.SyncAllTrails(app); err != nil {
			log.Printf("⚠️  Failed to sync trails at startup: %v", err)
		} else {
			log.Println("✅ Successfully synced all trails to PostGIS at startup")

			// Invalidate MVT cache after startup sync
			if a.mvtService != nil {
				a.mvtService.InvalidateAllCache()
				log.Printf("MVT cache invalidated after startup sync")
			}
		}
	}()
}

// Close cleans up all service resources
func (a *AppService) Close() error {
	if a.gpxService != nil {
		if err := a.gpxService.Close(); err != nil {
			log.Printf("Error closing GPX service: %v", err)
		}
	}

	if a.mvtService != nil {
		if err := a.mvtService.Close(); err != nil {
			log.Printf("Error closing MVT service: %v", err)
		}
	}

	return nil
}