---
name: Supabase project config
description: Correct Supabase project reference and URL for Ledge
---

The correct Supabase project reference is `sdnarwantjvwqzkaxwhc`.
- URL: `https://sdnarwantjvwqzkaxwhc.supabase.co`
- The ANON_KEY JWT payload contains `"ref":"sdnarwantjvwqzkaxwhc"` confirming this.

`bouifxfcqeovodyywuqa` is a wrong URL that was at some point written into `src/services/supabase.js`, causing "invalid API key" errors since the key belongs to the `sdnarwantjvwqzkaxwhc` project.

**Why:** The ANON_KEY is a JWT signed per-project. Its `ref` claim must match the project URL or Supabase rejects it as "invalid API key".

**How to apply:** If the URL ever looks wrong again, decode the ANON_KEY JWT (base64 the middle segment) and check its `ref` field — that is the canonical project reference.
