# JAM Capital Backend - Azure Deployment Guide

This guide provides step-by-step instructions for deploying the JAM Capital Backend to Microsoft Azure.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure Resources Setup](#azure-resources-setup)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Methods](#deployment-methods)
5. [Post-Deployment Configuration](#post-deployment-configuration)
6. [Monitoring and Maintenance](#monitoring-and-maintenance)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- [Node.js 18.x or higher](https://nodejs.org/)
- [Git](https://git-scm.com/)
- Azure subscription with appropriate permissions

### Required Services

- Azure App Service
- Azure Cosmos DB
- Azure Blob Storage
- Azure Application Insights (recommended)

## Azure Resources Setup

### 1. Login to Azure

```bash
az login
az account set --subscription "your-subscription-id"
```

### 2. Create Resource Group

```bash
az group create \
  --name jam-capital-rg \
  --location "East US"
```

### 3. Create Azure Cosmos DB

```bash
# Create Cosmos DB account
az cosmosdb create \
  --name jam-capital-cosmos \
  --resource-group jam-capital-rg \
  --locations regionName="East US" failoverPriority=0 isZoneRedundant=False

# Create database
az cosmosdb sql database create \
  --account-name jam-capital-cosmos \
  --resource-group jam-capital-rg \
  --name jam-capital-production

# Create container
az cosmosdb sql container create \
  --account-name jam-capital-cosmos \
  --resource-group jam-capital-rg \
  --database-name jam-capital-production \
  --name jam-data \
  --partition-key-path "/userId" \
  --throughput 400
```

### 4. Create Azure Storage Account

```bash
# Create storage account
az storage account create \
  --name jamcapitalstorage \
  --resource-group jam-capital-rg \
  --location "East US" \
  --sku Standard_LRS \
  --kind StorageV2

# Create blob container
az storage container create \
  --name jam-uploads \
  --account-name jamcapitalstorage \
  --public-access container
```

### 5. Create Application Insights

```bash
az monitor app-insights component create \
  --app jam-capital-insights \
  --location "East US" \
  --resource-group jam-capital-rg \
  --kind web
```

### 6. Create App Service Plan

```bash
az appservice plan create \
  --name jam-capital-plan \
  --resource-group jam-capital-rg \
  --location "East US" \
  --sku B1 \
  --is-linux
```

### 7. Create Web App

```bash
az webapp create \
  --name jam-capital-backend \
  --resource-group jam-capital-rg \
  --plan jam-capital-plan \
  --runtime "NODE|18-lts"
```

## Environment Configuration

### 1. Get Connection Strings

#### Cosmos DB Connection String

```bash
az cosmosdb keys list \
  --name jam-capital-cosmos \
  --resource-group jam-capital-rg \
  --type connection-strings
```

#### Storage Account Connection String

```bash
az storage account show-connection-string \
  --name jamcapitalstorage \
  --resource-group jam-capital-rg
```

#### Application Insights Connection String

```bash
az monitor app-insights component show \
  --app jam-capital-insights \
  --resource-group jam-capital-rg \
  --query connectionString
```

### 2. Configure App Service Settings

Copy the values from `Backend/env.azure.example` and set them in Azure:

```bash
# Set Node.js version
az webapp config set \
  --name jam-capital-backend \
  --resource-group jam-capital-rg \
  --linux-fx-version "NODE|18-lts"

# Set application settings
az webapp config appsettings set \
  --name jam-capital-backend \
  --resource-group jam-capital-rg \
  --settings \
    NODE_ENV=production \
    COSMOS_DB_CONNECTION_STRING="your-cosmos-connection-string" \
    COSMOS_DB_DATABASE_NAME="jam-capital-production" \
    COSMOS_DB_CONTAINER_NAME="jam-data" \
    AZURE_STORAGE_CONNECTION_STRING="your-storage-connection-string" \
    AZURE_STORAGE_CONTAINER_NAME="jam-uploads" \
    APPLICATIONINSIGHTS_CONNECTION_STRING="your-appinsights-connection-string" \
    OPENAI_API_KEY="your-openai-api-key" \
    JWT_SECRET="your-secure-jwt-secret" \
    CORS_ORIGIN="https://your-domain.com"
```

### 3. Enable HTTPS and Configure Custom Domain (Optional)

```bash
# Force HTTPS redirect
az webapp update \
  --name jam-capital-backend \
  --resource-group jam-capital-rg \
  --https-only true

# Add custom domain (after DNS configuration)
az webapp config hostname add \
  --name jam-capital-backend \
  --resource-group jam-capital-rg \
  --hostname your-domain.com
```

## Deployment Methods

### Method 1: GitHub Actions (Recommended)

1. **Set up GitHub Secrets:**
   - Go to your GitHub repository settings
   - Add the following secrets:
     ```
     AZURE_WEBAPP_PUBLISH_PROFILE
     ```
2. **Get Publish Profile:**

   ```bash
   az webapp deployment list-publishing-profiles \
     --name jam-capital-backend \
     --resource-group jam-capital-rg \
     --xml
   ```

3. **Configure GitHub Actions:**
   - The workflow file is already created at `.github/workflows/azure-deploy.yml`
   - Update the `AZURE_WEBAPP_NAME` in the workflow file
   - Push to `main` branch to trigger deployment

### Method 2: Azure CLI Direct Deployment (RECOMMENDED)

```bash
# Navigate to Backend directory
cd Backend

# Create a production build
npm ci --only=production

# Deploy to Azure
az webapp up \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --location "East US 2" \
  --os-type "Linux" \
  --runtime "node|18-lts"
```

**Note:** This method has proven most reliable for our JAM Capital backend deployments. It handles:

- Automatic zip packaging
- Build process in Azure
- Runtime version management
- Dependency installation

**Typical deployment time:** 4-5 minutes including build and startup.

#### Permission Issues Solution

If you encounter permission errors like "Insufficient permissions to create a zip in current directory", use sudo:

```bash
# Deploy with elevated permissions
sudo az webapp up \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --location "East US 2" \
  --os-type "Linux" \
  --runtime "node|18-lts"
```

**Common Permission Error:**

```
Insufficient permissions to create a zip in current directory. Please re-run the command with administrator privileges
```

**Solution:** The Azure CLI needs to create temporary zip files during deployment. If you encounter permission issues, run the command with `sudo` to provide the necessary file system permissions.

#### Common Deployment Errors and Solutions

**Error 1: Incorrect Resource Group Name**

```
The webapp 'jam-capital-backend' exists in ResourceGroup 'JAM_resource_group' and does not match the value entered 'JAM_Website'.
```

**Solution:** Use the correct resource group name `JAM_resource_group`:

```bash
az webapp up \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --location "East US 2" \
  --os-type "Linux" \
  --runtime "node|18-lts"
```

**Error 2: Location Mismatch**

```
The resource 'jam-capital-plan' already exists in location 'eastus2' in resource group 'JAM_resource_group'. A resource with the same name cannot be created in location 'eastus'.
```

**Solution:** Use the correct location where existing resources are deployed (`East US 2` = `eastus2`):

```bash
az webapp up \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --location "East US 2" \
  --os-type "Linux" \
  --runtime "node|18-lts"
```

**Verified Working Command:**

```bash
az webapp up \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --location "East US 2" \
  --os-type "Linux" \
  --runtime "node|18-lts"
```

### Method 3: Azure DevOps (Alternative)

1. Create Azure DevOps project
2. Connect to your GitHub repository
3. Create build and release pipelines
4. Configure service connections to Azure

## GoHighLevel Integration Deployment

### Prerequisites for GHL Integration

Before deploying, ensure you have:

1. Valid GHL OAuth tokens in `Backend/config/ghl-tokens.json`
2. GHL environment variables configured in local `.env` file

### Step 1: Add Missing GHL Environment Variables

```bash
# Run from Backend directory
cd Backend

# Add missing GHL environment variables to Azure
az webapp config appsettings set \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --settings \
    GHL_API_KEY="your-ghl-api-key" \
    GHL_BASE_URL="https://services.leadconnectorhq.com" \
    GHL_WEBHOOK_SECRET="your-webhook-secret" \
    GHL_REDIRECT_URI="https://jamcapitalconsultants.com/oauth/callback" \
    GHL_STARTER_ADDITIONAL_CREDITS_LINK="your-starter-link" \
    GHL_PROFESSIONAL_ADDITIONAL_CREDITS_LINK="your-professional-link" \
    GHL_PREMIUM_ADDITIONAL_CREDITS_LINK="your-premium-link"
```

### Step 2: Deploy GHL Tokens as Environment Variables

```bash
# Extract and set GHL tokens from local config
./fix-ghl-tokens-via-env.sh
```

Or manually:

```bash
# Extract tokens from ghl-tokens.json and set as environment variables
ACCESS_TOKEN=$(node -e "const tokens = require('./config/ghl-tokens.json'); console.log(tokens.access_token);")
REFRESH_TOKEN=$(node -e "const tokens = require('./config/ghl-tokens.json'); console.log(tokens.refresh_token);")
EXPIRES_AT=$(node -e "const tokens = require('./config/ghl-tokens.json'); console.log(tokens.expires_at);")

az webapp config appsettings set \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --settings \
    GHL_STORED_ACCESS_TOKEN="$ACCESS_TOKEN" \
    GHL_STORED_REFRESH_TOKEN="$REFRESH_TOKEN" \
    GHL_TOKEN_EXPIRES_AT="$EXPIRES_AT"
```

### Step 3: Deploy Code with GHL Support

```bash
# Use the standard deployment method
az webapp up \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --plan jam-capital-plan
```

### Step 4: Verify GHL Integration

```bash
# Test registration with GHL sync
curl -X POST 'https://jam-capital-backend.azurewebsites.net/api/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "+1234567890",
    "password": "Test123!",
    "securityQuestion": "mother_maiden_name",
    "securityAnswer": "test"
  }'

# Check for successful GHL sync:
# - ghlContactId should have a value
# - ghlSyncStatus should be "success"
```

### Troubleshooting GHL Integration

**Issue:** `ghlSyncStatus: "failed"` or `ghlContactId: ""`

**Solutions:**

1. Verify all GHL environment variables are set
2. Check that GHL tokens are not expired
3. Ensure the code includes environment variable fallback for tokens
4. Restart the Azure App Service after setting new variables

**Check Environment Variables:**

```bash
# List all app settings to verify GHL variables
az webapp config appsettings list \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --query "[?contains(name, 'GHL')]"
```

## Post-Deployment Configuration

### 1. Verify Deployment

```bash
# Check app status
az webapp show \
  --name jam-capital-backend \
  --resource-group jam-capital-rg \
  --query state

# Test health endpoint
curl https://jam-capital-backend.azurewebsites.net/api/health
```

### 2. Configure Auto-Scaling

```bash
# Create auto-scale settings
az monitor autoscale create \
  --resource-group jam-capital-rg \
  --resource jam-capital-backend \
  --resource-type Microsoft.Web/sites \
  --name jam-capital-autoscale \
  --min-count 1 \
  --max-count 3 \
  --count 1

# Add scale-out rule
az monitor autoscale rule create \
  --resource-group jam-capital-rg \
  --autoscale-name jam-capital-autoscale \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 1
```

### 3. Configure Application Insights Alerts

```bash
# CPU usage alert
az monitor metrics alert create \
  --name "High CPU Usage" \
  --resource-group jam-capital-rg \
  --scopes /subscriptions/{subscription-id}/resourceGroups/jam-capital-rg/providers/Microsoft.Web/sites/jam-capital-backend \
  --condition "avg Percentage CPU > 80" \
  --description "Alert when CPU usage is high"
```

### 4. Set up Backup (Optional)

```bash
# Create storage account for backups
az storage account create \
  --name jamcapitalbackups \
  --resource-group jam-capital-rg \
  --sku Standard_LRS

# Configure app backup
az webapp config backup create \
  --resource-group jam-capital-rg \
  --webapp-name jam-capital-backend \
  --backup-name daily-backup \
  --storage-account-url "https://jamcapitalbackups.blob.core.windows.net/backups" \
  --frequency 1440 \
  --retain-one true \
  --retention 30
```

## Monitoring and Maintenance

### 1. Monitor Application Performance

- Use Azure Application Insights dashboard
- Set up custom alerts for error rates
- Monitor Cosmos DB performance metrics
- Track storage usage and costs

### 2. View Logs

```bash
# Stream live logs
az webapp log tail \
  --name jam-capital-backend \
  --resource-group jam-capital-rg

# Download log files
az webapp log download \
  --name jam-capital-backend \
  --resource-group jam-capital-rg
```

### 3. Regular Maintenance Tasks

#### Weekly:

- Review Application Insights for errors
- Check resource usage and scaling needs
- Verify backup completion

#### Monthly:

- Review and optimize Cosmos DB performance
- Analyze storage costs and cleanup unused files
- Update dependencies and security patches

### 4. Performance Optimization

#### Cosmos DB Optimization:

```bash
# Check RU consumption
az cosmosdb sql container throughput show \
  --account-name jam-capital-cosmos \
  --resource-group jam-capital-rg \
  --database-name jam-capital-production \
  --name jam-data
```

#### App Service Optimization:

- Enable compression in `web.config`
- Use CDN for static assets (if serving any)
- Optimize container startup time

## Troubleshooting

### Deployment Issues

#### 1. Resource Group Name Errors

**Error Message:**

```
The webapp 'jam-capital-backend' exists in ResourceGroup 'JAM_resource_group' and does not match the value entered 'JAM_Website'.
```

**Cause:** Using incorrect resource group name in deployment command.

**Solution:** Always use the correct resource group name `JAM_resource_group`:

```bash
az webapp up \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --location "East US 2" \
  --os-type "Linux" \
  --runtime "node|18-lts"
```

#### 2. Location Mismatch Errors

**Error Message:**

```
The resource 'jam-capital-plan' already exists in location 'eastus2' in resource group 'JAM_resource_group'. A resource with the same name cannot be created in location 'eastus'.
```

**Cause:** Attempting to deploy to a different location than where existing resources are located.

**Solution:** Use the correct location `"East US 2"` (which maps to `eastus2`):

```bash
az webapp up \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --location "East US 2" \
  --os-type "Linux" \
  --runtime "node|18-lts"
```

**Prevention:** Always include the full deployment parameters to avoid location/resource conflicts.

### Common Issues

#### 1. App Won't Start

**Symptoms:** HTTP 503 errors, app showing as "Stopped"

**Solutions:**

```bash
# Check app logs
az webapp log tail --name jam-capital-backend --resource-group jam-capital-rg

# Restart the app
az webapp restart --name jam-capital-backend --resource-group jam-capital-rg

# Check Node.js version
az webapp config show --name jam-capital-backend --resource-group jam-capital-rg
```

#### 2. Database Connection Issues

**Symptoms:** 500 errors, "CosmosDB failed" in logs

**Solutions:**

- Verify Cosmos DB connection string
- Check firewall settings
- Ensure database and container exist

#### 3. File Upload Issues

**Symptoms:** Upload failures, storage errors

**Solutions:**

- Verify Azure Storage connection string
- Check container permissions
- Ensure storage account is accessible

#### 4. Performance Issues

**Symptoms:** Slow response times, timeouts

**Solutions:**

- Scale up App Service plan
- Optimize Cosmos DB queries
- Enable auto-scaling
- Review Application Insights performance data

#### 5. GoHighLevel Integration Issues

**Symptoms:** `ghlSyncStatus: "failed"`, empty `ghlContactId`, registrations not appearing in GHL

**Root Causes:**

- Missing GHL environment variables in production
- Missing or expired OAuth tokens
- Code not supporting environment variable fallback

**Solutions:**

```bash
# 1. Verify GHL environment variables exist
az webapp config appsettings list \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --query "[?contains(name, 'GHL')]"

# 2. Set missing GHL environment variables
az webapp config appsettings set \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --settings \
    GHL_API_KEY="your-api-key" \
    GHL_BASE_URL="https://services.leadconnectorhq.com" \
    GHL_WEBHOOK_SECRET="your-secret"

# 3. Deploy GHL tokens as environment variables
cd Backend && ./fix-ghl-tokens-via-env.sh

# 4. Restart app service
az webapp restart \
  --name jam-capital-backend \
  --resource-group JAM_resource_group
```

**Prevention:**

- Always deploy GHL tokens as environment variables for production
- Include environment variable fallback in GHL token service code
- Test GHL integration after each deployment

### Debugging Tools

#### Enable Debug Logging:

```bash
az webapp config appsettings set \
  --name jam-capital-backend \
  --resource-group jam-capital-rg \
  --settings LOG_LEVEL=debug
```

#### Access Kudu Console:

Visit: `https://jam-capital-backend.scm.azurewebsites.net`

#### Check Environment Variables:

In Kudu console, go to Environment tab to verify all settings.

## Security Best Practices

### 1. Secrets Management

- Use Azure Key Vault for sensitive configuration
- Rotate connection strings regularly
- Enable managed identity where possible

### 2. Network Security

- Configure virtual networks if needed
- Use private endpoints for Cosmos DB
- Enable Azure Firewall rules

### 3. Access Control

- Use Azure Active Directory for authentication
- Implement RBAC for resource access
- Enable audit logging

## Cost Optimization

### 1. Resource Optimization

- Use Basic or Standard App Service plans for development
- Monitor and adjust Cosmos DB RU/s based on usage
- Use Azure Cost Management to track expenses

### 2. Storage Optimization

- Implement lifecycle policies for blob storage
- Use appropriate storage tiers (Hot/Cool/Archive)
- Regular cleanup of old files

### 3. Scaling Optimization

- Use auto-scaling to match demand
- Schedule scale-down during off-hours
- Monitor and adjust scaling rules based on usage patterns

## Support and Resources

- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Azure Cosmos DB Documentation](https://docs.microsoft.com/en-us/azure/cosmos-db/)
- [Azure Application Insights](https://docs.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)
- [Azure Support Plans](https://azure.microsoft.com/en-us/support/plans/)

## Quick Reference: Standard Deployment Process

For regular deployments with GHL integration:

```bash
# 1. Navigate to Backend directory
cd Backend

# 2. Ensure GHL tokens are current (if needed)
# Check local config/ghl-tokens.json expiry date

# 3. Deploy using verified working command
az webapp up \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --location "East US 2" \
  --os-type "Linux" \
  --runtime "node|18-lts"

# If you encounter permission issues, use sudo:
sudo az webapp up \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --location "East US 2" \
  --os-type "Linux" \
  --runtime "node|18-lts"

# 4. Verify deployment
curl -s https://jam-capital-backend.azurewebsites.net/health

# 5. Test GHL integration (optional)
curl -X POST 'https://jam-capital-backend.azurewebsites.net/api/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","phone":"+1234567890","password":"Test123!","securityQuestion":"mother_maiden_name","securityAnswer":"test"}'
```

**Expected Results:**

- Deployment time: 4-5 minutes
- Health check: Returns status information
- Registration test: `ghlSyncStatus: "success"` and populated `ghlContactId`

---

**Last Updated:** June 2025
**Version:** 2.0
**Maintainer:** JAM Capital Consultants Development Team
