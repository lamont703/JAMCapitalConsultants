# JAM Capital API Client Library

A comprehensive JavaScript client library for the JAM Capital backend API, providing easy-to-use methods for authentication, user management, credential operations, and more.

## 🚀 Quick Start

### Installation

```bash
# Copy the library to your project
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
```

## 📚 Documentation

- **[Complete API Documentation](../docs/API_DOCUMENTATION.md)** - Comprehensive guide with all endpoints
- **[Usage Examples](../examples/api-usage-examples.js)** - Practical examples for different scenarios
- **[Test Suite](../tests/api-test-suite.js)** - Complete test suite demonstrating testing capabilities

## 🧪 Testing

### Run the Test Suite

```bash
# Full test suite
node tests/api-test-suite.js

# Quick tests
node -e "import('./tests/api-test-suite.js').then(m => m.quickHealthTest())"
node -e "import('./tests/api-test-suite.js').then(m => m.quickAuthTest())"
```

### Run Examples

```bash
# All examples
node examples/api-usage-examples.js

# Individual examples
node -e "import('./examples/api-usage-examples.js').then(m => m.basicSetupExample())"
```

## ✨ Key Features

- **🔐 Authentication**: Admin and user login with JWT tokens
- **👥 User Management**: Search, profile management, pagination
- **🔑 Credential Operations**: Secure credential storage and retrieval
- **💬 Chat Integration**: AI-powered chat system
- **📄 Document Management**: File upload and management
- **🔔 Notifications**: User notification system
- **⚡ Performance**: Built-in retry logic and error handling
- **🛠️ Extensible**: Request/response interceptors and middleware

## 🎯 Benefits for Testing

### Automated Testing

```javascript
import JamCapitalAPI from "./jam-capital-api.js";

const api = new JamCapitalAPI({ baseURL: "http://localhost:3000/api" });

describe("API Tests", () => {
  it("should authenticate successfully", async () => {
    const result = await api.loginAdmin("admin@test.com", "password");
    expect(result.success).toBe(true);
  });
});
```

### Integration Testing

```javascript
// Test complete workflows
await api.loginAdmin("admin@test.com", "password");
const users = await api.searchUsers({ limit: 10 });
const credentials = await api.retrieveCredentials({
  userEmail: users.data[0].email,
  serviceType: "smartcredit",
  purpose: "testing",
});
```

### Load Testing

```javascript
// Test multiple concurrent requests
const promises = Array(10)
  .fill()
  .map(() => api.getHealth());
const results = await Promise.all(promises);
```

## 🔧 Configuration Options

```javascript
const api = new JamCapitalAPI({
  baseURL: "https://your-api-url.com/api", // API base URL
  debug: true, // Enable debug logging
  apiKey: "your-api-key", // Optional API key
});
```

## 🚨 Error Handling

```javascript
import { APIError } from "./jam-capital-api.js";

try {
  const result = await api.retrieveCredentials(params);
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

## 📊 Service Types

```javascript
import { SERVICE_TYPES } from "./jam-capital-api.js";

// Available service types
SERVICE_TYPES.SMART_CREDIT; // 'smartcredit'
SERVICE_TYPES.IDENTITY_IQ; // 'identityiq'
SERVICE_TYPES.MY_SCORE_IQ; // 'myscoreiq'
SERVICE_TYPES.CFPB; // 'cfpb'
SERVICE_TYPES.ANNUAL_CREDIT_REPORT; // 'annualcreditreport'
```

## 🔗 API Endpoints

The library provides methods for all major API endpoints:

- **Health & Status**: `getHealth()`, `getVersion()`
- **Authentication**: `loginAdmin()`, `loginUser()`, `logout()`
- **User Management**: `getUserProfile()`, `searchUsers()`, `getAllUsers()`
- **Credentials**: `storeCredentials()`, `retrieveCredentials()`, `getCredentialHistory()`
- **Chat**: `sendChatMessage()`, `getChatHistory()`
- **Documents**: `uploadDocument()`, `getDocuments()`, `deleteDocument()`
- **Notifications**: `getNotifications()`, `markNotificationRead()`

## 🎉 Success Stories

### Before API Library

```javascript
// Manual fetch calls, error handling, token management
const response = await fetch("/api/credentials/admin/retrieve", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(data),
});

if (!response.ok) {
  // Manual error handling...
}

const result = await response.json();
// Manual response processing...
```

### After API Library

```javascript
// Clean, simple, powerful
const credentials = await api.retrieveCredentials({
  userEmail: "user@example.com",
  serviceType: SERVICE_TYPES.SMART_CREDIT,
  purpose: "account_verification",
});
```

## 📈 Testing Benefits

| Aspect             | Before      | After                  |
| ------------------ | ----------- | ---------------------- |
| **Setup Time**     | 30+ minutes | 2 minutes              |
| **Test Code**      | 50+ lines   | 5 lines                |
| **Error Handling** | Manual      | Automatic              |
| **Retry Logic**    | Custom      | Built-in               |
| **Type Safety**    | None        | Constants & validation |
| **Documentation**  | Scattered   | Comprehensive          |

---

**Ready to get started?** Check out the [complete documentation](../docs/API_DOCUMENTATION.md) and [usage examples](../examples/api-usage-examples.js)!

**Version:** 1.0.0  
**Last Updated:** January 15, 2025
