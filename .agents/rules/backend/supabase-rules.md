# Supabase PostgreSQL & RLS Rules Standards

## 1. Mandatory Row Level Security
- Every table created in the `public` schema must explicitly have RLS enabled:
  ```sql
  ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
  ```

## 2. Granular RLS Policies
- Always write specific policies for each operation (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) instead of a single catch-all policy:
  ```sql
  -- Read own rows
  CREATE POLICY "Users can read own rows"
  ON public.items FOR SELECT
  USING ((select auth.uid()) = user_id);

  -- Insert own rows
  CREATE POLICY "Users can insert own rows"
  ON public.items FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);
  ```

## 3. Performance Best Practices
- Always index the foreign key and user columns referenced in RLS policies:
  ```sql
  CREATE INDEX idx_items_user_id ON public.items(user_id);
  ```
- Use `(select auth.uid())` subquery instead of direct `auth.uid()` function call in policies to allow PostgreSQL to cache the evaluation across scanned rows.

## 4. Primary Keys & Timestamps
- Use UUID primary keys: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- Use UTC timestamps: `created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL`.
