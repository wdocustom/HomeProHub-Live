#!/bin/bash
# Pre-deployment validation script
# Run this before deploying to production
# Exit code: 0 = success, 1 = failure

set -e  # Exit on any error

echo "================================"
echo "Pre-Deployment Validation"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js found:${NC} $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm found:${NC} $(npm --version)"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ package.json found${NC}"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  node_modules missing - running npm install${NC}"
    npm ci --production
else
    echo -e "${GREEN}✅ node_modules exists${NC}"
fi

# Validate critical dependencies
echo ""
echo "Checking critical dependencies..."

CRITICAL_DEPS=(
    "@supabase/supabase-js"
    "express"
    "dotenv"
)

for dep in "${CRITICAL_DEPS[@]}"; do
    if [ ! -d "node_modules/${dep}" ]; then
        echo -e "${RED}❌ Missing: ${dep}${NC}"
        echo "Run: npm ci --production"
        exit 1
    fi
    echo -e "${GREEN}✅ ${dep}${NC}"
done

# Check for logs directory
if [ ! -d "logs" ]; then
    echo -e "${YELLOW}⚠️  logs directory missing - creating${NC}"
    mkdir -p logs
else
    echo -e "${GREEN}✅ logs directory exists${NC}"
fi

# Validate environment variables
echo ""
echo "Validating environment variables..."
node scripts/validate-env.js
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Environment validation failed${NC}"
    exit 1
fi

# Test server module loading
echo ""
echo "Testing server module load..."
node -e "require('./server.js'); console.log('✅ Server module loads successfully'); process.exit(0);" 2>&1 | head -20
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo -e "${RED}❌ Server module failed to load${NC}"
    exit 1
fi

echo ""
echo "================================"
echo -e "${GREEN}✅ PRE-DEPLOYMENT VALIDATION PASSED${NC}"
echo "================================"
echo ""
echo "You can now deploy with:"
echo "  - npm run pm2:start (PM2)"
echo "  - npm start (direct)"
echo ""
exit 0
