-- 0025: tenant owner (KBR-114).
-- The workspace gets a first-class owner: an admin who additionally sits above
-- the other admins (agent-management scope, un-demotable). Owner is a POINTER
-- on the tenant, not a third membership role — memberships.role stays
-- 'admin' | 'member' so every existing gate keeps working. Nullable, no FK
-- (matches users.owner_user_id from 0012). users.role='owner' is legacy and
-- unenforced (the seed set it on three users), so it is NOT the source here.
ALTER TABLE tenants ADD COLUMN owner_user_id TEXT;

-- Backfill: the earliest human admin membership per tenant — the person who
-- registered the workspace under every seeding path to date.
UPDATE tenants SET owner_user_id = (
  SELECT m.user_id
    FROM memberships m
    JOIN users u ON u.id = m.user_id
   WHERE m.tenant_id = tenants.id AND m.role = 'admin' AND u.kind = 'human'
   ORDER BY m.created_at ASC, m.id ASC
   LIMIT 1
);

-- The 0002/0010 seed gave leif and joe identical membership timestamps, so the
-- generic tiebreak (m.id ASC) would land on joe. Leif founded the workspace —
-- pin it explicitly, same as the seed migrations pin lala rows.
UPDATE tenants SET owner_user_id = 'u_leif' WHERE id = 't_lala';
