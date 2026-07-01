// kbRelay API integration assertions. Runs against a live worker.
// Tokens supplied via env: TOK_CLAUDE, TOK_LEIF (tenant lala), TOK_ACME (tenant acme).
const BASE = process.env.BASE || 'http://localhost:8787';

let failures = 0;
function ok(cond, msg) {
  console.log(`${cond ? '  ✓' : '  ✗ FAIL:'} ${msg}`);
  if (!cond) failures++;
}

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

const CLAUDE = process.env.TOK_CLAUDE;
const LEIF = process.env.TOK_LEIF;
const ACME = process.env.TOK_ACME;

console.log('\n── Board CRUD + provenance (tenant lala) ──');

// Claude creates a project (now requires a code).
let r = await api('POST', '/api/v1/projects', CLAUDE, { name: 'Growth', code: 'grw', description: 'GTM work' });
ok(r.status === 201, `create project → 201 (got ${r.status})`);
const project = r.json?.project;
ok(project?.name === 'Growth', 'project name is Growth');
ok(project?.code === 'GRW', `project.code uppercased to GRW (got ${project?.code})`);
ok(project?.createdBy === 'u_claude', `project.createdBy = u_claude (got ${project?.createdBy})`);

// Project code is required + uniqueness enforced.
r = await api('POST', '/api/v1/projects', CLAUDE, { name: 'NoCode' });
ok(r.status === 400, `create project without code → 400 (got ${r.status})`);
r = await api('POST', '/api/v1/projects', CLAUDE, { name: 'Dup', code: 'GRW' });
ok(r.status === 409, `duplicate project code → 409 (got ${r.status})`);
ok(Array.isArray(r.json?.columns) && r.json.columns.length === 4, `seeded 4 default columns (got ${r.json?.columns?.length})`);
const cols = r.json.columns;
const todo = cols.find((c) => c.name === 'Todo');
const inProgress = cols.find((c) => c.name === 'In Progress');
ok(todo && inProgress, 'default columns include Todo + In Progress');
ok(cols[0].name === 'Todo' && cols[3].name === 'Done', 'columns are ordered Todo … Done');

// List projects.
r = await api('GET', '/api/v1/projects', CLAUDE);
ok(r.status === 200 && r.json.projects.some((p) => p.id === project.id), 'project appears in list');

// Claude creates a card (defaults to first column = Todo).
r = await api('POST', `/api/v1/projects/${project.id}/cards`, CLAUDE, {
  summary: 'Ship tracking spine',
  description: 'attribution + scoreboard',
  acceptanceCriteria: 'UTM captured; export works',
});
ok(r.status === 201, `create card → 201 (got ${r.status})`);
const card = r.json?.card;
ok(card?.columnId === todo.id, 'new card lands in the first column (Todo)');
ok(card?.summary === 'Ship tracking spine', 'card summary stored');
ok(card?.seq === 1 && card?.key === 'GRW-1', `first card key = GRW-1 (got ${card?.key}, seq ${card?.seq})`);
ok(card?.createdBy === 'u_claude' && card?.updatedBy === 'u_claude', 'card provenance: created_by/updated_by = claude');
ok(card?.acceptanceCriteria === 'UTM captured; export works', 'acceptance criteria stored');

// A second card gets the next key.
let r2 = await api('POST', `/api/v1/projects/${project.id}/cards`, CLAUDE, { summary: 'Second' });
ok(r2.json?.card?.key === 'GRW-2', `second card key = GRW-2 (got ${r2.json?.card?.key})`);
await api('DELETE', `/api/v1/cards/${r2.json.card.id}`, CLAUDE);

// Leif moves the card to In Progress and assigns it to himself.
r = await api('PATCH', `/api/v1/cards/${card.id}`, LEIF, {
  columnId: inProgress.id,
  position: 1500,
  assigneeUserId: 'u_leif',
});
ok(r.status === 200, `move card → 200 (got ${r.status})`);
ok(r.json?.card?.columnId === inProgress.id, 'card moved to In Progress');
ok(r.json?.card?.assigneeUserId === 'u_leif', 'card assigned to Leif');
ok(r.json?.card?.updatedBy === 'u_leif', 'provenance: updated_by now = leif (Leif moved it)');
ok(r.json?.card?.createdBy === 'u_claude', 'provenance: created_by still = claude');

// Filter cards by column.
r = await api('GET', `/api/v1/projects/${project.id}/cards?column=${inProgress.id}`, CLAUDE);
ok(r.status === 200 && r.json.cards.length === 1 && r.json.cards[0].id === card.id, 'filter cards by column works');

// Add a column, then reorder.
r = await api('POST', `/api/v1/projects/${project.id}/columns`, CLAUDE, { name: 'Blocked', color: '#dc2626' });
ok(r.status === 201 && r.json.column.name === 'Blocked', 'add custom column');
const blocked = r.json.column;
r = await api('PATCH', `/api/v1/columns/${blocked.id}`, CLAUDE, { position: 1500 });
ok(r.status === 200 && r.json.column.position === 1500, 'reorder column via position');

// Cannot delete a non-empty column.
r = await api('DELETE', `/api/v1/columns/${inProgress.id}`, CLAUDE);
ok(r.status === 409, `delete non-empty column → 409 (got ${r.status})`);

// Validation: empty summary rejected.
r = await api('POST', `/api/v1/projects/${project.id}/cards`, CLAUDE, { summary: '' });
ok(r.status === 400, `empty card summary → 400 (got ${r.status})`);

// Bad assignee rejected.
r = await api('POST', `/api/v1/projects/${project.id}/cards`, CLAUDE, { summary: 'x', assigneeUserId: 'u_nobody' });
ok(r.status === 400, `unknown assignee → 400 (got ${r.status})`);

console.log('\n── Cross-tenant isolation (acme must not see lala) ──');

// Acme lists projects — must NOT see lala's Growth project.
r = await api('GET', '/api/v1/projects', ACME);
ok(r.status === 200, 'acme can list its own (empty) projects');
ok(!r.json.projects.some((p) => p.id === project.id), 'acme does NOT see lala project in list');

// Acme tries to read lala's project directly — must 404.
r = await api('GET', `/api/v1/projects/${project.id}`, ACME);
ok(r.status === 404, `acme GET lala project → 404 (got ${r.status})`);

// Acme tries to read lala's card directly — must 404.
r = await api('GET', `/api/v1/cards/${card.id}`, ACME);
ok(r.status === 404, `acme GET lala card → 404 (got ${r.status})`);

// Acme tries to move lala's card — must 404 (not found in acme's scope).
r = await api('PATCH', `/api/v1/cards/${card.id}`, ACME, { summary: 'hijacked' });
ok(r.status === 404, `acme PATCH lala card → 404 (got ${r.status})`);

// Acme tries to delete lala's project — must 404.
r = await api('DELETE', `/api/v1/projects/${project.id}`, ACME);
ok(r.status === 404, `acme DELETE lala project → 404 (got ${r.status})`);

// Confirm lala's data survived the isolation probes.
r = await api('GET', `/api/v1/projects/${project.id}`, CLAUDE);
ok(r.status === 200, 'lala project intact after acme probes');

console.log('\n── Cleanup ──');
r = await api('DELETE', `/api/v1/cards/${card.id}`, LEIF);
ok(r.status === 200, 'delete card');
r = await api('DELETE', `/api/v1/projects/${project.id}`, CLAUDE);
ok(r.status === 200, 'delete project (cascade)');
r = await api('GET', `/api/v1/projects/${project.id}`, CLAUDE);
ok(r.status === 404, 'project gone after delete');

console.log(`\n${failures === 0 ? '✅ ALL PASSED' : `❌ ${failures} FAILURE(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);
