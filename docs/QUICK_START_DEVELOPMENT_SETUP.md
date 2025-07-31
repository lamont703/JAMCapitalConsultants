# 🚀 Quick Start: Development Environment Setup

## **IMMEDIATE STEPS TO GET STARTED**

### **1. Run the Setup Script (2 minutes)**

```bash
# From JAM Website root directory
cd "JAM Website"
./scripts/setup-development-environment.sh
```

### **2. Configure Your Development Environment**

```bash
# Copy and edit development environment
cd Backend
cp env-templates/development.env.template .env.development

# Edit with your development credentials (NEVER use production credentials!)
nano .env.development  # or your preferred editor
```

### **3. Start Development Server**

```bash
# Install nodemon if not already installed
npm install -g nodemon

# Start development server
npm run dev
# OR if script not added yet:
NODE_ENV=development nodemon server.js
```

### **4. Test Your Setup**

```bash
# Run health check on your development environment
node ../scripts/health-check.js

# Or test manually
curl http://localhost:3000/api/health
```

---

## **ADDRESSING YOUR CURRENT HEALTH CHECK ISSUES**

Based on your logs, here are the **immediate fixes** for the failing tests:

### **❌ Health Endpoint Failures**

**Issue:** `Failed to fetch` errors

**Quick Fix:**

```bash
# Check if your development server is running
curl http://localhost:3000/api/health

# If not running, start it:
cd Backend
NODE_ENV=development node server.js
```

### **❌ SSL Certificate Issues**

**Issue:** SSL errors in development

**Quick Fix:** Update your health check to use HTTP for development:

```javascript
// In your health monitor, change API_BASE to:
const API_BASE = "http://localhost:3000"; // For development
```

### **❌ OpenAI Service Errors**

**Issue:** OpenAI connection failed (but you discontinued it)

**Quick Fix:** Remove OpenAI tests from your health monitor:

```javascript
// Comment out or remove OpenAI-related tests
// testOpenAIService(),  // Remove this line
```

---

## **PRODUCTION-SAFE CONFIGURATION**

### **Environment Variable Checklist**

```bash
# ✅ DEVELOPMENT (.env.development)
NODE_ENV=development
API_BASE_URL=http://localhost:3000
COSMOS_DATABASE_NAME=jamdb-development
AZURE_STORAGE_CONTAINER_NAME=jam-uploads-dev

# ✅ PRODUCTION (Azure App Service Settings)
NODE_ENV=production
API_BASE_URL=https://jam-capital-backend.azurewebsites.net
COSMOS_DATABASE_NAME=jamdb
AZURE_STORAGE_CONTAINER_NAME=jam-uploads
```

### **Database Separation**

```bash
# Create development database container (recommended)
# 1. Use Azure portal to create: jamdb-development
# 2. Or use a container in existing DB: jamdbcontainer-dev
# 3. Update .env.development with development database settings
```

---

## **SAFE TESTING WORKFLOW**

### **Daily Development Process**

```bash
# 1. Start development environment
cd Backend
npm run dev

# 2. Make your changes
# Edit files in your IDE...

# 3. Test locally
curl http://localhost:3000/api/health
node ../scripts/health-check.js

# 4. When ready to test against staging
NODE_ENV=testing node ../scripts/health-check.js
```

### **Before Production Deployment**

```bash
# 1. Test in staging environment
NODE_ENV=testing npm test

# 2. Run comprehensive health check
NODE_ENV=production node ../scripts/health-check.js

# 3. Only deploy if all tests pass
```

---

## **FIXING YOUR CURRENT SYSTEM HEALTH**

### **Update Your Health Monitor**

Replace the `API_BASE` constant in your `system-health-check.html`:

```javascript
// Change this line:
const API_BASE = "https://jam-capital-backend.azurewebsites.net";

// To this for development:
const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://jam-capital-backend.azurewebsites.net";
```

### **Remove Discontinued Services**

Update your health monitor to remove OpenAI tests:

```javascript
// Remove or comment out:
// testOpenAIService(),

// And update the test to reflect your actual services:
const expectedServices = [
  "cosmos", // ✅ Working
  "ghl", // ✅ Working
  "auth", // ✅ Working
  "storage", // ✅ Working
  "webhooks", // ✅ Working
  // 'openai'    // ❌ Removed
];
```

---

## **RECOMMENDED AZURE RESOURCES FOR STAGING**

### **Create Staging Environment**

```bash
# Use Azure CLI to create staging resources
az group create --name JAM_staging_rg --location "East US"

az webapp create \
  --resource-group JAM_staging_rg \
  --plan JAM_staging_plan \
  --name jam-capital-staging \
  --runtime "NODE:18-lts"

# Copy your production app settings to staging (with staging modifications)
```

---

## **TROUBLESHOOTING COMMON ISSUES**

### **❌ "Failed to fetch" Errors**

```bash
# Check CORS settings in development
# Add to your server.js:
if (process.env.NODE_ENV === 'development') {
    app.use(cors({
        origin: ['http://localhost:3000', 'http://localhost:8080', 'http://localhost:8081'],
        credentials: true
    }));
}
```

### **❌ Database Connection Issues**

```bash
# Verify your .env.development has correct database settings
grep COSMOS .env.development

# Test database connection manually
node -e "
const { CosmosClient } = require('@azure/cosmos');
const client = new CosmosClient({
    endpoint: process.env.COSMOS_ENDPOINT,
    key: process.env.COSMOS_KEY
});
console.log('Testing connection...');
client.databases.readAll().fetchAll().then(
    () => console.log('✅ Database connected'),
    err => console.log('❌ Database error:', err.message)
);
"
```

### **❌ Port Already in Use**

```bash
# Find what's using port 3000
lsof -ti:3000

# Kill the process if needed
kill -9 $(lsof -ti:3000)

# Or use a different port
PORT=3001 npm run dev
```

---

## **IMMEDIATE ACTION ITEMS**

1. **✅ Run setup script** (2 minutes)
2. **✅ Configure .env.development** (5 minutes)
3. **✅ Update health monitor** to remove OpenAI tests (2 minutes)
4. **✅ Test development server** (1 minute)
5. **✅ Create staging resources** (when ready for next phase)

---

## **SUCCESS INDICATORS**

Your development environment is properly set up when:

- ✅ `npm run dev` starts without errors
- ✅ `curl http://localhost:3000/api/health` returns healthy status
- ✅ Health monitor shows no "Failed to fetch" errors
- ✅ You can register test users without affecting production
- ✅ All tests pass in development environment

**🎉 Once this is working, you'll have a safe development environment separated from production!**
