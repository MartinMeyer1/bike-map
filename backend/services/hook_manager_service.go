package services

import (
	"context"
	"log"

	"bike-map-backend/entities"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

// HookManagerService manages all PocketBase event hooks with proper decoupling
type HookManagerService struct {
	authService       *AuthService
	engagementService *EngagementService
	syncService       *SyncService
	mvtService        *MVTService
}

// NewHookManagerService creates a new hook manager service
func NewHookManagerService(
	authService *AuthService,
	engagementService *EngagementService,
	syncService *SyncService,
	mvtService *MVTService,
) *HookManagerService {
	return &HookManagerService{
		authService:       authService,
		engagementService: engagementService,
		syncService:       syncService,
		mvtService:        mvtService,
	}
}

// SetupAllHooks configures all PocketBase event hooks
func (h *HookManagerService) SetupAllHooks(app core.App) {
	h.setupUserHooks(app)
	h.setupTrailHooks(app)
	h.setupEngagementHooks(app)
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
			go h.handleCommentCreated(app, e.Record)
		}
		return e.Next()
	})

	app.OnRecordAfterUpdateSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trail_comments" {
			go h.handleCommentUpdated(app, e.Record)
		}
		return e.Next()
	})

	app.OnRecordAfterDeleteSuccess().BindFunc(func(e *core.RecordEvent) error {
		if e.Record.Collection().Name == "trail_comments" {
			go h.handleCommentDeleted(app, e.Record)
		}
		return e.Next()
	})
}

// Trail event handlers

func (h *HookManagerService) handleTrailCreated(app core.App, record *core.Record) {
	trailID := record.Id
	log.Printf("Handling trail creation: %s", trailID)

	// Sync to PostGIS with full GPX processing including geometry
	if err := h.syncService.SyncTrailToPostGISWithGeometry(context.Background(), app, trailID); err != nil {
		log.Printf("Failed to sync trail %s to PostGIS after creation: %v", trailID, err)
	} else {
		log.Printf("Successfully synced trail to PostGIS after creation")
		// Invalidate MVT cache
		h.invalidateMVTCacheForTrail(trailID)
	}
}

func (h *HookManagerService) handleTrailUpdated(app core.App, record *core.Record) {
	trailID := record.Id
	log.Printf("Handling trail update: %s", trailID)

	// Get old bounding box before update to invalidate old position
	oldBBox, err := h.syncService.gpxService.GetTrailBoundingBox(trailID)
	if err != nil {
		log.Printf("Could not get old bbox for trail %s: %v", trailID, err)
	}

	// Sync to PostGIS with full GPX processing including geometry
	if err := h.syncService.SyncTrailToPostGISWithGeometry(context.Background(), app, trailID); err != nil {
		log.Printf("Failed to sync trail %s to PostGIS after update: %v", trailID, err)
	} else {
		log.Printf("Successfully synced trail to PostGIS after update")
		
		// Invalidate cache for old position if we got it
		if oldBBox != nil {
			h.mvtService.InvalidateTilesForBBox(*oldBBox)
		} else{
			h.mvtService.InvalidateAllCache()
		}
		
		// Invalidate cache for new position
		h.invalidateMVTCacheForTrail(trailID)
	}
}

func (h *HookManagerService) handleTrailDeleted(record *core.Record) {
	trailID := record.Id
	trailName := record.GetString("name")
	log.Printf("Handling trail deletion: %s (%s)", trailID, trailName)

	// Get bounding box before deletion to invalidate cache
	oldBBox, err := h.syncService.gpxService.GetTrailBoundingBox(trailID)
	if err != nil {
		log.Printf("Could not get bbox for trail %s before deletion: %v", trailID, err)
	}

	// Remove from PostGIS
	if err := h.syncService.RemoveTrailFromPostGIS(context.Background(), trailID); err != nil {
		log.Printf("Failed to delete trail %s from PostGIS: %v", trailID, err)
	} else {
		log.Printf("Successfully deleted trail %s from PostGIS", trailName)

		// Invalidate cache for deleted trail position
		if oldBBox != nil {
			h.mvtService.InvalidateTilesForBBox(*oldBBox)
		} else {
			// Fall back to full cache invalidation if we couldn't get bbox
			h.mvtService.InvalidateAllCache()
		}
	}
}

// Engagement event handlers

func (h *HookManagerService) handleRatingCreated(app core.App, record *core.Record) {
	trailID := record.GetString("trail")
	if trailID == "" {
		log.Printf("Warning: Rating created without trail ID")
		return
	}

	log.Printf("Handling rating creation for trail: %s", trailID)

	// Update rating average using the legacy method (for now)
	if err := h.engagementService.UpdateRatingAverage(app, trailID); err != nil {
		log.Printf("Failed to update rating average after creation: %v", err)
	}

	// Update engagement data in PostGIS and invalidate MVT cache
	h.updateEngagementAndInvalidateCache(trailID, "rating creation")
}

func (h *HookManagerService) handleRatingUpdated(app core.App, record *core.Record) {
	trailID := record.GetString("trail")
	if trailID == "" {
		log.Printf("Warning: Rating updated without trail ID")
		return
	}

	log.Printf("Handling rating update for trail: %s", trailID)

	// Update rating average using the legacy method (for now)
	if err := h.engagementService.UpdateRatingAverage(app, trailID); err != nil {
		log.Printf("Failed to update rating average after update: %v", err)
	}

	// Update engagement data in PostGIS and invalidate MVT cache
	h.updateEngagementAndInvalidateCache(trailID, "rating update")
}

func (h *HookManagerService) handleRatingDeleted(app core.App, record *core.Record) {
	trailID := record.GetString("trail")
	if trailID == "" {
		log.Printf("Warning: Rating deleted without trail ID")
		return
	}

	log.Printf("Handling rating deletion for trail: %s", trailID)

	// Update rating average using the legacy method (for now)
	if err := h.engagementService.DeleteRatingAverage(app, trailID); err != nil {
		log.Printf("Failed to update rating average after deletion: %v", err)
	}

	// Update engagement data in PostGIS and invalidate MVT cache
	h.updateEngagementAndInvalidateCache(trailID, "rating deletion")
}

func (h *HookManagerService) handleCommentCreated(app core.App, record *core.Record) {
	trailID := record.GetString("trail")
	if trailID == "" {
		log.Printf("Warning: Comment created without trail ID")
		return
	}

	log.Printf("Handling comment creation for trail: %s", trailID)

	// Update engagement data in PostGIS and invalidate MVT cache
	h.updateEngagementAndInvalidateCache(trailID, "comment creation")
}

func (h *HookManagerService) handleCommentUpdated(app core.App, record *core.Record) {
	trailID := record.GetString("trail")
	if trailID == "" {
		log.Printf("Warning: Comment updated without trail ID")
		return
	}

	log.Printf("Handling comment update for trail: %s", trailID)
	// Comments updates don't change engagement stats, so no action needed
	// But we could add audit logging here if needed
}

func (h *HookManagerService) handleCommentDeleted(app core.App, record *core.Record) {
	trailID := record.GetString("trail")
	if trailID == "" {
		log.Printf("Warning: Comment deleted without trail ID")
		return
	}

	log.Printf("Handling comment deletion for trail: %s", trailID)

	// Update engagement data in PostGIS and invalidate MVT cache
	h.updateEngagementAndInvalidateCache(trailID, "comment deletion")
}

// Helper methods

func (h *HookManagerService) updateEngagementAndInvalidateCache(trailID, operation string) {
	if h.syncService == nil {
		return
	}

	// Update engagement stats in PostGIS
	if err := h.syncService.UpdateEngagementStats(context.Background(), trailID); err != nil {
		log.Printf("Failed to update PostGIS engagement after %s: %v", operation, err)
		return
	}

	// Invalidate MVT cache for this trail
	h.invalidateMVTCacheForTrail(trailID)
}

func (h *HookManagerService) invalidateMVTCacheForTrail(trailID string) {
	if h.mvtService == nil {
		return
	}

	bbox, err := h.syncService.gpxService.GetTrailBoundingBox(trailID)
	if err != nil || bbox == nil {
		log.Printf("Could not get bbox for trail %s, invalidating full cache: %v", trailID, err)
		h.mvtService.InvalidateAllCache()
		return
	}

	h.mvtService.InvalidateTilesForBBox(*bbox)
	log.Printf("Invalidated MVT cache for trail %s", trailID)
}

// Legacy compatibility method for when GPX service is available
func (h *HookManagerService) SetGPXService(gpxService interface {
	GetTrailBoundingBox(trailID string) (*entities.BoundingBox, error)
}) {
	// This would allow more targeted cache invalidation
	// For now, we'll keep it simple with full cache invalidation
}
