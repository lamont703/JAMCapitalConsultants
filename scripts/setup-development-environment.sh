#!/bin/bash

# JAM Capital Consultants - Development Environment Setup Script
# This script sets up a safe development environment separate from production

set -e  # Exit on any error

echo "🚀 JAM Capital Development Environment Setup"
echo "=============================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "Backend/server.js" ]; then
    print_error "Please run this script from the JAM Website root directory"
    exit 1
fi

print_info "Setting up JAM Capital development environment..."
echo ""

# Step 1: Check Node.js version
print_info "Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_status "Node.js version: $NODE_VERSION"
    
    # Check if version is >= 16
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 16 ]; then
        print_warning "Node.js 16+ recommended. Current version: $NODE_VERSION"
    fi
else
    print_error "Node.js not found. Please install Node.js 16+ and try again."
    exit 1
fi

# Step 2: Install dependencies
print_info "Installing Backend dependencies..."
cd Backend
if [ -f "package.json" ]; then
    npm install
    print_status "Dependencies installed"
else
    print_error "package.json not found in Backend directory"
    exit 1
fi

# Step 3: Set up environment files
print_info "Setting up environment configuration..."

# Create .gitignore entry for .env files if not exists
if ! grep -q "\.env\*" ../.gitignore 2>/dev/null; then
    echo "" >> ../.gitignore
    echo "# Environment files" >> ../.gitignore
    echo ".env*" >> ../.gitignore
    echo "!.env.example" >> ../.gitignore
    echo "!env-templates/" >> ../.gitignore
    print_status "Added .env files to .gitignore for security"
fi

# Copy environment templates
if [ ! -f ".env.development" ]; then
    if [ -f "env-templates/development.env.template" ]; then
        cp env-templates/development.env.template .env.development
        print_status "Created .env.development from template"
        print_warning "IMPORTANT: Update .env.development with your development credentials"
    else
        print_error "Development template not found. Please check env-templates/ directory"
        exit 1
    fi
else
    print_info ".env.development already exists"
fi

# Step 4: Create development scripts in package.json
print_info "Updating package.json with development scripts..."

# Backup original package.json
cp package.json package.json.backup

# Check if dev script exists
if ! grep -q '"dev"' package.json; then
    # Add development scripts if they don't exist
    print_status "Adding development scripts to package.json"
    
    # Note: This is a simplified approach. In a real scenario, you might want to use a JSON parser
    print_warning "Please manually add these scripts to your package.json:"
    echo ""
    echo '  "scripts": {'
    echo '    "dev": "NODE_ENV=development nodemon server.js",'
    echo '    "test": "NODE_ENV=testing npm run test:unit && npm run test:integration",'
    echo '    "test:unit": "echo \"Unit tests not configured yet\"",'
    echo '    "test:integration": "echo \"Integration tests not configured yet\"",'
    echo '    "test:health": "node ../scripts/health-check.js",'
    echo '    "build": "echo \"Build process not configured yet\"",'
    echo '    "start": "NODE_ENV=production node server.js"'
    echo '  }'
    echo ""
else
    print_status "Development scripts already configured"
fi

# Step 5: Install development dependencies
print_info "Installing development dependencies..."
npm install --save-dev nodemon
print_status "Nodemon installed for auto-restart during development"

# Step 6: Create development database setup (if needed)
print_info "Development database setup..."
print_warning "Make sure to create separate development Cosmos DB resources:"
echo "  • Database: jamdb-development"
echo "  • Container: jamdbcontainer-dev"
echo "  • Storage: jam-uploads-dev"
echo ""

# Step 7: Verify development environment
print_info "Verifying development environment setup..."

# Check if required files exist
REQUIRED_FILES=(".env.development" "server.js" "package.json")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_status "$file exists"
    else
        print_error "$file missing"
        exit 1
    fi
done

# Step 8: Security check
print_info "Running security checks..."

# Check if .env files are in .gitignore
if grep -q "\.env" ../.gitignore; then
    print_status ".env files are properly ignored by git"
else
    print_warning ".env files may not be properly ignored by git"
fi

# Check .env.development for placeholder values
if grep -q "your-dev-" .env.development; then
    print_warning "Please update placeholder values in .env.development"
    print_info "Look for 'your-dev-*' values and replace with actual credentials"
fi

echo ""
echo "🎉 Development Environment Setup Complete!"
echo "=========================================="
echo ""
print_status "Your development environment is ready!"
echo ""
print_info "Next steps:"
echo "1. Update .env.development with your development credentials"
echo "2. Create separate development Azure resources (recommended)"
echo "3. Start development server: npm run dev"
echo "4. Access your app at: http://localhost:3000"
echo ""
print_warning "IMPORTANT REMINDERS:"
echo "• Never use production credentials in development"
echo "• Never commit .env files to git"
echo "• Use separate databases for development and production"
echo "• Test changes in development before deploying to production"
echo ""
print_info "To start development server:"
echo "  cd Backend"
echo "  npm run dev"
echo ""
print_info "To view this guide again:"
echo "  cat ../DEVELOPMENT_ENVIRONMENT_SETUP.md"
echo ""

# Go back to root directory
cd ..

print_status "Setup script completed successfully!" 