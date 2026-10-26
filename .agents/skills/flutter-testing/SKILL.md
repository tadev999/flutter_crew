---
name: flutter-testing
description: Comprehensive testing guide for Flutter unit, widget, and integration tests using Mocktail and bloc_test.
---

# Flutter Testing Skill

This skill details how to write rock-solid tests across the Flutter test pyramid.

Follow AGENTS.md and `.agents/workflows/spec-driven-delivery.md` for delivery.
Default to implementation-first, immediately followed by executed tests. For a bug
regression use the RED-GREEN-REFACTOR exception: demonstrate failure before fixing.
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

// Contract
abstract interface class CartDataSource {
  Future<List<ItemModel>> fetchCart();
}

// Mock definition
class MockCartDataSource extends Mock implements CartDataSource {}

void main() {
  late MockCartDataSource mockDataSource;
  late CartRepositoryImpl repository;

  setUp(() {
    mockDataSource = MockCartDataSource();
    repository = CartRepositoryImpl(mockDataSource);
  });

  group('getCart', () {
    test('returns items when dataSource call succeeds', () async {
      // Arrange
      final tItems = [ItemModel(id: '1', name: 'Widget A')];
      when(() => mockDataSource.fetchCart()).thenAnswer((_) async => tItems);

      // Act
      final result = await repository.getCart();

      // Assert
      expect(result.isRight(), isTrue);
      expect(result.getOrElse(() => []), equals(tItems.map((e) => e.toDomain()).toList()));
      verify(() => mockDataSource.fetchCart()).called(1);
    });

    test('returns Failure when dataSource throws Exception', () async {
      // Arrange
      when(() => mockDataSource.fetchCart()).thenThrow(Exception('Network error'));

      // Act
      final result = await repository.getCart();

      // Assert
      expect(result.isLeft(), isTrue);
      verify(() => mockDataSource.fetchCart()).called(1);
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
    late MockGetCartUseCase mockGetCartUseCase;

    setUp(() {
      mockGetCartUseCase = MockGetCartUseCase();
    });

    blocTest<CartBloc, CartState>(
      'emits [CartLoading, CartLoaded] when LoadCart is added and succeeds',
      build: () {
        when(() => mockGetCartUseCase()).thenAnswer((_) async => const Right([testCartItem]));
        return CartBloc(mockGetCartUseCase);
      },
      act: (bloc) => bloc.add(const LoadCartEvent()),
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
