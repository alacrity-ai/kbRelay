import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  TeamMember,
  PendingInvite,
  ProjectDto,
  ProjectLabelDto,
  MembershipRole,
  AgentSummary,
  TokenSummary,
  WebhookSubscriptionDto,
} from '@kbrelay/shared';
import { USER_PALETTE, colorForUser, MAX_PROJECT_LABELS_PER_TENANT } from '@kbrelay/shared';
import * as api from '../lib/api';
import { useDialog } from './Dialog';
import { McpGuideButton } from './McpGuide';

type Tab = 'people' | 'agents' | 'webhooks' | 'labels';

/**
 * Tenant Settings — admin-only. Three tabs:
 *  - People: invite / remove / re-role human members + per-member project access.
 *  - Agents: create/manage agent users (kind='agent', owned by a human), their
 *    project access, and their API keys — the keys you hand to an agent runtime
 *    so its work is attributed to the agent, not to you.
 *  - Channel events: outbound webhook subscriptions (KBR-16) that push agent
 *    callbacks to a Claude Code channel / routine.
 * Reached from the account menu (hidden for non-admins).
 */
export default function TenantSettings({
  meId,
  projects,
  onClose,
  onChanged,
}: {
  meId: string;
  projects: ProjectDto[];
  onClose: () => void;
  /** Fired after project-label edits so the board can refresh embedded labels. */
  onChanged?: () => void;
}) {
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>('people');
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [agents, setAgents] = useState<AgentSummary[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MembershipRole>('member');
  const [newAgentName, setNewAgentName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadTeam() {
    const t = await api.getTeam();
    setMembers(t.members);
    setInvites(t.invites);
  }
  async function loadAgents() {
    const { agents: a } = await api.listAgents();
    setAgents(a);
  }

  async function loadAll() {
    try {
      await Promise.all([loadTeam(), loadAgents()]);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void loadAll();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, onClose]);

  async function guarded(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await loadAll();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const people = (members ?? []).filter((m) => m.kind === 'human');

  const invite = () => {
    const email = inviteEmail.trim();
    if (!email) return;
    void guarded(async () => {
      await api.inviteMember(email, inviteRole);
      setInviteEmail('');
    });
  };

  const changeRole = (m: TeamMember, role: MembershipRole) =>
    void guarded(() => api.setMemberRole(m.id, role));

  const remove = async (m: TeamMember) => {
    const yes = await dialog.confirm({
      title: `Remove ${m.name}?`,
      message: 'They lose access to this workspace and all its projects. Their past activity stays.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (yes) void guarded(() => api.removeMember(m.id));
  };

  const createAgent = () => {
    const name = newAgentName.trim();
    if (!name) return;
    void guarded(async () => {
      await api.createAgent(name);
      setNewAgentName('');
    });
  };

  return (
    <div className="dialog-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div className="dialog-card wide" role="dialog" aria-modal="true" aria-labelledby="ts-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: 'var(--accent)' }} />
          <h2 className="modal-title" id="ts-title">Team &amp; access</h2>
          <div className="modal-header-actions">
            <button className="icon-btn ghost" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="settings-tabs">
          <button className={`tab ${tab === 'people' ? 'active' : ''}`} onClick={() => { setTab('people'); setExpanded(null); }}>People</button>
          <button className={`tab ${tab === 'agents' ? 'active' : ''}`} onClick={() => { setTab('agents'); setExpanded(null); }}>Agents</button>
          <button className={`tab ${tab === 'webhooks' ? 'active' : ''}`} onClick={() => { setTab('webhooks'); setExpanded(null); }}>Channel events</button>
          <button className={`tab ${tab === 'labels' ? 'active' : ''}`} onClick={() => { setTab('labels'); setExpanded(null); }}>Project labels</button>
        </div>

        <div className="modal-body">
          {error && <div className="error-text">{error}</div>}

          {tab === 'people' && (
            <>
              <div className="field">
                <label>Invite a person</label>
                <div className="invite-row">
                  <input
                    type="email"
                    value={inviteEmail}
                    placeholder="name@email.com"
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') invite(); }}
                  />
                  <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as MembershipRole)}>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button className="primary" onClick={invite} disabled={!inviteEmail.trim() || busy}>Invite</button>
                </div>
              </div>

              {invites.length > 0 && (
                <div className="invite-list">
                  <span className="view-label">Pending invites</span>
                  {invites.map((iv) => (
                    <div className="key-row" key={iv.id}>
                      <div className="key-row-main">
                        <span className="key-label">{iv.email}</span>
                        <span className="key-meta">invited as {iv.role}</span>
                      </div>
                      <button className="ghost sm danger-text" onClick={() => void guarded(() => api.revokeInvite(iv.id))}>Revoke</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="member-list">
                <span className="view-label">Members</span>
                {members === null ? (
                  <div className="muted-note">Loading…</div>
                ) : (
                  people.map((m) => {
                    const isAdmin = m.role === 'admin';
                    const isMe = m.id === meId;
                    const open = expanded === m.id;
                    return (
                      <div className="member-card" key={m.id}>
                        <div className="member-row">
                          <div className="member-main">
                            <span className="avatar sm" aria-hidden>{initials(m.name)}</span>
                            <div className="member-ident">
                              <div className="member-name">
                                {m.name}{isMe && <span className="you-tag"> (you)</span>}
                              </div>
                              <div className="member-email">{m.email ?? '—'}</div>
                            </div>
                          </div>
                          <div className="member-actions">
                            <select
                              className="role-select"
                              value={m.role}
                              disabled={busy}
                              onChange={(e) => changeRole(m, e.target.value as MembershipRole)}
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                            {!isAdmin && (
                              <button className="ghost sm" onClick={() => setExpanded(open ? null : m.id)}>
                                {open ? 'Hide projects' : 'Projects'}
                              </button>
                            )}
                            {!isMe && (
                              <button className="ghost sm danger-text" onClick={() => void remove(m)}>Remove</button>
                            )}
                          </div>
                        </div>
                        {isAdmin ? (
                          open && <div className="member-projects muted-note">Admins can access all projects.</div>
                        ) : (
                          open && (
                            <ProjectAccessEditor
                              key={m.id}
                              initialIds={m.projectIds}
                              projects={projects}
                              busy={busy}
                              onSave={(ids) => guarded(() => api.setMemberProjects(m.id, ids))}
                            />
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {tab === 'agents' && (
            <>
              <p className="muted-note">
                Agent users act with their own API keys, so their work is attributed to <em>them</em>, not to you. <McpGuideButton />
                <br />
                Create one per agent (Claude, ChatGPT, …), grant it projects, and mint a key to hand to its runtime or the kbRelay MCP.
              </p>
              <div className="field">
                <label>New agent</label>
                <div className="invite-row">
                  <input
                    value={newAgentName}
                    placeholder="e.g. Claude"
                    maxLength={80}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') createAgent(); }}
                  />
                  <button className="primary" onClick={createAgent} disabled={!newAgentName.trim() || busy}>Create</button>
                </div>
              </div>

              <div className="member-list">
                <span className="view-label">Agents</span>
                {agents === null ? (
                  <div className="muted-note">Loading…</div>
                ) : agents.length === 0 ? (
                  <div className="muted-note">No agents yet.</div>
                ) : (
                  agents.map((a) => (
                    <AgentCard
                      key={a.id}
                      agent={a}
                      projects={projects}
                      busy={busy}
                      guarded={guarded}
                      dialog={dialog}
                    />
                  ))
                )}
              </div>
            </>
          )}

          {tab === 'webhooks' && <WebhooksPanel agents={agents} />}

          {tab === 'labels' && <ProjectLabelsPanel onChanged={() => onChanged?.()} />}
        </div>

        <div className="modal-footer">
          <div className="spacer" />
          <button className="primary" onClick={onClose} disabled={busy}>Done</button>
        </div>
      </div>
    </div>
  );
}

/**
 * Project-labels manager (KBR-85): tenant-wide buckets ("Side gigs", "Day Job")
 * a project can carry several of. Mirrors the per-project card-label manager,
 * but scoped to the whole tenant. Attach labels to a board in its settings.
 */
function ProjectLabelsPanel({ onChanged }: { onChanged: () => void }) {
  const dialog = useDialog();
  const [labels, setLabels] = useState<ProjectLabelDto[] | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(USER_PALETTE[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { labels: ls } = await api.listProjectLabels();
      setLabels(ls);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project labels');
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function guarded(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Label change failed');
    } finally {
      setBusy(false);
    }
  }

  const add = () => {
    const n = name.trim();
    if (!n) return;
    void guarded(async () => {
      await api.createProjectLabel({ name: n, color });
      setName('');
    });
  };

  const rename = async (l: ProjectLabelDto) => {
    const n = await dialog.prompt({ title: 'Rename project label', label: 'Label name', defaultValue: l.name, confirmLabel: 'Save' });
    if (n && n.trim() && n.trim() !== l.name) void guarded(() => api.patchProjectLabel(l.id, { name: n.trim() }));
  };

  const remove = async (l: ProjectLabelDto) => {
    const yes = await dialog.confirm({
      title: `Delete "${l.name}"?`,
      message: 'It is removed from every project that carries it. The projects themselves are unaffected.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (yes) void guarded(() => api.deleteProjectLabel(l.id));
  };

  return (
    <>
      {error && <div className="error-text">{error}</div>}
      <p className="muted-note">
        Tenant-wide buckets to organise boards — e.g. “Side gigs”, “Day Job”, “Home”. Up to {MAX_PROJECT_LABELS_PER_TENANT}.
        Attach them to a board in its <em>Project settings</em>, then filter the switcher and Browse list by label.
      </p>
      <div className="label-add-row">
        <input
          value={name}
          placeholder="e.g. Side gigs"
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
        />
        <input
          type="color"
          className="label-color-input"
          value={color}
          aria-label="New label color"
          onChange={(e) => setColor(e.target.value)}
        />
        <button className="primary" disabled={busy || !name.trim()} onClick={add}>Add</button>
      </div>
      {labels === null ? (
        <div className="muted-note">Loading…</div>
      ) : labels.length === 0 ? (
        <p className="muted-note">No project labels yet.</p>
      ) : (
        <div className="archive-list">
          {labels.map((l) => (
            <div className="archive-row" key={l.id}>
              <span className="label-chip" style={{ background: `${l.color}2b`, color: l.color, borderColor: `${l.color}66` }}>
                {l.name}
              </span>
              <div className="spacer" style={{ flex: 1 }} />
              <input
                type="color"
                className="label-color-input"
                value={l.color}
                aria-label={`Color for ${l.name}`}
                disabled={busy}
                onChange={(e) => void guarded(() => api.patchProjectLabel(l.id, { color: e.target.value }))}
              />
              <button className="ghost sm" disabled={busy} onClick={() => void rename(l)}>Rename</button>
              <button className="ghost sm danger-text" disabled={busy} onClick={() => void remove(l)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** One agent row: identity + owner, with Projects + Keys expanders and Remove. */
function AgentCard({
  agent,
  projects,
  busy,
  guarded,
  dialog,
}: {
  agent: AgentSummary;
  projects: ProjectDto[];
  busy: boolean;
  guarded: (fn: () => Promise<unknown>) => Promise<void>;
  dialog: ReturnType<typeof useDialog>;
}) {
  const [panel, setPanel] = useState<'projects' | 'keys' | 'color' | null>(null);
  const open = panel !== null;

  const toggle = (p: 'projects' | 'keys' | 'color') => setPanel((cur) => (cur === p ? null : p));

  // Effective color mirrors the board: explicit, else the deterministic fallback.
  const agentColor = agent.color ?? colorForUser(agent.id);

  const rename = async () => {
    const name = await dialog.prompt({
      title: 'Rename agent', label: 'Agent name', defaultValue: agent.name, confirmLabel: 'Save',
    });
    if (name && name.trim() && name.trim() !== agent.name) {
      void guarded(() => api.patchAgent(agent.id, { name: name.trim() }));
    }
  };

  const remove = async () => {
    const yes = await dialog.confirm({
      title: `Remove ${agent.name}?`,
      message: 'Its API keys are revoked and it loses all access. Cards it created keep its name.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (yes) void guarded(() => api.removeAgent(agent.id));
  };

  return (
    <div className="member-card">
      <div className="member-row">
        <div className="member-main">
          <span className="avatar sm" style={{ background: agentColor }} aria-hidden>{initials(agent.name)}</span>
          <div className="member-ident">
            <div className="member-name">
              {agent.name}
              {agent.handle && <span className="handle-tag">@{agent.handle}</span>}
              <span className="kind-badge agent">agent</span>
            </div>
            <div className="member-email">
              {agent.ownerName ? `owned by ${agent.ownerName}` : 'unowned'} · {agent.tokenCount} key{agent.tokenCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        <div className="member-actions">
          {/* Workspace role (KBR-113) — same control as People, same endpoint;
              the server's last-admin 409 surfaces via the tab's error strip. */}
          <select
            className="role-select"
            value={agent.role}
            disabled={busy}
            onChange={(e) => void guarded(() => api.setMemberRole(agent.id, e.target.value as MembershipRole))}
            aria-label={`Workspace role for ${agent.name}`}
            data-testid={`agent-role-${agent.id}`}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button className={`ghost sm ${open && panel === 'projects' ? 'active' : ''}`} onClick={() => toggle('projects')}>Projects</button>
          <button className={`ghost sm ${open && panel === 'keys' ? 'active' : ''}`} onClick={() => toggle('keys')}>Keys</button>
          <button className={`ghost sm ${open && panel === 'color' ? 'active' : ''}`} onClick={() => toggle('color')}>Color</button>
          <button className="ghost sm" onClick={rename} disabled={busy}>Rename</button>
          <button className="ghost sm danger-text" onClick={() => void remove()} disabled={busy}>Remove</button>
        </div>
      </div>

      {open && panel === 'projects' && (
        <ProjectAccessEditor
          initialIds={agent.projectIds}
          projects={projects}
          busy={busy}
          onSave={(ids) => guarded(() => api.setMemberProjects(agent.id, ids))}
        />
      )}
      {open && panel === 'keys' && <AgentKeys agentId={agent.id} />}
      {/* Recolor (KBR-74): same palette as your own profile; a click saves. The
          agent's cards + avatar pick it up everywhere its color is shown. */}
      {open && panel === 'color' && (
        <div className="field agent-color-panel">
          <div className="color-swatches">
            {USER_PALETTE.map((c) => (
              <button
                type="button"
                key={c}
                className={`color-swatch ${agentColor.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                style={{ background: c }}
                aria-label={`set ${agent.name}'s color to ${c}`}
                disabled={busy}
                onClick={() => void guarded(() => api.patchAgent(agent.id, { color: c }))}
              />
            ))}
          </div>
          <p className="muted-note">Cards assigned to {agent.name} show in this color.</p>
        </div>
      )}
    </div>
  );
}

/** API-key management for a single agent (list / create / revoke, one-time reveal). */
function AgentKeys({ agentId }: { agentId: string }) {
  const dialog = useDialog();
  const [tokens, setTokens] = useState<TokenSummary[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try {
      const { tokens: t } = await api.listAgentTokens(agentId);
      setTokens(t);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  async function create() {
    const name = label.trim();
    if (!name || busy) return;
    setBusy(true); setError(null);
    try {
      const created = await api.createAgentToken(agentId, name);
      setFreshSecret(created.secret);
      setCopied(false);
      setLabel('');
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(t: TokenSummary) {
    const yes = await dialog.confirm({
      title: 'Revoke this key?',
      message: `"${t.label}" stops working immediately. The agent using it loses access.`,
      confirmLabel: 'Revoke', danger: true,
    });
    if (!yes) return;
    try { await api.revokeAgentToken(agentId, t.id); await load(); }
    catch (err) { setError((err as Error).message); }
  }

  async function copySecret() {
    if (!freshSecret) return;
    try { await navigator.clipboard.writeText(freshSecret); setCopied(true); } catch { /* manual copy */ }
  }

  const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString() : '—');

  return (
    <div className="member-projects agent-keys">
      {freshSecret && (
        <div className="secret-reveal">
          <div className="secret-reveal-head">New key — copy it now, it won't be shown again</div>
          <div className="secret-reveal-row">
            <code className="secret-value">{freshSecret}</code>
            <button className="ghost sm" onClick={copySecret}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      )}
      <div className="key-create-row">
        <input
          value={label}
          placeholder="key label, e.g. claude-mcp"
          maxLength={80}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void create(); }}
        />
        <button className="primary" onClick={create} disabled={!label.trim() || busy}>
          {busy ? 'Creating…' : 'Create key'}
        </button>
      </div>
      {error && <div className="error-text">{error}</div>}
      <div className="key-list">
        {tokens === null ? (
          <div className="muted-note">Loading…</div>
        ) : tokens.length === 0 ? (
          <div className="muted-note">No keys yet.</div>
        ) : (
          tokens.map((t) => (
            <div className="key-row" key={t.id}>
              <div className="key-row-main">
                <span className="key-label">{t.label}</span>
                <span className="key-meta">created {fmt(t.createdAt)} · last used {fmt(t.lastUsedAt)}</span>
              </div>
              <button className="ghost sm danger-text" onClick={() => void revoke(t)}>Revoke</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** The per-member/agent project checklist. Local edit state; "Save" replaces the set. */
function ProjectAccessEditor({
  initialIds,
  projects,
  busy,
  onSave,
}: {
  initialIds: string[];
  projects: ProjectDto[];
  busy: boolean;
  onSave: (ids: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialIds));
  const [q, setQ] = useState('');
  const dirty =
    selected.size !== initialIds.length || initialIds.some((id) => !selected.has(id));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  // Filtering is display-only: `selected` holds the full set independent of what's
  // shown, and Save sends [...selected], so hidden-but-checked projects are kept.
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n
      ? projects.filter((p) => p.name.toLowerCase().includes(n) || (p.code ?? '').toLowerCase().includes(n))
      : projects;
  }, [projects, q]);

  return (
    <div className="member-projects">
      {projects.length === 0 ? (
        <span className="muted-note">No projects yet.</span>
      ) : (
        <>
          {projects.length > 8 && (
            <input
              className="project-checks-filter"
              value={q}
              placeholder="Filter by name or code…"
              onChange={(e) => setQ(e.target.value)}
              disabled={busy}
            />
          )}
          <div className="project-checks">
            {filtered.length === 0 ? (
              <span className="muted-note">No matches.</span>
            ) : (
              filtered.map((p) => (
                <label key={p.id} className="project-check">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} disabled={busy} />
                  <span className="project-dot" style={{ background: p.color ?? 'var(--accent)' }} />
                  {p.code && <span className="project-code">{p.code}</span>}
                  {p.name}
                </label>
              ))
            )}
          </div>
        </>
      )}
      <div className="member-projects-actions">
        <button className="primary sm" disabled={!dirty || busy} onClick={() => void onSave([...selected])}>
          Save access
        </button>
      </div>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : name.slice(0, 2);
  return chars.toUpperCase();
}

/**
 * Channel-events (webhooks) admin panel (KBR-16). Register a delivery target —
 * URL + optional target agent — and get a signing secret ONCE on create. kbRelay
 * POSTs a signed event when a card becomes actionable or an agent is @-mentioned.
 */
function WebhooksPanel({ agents }: { agents: AgentSummary[] | null }) {
  const dialog = useDialog();
  const [hooks, setHooks] = useState<WebhookSubscriptionDto[] | null>(null);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [freshSecret, setFreshSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    try { setHooks((await api.listWebhooks()).webhooks); }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
  }
  useEffect(() => { void load(); }, []);

  async function create() {
    const l = label.trim(); const u = url.trim();
    if (!l || !u || busy) return;
    setBusy(true); setError(null);
    try {
      const created = await api.createWebhook({ label: l, url: u, targetAgentUserId: target || null });
      setFreshSecret(created.secret);
      setLabel(''); setUrl(''); setTarget('');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Create failed'); }
    finally { setBusy(false); }
  }

  async function toggle(h: WebhookSubscriptionDto) {
    setBusy(true); setError(null);
    try { await api.patchWebhook(h.id, { enabled: !h.enabled }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusy(false); }
  }

  async function remove(h: WebhookSubscriptionDto) {
    const yes = await dialog.confirm({ title: 'Delete channel event?', message: `Remove "${h.label}"? Deliveries to it stop immediately.`, confirmLabel: 'Delete', danger: true });
    if (!yes) return;
    setBusy(true); setError(null);
    try { await api.deleteWebhook(h.id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setBusy(false); }
  }

  async function copySecret() {
    if (!freshSecret) return;
    try { await navigator.clipboard.writeText(freshSecret); setCopied(true); } catch { /* manual */ }
  }

  const agentName = (id: string | null) => id ? (agents?.find((a) => a.id === id)?.name ?? id) : 'Any agent';

  return (
    <>
      <p className="muted-note">
        Push kbRelay events to a Claude Code channel (or routine) so an agent reacts the instant a card
        becomes actionable — instead of waiting for its <code>/loop</code> poll. Fires on <strong>assign-into-Ready</strong>
        and <strong>@-mentions</strong> of an agent; muted per board in Project settings.
      </p>
      {error && <div className="error-text">{error}</div>}

      {freshSecret && (
        <div className="field">
          <label>Signing secret — copy it now, it won’t be shown again</label>
          <div className="code-block">
            <pre><code>{freshSecret}</code></pre>
            <button className="ghost sm copy-btn" onClick={copySecret}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <button className="ghost sm" onClick={() => { setFreshSecret(null); setCopied(false); }}>Dismiss</button>
        </div>
      )}

      <div className="field">
        <label>New channel event</label>
        <input value={label} placeholder="Label (e.g. My laptop)" maxLength={120} onChange={(e) => setLabel(e.target.value)} />
        <input value={url} placeholder="Delivery URL (https://…)" onChange={(e) => setUrl(e.target.value)} />
        <select value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target agent">
          <option value="">Any agent</option>
          {(agents ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div className="member-projects-actions">
          <button className="primary" onClick={create} disabled={!label.trim() || !url.trim() || busy}>Add</button>
        </div>
      </div>

      <div className="member-list">
        <span className="view-label">Channel events</span>
        {hooks === null ? (
          <div className="muted-note">Loading…</div>
        ) : hooks.length === 0 ? (
          <div className="muted-note">None yet.</div>
        ) : (
          hooks.map((h) => (
            <div className="col-row" key={h.id}>
              <span className="col-row-name">{h.label}</span>
              <span className="muted-note" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.url} · {agentName(h.targetAgentUserId)}</span>
              <label className="toggle-row">
                <input type="checkbox" checked={h.enabled} disabled={busy} onChange={() => toggle(h)} />
                <span>{h.enabled ? 'On' : 'Off'}</span>
              </label>
              <button className="ghost sm danger-text" disabled={busy} onClick={() => remove(h)}>Delete</button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
