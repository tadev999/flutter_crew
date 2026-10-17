---
description: Perform a mobile security audit covering client storage, network configurations, and backend rules.
---

# /security-scan Command

Invokes the **security-reviewer** agent to detect security vulnerabilities.

## Actions Executed

1. Scans codebase for hardcoded tokens, API keys, or service credentials.
2. Checks for unencrypted token storage in `SharedPreferences`.
3. Verifies cleartext HTTP is disabled.
4. Audits `firestore.rules` or Supabase RLS policies for permissive holes.

## Usage

```text
User: /security-scan
```
