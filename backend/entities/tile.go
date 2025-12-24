package entities

// TileBounds represents tile bounds in Web Mercator projection
type TileBounds struct {
	XMin, YMin, XMax, YMax float64
}

// TileCoordinates represents the coordinates of a tile
type TileCoordinates struct{
	X, Y, Z int
}