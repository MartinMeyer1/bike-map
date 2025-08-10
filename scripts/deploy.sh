#!/bin/bash

# Deploy script for BikeMap application with PostGIS integration
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚵 Deploying BikeMap with PostGIS to production...${NC}"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Error: .env.production file not found${NC}"
    exit 1
fi

# Check if images exist
if [ ! -f "./dist/bikemap-backend.tar.gz" ] || [ ! -f "./dist/bikemap-frontend.tar.gz" ]; then
    echo -e "${RED}❌ Error: Docker images not found. Run './scripts/build.sh' first${NC}"
    exit 1
fi

# Source environment variables to get VPS configuration
export $(grep -v '^#' .env.production | xargs)

# Check if VPS configuration is set
if [ -z "$VPS_IP" ] || [ -z "$VPS_USER" ]; then
    echo -e "${RED}❌ Error: VPS_IP and VPS_USER must be set in .env.production${NC}"
    echo -e "${YELLOW}💡 Add VPS_IP=your_vps_ip and VPS_USER=your_username to .env.production${NC}"
    exit 1
fi

echo -e "${BLUE}🌐 Deploying to $VPS_USER@$VPS_IP${NC}"

echo -e "${BLUE}📤 Uploading files to VPS...${NC}"

# Create remote directory
ssh $VPS_USER@$VPS_IP "mkdir -p /opt/bikemap"

# Upload docker images
echo -e "${YELLOW}📦 Uploading backend image...${NC}"
scp ./dist/bikemap-backend.tar.gz $VPS_USER@$VPS_IP:/opt/bikemap/

echo -e "${YELLOW}📦 Uploading frontend image...${NC}"
scp ./dist/bikemap-frontend.tar.gz $VPS_USER@$VPS_IP:/opt/bikemap/

# Upload configuration files
echo -e "${YELLOW}📄 Uploading configuration files...${NC}"
scp ./docker-compose.yml $VPS_USER@$VPS_IP:/opt/bikemap/
scp ./.env.production $VPS_USER@$VPS_IP:/opt/bikemap/.env

# Upload PostGIS initialization scripts
echo -e "${PURPLE}🗃️  Uploading PostGIS database schemas...${NC}"
scp -r ./mvt-server/ $VPS_USER@$VPS_IP:/opt/bikemap/

# Upload routing data
echo -e "${YELLOW}🗺️  Uploading routing data...${NC}"
ssh $VPS_USER@$VPS_IP "mkdir -p /opt/bikemap/routing-server/segments"
if [ -f "./routing-server/segments/E5_N45.rd5" ]; then
    scp ./routing-server/segments/E5_N45.rd5 $VPS_USER@$VPS_IP:/opt/bikemap/routing-server/segments/
else
    echo -e "${YELLOW}⚠️  E5_N45.rd5 not found locally. Download it on the VPS manually.${NC}"
fi

echo -e "${BLUE}🏗️  Setting up application on VPS...${NC}"

# Execute deployment commands on VPS
ssh $VPS_USER@$VPS_IP << 'EOF'
cd /opt/bikemap

# Load docker images
echo "📦 Loading backend image..."
docker load < bikemap-backend.tar.gz

echo "📦 Loading frontend image..."
docker load < bikemap-frontend.tar.gz

# Create traefik network if it doesn't exist
docker network create traefik 2>/dev/null || true

echo "🗃️  Starting PostGIS database..."
# Start PostGIS first to ensure it's healthy before backend
docker compose up -d postgis

echo "⏳ Waiting for PostGIS to be ready..."
sleep 10
docker compose logs postgis

echo "🚀 Starting all services..."
docker compose up -d

echo "🔍 Checking service health..."
sleep 5
docker compose ps

echo "📊 PostGIS status:"
docker compose exec -T postgis psql -U gisuser -d gis -c "SELECT version();" || echo "PostGIS not ready yet"

# Clean up dangling images
docker image prune -f

# Clean up tar files
rm -f *.tar.gz

echo "✅ Deployment complete!"
echo "🌐 Your BikeMap should be available at your domain shortly"
echo "🗺️  Vector tiles will be served from PostGIS"
EOF

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${YELLOW}🌐 Your BikeMap should be available at https://${BASE_DOMAIN}${NC}"
echo -e "${YELLOW}🔧 Admin interface: https://admin.${BASE_DOMAIN}${NC}"
echo -e "${YELLOW}🧭 Routing service: https://${BASE_DOMAIN}/brouter${NC}"
echo -e "${YELLOW}📊 Traefik dashboard: https://proxy.${BASE_DOMAIN}${NC}"
echo -e "${PURPLE}🏗️  Architecture: Go backend + PostGIS + React frontend${NC}"
echo -e "${PURPLE}🗺️  Vector tiles: https://${BASE_DOMAIN}/api/tiles/{z}/{x}/{y}.mvt${NC}"
echo -e "${BLUE}📝 Next steps:${NC}"
echo -e "${BLUE}   1. Wait a few minutes for SSL certificates${NC}"
echo -e "${BLUE}   2. Check service health: docker compose ps${NC}"
echo -e "${BLUE}   3. Monitor logs: docker compose logs -f backend${NC}"