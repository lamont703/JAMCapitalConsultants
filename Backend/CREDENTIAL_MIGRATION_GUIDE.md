# 🔐 Credential Migration and Corruption Fix Guide

This guide will help you fix credential corruption locally and safely migrate to production with new encryption keys.

## 🚨 Current Problem

Your system has **corrupted credentials** due to encryption key mismatches:

- Some credentials were encrypted with old keys
- Current system can't decrypt them, causing 500 errors
- Multiple users affected across different services

## 🎯 Solution Overview

1. **Fix corruption locally** by re-encrypting all credentials
2. **Implement proper key versioning** to prevent future issues
3. **Migrate safely to production** with new encryption keys
4. **Establish key rotation strategy** for the future

---

## 🔧 STEP 1: Local Corruption Fix

### 1.1 Scan for Corruption

```bash
cd Backend
node scripts/fix-credential-corruption.js
```

This will:

- Scan all credential records
- Identify which ones are corrupted
- Show corruption by service and user
- Create a migration plan

### 1.2 Dry Run (Recommended First)

```bash
node scripts/fix-credential-corruption.js dry-run
```

This shows what would be repaired without making changes.

### 1.3 Actual Repair

```bash
node scripts/fix-credential-corruption.js repair
```

This will:

- Re-encrypt all corrupted credentials with current key
- Update encryption key version to 'v2'
- Add repair metadata for tracking
- Fix all 500 errors

### 1.4 Verify Fix

```bash
node test-credentials-endpoint.js
```

All services should now return 200 status codes (no more 500 errors).

---

## 🔑 STEP 2: Encryption Key Management

### 2.1 Check Current Key Status

```bash
node scripts/manage-encryption-keys.js status
```

### 2.2 Generate New Strong Key

```bash
node scripts/manage-encryption-keys.js generate
```

This creates a cryptographically secure 256-bit key.

### 2.3 Update Local Environment

```bash
# Replace <generated-key> with the key from step 2.2
node scripts/manage-encryption-keys.js update <generated-key>
```

### 2.4 Create Production Template

```bash
node scripts/manage-encryption-keys.js template
```

This creates `.env.production.template` with the new key.

---

## 🚀 STEP 3: Production Migration

### 3.1 Pre-Migration Checklist

- [ ] All credentials work locally (no 500 errors)
- [ ] New encryption key is working
- [ ] Production environment template is ready
- [ ] Backup of old encryption key is saved

### 3.2 Deploy Updated Code

```bash
# Deploy your updated backend to production
# This includes the improved error handling
git push origin main
# Or your deployment method
```

### 3.3 Update Production Environment

1. Go to Azure App Service → Configuration
2. Add/Update: `CREDENTIAL_ENCRYPTION_KEY` = `<new-key>`
3. Restart the production server

### 3.4 Run Production Repair

```bash
# SSH into production or use Azure Console
cd /home/site/wwwroot
node scripts/fix-credential-corruption.js repair
```

### 3.5 Verify Production

Test all credential endpoints in production to ensure no 500 errors.

---

## 📋 STEP 4: Post-Migration

### 4.1 Monitor for 24-48 Hours

- Check production logs
- Monitor credential endpoints
- Verify user access works

### 4.2 Update Documentation

- Document the migration process
- Note the new encryption key version
- Update rollback procedures

### 4.3 Implement Key Rotation Strategy

- Plan for future key updates
- Consider quarterly key rotation
- Implement gradual migration process

---

## 🛡️ Rollback Plan

If anything goes wrong:

### Immediate Rollback

1. **Revert to old encryption key** in production
2. **Restart production server**
3. **Investigate the issue**

### Data Recovery

- Old encrypted data is still in the database
- Can be re-encrypted with correct key
- No data loss, just encryption issues

---

## 🔍 Troubleshooting

### Common Issues

#### 1. "Key validation failed"

- Ensure key is at least 32 characters
- Use the generated key from the script

#### 2. "Environment update failed"

- Check file permissions
- Ensure .env file exists
- Try manual backup first

#### 3. "Repair failed"

- Check database connectivity
- Verify user permissions
- Review error logs

### Debug Commands

```bash
# Check current key status
node scripts/manage-encryption-keys.js status

# Backup environment
node scripts/manage-encryption-keys.js backup

# Show migration checklist
node scripts/manage-encryption-keys.js checklist
```

---

## 📊 Expected Results

### Before Migration

- ❌ CFPB: 500 errors
- ❌ Some SmartCredit: 500 errors
- ❌ IdentityIQ: 500 errors for some users

### After Migration

- ✅ All services: 200 status codes
- ✅ Corrupted credentials: Return with warnings
- ✅ Working credentials: Return normally
- ✅ No more 500 errors

---

## 🎯 Success Metrics

- [ ] **Zero 500 errors** on credential endpoints
- [ ] **All users can access** their credentials
- [ ] **Clear error messages** for any issues
- [ ] **Production migration** completed successfully
- **Key versioning** implemented for future

---

## 🚨 Important Notes

1. **Always backup** before making changes
2. **Test locally first** before production
3. **Monitor closely** after migration
4. **Keep old keys** as backup
5. **Document everything** for future reference

---

## 📞 Support

If you encounter issues:

1. Check the error logs
2. Run the debug commands
3. Review this guide
4. Check the rollback plan

---

## 🏁 Next Steps

1. **Run the corruption scan** to see the full scope
2. **Fix corruption locally** with the repair script
3. **Generate new encryption key** for production
4. **Follow the migration checklist** step by step
5. **Monitor and verify** everything works

Your system will be much more robust after this migration! 🎉
