package services

import (
	"context"
	"log"

	"bike-map-backend/apiHandlers"
	"bike-map-backend/config"
	"bike-map-backend/interfaces"

	"github.com/pocketbase/pocketbase/core"
)

// AppService coordinates all application services with proper dependency injection
type AppService struct {
	// Configuration
	config *config.Config

	// Core Services
	authService        *AuthService
	collectionService  *CollectionService
	engagementService  *EngagementService
	syncService        *SyncService
	hookManagerService *HookManagerService
	postgisService     *MVTGeneratorPostgis // MVTGenerator
	gpxService         *GPXService
	mvtService         *MVTMemoryStorage // MVTStorage

	// Handlers
	mvtHandler  *apiHandlers.MVTHandler
	authHandler *apiHandlers.AuthHandler
	metaHandler *apiHandlers.MetaHandler
}

// NewAppService creates a new application service with all dependencies properly wired
func NewAppService(cfg *config.Config) (*AppService, error) {
	app := &AppService{
		config: cfg,
	}

	if err := app.initializeServices(); err != nil {
		return nil, err
	}

	return app, nil
}

// initializeServices creates and wires all services
func (a *AppService) initializeServices() error {
	// Initialize auth service
	a.authService = NewAuthService(a.config)

	// Initialize collection service
	a.collectionService = NewCollectionService(a.config, a.authService)

	// Initialize PostGIS service (MVTGenerator - owns the database connection)
	var err error
	a.postgisService, err = NewPostGISService(a.config)
	if err != nil {
		log.Printf("Failed to initialize PostGIS service: %v", err)
		log.Printf("PostGIS sync and MVT endpoints will not be available")
		return nil // Continue without PostGIS - PocketBase will still work
	}

	// Initialize GPX service (no database, just parsing)
	a.gpxService = NewGPXService()

	// Initialize MVT service (MVTStorage - memory cache, no longer depends on PostGIS)
	a.mvtService = NewMVTService()

	return nil
}

// initializeHandlers creates HTTP handlers
func (a *AppService) initializeHandlers(app core.App) error {
	// Initialize MVT handler with MVTStorage
	if a.mvtService != nil {
		a.mvtHandler = apiHandlers.NewMVTHandler(a.mvtService)
	}

	// Initialize auth handler
	a.authHandler = apiHandlers.NewAuthHandler(a.authService)

	// Initialize meta handler
	a.metaHandler = apiHandlers.NewMetaHandler(app)

	return nil
}

// InitializeForPocketBase completes initialization once PocketBase app is available
func (a *AppService) InitializeForPocketBase(app core.App) error {
	// Initialize handlers now that app is available
	if err := a.initializeHandlers(app); err != nil {
		return err
	}

	// Initialize engagement service with PocketBase app
	a.engagementService = NewEngagementService(app)

	// Initialize sync service if PostGIS (MVTGenerator) is available
	if a.postgisService != nil {
		// Create storages slice with MVTService
		storages := []interfaces.MVTStorage{a.mvtService}

		a.syncService = NewSyncService(
			a.postgisService, // MVTGenerator
			a.gpxService,
			a.engagementService,
			storages,
		)
	}

	// Initialize hook manager service
	a.hookManagerService = NewHookManagerService(
		a.authService,
		a.syncService,
	)

	return nil
}

// SetupCollections initializes all required collections
func (a *AppService) SetupCollections(app core.App) error {
	if err := a.collectionService.EnsureTrailsCollection(app); err != nil {
		return err
	}

	if err := a.collectionService.EnsureTrailRatingsCollection(app); err != nil {
		return err
	}

	if err := a.collectionService.EnsureTrailCommentsCollection(app); err != nil {
		return err
	}

	if err := a.collectionService.EnsureRatingAverageCollection(app); err != nil {
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

// SetupHooks configures all PocketBase event hooks
func (a *AppService) SetupHooks(app core.App) {
	if a.hookManagerService != nil {
		a.hookManagerService.SetupAllHooks(app)
	}
}

// SetupRoutes configures all HTTP routes
func (a *AppService) SetupRoutes(e *core.ServeEvent, app core.App) {
	if a.metaHandler != nil {
		a.metaHandler.SetupRoutes(e)
	}

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

// SyncAllTrailsAtStartup performs initial sync of all trails to generator and generates tiles
func (a *AppService) SyncAllTrailsAtStartup(app core.App) {
	if a.syncService == nil {
		return
	}

	log.Println("Starting initial sync of all trails...")
	go func() {
		if err := a.syncService.SyncAllTrails(context.Background(), app); err != nil {
			log.Printf("Failed to sync trails at startup: %v", err)
		} else {
			log.Println("Successfully synced all trails and generated tiles at startup")
		}
	}()
}

// Close cleans up all service resources
func (a *AppService) Close() error {
	if a.postgisService != nil {
		if err := a.postgisService.Close(); err != nil {
			log.Printf("Error closing PostGIS service: %v", err)
		}
	}

	return nil
}
