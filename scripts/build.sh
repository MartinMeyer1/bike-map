#!/bin/bash

# Build script for BikeMap application
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Building BikeMap for production...${NC}"

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Error: .env.production file not found${NC}"
    echo -e "${YELLOW}💡 Copy .env.production.example to .env.production and fill in your values${NC}"
    exit 1
fi

# Source environment variables
export $(grep -v '^#' .env.production | xargs)

# Generate password hash for Traefik dashboard if not already set
if [ -z "$ADMIN_PASSWORD_HASH" ]; then
    echo -e "${YELLOW}🔐 Generating password hash for Traefik dashboard...${NC}"
    # Generate bcrypt hash using htpasswd (install apache2-utils if needed)
    if command -v htpasswd >/dev/null 2>&1; then
        ADMIN_PASSWORD_HASH=$(htpasswd -nbB "" "$ADMIN_PASSWORD" | cut -d: -f2)
        # Double dollar signs for docker-compose
        ADMIN_PASSWORD_HASH=$(echo "$ADMIN_PASSWORD_HASH" | sed 's/\$/\$\$/g')
        echo -e "\nADMIN_PASSWORD_HASH=$ADMIN_PASSWORD_HASH" >> .env.production
        echo -e "${GREEN}✅ Password hash added to .env.production${NC}"
    else
        echo -e "${RED}❌ htpasswd not found. Install apache2-utils: sudo apt-get install apache2-utils${NC}"
        echo -e "${YELLOW}💡 Or manually add ADMIN_PASSWORD_HASH to .env.production${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}📦 Building backend image...${NC}"
docker build -t bikemap-backend:latest ./backend

echo -e "${GREEN}📦 Building frontend image...${NC}"
# Construct BRouter URL from base domain
docker build \
    --build-arg VITE_API_BASE_URL="$VITE_API_BASE_URL" \
    --build-arg VITE_BROUTER_BASE_URL="$VITE_BROUTER_BASE_URL" \
    -t bikemap-frontend:latest \
    ./frontend

echo -e "${GREEN}🧭 Building BRouter image...${NC}"
if [ ! -d "./routing-server/brouter" ]; then
    echo -e "${YELLOW}📥 Cloning BRouter repository...${NC}"
    cd routing-server
    git clone https://github.com/abrensch/brouter.git
    cd ..
else
    echo -e "${YELLOW}📥 Updating BRouter repository...${NC}"
    cd routing-server/brouter
    git pull origin master || git pull origin main
    cd ../..
fi
docker build -t brouter:latest ./routing-server/brouter

echo -e "${GREEN}💾 Saving images to tar files...${NC}"
mkdir -p ./dist
docker save bikemap-backend:latest | gzip > ./dist/bikemap-backend.tar.gz
docker save bikemap-frontend:latest | gzip > ./dist/bikemap-frontend.tar.gz
docker save brouter:latest | gzip > ./dist/brouter.tar.gz

echo -e "${GREEN}✅ Build complete!${NC}"
echo -e "${YELLOW}📁 Images saved to ./dist/${NC}"
echo -e "${YELLOW}🚀 Run './scripts/deploy.sh' to deploy to your VPS${NC}"