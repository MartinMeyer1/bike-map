import { MVTTrail, Trail } from '../types';

/**
 * Utility functions for sharing trails via Web Share API or clipboard fallback
 */

/**
 * Check if the Web Share API is available on this device
 */
export function canShare(): boolean {
  return typeof navigator !== 'undefined' && 'share' in navigator;
}

/**
 * Generate a shareable URL for a trail
 */
export function getTrailShareUrl(trailId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}?trail=${trailId}`;
}

/**
 * Generate the share endpoint URL for social media preview
 */
export function getTrailMetaUrl(trailId: string, bounds?: { north: number; south: number; east: number; west: number }): string {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8090';
  let url = `${apiBaseUrl}/api/meta/${trailId}`;

  // Add bbox parameter if bounds are provided
  if (bounds) {
    const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
    url += `?bbox=${bbox}`;
  }

  return url;
}

/**
 * Share result type
 */
export type ShareResult = 'web-share' | 'clipboard' | 'cancelled' | 'failed';

/**
 * Share a trail using the Web Share API or fallback to clipboard
 * Returns the method used for sharing
 */
export async function shareTrail(trail: MVTTrail | Trail): Promise<ShareResult> {
  // Pass bounds if available (MVTTrail has bounds, Trail doesn't)
  const bounds = 'bounds' in trail ? trail.bounds : undefined;
  const shareUrl = getTrailMetaUrl(trail.id, bounds); // Use meta URL for better social previews

  // Prepare share data
  const shareData: ShareData = {
    title: `${trail.name} - BikeMap`,
    text: trail.description
      ? `Check out this ${trail.level} trail: ${trail.description}`
      : `Check out this ${trail.level} trail on BikeMap!`,
    url: shareUrl,
  };

  // Try Web Share API first
  if (canShare()) {
    try {
      // Check if we can share this specific data
      if (navigator.canShare && !navigator.canShare(shareData)) {
        console.warn('⚠️ Cannot share this specific data, falling back to clipboard');
        throw new Error('Cannot share this data');
      }

      await navigator.share(shareData);
      return 'web-share';
    } catch (error) {
      // User cancelled or error occurred
      if (error instanceof Error && error.name === 'AbortError') {
        return 'cancelled';
      }

      // Fall through to clipboard fallback
      console.warn('⚠️ Web Share API failed, falling back to clipboard:', error);
    }
  }

  // Fallback: copy to clipboard
  const copied = await copyToClipboard(shareUrl);
  if (copied) {
    return 'clipboard';
  } else {
    return 'failed';
  }
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      return successful;
    }
  } catch (error) {
    return false;
  }
}

