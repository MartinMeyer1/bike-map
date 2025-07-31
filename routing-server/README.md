# BRouter Routing Server

High-performance routing engine for BikeMap using Swiss OSM data.

## Setup

### 1. Build BRouter
```bash
cd routing-server
git clone https://github.com/abrensch/brouter.git
cd brouter
docker build -t brouter:latest .
cd ..
```

### 2. Download Swiss Data
```bash
mkdir -p segments
cd segments
wget http://brouter.de/brouter/segments4/E5_N45.rd5
cd ..
```

### 3. Test Locally
```bash
docker run --rm \
  -v $(pwd)/segments:/segments4 \
  -p 17777:17777 \
  --name brouter \
  brouter:latest
```

## API Usage

```bash
curl "http://localhost:17777/brouter?lonlats=8.5,47.4|8.6,47.5&profile=trekking&format=geojson"
```