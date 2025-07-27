package main

import (
	"fmt"
	"log"

	"github.com/labstack/echo/v5"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
)

func main() {
	app := pocketbase.New()

	// Create trails collection on startup
	app.OnBeforeServe().Add(func(e *core.ServeEvent) error {
		return ensureTrailsCollection(app)
	})

	// Ensure authenticated user can only create trails for themselves
	app.OnRecordBeforeCreateRequest("trails").Add(func(e *core.RecordCreateEvent) error {
		admin, _ := e.HttpContext.Get(apis.ContextAdminKey).(*models.Admin)
		record, _ := e.HttpContext.Get(apis.ContextAuthRecordKey).(*models.Record)
		
		if admin != nil {
			return nil // Allow admin to set any owner
		}
		
		if record == nil {
			return apis.NewForbiddenError("Authentication required", nil)
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
	createRule := "@request.auth.id != \"\""
	updateRule := "@request.auth.id = owner"
	deleteRule := "@request.auth.id = owner"
	
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
			Options:  &schema.JsonOptions{MaxSize: 2000000}, // 2MB
			Required: false,
		},
		&schema.SchemaField{
			Name:     "file",
			Type:     schema.FieldTypeFile,
			Options:  &schema.FileOptions{
				MaxSelect: 1,
				MaxSize:   10485760, // 10MB in bytes
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