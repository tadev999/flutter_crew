# Firebase Firestore & Storage Rules Standards

## 1. Zero Trust Baseline
- Default action is DENY. Never deploy open rules:
  ```javascript
  // STRICTLY FORBIDDEN IN PRODUCTION:
  allow read, write: if true;
  ```

## 2. Authentication Verification
- Every non-public document access must verify `request.auth != null`.
- Ownership verification must check `request.auth.uid == resource.data.userId` or `request.auth.uid == userId` for user documents.

## 3. Data Shape & Payload Validation
- Writes must validate that incoming data conforms to expected fields and types:
  ```javascript
  allow create: if request.auth != null
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.title is string
    && request.resource.data.title.size() > 0
    && request.resource.data.title.size() <= 100;
  ```

## 4. Storage Security
- Validate file size and MIME content type on upload:
  ```javascript
  allow write: if request.auth != null
    && request.resource.size < 5 * 1024 * 1024
    && request.resource.contentType.matches('image/.*');
  ```
