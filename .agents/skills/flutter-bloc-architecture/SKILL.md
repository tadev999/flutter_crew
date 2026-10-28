---
name: flutter-bloc-architecture
description: Feature-first BLoC architecture for Flutter with models, services, Bloc/Cubit business logic, and dumb Views. Follows the project's existing state management if it already uses something else.
---

# Flutter BLoC Architecture Skill

This skill guides you through implementing pragmatic, feature-first **BLoC** in Flutter
applications with `flutter_bloc`. If the target project already uses another state
management solution (Riverpod, Provider, ...), follow that consistently instead.

## 1. Directory Structure (Feature-First BLoC)

```
lib/
├── core/
│   ├── constants/
│   ├── errors/
│   │   └── failures.dart
│   ├── services/
│   ├── theme/
│   └── utils/
└── features/
    └── authentication/
        ├── models/              # Immutable data classes, DTOs (fromJson/toJson)
        │   └── user_model.dart
        ├── services/            # API clients, Firebase/Supabase data services
        │   └── auth_service.dart
        ├── bloc/                # Business logic & state (Bloc or Cubit)
        │   ├── auth_bloc.dart
        │   ├── auth_event.dart
        │   └── auth_state.dart
        └── views/               # UI screens & reusable widgets
            ├── pages/
            │   └── login_page.dart
            └── widgets/
                └── login_form.dart
```

Use a `Cubit` (`<feature>_cubit.dart` + `<feature>_state.dart`) for simple flows and a
`Bloc` with events when you need event transformers (debounce, restartable, droppable)
or an explicit event log.

---

## 2. Core Rule: Responsibilities

```
┌─────────────────┐   BlocBuilder / BlocListener   ┌─────────────────┐
│      VIEW       │ <───────────────────────────── │   BLOC / CUBIT  │
│  (UI / Widgets) │ ─────────────────────────────> │ (Logic / State) │
└─────────────────┘        add(event) / call       └─────────────────┘
                                                            │ calls
                                                            ▼
                                                   ┌─────────────────┐
                                                   │ SERVICE / MODEL │
                                                   └─────────────────┘
```

1. **Models**: immutable data classes (`final` fields, `copyWith`, validated `fromJson`/`toJson`); no Flutter UI imports.
2. **Services**: backend/storage/API access behind small interfaces, injected by constructor; map SDK exceptions to typed failures.
3. **Bloc / Cubit**:
   - Holds all business logic, validation and state transitions.
   - States are immutable Dart 3 `sealed class` hierarchies (`Initial`, `Loading`, `Success`, `Failure`); events are immutable too.
   - Depends on service interfaces, never on widgets, `BuildContext` or `dart:ui`.
   - Cancel stream subscriptions in `close()`.
4. **Views**:
   - Pure UI (`StatelessWidget` preferred); provide blocs with `BlocProvider` at the route/feature boundary.
   - Render with `BlocBuilder`/`BlocSelector` (use `buildWhen`), side effects with `BlocListener` (navigation, snackbars).
   - Forward user gestures via `bloc.add(Event)` or cubit methods; zero business logic in `build()`.

---

## 3. Implementation Pattern Example

### Model: `lib/features/auth/models/user_model.dart`
```dart
class UserModel {
  const UserModel({required this.id, required this.email, required this.displayName});

  final String id;
  final String email;
  final String displayName;

  factory UserModel.fromJson(Map<String, dynamic> json) => UserModel(
        id: json['id'] as String,
        email: json['email'] as String,
        displayName: json['display_name'] as String? ?? '',
      );

  Map<String, dynamic> toJson() => {'id': id, 'email': email, 'display_name': displayName};
}
```

### Service: `lib/features/auth/services/auth_service.dart`
```dart
abstract interface class AuthService {
  Future<UserModel> signIn(String email, String password);
  Future<void> signOut();
}

class SupabaseAuthService implements AuthService {
  SupabaseAuthService(this._client);
  final SupabaseClient _client;

  @override
  Future<UserModel> signIn(String email, String password) async {
    final response = await _client.auth.signInWithPassword(email: email, password: password);
    final user = response.user;
    if (user == null) throw const AuthFailure('Sign-in failed');
    return UserModel(id: user.id, email: user.email ?? '', displayName: '');
  }

  @override
  Future<void> signOut() => _client.auth.signOut();
}
```

### Bloc: `lib/features/auth/bloc/`
```dart
// auth_event.dart
sealed class AuthEvent {
  const AuthEvent();
}

final class LoginRequested extends AuthEvent {
  const LoginRequested(this.email, this.password);
  final String email;
  final String password;
}

// auth_state.dart
sealed class AuthState {
  const AuthState();
}

final class AuthInitial extends AuthState {
  const AuthInitial();
}

final class AuthLoading extends AuthState {
  const AuthLoading();
}

final class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user);
  final UserModel user;
}

final class AuthError extends AuthState {
  const AuthError(this.message);
  final String message;
}

// auth_bloc.dart
class AuthBloc extends Bloc<AuthEvent, AuthState> {
  AuthBloc(this._authService) : super(const AuthInitial()) {
    on<LoginRequested>(_onLoginRequested, transformer: droppable());
  }

  final AuthService _authService;

  Future<void> _onLoginRequested(LoginRequested event, Emitter<AuthState> emit) async {
    emit(const AuthLoading());
    try {
      emit(AuthAuthenticated(await _authService.signIn(event.email, event.password)));
    } on AuthFailure catch (failure) {
      emit(AuthError(failure.message));
    }
  }
}
```

`droppable()` comes from `bloc_concurrency`; omit the transformer if the project does not use it.

### View: `lib/features/auth/views/pages/login_page.dart`
```dart
class LoginPage extends StatelessWidget {
  const LoginPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Login')),
      body: BlocConsumer<AuthBloc, AuthState>(
        listener: (context, state) {
          if (state is AuthError) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(state.message)));
          }
        },
        builder: (context, state) => switch (state) {
          AuthLoading() => const Center(child: CircularProgressIndicator()),
          _ => LoginForm(
              onSubmit: (email, pass) => context.read<AuthBloc>().add(LoginRequested(email, pass)),
            ),
        },
      ),
    );
  }
}
```

---

## 4. Testing Blocs

Because the Bloc only depends on the service interface, tests are fast. Use `bloc_test`
for Bloc/Cubit and `mocktail` only when mocks help:

```dart
class MockAuthService extends Mock implements AuthService {}

void main() {
  late MockAuthService authService;

  setUp(() => authService = MockAuthService());

  blocTest<AuthBloc, AuthState>(
    'emits [AuthLoading, AuthAuthenticated] when login succeeds',
    build: () {
      when(() => authService.signIn(any(), any())).thenAnswer(
          (_) async => const UserModel(id: '1', email: 'test@mail.com', displayName: 'Test'));
      return AuthBloc(authService);
    },
    act: (bloc) => bloc.add(const LoginRequested('test@mail.com', 'pass123')),
    expect: () => [isA<AuthLoading>(), isA<AuthAuthenticated>()],
  );

  blocTest<AuthBloc, AuthState>(
    'emits [AuthLoading, AuthError] when the service fails',
    build: () {
      when(() => authService.signIn(any(), any())).thenThrow(const AuthFailure('Invalid credentials'));
      return AuthBloc(authService);
    },
    act: (bloc) => bloc.add(const LoginRequested('test@mail.com', 'wrong')),
    expect: () => [isA<AuthLoading>(), isA<AuthError>()],
  );
}
```
