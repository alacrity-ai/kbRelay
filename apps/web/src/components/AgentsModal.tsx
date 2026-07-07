import { useEffect, useState } from 'react';
import type { AgentSummary, MeResponse, MembershipRole, ProjectDto, TokenSummary } from '@kbrelay/shared';
import { USER_PALETTE, colorForUser } from '@kbrelay/shared';
import * as api from '../lib/api';
import { useDialog } from './Dialog';
import { McpGuideButton } from './McpGuide';
import ProjectAccessEditor, { initials } from './ProjectAccessEditor';

/**
 * Agents — every user's window into their agent workforce (KBR-116). Unlike
 * Team & access (admin-only workspace administration), this modal is open to
 * every role: the server scopes GET /agents to what the caller may manage
 * (KBR-115), so a member sees exactly their own agents, an admin additionally
 * sees member-owned ones, and the workspace owner sees all. Layout: "Your
 * agents" (with the create flow) first, then one group per other owner.
 */
export default function AgentsModal({
  me,
  projects,
  onClose,
}: {
  me: MeResponse;
  projects: ProjectDto[];
  onClose: () => void;
}) {
  const dialog = useDialog();
  const [agents, setAgents] = useState<AgentSummary[] | null>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const { agents: a } = await api.listAgents();
      setAgents(a);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    void load();
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
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const createAgent = () => {
    const name = newAgentName.trim();
    if (!name) return;
    void guarded(async () => {
      await api.createAgent(name);
      setNewAgentName('');
    });
  };

  const mine = (agents ?? []).filter((a) => a.ownerUserId === me.user.id);
  // Admin/owner viewers also get agents they manage on others' behalf, grouped
  // by owning human so each group reads as that person's workforce.
  const others = (agents ?? []).filter((a) => a.ownerUserId !== me.user.id);
  const groups = new Map<string, { label: string; agents: AgentSummary[] }>();
  for (const a of others) {
    const key = a.ownerUserId ?? '—';
    const g = groups.get(key) ?? { label: a.ownerName ? `${a.ownerName}'s agents` : 'Unowned agents', agents: [] };
    g.agents.push(a);
    groups.set(key, g);
  }

  return (
    <div className="dialog-backdrop" onClick={() => { if (!busy) onClose(); }}>
      <div className="dialog-card wide" role="dialog" aria-modal="true" aria-labelledby="agents-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: 'var(--accent)' }} />
          <h2 className="modal-title" id="agents-title">Agents</h2>
          <div className="modal-header-actions">
            <button className="icon-btn ghost" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="modal-body">
          {error && <div className="error-text">{error}</div>}

          <p className="muted-note">
            Agent users act with their own API keys, so their work is attributed to <em>them</em>, not to you. <McpGuideButton />
            <br />
            Create one per agent (Claude, ChatGPT, …), grant it projects you can see, and mint a key to hand to its runtime or the kbRelay MCP.
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
                data-testid="new-agent-name"
              />
              <button className="primary" onClick={createAgent} disabled={!newAgentName.trim() || busy} data-testid="new-agent-create">Create</button>
            </div>
          </div>

          <div className="member-list">
            <span className="view-label">Your agents</span>
            {agents === null ? (
              <div className="muted-note">Loading…</div>
            ) : mine.length === 0 ? (
              <div className="muted-note">No agents yet — create one above.</div>
            ) : (
              mine.map((a) => (
                <AgentCard key={a.id} agent={a} projects={projects} busy={busy} guarded={guarded} dialog={dialog} />
              ))
            )}
          </div>

          {[...groups.entries()].map(([ownerId, g]) => (
            <div className="member-list" key={ownerId}>
              <span className="view-label">{g.label}</span>
              {g.agents.map((a) => (
                <AgentCard key={a.id} agent={a} projects={projects} busy={busy} guarded={guarded} dialog={dialog} />
              ))}
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <div className="spacer" />
          <button className="primary" onClick={onClose} disabled={busy}>Done</button>
        </div>
      </div>
    </div>
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
          {/* Workspace role (KBR-113/115): the server computes roleCap — an
              agent never outranks its owner — so a capped agent shows a pinned
              chip instead of a select. */}
          {agent.roleCap === 'member' ? (
            // Shows the CURRENT role (a grandfathered admin above its cap
            // keeps saying Admin); the cap only blocks promotions.
            <span
              className="role-pill"
              title="An agent can't outrank its owner"
              data-testid={`agent-role-pill-${agent.id}`}
            >
              {agent.role === 'admin' ? 'Admin' : 'Member'}
            </span>
          ) : (
            <select
              className="role-select"
              value={agent.role}
              disabled={busy}
              onChange={(e) => void guarded(() => api.patchAgent(agent.id, { role: e.target.value as MembershipRole }))}
              aria-label={`Workspace role for ${agent.name}`}
              data-testid={`agent-role-${agent.id}`}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          )}
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
          onSave={(ids) => guarded(() => api.setAgentProjects(agent.id, ids))}
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
