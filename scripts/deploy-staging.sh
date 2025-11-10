#!/bin/bash

###############################################################################
# Staging Deployment Script
# Purpose: Automate deployment to staging environment
# Usage: ./scripts/deploy-staging.sh
###############################################################################

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

###############################################################################
# Pre-deployment checks
###############################################################################

log_info "Starting staging deployment process..."

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Check git status
log_info "Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
    log_warning "Working directory has uncommitted changes"
    log_info "Current changes:"
    git status --short
    read -p "Continue deployment? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled"
        exit 0
    fi
fi

###############################################################################
# Build preparation
###############################################################################

log_info "Preparing build environment..."

# Clean build artifacts
log_info "Removing old build artifacts..."
rm -rf .next .next.backup node_modules/.cache dist *.log 2>/dev/null || true

# TypeScript type check
log_info "Running TypeScript type check..."
if ! npm run tsc; then
    log_error "TypeScript check failed"
    exit 1
fi
log_success "TypeScript check passed"

# ESLint check
log_info "Running ESLint..."
if ! npm run lint; then
    log_error "ESLint check failed"
    exit 1
fi
log_success "ESLint check passed"

# Production build
log_info "Building for production..."
if ! NODE_ENV=production npm run build; then
    log_error "Production build failed"
    exit 1
fi
log_success "Production build completed"

###############################################################################
# Deployment to staging
###############################################################################

log_info "Preparing staging deployment..."

# Get deployment info
STAGING_HOST="${STAGING_HOST:-staging.aed.pics}"
STAGING_USER="${STAGING_USER:-deploy}"
STAGING_PATH="${STAGING_PATH:-/var/www/aedpics-staging}"
STAGING_PORT="${STAGING_PORT:-22}"

log_info "Deployment target:"
log_info "  Host: $STAGING_HOST"
log_info "  User: $STAGING_USER"
log_info "  Path: $STAGING_PATH"
log_info "  Port: $STAGING_PORT"

read -p "Proceed with staging deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Deployment cancelled"
    exit 0
fi

# Create deployment script
DEPLOY_SCRIPT=$(mktemp)
cat > "$DEPLOY_SCRIPT" << 'DEPLOYMENT_EOF'
#!/bin/bash
set -e

STAGING_PATH=$1
log_info() {
    echo "[INFO] $1"
}
log_success() {
    echo "[SUCCESS] $1"
}

cd "$STAGING_PATH" || exit 1

log_info "Fetching latest code..."
git fetch origin

log_info "Checking out main branch..."
git checkout origin/main

log_info "Installing production dependencies..."
npm ci --production

log_info "Generating Prisma client..."
npx prisma generate

log_info "Building application..."
NODE_ENV=production npm run build

log_info "Reloading PM2 processes (zero-downtime)..."
pm2 reload ecosystem.config.cjs

log_success "Staging deployment completed!"
pm2 status
DEPLOYMENT_EOF

chmod +x "$DEPLOY_SCRIPT"

# Execute deployment
log_info "Executing remote deployment..."
ssh -p "$STAGING_PORT" "$STAGING_USER@$STAGING_HOST" "bash -s $STAGING_PATH" < "$DEPLOY_SCRIPT"

if [ $? -eq 0 ]; then
    log_success "Deployment to staging completed!"
    log_info "Staging environment: https://$STAGING_HOST"
else
    log_error "Deployment failed"
    exit 1
fi

# Cleanup
rm -f "$DEPLOY_SCRIPT"

###############################################################################
# Post-deployment verification
###############################################################################

log_info "Verifying staging deployment..."

# Check staging server response
log_info "Checking server response..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://$STAGING_HOST")
if [ "$RESPONSE" = "200" ]; then
    log_success "Server responding with 200 OK"
else
    log_warning "Server returned HTTP $RESPONSE (expected 200)"
fi

# Get PM2 status
log_info "Checking PM2 status..."
ssh -p "$STAGING_PORT" "$STAGING_USER@$STAGING_HOST" "pm2 status"

log_success "Staging deployment verification completed!"
log_info "Next steps:"
log_info "  1. Run tests from STAGING_TEST_GUIDE.md"
log_info "  2. Record test results"
log_info "  3. Approve for production deployment"

###############################################################################
# Summary
###############################################################################

log_info "Deployment Summary:"
log_info "  Version: $(git rev-parse --short HEAD)"
log_info "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
log_info "  Environment: Staging"
log_info "  Status: Completed"

log_success "All deployment steps completed!"
