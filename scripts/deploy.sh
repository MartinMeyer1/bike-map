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
if [ ! -f "./dist/bikemap-backend.tar.gz" ] || [ ! -f "./dist/bikemap-frontend.tar.gz" ]; then
    echo -e "${RED}❌ Error: Docker images not found. Run './scripts/build.sh' first${NC}"
    exit 1
fi

# Get deployment configuration
read -p "Enter your VPS IP address: " VPS_IP
read -p "Enter your VPS username (default: root): " VPS_USER
VPS_USER=${VPS_USER:-root}

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

echo -e "${BLUE}🏗️  Setting up application on VPS...${NC}"

# Execute deployment commands on VPS
ssh $VPS_USER@$VPS_IP << 'EOF'
cd /opt/bikemap

# Load docker images
echo "Loading backend image..."
docker load < bikemap-backend.tar.gz

echo "Loading frontend image..."
docker load < bikemap-frontend.tar.gz

# Create traefik network if it doesn't exist
docker network create traefik 2>/dev/null || true

# Stop existing containers
docker-compose down 2>/dev/null || true

# Start the application
docker-compose up -d

# Clean up tar files
rm -f *.tar.gz

echo "✅ Deployment complete!"
echo "🌐 Your BikeMap should be available at your domain shortly"
EOF

# Source environment variables to get BASE_DOMAIN
export $(grep -v '^#' .env.production | xargs)

echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
echo -e "${YELLOW}🌐 Your BikeMap should be available at https://${BASE_DOMAIN}${NC}"
echo -e "${YELLOW}🔧 Admin interface: https://admin.${BASE_DOMAIN}${NC}"
echo -e "${YELLOW}📊 Traefik dashboard: https://proxy.${BASE_DOMAIN}${NC}"