-- 0002_seed_lala.sql — the launch tenant and its actors.
--
-- No tokens here: token plaintext must never live in git. Mint tokens
-- out-of-band with `make mint-token` (tools/mint-token.mjs), which stores
-- only the sha256 hash. IDs are fixed + readable so the mint tool can
-- resolve a user by (tenant slug, user name).
--
-- Timestamp is a fixed constant (2025-07-01Z); seed rows don't need a
-- real creation time.

INSERT INTO tenants (id, name, slug, created_at) VALUES
  ('t_lala', 'LaLa Solutions', 'lala', 1751328000000);

INSERT INTO users (id, tenant_id, name, kind, role, created_at) VALUES
  ('u_leif',   't_lala', 'Leif',   'human', 'owner', 1751328000000),
  ('u_joe',    't_lala', 'Joe',    'human', 'owner', 1751328000000),
  ('u_claude', 't_lala', 'Claude', 'agent', 'owner', 1751328000000);
