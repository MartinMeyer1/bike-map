package services

import (
	"context"
	"database/sql"
	"log"

	"bike-map-backend/internal/config"
	"bike-map-backend/internal/domain/events"
	"bike-map-backend/internal/domain/interfaces"
	"bike-map-backend/internal/domain/repositories"
	"bike-map-backend/internal/domain/validation"
	"bike-map-backend/internal/handlers"
	infrastructureRepos "bike-map-backend/internal/infrastructure/repositories"

	"github.com/pocketbase/pocketbase/core"
)

// AppService coordinates all application services with proper dependency injection
type AppService struct {
	// Configuration
	config *config.Config

	// Core Services
	authService       *AuthService
	collectionService *CollectionService
	engagementService *EngagementService
	syncService       *SyncService
	hookManagerService *HookManagerService

	// Legacy Services (for backward compatibility)
	gpxService *GPXService
	mvtService *MVTService

	// Handlers
	mvtHandler  *handlers.MVTHandler
	authHandler *handlers.AuthHandler

	// Domain Components
	trailRepo       repositories.TrailRepository
	engagementRepo  repositories.EngagementRepository
	userRepo        repositories.UserRepository
	validator       *validation.ValidatorSuite
	eventRegistry   *events.EventRegistry
	eventDispatcher *events.Dispatcher

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
	a.validator = validation.NewValidatorSuite()
	
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
		a.mvtHandler = handlers.NewMVTHandler(a.mvtService)
	}

	// Initialize auth handler
	a.authHandler = handlers.NewAuthHandler(a.authService)

	return nil
}

// InitializeForPocketBase completes initialization once PocketBase app is available
func (a *AppService) InitializeForPocketBase(app core.App) error {
	// Initialize repositories with PocketBase app
	a.trailRepo = infrastructureRepos.NewPocketBaseTrailRepository(app)
	a.engagementRepo = infrastructureRepos.NewPocketBaseEngagementRepository(app)
	a.userRepo = infrastructureRepos.NewPocketBaseUserRepository(app)

	// Initialize event dispatcher
	a.eventDispatcher = events.NewDispatcher()

	// Initialize domain services that depend on repositories
	a.engagementService = NewEngagementService(
		a.engagementRepo,
		a.trailRepo,
		a.userRepo,
		a.validator,
		a.eventDispatcher,
	)

	// Initialize sync service if PostGIS is available
	if a.postgisDB != nil {
		a.syncService = NewSyncService(
			a.trailRepo,
			a.engagementRepo,
			a.eventDispatcher,
			a.postgisDB,
			a.gpxService, // Pass GPXService for geometry processing
		)
	}

	// Initialize event registry with services
	if a.syncService != nil {
		a.eventRegistry = events.NewEventRegistry(
			a.syncService,  // sync service
			&cacheService{mvtService: a.mvtService}, // cache service adapter
			&auditService{}, // audit service stub
		)
		a.eventDispatcher = a.eventRegistry.GetDispatcher()
	}

	// Initialize hook manager service
	a.hookManagerService = NewHookManagerService(
		a.authService,
		a.engagementService,
		a.syncService,
		a.mvtService,
		a.eventDispatcher,
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

func (a *AppService) GetTrailRepository() repositories.TrailRepository {
	return a.trailRepo
}

func (a *AppService) GetEngagementRepository() repositories.EngagementRepository {
	return a.engagementRepo
}

func (a *AppService) GetUserRepository() repositories.UserRepository {
	return a.userRepo
}

func (a *AppService) GetEventDispatcher() *events.Dispatcher {
	return a.eventDispatcher
}

// Adapter services for event system

// cacheService adapts MVTService to the cache interface expected by event handlers
type cacheService struct {
	mvtService *MVTService
}

func (c *cacheService) InvalidateTrailCache(ctx context.Context, trailID string) error {
	// For now, invalidate all MVT cache
	if c.mvtService != nil {
		c.mvtService.InvalidateAllCache()
	}
	return nil
}

func (c *cacheService) InvalidateMVTCache(ctx context.Context) error {
	if c.mvtService != nil {
		c.mvtService.InvalidateAllCache()
	}
	return nil
}

func (c *cacheService) InvalidateEngagementCache(ctx context.Context, trailID string) error {
	// For now, invalidate all MVT cache
	if c.mvtService != nil {
		c.mvtService.InvalidateAllCache()
	}
	return nil
}

// Compile-time check to ensure cacheService implements interfaces.CacheService
var _ interfaces.CacheService = (*cacheService)(nil)

// auditService is a stub implementation for the audit interface
type auditService struct{}

func (a *auditService) LogEvent(ctx context.Context, eventType, aggregateID string, data interface{}) error {
	log.Printf("Audit: Event %s for %s: %+v", eventType, aggregateID, data)
	return nil
}

func (a *auditService) LogUserAction(ctx context.Context, userID, action, resource string, metadata map[string]interface{}) error {
	log.Printf("Audit: User %s performed %s on %s: %+v", userID, action, resource, metadata)
	return nil
}

// Compile-time check to ensure auditService implements interfaces.AuditService
var _ interfaces.AuditService = (*auditService)(nil)