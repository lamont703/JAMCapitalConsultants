#!/bin/bash

# JAM Capital Backend - Try Free Tier in Alternative Regions
# This script tries to create a Free tier web app in different regions

set -e  # Exit on any error

# Configuration variables
RESOURCE_GROUP="JAM_resource_group"
APP_SERVICE_PLAN="jam-capital-plan-free"
WEB_APP="jam-capital-backend"

# Alternative regions to try (in order of preference)
REGIONS=("East US 2" "Central US" "West US 2" "West Europe" "North Europe" "Southeast Asia")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Try creating Free tier in different regions
try_free_tier_regions() {
    log_info "Trying Free tier in alternative regions..."
    
    for region in "${REGIONS[@]}"; do
        log_info "Attempting to create Free tier App Service Plan in: $region"
        
        PLAN_NAME="${APP_SERVICE_PLAN}-$(echo "$region" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')"
        
        # Try to create App Service Plan
        if az appservice plan create \
            --name "$PLAN_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$region" \
            --sku F1 \
            --is-linux \
            --output none 2>/dev/null; then
            
            log_success "Free tier App Service Plan created in: $region"
            
            # Try to create Web App
            if az webapp create \
                --name "$WEB_APP" \
                --resource-group "$RESOURCE_GROUP" \
                --plan "$PLAN_NAME" \
                --runtime "NODE|22-lts" \
                --output none 2>/dev/null; then
                
                log_success "Web App created successfully in: $region"
                
                # Configure HTTPS and settings
                az webapp update \
                    --name "$WEB_APP" \
                    --resource-group "$RESOURCE_GROUP" \
                    --https-only true \
                    --output none
                
                az webapp config appsettings set \
                    --name "$WEB_APP" \
                    --resource-group "$RESOURCE_GROUP" \
                    --settings \
                        WEBSITE_NODE_DEFAULT_VERSION="~22" \
                        NODE_ENV="production" \
                        SCM_DO_BUILD_DURING_DEPLOYMENT="true" \
                    --output none
                
                echo ""
                echo "=================================================================="
                echo "🎉 SUCCESS! Free Tier Web App Created"
                echo "=================================================================="
                echo ""
                echo "✅ **Region**: $region"
                echo "✅ **App Service Plan**: $PLAN_NAME (F1 - Free)"
                echo "✅ **Web App**: $WEB_APP"
                echo "✅ **Runtime**: Node.js 22 LTS"
                echo ""
                echo "🌐 **Your app URL**: https://$WEB_APP.azurewebsites.net"
                echo ""
                echo "⚠️  **Free Tier Limitations**:"
                echo "   • 60 minutes compute time per day"
                echo "   • No custom domains"
                echo "   • No SSL certificates"
                echo "   • 1GB storage"
                echo ""
                echo "💡 **Consider upgrading to B1 tier for production use**"
                echo ""
                return 0
            else
                log_warning "Web App creation failed in: $region"
                # Clean up the plan
                az appservice plan delete --name "$PLAN_NAME" --resource-group "$RESOURCE_GROUP" --yes --output none 2>/dev/null || true
            fi
        else
            log_warning "Free tier not available in: $region"
        fi
    done
    
    log_error "Free tier not available in any region. Consider using B1 tier instead."
    return 1
}

# Main execution
main() {
    echo ""
    echo "🌍 Trying Free Tier in Alternative Regions"
    echo "=========================================="
    echo ""
    
    if ! az account show &> /dev/null; then
        log_error "Not logged into Azure. Please run 'az login' first."
        exit 1
    fi
    
    try_free_tier_regions
}

# Run main function
main "$@" 