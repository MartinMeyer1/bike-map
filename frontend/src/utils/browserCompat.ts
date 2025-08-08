/**
 * Browser compatibility utilities for handling deprecated browser features
 */

/**
 * Configure Leaflet to avoid deprecated Mozilla properties
 * This prevents deprecation warnings in Firefox when using Leaflet maps
 */
export function setupLeafletCompatibility(): void {
  if (typeof window !== 'undefined') {
    // Override the deprecated property access in MouseEvent prototype
    // This prevents Leaflet from accessing mozPressure and mozInputSource
    const originalMouseEvent = window.MouseEvent;
    if (originalMouseEvent && originalMouseEvent.prototype) {
      // Define getters that return undefined instead of throwing deprecation warnings
      Object.defineProperty(originalMouseEvent.prototype, 'mozPressure', {
        get: function() { return undefined; },
        configurable: true
      });
      Object.defineProperty(originalMouseEvent.prototype, 'mozInputSource', {
        get: function() { return undefined; },
        configurable: true
      });
    }
  }
}