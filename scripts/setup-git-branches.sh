#!/bin/bash

# JAM Capital Consultants - Git Branch Setup Script
# This script creates the recommended branch structure for safe development

set -e  # Exit on any error

echo "🌳 JAM Capital Git Branch Setup"
echo "==============================="
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

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    print_error "Not in a git repository. Please run this from your JAM Website root directory."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "Backend/server.js" ]; then
    print_error "Please run this script from the JAM Website root directory"
    exit 1
fi

print_info "Setting up JAM Capital branching strategy..."
echo ""

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
print_info "Current branch: $CURRENT_BRANCH"

# Make sure we have the latest from origin
print_info "Fetching latest changes from origin..."
git fetch origin

# Step 1: Ensure we're on main/master
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
    MAIN_BRANCH="$CURRENT_BRANCH"
else
    # Check if main or master exists
    if git show-ref --verify --quiet refs/heads/main; then
        MAIN_BRANCH="main"
    elif git show-ref --verify --quiet refs/heads/master; then
        MAIN_BRANCH="master"
    else
        print_error "Could not find main or master branch"
        exit 1
    fi
    
    print_info "Switching to $MAIN_BRANCH branch..."
    git checkout "$MAIN_BRANCH"
fi

git pull origin "$MAIN_BRANCH"
print_status "Updated $MAIN_BRANCH branch"

# Step 2: Create development branch
print_info "Creating development branch..."

if git show-ref --verify --quiet refs/heads/development; then
    print_warning "Development branch already exists"
    git checkout development
    git pull origin development 2>/dev/null || git pull origin "$MAIN_BRANCH"
else
    git checkout -b development
    git push -u origin development
    print_status "Created and pushed development branch"
fi

# Step 3: Create staging branch
print_info "Creating staging branch..."

if git show-ref --verify --quiet refs/heads/staging; then
    print_warning "Staging branch already exists"
    git checkout staging
    git pull origin staging 2>/dev/null || git pull origin "$MAIN_BRANCH"
else
    git checkout "$MAIN_BRANCH"
    git checkout -b staging
    git push -u origin staging
    print_status "Created and pushed staging branch"
fi

# Step 4: Return to main branch
git checkout "$MAIN_BRANCH"
print_status "Returned to $MAIN_BRANCH branch"

# Step 5: Display current branch structure
echo ""
print_info "Current branch structure:"
echo ""
git branch -a | grep -E "(main|master|development|staging)" | head -10

echo ""
print_info "Branch purposes:"
echo "  🚀 $MAIN_BRANCH     → Production (live website)"
echo "  🧪 staging      → Pre-production testing"
echo "  🔧 development  → Development integration"
echo ""

# Step 6: Set up branch protection recommendations
echo ""
print_warning "IMPORTANT: Set up branch protection rules on GitHub:"
echo ""
echo "1. Go to: GitHub Repository → Settings → Branches"
echo ""
echo "2. For '$MAIN_BRANCH' branch:"
echo "   ✅ Require pull request reviews before merging"
echo "   ✅ Require status checks to pass before merging"
echo "   ✅ Include administrators"
echo ""
echo "3. For 'staging' branch:"
echo "   ✅ Require pull request reviews before merging"
echo ""

# Step 7: Environment mapping reminder
echo ""
print_info "Environment mapping:"
echo ""
echo "🚀 $MAIN_BRANCH branch     → https://jam-capital-backend.azurewebsites.net"
echo "🧪 staging branch    → https://jam-capital-staging.azurewebsites.net (create this)"
echo "🔧 development branch → http://localhost:3000 (local development)"
echo ""

# Step 8: Next steps
echo ""
print_status "Git branching setup complete!"
echo ""
print_info "Next steps:"
echo "1. Set up branch protection rules on GitHub (see instructions above)"
echo "2. Create staging Azure resources if not already done"
echo "3. Configure CI/CD pipeline for automatic deployments"
echo "4. Start using the development workflow:"
echo ""
echo "   # Start new feature:"
echo "   git checkout development"
echo "   git checkout -b feature/your-feature-name"
echo ""
echo "   # Deploy to staging:"
echo "   git checkout staging"
echo "   git merge development"
echo "   git push origin staging"
echo ""
echo "   # Deploy to production:"
echo "   git checkout $MAIN_BRANCH"
echo "   git merge staging"
echo "   git push origin $MAIN_BRANCH"
echo ""

# Step 9: Create a quick reference guide
cat > GIT_WORKFLOW_QUICK_REFERENCE.md << 'EOF'
# Git Workflow Quick Reference

## Daily Development Commands

### Start New Feature
```bash
git checkout development
git pull origin development
git checkout -b feature/your-feature-name
```

### Push Feature to GitHub
```bash
git add .
git commit -m "feat: description of your feature"
git push origin feature/your-feature-name
# Then create PR on GitHub: feature/your-feature-name → development
```

### Deploy to Staging
```bash
git checkout staging
git pull origin staging
git merge development
git push origin staging
```

### Deploy to Production
```bash
git checkout main
git pull origin main
git merge staging
git push origin main
```

### Emergency Hotfix
```bash
git checkout main
git checkout -b hotfix/critical-issue
# Fix the issue
git add .
git commit -m "hotfix: description"
git push origin hotfix/critical-issue
# Create PR: hotfix/critical-issue → main
```

## Branch Status Check
```bash
git branch -a
git status
git log --oneline -5
```
EOF

print_status "Created GIT_WORKFLOW_QUICK_REFERENCE.md for daily commands"

echo ""
print_status "Setup completed successfully! 🎉"
print_info "Read GIT_WORKFLOW_QUICK_REFERENCE.md for daily workflow commands" 