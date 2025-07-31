#!/bin/bash

# JAM Capital - Cost-Effective Environment Setup
# Creates development and staging environments without expensive separate databases

set -e

echo "💰 JAM Capital Cost-Effective Environment Setup"
echo "==============================================="
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m' 
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

print_info "Creating cost-effective environment templates..."

# Create FREE emulator option
cat > Backend/env-templates/development-emulator.env.template << 'DEV_EOF'
# JAM Capital - FREE Development Environment (Cosmos Emulator)
NODE_ENV=development
PORT=3000

# === COSMOS DB EMULATOR (FREE) ===
COSMOS_ENDPOINT=https://localhost:8081
COSMOS_KEY=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==
COSMOS_DATABASE_NAME=jamdb-local
COSMOS_CONTAINER_NAME=jamdbcontainer-local

# === LOCAL STORAGE (FREE) ===
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
AZURE_STORAGE_CONTAINER_NAME=jam-uploads-dev

# === GHL (Test Environment) ===
GHL_ACCESS_TOKEN=your-test-ghl-token
GHL_LOCATION_ID=your-test-location-id

# === JWT SECRET ===
JWT_SECRET=development-jwt-secret-for-local-testing-only
DEV_EOF

# Create LOW COST shared database option  
cat > Backend/env-templates/development-shared.env.template << 'SHARED_EOF'
# JAM Capital - LOW COST Development Environment (Shared Database)
NODE_ENV=development
PORT=3000

# === SHARED DATABASE WITH SEPARATE CONTAINER ===
COSMOS_ENDPOINT=https://jamdb.documents.azure.com:443/
COSMOS_KEY=your-existing-production-cosmos-key
COSMOS_DATABASE_NAME=jamdb
COSMOS_CONTAINER_NAME=jamdbcontainer-dev

# === SHARED STORAGE WITH SEPARATE CONTAINER ===
AZURE_STORAGE_CONNECTION_STRING=your-existing-storage-connection
AZURE_STORAGE_CONTAINER_NAME=jam-uploads-dev

# === GHL (Test Environment) ===
GHL_ACCESS_TOKEN=your-test-ghl-token
GHL_LOCATION_ID=your-test-location-id

# === JWT SECRET ===
JWT_SECRET=development-jwt-secret-different-from-production
SHARED_EOF

print_success "Created cost-effective environment templates"
print_info "💰 Choose FREE emulator OR $5-10/month shared database approach"
print_info "📄 See COST_EFFECTIVE_ENVIRONMENT_STRATEGY.md for details"
