---
name: flutter-testing
description: Comprehensive testing guide for Flutter unit, widget, and integration tests using Mocktail and bloc_test.
---

# Flutter Testing Skill

This skill details how to write rock-solid tests across the Flutter test pyramid.

Follow AGENTS.md and `.agents/workflows/spec-driven-delivery.md` for delivery.
Use implementation-first for features and bug fixes: edit production code before
writing or updating tests, then immediately execute them. Add regression coverage
after the production fix; no test-first exception.
Existing tests may be run unchanged during diagnosis.
Automate business/state/security behavior and relevant failures.

Use existing `flutter_test`/`test`; `bloc_test` only for BLoC/Cubit and `mocktail`
only when mocks help. Neither is mandatory for non-bloc or trivial tests.
Riverpod tests can use a disposed ProviderContainer; simple pure functions need
only assertions. Do not add mocking/state packages solely to satisfy a template.
Await async work; use bounded `pump()` for ongoing animations and
`pumpAndSettle()` only for trees that can settle.

## 1. Unit Testing & Mocking with Mocktail

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

// Service contract
abstract interface class CartService {
  Future<List<ItemModel>> fetchCart();
}

class MockCartService extends Mock implements CartService {}

void main() {
  late MockCartService mockService;
  late CartCubit cubit;

  setUp(() {
    mockService = MockCartService();
    cubit = CartCubit(mockService);
  });

  group('loadCart', () {
    test('exposes items when the service call succeeds', () async {
      // Arrange
      final tItems = [ItemModel(id: '1', name: 'Widget A')];
      when(() => mockService.fetchCart()).thenAnswer((_) async => tItems);

      // Act
      await cubit.loadCart();

      // Assert
      expect(cubit.state, CartLoaded(tItems));
      verify(() => mockService.fetchCart()).called(1);
    });

    test('exposes a failure state when the service throws', () async {
      // Arrange
      when(() => mockService.fetchCart()).thenThrow(Exception('Network error'));

      // Act
      await cubit.loadCart();

      // Assert
      expect(cubit.state, isA<CartFailure>());
      verify(() => mockService.fetchCart()).called(1);
    });
  });
}
```

## 2. BLoC Testing with `bloc_test`

```dart
import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

void main() {
  group('CartBloc', () {
    late MockCartService mockService;

    setUp(() {
      mockService = MockCartService();
    });

    blocTest<CartBloc, CartState>(
      'emits [CartLoading, CartLoaded] when CartRequested is added',
      build: () {
        when(() => mockService.fetchCart()).thenAnswer((_) async => [testCartItem]);
        return CartBloc(mockService);
      },
      act: (bloc) => bloc.add(const CartRequested()),
      expect: () => [
        const CartLoading(),
        const CartLoaded([testCartItem]),
      ],
    );
  });
}
```

## 3. Widget Testing

```dart
testWidgets('Counter increments when button tapped', (WidgetTester tester) async {
  // Build widget tree
  await tester.pumpWidget(const MyApp());

  // Verify counter starts at 0
  expect(find.text('0'), findsOneWidget);
  expect(find.text('1'), findsNothing);

  // Tap '+' icon
  await tester.tap(find.byIcon(Icons.add));
  await tester.pump();

  // Verify counter is now 1
  expect(find.text('0'), findsNothing);
  expect(find.text('1'), findsOneWidget);
});
```
