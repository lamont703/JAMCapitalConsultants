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

### Method 2: Azure CLI Direct Deployment

```bash
# Navigate to Backend directory
cd Backend

# Create a production build
npm ci --only=production

# Deploy to Azure
az webapp up \
  --name jam-capital-backend \
  --resource-group jam-capital-rg \
  --plan jam-capital-plan
```

### Method 3: Azure DevOps (Alternative)

1. Create Azure DevOps project
2. Connect to your GitHub repository
3. Create build and release pipelines
4. Configure service connections to Azure

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

---

**Last Updated:** December 2024
**Version:** 1.0
**Maintainer:** JAM Capital Consultants Development Team
