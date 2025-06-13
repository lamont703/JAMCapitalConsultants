# JAM Capital Backend - Azure Setup Script (PowerShell)
# This script automates the creation of Azure resources needed for deployment

param(
    [string]$ResourceGroup = "jam-capital-rg",
    [string]$Location = "East US",
    [string]$CosmosAccount = "jam-capital-cosmos",
    [string]$StorageAccount = "jamcapitalstorage",
    [string]$AppInsights = "jam-capital-insights",
    [string]$AppServicePlan = "jam-capital-plan",
    [string]$WebApp = "jam-capital-backend",
    [string]$DatabaseName = "jam-capital-production",
    [string]$ContainerName = "jam-data",
    [string]$StorageContainer = "jam-uploads"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Helper functions
function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check if Azure CLI is installed
    try {
        $null = Get-Command az -ErrorAction Stop
    }
    catch {
        Write-Error "Azure CLI is not installed. Please install it first:"
        Write-Host "https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    }
    
    # Check if logged in
    try {
        $null = az account show 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "Not logged in"
        }
    }
    catch {
        Write-Error "Not logged into Azure. Please run 'az login' first."
        exit 1
    }
    
    Write-Success "Prerequisites check passed"
}

# Create resource group
function New-ResourceGroup {
    Write-Info "Creating resource group: $ResourceGroup"
    
    $existing = az group show --name $ResourceGroup 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "Resource group $ResourceGroup already exists"
    }
    else {
        az group create --name $ResourceGroup --location $Location --output table
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Resource group created"
        }
        else {
            throw "Failed to create resource group"
        }
    }
}

# Create Cosmos DB
function New-CosmosDB {
    Write-Info "Creating Cosmos DB account: $CosmosAccount"
    
    $existing = az cosmosdb show --name $CosmosAccount --resource-group $ResourceGroup 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "Cosmos DB account $CosmosAccount already exists"
    }
    else {
        az cosmosdb create `
            --name $CosmosAccount `
            --resource-group $ResourceGroup `
            --locations regionName=$Location failoverPriority=0 isZoneRedundant=False `
            --output table
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Cosmos DB account created"
        }
        else {
            throw "Failed to create Cosmos DB account"
        }
    }
    
    # Create database
    Write-Info "Creating Cosmos DB database: $DatabaseName"
    
    $existing = az cosmosdb sql database show --account-name $CosmosAccount --resource-group $ResourceGroup --name $DatabaseName 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "Database $DatabaseName already exists"
    }
    else {
        az cosmosdb sql database create `
            --account-name $CosmosAccount `
            --resource-group $ResourceGroup `
            --name $DatabaseName `
            --output table
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database created"
        }
        else {
            throw "Failed to create database"
        }
    }
    
    # Create container
    Write-Info "Creating Cosmos DB container: $ContainerName"
    
    $existing = az cosmosdb sql container show --account-name $CosmosAccount --resource-group $ResourceGroup --database-name $DatabaseName --name $ContainerName 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "Container $ContainerName already exists"
    }
    else {
        az cosmosdb sql container create `
            --account-name $CosmosAccount `
            --resource-group $ResourceGroup `
            --database-name $DatabaseName `
            --name $ContainerName `
            --partition-key-path "/userId" `
            --throughput 400 `
            --output table
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Container created"
        }
        else {
            throw "Failed to create container"
        }
    }
}

# Create Storage Account
function New-StorageAccount {
    Write-Info "Creating storage account: $StorageAccount"
    
    $existing = az storage account show --name $StorageAccount --resource-group $ResourceGroup 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "Storage account $StorageAccount already exists"
    }
    else {
        az storage account create `
            --name $StorageAccount `
            --resource-group $ResourceGroup `
            --location $Location `
            --sku Standard_LRS `
            --kind StorageV2 `
            --output table
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Storage account created"
        }
        else {
            throw "Failed to create storage account"
        }
    }
    
    # Create blob container
    Write-Info "Creating blob container: $StorageContainer"
    
    # Get storage account key
    $storageKey = az storage account keys list --resource-group $ResourceGroup --account-name $StorageAccount --query '[0].value' -o tsv
    
    $existing = az storage container show --name $StorageContainer --account-name $StorageAccount --account-key $storageKey 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "Container $StorageContainer already exists"
    }
    else {
        az storage container create `
            --name $StorageContainer `
            --account-name $StorageAccount `
            --account-key $storageKey `
            --public-access container `
            --output table
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Blob container created"
        }
        else {
            throw "Failed to create blob container"
        }
    }
}

# Create Application Insights
function New-AppInsights {
    Write-Info "Creating Application Insights: $AppInsights"
    
    $existing = az monitor app-insights component show --app $AppInsights --resource-group $ResourceGroup 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "Application Insights $AppInsights already exists"
    }
    else {
        az monitor app-insights component create `
            --app $AppInsights `
            --location $Location `
            --resource-group $ResourceGroup `
            --kind web `
            --output table
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Application Insights created"
        }
        else {
            throw "Failed to create Application Insights"
        }
    }
}

# Create App Service Plan
function New-AppServicePlan {
    Write-Info "Creating App Service Plan: $AppServicePlan"
    
    $existing = az appservice plan show --name $AppServicePlan --resource-group $ResourceGroup 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "App Service Plan $AppServicePlan already exists"
    }
    else {
        az appservice plan create `
            --name $AppServicePlan `
            --resource-group $ResourceGroup `
            --location $Location `
            --sku B1 `
            --is-linux `
            --output table
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "App Service Plan created"
        }
        else {
            throw "Failed to create App Service Plan"
        }
    }
}

# Create Web App
function New-WebApp {
    Write-Info "Creating Web App: $WebApp"
    
    $existing = az webapp show --name $WebApp --resource-group $ResourceGroup 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Warning "Web App $WebApp already exists"
    }
    else {
        az webapp create `
            --name $WebApp `
            --resource-group $ResourceGroup `
            --plan $AppServicePlan `
            --runtime "NODE|18-lts" `
            --output table
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Web App created"
        }
        else {
            throw "Failed to create Web App"
        }
    }
    
    # Configure HTTPS only
    Write-Info "Configuring HTTPS redirect"
    az webapp update `
        --name $WebApp `
        --resource-group $ResourceGroup `
        --https-only true `
        --output none
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "HTTPS redirect enabled"
    }
    else {
        Write-Warning "Failed to enable HTTPS redirect"
    }
}

# Get connection strings
function Get-ConnectionStrings {
    Write-Info "Retrieving connection strings..."
    
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "🔗 CONNECTION STRINGS FOR AZURE APP SERVICE" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    
    # Cosmos DB connection string
    Write-Host ""
    Write-Host "📊 COSMOS DB:" -ForegroundColor Yellow
    Write-Host "COSMOS_DB_CONNECTION_STRING=" -NoNewline
    $cosmosConnectionString = az cosmosdb keys list `
        --name $CosmosAccount `
        --resource-group $ResourceGroup `
        --type connection-strings `
        --query 'connectionStrings[0].connectionString' `
        -o tsv
    Write-Host $cosmosConnectionString
    
    Write-Host "COSMOS_DB_DATABASE_NAME=$DatabaseName"
    Write-Host "COSMOS_DB_CONTAINER_NAME=$ContainerName"
    
    # Storage connection string
    Write-Host ""
    Write-Host "💾 STORAGE ACCOUNT:" -ForegroundColor Yellow
    Write-Host "AZURE_STORAGE_CONNECTION_STRING=" -NoNewline
    $storageConnectionString = az storage account show-connection-string `
        --name $StorageAccount `
        --resource-group $ResourceGroup `
        --query connectionString `
        -o tsv
    Write-Host $storageConnectionString
    
    Write-Host "AZURE_STORAGE_CONTAINER_NAME=$StorageContainer"
    
    # Application Insights connection string
    Write-Host ""
    Write-Host "📈 APPLICATION INSIGHTS:" -ForegroundColor Yellow
    Write-Host "APPLICATIONINSIGHTS_CONNECTION_STRING=" -NoNewline
    $appInsightsConnectionString = az monitor app-insights component show `
        --app $AppInsights `
        --resource-group $ResourceGroup `
        --query connectionString `
        -o tsv
    Write-Host $appInsightsConnectionString
    
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "⚙️  NEXT STEPS:" -ForegroundColor Cyan
    Write-Host "==================================================" -ForegroundColor Cyan
    Write-Host "1. Copy the connection strings above"
    Write-Host "2. Configure them in your Azure App Service:"
    Write-Host "   az webapp config appsettings set --name $WebApp --resource-group $ResourceGroup --settings [KEY=VALUE ...]"
    Write-Host "3. Add your other environment variables (OPENAI_API_KEY, JWT_SECRET, etc.)"
    Write-Host "4. Deploy your application"
    Write-Host ""
    Write-Host "🌐 Your app will be available at: https://$WebApp.azurewebsites.net" -ForegroundColor Green
    Write-Host "📊 Monitor at: https://portal.azure.com" -ForegroundColor Green
    Write-Host ""
}

# Main execution
function Main {
    Write-Host ""
    Write-Host "🚀 JAM Capital Backend - Azure Setup (PowerShell)" -ForegroundColor Cyan
    Write-Host "=====================================================" -ForegroundColor Cyan
    Write-Host ""
    
    try {
        Test-Prerequisites
        Write-Host ""
        
        # Create all resources
        New-ResourceGroup
        Write-Host ""
        
        New-CosmosDB
        Write-Host ""
        
        New-StorageAccount
        Write-Host ""
        
        New-AppInsights
        Write-Host ""
        
        New-AppServicePlan
        Write-Host ""
        
        New-WebApp
        Write-Host ""
        
        Get-ConnectionStrings
        
        Write-Success "Azure setup completed successfully! 🎉"
    }
    catch {
        Write-Error "Script failed: $($_.Exception.Message)"
        Write-Host "Some resources may have been created. Check the Azure portal." -ForegroundColor Yellow
        exit 1
    }
}

# Handle Ctrl+C gracefully
$host.UI.RawUI.WindowTitle = "JAM Capital Azure Setup"

# Run main function
Main 