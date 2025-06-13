#!/bin/bash

# JAM Capital Backend - Azure Setup Script (Updated for Existing Resources)
# This script configures deployment using your existing Azure resources

set -e  # Exit on any error

# Configuration variables - Updated to match your existing resources
RESOURCE_GROUP="JAM_resource_group"  # Your existing resource group
LOCATION="East US"  # Adjust if your resources are in a different region
COSMOS_ACCOUNT="jamdb"  # Your existing Cosmos DB account
STORAGE_ACCOUNT="jamblobstorage"  # Your existing storage account
APP_INSIGHTS="jam-capital-insights"  # New - will be created
APP_SERVICE_PLAN="jam-capital-plan"  # New - will be created
WEB_APP="jam-capital-backend"  # New - will be created
DATABASE_NAME="jamdb"  # Your existing database
CONTAINER_NAME="jamdbcontainer"  # Your existing container
STORAGE_CONTAINER="jamblobstorage"  # Your existing storage container

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

# Check if Azure CLI is installed
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it first:"
        echo "https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    # Check if logged in
    if ! az account show &> /dev/null; then
        log_error "Not logged into Azure. Please run 'az login' first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Verify existing resources
verify_existing_resources() {
    log_info "Verifying existing Azure resources..."
    
    # Check resource group
    if az group show --name "$RESOURCE_GROUP" &> /dev/null; then
        log_success "Resource group '$RESOURCE_GROUP' found"
    else
        log_error "Resource group '$RESOURCE_GROUP' not found. Please check the name."
        exit 1
    fi
    
    # Check Cosmos DB
    if az cosmosdb show --name "$COSMOS_ACCOUNT" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        log_success "Cosmos DB account '$COSMOS_ACCOUNT' found"
    else
        log_error "Cosmos DB account '$COSMOS_ACCOUNT' not found. Please check the name."
        exit 1
    fi
    
    # Check Storage Account
    if az storage account show --name "$STORAGE_ACCOUNT" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        log_success "Storage account '$STORAGE_ACCOUNT' found"
    else
        log_error "Storage account '$STORAGE_ACCOUNT' not found. Please check the name."
        exit 1
    fi
}

# Verify existing Cosmos DB database and container
verify_cosmos_db() {
    log_info "Verifying existing Cosmos DB database and container..."
    
    # Check if database exists
    if az cosmosdb sql database show --account-name "$COSMOS_ACCOUNT" --resource-group "$RESOURCE_GROUP" --name "$DATABASE_NAME" &> /dev/null; then
        log_success "Cosmos DB database '$DATABASE_NAME' found"
    else
        log_error "Cosmos DB database '$DATABASE_NAME' not found. Please check the name."
        exit 1
    fi
    
    # Check if container exists
    if az cosmosdb sql container show --account-name "$COSMOS_ACCOUNT" --resource-group "$RESOURCE_GROUP" --database-name "$DATABASE_NAME" --name "$CONTAINER_NAME" &> /dev/null; then
        log_success "Cosmos DB container '$CONTAINER_NAME' found"
    else
        log_error "Cosmos DB container '$CONTAINER_NAME' not found. Please check the name."
        exit 1
    fi
}

# Verify existing Storage Account container
verify_storage_container() {
    log_info "Verifying existing storage container..."
    
    # Get storage account key
    STORAGE_KEY=$(az storage account keys list --resource-group "$RESOURCE_GROUP" --account-name "$STORAGE_ACCOUNT" --query '[0].value' -o tsv)
    
    # Check if container exists
    if az storage container show --name "$STORAGE_CONTAINER" --account-name "$STORAGE_ACCOUNT" --account-key "$STORAGE_KEY" &> /dev/null; then
        log_success "Storage container '$STORAGE_CONTAINER' found"
    else
        log_error "Storage container '$STORAGE_CONTAINER' not found. Please check the name."
        exit 1
    fi
}

# Note: Skipping Cosmos DB and Storage container creation since they already exist

# Create Application Insights (new resource)
create_app_insights() {
    log_info "Creating Application Insights: $APP_INSIGHTS"
    
    if az monitor app-insights component show --app "$APP_INSIGHTS" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        log_warning "Application Insights $APP_INSIGHTS already exists"
    else
        az monitor app-insights component create \
            --app "$APP_INSIGHTS" \
            --location "$LOCATION" \
            --resource-group "$RESOURCE_GROUP" \
            --kind web \
            --output table
        
        log_success "Application Insights created"
    fi
}

# Create App Service Plan (new resource)
create_app_service_plan() {
    log_info "Creating App Service Plan: $APP_SERVICE_PLAN"
    
    if az appservice plan show --name "$APP_SERVICE_PLAN" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        log_warning "App Service Plan $APP_SERVICE_PLAN already exists"
    else
        az appservice plan create \
            --name "$APP_SERVICE_PLAN" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --sku B1 \
            --is-linux \
            --output table
        
        log_success "App Service Plan created"
    fi
}

# Create Web App (new resource)
create_web_app() {
    log_info "Creating Web App: $WEB_APP"
    
    if az webapp show --name "$WEB_APP" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
        log_warning "Web App $WEB_APP already exists"
    else
        az webapp create \
            --name "$WEB_APP" \
            --resource-group "$RESOURCE_GROUP" \
            --plan "$APP_SERVICE_PLAN" \
            --runtime "NODE|22-lts" \
            --output table
        
        log_success "Web App created"
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

# Get connection strings and display them
get_connection_strings() {
    log_info "Retrieving connection strings from your existing resources..."
    
    echo ""
    echo "=================================================================="
    echo "🔗 CONNECTION STRINGS FOR YOUR EXISTING AZURE RESOURCES"
    echo "=================================================================="
    
    # Cosmos DB connection string
    echo ""
    echo "📊 COSMOS DB (Existing: $COSMOS_ACCOUNT):"
    echo "COSMOS_DB_CONNECTION_STRING="
    az cosmosdb keys list \
        --name "$COSMOS_ACCOUNT" \
        --resource-group "$RESOURCE_GROUP" \
        --type connection-strings \
        --query 'connectionStrings[0].connectionString' \
        -o tsv
    
    echo "COSMOS_DB_DATABASE_NAME=$DATABASE_NAME"
    echo "COSMOS_DB_CONTAINER_NAME=$CONTAINER_NAME"
    
    # Storage connection string
    echo ""
    echo "💾 STORAGE ACCOUNT (Existing: $STORAGE_ACCOUNT):"
    echo "AZURE_STORAGE_CONNECTION_STRING="
    az storage account show-connection-string \
        --name "$STORAGE_ACCOUNT" \
        --resource-group "$RESOURCE_GROUP" \
        --query connectionString \
        -o tsv
    
    echo "AZURE_STORAGE_CONTAINER_NAME=$STORAGE_CONTAINER"
    
    # Application Insights connection string
    echo ""
    echo "📈 APPLICATION INSIGHTS (New: $APP_INSIGHTS):"
    echo "APPLICATIONINSIGHTS_CONNECTION_STRING="
    az monitor app-insights component show \
        --app "$APP_INSIGHTS" \
        --resource-group "$RESOURCE_GROUP" \
        --query connectionString \
        -o tsv
    
    echo ""
    echo "=================================================================="
    echo "⚙️  NEXT STEPS:"
    echo "=================================================================="
    echo "1. Copy the connection strings above"
    echo "2. Configure them in your Azure App Service:"
    echo "   az webapp config appsettings set --name $WEB_APP --resource-group $RESOURCE_GROUP --settings [KEY=VALUE ...]"
    echo "3. Add your other environment variables (OPENAI_API_KEY, JWT_SECRET, etc.)"
    echo "4. Deploy your application using GitHub Actions or direct deployment"
    echo ""
    echo "🌐 Your app will be available at: https://$WEB_APP.azurewebsites.net"
    echo "📊 Monitor at: https://portal.azure.com"
    echo ""
    echo "💡 Existing resources used:"
    echo "   - Resource Group: $RESOURCE_GROUP"
    echo "   - Cosmos DB: $COSMOS_ACCOUNT"
    echo "   - Storage Account: $STORAGE_ACCOUNT"
    echo ""
}

# Main execution
main() {
    echo ""
    echo "🚀 JAM Capital Backend - Azure Deployment (Existing Resources)"
    echo "==============================================================="
    echo ""
    echo "Using your existing Azure resources:"
    echo "• Resource Group: $RESOURCE_GROUP"
    echo "• Cosmos DB: $COSMOS_ACCOUNT"
    echo "• Storage Account: $STORAGE_ACCOUNT"
    echo ""
    
    check_prerequisites
    echo ""
    
    # Verify existing resources first
    verify_existing_resources
    echo ""
    
    # Verify existing Cosmos DB database and container
    verify_cosmos_db
    echo ""
    
    # Verify existing Storage Account container
    verify_storage_container
    echo ""
    
    # Create new resources needed for deployment
    create_app_insights
    echo ""
    
    create_app_service_plan
    echo ""
    
    create_web_app
    echo ""
    
    get_connection_strings
    
    log_success "Azure deployment setup completed successfully! 🎉"
}

# Handle script interruption
trap 'log_error "Script interrupted. Some resources may have been created."; exit 1' INT

# Run main function
main "$@" 