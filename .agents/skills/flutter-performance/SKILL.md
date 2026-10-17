---
name: flutter-performance
description: Flutter rendering and memory optimization techniques to maintain smooth 60/120 FPS and avoid memory leaks.
---

# Flutter Performance Optimization Skill

This skill outlines actionable techniques to eliminate frame drops (jank), optimize RAM usage, and streamline network requests.

## 1. Widget Rebuild Optimization

1. **Leverage `const` everywhere possible**:
   - `const` widgets are evaluated at compile time and never rebuilt during frame updates.
2. **Narrow the Scope of Rebuilders**:
   - Instead of wrapping the entire screen with a `BlocBuilder` or `Consumer`, wrap only the exact `Text` or `Icon` widget that actually depends on the state.
3. **Use Filtering Hooks**:
   ```dart
   // BLoC:
   BlocBuilder<UserBloc, UserState>(
     buildWhen: (prev, curr) => prev.avatarUrl != curr.avatarUrl,
     builder: (context, state) => CircleAvatar(backgroundImage: NetworkImage(state.avatarUrl)),
   )
   
   // Provider / Riverpod:
   final avatarUrl = context.select<UserNotifier, String>((n) => n.avatarUrl);
   ```

## 2. Scrollable List Optimization

- **Always use `ListView.builder` or `CustomScrollView` + `SliverList.builder`** for lists of unknown or large length.
- Set `addAutomaticKeepAlives: false` and `addRepaintBoundaries: true` on complex list items.
- Provide `itemExtent` when items have a fixed height:
  ```dart
  ListView.builder(
    itemCount: items.length,
    itemExtent: 72.0, // Skips expensive size calculation pass
    itemBuilder: (context, index) => ItemTile(item: items[index]),
  )
  ```

## 3. RepaintBoundary

When a widget animates constantly (e.g. spinner, pulsating button, custom painter), it can force its entire parent layer to repaint.
Wrap the animating widget in a `RepaintBoundary`:
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
