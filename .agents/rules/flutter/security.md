# Flutter Mobile Security Rules

## 1. Secrets & Credentials
- NEVER commit private credentials, API secrets, service account JSONs, or database admin passwords into Git.
- Pass environment configuration using `--dart-define-from-file` or `.env` (gitignored).

## 2. Storage Security
- Store sensitive user data, access tokens, refresh tokens, and biometrics flags ONLY in `flutter_secure_storage`.
- Never store tokens in `SharedPreferences` or unencrypted SQLite databases.

## 3. Network Transport
- Disallow cleartext HTTP traffic in release builds on both Android and iOS.
- Set appropriate timeouts on all network calls.
- Validate and sanitize input received from deep links and URL schemes.
