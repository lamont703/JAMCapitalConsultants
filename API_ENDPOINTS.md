# JAM Capital API Endpoints

This document lists all available API endpoints in the JAM Capital application.

## Base URL

- **Production**: `https://jam-capital-backend.azurewebsites.net/api`
- **Local Development**: `http://localhost:3000/api`

## Authentication

Most endpoints require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

---

## 🔐 Authentication Routes (`/api/auth`)

| Method | Endpoint                             | Description                            | Auth Required |
| ------ | ------------------------------------ | -------------------------------------- | ------------- |
| POST   | `/auth/register`                     | Register new user                      | No            |
| POST   | `/auth/login`                        | User/Admin login                       | No            |
| POST   | `/auth/logout`                       | Logout user                            | No            |
| POST   | `/auth/forgot-password`              | Request password reset                 | No            |
| POST   | `/auth/reset-password`               | Reset password with token              | No            |
| POST   | `/auth/verify-security-answer`       | Verify security answer                 | No            |
| POST   | `/auth/get-security-question`        | Get user's security question           | No            |
| POST   | `/auth/reset-password-with-security` | Reset password using security question | No            |
| GET    | `/auth/test-token`                   | Generate test token (dev only)         | No            |
| POST   | `/auth/upload-report`                | Upload report (admin only)             | Yes (Admin)   |

---

## 👥 User Management Routes (`/api/user`)

| Method | Endpoint                        | Description              | Auth Required |
| ------ | ------------------------------- | ------------------------ | ------------- |
| GET    | `/user/profile`                 | Get user profile         | Yes           |
| PUT    | `/user/profile`                 | Update user profile      | Yes           |
| GET    | `/user/notifications`           | Get user notifications   | Yes           |
| GET    | `/user/dispute-reports/:userId` | Get user dispute reports | Yes           |

---

## 🔑 Credential Management Routes (`/api/credentials`)

| Method | Endpoint                                 | Description                       | Auth Required |
| ------ | ---------------------------------------- | --------------------------------- | ------------- |
| POST   | `/credentials/store`                     | Store user credentials            | Yes           |
| GET    | `/credentials/status`                    | Get credential status             | Yes           |
| PUT    | `/credentials/update`                    | Update credentials                | Yes           |
| DELETE | `/credentials/delete`                    | Delete credentials                | Yes           |
| POST   | `/credentials/admin/retrieve`            | Retrieve user credentials (admin) | Yes (Admin)   |
| GET    | `/credentials/admin/audit/:credentialId` | Get credential audit trail        | Yes (Admin)   |
| GET    | `/credentials/admin/audit-log`           | Get admin audit log               | Yes (Admin)   |

---

## 💬 Chat & AI Routes (`/api/chat`)

| Method | Endpoint                          | Description                       | Auth Required |
| ------ | --------------------------------- | --------------------------------- | ------------- |
| POST   | `/chat/send`                      | Send chat message                 | No            |
| POST   | `/chat/analyze`                   | Analyze credit reports (upload)   | No            |
| GET    | `/chat/analyze`                   | Analyze user reports by email     | No            |
| POST   | `/chat/generate-letter`           | Generate single dispute letter    | No            |
| POST   | `/chat/generate-letters`          | Generate multiple dispute letters | No            |
| POST   | `/chat/download-letters`          | Download letters                  | No            |
| POST   | `/chat/email-letters`             | Email letters                     | No            |
| GET    | `/chat/user-letters`              | Get user's dispute letters        | No            |
| DELETE | `/chat/dispute-letter`            | Delete dispute letter             | No            |
| GET    | `/chat/download-letter/:letterId` | Download letter PDF               | No            |
| GET    | `/chat/manage-cache`              | Manage cache (clear/stats)        | No            |

**Note**: `/api/chat` routes are also available under `/api/chatGptService` for backward compatibility.

---

## 🏥 GoHighLevel Integration Routes (`/api/ghl`)

| Method | Endpoint                      | Description             | Auth Required |
| ------ | ----------------------------- | ----------------------- | ------------- |
| POST   | `/ghl/sync-contact`           | Sync contact to GHL     | No            |
| GET    | `/ghl/test-connection`        | Test GHL connection     | No            |
| POST   | `/ghl/create-contact`         | Create GHL contact      | No            |
| GET    | `/ghl/get-contact/:contactId` | Get GHL contact         | No            |
| GET    | `/ghl/token-status`           | Check GHL token status  | No            |
| GET    | `/ghl/location-info`          | Get GHL location info   | No            |
| POST   | `/ghl/raw-api-test`           | Raw GHL API test        | No            |
| GET    | `/ghl/recent-contacts`        | Get recent GHL contacts | No            |

---

## 💳 Subscription Management Routes (`/api/subscriptions`)

| Method | Endpoint                                    | Description                            | Auth Required |
| ------ | ------------------------------------------- | -------------------------------------- | ------------- |
| GET    | `/subscriptions/dashboard`                  | Get subscription dashboard             | Yes           |
| GET    | `/subscriptions/payment-history`            | Get payment history                    | Yes           |
| GET    | `/subscriptions/can-generate-dispute`       | Check dispute generation capability    | Yes           |
| GET    | `/subscriptions/tiers`                      | Get subscription tiers                 | No            |
| GET    | `/subscriptions/usage`                      | Get monthly usage                      | Yes           |
| POST   | `/subscriptions/upgrade`                    | Upgrade subscription                   | Yes           |
| POST   | `/subscriptions/check-expirations`          | Check subscription expirations (admin) | Yes (Admin)   |
| GET    | `/subscriptions/payment-links/:tier`        | Get payment link for tier              | No            |
| POST   | `/subscriptions/consume-credits`            | Consume credits                        | Yes           |
| GET    | `/subscriptions/dispute-letter-usage`       | Get dispute letter usage stats         | Yes           |
| POST   | `/subscriptions/fix-credits`                | Fix remaining credits                  | Yes           |
| POST   | `/subscriptions/cancel`                     | Cancel subscription                    | Yes           |
| POST   | `/subscriptions/pause`                      | Pause subscription                     | Yes           |
| GET    | `/subscriptions/:userId`                    | Get user subscription info             | No            |
| POST   | `/subscriptions/:userId/check-credits`      | Check user credits                     | No            |
| POST   | `/subscriptions/:userId/consume-credits`    | Consume user credits                   | No            |
| PUT    | `/subscriptions/:userId/tier`               | Update user subscription tier          | No            |
| POST   | `/subscriptions/:userId/replenish-credits`  | Replenish user credits                 | No            |
| POST   | `/subscriptions/:userId/validate-operation` | Validate subscription for operation    | No            |
| GET    | `/subscriptions/analytics/:userId?`         | Get subscription analytics             | No            |
| GET    | `/subscriptions/admin/expired`              | Get expired subscriptions              | No            |
| POST   | `/subscriptions/admin/process-expired`      | Process expired subscriptions          | No            |

**Note**: Some subscription routes have duplicate implementations in both `/api/subscriptions` and `/api/admin/subscriptions` for different access patterns.

---

## ⚖️ Dispute Management Routes (`/api/dispute`)

| Method | Endpoint                              | Description                        | Auth Required |
| ------ | ------------------------------------- | ---------------------------------- | ------------- |
| POST   | `/dispute/generate-letter`            | Generate dispute letter            | Yes           |
| GET    | `/dispute/letters`                    | Get user's generated letters       | Yes           |
| GET    | `/dispute/letters/:letterId/download` | Download letter as PDF             | Yes           |
| GET    | `/dispute/can-generate`               | Check if user can generate letters | Yes           |

---

## 🔧 Admin Panel Routes (`/api/admin`)

| Method | Endpoint                                | Description               | Auth Required |
| ------ | --------------------------------------- | ------------------------- | ------------- |
| POST   | `/admin/send-notification`              | Send notification         | Yes (Admin)   |
| POST   | `/admin/send-dispute-update`            | Send dispute update       | Yes (Admin)   |
| POST   | `/admin/upload-report`                  | Upload report             | Yes (Admin)   |
| POST   | `/admin/save-activity`                  | Save activity             | Yes (Admin)   |
| GET    | `/admin/get-activity`                   | Get activity              | Yes (Admin)   |
| GET    | `/admin/get-user-notifications/:userId` | Get user notifications    | Yes           |
| DELETE | `/admin/delete-notification`            | Delete notification       | Yes           |
| DELETE | `/admin/bulk-delete-notifications`      | Bulk delete notifications | Yes           |
| POST   | `/admin/upload-document`                | Upload document           | No            |
| DELETE | `/admin/delete-document`                | Delete document           | Yes           |
| GET    | `/admin/get-user-documents`             | Get user documents        | Yes           |
| POST   | `/admin/get-user-id-documents`          | Get user ID documents     | Yes (Admin)   |
| PATCH  | `/admin/update-user-role`               | Update user role          | Yes (Admin)   |
| POST   | `/admin/migrate-roles`                  | Migrate user roles        | Yes (Admin)   |
| POST   | `/admin/initial-migration-setup`        | Initial migration setup   | No            |

### Admin Subscription Management

| Method | Endpoint                                        | Description                         | Auth Required |
| ------ | ----------------------------------------------- | ----------------------------------- | ------------- |
| GET    | `/admin/subscriptions/overview`                 | Get subscription overview           | No            |
| GET    | `/admin/subscriptions/users`                    | Get users with subscription details | No            |
| PUT    | `/admin/subscriptions/user/:userId/tier`        | Update user subscription tier       | No            |
| POST   | `/admin/subscriptions/user/:userId/credits/add` | Add credits to user                 | No            |
| GET    | `/admin/subscriptions/analytics`                | Get detailed subscription analytics | No            |
| POST   | `/admin/subscriptions/process-expired`          | Process expired subscriptions       | No            |

---

## ⚙️ Settings Routes (`/api/settings`)

| Method | Endpoint                      | Description                     | Auth Required |
| ------ | ----------------------------- | ------------------------------- | ------------- |
| GET    | `/settings/profile`           | Get user settings               | Yes           |
| PUT    | `/settings/profile`           | Update profile                  | Yes           |
| PUT    | `/settings/password`          | Change password                 | Yes           |
| PUT    | `/settings/security-question` | Update security question        | Yes           |
| PUT    | `/settings/notifications`     | Update notification preferences | Yes           |
| DELETE | `/settings/account`           | Delete account                  | Yes           |

---

## 🔔 Webhook Routes (`/api/webhooks`)

| Method | Endpoint                               | Description                                | Auth Required |
| ------ | -------------------------------------- | ------------------------------------------ | ------------- |
| POST   | `/webhooks/ghl/payment-success`        | GoHighLevel payment success webhook        | No            |
| POST   | `/webhooks/ghl/subscription-cancelled` | GoHighLevel subscription cancelled webhook | No            |
| POST   | `/webhooks/ghl/payment-failed`         | GoHighLevel payment failed webhook         | No            |
| GET    | `/webhooks/ghl/test`                   | Test webhook endpoint                      | No            |
| POST   | `/webhooks/ghl/test-user-creation`     | Test user creation                         | No            |

---

## 🏥 Health Check Routes (`/api/health`)

| Method | Endpoint               | Description                    | Auth Required |
| ------ | ---------------------- | ------------------------------ | ------------- |
| GET    | `/api/health`          | Basic health check             | No            |
| GET    | `/api/health/metrics`  | System metrics                 | No            |
| GET    | `/api/health/ghl`      | GoHighLevel integration health | No            |
| GET    | `/api/health/detailed` | Detailed health information    | No            |
| GET    | `/api/health/live`     | Liveness probe (Azure)         | No            |
| GET    | `/api/health/ready`    | Readiness probe (Azure)        | No            |

---

## 🐛 Debug Routes (Development Only)

| Method | Endpoint                        | Description                 | Auth Required |
| ------ | ------------------------------- | --------------------------- | ------------- |
| GET    | `/api/debug/ghl-status`         | GHL service diagnostic      | No            |
| GET    | `/api/debug/user-lookup/:email` | User lookup test            | No            |
| GET    | `/api/debug/db-test`            | Database connection test    | No            |
| GET    | `/api/debug/env-check`          | Environment variables check | No            |

---

## 📊 System Routes

| Method | Endpoint         | Description                        | Auth Required |
| ------ | ---------------- | ---------------------------------- | ------------- |
| GET    | `/system-health` | System health monitoring dashboard | No            |

## 🔍 Additional Server Routes

These routes are available directly on the server (not under `/api`):

| Method | Endpoint         | Description                        | Auth Required |
| ------ | ---------------- | ---------------------------------- | ------------- |
| GET    | `/system-health` | System health monitoring dashboard | No            |

## 🔧 Additional API Routes

These additional routes are available directly in server.js:

| Method  | Endpoint                      | Description                            | Auth Required |
| ------- | ----------------------------- | -------------------------------------- | ------------- |
| OPTIONS | `/api/credentials/*`          | CORS preflight for credential routes   | No            |
| ALL     | `/api/credentials/monitoring` | Special CORS middleware for monitoring | No            |

**Note**: Debug and health routes are listed in their respective sections above.

---

## Response Format

All API responses follow this general format:

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

---

## Authentication Levels

- **No Auth**: Public endpoints
- **Yes**: Requires valid JWT token
- **Yes (Admin)**: Requires valid JWT token + admin role

---

## Rate Limiting

Some endpoints have rate limiting applied:

- Credential operations: Limited to prevent abuse
- File uploads: Size and frequency limits
- Authentication attempts: Brute force protection

---

## File Upload Endpoints

Several endpoints accept file uploads:

- `/auth/upload-report` - PDF, DOC, DOCX, JPG, PNG (10MB limit)
- `/admin/upload-document` - Various document types (10MB limit)
- `/chat/analyze` - Credit report files for analysis

---

## Notes

1. **CORS**: The API supports CORS for web applications
2. **Environment**: Different behavior between development and production
3. **Webhooks**: GoHighLevel webhooks for payment processing
4. **Subscription System**: Comprehensive subscription and credit management
5. **Admin Panel**: Full administrative capabilities for user management
6. **Health Monitoring**: Multiple health check endpoints for monitoring
7. **Debug Endpoints**: Available in development for troubleshooting

For detailed parameter information and examples, refer to the individual route files in the `/Backend/routes/` directory.

---

## 📋 Verification Summary

This documentation has been verified against all route files in the codebase:

✅ **Verified Route Files:**

- `/Backend/routes/authRoutes.js` - Authentication routes
- `/Backend/routes/userRoutes.js` - User management routes
- `/Backend/routes/credentialRoutes.js` - Credential management routes
- `/Backend/routes/chatRoutes.js` - Chat and AI routes
- `/Backend/routes/ghlRoutes.js` - GoHighLevel integration routes
- `/Backend/routes/subscriptionRoutes.js` - Subscription management routes
- `/Backend/routes/disputeRoutes.js` - Dispute management routes
- `/Backend/routes/adminRoutes.js` - Admin panel routes
- `/Backend/routes/settingsRoutes.js` - Settings routes
- `/Backend/routes/webhookRoutes.js` - Webhook routes
- `/Backend/routes/healthRoutes.js` - Health check routes
- `/Backend/server.js` - Additional server-level routes

✅ **Total Endpoints Documented:** 100+ endpoints across all categories

✅ **Special Features Documented:**

- CORS preflight handling
- Backward compatibility routes (`/api/chatGptService`)
- Azure-specific health probes
- Debug endpoints for development
- Webhook endpoints for payment processing
- Comprehensive subscription management
- Admin panel functionality

**Last Updated:** January 2025
