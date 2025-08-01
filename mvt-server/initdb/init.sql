CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    name TEXT,
    geom GEOMETRY(LineString, 4326)
);

-- Exemple : insérer une ligne fictive
INSERT INTO routes (name, geom)
VALUES ('Test route',
        ST_GeomFromText('LINESTRING(2.2945 48.8584, 2.3333 48.8667)', 4326));
