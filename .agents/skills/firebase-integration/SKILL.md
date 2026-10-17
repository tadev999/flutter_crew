---
name: firebase-integration
description: Comprehensive Firebase setup and integration skill for Flutter including Firestore typed converters, Auth, Cloud Functions, and security rules.
---

# Firebase Backend Integration Skill for Flutter

This skill provides step-by-step instructions for integrating Firebase into Flutter apps safely.

## 1. Setup & Configuration

Add packages to `pubspec.yaml`:
```yaml
dependencies:
  firebase_core: ^3.0.0
  firebase_auth: ^5.0.0
  cloud_firestore: ^5.0.0
  firebase_storage: ^12.0.0
```

Initialize in `lib/main.dart`:
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const MyApp());
}
```

## 2. Firestore Remote DataSource with `withConverter`

```dart
class FirestoreUserRemoteDataSource {
  const FirestoreUserRemoteDataSource(this._firestore);
  final FirebaseFirestore _firestore;

  CollectionReference<UserDto> get _usersCollection =>
      _firestore.collection('users').withConverter<UserDto>(
            fromFirestore: (snapshot, _) => UserDto.fromJson(snapshot.data()!, snapshot.id),
            toFirestore: (user, _) => user.toJson(),
          );

  Future<UserDto?> getUser(String id) async {
    final doc = await _usersCollection.doc(id).get();
    return doc.data();
  }

  Stream<UserDto?> watchUser(String id) {
    return _usersCollection.doc(id).snapshots().map((snap) => snap.data());
  }

  Future<void> saveUser(UserDto user) async {
    await _usersCollection.doc(user.id).set(user, SetOptions(merge: true));
  }
}
```

## 3. Production Firestore Security Rules (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    // User profile rule
    match /users/{userId} {
      allow read: if isSignedIn();
      allow create: if isOwner(userId) && request.resource.data.email is string;
      allow update: if isOwner(userId);
      allow delete: if false; // Disallow client deletes
    }

    // Orders rule (only order owner can access)
    match /orders/{orderId} {
      allow read: if isSignedIn() && resource.data.userId == request.auth.uid;
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if false; // Read-only once placed
    }
  }
}
```
