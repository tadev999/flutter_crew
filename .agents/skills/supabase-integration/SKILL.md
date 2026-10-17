---
name: supabase-integration
description: Comprehensive Supabase integration skill for Flutter including PostgreSQL schema design, Row Level Security (RLS), Supabase Auth, Storage, and Realtime streams.
---

# Supabase Backend Integration Skill for Flutter

This skill covers the end-to-end integration of Supabase into Flutter apps.

## 1. Setup & Configuration

Add packages:
```yaml
dependencies:
  supabase_flutter: ^2.5.0
```

Initialize in `lib/main.dart`:
```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: const String.fromEnvironment('SUPABASE_URL'),
    anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY'),
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );
  runApp(const MyApp());
}

final supabase = Supabase.instance.client;
```

## 2. PostgreSQL Schema & Migrations (`supabase/migrations/`)

```sql
-- Create custom types
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'cancelled');

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total NUMERIC(10, 2) NOT NULL CHECK (total >= 0),
  status order_status DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ALWAYS Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Index foreign keys
CREATE INDEX idx_orders_user_id ON public.orders(user_id);

-- RLS Policies
CREATE POLICY "Users can view their own orders"
ON public.orders FOR SELECT
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create their own orders"
ON public.orders FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);
```

## 3. Remote DataSource Implementation in Flutter

```dart
class SupabaseOrderRemoteDataSource {
  const SupabaseOrderRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<List<OrderDto>> fetchUserOrders() async {
    try {
      final response = await _client
          .from('orders')
          .select()
          .order('created_at', ascending: false);

      return (response as List<dynamic>)
          .map((json) => OrderDto.fromJson(json as Map<String, dynamic>))
          .toList();
    } on PostgrestException catch (e) {
      throw ServerException(e.message);
    }
  }

  Stream<List<OrderDto>> streamOrders() {
    return _client
        .from('orders')
        .stream(primaryKey: ['id'])
        .order('created_at')
        .map((data) => data.map((json) => OrderDto.fromJson(json)).toList());
  }

  Future<OrderDto> createOrder(Map<String, dynamic> payload) async {
    final response = await _client
        .from('orders')
        .insert(payload)
        .select()
        .single();
    return OrderDto.fromJson(response);
  }
}
```
