import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MVTTrail, User } from '../types';
import { ToastVariant } from './ui';
import UserSection from './UserSection';
import { InfoModal } from './InfoModal';
import { DifficultyScale, LineKey } from './DifficultyLegend';
import { MobileTrailStrip } from './MobileTrailStrip';
import { MobileTrailDetail } from './MobileTrailDetail';
import { useMeasuredHeight, useViewportHeight } from '../hooks/useMeasuredHeight';
import styles from './MobileSheet.module.css';

/**
 * Where the sheet can rest.
 *
 * `detail` is not a fourth stop on the same ladder -- it is what the sheet
 * becomes while a trail is open, and it exits back to `mid`.
 */
type Detent = 'collapsed' | 'mid' | 'full' | 'detail';

interface MobileSheetProps {
  trails: MVTTrail[];
  selectedTrail: MVTTrail | null;
  user: User | null;
  onOpenTrail: (trail: MVTTrail) => void;
  onCloseTrail: () => void;
  onAddTrailClick: () => void;
  onEditTrailClick: (trail: MVTTrail) => void;
  onShowToast: (message: string, variant: ToastVariant) => void;
}

/** Movement past this is a drag; anything less is a tap on the handle. */
const DRAG_THRESHOLD_PX = 4;

/** Breathing room under the strip, so cards do not sit on the sheet's edge. */
const STRIP_GUTTER_PX = 30;

const EASING = 'cubic-bezier(.32,.72,0,1)';
const DURATION_MS = 340;

export const MobileSheet: React.FC<MobileSheetProps> = ({
  trails,
  selectedTrail,
  user,
  onOpenTrail,
  onCloseTrail,
  onAddTrailClick,
  onEditTrailClick,
  onShowToast,
}) => {
  const [detent, setDetent] = useState<Detent>('collapsed');
  const [drag, setDrag] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const draggedRef = useRef(false);

  const viewportHeight = useViewportHeight();

  // Every stop is measured from the content that defines it, so a wrapped legend
  // or a long description moves the stop instead of being clipped by it.
  const [handleRef, handleHeight] = useMeasuredHeight<HTMLDivElement>();
  const [headerRef, headerHeight] = useMeasuredHeight<HTMLDivElement>();
  const [stripHeadRef, stripHeadHeight] = useMeasuredHeight<HTMLDivElement>();
  const [stripRef, stripHeight] = useMeasuredHeight<HTMLDivElement>();
  const [legendRef, legendHeight] = useMeasuredHeight<HTMLDivElement>();
  const [detailRef, detailHeight] = useMeasuredHeight<HTMLDivElement>();

  const isDetail = detent === 'detail';

  const collapsed = handleHeight || 44;
  const midContent = handleHeight + stripHeadHeight + stripHeight + STRIP_GUTTER_PX;
  const mid = Math.max(
    collapsed + 40,
    Math.min(Math.round(viewportHeight * 0.45), midContent || Math.round(viewportHeight * 0.3)),
  );
  const full = Math.max(
    Math.min(Math.round(viewportHeight * 0.92), mid + headerHeight + legendHeight),
    mid + 60,
  );
  // Detail is capped at half the screen: past that the map it refers to stops
  // being visible, and the point of the state is seeing the trail on the map.
  const detailCap = Math.round(viewportHeight * 0.5);
  const detailStop = Math.min(detailCap, handleHeight + detailHeight || detailCap);

  const stops: Record<Detent, number> = { collapsed, mid, full, detail: detailStop };
  const ceiling = Math.max(full, isDetail ? detailStop : 0);
  const sheetHeight =
    drag === null
      ? stops[detent]
      : Math.max(collapsed, Math.min(ceiling, stops[detent] + drag));

  /*
   * How far the sheet has been pulled past `mid`, 0..1. The header and legend
   * blocks scale their height and opacity by it, so they grow in continuously
   * under the finger instead of appearing once the sheet lands.
   */
  const reveal =
    isDetail || full <= mid
      ? 0
      : Math.max(0, Math.min(1, (sheetHeight - mid) / (full - mid)));

  /*
   * How the map answers the sheet.
   *
   * The map is not resized any more: its container keeps the whole viewport and
   * is scaled down by CSS, the way a video shrinks when a comment sheet opens
   * over it. A transform changes no layout box, so MapLibre's ResizeObserver
   * never fires -- the map does not re-measure, does not re-render and does not
   * reconsider its tiles while a finger is moving. What the compositor scales is
   * the frame it had already drawn. A downscaled canvas is supersampled rather
   * than blurred, so the small map is if anything sharper than the large one.
   *
   * Shrinking stops where the trail-detail state ends, and the map holds that
   * size while the sheet rises over it, fading out by the time the menu is open:
   * there is no reading a map the size of a stamp, and the menu state is not
   * about the map at all.
   *
   * The floor is the detail *cap* rather than the detail stop itself. The stop
   * is measured from content that only exists while a trail is open -- it
   * collapses to the bare handle otherwise -- and a floor that moved with it
   * would make the same drag shrink the map differently depending on whether
   * something happened to be selected. The cap is half the screen, so it is
   * always at least the list stop's 45%.
   */
  const floorStop = Math.max(detailCap, mid);
  const rise = Math.max(0, sheetHeight - collapsed);
  const floorRise = Math.max(0, floorStop - collapsed);
  const mapScale =
    viewportHeight > 0
      ? (viewportHeight - Math.min(rise, floorRise)) / viewportHeight
      : 1;
  const mapOpacity =
    full > floorStop
      ? 1 - Math.max(0, Math.min(1, (sheetHeight - floorStop) / (full - floorStop)))
      : 1;

  /*
   * Published as custom properties rather than lifted into App's state: these
   * change every frame of a drag, and re-rendering the map subtree at that rate
   * would drop the interaction. Only CSS reads them, so the map follows the
   * sheet without React being involved.
   *
   * The viewport height goes out with them because the shell is sized from it:
   * scaling by a ratio measured against visualViewport while the shell is 100vh
   * tall would leave the card's bottom edge adrift by the height of an iOS URL
   * bar.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bm-viewport-height', `${viewportHeight}px`);
    root.style.setProperty('--bm-map-scale', `${mapScale}`);
    root.style.setProperty('--bm-map-opacity', `${mapOpacity}`);

    // An invisible map must not go on taking taps in the strip the sheet does
    // not cover: opacity alone would leave it there, still listening.
    if (mapOpacity < 0.05) {
      root.setAttribute('data-bm-map-faded', 'true');
    } else {
      root.removeAttribute('data-bm-map-faded');
    }

    return () => {
      root.style.removeProperty('--bm-viewport-height');
      root.style.removeProperty('--bm-map-scale');
      root.style.removeProperty('--bm-map-opacity');
      root.removeAttribute('data-bm-map-faded');
    };
  }, [viewportHeight, mapScale, mapOpacity]);

  // The map animates with the sheet, and must not while a finger is on it.
  useEffect(() => {
    const root = document.documentElement;
    if (drag === null) {
      root.removeAttribute('data-bm-sheet-dragging');
    } else {
      root.setAttribute('data-bm-sheet-dragging', 'true');
    }
  }, [drag]);

  // Selecting a trail anywhere -- a marker, a URL on load -- opens the detail
  // state; clearing the selection returns to the list.
  const previousSelectionRef = useRef<string | null>(null);
  useEffect(() => {
    const id = selectedTrail?.id ?? null;
    if (id === previousSelectionRef.current) {
      return;
    }

    previousSelectionRef.current = id;
    setDetent(id ? 'detail' : 'mid');
  }, [selectedTrail]);

  /*
   * Opening a card also sets the detent directly. Leaving it to the effect above
   * would miss the case that matters most: a trail stays selected while the sheet
   * is dragged back down to the list, so tapping that same card again changes no
   * id and would otherwise do nothing.
   */
  const handleOpenTrail = useCallback(
    (trail: MVTTrail) => {
      previousSelectionRef.current = trail.id;
      setDetent('detail');
      onOpenTrail(trail);
    },
    [onOpenTrail],
  );

  const nearestStop = useCallback(
    (px: number): Detent => {
      // From the detail state the ladder is different: the neighbouring stops
      // are the map (down) and a fuller read of the same trail (up).
      const candidates: Detent[] = isDetail
        ? ['detail', 'collapsed', 'full']
        : ['collapsed', 'mid', 'full'];

      return candidates.reduce((best, candidate) =>
        Math.abs(stops[candidate] - px) < Math.abs(stops[best] - px) ? candidate : best,
      );
    },
    // stops is derived from measurements each render; naming them keeps the
    // callback honest without re-creating it on every pixel of a drag.
    [isDetail, collapsed, mid, full, detailStop], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const startY = e.clientY;
      const base = drag === null ? stops[detent] : stops[detent] + drag;
      draggedRef.current = false;

      e.currentTarget.setPointerCapture?.(e.pointerId);

      const move = (event: PointerEvent) => {
        const delta = startY - event.clientY;
        if (Math.abs(delta) > DRAG_THRESHOLD_PX) {
          draggedRef.current = true;
        }
        setDrag(delta);
      };

      const up = (event: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);

        const finalHeight = Math.max(
          collapsed,
          Math.min(ceiling, base + (startY - event.clientY)),
        );

        setDrag(null);
        if (draggedRef.current) {
          setDetent(nearestStop(finalHeight));
        }
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [detent, drag, collapsed, ceiling, nearestStop], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Tapping the handle steps through the stops, for anyone who would rather not
  // drag. A drag that ends on the handle must not also count as a tap.
  const handleClick = useCallback(() => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }

    setDetent((current) => {
      switch (current) {
        case 'collapsed':
          return 'mid';
        case 'mid':
          return 'full';
        case 'full':
          return 'collapsed';
        default:
          return 'collapsed';
      }
    });
  }, []);

  const handleLabel = isDetail
    ? 'DRAG DOWN FOR THE MAP'
    : detent === 'collapsed'
      ? `${trails.length} TRAIL${trails.length === 1 ? '' : 'S'} — DRAG UP`
      : detent === 'mid'
        ? 'DRAG UP FOR MENU'
        : 'DRAG DOWN';

  const transition = drag === null ? `height ${DURATION_MS}ms ${EASING}` : 'none';
  const blockTransition =
    drag === null
      ? `height ${DURATION_MS}ms ${EASING}, opacity 260ms ease`
      : 'none';

  return (
    <div className={styles.sheet} style={{ height: sheetHeight, transition }}>
      <div
        ref={handleRef}
        className={styles.handle}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="Resize trail panel"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <div className={styles.grip} aria-hidden="true"></div>
        <div className={styles.handleLabel}>{handleLabel}</div>
      </div>

      <div className={styles.body}>
        {isDetail && selectedTrail ? (
          <div ref={detailRef}>
            <MobileTrailDetail
              trail={selectedTrail}
              user={user}
              onBack={onCloseTrail}
              onEditTrailClick={onEditTrailClick}
              onShowToast={onShowToast}
            />
          </div>
        ) : (
          <>
            {/* Grows in from above as the sheet is pulled up. */}
            <div
              className={styles.revealBlock}
              // Collapsed to nothing, the block is still in the layout, so its
              // buttons stayed tabbable: keyboard and switch-control users could
              // reach an invisible ADD TRAIL. inert takes them out of reach
              // without taking them out of flow, which the measurement needs.
              inert={reveal === 0}
              style={{
                height: Math.round(headerHeight * reveal),
                opacity: reveal * reveal,
                transition: blockTransition,
              }}
            >
              <div ref={headerRef} className={styles.header}>
                <div className={styles.titleRow}>
                  <div className={styles.brand}>
                    <img src="/rock.png" alt="" className={styles.mark} />
                    <div>
                      <div className={styles.eyebrow}>SHREDDING SINCE 2025</div>
                      <div className={styles.title}>BikeMap</div>
                    </div>
                  </div>

                  {user && (user.role === 'Editor' || user.role === 'Admin') && (
                    <button
                      type="button"
                      className={styles.addButton}
                      onClick={onAddTrailClick}
                    >
                      + ADD TRAIL
                    </button>
                  )}
                </div>

                <UserSection user={user} />
              </div>
            </div>

            <div ref={stripHeadRef} className={styles.stripHead}>
              <div className={styles.stripLabel}>VISIBLE TRAILS</div>
              <div className={styles.stripCount}>{trails.length}</div>
            </div>

            <div ref={stripRef}>
              {trails.length === 0 ? (
                <div className={styles.emptyState}>
                  No trails in view. Pan the map to explore.
                </div>
              ) : (
                <MobileTrailStrip
                  trails={trails}
                  selectedId={selectedTrail?.id}
                  onOpen={handleOpenTrail}
                />
              )}
            </div>

            {/* And this one from below. */}
            <div
              className={styles.revealBlock}
              inert={reveal === 0}
              style={{
                height: Math.round((legendHeight + 14) * reveal),
                opacity: reveal * reveal,
                transition: blockTransition,
              }}
            >
              <div ref={legendRef} className={styles.legend}>
                <div className={styles.legendHead}>
                  <div className={styles.legendTitle}>DIFFICULTY LEGEND</div>
                  <button
                    type="button"
                    className={styles.infoButton}
                    onClick={() => setShowInfo(true)}
                    aria-label="About BikeMap"
                  >
                    i
                  </button>
                </div>
                <DifficultyScale compact />
                <LineKey layout="column" sampleWidth={30} />
              </div>
            </div>
          </>
        )}
      </div>

      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
};
