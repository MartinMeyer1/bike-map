CREATE EXTENSION IF NOT EXISTS postgis;

-- Create trails table that matches BikeMap schema
CREATE TABLE IF NOT EXISTS trails (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    level TEXT NOT NULL CHECK (level IN ('S0', 'S1', 'S2', 'S3', 'S4', 'S5')),
    tags JSONB,
    owner_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- GPX file reference for downloads
    gpx_file TEXT,
    -- Geometry column for the trail track (SRID 4326 = WGS84)
    geom GEOMETRY(LineString, 4326),
    -- Bounding box for spatial filtering
    bbox GEOMETRY(Polygon, 4326),
    -- Elevation data as JSON (gain, loss, profile)
    elevation_data JSONB,
    -- Distance in meters
    distance_m REAL
);

-- Create spatial indexes for performance
CREATE INDEX IF NOT EXISTS idx_trails_geom ON trails USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_trails_bbox ON trails USING GIST (bbox);
CREATE INDEX IF NOT EXISTS idx_trails_owner ON trails (owner_id);
CREATE INDEX IF NOT EXISTS idx_trails_level ON trails (level);

-- Create function to update bounding box automatically
CREATE OR REPLACE FUNCTION update_trails_bbox()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate bounding box from geometry
    NEW.bbox = ST_Envelope(NEW.geom);
    -- Calculate distance
    NEW.distance_m = ST_Length(ST_Transform(NEW.geom, 3857)); -- Transform to Web Mercator for accurate distance
    -- Update timestamp
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update bbox and distance
CREATE TRIGGER trigger_update_trails_bbox
    BEFORE INSERT OR UPDATE OF geom ON trails
    FOR EACH ROW
    EXECUTE FUNCTION update_trails_bbox();
