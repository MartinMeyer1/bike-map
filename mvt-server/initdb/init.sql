CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- TRAILS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS trails (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    level TEXT NOT NULL CHECK (level IN ('S0', 'S1', 'S2', 'S3', 'S4', 'S5')),
    tags JSONB,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    gpx_file TEXT,
    geom GEOMETRY(LineString, 4326),
    bbox GEOMETRY(Polygon, 4326),
    elevation_data JSONB,
    distance_m REAL,
    rating_average DECIMAL(3,2) DEFAULT 0.0,
    rating_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    ridden BOOLEAN DEFAULT true
);

-- ============================================================================
-- TRAIL-TILE INDEX TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS trail_tiles (
    trail_id TEXT NOT NULL REFERENCES trails(id) ON DELETE CASCADE,
    z INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    PRIMARY KEY (trail_id, z, x, y)
);

CREATE INDEX IF NOT EXISTS idx_trail_tiles_tile ON trail_tiles (z, x, y);

-- ============================================================================
-- MVT TILES CACHE TABLE
-- Stores pre-generated MVT tiles
-- ============================================================================

CREATE TABLE IF NOT EXISTS mvt_tiles (
    z INTEGER NOT NULL,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    data BYTEA NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (z, x, y)
);

-- ============================================================================
-- CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS tile_config (
    key TEXT PRIMARY KEY,
    value INTEGER NOT NULL
);

INSERT INTO tile_config (key, value) VALUES 
    ('min_zoom', 6),
    ('max_zoom', 18)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- FUNCTION: Calculate precise tiles for a geometry
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tiles_for_geometry(
    p_geom GEOMETRY,
    p_min_zoom INTEGER,
    p_max_zoom INTEGER
)
RETURNS TABLE (z INTEGER, x INTEGER, y INTEGER) AS $$
BEGIN
    IF p_geom IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH 
    geom_3857 AS (
        SELECT ST_Transform(p_geom, 3857) AS g
    ),
    geom_bounds AS (
        SELECT 
            ST_XMin(ST_Transform(ST_Envelope(g), 4326)) AS min_lon,
            ST_XMax(ST_Transform(ST_Envelope(g), 4326)) AS max_lon,
            ST_YMin(ST_Transform(ST_Envelope(g), 4326)) AS min_lat,
            ST_YMax(ST_Transform(ST_Envelope(g), 4326)) AS max_lat
        FROM geom_3857
    ),
    tile_ranges AS (
        SELECT 
            zoom_level AS zl,
            floor((min_lon + 180.0) / 360.0 * (1 << zoom_level))::integer AS min_x,
            floor((max_lon + 180.0) / 360.0 * (1 << zoom_level))::integer AS max_x,
            floor((1.0 - ln(tan(radians(max_lat)) + 1.0/cos(radians(max_lat))) / pi()) / 2.0 * (1 << zoom_level))::integer AS min_y,
            floor((1.0 - ln(tan(radians(min_lat)) + 1.0/cos(radians(min_lat))) / pi()) / 2.0 * (1 << zoom_level))::integer AS max_y
        FROM geom_bounds, generate_series(p_min_zoom, p_max_zoom) AS zoom_level
    ),
    tile_candidates AS (
        SELECT 
            tr.zl AS z,
            tx AS x,
            ty AS y,
            ST_TileEnvelope(tr.zl, tx, ty) AS tile_env
        FROM tile_ranges tr,
             LATERAL generate_series(tr.min_x, tr.max_x) AS tx,
             LATERAL generate_series(tr.min_y, tr.max_y) AS ty
    )
    SELECT DISTINCT tc.z, tc.x, tc.y
    FROM tile_candidates tc, geom_3857
    WHERE ST_Intersects(geom_3857.g, tc.tile_env)
    ORDER BY tc.z, tc.x, tc.y;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Calculate simplification tolerance based on zoom level
-- ============================================================================

CREATE OR REPLACE FUNCTION get_simplification_tolerance(p_zoom INTEGER)
RETURNS FLOAT AS $$
BEGIN
    -- Higher zoom = less simplification
    -- These values are in degrees (EPSG:4326)
    RETURN CASE
        WHEN p_zoom >= 13 THEN 0
        WHEN p_zoom >= 12 THEN 0.0005
        WHEN p_zoom >= 11 THEN 0.001
        WHEN p_zoom >= 9 THEN 0.01
        ELSE 0.05
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- FUNCTION: Generate MVT tile for specific coordinates
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_mvt_tile(p_z INTEGER, p_x INTEGER, p_y INTEGER)
RETURNS BYTEA AS $$
DECLARE
    v_tile_env GEOMETRY;
    v_tolerance FLOAT;
    v_mvt BYTEA;
BEGIN
    -- Get tile envelope in Web Mercator
    v_tile_env := ST_TileEnvelope(p_z, p_x, p_y);
    -- Get simplification tolerance
    v_tolerance := get_simplification_tolerance(p_z);

    IF v_tolerance > 0 THEN
        SELECT ST_AsMVT(mvt_geom.*, 'trails')
        INTO v_mvt
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
                    ST_Transform(ST_Simplify(t.geom, v_tolerance), 3857),
                    v_tile_env,
                    4096, 0, true
                ) AS geom
            FROM trails t
            JOIN trail_tiles tt ON t.id = tt.trail_id
            WHERE tt.z = p_z AND tt.x = p_x AND tt.y = p_y
        ) AS mvt_geom
        WHERE geom IS NOT NULL;
    ELSE
        SELECT ST_AsMVT(mvt_geom.*, 'trails')
        INTO v_mvt
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
                    ST_Transform(t.geom, 3857),
                    v_tile_env,
                    4096, 64, true
                ) AS geom
            FROM trails t
            JOIN trail_tiles tt ON t.id = tt.trail_id
            WHERE tt.z = p_z AND tt.x = p_x AND tt.y = p_y
        ) AS mvt_geom
        WHERE geom IS NOT NULL;
    END IF;

    RETURN COALESCE(v_mvt, ''::BYTEA);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- FUNCTION: Get or generate tile on-demand with freshness check
-- ============================================================================

CREATE OR REPLACE FUNCTION get_tile(p_z INTEGER, p_x INTEGER, p_y INTEGER)
RETURNS BYTEA AS $$
DECLARE
    v_data BYTEA;
    v_generated_at TIMESTAMP WITH TIME ZONE;
    v_is_stale BOOLEAN := FALSE;
BEGIN
    -- Try to get cached tile
    SELECT data, generated_at INTO v_data, v_generated_at
    FROM mvt_tiles WHERE z = p_z AND x = p_x AND y = p_y;

    IF v_data IS NOT NULL THEN
        -- Check if any trail on this tile was updated after tile generation
        SELECT EXISTS (
            SELECT 1 FROM trail_tiles tt
            JOIN trails t ON t.id = tt.trail_id
            WHERE tt.z = p_z AND tt.x = p_x AND tt.y = p_y
              AND t.updated_at > v_generated_at
        ) INTO v_is_stale;
    END IF;

    -- Generate if missing or stale
    IF v_data IS NULL OR v_is_stale THEN
        v_data := generate_mvt_tile(p_z, p_x, p_y);

        INSERT INTO mvt_tiles (z, x, y, data, generated_at)
        VALUES (p_z, p_x, p_y, v_data, NOW())
        ON CONFLICT (z, x, y) DO UPDATE
            SET data = EXCLUDED.data,
                generated_at = EXCLUDED.generated_at;
    END IF;

    RETURN v_data;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_before_trail_change()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Update trail's bbox and distance
    IF TG_OP = 'INSERT' OR NEW.geom IS DISTINCT FROM OLD.geom THEN
        NEW.bbox = ST_Envelope(NEW.geom);
        NEW.distance_m = ST_Length(ST_Transform(NEW.geom, 3857));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_after_trail_change()
RETURNS TRIGGER AS $$
DECLARE
    v_min_zoom INTEGER;
    v_max_zoom INTEGER;
BEGIN
    SELECT value INTO v_min_zoom FROM tile_config WHERE key = 'min_zoom';
    SELECT value INTO v_max_zoom FROM tile_config WHERE key = 'max_zoom';

    -- For UPDATE: save old tiles before deleting
    IF TG_OP = 'UPDATE' THEN
        CREATE TEMP TABLE IF NOT EXISTS _old_tiles (z INT, x INT, y INT) ON COMMIT DROP;
        DELETE FROM _old_tiles;
        INSERT INTO _old_tiles (z, x, y)
        SELECT tt.z, tt.x, tt.y FROM trail_tiles tt WHERE tt.trail_id = NEW.id;
    END IF;

    -- Update trail_tiles index
    DELETE FROM trail_tiles WHERE trail_id = NEW.id;

    IF NEW.geom IS NOT NULL THEN
        INSERT INTO trail_tiles (trail_id, z, x, y)
        SELECT NEW.id, t.z, t.x, t.y
        FROM get_tiles_for_geometry(NEW.geom, v_min_zoom, v_max_zoom) t;
    END IF;

    -- For UPDATE: invalidate tiles that are no longer covered by the trail
    IF TG_OP = 'UPDATE' THEN
        DELETE FROM mvt_tiles mt
        USING _old_tiles ot
        WHERE mt.z = ot.z AND mt.x = ot.x AND mt.y = ot.y
          AND NOT EXISTS (
              SELECT 1 FROM trail_tiles tt
              WHERE tt.trail_id = NEW.id
                AND tt.z = ot.z AND tt.x = ot.x AND tt.y = ot.y
          );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_before_trail_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Invalidate affected tiles before cascade deletes trail_tiles entries
    DELETE FROM mvt_tiles mt
    USING trail_tiles tt
    WHERE tt.trail_id = OLD.id
      AND mt.z = tt.z AND mt.x = tt.x AND mt.y = tt.y;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_trail_before_change ON trails;
DROP TRIGGER IF EXISTS trigger_trail_after_change ON trails;
DROP TRIGGER IF EXISTS trigger_trail_before_delete ON trails;
DROP TRIGGER IF EXISTS trigger_trail_after_delete ON trails;

CREATE TRIGGER trigger_trail_before_change
    BEFORE INSERT OR UPDATE ON trails
    FOR EACH ROW
    EXECUTE FUNCTION trigger_before_trail_change();

CREATE TRIGGER trigger_trail_after_change
    AFTER INSERT OR UPDATE ON trails
    FOR EACH ROW
    EXECUTE FUNCTION trigger_after_trail_change();

CREATE TRIGGER trigger_trail_before_delete
    BEFORE DELETE ON trails
    FOR EACH ROW
    EXECUTE FUNCTION trigger_before_trail_delete();