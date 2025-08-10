# BRouter Routing Server

High-performance routing engine for BikeMap using Swiss OSM data.

## Setup

### 1. Download Swiss Data
```bash
mkdir -p segments
cd segments
wget http://brouter.de/brouter/segments4/E5_N45.rd5
cd ..
```

### 2. Test Locally
```bash
docker run --rm \
  -v $(pwd)/segments:/segments4 \
  -p 17777:17777 \
  --name brouter \
  ghcr.io/abrensch/brouter:v1.7.8
```

## API Usage

```bash
curl "http://localhost:17777/brouter?lonlats=8.5,47.4|8.6,47.5&profile=trekking&format=geojson"
```