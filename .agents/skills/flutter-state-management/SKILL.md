---
name: flutter-state-management
description: Best practices for Flutter state management with BLoC/Cubit, Riverpod 2.x, and Provider, including immutable states, sealed classes, and selector optimization.
---

# Flutter State Management Skill

This skill provides patterns for managing state in production Flutter applications.

## 1. BLoC & Cubit Pattern

### When to use Cubit vs BLoC:
- **Cubit**: Ideal for CRUD operations, simple transitions, and state changes directly triggered by function calls.
- **BLoC**: Ideal when events need transformation (debouncing, throttling, buffering) or complex event-driven streams.

### Dart 3 Sealed Class State Modeling:
```dart
@immutable
sealed class ProductState {
  const ProductState();
}

class ProductInitial extends ProductState {
  const ProductInitial();
}

class ProductLoading extends ProductState {
  const ProductLoading();
}

class ProductSuccess extends ProductState {
  const ProductSuccess(this.products);
  final List<ProductEntity> products;
}

class ProductFailure extends ProductState {
  const ProductFailure(this.errorMessage);
  final String errorMessage;
}
```

### UI Consumption with BlocBuilder & Selectors:
```dart
BlocBuilder<ProductBloc, ProductState>(
  buildWhen: (previous, current) => previous.runtimeType != current.runtimeType,
  builder: (context, state) {
    return switch (state) {
      ProductInitial() => const SizedBox.shrink(),
      ProductLoading() => const Center(child: CircularProgressIndicator()),
      ProductSuccess(:final products) => ProductListView(products: products),
      ProductFailure(:final errorMessage) => ErrorDisplay(message: errorMessage),
    };
  },
)
```

## 2. Riverpod 2.x Pattern

### Code Generation with `@riverpod`:
```dart
import 'package:riverpod_annotation/riverpod_annotation.dart';

part 'cart_notifier.g.dart';

@riverpod
class CartNotifier extends _$CartNotifier {
  @override
  AsyncValue<List<CartItem>> build() {
    return const AsyncData([]);
  }

  Future<void> addItem(Product product) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final updated = [...?state.value, CartItem(product: product, quantity: 1)];
      return updated;
    });
  }
}
```

### UI Consumption with ConsumerWidget:
```dart
class CartSummary extends ConsumerWidget {
  const CartSummary({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartState = ref.watch(cartNotifierProvider);

    return cartState.when(
      data: (items) => Text('Items: ${items.length}'),
      loading: () => const CircularProgressIndicator(),
      error: (err, stack) => Text('Error: $err'),
    );
  }
}
```

## 3. Anti-Patterns to Avoid

- **DO NOT** create boolean soup: `bool isLoading`, `bool isError`, `String? errorMessage`. Use sealed union types.
- **DO NOT** execute async side effects inside `build()`.
- **DO NOT** mutate collections in-place: `state.items.add(newItem)` (the framework will fail to detect change). Use `state = [...state, newItem]`.
