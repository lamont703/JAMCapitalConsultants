# 🔐 Production Deployment - Encryption Key Compatibility Guide

## 🚨 **CRITICAL: Read This Before Deploying**

This guide ensures safe deployment of the credential encryption fixes to production without breaking existing data.

---

## 📊 **Current State Analysis**

### **Development Environment:**
- ✅ Uses: `CREDENTIAL_ENCRYPTION_KEY=your-secure-32-character-key-here`
- ✅ All test users working with repaired credentials
- ✅ Code handles encryption gracefully with fallback error handling

### **Production Environment (Current):**
- ⚠️ Uses: `ENCRYPTION_KEY=your-32-character-encryption-key-here` (from env.azure.example)
- ❓ Unknown if production data is encrypted with this key or a different one
- 🔍 Need to verify actual production encryption key

### **Compatibility Issue:**
- **Code looks for**: `CREDENTIAL_ENCRYPTION_KEY`
- **Production template has**: `ENCRYPTION_KEY`
- **Risk**: Production credentials may become unreadable if keys don't match

---

## 🎯 **Safe Deployment Strategy**

### **Phase 1: Pre-Deployment Verification** ⚠️ **CRITICAL**

#### **Step 1: Check Current Production Key**
```bash
# Connect to production and check what key is actually being used
az webapp config appsettings list \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --query "[?name=='ENCRYPTION_KEY' || name=='CREDENTIAL_ENCRYPTION_KEY']"
```

#### **Step 2: Test Production Credentials**
```bash
# Run this script against production to see current credential status
node scripts/check-production-key.js
```

### **Phase 2: Backward Compatible Deployment** ✅ **SAFE**

#### **Step 1: Update Code for Backward Compatibility**
The code already supports multiple keys through the repair script:
```javascript
this.encryptionKeys = {
    'v1': process.env.CREDENTIAL_ENCRYPTION_KEY,
    'v2': process.env.CREDENTIAL_ENCRYPTION_KEY_V2,
    'legacy': process.env.ENCRYPTION_KEY  // ← Supports old production key
};
```

#### **Step 2: Deploy Code Changes**
1. ✅ **Deploy the improved error handling code** (no risk - only improves error responses)
2. ✅ **Deploy the repair script** (available for fixing corrupted data)
3. ✅ **Keep existing production encryption key** (no data risk)

#### **Step 3: Set Both Keys in Production**
```bash
# Add the new key while keeping the old one for compatibility
az webapp config appsettings set \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --settings \
    CREDENTIAL_ENCRYPTION_KEY="[CURRENT_PRODUCTION_KEY]" \
    ENCRYPTION_KEY="[CURRENT_PRODUCTION_KEY]"
```

### **Phase 3: Post-Deployment Verification** 🔍

#### **Step 1: Test Production Endpoints**
```bash
# Test the credential retrieval endpoint
curl -X POST https://jam-capital-backend.azurewebsites.net/api/credentials/admin/retrieve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [ADMIN_TOKEN]" \
  -d '{"userEmail":"test@example.com","serviceType":"smartcredit","purpose":"testing"}'
```

#### **Step 2: Check for 500 Errors**
- ✅ Should return 200 with graceful error handling
- ✅ No more 500 errors even for corrupted credentials
- ✅ Clear error messages for any decryption issues

### **Phase 4: Data Repair (If Needed)** 🔧

#### **If Production Has Corrupted Credentials:**
```bash
# Run repair script for specific users
node scripts/repair-credentials.js user@example.com
```

---

## 🛡️ **Risk Mitigation**

### **Zero-Risk Deployment:**
1. ✅ **Code changes are backward compatible**
2. ✅ **No existing data will be affected**
3. ✅ **Graceful error handling prevents crashes**
4. ✅ **Multiple encryption key support**

### **Rollback Plan:**
If anything goes wrong:
```bash
# Rollback to previous deployment
az webapp deployment slot swap \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --slot staging \
  --target-slot production
```

---

## 📋 **Deployment Checklist**

### **Pre-Deployment:**
- [ ] Verify current production encryption key
- [ ] Test current production credential status
- [ ] Backup current production environment settings

### **Deployment:**
- [ ] Deploy code changes (error handling improvements)
- [ ] Set both CREDENTIAL_ENCRYPTION_KEY and ENCRYPTION_KEY to same value
- [ ] Verify deployment successful

### **Post-Deployment:**
- [ ] Test credential retrieval endpoints
- [ ] Verify no 500 errors
- [ ] Check admin panel credential display
- [ ] Run repair script for any corrupted credentials

### **Validation:**
- [ ] All credential services return 200 status codes
- [ ] Corrupted credentials show warnings instead of errors
- [ ] Admin panel displays credentials properly
- [ ] No application crashes or 500 errors

---

## 🚀 **Recommended Deployment Commands**

### **1. Deploy Code (Safe)**
```bash
# Build and deploy the improved error handling
npm run build --if-present
zip -r deployment.zip . -x "node_modules/*" "*.git*" "*.env*"

az webapp deployment source config-zip \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --src deployment.zip
```

### **2. Update Environment Variables (Safe)**
```bash
# Get current encryption key first
CURRENT_KEY=$(az webapp config appsettings list \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --query "[?name=='ENCRYPTION_KEY'].value" -o tsv)

# Set both keys to ensure compatibility
az webapp config appsettings set \
  --name jam-capital-backend \
  --resource-group JAM_resource_group \
  --settings \
    CREDENTIAL_ENCRYPTION_KEY="$CURRENT_KEY" \
    ENCRYPTION_KEY="$CURRENT_KEY"
```

### **3. Verify Deployment**
```bash
# Test health endpoint
curl https://jam-capital-backend.azurewebsites.net/api/health

# Test credential endpoint (should return 200, not 500)
curl -X POST https://jam-capital-backend.azurewebsites.net/api/credentials/admin/retrieve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [TOKEN]" \
  -d '{"userEmail":"test@example.com","serviceType":"smartcredit","purpose":"testing"}'
```

---

## ✅ **Expected Results After Deployment**

1. **No more 500 errors** - All credential endpoints return proper HTTP status codes
2. **Graceful error handling** - Corrupted credentials return 200 with warnings
3. **Better user experience** - Clear error messages instead of crashes
4. **Data integrity maintained** - No existing credentials will be lost or corrupted
5. **Repair capability** - Ability to fix corrupted credentials using the repair script

---

## 🆘 **Emergency Contacts & Support**

If you encounter issues during deployment:

1. **Check Azure App Service logs**:
   ```bash
   az webapp log tail --name jam-capital-backend --resource-group JAM_resource_group
   ```

2. **Verify environment variables**:
   ```bash
   az webapp config appsettings list --name jam-capital-backend --resource-group JAM_resource_group
   ```

3. **Test specific endpoints**:
   ```bash
   curl https://jam-capital-backend.azurewebsites.net/api/health
   ```

Remember: **This deployment is designed to be zero-risk and backward compatible!** 