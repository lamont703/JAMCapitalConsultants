# 🔧 DISPUTE REPORTS TROUBLESHOOTING GUIDE

## ✅ **What's Now Available**

Your UI now shows:

- **"Dispute Reports"** section with **"Load Reports"** button
- Enhanced error handling and debugging information
- Detailed display of actual dispute report data
- Real-time status updates

## 🔍 **Debug the 403 Error**

### **Step 1: Check Console for Detailed Info**

When you click "Load Reports", look for these console messages:

```javascript
// Good signs:
🔍 Making API request: { url: "...", userId: "...", hasToken: true, tokenPreview: "..." }
📋 API Response Status: 200 OK

// Problem signs:
🚫 403 Forbidden - Check user permissions and auth token
⚠️ No valid auth token found
⚠️ No user ID found
```

### **Step 2: Manual Console Checks**

Open browser console and run:

```javascript
// Check if user data exists
console.log("User Data:", localStorage.getItem("userData"));
console.log("Auth Token:", localStorage.getItem("authToken"));

// Parse user data
const userData = JSON.parse(localStorage.getItem("userData") || "{}");
console.log("User ID:", userData.id);
console.log("User Role:", userData.role);
```

### **Step 3: Test Your Backend Route Directly**

Open a new browser tab and try to access your API directly:

```
http://localhost:3000/api/user/dispute-reports/YOUR_USER_ID
```

**Expected results:**

- ✅ **200 OK**: Returns dispute reports data
- ❌ **403 Forbidden**: Permission issue
- ❌ **401 Unauthorized**: Authentication issue
- ❌ **404 Not Found**: Route doesn't exist

## 🔧 **Common 403 Fixes**

### **Fix 1: Check Backend Route Permissions**

In your backend route file:

```javascript
// Make sure this route allows the user to access their own data
app.get(
  "/api/user/dispute-reports/:userId",
  authenticateToken,
  async (req, res) => {
    try {
      // Check if user can access their own data
      if (req.user.id !== req.params.userId) {
        return res.status(403).json({
          success: false,
          message: "Access denied - can only view your own reports",
        });
      }

      // Your dispute reports logic here
      const disputeReports = await getDisputeReportsForUser(req.params.userId);

      res.json({
        success: true,
        disputeReports: disputeReports,
      });
    } catch (error) {
      console.error("Error fetching dispute reports:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);
```

### **Fix 2: Check Authentication Middleware**

Make sure your `authenticateToken` middleware properly sets `req.user`:

```javascript
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    req.user = user; // Make sure this sets the user data
    next();
  });
}
```

### **Fix 3: Check Database Permissions**

If you're using a database, make sure the user exists and has the right permissions:

```sql
-- Check if user exists
SELECT * FROM users WHERE id = 'your_user_id';

-- Check user permissions if you have a permissions table
SELECT * FROM user_permissions WHERE user_id = 'your_user_id';
```

## 🎯 **Testing Steps**

1. **Click "Load Reports"** in your UI
2. **Check console** for detailed error messages
3. **Look at the status message** under the button
4. **Try the backend route directly** in browser
5. **Check your backend logs** for additional error details

## 💡 **Quick Fixes to Try**

### **Option A: Temporarily Bypass Authentication**

For testing only, temporarily comment out authentication:

```javascript
// app.get('/api/user/dispute-reports/:userId', authenticateToken, async (req, res) => {
app.get("/api/user/dispute-reports/:userId", async (req, res) => {
  // Your logic here - for testing only!
});
```

### **Option B: Add More Logging**

Add detailed logging to your backend route:

```javascript
app.get(
  "/api/user/dispute-reports/:userId",
  authenticateToken,
  async (req, res) => {
    console.log("📋 Dispute reports request:", {
      userId: req.params.userId,
      authenticatedUser: req.user,
      headers: req.headers,
    });

    // Your logic here
  }
);
```

## 🎉 **Success Indicators**

When working properly, you should see:

- ✅ **Console**: "Successfully loaded X dispute reports"
- ✅ **UI**: Detailed dispute report cards displayed
- ✅ **Status**: "Loaded X reports" message
- ✅ **No errors** in console

**Try clicking "Load Reports" now and let me know what console messages you see!**
