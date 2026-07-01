-- 0006_backfill_ticket_keys.sql — one-time backfill for existing data (v0.7.0).
--
-- Assigns codes to the three live `lala` projects and numbers their existing
-- cards by creation order. Safe on every environment: the code UPDATEs match by
-- explicit project id (no-ops where those ids don't exist, e.g. dev/local), and
-- the seq/counter backfills are generic. Existing `summary` text is untouched —
-- the new kbRelay key is independent of any prefixes embedded in the summary
-- (RDRBS-/AG-/HU-).

-- Codes for the known projects (see docs/v0.7.0/0-TICKET_ID_DESIGN.md §6).
UPDATE projects SET code = 'OBL' WHERE id = 'prj_2f713d4c864745fbb9cae134052dfd8c'; -- Orderbase - Launch
UPDATE projects SET code = 'BML' WHERE id = 'prj_0e619e7c54664ff696e16bfee79583a7'; -- buildmylease.com
UPDATE projects SET code = 'BMS' WHERE id = 'prj_c6a2f28633a4485c9588bc8081718cd5'; -- buildmylease.com Support

-- Number each project's existing cards 1..N by creation order (id as tiebreak).
UPDATE cards SET seq = (
  SELECT COUNT(*) FROM cards c2
  WHERE c2.project_id = cards.project_id
    AND (c2.created_at < cards.created_at
         OR (c2.created_at = cards.created_at AND c2.id <= cards.id))
) WHERE seq IS NULL;

-- Each project's counter starts at its current card count, so new cards continue
-- the sequence (OBL-21, BML-12, …).
UPDATE projects SET card_seq = (SELECT COUNT(*) FROM cards WHERE cards.project_id = projects.id);
