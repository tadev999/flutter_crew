---
name: flutter-security
description: Mobile application security guidelines for Flutter, including secure storage, SSL pinning, compile-time environment variables, and input sanitization.
---

# Flutter Mobile Security Skill

This skill provides essential guidelines to secure Flutter apps against client tampering and data leakage.

## 1. Secrets Management

- **Public Keys vs Private Secrets**:
  - Firebase config / Supabase anon keys are intended for client usage, BUT MUST be guarded by server-side rules (Firestore Security Rules / Supabase RLS).
  - Private service keys (e.g. Firebase Admin SDK, Supabase Service Role Key) MUST NEVER exist anywhere in Flutter client code.
- **Loading Environment Variables**:
  ```bash
  # Run/Build with dart-define:
  flutter run --dart-define=API_URL=https://api.myapp.com --dart-define=SUPABASE_ANON_KEY=xyz
  
  # Or use a json file (gitignored):
  flutter run --dart-define-from-file=secrets.json
  ```
  ```dart
  // Reading in Dart:
  const apiUrl = String.fromEnvironment('API_URL');
  ```

## 2. Secure Local Storage

Never save auth tokens, passwords, or PINs in `SharedPreferences`.
Use `flutter_secure_storage`:
```dart
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureVault {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static Future<void> saveAuthToken(String token) => _storage.write(key: 'jwt', value: token);
  static Future<String?> getAuthToken() => _storage.read(key: 'jwt');
  static Future<void> clear() => _storage.deleteAll();
}
```

## 3. Disabling Cleartext Traffic

- **Android (`android/app/src/main/AndroidManifest.xml`)**:
  ```xml
  <application
      android:usesCleartextTraffic="false"
      ... >
  ```
- **iOS (`ios/Runner/Info.plist`)**:
  Ensure `NSAllowsArbitraryLoads` is set to `false`.

## 4. Code Obfuscation on Release Builds

```bash
flutter build appbundle --obfuscate --split-debug-info=./symbols/android
flutter build ipa --obfuscate --split-debug-info=./symbols/ios
```
