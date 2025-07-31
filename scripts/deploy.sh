#!/bin/bash

# Deploy script for BikeMap application
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying BikeMap to production...${NC}"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Error: .env.production file not found${NC}"
    exit 1
fi

# Check if images exist
if [ ! -f "./dist/bikemap-backend.tar.gz" ] || [ ! -f "./dist/bikemap-frontend.tar.gz" ] || [ ! -f "./dist/brouter.tar.gz" ]; then
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

echo -e "${YELLOW}🧭 Uploading BRouter image...${NC}"
scp ./dist/brouter.tar.gz $VPS_USER@$VPS_IP:/opt/bikemap/

# Upload configuration files
echo -e "${YELLOW}📄 Uploading configuration files...${NC}"
scp ./docker-compose.yml $VPS_USER@$VPS_IP:/opt/bikemap/
scp ./.env.production $VPS_USER@$VPS_IP:/opt/bikemap/.env

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
echo "Loading backend image..."
docker load < bikemap-backend.tar.gz

echo "Loading frontend image..."
docker load < bikemap-frontend.tar.gz

echo "Loading BRouter image..."
docker load < brouter.tar.gz

# Create traefik network if it doesn't exist
docker network create traefik 2>/dev/null || true

# Start the application
docker compose up -d

# Clean up dangling images
docker image prune -f

# Clean up tar files
rm -f *.tar.gz

echo "✅ Deployment complete!"
echo "🌐 Your BikeMap should be available at your domain shortly"
EOF

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${YELLOW}🌐 Your BikeMap should be available at https://${BASE_DOMAIN}${NC}"
echo -e "${YELLOW}🔧 Admin interface: https://admin.${BASE_DOMAIN}${NC}"
echo -e "${YELLOW}🧭 Routing service: https://routing.${BASE_DOMAIN}${NC}"
echo -e "${YELLOW}📊 Traefik dashboard: https://proxy.${BASE_DOMAIN}${NC}"