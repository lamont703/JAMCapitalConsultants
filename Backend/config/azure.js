const azure = {
  // Use existing Azure resources
  resourceGroup: process.env.AZURE_RESOURCE_GROUP || 'JAM_resource_group',
  cosmosAccount: process.env.AZURE_COSMOS_ACCOUNT || 'jamdb',
  storageAccount: process.env.AZURE_STORAGE_ACCOUNT || 'jamblobstorage',
  
  // New resources that will be created during deployment
  appService: process.env.AZURE_WEBAPP_NAME || 'jam-capital-backend',
  appInsights: process.env.AZURE_APP_INSIGHTS || 'jam-capital-insights',
  
  // Connection strings (from environment)
  cosmosConnectionString: process.env.COSMOS_DB_CONNECTION_STRING,
  storageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
  appInsightsConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING,
  
  // Database configuration using existing Cosmos DB
  database: {
    name: process.env.COSMOS_DB_DATABASE_NAME || 'jamdb',
    container: process.env.COSMOS_DB_CONTAINER_NAME || 'jamdbcontainer',
    partitionKey: '/userId'
  },
  
  // Storage configuration using existing Storage Account
  storage: {
    containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'jamblobstorage',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  },
  
  // Performance settings
  performance: {
    connectionPoolSize: 10,
    requestTimeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  },
  
  // Security settings
  security: {
    enableHttps: true,
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
      'https://jamcapitalconsultants.com',
      'https://www.jamcapitalconsultants.com'
    ],
    rateLimiting: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    }
  },
  
  // Health check configuration
  healthCheck: {
    path: '/health',
    timeout: 5000,
    checks: {
      cosmos: true,
      storage: true,
      memory: true,
      disk: false // App Service handles disk monitoring
    }
  },
  
  // Logging configuration for Application Insights
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: process.env.NODE_ENV === 'development',
    enableApplicationInsights: process.env.NODE_ENV === 'production',
    customEvents: [
      'user_registration',
      'subscription_upgrade',
      'document_upload',
      'api_error'
    ]
  },
  
  // Feature flags for Azure-specific features
  features: {
    enableApplicationInsights: process.env.NODE_ENV === 'production',
    enableCompression: true,
    enableCaching: true,
    enableRateLimiting: true,
    enableSecurity: true
  }
};

// Validation helper
function validateAzureConfig() {
  const requiredEnvVars = [
    'COSMOS_DB_CONNECTION_STRING',
    'AZURE_STORAGE_CONNECTION_STRING'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required Azure environment variables: ${missingVars.join(', ')}`);
  }
  
  return true;
}

// Connection health check
async function checkAzureConnections() {
  const status = {
    cosmos: false,
    storage: false,
    timestamp: new Date().toISOString()
  };
  
  try {
    // These checks would be implemented with actual Azure SDK calls
    // For now, just check if connection strings are present
    status.cosmos = !!azure.cosmosConnectionString;
    status.storage = !!azure.storageConnectionString;
  } catch (error) {
    console.error('Azure connection check failed:', error);
  }
  
  return status;
}

module.exports = {
  azure,
  validateAzureConfig,
  checkAzureConnections
}; 