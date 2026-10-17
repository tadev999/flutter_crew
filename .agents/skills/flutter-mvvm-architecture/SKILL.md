---
name: flutter-mvvm-architecture
description: MVVM (Model-View-ViewModel) architecture implementation for Flutter with feature-first modular structure, models, services, ViewModels (BLoC/Cubit, Riverpod, ChangeNotifier), and dumb Views.
---

# Flutter MVVM Architecture Skill

This skill guides you through implementing clean, pragmatic **MVVM (Model-View-ViewModel)** in Flutter applications.

## 1. Directory Structure (Feature-First MVVM)

```
lib/
├── core/
│   ├── constants/
│   ├── errors/
│   │   ├── exceptions.dart
│   │   └── failures.dart
│   ├── network/
│   ├── services/
│   ├── theme/
│   └── utils/
└── features/
    └── authentication/
        ├── models/              # Data classes, DTOs (fromJson/toJson)
        │   └── user_model.dart
        ├── services/            # API clients, Firebase/Supabase data services
        │   └── auth_service.dart
        ├── viewmodels/          # Business logic & state management
        │   ├── auth_viewmodel.dart
        │   └── auth_state.dart
        └── views/               # UI screens & reusable widgets
            ├── pages/
            │   └── login_page.dart
            └── widgets/
                └── login_form.dart
```

---

## 2. Core Rule: MVVM Responsibilities

```
┌─────────────────┐       observes state       ┌─────────────────┐
│      VIEW       │ <───────────────────────── │    VIEWMODEL    │
│  (UI / Widgets) │ ─────────────────────────> │ (Logic / State) │
└─────────────────┘      dispatches actions    └─────────────────┘
                                                        │
                                                        │ calls
                                                        ▼
                                               ┌─────────────────┐
                                               │      MODEL      │
                                               │ (Data / Service)│
                                               └─────────────────┘
```

1. **Model**:
   - Immutable data classes (`freezed` or standard Dart 3 records/classes with `copyWith`, `fromJson`, `toJson`).
   - Service / Repository layer handling network requests, Firebase Firestore, or Supabase PostgreSQL queries.
   - Independent of Flutter UI.

2. **ViewModel**:
   - Exposes state (e.g., via `Cubit`, `Bloc`, `AsyncNotifier`, or `ChangeNotifier`).
   - Handles all business logic, validation, and data transformations.
   - Calls Services/Models to fetch and mutate data.
   - **Never import `dart:ui` or store `BuildContext` inside a ViewModel.**

3. **View**:
   - Pure UI widgets (`StatelessWidget` preferred).
   - Listens to ViewModel state (`BlocBuilder`, `ref.watch`, `Consumer`) and renders UI.
   - Forwards user gestures (taps, submissions) directly to ViewModel methods.
   - Zero business logic inside `build()` methods.

---

## 3. Implementation Pattern Example (Cubit / BLoC)

### Model: `lib/features/auth/models/user_model.dart`
```dart
class UserModel {
  final String id;
  final String email;
  final String displayName;

  const UserModel({
    required this.id,
    required this.email,
    required this.displayName,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
    id: json['id'] as String,
    email: json['email'] as String,
    displayName: json['display_name'] as String? ?? '',
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'email': email,
    'display_name': displayName,
  };
}
```

### Service: `lib/features/auth/services/auth_service.dart`
```dart
abstract class AuthService {
  Future<UserModel> signIn(String email, String password);
  Future<void> signOut();
}

class SupabaseAuthService implements AuthService {
  final SupabaseClient _client;
  SupabaseAuthService(this._client);

  @override
  Future<UserModel> signIn(String email, String password) async {
    final response = await _client.auth.signInWithPassword(email: email, password: password);
    final user = response.user;
    if (user == null) throw Exception('Sign-in failed');
    return UserModel(id: user.id, email: user.email ?? '', displayName: '');
  }

  @override
  Future<void> signOut() => _client.auth.signOut();
}
```

### ViewModel: `lib/features/auth/viewmodels/auth_viewmodel.dart`
```dart
sealed class AuthState {}
class AuthInitial extends AuthState {}
class AuthLoading extends AuthState {}
class AuthAuthenticated extends AuthState {
  final UserModel user;
  AuthAuthenticated(this.user);
}
class AuthError extends AuthState {
  final String message;
  AuthError(this.message);
}

class AuthViewModel extends Cubit<AuthState> {
  final AuthService _authService;

  AuthViewModel(this._authService) : super(AuthInitial());

  Future<void> login(String email, String password) async {
    emit(AuthLoading());
    try {
      final user = await _authService.signIn(email, password);
      emit(AuthAuthenticated(user));
    } catch (e) {
      emit(AuthError(e.toString()));
    }
  }
}
```

### View: `lib/features/auth/views/pages/login_page.dart`
```dart
class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Login')),
      body: BlocConsumer<AuthViewModel, AuthState>(
        listener: (context, state) {
          if (state is AuthError) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.message)));
          }
        },
        builder: (context, state) {
          if (state is AuthLoading) {
            return const Center(child: CircularProgressIndicator());
          }
          return LoginForm(
            onSubmit: (email, pass) => context.read<AuthViewModel>().login(email, pass),
          );
        },
      ),
    );
  }
}
```

---

## 4. Unit Testing in MVVM

Because the ViewModel only interacts with the Service interface, unit tests are fast and straightforward:

```dart
void main() {
  late MockAuthService mockAuthService;
  late AuthViewModel viewModel;

  setUp(() {
    mockAuthService = MockAuthService();
    viewModel = AuthViewModel(mockAuthService);
  });

  blocTest<AuthViewModel, AuthState>(
    'emits [AuthLoading, AuthAuthenticated] when login succeeds',
    build: () {
      when(() => mockAuthService.signIn(any(), any()))
          .thenAnswer((_) async => const UserModel(id: '1', email: 'test@mail.com', displayName: 'Test'));
      return viewModel;
    },
    act: (vm) => vm.login('test@mail.com', 'pass123'),
    expect: () => [
      isA<AuthLoading>(),
      isA<AuthAuthenticated>(),
    ],
  );
}
```
