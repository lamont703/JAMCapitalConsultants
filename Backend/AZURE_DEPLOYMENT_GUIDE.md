# JAM Capital Backend - Azure Deployment Guide (Existing Resources)

This guide walks you through deploying the JAM Capital Backend to Microsoft Azure using your **existing Azure resources**.

## 🏗️ Existing Azure Resources

Your deployment will leverage these existing resources:

- **Resource Group**: `JAM_resource_group`
- **Cosmos DB Account**: `jamdb`
- **Database**: `jamdb` (existing)
- **Container**: `jamdbcontainer` (existing)
- **Storage Account**: `jamblobstorage`
- **Storage Container**: `jamblobstorage` (existing)

## 📋 Prerequisites

### Required Tools

- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) (v2.0+)
- [Node.js](https://nodejs.org/) (v22+)
- [Git](https://git-scm.com/)
- Azure subscription with appropriate permissions

### Required Permissions

Your Azure account needs these permissions on the existing resources:

- **JAM_resource_group**: Contributor access
- **jamdb**: Cosmos DB Contributor access
- **jamblobstorage**: Storage Blob Data Contributor access
- Ability to create new resources (App Service, Application Insights)

## 🚀 Quick Deployment (Recommended)

### Step 1: Verify Existing Resources

```bash
# Login to Azure
az login

# Verify your existing resources
az group show --name JAM_resource_group
az cosmosdb show --name jamdb --resource-group JAM_resource_group
az storage account show --name jamblobstorage --resource-group JAM_resource_group
```

### Step 2: Run Setup Script

```bash
# Navigate to backend directory
cd Backend

# Make script executable
chmod +x scripts/azure-setup.sh

# Run the setup script (uses your existing resources)
./scripts/azure-setup.sh
```

The script will:

- ✅ Verify your existing resources (including database and containers)
- 🆕 Create new App Service, App Service Plan, and Application Insights
- 🔗 Display connection strings for configuration

### Step 3: Configure Environment Variables

Copy the connection strings from the script output and configure them:

```bash
# Configure Azure App Service with connection strings
az webapp config appsettings set \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --settings \
    NODE_ENV=production \
    COSMOS_DB_CONNECTION_STRING="[FROM_SCRIPT_OUTPUT]" \
    COSMOS_DB_DATABASE_NAME="jamdb" \
    COSMOS_DB_CONTAINER_NAME="jamdbcontainer" \
    AZURE_STORAGE_CONNECTION_STRING="[FROM_SCRIPT_OUTPUT]" \
    AZURE_STORAGE_CONTAINER_NAME="jamblobstorage" \
    APPLICATIONINSIGHTS_CONNECTION_STRING="[FROM_SCRIPT_OUTPUT]" \
    OPENAI_API_KEY="[YOUR_API_KEY]" \
    JWT_SECRET="[YOUR_JWT_SECRET]"
```

### Step 4: Deploy Application

```bash
# Build and deploy
npm run build --if-present
zip -r deployment.zip . -x "node_modules/*" "*.git*" "*.env*"

# Deploy to Azure
az webapp deployment source config-zip \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --src deployment.zip
```

## 📦 Manual Deployment Steps

### Step 1: Create New Resources (Only)

Since you already have the core resources, we only need to create the hosting infrastructure:

```bash
# Create Application Insights
az monitor app-insights component create \
  --app jam-capital-insights \
  --location "East US" \
  --resource-group JAM_resource_group \
  --kind web

# Create App Service Plan
az appservice plan create \
  --name jam-capital-plan \
  --resource-group JAM_resource_group \
  --location "East US" \
  --sku B1 \
  --is-linux

# Create Web App
az webapp create \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --plan jam-capital-plan \
  --runtime "NODE|22-lts"
```

### Step 2: Verify Existing Resources

```bash
# Verify your existing database and containers
az cosmosdb sql database show \
  --account-name jamdb \
  --resource-group JAM_resource_group \
  --name jamdb

az cosmosdb sql container show \
  --account-name jamdb \
  --resource-group JAM_resource_group \
  --database-name jamdb \
  --name jamdbcontainer

# Verify storage container
STORAGE_KEY=$(az storage account keys list \
  --resource-group JAM_resource_group \
  --account-name jamblobstorage \
  --query '[0].value' -o tsv)

az storage container show \
  --name jamblobstorage \
  --account-name jamblobstorage \
  --account-key $STORAGE_KEY
```

## 🔧 GitHub Actions Deployment

### Step 1: Set Repository Secrets

In your GitHub repository, go to Settings > Secrets and add:

```bash
# Azure Service Principal (create with: az ad sp create-for-rbac)
AZURE_CREDENTIALS='{
  "clientId": "...",
  "clientSecret": "...",
  "subscriptionId": "...",
  "tenantId": "..."
}'

# Connection strings (get from Azure portal or script output)
COSMOS_DB_CONNECTION_STRING="AccountEndpoint=https://jamdb.documents.azure.com:443/;AccountKey=..."
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=jamblobstorage;AccountKey=..."
APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=...;IngestionEndpoint=..."

# Application secrets
OPENAI_API_KEY="your-openai-api-key"
JWT_SECRET="your-jwt-secret"
```

### Step 2: Create Service Principal

```bash
# Create service principal with contributor access to your resource group
az ad sp create-for-rbac \
  --name "jam-capital-github-actions" \
  --role contributor \
  --scopes /subscriptions/[SUBSCRIPTION_ID]/resourceGroups/JAM_resource_group \
  --sdk-auth
```

### Step 3: Deploy via GitHub Actions

The workflow is already configured to use your existing resources. Simply:

- Push to `main` branch for staging deployment
- Push to `production` branch for production deployment

## 🔗 Connection Strings Reference

### Get Cosmos DB Connection String

```bash
az cosmosdb keys list \
  --name jamdb \
  --resource-group JAM_resource_group \
  --type connection-strings \
  --query 'connectionStrings[0].connectionString' -o tsv
```

### Get Storage Connection String

```bash
az storage account show-connection-string \
  --name jamblobstorage \
  --resource-group JAM_resource_group \
  --query connectionString -o tsv
```

### Get Application Insights Connection String

```bash
az monitor app-insights component show \
  --app jam-capital-insights \
  --resource-group JAM_resource_group \
  --query connectionString -o tsv
```

## 🏥 Health Checks & Monitoring

### Health Check Endpoint

Your app will have a health check at: `https://jam-capital-backend.azurewebsites.net/health`

### Azure Monitoring

- **Application Insights**: Monitor performance and errors
- **Log Stream**: Real-time logs in Azure portal
- **Metrics**: CPU, memory, and request metrics

## 🔒 Security Configuration

### Recommended Security Settings

```bash
# Enable HTTPS only
az webapp update \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --https-only true

# Configure custom domain (optional)
az webapp config hostname add \
  --webapp-name jam-capital-backend \
  --resource-group JAM_resource_group \
  --hostname api.jamcapitalconsultants.com
```

## 🛠️ Troubleshooting

### Common Issues

#### Issue: "Resource not found"

**Solution**: Verify resource names match exactly:

```bash
# Check your actual resource names
az group list --query "[].name" -o table
az cosmosdb list --resource-group JAM_resource_group --query "[].name" -o table
az storage account list --resource-group JAM_resource_group --query "[].name" -o table
```

#### Issue: "Insufficient permissions"

**Solution**: Ensure your account has Contributor access:

```bash
# Check your role assignments
az role assignment list --assignee [YOUR_EMAIL] --resource-group JAM_resource_group
```

#### Issue: "Connection string invalid"

**Solution**: Regenerate connection strings:

```bash
# Regenerate Cosmos DB keys
az cosmosdb regenerate-key --name jamdb --resource-group JAM_resource_group --key-kind primary

# Regenerate storage keys
az storage account keys renew --name jamblobstorage --resource-group JAM_resource_group --key primary
```

### Debug Deployment

```bash
# Check deployment status
az webapp deployment list --name jam-capital-backend --resource-group JAM_resource_group

# View application logs
az webapp log tail --name jam-capital-backend --resource-group JAM_resource_group

# Check app settings
az webapp config appsettings list --name jam-capital-backend --resource-group JAM_resource_group
```

## 💰 Cost Optimization

### Using Existing Resources Saves Money

By leveraging your existing resources, you're already optimizing costs:

- ✅ **Cosmos DB**: Reusing existing account (no additional account charges)
- ✅ **Storage**: Reusing existing account (no additional account charges)
- 🆕 **App Service**: New B1 plan (~$13/month)
- 🆕 **Application Insights**: Pay-per-use (likely <$5/month)

### Additional Savings

```bash
# Use auto-scaling to reduce costs
az webapp config appsettings set \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --settings WEBSITE_RUN_FROM_PACKAGE=1

# Configure staging slot for cost-effective testing
az webapp deployment slot create \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --slot staging
```

## 📊 Production Checklist

Before going live, ensure:

- [ ] All existing resources verified and accessible
- [ ] Connection strings configured securely
- [ ] Health checks passing
- [ ] HTTPS enabled
- [ ] Application Insights monitoring active
- [ ] Backup strategy for new containers/databases
- [ ] Rate limiting configured
- [ ] CORS settings configured for your domain
- [ ] Environment variables set correctly
- [ ] GitHub Actions secrets configured

## 🆘 Support Resources

- [Azure App Service Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Azure Cosmos DB Documentation](https://docs.microsoft.com/en-us/azure/cosmos-db/)
- [Azure Storage Documentation](https://docs.microsoft.com/en-us/azure/storage/)
- [Azure CLI Reference](https://docs.microsoft.com/en-us/cli/azure/)

## 📞 Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Review Azure portal logs and metrics
3. Check GitHub Actions workflow logs
4. Verify all connection strings and environment variables

Your deployment leverages existing Azure infrastructure while adding only the necessary hosting components, making it both cost-effective and reliable! 🚀
