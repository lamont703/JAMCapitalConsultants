#!/bin/bash

# JAM Capital Backend - Create Web App with S1 Standard Tier
# This script creates the Web App using S1 tier to avoid Basic quota limits

set -e  # Exit on any error

# Configuration variables
RESOURCE_GROUP="JAM_resource_group"
LOCATION="East US"
APP_SERVICE_PLAN="jam-capital-plan"
WEB_APP="jam-capital-backend"

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

# Check if Azure CLI is installed and logged in
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! az account show &> /dev/null; then
        log_error "Not logged into Azure. Please run 'az login' first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create App Service Plan with S1 tier
create_app_service_plan() {
    log_info "Creating App Service Plan with S1 Standard tier: $APP_SERVICE_PLAN"
    
    if az appservice plan show --name "$APP_SERVICE_PLAN" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        log_warning "App Service Plan $APP_SERVICE_PLAN already exists"
        
        # Check current tier
        CURRENT_SKU=$(az appservice plan show --name "$APP_SERVICE_PLAN" --resource-group "$RESOURCE_GROUP" --query "sku.name" -o tsv)
        log_info "Current SKU: $CURRENT_SKU"
        
        if [ "$CURRENT_SKU" != "S1" ]; then
            log_warning "Updating plan to S1 Standard tier..."
            az appservice plan update \
                --name "$APP_SERVICE_PLAN" \
                --resource-group "$RESOURCE_GROUP" \
                --sku S1 \
                --output table
            log_success "App Service Plan updated to S1"
        fi
    else
        log_info "Creating new S1 Standard App Service Plan..."
        az appservice plan create \
            --name "$APP_SERVICE_PLAN" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --sku S1 \
            --is-linux \
            --output table
        
        log_success "S1 Standard App Service Plan created successfully"
    fi
}

# Create Web App with Node 22 LTS
create_web_app() {
    log_info "Creating Web App with Node 22 LTS: $WEB_APP"
    
    if az webapp show --name "$WEB_APP" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        log_warning "Web App $WEB_APP already exists"
        
        # Check and update runtime if needed
        CURRENT_RUNTIME=$(az webapp config show --name "$WEB_APP" --resource-group "$RESOURCE_GROUP" --query "linuxFxVersion" -o tsv)
        log_info "Current runtime: $CURRENT_RUNTIME"
        
        if [ "$CURRENT_RUNTIME" != "NODE|22-lts" ]; then
            log_info "Updating runtime to Node 22 LTS..."
            az webapp config set \
                --name "$WEB_APP" \
                --resource-group "$RESOURCE_GROUP" \
                --linux-fx-version "NODE|22-lts" \
                --output none
            log_success "Runtime updated to Node 22 LTS"
        fi
    else
        log_info "Creating new Web App with Node 22 LTS..."
        az webapp create \
            --name "$WEB_APP" \
            --resource-group "$RESOURCE_GROUP" \
            --plan "$APP_SERVICE_PLAN" \
            --runtime "NODE|22-lts" \
            --output table
        
        log_success "Web App created successfully"
    fi
    
    # Configure HTTPS only
    log_info "Configuring HTTPS redirect"
    az webapp update \
        --name "$WEB_APP" \
        --resource-group "$RESOURCE_GROUP" \
        --https-only true \
        --output none
    
    log_success "HTTPS redirect enabled"
}

# Configure basic app settings for Node 22
configure_app_settings() {
    log_info "Configuring Node 22 app settings..."
    
    az webapp config appsettings set \
        --name "$WEB_APP" \
        --resource-group "$RESOURCE_GROUP" \
        --settings \
            WEBSITE_NODE_DEFAULT_VERSION="~22" \
            NODE_ENV="production" \
            SCM_DO_BUILD_DURING_DEPLOYMENT="true" \
        --output table
    
    log_success "Basic Node 22 settings configured"
}

# Display success information
display_success_info() {
    echo ""
    echo "=================================================================="
    echo "🎉 SUCCESS! Web App Created with S1 Standard Tier"
    echo "=================================================================="
    echo ""
    echo "✅ **App Service Plan**: $APP_SERVICE_PLAN (S1 - ~$74/month)"
    echo "✅ **Web App**: $WEB_APP"
    echo "✅ **Runtime**: Node.js 22 LTS"
    echo "✅ **HTTPS**: Enabled"
    echo ""
    echo "🌐 **Your app URL**: https://$WEB_APP.azurewebsites.net"
    echo "📊 **Azure Portal**: https://portal.azure.com"
    echo ""
    echo "⚙️  **Next Steps**:"
    echo "1. Configure your environment variables in Azure Portal"
    echo "2. Deploy your application code"
    echo "3. Test your endpoints"
    echo ""
    echo "💡 **S1 Standard Tier Benefits**:"
    echo "   • Unlimited compute time"
    echo "   • Custom domains & SSL"
    echo "   • Auto-scaling capabilities"
    echo "   • Deployment slots"
    echo "   • Better performance than Basic tier"
    echo ""
    echo "💰 **Cost Note**: S1 is ~$74/month. You can scale down later if needed."
    echo ""
}

# Main execution
main() {
    echo ""
    echo "🚀 Creating JAM Capital Web App with S1 Standard Tier"
    echo "===================================================="
    echo ""
    
    check_prerequisites
    echo ""
    
    create_app_service_plan
    echo ""
    
    create_web_app
    echo ""
    
    configure_app_settings
    echo ""
    
    display_success_info
    
    log_success "Web App creation completed successfully! 🎉"
}

# Handle script interruption
trap 'log_error "Script interrupted."; exit 1' INT

# Run main function
main "$@" 