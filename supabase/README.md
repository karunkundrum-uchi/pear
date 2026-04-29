# Supabase

The live Supabase project was initialized through the Supabase MCP.

Applied migrations:

- `initial_core_schema`
- `harden_core_functions`
- `optimize_rls_auth_uid_policies`

The schema contains the v1 solo-user tables:

- `profiles`
- `block_windows`
- `blocked_sites`
- `override_events`

All public tables have RLS enabled. Supabase security advisor reported no warnings after the hardening migration.
