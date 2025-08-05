package main

import (
	"log"

	"bike-map-backend/internal/config"
	"bike-map-backend/internal/services"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
)

func main() {
	// Load configuration
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("Invalid configuration: %v", err)
	}

	// Initialize PocketBase app
	app := pocketbase.New()

	// Initialize application service with all dependencies
	appService, err := services.NewAppService(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize application service: %v", err)
	}
	defer appService.Close()

	// Setup PocketBase hooks
	appService.SetupHooks(app)

	// Setup server routes and collections
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		// Setup collections and initial data
		if err := appService.SetupCollections(app); err != nil {
			return err
		}

		// Setup HTTP routes
		appService.SetupRoutes(e, app)

		// Perform initial trail sync
		appService.SyncAllTrailsAtStartup(app)

		return e.Next()
	})

	// Start the application
	log.Printf("🚀 Starting BikeMap backend server")
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}