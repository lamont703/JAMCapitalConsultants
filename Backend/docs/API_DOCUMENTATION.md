# JAM Capital API Documentation

## Overview

The JAM Capital API provides secure access to credit monitoring, user management, and AI-powered dispute services. This RESTful API supports both admin and user operations with JWT-based authentication.

**Base URL (Production):** `https://jam-capital-backend.azurewebsites.net/api`  
**Base URL (Development):** `http://localhost:3000/api`

## Table of Contents

- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [API Endpoints](#api-endpoints)
  - [Health & Status](#health--status)
  - [Authentication](#authentication-endpoints)
  - [User Management](#user-management)
  - [Credential Management](#credential-management)
  - [Chat & AI](#chat--ai)
  - [Document Management](#document-management)
  - [Notifications](#notifications)
- [API Client Library](#api-client-library)
- [Examples](#examples)

---

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

### Token Expiration

- **Access Tokens:** 24 hours
- **Refresh Tokens:** 30 days

---

## Error Handling

All API responses follow a consistent format:

### Success Response

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## Rate Limiting

- **General API calls:** 100 requests per minute per IP
- **Authentication:** 10 requests per minute per IP
- **Credential operations:** 20 requests per minute per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## API Endpoints

### Health & Status

#### GET /health

Check API health status.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 86400,
  "environment": "production",
  "version": "1.0.0",
  "azure": {
    "region": "eastus2",
    "instance": "instance-id"
  }
}
```

#### GET /version

Get API version information.

**Response:**

```json
{
  "version": "1.0.0",
  "buildDate": "2025-01-15T00:00:00.000Z",
  "gitCommit": "abc123def",
  "environment": "production"
}
```

---

### Authentication Endpoints

#### POST /auth/login

Authenticate admin user.

**Request Body:**

```json
{
  "email": "admin@jamcapital.com",
  "password": "secure-password"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Authentication successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "admin@jamcapital.com",
    "role": "admin",
    "name": "Admin User"
  },
  "expiresIn": "24h"
}
```

#### POST /auth/user/login

Authenticate regular user.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "user-password"
}
```

**Response:** Same format as admin login with `"role": "user"`

#### POST /auth/logout

Logout current user.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### POST /auth/refresh

Refresh authentication token.

**Request Body:**

```json
{
  "refreshToken": "refresh-token-here"
}
```

**Response:**

```json
{
  "success": true,
  "token": "new-jwt-token",
  "expiresIn": "24h"
}
```

---

### User Management

#### GET /users/profile

Get current user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastLoginAt": "2025-01-15T10:00:00.000Z",
    "profile": {
      "phone": "+1234567890",
      "address": "123 Main St",
      "dateOfBirth": "1990-01-01"
    }
  }
}
```

#### PUT /users/profile

Update user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "name": "John Smith",
  "profile": {
    "phone": "+1987654321",
    "address": "456 Oak Ave"
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    /* updated profile */
  }
}
```

#### GET /users/search (Admin Only)

Search for users.

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**

- `email` (string) - Email to search for
- `name` (string) - Name to search for
- `limit` (number) - Maximum results (default: 10, max: 100)

**Example:** `GET /users/search?email=john@example.com&limit=5`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "user_123",
      "email": "john@example.com",
      "name": "John Doe",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastLoginAt": "2025-01-15T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

#### GET /users (Admin Only)

Get all users with pagination.

**Headers:** `Authorization: Bearer <admin-token>`

**Query Parameters:**

- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 20, max: 100)
- `sortBy` (string) - Sort field (createdAt, email, name)
- `sortOrder` (string) - Sort order (asc, desc)

**Response:**

```json
{
  "success": true,
  "data": {
    "users": [
      /* array of users */
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

---

### Credential Management

#### POST /credentials/store

Store user credentials for a service.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "serviceType": "smartcredit",
  "email": "user@creditservice.com",
  "password": "service-password",
  "ssn": "1234",
  "purpose": "credit_monitoring"
}
```

**Service Types:**

- `smartcredit` - SmartCredit
- `identityiq` - IdentityIQ
- `myscoreiq` - MyScoreIQ
- `cfpb` - Consumer Financial Protection Bureau
- `annualcreditreport` - AnnualCreditReport.com

**Response:**

```json
{
  "success": true,
  "message": "Credentials stored successfully",
  "data": {
    "credentialId": "cred_123",
    "serviceType": "smartcredit",
    "status": "active",
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

#### POST /credentials/admin/retrieve (Admin Only)

Retrieve user credentials.

**Headers:** `Authorization: Bearer <admin-token>`

**Request Body:**

```json
{
  "userEmail": "user@example.com",
  "serviceType": "smartcredit",
  "purpose": "dispute_assistance"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Credentials retrieved successfully",
  "data": {
    "serviceType": "smartcredit",
    "email": "user@creditservice.com",
    "password": "service-password",
    "ssn": "1234",
    "lastAccessed": "2025-01-15T10:30:00.000Z"
  }
}
```

**Warning Response (Corrupted Data):**

```json
{
  "success": true,
  "message": "Credentials retrieved with decryption warnings",
  "data": {
    "serviceType": "smartcredit",
    "email": "DECRYPTION_FAILED",
    "password": "DECRYPTION_FAILED",
    "ssn": "DECRYPTION_FAILED",
    "lastAccessed": "2025-01-15T10:30:00.000Z",
    "warning": "Some credentials could not be decrypted. These credentials may be corrupted and should be re-entered.",
    "decryptionStatus": {
      "email": false,
      "password": false,
      "ssn": false
    }
  }
}
```

#### PUT /credentials/{credentialId}

Update user credentials.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "email": "newemail@creditservice.com",
  "password": "new-password"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Credentials updated successfully"
}
```

#### DELETE /credentials/{credentialId}

Delete user credentials.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "success": true,
  "message": "Credentials deleted successfully"
}
```

#### GET /credentials/history

Get credential access history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `userEmail` (string) - User email (admin only)
- `serviceType` (string) - Filter by service type
- `limit` (number) - Maximum results

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "access_123",
      "serviceType": "smartcredit",
      "accessedAt": "2025-01-15T10:30:00.000Z",
      "accessedBy": "admin@jamcapital.com",
      "purpose": "dispute_assistance",
      "ipAddress": "192.168.1.1"
    }
  ]
}
```

---

### Chat & AI

#### POST /chat/message

Send message to AI chat system.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**

```json
{
  "message": "Help me understand my credit report",
  "context": "dispute_assistance",
  "attachments": ["document_id_123"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "messageId": "msg_123",
    "response": "I'd be happy to help you understand your credit report...",
    "suggestions": [
      "Review your payment history",
      "Check for errors in personal information"
    ],
    "timestamp": "2025-01-15T10:30:00.000Z"
  }
}
```

#### GET /chat/history

Get chat message history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `limit` (number) - Number of messages (default: 50, max: 200)
- `before` (string) - Get messages before this timestamp
- `context` (string) - Filter by context

**Response:**

```json
{
  "success": true,
  "data": {
    "messages": [
      {
        "id": "msg_123",
        "message": "Help me understand my credit report",
        "response": "I'd be happy to help...",
        "timestamp": "2025-01-15T10:30:00.000Z",
        "context": "dispute_assistance"
      }
    ],
    "hasMore": false
  }
}
```

---

### Document Management

#### POST /documents/upload

Upload a document.

**Headers:**

- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Form Data:**

- `document` (file) - Document file
- `metadata` (JSON string) - Document metadata

**Metadata Example:**

```json
{
  "type": "credit_report",
  "description": "Monthly credit report",
  "tags": ["credit", "report", "january"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "documentId": "doc_123",
    "filename": "credit_report.pdf",
    "size": 1024000,
    "type": "application/pdf",
    "uploadedAt": "2025-01-15T10:30:00.000Z",
    "url": "https://storage.azure.com/documents/doc_123.pdf"
  }
}
```

#### GET /documents

Get user documents.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `type` (string) - Filter by document type
- `limit` (number) - Maximum results
- `page` (number) - Page number

**Response:**

```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc_123",
        "filename": "credit_report.pdf",
        "type": "application/pdf",
        "size": 1024000,
        "uploadedAt": "2025-01-15T10:30:00.000Z",
        "metadata": {
          "type": "credit_report",
          "description": "Monthly credit report"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

#### DELETE /documents/{documentId}

Delete a document.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

---

### Notifications

#### GET /notifications

Get user notifications.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**

- `unread` (boolean) - Filter unread notifications
- `type` (string) - Filter by notification type
- `limit` (number) - Maximum results

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "notif_123",
      "type": "credit_update",
      "title": "Credit Score Updated",
      "message": "Your credit score has been updated to 750",
      "read": false,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "data": {
        "score": 750,
        "change": "+10"
      }
    }
  ]
}
```

#### PUT /notifications/{notificationId}/read

Mark notification as read.

**Headers:** `Authorization: Bearer <token>`

**Response:**

```json
{
  "success": true,
  "message": "Notification marked as read"
}
```

---

## API Client Library

### Installation

```bash
# Copy the library file to your project
cp lib/jam-capital-api.js your-project/
```

### Basic Usage

```javascript
import JamCapitalAPI from "./jam-capital-api.js";

// Initialize the client
const api = new JamCapitalAPI({
  baseURL: "https://jam-capital-backend.azurewebsites.net/api",
  debug: true,
});

// Authenticate
await api.loginAdmin("admin@jamcapital.com", "password");

// Use API methods
const health = await api.getHealth();
const users = await api.searchUsers({ email: "user@example.com" });
const credentials = await api.retrieveCredentials({
  userEmail: "user@example.com",
  serviceType: "smartcredit",
  purpose: "dispute_assistance",
});
```

### Configuration Options

```javascript
const api = new JamCapitalAPI({
  baseURL: "http://localhost:3000/api", // API base URL
  debug: true, // Enable debug logging
  apiKey: "your-api-key", // Optional API key
});
```

### Error Handling

```javascript
try {
  const result = await api.retrieveCredentials(params);
  console.log("Success:", result);
} catch (error) {
  if (error instanceof APIError) {
    console.error("API Error:", error.message);
    console.error("Status:", error.status);
    console.error("Data:", error.data);
  } else {
    console.error("Network Error:", error.message);
  }
}
```

### Interceptors

```javascript
// Add request interceptor
api.addRequestInterceptor(async (requestOptions) => {
  console.log("Making request:", requestOptions);
  // Modify request if needed
});

// Add response interceptor
api.addResponseInterceptor(async (response, data) => {
  console.log("Received response:", response.status);
  // Handle response if needed
});
```

---

## Examples

### Complete Authentication Flow

```javascript
import JamCapitalAPI from "./jam-capital-api.js";

const api = new JamCapitalAPI({
  baseURL: "https://jam-capital-backend.azurewebsites.net/api",
  debug: true,
});

async function authenticateAndGetProfile() {
  try {
    // Login
    const loginResult = await api.loginAdmin(
      "admin@jamcapital.com",
      "password"
    );
    console.log("Logged in:", loginResult.user.name);

    // Get profile
    const profile = await api.getUserProfile();
    console.log("Profile:", profile);

    // Logout
    await api.logout();
    console.log("Logged out successfully");
  } catch (error) {
    console.error("Authentication failed:", error.message);
  }
}
```

### Credential Management Example

```javascript
async function manageCredentials() {
  // Authenticate first
  await api.loginAdmin("admin@jamcapital.com", "password");

  try {
    // Store credentials
    const storeResult = await api.storeCredentials({
      serviceType: "smartcredit",
      email: "user@creditservice.com",
      password: "secure-password",
      ssn: "1234",
      purpose: "credit_monitoring",
    });
    console.log("Credentials stored:", storeResult.data.credentialId);

    // Retrieve credentials
    const credentials = await api.retrieveCredentials({
      userEmail: "user@example.com",
      serviceType: "smartcredit",
      purpose: "dispute_assistance",
    });

    if (credentials.data.warning) {
      console.warn("Decryption warning:", credentials.data.warning);
    } else {
      console.log("Retrieved credentials for:", credentials.data.email);
    }
  } catch (error) {
    console.error("Credential operation failed:", error.message);
  }
}
```

### Bulk User Search

```javascript
async function searchAllUsers() {
  await api.loginAdmin("admin@jamcapital.com", "password");

  try {
    const searchResults = await api.searchUsers({
      limit: 50,
    });

    console.log(`Found ${searchResults.total} users:`);
    searchResults.data.forEach((user) => {
      console.log(`- ${user.name} (${user.email})`);
    });
  } catch (error) {
    console.error("Search failed:", error.message);
  }
}
```

### Chat Integration

```javascript
async function chatWithAI() {
  await api.loginUser("user@example.com", "password");

  try {
    const response = await api.sendChatMessage({
      message: "I found an error on my credit report. What should I do?",
      context: "dispute_assistance",
    });

    console.log("AI Response:", response.data.response);

    if (response.data.suggestions) {
      console.log("Suggestions:");
      response.data.suggestions.forEach((suggestion) => {
        console.log(`- ${suggestion}`);
      });
    }
  } catch (error) {
    console.error("Chat failed:", error.message);
  }
}
```

---

## Testing with the API Library

The API library makes testing much easier. Here's an example test suite:

```javascript
import JamCapitalAPI, { APIError } from "./jam-capital-api.js";
import assert from "assert";

describe("JAM Capital API Tests", () => {
  let api;

  beforeEach(() => {
    api = new JamCapitalAPI({
      baseURL: "http://localhost:3000/api",
      debug: false,
    });
  });

  describe("Authentication", () => {
    it("should authenticate admin successfully", async () => {
      const result = await api.loginAdmin("admin@jamcapital.com", "password");
      assert.strictEqual(result.success, true);
      assert.ok(result.token);
      assert.ok(api.isAuthenticated());
    });

    it("should fail with invalid credentials", async () => {
      try {
        await api.loginAdmin("admin@jamcapital.com", "wrong-password");
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.ok(error instanceof APIError);
        assert.strictEqual(error.status, 401);
      }
    });
  });

  describe("Health Check", () => {
    it("should return healthy status", async () => {
      const health = await api.getHealth();
      assert.strictEqual(health.status, "healthy");
      assert.ok(health.uptime > 0);
    });
  });

  describe("Credential Management", () => {
    beforeEach(async () => {
      await api.loginAdmin("admin@jamcapital.com", "password");
    });

    it("should retrieve credentials successfully", async () => {
      const credentials = await api.retrieveCredentials({
        userEmail: "test@example.com",
        serviceType: "smartcredit",
        purpose: "testing",
      });

      assert.strictEqual(credentials.success, true);
      assert.ok(credentials.data);
    });
  });
});
```

---

## Support

For API support and questions:

- **Email:** support@jamcapitalconsultants.com
- **Documentation:** This document
- **Status Page:** https://status.jamcapitalconsultants.com

---

**Last Updated:** January 15, 2025  
**Version:** 1.0.0
