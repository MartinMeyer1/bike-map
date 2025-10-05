package services

import (
	"context"
	"database/sql"
	"log"

	"bike-map-backend/apiHandlers"
	"bike-map-backend/config"
	"bike-map-backend/entities"
	"bike-map-backend/interfaces"
	repos "bike-map-backend/repositories"

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

	// Legacy Services (for backward compatibility)
	gpxService *GPXService
	mvtService *MVTService

	// Handlers
	mvtHandler  *apiHandlers.MVTHandler
	authHandler *apiHandlers.AuthHandler
	metaHandler *apiHandlers.MetaHandler

	// Domain Components
	trailRepo       interfaces.TrailRepository
	engagementRepo  interfaces.EngagementRepository
	userRepo        interfaces.UserRepository
	validator       *entities.ValidatorSuite

	// Database connection for PostGIS
	postgisDB *sql.DB
}

// NewAppService creates a new application service with all dependencies properly wired
func NewAppService(cfg *config.Config) (*AppService, error) {
	app := &AppService{
		config: cfg,
	}

	// Initialize components in dependency order
	if err := app.initializeDomainComponents(); err != nil {
		return nil, err
	}

	if err := app.initializeServices(); err != nil {
		return nil, err
	}

	if err := app.initializeHandlers(); err != nil {
		return nil, err
	}

	return app, nil
}

// initializeDomainComponents sets up domain-level components
func (a *AppService) initializeDomainComponents() error {
	// Initialize validator suite
	a.validator = entities.NewValidatorSuite()

	return nil
}

// initializeServices creates and wires all services
func (a *AppService) initializeServices() error {
	// Initialize auth service
	a.authService = NewAuthService(a.config)

	// Initialize collection service
	a.collectionService = NewCollectionService(a.config, a.authService)

	// Initialize legacy services for backward compatibility
	var err error
	a.gpxService, err = NewGPXService(a.config)
	if err != nil {
		log.Printf("⚠️  Failed to initialize GPX service: %v", err)
		log.Printf("PostGIS sync will not be available")
	} else {
		// Get PostGIS connection from GPX service
		a.postgisDB = a.gpxService.GetDB()
	}

	a.mvtService, err = NewMVTService(a.config)
	if err != nil {
		log.Printf("⚠️  Failed to initialize MVT service: %v", err)
		log.Printf("MVT endpoints will not be available")
	}

	return nil
}

// initializeHandlers creates HTTP handlers
func (a *AppService) initializeHandlers() error {
	// Initialize MVT handler
	if a.mvtService != nil {
		a.mvtHandler = apiHandlers.NewMVTHandler(a.mvtService)
	}

	// Initialize auth handler
	a.authHandler = apiHandlers.NewAuthHandler(a.authService)

	return nil
}

// InitializeMetaHandler initializes the meta handler after PocketBase app is available
func (a *AppService) InitializeMetaHandler(app core.App) {
	a.metaHandler = apiHandlers.NewMetaHandler(app)
}

// InitializeForPocketBase completes initialization once PocketBase app is available
func (a *AppService) InitializeForPocketBase(app core.App) error {
	// Initialize repositories with PocketBase app
	a.trailRepo = repos.NewPocketBaseTrailRepository(app)
	a.engagementRepo = repos.NewPocketBaseEngagementRepository(app)
	a.userRepo = repos.NewPocketBaseUserRepository(app)

	// Initialize domain services that depend on repositories
	a.engagementService = NewEngagementService(
		a.engagementRepo,
		a.trailRepo,
		a.userRepo,
		a.validator,
	)

	// Initialize sync service if PostGIS is available
	if a.postgisDB != nil {
		a.syncService = NewSyncService(
			a.trailRepo,
			a.engagementRepo,
			a.postgisDB,
			a.gpxService, // Pass GPXService for geometry processing
		)
	}

	// Initialize hook manager service
	a.hookManagerService = NewHookManagerService(
		a.authService,
		a.engagementService,
		a.syncService,
		a.mvtService,
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
	// Initialize meta handler (needs app context)
	a.InitializeMetaHandler(app)

	// Setup share route for social media meta tags (must be before MVT routes)
	if a.metaHandler != nil {
		e.Router.GET("/share/{trailId}", a.metaHandler.HandleTrailShare)
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

// SyncAllTrailsAtStartup performs initial sync of all trails to PostGIS
func (a *AppService) SyncAllTrailsAtStartup(app core.App) {
	if a.syncService == nil {
		return
	}

	log.Println("🔄 Starting initial sync of all trails to PostGIS...")
	go func() {
		if err := a.syncService.SyncAllTrailsWithApp(context.Background(), app); err != nil {
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

// Service getters for external access

func (a *AppService) GetEngagementService() *EngagementService {
	return a.engagementService
}

func (a *AppService) GetSyncService() *SyncService {
	return a.syncService
}

func (a *AppService) GetAuthService() *AuthService {
	return a.authService
}

func (a *AppService) GetTrailRepository() interfaces.TrailRepository {
	return a.trailRepo
}

func (a *AppService) GetEngagementRepository() interfaces.EngagementRepository {
	return a.engagementRepo
}

func (a *AppService) GetUserRepository() interfaces.UserRepository {
	return a.userRepo
}