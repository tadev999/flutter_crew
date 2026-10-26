---
name: flutter-performance
description: Flutter rendering and memory optimization techniques to maintain smooth 60/120 FPS and avoid memory leaks.
---

# Flutter Performance Optimization Skill

This skill outlines actionable techniques to eliminate frame drops (jank), optimize RAM usage, and streamline network requests.

## 1. Widget Rebuild Optimization

1. **Leverage `const` everywhere possible**:
   - Reusing the same const widget instance lets Flutter skip an unchanged parent
     update. It does not prevent rebuilds caused by the widget's own state or
     inherited dependency changes; const is not rebuild immunity.
2. **Narrow the Scope of Rebuilders**:
   - Instead of wrapping the entire screen with a `BlocBuilder` or `Consumer`, wrap only the exact `Text` or `Icon` widget that actually depends on the state.
3. **Use Filtering Hooks**:
   ```dart
   // BLoC:
   BlocBuilder<UserBloc, UserState>(
     buildWhen: (prev, curr) => prev.avatarUrl != curr.avatarUrl,
     builder: (context, state) => CircleAvatar(backgroundImage: NetworkImage(state.avatarUrl)),
   )
   ```

   Provider (package:provider):
   ```dart
   final avatarUrl = context.select<UserNotifier, String>((n) => n.avatarUrl);
   ```

   Riverpod (inside ConsumerWidget/Consumer with WidgetRef ref):
   ```dart
   final avatarUrl = ref.watch(userProvider.select((user) => user.avatarUrl));
   ```

## 2. Scrollable List Optimization

- **Always use `ListView.builder` or `CustomScrollView` + `SliverList.builder`** for lists of unknown or large length.
- Keep default automatic keepalives unless profiling and state requirements justify
  changing them. Set `addAutomaticKeepAlives: false` only when offscreen item state
  need not be retained or keepalives are managed explicitly; disabling them can
  discard input/focus state. Do not apply this unconditionally to complex items.
- Default repaint boundaries often suffice; profile layer/memory cost before adding more.
- Provide `itemExtent` when items have a fixed height:
  ```dart
  ListView.builder(
    itemCount: items.length,
    itemExtent: 72.0, // Skips expensive size calculation pass
    itemBuilder: (context, index) => ItemTile(item: items[index]),
  )
  ```

## 3. RepaintBoundary

When profiling shows an animation repaints expensive unrelated content, consider
isolating its paint with `RepaintBoundary`. It does not prevent widget rebuilds,
and extra layers have memory/compositing costs:
```dart
RepaintBoundary(
  child: CircularProgressIndicator(),
)
```

## 4. Heavy Operations on Background Isolates

Never perform heavy JSON parsing, AES encryption, or image transformations on the main UI thread. Use `compute()` or `Isolate.run()`:
```dart
Future<List<Item>> parseItemsInIsolate(String rawJson) {
  return Isolate.run(() {
    final list = jsonDecode(rawJson) as List<dynamic>;
    return list.map((e) => Item.fromJson(e as Map<String, dynamic>)).toList();
  });
}
```
