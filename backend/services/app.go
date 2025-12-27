package services

import (
	"context"
	"log"

	"bike-map/apiHandlers"
	"bike-map/config"

	"github.com/pocketbase/pocketbase/core"
)

// AppService coordinates all application services with proper dependency injection
type AppService struct {
	// Configuration
	config *config.Config

	// PocketBase app reference
	app core.App

	// Core Services
	authService          *AuthService
	collectionService    *CollectionService
	engagementService    *EngagementService
	orchestrationService *OrchestrationService
	hookManagerService   *HookManagerService
	postgisService       *MVTGeneratorPostgis // MVTGenerator
	mvtService           *MVTMemoryStorage    // MVTStorage

	// Handlers
	mvtHandler  *apiHandlers.MVTHandler
	authHandler *apiHandlers.AuthHandler
	metaHandler *apiHandlers.MetaHandler
}

// NewAppService creates a new application service with all dependencies properly wired
func NewAppService(cfg *config.Config, app core.App) (*AppService, error) {
	a := &AppService{
		config: cfg,
		app:    app,
	}

	if err := a.initializeServices(); err != nil {
		return nil, err
	}

	return a, nil
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

	// Initialize MVT service (MVTStorage - memory cache)
	a.mvtService = NewMVTService()

	// Initialize engagement service
	a.engagementService = NewEngagementService(a.app)

	// Initialize OrchestrationService if PostGIS (MVTGenerator) is available
	if a.postgisService != nil {
		a.orchestrationService = NewOrchestrationService(
			a.postgisService,
			a.engagementService,
			a.mvtService,
		)
		// Wire TileRequester into MVTService (breaks circular dependency)
		a.mvtService.SetTileRequester(a.orchestrationService)
	}

	// Initialize hook manager service
	a.hookManagerService = NewHookManagerService(
		a.authService,
		a.orchestrationService,
	)

	// Initialize handlers
	if a.mvtService != nil && a.orchestrationService != nil {
		a.mvtHandler = apiHandlers.NewMVTHandler(a.mvtService)
	}
	a.authHandler = apiHandlers.NewAuthHandler(a.authService)
	a.metaHandler = apiHandlers.NewMetaHandler(a.app)

	return nil
}

// SetupCollections initializes all required collections
func (a *AppService) SetupCollections() error {
	if err := a.collectionService.EnsureTrailsCollection(a.app); err != nil {
		return err
	}

	if err := a.collectionService.EnsureTrailRatingsCollection(a.app); err != nil {
		return err
	}

	if err := a.collectionService.EnsureTrailCommentsCollection(a.app); err != nil {
		return err
	}

	if err := a.collectionService.EnsureRatingAverageCollection(a.app); err != nil {
		return err
	}

	if err := a.collectionService.ConfigureUsersCollection(a.app); err != nil {
		return err
	}

	if err := a.collectionService.ConfigureGoogleOAuth(a.app); err != nil {
		return err
	}

	if err := a.collectionService.EnsureAdminAccount(a.app); err != nil {
		return err
	}

	return nil
}

// SetupHooks configures all PocketBase event hooks
func (a *AppService) SetupHooks() {
	if a.hookManagerService != nil {
		a.hookManagerService.SetupAllHooks(a.app)
	}
}

// SetupRoutes configures all HTTP routes
func (a *AppService) SetupRoutes(e *core.ServeEvent) {
	if a.metaHandler != nil {
		a.metaHandler.SetupRoutes(e)
	}

	if a.mvtHandler != nil {
		a.mvtHandler.SetupRoutes(e)
	}

	if a.authHandler != nil {
		a.authHandler.SetupRoutes(e, a.app)
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
func (a *AppService) SyncAllTrailsAtStartup() {
	if a.orchestrationService == nil {
		return
	}

	log.Println("Starting initial sync of all trails...")
	if err := a.orchestrationService.SyncAllTrails(context.Background(), a.app); err != nil {
		log.Printf("Failed to sync trails at startup: %v", err)
	} else {
		log.Println("Successfully synced all trails and generated tiles at startup")
	}
}

// Close cleans up all service resources
func (a *AppService) Close() error {
	// Stop the tile worker first
	if a.orchestrationService != nil {
		a.orchestrationService.Stop()
	}

	if a.postgisService != nil {
		if err := a.postgisService.Close(); err != nil {
			log.Printf("Error closing PostGIS service: %v", err)
		}
	}

	return nil
}
