package main

import (
	"log"

	"bike-map-backend/config"
	"bike-map-backend/services"

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
	appService, err := services.NewAppService(cfg, app)
	if err != nil {
		log.Fatalf("Failed to initialize application service: %v", err)
	}
	defer appService.Close()

	// Setup PocketBase hooks
	appService.SetupHooks()

	// OnServe runs after database is ready
	app.OnServe().BindFunc(func(e *core.ServeEvent) error {
		// Setup collections (requires DB)
		if err := appService.SetupCollections(); err != nil {
			return err
		}

		// Setup HTTP routes
		appService.SetupRoutes(e)

		// Perform initial trail sync
		appService.SyncAllTrailsAtStartup()

		return e.Next()
	})

	// Start the application
	log.Printf("Starting BikeMap backend server")
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}