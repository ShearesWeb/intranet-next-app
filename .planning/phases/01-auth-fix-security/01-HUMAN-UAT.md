---
status: partial
phase: 01-auth-fix-security
source: [01-VERIFICATION.md]
started: 2026-04-11T02:02:59Z
updated: 2026-04-11T02:02:59Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Inspect SSR document response after token refresh
expected: Response includes sb-* Set-Cookie headers and Cache-Control: private, no-cache, no-store, must-revalidate, max-age=0
result: [pending]

### 2. Switch accounts through the real Google OAuth flow and revisit dashboard pages
expected: Only the current account's data appears; no stale data from the previous account is shown during SSR navigation
result: [pending]

### 3. Open /dashboard while logged out or after expiry and observe the login UX
expected: Redirect lands on /auth/login?reason=session_expired&next=... and the login page shows the expired-session toast/message
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
