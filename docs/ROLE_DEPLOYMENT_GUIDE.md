# 🔐 Role System Deployment Guide

This guide covers the permanent implementation of the role-based access control system for JAM Capital Consultants.

## 📋 **Changes Made**

### 1. **Backend Changes**

- ✅ Updated `User.js` model to include `role` field
- ✅ Added role validation in auth controller
- ✅ Created database migration script
- ✅ Added admin role management API endpoint

### 2. **Frontend Changes**

- ✅ Updated header role checking logic
- ✅ Enhanced AuthManager to support roles
- ✅ Fixed AdminPanel visibility logic

## 🚀 **Deployment Steps**

### **Phase 1: Local Testing (Before Azure Deployment)**

1. **Test locally first:**

   ```bash
   cd Backend

   # Run the migration to add roles to existing users
   node scripts/migrate-add-roles.js migrate

   # Make yourself an admin
   node scripts/migrate-add-roles.js make-admin lamont703@gmail.com

   # Verify the changes
   node scripts/migrate-add-roles.js list
   ```

2. **Start your local server and test:**

   ```bash
   npm start
   ```

3. **Open your dashboard and verify:**
   - Admin Panel tab should appear for admin users
   - Role should be properly set in localStorage

### **Phase 2: Azure Deployment**

1. **Commit all changes:**

   ```bash
   git add .
   git commit -m "feat: Add role-based access control system"
   git push origin main
   ```

2. **Deploy to Azure:**

   ```bash
   # If using Azure CLI
   az webapp deployment source sync --name jam-capital-backend --resource-group your-resource-group

   # Or use your existing deployment method
   ```

3. **Run migration on production:**

   ```bash
   # SSH into your Azure App Service or use the console
   cd /home/site/wwwroot
   node scripts/migrate-add-roles.js migrate

   # Make admin users
   node scripts/migrate-add-roles.js make-admin lamont703@gmail.com
   ```

### **Phase 3: Verification**

1. **Check production logs:**

   - Look for migration success messages
   - Verify no errors during deployment

2. **Test admin access:**
   - Log in to production dashboard
   - Verify Admin Panel tab appears
   - Test AdminPanel functionality

## 🛠️ **Migration Commands**

### **Basic Commands**

```bash
# Add role field to all users (defaults to 'user')
node scripts/migrate-add-roles.js migrate

# List all users and their roles
node scripts/migrate-add-roles.js list

# Make a specific user an admin
node scripts/migrate-add-roles.js make-admin user@example.com

# Update any user's role
node scripts/migrate-add-roles.js update-role user@example.com admin
```

### **Available Roles**

- `user` - Regular user (default)
- `admin` - Administrator with access to Admin Panel
- `administrator` - Same as admin
- `super_admin` - Highest level admin

## 🔧 **API Endpoints**

### **Update User Role (Admin Only)**

```javascript
PATCH /api/admin/update-user-role
Authorization: Bearer <admin_token>
Content-Type: application/json

{
    "email": "user@example.com",
    "role": "admin"
}
```

## 🧪 **Testing**

### **Local Testing Script**

```javascript
// Run in browser console to test admin access
const userData = JSON.parse(localStorage.getItem("userData"));
userData.role = "admin";
localStorage.setItem("userData", JSON.stringify(userData));

// Force header update
if (window.jamDashboardHeader) {
  window.jamDashboardHeader.updateUserData(userData);
  window.jamDashboardHeader.updateAdminAccess();
}
```

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Admin Panel not showing:**

   ```javascript
   // Check user role in console
   console.log(JSON.parse(localStorage.getItem("userData")));

   // Force header update
   window.jamDashboardHeader.refreshUserData();
   ```

2. **Migration fails:**

   ```bash
   # Check database connection
   node -e "import('./services/cosmosService.js').then(s => s.CosmosService).then(c => new c().initialize())"
   ```

3. **Role not persisting:**
   - Check if backend deployment is complete
   - Verify migration ran successfully
   - Check database records directly

---

**Remember:** Always test locally before deploying to production! 🧪→🚀
