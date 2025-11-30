#!/bin/bash
# Setup Redis for PFA Vanguard
# ADR-008 - Rate Limiting and Caching Infrastructure

set -e

# Color output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== PFA Vanguard - Redis Setup ===${NC}\n"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}ERROR: Docker not found. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}ERROR: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Docker is running\n"

# Create network if it doesn't exist
if ! docker network inspect pfa-network > /dev/null 2>&1; then
    echo -e "${YELLOW}Creating Docker network: pfa-network${NC}"
    docker network create pfa-network
    echo -e "${GREEN}✓${NC} Network created\n"
else
    echo -e "${GREEN}✓${NC} Network pfa-network already exists\n"
fi

# Load environment variables
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
    echo -e "${GREEN}✓${NC} Loaded .env file\n"
else
    echo -e "${YELLOW}WARNING: .env file not found. Using default password.${NC}\n"
    export REDIS_PASSWORD="redis_dev_password"
fi

# Start Redis
echo -e "${YELLOW}Starting Redis container...${NC}"
cd ..
docker-compose -f docker-compose.redis.yml up -d

# Wait for Redis to be ready
echo -e "${YELLOW}Waiting for Redis to be ready...${NC}"
sleep 5

# Test connection
if docker exec pfa-redis redis-cli -a "${REDIS_PASSWORD}" ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Redis is ready\n"
else
    echo -e "${RED}ERROR: Redis failed to start${NC}"
    docker-compose -f docker-compose.redis.yml logs redis
    exit 1
fi

# Summary
echo -e "${GREEN}=== Redis Setup Complete ===${NC}\n"
echo "Redis connection details:"
echo "  Host: localhost"
echo "  Port: 6379"
echo "  Password: ${REDIS_PASSWORD}"
echo "  Connection URL: redis://:${REDIS_PASSWORD}@localhost:6379"
echo ""
echo "Redis Commander (Web UI):"
echo "  URL: http://localhost:8081"
echo "  Username: (none)"
echo "  Password: (none)"
echo ""
echo "Docker commands:"
echo "  Start: docker-compose -f docker-compose.redis.yml up -d"
echo "  Stop: docker-compose -f docker-compose.redis.yml down"
echo "  Logs: docker-compose -f docker-compose.redis.yml logs -f redis"
echo "  CLI: docker exec -it pfa-redis redis-cli -a ${REDIS_PASSWORD}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Update .env with REDIS_URL and REDIS_PASSWORD"
echo "  2. Restart backend server to use Redis"
echo "  3. Test rate limiting endpoints"
