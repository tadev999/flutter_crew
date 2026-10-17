---
name: flutter-core-patterns
description: Core Flutter UI development patterns including widget decomposition, forms with validation, theme systems, and responsive layouts.
---

# Flutter Core UI Patterns Skill

This skill details essential UI patterns in modern Flutter development.

## 1. Widget Decomposition (Classes vs Methods)

**BAD: Helper methods returning Widget:**
```dart
// ANTI-PATTERN: Entire parent widget rebuilds whenever any state changes;
// Flutter cannot short-circuit or cache the element.
Widget _buildUserProfile() {
  return Container(
    child: Text(user.name),
  );
}
```

**GOOD: Private StatelessWidgets with const constructors:**
```dart
// BEST PRACTICE: Separate element sub-tree, can be marked const, optimized by framework.
class _UserProfileCard extends StatelessWidget {
  const _UserProfileCard({required this.userName});
  final String userName;

  @override
  Widget build(BuildContext context) {
    return Container(
      child: Text(userName),
    );
  }
}
```

## 2. Form Management and Validation

```dart
class LoginForm extends StatefulWidget {
  const LoginForm({super.key, required this.onSubmit});
  final void Function(String email, String password) onSubmit;

  @override
  State<LoginForm> createState() => _LoginFormState();
}

class _LoginFormState extends State<LoginForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _emailController;
  late final TextEditingController _passwordController;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController();
    _passwordController = TextEditingController();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_formKey.currentState?.validate() ?? false) {
      widget.onSubmit(
        _emailController.text.trim(),
        _passwordController.text,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          TextFormField(
            controller: _emailController,
            decoration: const InputDecoration(labelText: 'Email'),
            keyboardType: TextInputType.emailAddress,
            validator: (value) {
              if (value == null || value.isEmpty) return 'Email is required';
              if (!value.contains('@')) return 'Enter a valid email';
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _passwordController,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password'),
            validator: (val) => (val != null && val.length >= 6) ? null : 'Min 6 chars',
          ),
          const SizedBox(height: 24),
          ElevatedButton(onPressed: _submit, child: const Text('Login')),
        ],
      ),
    );
  }
}
```

## 3. Responsive Layouts with LayoutBuilder

```dart
class AdaptiveContainer extends StatelessWidget {
  const AdaptiveContainer({super.key, required this.mobile, required this.desktop});
  final Widget mobile;
  final Widget desktop;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 800) {
          return desktop;
        }
        return mobile;
      },
    );
  }
}
```
