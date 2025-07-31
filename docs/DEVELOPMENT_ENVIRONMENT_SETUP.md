# JAM Capital Consultants - Development Environment Setup Guide

## 🎯 **Environment Strategy Overview**

### **Environment Separation**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DEVELOPMENT   │    │     TESTING     │    │   PRODUCTION    │
│                 │    │    (STAGING)    │    │                 │
│ • Local Setup   │───▶│ • Pre-prod Test │───▶│ • Live System   │
│ • Fast Iteration│    │ • Full Testing  │    │ • Real Users    │
│ • Safe Changes  │    │ • Integration   │    │ • High Uptime   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 **1. LOCAL DEVELOPMENT ENVIRONMENT**

### **Backend Setup (Node.js)**

#### **Directory Structure**

```
JAM Website/
├── Backend/
│   ├── .env.development     # Local dev settings
│   ├── .env.testing        # Test environment settings
│   ├── .env.production     # Production settings (encrypted)
│   ├── package.json
│   ├── server.js
│   └── ...
├── Frontend/
├── docs/
└── scripts/
    ├── setup-dev.sh
    ├── test-all.sh
    └── deploy.sh
```

#### **Environment Configuration**

**Create `.env.development`:**

```bash
# === LOCAL DEVELOPMENT ENVIRONMENT ===
NODE_ENV=development
PORT=3000

# === LOCAL DATABASE (Development) ===
COSMOS_ENDPOINT=https://jamdb-dev.documents.azure.com:443/
COSMOS_KEY=your-dev-cosmos-key
COSMOS_DATABASE_NAME=jamdb-development
COSMOS_CONTAINER_NAME=jamdbcontainer-dev

# === LOCAL STORAGE (Development) ===
AZURE_STORAGE_CONNECTION_STRING=your-dev-storage-connection
AZURE_STORAGE_CONTAINER_NAME=jam-uploads-dev

# === DEVELOPMENT GOHIGHLEVEL ===
GHL_ACCESS_TOKEN=your-dev-ghl-token
GHL_LOCATION_ID=your-dev-location-id
GHL_WEBHOOK_SECRET=dev-webhook-secret

# === SECURITY (Development) ===
JWT_SECRET=your-dev-jwt-secret-minimum-32-characters
ENCRYPTION_KEY=your-dev-encryption-key-here

# === DEVELOPMENT FLAGS ===
ENABLE_DEBUG_LOGGING=true
ENABLE_CORS_ALL=true
DISABLE_RATE_LIMITING=true
ENABLE_REQUEST_LOGGING=true

# === API BASE URLS ===
API_BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:8080
```

#### **Development Server Setup**

**Create `scripts/setup-dev.sh`:**

```bash
#!/bin/bash
echo "🔧 Setting up JAM Capital Development Environment..."

# Check Node.js version
node_version=$(node -v)
echo "📋 Node.js version: $node_version"

# Install dependencies
echo "📦 Installing dependencies..."
cd Backend && npm install

# Copy environment template
if [ ! -f .env.development ]; then
    echo "📄 Creating .env.development from template..."
    cp .env.example .env.development
    echo "⚠️  IMPORTANT: Update .env.development with your development credentials"
fi

# Create development database container if needed
echo "🗄️  Setting up development database..."
# Your database setup commands here

# Start development server
echo "🚀 Starting development server..."
npm run dev

echo "✅ Development environment ready!"
echo "🌐 Backend: http://localhost:3000"
echo "🎨 Frontend: http://localhost:8080"
echo "📊 Health Check: http://localhost:3000/api/health"
```

#### **Package.json Scripts**

```json
{
  "scripts": {
    "dev": "NODE_ENV=development nodemon server.js",
    "test": "NODE_ENV=testing npm run test:unit && npm run test:integration",
    "test:unit": "jest --config jest.config.js",
    "test:integration": "node scripts/integration-tests.js",
    "test:health": "node scripts/health-check.js",
    "build": "npm run test && npm run lint",
    "start": "NODE_ENV=production node server.js",
    "deploy:staging": "./scripts/deploy-staging.sh",
    "deploy:production": "./scripts/deploy-production.sh"
  }
}
```

## 🧪 **2. TESTING ENVIRONMENT (STAGING)**

### **Azure Staging Environment**

#### **Resource Naming Convention**

```
Production:          Staging:
- jam-capital-backend    - jam-capital-staging
- jamdb                  - jamdb-staging
- jamblobstorage        - jamblobstorage-staging
```

#### **Staging Environment Setup**

**Create `.env.testing`:**

```bash
# === STAGING ENVIRONMENT ===
NODE_ENV=testing
PORT=80

# === STAGING DATABASE ===
COSMOS_ENDPOINT=https://jamdb-staging.documents.azure.com:443/
COSMOS_KEY=your-staging-cosmos-key
COSMOS_DATABASE_NAME=jamdb-staging
COSMOS_CONTAINER_NAME=jamdbcontainer-staging

# === STAGING STORAGE ===
AZURE_STORAGE_CONNECTION_STRING=your-staging-storage-connection
AZURE_STORAGE_CONTAINER_NAME=jam-uploads-staging

# === STAGING GOHIGHLEVEL ===
GHL_ACCESS_TOKEN=your-staging-ghl-token
GHL_LOCATION_ID=your-staging-location-id
GHL_WEBHOOK_SECRET=staging-webhook-secret

# === STAGING SECURITY ===
JWT_SECRET=your-staging-jwt-secret-minimum-32-characters

# === STAGING FLAGS ===
ENABLE_DEBUG_LOGGING=true
ENABLE_COMPREHENSIVE_LOGGING=true
RATE_LIMIT_MAX_REQUESTS=1000

# === STAGING URLS ===
API_BASE_URL=https://jam-capital-staging.azurewebsites.net
FRONTEND_URL=https://staging.jamcapitalconsultants.com
```

### **Automated Testing Pipeline**

**Create `scripts/test-all.sh`:**

```bash
#!/bin/bash
echo "🧪 Running JAM Capital Test Suite..."

# Environment check
if [ "$NODE_ENV" != "testing" ]; then
    echo "❌ Must run in testing environment"
    exit 1
fi

# Unit Tests
echo "🔍 Running unit tests..."
npm run test:unit
if [ $? -ne 0 ]; then
    echo "❌ Unit tests failed"
    exit 1
fi

# Integration Tests
echo "🔗 Running integration tests..."
npm run test:integration
if [ $? -ne 0 ]; then
    echo "❌ Integration tests failed"
    exit 1
fi

# Health Checks
echo "💚 Running health checks..."
npm run test:health
if [ $? -ne 0 ]; then
    echo "❌ Health checks failed"
    exit 1
fi

# Database Tests
echo "🗄️  Running database tests..."
node scripts/test-database.js
if [ $? -ne 0 ]; then
    echo "❌ Database tests failed"
    exit 1
fi

# GHL Integration Tests
echo "🔗 Running GHL integration tests..."
node scripts/test-ghl-integration.js
if [ $? -ne 0 ]; then
    echo "❌ GHL integration tests failed"
    exit 1
fi

echo "✅ All tests passed! Ready for deployment."
```

## 🚀 **3. PRODUCTION ENVIRONMENT**

### **Production Safety Measures**

#### **Environment Configuration**

```bash
# === PRODUCTION ENVIRONMENT ===
NODE_ENV=production
PORT=80

# === PRODUCTION DATABASE ===
COSMOS_ENDPOINT=https://jamdb.documents.azure.com:443/
COSMOS_KEY=your-production-cosmos-key
COSMOS_DATABASE_NAME=jamdb
COSMOS_CONTAINER_NAME=jamdbcontainer

# === PRODUCTION SECURITY ===
JWT_SECRET=your-ultra-secure-production-jwt-secret
ENABLE_DEBUG_LOGGING=false
ENABLE_REQUEST_LOGGING=false
RATE_LIMIT_MAX_REQUESTS=100

# === PRODUCTION MONITORING ===
APPLICATIONINSIGHTS_CONNECTION_STRING=your-app-insights-connection
ENABLE_METRICS_COLLECTION=true
ENABLE_ERROR_TRACKING=true
```

## 🔄 **4. CI/CD PIPELINE SETUP**

### **Deployment Strategy**

```
Developer → Local Testing → Staging Deploy → Production Deploy
     ↓           ↓              ↓              ↓
  Feature     Integration    User Testing   Live Release
   Branch       Tests         & QA         to Users
```

### **Deployment Scripts**

**Create `scripts/deploy-staging.sh`:**

```bash
#!/bin/bash
echo "🚀 Deploying to JAM Capital Staging..."

# Run tests first
echo "🧪 Running pre-deployment tests..."
npm run test
if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Deployment cancelled."
    exit 1
fi

# Build application
echo "🔨 Building application..."
npm run build

# Deploy to Azure staging
echo "☁️  Deploying to Azure Staging..."
az webapp deployment source config-zip \
  --resource-group JAM_resource_group \
  --name jam-capital-staging \
  --src staging-deploy.zip

# Run post-deployment health checks
echo "💚 Running post-deployment health checks..."
sleep 30  # Wait for deployment
curl -f https://jam-capital-staging.azurewebsites.net/api/health
if [ $? -ne 0 ]; then
    echo "❌ Health check failed after deployment"
    exit 1
fi

echo "✅ Staging deployment successful!"
echo "🌐 Staging URL: https://jam-capital-staging.azurewebsites.net"
```

**Create `scripts/deploy-production.sh`:**

```bash
#!/bin/bash
echo "🚀 Deploying to JAM Capital Production..."
echo "⚠️  WARNING: This will deploy to LIVE PRODUCTION environment"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Production deployment cancelled"
    exit 1
fi

# Verify staging tests passed
echo "🧪 Verifying staging environment..."
curl -f https://jam-capital-staging.azurewebsites.net/api/health
if [ $? -ne 0 ]; then
    echo "❌ Staging environment unhealthy. Fix staging first."
    exit 1
fi

# Create production backup point
echo "💾 Creating production backup point..."
# Your backup commands here

# Deploy to production
echo "☁️  Deploying to Azure Production..."
az webapp deployment source config-zip \
  --resource-group JAM_resource_group \
  --name jam-capital-backend \
  --src production-deploy.zip

# Run critical health checks
echo "💚 Running production health checks..."
sleep 30
curl -f https://jam-capital-backend.azurewebsites.net/api/health
if [ $? -ne 0 ]; then
    echo "❌ CRITICAL: Production health check failed"
    echo "🔄 Consider rolling back immediately"
    exit 1
fi

echo "✅ Production deployment successful!"
echo "🌐 Production URL: https://jam-capital-backend.azurewebsites.net"
```

## 🛠️ **5. DEVELOPMENT WORKFLOW**

### **Daily Development Process**

```
1. Pull latest changes from main branch
2. Create feature branch: `git checkout -b feature/new-feature`
3. Develop & test locally: `npm run dev`
4. Run local tests: `npm run test`
5. Commit changes: `git commit -m "feat: description"`
6. Push to staging: `npm run deploy:staging`
7. Test on staging environment
8. Create pull request for production
9. Deploy to production: `npm run deploy:production`
```

### **Testing Strategy**

```
Local Development:
├── Unit Tests (Jest)
├── Integration Tests
├── Manual Testing
└── Health Checks

Staging Environment:
├── Full System Tests
├── User Acceptance Testing
├── Performance Testing
└── Security Testing

Production:
├── Health Monitoring
├── Performance Monitoring
├── Error Tracking
└── User Experience Monitoring
```

## 📊 **6. MONITORING & LOGGING**

### **Environment-Specific Monitoring**

#### **Development**

- Console logging enabled
- Detailed error messages
- Request/response logging
- No rate limiting

#### **Staging**

- Application Insights enabled
- Comprehensive logging
- Performance metrics
- Rate limiting (relaxed)

#### **Production**

- Full monitoring enabled
- Error tracking only
- Performance optimization
- Strict rate limiting

## 🔒 **7. SECURITY CONSIDERATIONS**

### **Environment Separation**

- **Different API keys** for each environment
- **Separate databases** to prevent data contamination
- **Different JWT secrets** for security isolation
- **Restricted access** to production resources

### **Secret Management**

```bash
# Never commit .env files to git
echo ".env*" >> .gitignore

# Use Azure Key Vault for production secrets
# Use environment variables in Azure App Service
# Use secure secret management tools
```

## 🚀 **8. QUICK START COMMANDS**

### **Initial Setup**

```bash
# Clone and setup development environment
git clone <repository>
cd "JAM Website"
chmod +x scripts/*.sh
./scripts/setup-dev.sh
```

### **Daily Development**

```bash
# Start development server
npm run dev

# Run tests
npm run test

# Deploy to staging
npm run deploy:staging

# Deploy to production (after staging verification)
npm run deploy:production
```

### **Emergency Procedures**

```bash
# Quick health check all environments
./scripts/health-check-all.sh

# Rollback production (if issues)
./scripts/rollback-production.sh

# Emergency maintenance mode
./scripts/maintenance-mode.sh
```

## ✅ **Next Steps**

1. **Create staging Azure resources**
2. **Set up environment variables**
3. **Configure CI/CD pipeline**
4. **Test deployment process**
5. **Train team on workflow**
6. **Document environment-specific procedures**

This setup ensures you can develop, test, and deploy safely without affecting your live production environment!
