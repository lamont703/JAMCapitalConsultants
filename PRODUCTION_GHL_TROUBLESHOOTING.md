# GoHighLevel Production Sync Troubleshooting Guide

## 🎯 Quick Diagnosis

If your GHL sync works locally but fails in production, run these diagnostic scripts:

```bash
# Quick production check
node Backend/quick-production-check.js

# Comprehensive diagnostic
node Backend/ghl-production-diagnostic.js
```

## 🔍 Common Production Issues & Solutions

### 1. **Authentication Token Issues**

**Symptoms:**

- `Invalid JWT` errors
- `401 Unauthorized` responses
- `Authentication required` messages

**Root Causes:**

- Tokens not properly deployed to production
- Token file path issues in production environment
- Token expiration without refresh capability

**Solutions:**

```bash
# Check token status
node -e "
import { GoHighLevelService } from './Backend/services/ghlService.js';
const ghl = new GoHighLevelService();
ghl.getTokenInfo().then(info => console.log(JSON.stringify(info, null, 2)));
"

# Manual token refresh
node Backend/scripts/refresh-ghl-tokens.js
```

**Production Environment Fix:**

1. Ensure `Backend/config/ghl-tokens.json` is deployed to production
2. Check file permissions in production environment
3. Verify token refresh process works in production

### 2. **Environment Variable Mismatches**

**Symptoms:**

- `GoHighLevel Location ID must be provided` errors
- Missing configuration errors
- Service initialization failures

**Check Required Variables:**

```bash
# Local environment
echo "GHL_LOCATION_ID: $GHL_LOCATION_ID"
echo "JWT_SECRET length: ${#JWT_SECRET}"
echo "COSMOS_DB_CONNECTION_STRING exists: $([ -n "$COSMOS_DB_CONNECTION_STRING" ] && echo 'YES' || echo 'NO')"

# Production environment (Azure)
# Check Azure App Service Configuration → Application Settings
```

**Production Environment Fix:**

1. **Azure App Service:** Go to Configuration → Application Settings
2. **Ensure these variables exist:**
   - `GHL_LOCATION_ID`
   - `JWT_SECRET`
   - `COSMOS_DB_CONNECTION_STRING`
   - `NODE_ENV=production`
   - `OPENAI_API_KEY`

### 3. **File System Path Issues**

**Symptoms:**

- Token file not found errors
- Module import failures
- Path resolution issues

**Root Cause:**
Production file systems often have different path structures than local development.

**Solutions:**

```javascript
// Check in Backend/services/ghlTokenService.js
// Ensure this uses absolute paths:
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
this.tokensPath = path.join(__dirname, "../config/ghl-tokens.json");
```

### 4. **Network & Firewall Issues**

**Symptoms:**

- Connection timeout errors
- DNS resolution failures
- SSL certificate errors

**Test Network Connectivity:**

```bash
# Test GHL API accessibility
curl -I https://services.leadconnectorhq.com
curl -I https://api.gohighlevel.com

# Test from production server
# (Azure Cloud Shell or SSH into production)
```

**Production Environment Fix:**

1. **Azure App Service:** Ensure outbound connections are allowed
2. **Firewall:** Whitelist GoHighLevel domains
3. **DNS:** Verify DNS resolution works for GHL endpoints

### 5. **Database Connection Issues**

**Symptoms:**

- Cosmos DB connection failures
- User update failures after sync
- Transaction timeout errors

**Test Database Connection:**

```bash
# Test Cosmos DB connection
node -e "
import { CosmosService } from './Backend/services/cosmosService.js';
const cosmos = new CosmosService();
cosmos.initialize().then(() => console.log('✅ Cosmos DB connected'));
"
```

**Production Environment Fix:**

1. **Connection String:** Verify `COSMOS_DB_CONNECTION_STRING` is correct
2. **Permissions:** Ensure production has read/write access
3. **Firewall:** Check Cosmos DB firewall rules

### 6. **Service Initialization Order**

**Symptoms:**

- Services not available during startup
- Global service variables undefined
- Initialization race conditions

**Root Cause:**
Production environments may have different service initialization timing.

**Solution - Update `server.js`:**

```javascript
// Ensure proper service initialization order
async function initializeServices() {
  try {
    // 1. Initialize Cosmos DB first
    console.log("🔄 Initializing Cosmos DB...");
    const cosmosService = new CosmosService();
    await cosmosService.initialize();
    app.locals.cosmosService = cosmosService;

    // 2. Initialize GHL service
    console.log("🔄 Initializing GHL service...");
    const ghlService = new GoHighLevelService();
    const ghlInitialized = await ghlService.initialize();

    if (ghlInitialized) {
      app.locals.ghlService = ghlService;
      global.ghlService = ghlService;
      console.log("✅ GHL service initialized");
    } else {
      console.log(
        "⚠️ GHL service initialization failed - continuing without GHL"
      );
    }

    console.log("✅ All services initialized");
  } catch (error) {
    console.error("❌ Service initialization failed:", error);
    // Don't exit - allow server to start even if some services fail
  }
}

// Call before starting server
initializeServices().then(() => {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
});
```

## 🛠️ Production-Specific Fixes

### Azure App Service Configuration

1. **Application Settings:**

   ```
   NODE_ENV=production
   PORT=80
   GHL_LOCATION_ID=your-production-location-id
   JWT_SECRET=your-production-jwt-secret
   COSMOS_DB_CONNECTION_STRING=your-production-cosmos-connection
   OPENAI_API_KEY=your-production-openai-key
   ```

2. **General Settings:**

   - **Stack:** Node.js (latest LTS)
   - **Always On:** Enabled
   - **ARR Affinity:** Disabled (for better performance)

3. **Deployment:**
   - Ensure `Backend/config/ghl-tokens.json` is included in deployment
   - Check file permissions after deployment

### Environment-Specific Token Management

Create production-specific token refresh process:

```javascript
// Backend/scripts/production-token-refresh.js
import { GoHighLevelService } from "../services/ghlService.js";

async function refreshProductionTokens() {
  try {
    const ghlService = new GoHighLevelService();
    const tokenInfo = await ghlService.getTokenInfo();

    if (tokenInfo.isExpired) {
      console.log("🔄 Refreshing expired production tokens...");
      await ghlService.initialize();
      console.log("✅ Production tokens refreshed");
    } else {
      console.log("✅ Production tokens are still valid");
    }
  } catch (error) {
    console.error("❌ Production token refresh failed:", error);
    // Send alert to monitoring system
  }
}

// Run token refresh
refreshProductionTokens();
```

### Monitoring & Alerts

Add production monitoring to `server.js`:

```javascript
// Monitor GHL sync health
app.get("/health/ghl", async (req, res) => {
  try {
    const ghlService = req.app.locals.ghlService;
    if (!ghlService) {
      return res
        .status(503)
        .json({ status: "error", message: "GHL service not initialized" });
    }

    const connectionTest = await ghlService.testConnection();
    res.json({
      status: connectionTest.success ? "healthy" : "unhealthy",
      lastCheck: new Date().toISOString(),
      details: connectionTest,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});
```

## 🔧 Emergency Production Fixes

### 1. Disable GHL Sync Temporarily

If GHL sync is causing registration failures:

```javascript
// In Backend/controllers/authController.js
// Add this flag at the top
const DISABLE_GHL_SYNC = process.env.DISABLE_GHL_SYNC === "true";

// Then wrap GHL sync in the registration method:
if (!DISABLE_GHL_SYNC) {
  // ... existing GHL sync code
} else {
  console.log("⚠️ GHL sync disabled - saving user without sync");
  savedUser.ghlSyncStatus = "disabled";
}
```

Set `DISABLE_GHL_SYNC=true` in production environment to temporarily disable sync.

### 2. Manual Sync Recovery

If users registered without GHL sync:

```bash
# Find users with failed sync
node -e "
import { CosmosService } from './Backend/services/cosmosService.js';
const cosmos = new CosmosService();
cosmos.initialize().then(async () => {
    const users = await cosmos.queryDocuments(
        'SELECT * FROM c WHERE c.type = \"user\" AND c.ghlSyncStatus = \"failed\"'
    );
    console.log('Users needing sync:', users.length);
    users.forEach(user => console.log(\`- \${user.email} (\${user.id})\`));
});
"

# Manually sync specific user
node Backend/sync-user-to-ghl.js
```

## 📊 Performance Monitoring

Add these monitoring endpoints to track production health:

```javascript
// Backend/routes/healthRoutes.js
app.get("/health/sync-stats", async (req, res) => {
  try {
    const cosmosService = req.app.locals.cosmosService;

    const stats = await cosmosService.queryDocuments(`
            SELECT 
                c.ghlSyncStatus,
                COUNT(1) as count
            FROM c 
            WHERE c.type = "user" 
            GROUP BY c.ghlSyncStatus
        `);

    res.json({
      syncStats: stats,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 🚨 When to Escalate

Contact your system administrator if:

1. **Authentication Issues Persist:** After token refresh attempts
2. **Network Connectivity Problems:** External API calls failing
3. **Database Connection Failures:** Cosmos DB access issues
4. **Service Initialization Failures:** Services not starting properly

**Provide this information:**

- Environment details (`NODE_ENV`, `PORT`, etc.)
- Error messages and stack traces
- Results from diagnostic scripts
- Recent deployment or configuration changes
