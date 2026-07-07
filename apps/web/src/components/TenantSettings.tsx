import { useCallback, useEffect, useState } from 'react';
import type {
  TeamMember,
  PendingInvite,
  ProjectDto,
  ProjectLabelDto,
  MembershipRole,
  AgentSummary,
  WebhookSubscriptionDto,
} from '@kbrelay/shared';
import { USER_PALETTE, MAX_PROJECT_LABELS_PER_TENANT } from '@kbrelay/shared';
import * as api from '../lib/api';
import { useDialog } from './Dialog';
import ProjectAccessEditor, { initials } from './ProjectAccessEditor';

type Tab = 'people' | 'webhooks' | 'labels';

/**
 * Tenant Settings — admin-only. Three tabs:
 *  - People: invite / remove / re-role human members + per-member project access.
 *  - Channel events: outbound webhook subscriptions (KBR-16) that push agent
 *    callbacks to a Claude Code channel / routine.
 *  - Project labels: tenant-wide board buckets (KBR-85).
 * Agent management moved to its own modal, open to every role (KBR-116) —
 * see AgentsModal. Reached from the account menu (hidden for non-admins).
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadTeam() {
    const t = await api.getTeam();
    setMembers(t.members);
    setInvites(t.invites);
  }
  // Agents are managed in their own modal (KBR-116); the list here only feeds
  // the Channel-events target picker, scoped to agents this admin can manage.
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
                                {m.name}
                                {m.isOwner && <span className="owner-badge" title="Workspace owner — can't be demoted or removed">Owner</span>}
                                {isMe && <span className="you-tag"> (you)</span>}
                              </div>
                              <div className="member-email">{m.email ?? '—'}</div>
                            </div>
                          </div>
                          <div className="member-actions">
                            <select
                              className="role-select"
                              value={m.role}
                              disabled={busy || m.isOwner}
                              title={m.isOwner ? "The workspace owner's role can't be changed" : undefined}
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
                            {!isMe && !m.isOwner && (
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
