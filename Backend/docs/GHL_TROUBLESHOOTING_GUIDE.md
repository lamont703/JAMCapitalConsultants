# GoHighLevel Integration Troubleshooting Guide

## 🚨 **Current Issue: Refresh Token Expired**

Based on our debugging, your GoHighLevel integration is failing because:

```
❌ Token refresh error: invalid_grant
❌ Error: Refresh token expired - re-authentication required
```

**Root Cause**: Your refresh token from January 2025 has expired and needs to be regenerated.

## 🔧 **Step-by-Step Fix Process**

### **Step 1: Generate New Authorization URL**

```bash
cd Backend
node scripts/ghlOAuthExchange.js auth-url
```

This will output a URL like:

```
https://marketplace.leadconnectorhq.com/oauth/chooselocation?response_type=code&redirect_uri=https://jamcapitalconsultants.com/oauth/callback&client_id=6834ac50c984bf35ed3510c9-mb5eg18b&scope=contacts.write+contacts.read+locations.read+locations.write+users.read+users.write+opportunities.read+opportunities.write+calendars.read+calendars.write+payments.read+payments.write+subscriptions.read+subscriptions.write
```

### **Step 2: Complete OAuth Flow in GoHighLevel**

1. **Copy the authorization URL** from Step 1
2. **Open it in your browser**
3. **Log into your GoHighLevel account**
4. **Select your location** (gaOp7QAouTuwykUssx6C)
5. **Authorize the JAM Capital app** with the required permissions
6. **Copy the authorization code** from the redirect URL

### **Step 3: Exchange Code for Tokens**

https://jamcapitalconsultants.com/oauth/callback?code=1eb934e530540adf346fa286abe53faed45df6bd

```bash
node scripts/ghlOAuthExchange.js exchange 1eb934e530540adf346fa286abe53faed45df6bd
```

This will:

- Get new access and refresh tokens
- Save them to `config/ghl-tokens.json`
- Update your `.env` file

### **Step 4: Test the Connection**

```bash
curl -X GET http://localhost:3000/api/ghl/test-connection
```

Should return:

```json
{"success": true, "location": {...}}
```

## 📋 **Required GoHighLevel App Configuration**

### **1. OAuth App Settings in GHL**

Navigate to: **Settings → Integrations → My Apps → JAM Capital App**

**Required Settings:**

```
App Name: JAM Capital Consultants
Client ID: 6834ac50c984bf35ed3510c9-mb5eg18b
Client Secret: 7951d00f-1b78-40dd-ac1c-9cc1a5658541
Redirect URI: https://jamcapitalconsultants.com/oauth/callback
```

### **2. Required Scopes**

Your app must have these permissions:

- ✅ `contacts.read` - Read contact data
- ✅ `contacts.write` - Create/update contacts
- ✅ `locations.read` - Read location data
- ✅ `locations.write` - Update location settings
- ✅ `payments.read` - **NEW: Read payment data**
- ✅ `payments.write` - **NEW: Process payments**
- ✅ `subscriptions.read` - **NEW: Read subscription data**
- ✅ `subscriptions.write` - **NEW: Cancel/modify subscriptions**

### **3. Webhook Configuration**

Set up these webhooks in GHL:

**Payment Success:**

```
URL: https://jamcapitalconsultants.com/api/webhooks/ghl/payment-success
Events: payment.success, subscription.created, subscription.renewed
```

**Subscription Cancelled:**

```
URL: https://jamcapitalconsultants.com/api/webhooks/ghl/subscription-cancelled
Events: subscription.cancelled, subscription.expired
```

**Payment Failed:**

```
URL: https://jamcapitalconsultants.com/api/webhooks/ghl/payment-failed
Events: payment.failed, payment.declined
```

## 🎯 **Why This Happened**

1. **Token Expiration**: Refresh tokens in GoHighLevel have a limited lifespan
2. **Missing Scopes**: Your original auth didn't include payment/subscription scopes
3. **No Auto-Refresh**: The system wasn't properly handling token refresh

## 🛠️ **What We Fixed**

### **1. Enhanced Token Refresh Logic**

- Now properly loads saved refresh tokens
- Better error handling and logging
- Automatically saves updated tokens

### **2. Added Subscription Scopes**

- `payments.read` - Read payment data
- `payments.write` - Process payments
- `subscriptions.read` - Read subscription data
- `subscriptions.write` - Cancel/modify subscriptions

### **3. Improved Error Handling**

- Specific error messages for different failure types
- Graceful degradation when GHL is unavailable
- Detailed logging for troubleshooting

## 🔄 **Testing Your Integration**

### **1. Test Token Refresh**

```bash
node -e "import('./scripts/ghlOAuthExchange.js').then(module => { const oauth = new module.GHLOAuthExchange(); return oauth.refreshAccessToken(); }).then(result => { console.log('✅ Success:', result); }).catch(error => { console.error('❌ Error:', error.message); });"
```

### **2. Test GHL Connection**

```bash
curl -X GET http://localhost:3000/api/ghl/test-connection
```

### **3. Test Subscription Cancellation**

```bash
curl -X POST http://localhost:3000/api/subscriptions/cancel \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cancellationReason":"testing","feedback":"Test cancellation"}'
```

## 📊 **Expected Log Output After Fix**

**Successful Token Refresh:**

```
🔄 Attempting to refresh GHL access token...
🔍 Using refresh token from saved tokens...
✅ Tokens refreshed and saved successfully
```

**Successful Cancellation:**

```
🔄 Processing subscription cancellation for user...
🔍 Found GHL subscription: sub_123456
✅ Successfully cancelled GHL subscription: sub_123456
✅ End-of-period cancellation scheduled...
```

## 🚨 **Common Issues & Solutions**

### **Issue 1: "invalid_grant" Error**

**Solution**: Re-authenticate (Steps 1-3 above)

### **Issue 2: "insufficient_scope" Error**

**Solution**: Update app scopes in GHL and re-authenticate

### **Issue 3: Webhook 404 Errors**

**Solution**: Verify webhook URLs are accessible and correct

### **Issue 4: "location not found" Error**

**Solution**: Verify `GHL_LOCATION_ID` matches your GHL location

## 📞 **Support Checklist**

Before contacting support, verify:

- [ ] OAuth app is approved in GoHighLevel
- [ ] All required scopes are granted
- [ ] Webhook endpoints are configured
- [ ] Environment variables are correct
- [ ] Tokens are not expired
- [ ] Location ID matches your GHL account

## 🔮 **Prevention for Future**

1. **Set up token refresh monitoring**
2. **Implement automatic re-authentication flows**
3. **Monitor webhook delivery success rates**
4. **Regular integration health checks**

---

**Need Help?** Check the detailed logs in your terminal output for specific error messages.
