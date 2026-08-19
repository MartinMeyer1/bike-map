-- ============================================================================
-- Migration 001: add the trail_endpoints layer to generated tiles
-- ============================================================================
--
-- initdb/init.sql only runs against an empty data directory, so an existing
-- deployment needs this applied by hand:
--
--   docker compose exec -T postgis \
--     psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
--     < mvt-server/migrations/001_trail_endpoints_layer.sql
--
-- Then restart the backend. SyncAllTrails runs on every startup and clears the
-- tile cache before regenerating, so tiles cached without the new layer are
-- replaced without any further action.
--
-- Schema is unchanged; this replaces one function and is safe to re-run.
--
-- ============================================================================
-- FUNCTION: Generate MVT tile for specific coordinates
-- ============================================================================
--
-- Emits two layers into a single tile:
--
--   trails           the LineString of each trail, carrying every property the
--                    frontend needs to render a trail card without a round trip
--   trail_endpoints  one point per trail end, carrying only what the start and
--                    finish markers need to draw and to identify their trail
--
-- ST_AsMVT produces one layer per call, but a tile is a protobuf whose layers
-- are a repeated field, so concatenating two encoded tiles yields a valid tile
-- holding both layers. That is what the `||` at the end does.
--
-- The endpoints layer exists so the markers can be a MapLibre symbol layer.
-- They used to be built on the client from the line's own bbox properties,
-- which meant one DOM marker per trail end -- around 1600 of them across a
-- cantonal view. As tile geometry they cost nothing on the main thread.
--
CREATE OR REPLACE FUNCTION generate_mvt_tile(p_z INTEGER, p_x INTEGER, p_y INTEGER)
RETURNS BYTEA AS $$
DECLARE
    v_tile_env  GEOMETRY;
    v_tolerance FLOAT;
    v_buffer    INTEGER;
    v_lines     BYTEA;
    v_endpoints BYTEA;
BEGIN
    -- Get tile envelope in Web Mercator
    v_tile_env := ST_TileEnvelope(p_z, p_x, p_y);
    -- Get simplification tolerance
    v_tolerance := get_simplification_tolerance(p_z);
    -- Simplified geometry is clipped hard to the tile; full-detail geometry is
    -- given a margin so joins across a tile seam stay continuous.
    v_buffer := CASE WHEN v_tolerance > 0 THEN 0 ELSE 64 END;

    SELECT ST_AsMVT(mvt_geom.*, 'trails')
    INTO v_lines
    FROM (
        SELECT
            t.id,
            t.name,
            t.description,
            t.level,
            CASE
                WHEN t.tags IS NOT NULL THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(t.tags)), ',')
                ELSE NULL
            END as tags,
            t.owner_id,
            t.created_at,
            t.updated_at,
            t.gpx_file,
            ST_XMin(t.bbox) as bbox_west,
            ST_YMin(t.bbox) as bbox_south,
            ST_XMax(t.bbox) as bbox_east,
            ST_YMax(t.bbox) as bbox_north,
            ST_X(ST_StartPoint(t.geom)) as start_lng,
            ST_Y(ST_StartPoint(t.geom)) as start_lat,
            ST_X(ST_EndPoint(t.geom)) as end_lng,
            ST_Y(ST_EndPoint(t.geom)) as end_lat,
            t.distance_m,
            COALESCE((t.elevation_data->>'gain')::REAL, 0) as elevation_gain_meters,
            COALESCE((t.elevation_data->>'loss')::REAL, 0) as elevation_loss_meters,
            CASE
                WHEN t.elevation_data->'profile' IS NOT NULL AND jsonb_array_length(t.elevation_data->'profile') > 0 THEN
                    (SELECT MIN((value->>'elevation')::REAL) FROM jsonb_array_elements(t.elevation_data->'profile') AS value)
                ELSE NULL
            END as min_elevation_meters,
            CASE
                WHEN t.elevation_data->'profile' IS NOT NULL AND jsonb_array_length(t.elevation_data->'profile') > 0 THEN
                    (SELECT MAX((value->>'elevation')::REAL) FROM jsonb_array_elements(t.elevation_data->'profile') AS value)
                ELSE NULL
            END as max_elevation_meters,
            CASE
                WHEN t.elevation_data->'profile' IS NOT NULL AND jsonb_array_length(t.elevation_data->'profile') > 0 THEN
                    (t.elevation_data->'profile'->0->>'elevation')::REAL
                ELSE NULL
            END as elevation_start_meters,
            CASE
                WHEN t.elevation_data->'profile' IS NOT NULL AND jsonb_array_length(t.elevation_data->'profile') > 0 THEN
                    (t.elevation_data->'profile'->-1->>'elevation')::REAL
                ELSE NULL
            END as elevation_end_meters,
            t.rating_average,
            t.rating_count,
            t.comment_count,
            t.ridden,
            ST_AsMVTGeom(
                ST_Transform(
                    CASE WHEN v_tolerance > 0 THEN ST_Simplify(t.geom, v_tolerance) ELSE t.geom END,
                    3857
                ),
                v_tile_env,
                4096, v_buffer, true
            ) AS geom
        FROM trails t
        JOIN trail_tiles tt ON t.id = tt.trail_id
        WHERE tt.z = p_z AND tt.x = p_x AND tt.y = p_y
    ) AS mvt_geom
    WHERE geom IS NOT NULL;

    -- Endpoints carry no buffer: with clip_geom on, each point therefore lands
    -- in exactly one tile, so a marker near a seam is never emitted twice and
    -- cannot collide with its own duplicate. MapLibre draws a symbol as a
    -- screen-space quad rather than clipping it to its tile, so an icon
    -- anchored just inside an edge still paints across the boundary.
    SELECT ST_AsMVT(endpoint_geom.*, 'trail_endpoints')
    INTO v_endpoints
    FROM (
        SELECT
            t.id as trail_id,
            t.level,
            e.role,
            ST_AsMVTGeom(
                ST_Transform(e.point, 3857),
                v_tile_env,
                4096, 0, true
            ) AS geom
        FROM trails t
        JOIN trail_tiles tt ON t.id = tt.trail_id
        CROSS JOIN LATERAL (
            VALUES ('start', ST_StartPoint(t.geom)),
                   ('end',   ST_EndPoint(t.geom))
        ) AS e(role, point)
        WHERE tt.z = p_z AND tt.x = p_x AND tt.y = p_y
    ) AS endpoint_geom
    WHERE geom IS NOT NULL;

    RETURN COALESCE(v_lines, ''::BYTEA) || COALESCE(v_endpoints, ''::BYTEA);
END;
$$ LANGUAGE plpgsql STABLE;
