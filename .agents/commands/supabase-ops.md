---
description: Manage Supabase operations, generate PostgreSQL migrations, optimize indexes, and configure Row Level Security (RLS).
---

# /supabase-ops Command

Invokes the **supabase-specialist** and **database-reviewer** agents.

## Actions Executed

1. Generates clean PostgreSQL migration scripts with UUID keys and timestamps.
2. Configures and verifies Row Level Security (RLS) policies.
3. Adds necessary B-tree or GIN indexes for query performance.
4. Generates Flutter Supabase service code and realtime stream handlers.

## Usage

```text
User: /supabase-ops Create table posts with RLS policies and Flutter stream
```
