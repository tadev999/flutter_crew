---
name: flutter-routing
description: Declarative navigation with go_router, deep linking configuration, and authentication redirection guards.
---

# Flutter Declarative Routing Skill (`go_router`)

This skill explains how to build scalable, type-safe navigation with `go_router`.

## 1. Setting Up GoRouter with Auth Guard

```dart
final goRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: ValueNotifier(authState),
    redirect: (context, state) {
      final isLoggedIn = authState.isAuthenticated;
      final isLoggingIn = state.matchedLocation == '/login';
      final isSplash = state.matchedLocation == '/splash';

      if (!isLoggedIn && !isLoggingIn) return '/login';
      if (isLoggedIn && (isLoggingIn || isSplash)) return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginPage(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomePage(),
        routes: [
          GoRoute(
            path: 'details/:id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return DetailsPage(itemId: id);
            },
          ),
        ],
      ),
    ],
  );
});
```

## 2. Navigating

```dart
// Imperative push
context.push('/home/details/$id');

// Replace
context.go('/home');

// Pop
context.pop();
```
