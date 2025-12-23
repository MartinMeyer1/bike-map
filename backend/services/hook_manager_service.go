package services

import (
	"context"
	"encoding/xml"
	"fmt"
	"log"
	"strings"

	"bike-map-backend/entities"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// HookManagerService manages all PocketBase event hooks with proper decoupling
type HookManagerService struct {
	authService *AuthService
	syncService *SyncService
}

// NewHookManagerService creates a new hook manager service
func NewHookManagerService(
	authService *AuthService,
	syncService *SyncService,
) *HookManagerService {
	return &HookManagerService{
		authService: authService,
		syncService: syncService,
	}
}

// SetupAllHooks configures all PocketBase event hooks
func (h *HookManagerService) SetupAllHooks(app core.App) {
	h.setupUserHooks(app)
	h.setupTrailHooks(app)
	h.setupEngagementHooks(app)
	h.setupFileDownloadHooks(app)
}

// setupUserHooks configures user-related hooks
func (h *HookManagerService) setupUserHooks(app core.App) {
	// User creation hook - set default role
	app.OnRecordCreateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
		if e.Collection.Name == "users" {
			// Set default role to "Viewer" for new users
			e.Record.Set("role", h.authService.GetDefaultRole())
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
				if !h.authService.CanManageUsers(reqInfo.Auth) {
					return apis.NewForbiddenError("You are not allowed to change your own role.", nil)
				}
			}
			return e.Next()
		}
		return e.Next()
	})
}

// setupTrailHooks configures trail-related hooks
func (h *HookManagerService) setupTrailHooks(app core.App) {
	// Trail creation request validation
	app.OnRecordCreateRequest().BindFunc(func(e *core.RecordRequestEvent) error {
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
			if !h.authService.CanCreateTrails(reqInfo.Auth) {
				return apis.NewForbiddenError("Only users with Editor or Admin role can create trails", nil)
			}
		}
		return e.Next()
	})

	// Trail lifecycle hooks
	if h.syncService != nil {
		// After trail creation
		app.OnRecordAfterCreateSuccess().BindFunc(func(e *core.RecordEvent) error {
			if e.Record.Collection().Name == "trails" {
				go h.handleTrailCreated(app, e.Record)
			}
			return e.Next()
		})

		// After trail update
		app.OnRecordAfterUpdateSuccess().BindFunc(func(e *core.RecordEvent) error {
			if e.Record.Collection().Name == "trails" {
				go h.handleTrailUpdated(app, e.Record)
			}
			return e.Next()
		})

		// After trail deletion
		app.OnRecordAfterDeleteSuccess().BindFunc(func(e *core.RecordEvent) error {
			if e.Record.Collection().Name == "trails" {
				go h.handleTrailDeleted(e.Record)
			}
			return e.Next()
		})
	}
}

// setupEngagementHooks configures engagement-related hooks (ratings and comments)
func (h *HookManagerService) setupEngagementHooks(app core.App) {
	if h.syncService == nil {
		return
	}

	// Rating hooks
	app.OnRecordAfterCreateSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trail_ratings" {
			go h.handleRatingCreated(app, e.Record)
		}
		return e.Next()
	})

	app.OnRecordAfterUpdateSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trail_ratings" {
			go h.handleRatingUpdated(app, e.Record)
		}
		return e.Next()
	})

	app.OnRecordAfterDeleteSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trail_ratings" {
			go h.handleRatingDeleted(app, e.Record)
		}
		return e.Next()
	})

	// Comment hooks
	app.OnRecordAfterCreateSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trail_comments" {
			go h.handleCommentCreated(e.Record)
		}
		return e.Next()
	})

	app.OnRecordAfterDeleteSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trail_comments" {
			go h.handleCommentDeleted(e.Record)
		}
		return e.Next()
	})
}

// setupFileDownloadHooks configures file download hooks
func (h *HookManagerService) setupFileDownloadHooks(app core.App) {
	app.OnFileDownloadRequest().BindFunc(func(e *core.FileDownloadRequestEvent) error {
		// Only process GPX files from trails collection
		if e.Collection.Name != "trails" {
			return e.Next()
		}

		// Get trail name for the filename
		trailName := e.Record.GetString("name")
		if trailName == "" {
			trailName = "trail"
		}

		// Sanitize filename (replace invalid characters)
		sanitizedName := sanitizeFilename(trailName)

		// Read the original GPX file
		fsys, err := app.NewFilesystem()
		if err != nil {
			log.Printf("Failed to create filesystem: %v", err)
			return e.Next()
		}
		defer fsys.Close()

		// Read file content
		fileReader, err := fsys.GetReader(e.ServedPath)
		if err != nil {
			log.Printf("Failed to read GPX file: %v", err)
			return e.Next()
		}
		defer fileReader.Close()

		// Parse GPX
		var gpx entities.GPX
		if err := xml.NewDecoder(fileReader).Decode(&gpx); err != nil {
			log.Printf("Failed to parse GPX file: %v", err)
			return e.Next()
		}

		// Update GPX metadata with trail name
		for i := range gpx.Tracks {
			gpx.Tracks[i].Name = trailName
		}

		// Marshal back to XML
		xmlData, err := xml.MarshalIndent(gpx, "", " ")
		if err != nil {
			log.Printf("Failed to marshal GPX: %v", err)
			return e.Next()
		}

		// Add XML header
		xmlContent := []byte(xml.Header + string(xmlData))

		// Set custom filename in Content-Disposition header
		filename := sanitizedName + ".gpx"
		e.Response.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		e.Response.Header().Set("Content-Type", "application/gpx+xml")

		// Write modified content
		e.Response.WriteHeader(200)
		if _, err := e.Response.Write(xmlContent); err != nil {
			log.Printf("Failed to write GPX response: %v", err)
		}

		return nil
	})
}

// sanitizeFilename removes or replaces invalid characters from filenames
func sanitizeFilename(name string) string {
	// Replace invalid filename characters with underscores
	invalid := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	sanitized := name
	for _, char := range invalid {
		sanitized = strings.ReplaceAll(sanitized, char, "_")
	}
	return sanitized
}

// Trail event handlers - delegate to SyncService

func (h *HookManagerService) handleTrailCreated(app core.App, record *core.Record) {
	if err := h.syncService.HandleTrailCreated(context.Background(), app, record.Id); err != nil {
		log.Printf("Failed to handle trail creation %s: %v", record.Id, err)
	}
}

func (h *HookManagerService) handleTrailUpdated(app core.App, record *core.Record) {
	if err := h.syncService.HandleTrailUpdated(context.Background(), app, record.Id); err != nil {
		log.Printf("Failed to handle trail update %s: %v", record.Id, err)
	}
}

func (h *HookManagerService) handleTrailDeleted(record *core.Record) {
	if err := h.syncService.HandleTrailDeleted(context.Background(), record.Id); err != nil {
		log.Printf("Failed to handle trail deletion %s: %v", record.Id, err)
	}
}

// Rating event handlers - delegate to SyncService

func (h *HookManagerService) handleRatingCreated(app core.App, record *core.Record) {
	trailID := record.GetString("trail")
	if trailID == "" {
		log.Printf("Warning: Rating created without trail ID")
		return
	}
	if err := h.syncService.HandleRatingCreated(context.Background(), app, trailID); err != nil {
		log.Printf("Failed to handle rating creation for trail %s: %v", trailID, err)
	}
}

func (h *HookManagerService) handleRatingUpdated(app core.App, record *core.Record) {
	trailID := record.GetString("trail")
	if trailID == "" {
		log.Printf("Warning: Rating updated without trail ID")
		return
	}
	if err := h.syncService.HandleRatingUpdated(context.Background(), app, trailID); err != nil {
		log.Printf("Failed to handle rating update for trail %s: %v", trailID, err)
	}
}

func (h *HookManagerService) handleRatingDeleted(app core.App, record *core.Record) {
	trailID := record.GetString("trail")
	if trailID == "" {
		log.Printf("Warning: Rating deleted without trail ID")
		return
	}
	if err := h.syncService.HandleRatingDeleted(context.Background(), app, trailID); err != nil {
		log.Printf("Failed to handle rating deletion for trail %s: %v", trailID, err)
	}
}

// Comment event handlers - delegate to SyncService

func (h *HookManagerService) handleCommentCreated(record *core.Record) {
	trailID := record.GetString("trail")
	if trailID == "" {
		log.Printf("Warning: Comment created without trail ID")
		return
	}
	if err := h.syncService.HandleCommentCreated(context.Background(), trailID); err != nil {
		log.Printf("Failed to handle comment creation for trail %s: %v", trailID, err)
	}
}

func (h *HookManagerService) handleCommentDeleted(record *core.Record) {
	trailID := record.GetString("trail")
	if trailID == "" {
		log.Printf("Warning: Comment deleted without trail ID")
		return
	}
	if err := h.syncService.HandleCommentDeleted(context.Background(), trailID); err != nil {
		log.Printf("Failed to handle comment deletion for trail %s: %v", trailID, err)
	}
}
