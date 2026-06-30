---
name: runTest login iteration limit
description: Why runTest always hits the 10-iteration cap in this app, and how to stay under it.
---

## Rule
Supabase email login consumes ~5 of the 10 allowed `runTest` iterations (navigate + fill email + fill password + click button + wait for redirect). With only 5 remaining for the actual test, any flow with >2 non-trivial steps will time out.

**Why:** `runTest`'s testing subagent has a hard 10-iteration ceiling. Each browser action (navigate, fill field, click, wait for URL change) counts as roughly one iteration. Login alone takes 4-5 back-and-forths.

**How to apply:**
- Keep post-login test plans to ≤3 explicitly numbered steps.
- Combine login into a single step description: "Go to /login, fill email X and password Y, click Sign In, wait for URL to become /."
- Do NOT run two auth-requiring tests in parallel — they each hit the limit independently.
- If the flow genuinely needs more than ~5 post-login steps, consider splitting into two separate `runTest` calls where the first call ends after login-state is established (but note that state does NOT persist between calls — each starts fresh).
- Alternatively, verify navigation logic through code review rather than e2e when the auth overhead is prohibitive.
