import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MeResponse, ProjectDto, UserDto, MentionDto } from '@kbrelay/shared';
import { USER_PALETTE } from '@kbrelay/shared';
import * as api from '../lib/api';
import { clearToken } from '../lib/auth';
import { recordProjectView, orderByRecency } from '../lib/recentProjects';
import Board, { type BoardNav } from '../components/Board';
import Dropdown from '../components/Dropdown';
import ProjectSwitcher from '../components/ProjectSwitcher';
import BrowseProjectsModal from '../components/BrowseProjectsModal';
import NotificationBell from '../components/NotificationBell';
import ProjectSettings from '../components/ProjectSettings';
import FilterModal, { EMPTY_FILTER, isFilterActive, filterCount, type BoardFilter } from '../components/FilterModal';
import NewProjectModal from '../components/NewProjectModal';
import ApiKeysModal from '../components/ApiKeysModal';
import TenantSettings from '../components/TenantSettings';

const PROJECT_KEY = 'kbrelay.selectedProject';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : name.slice(0, 2);
  return chars.toUpperCase();
}

function Gear() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function Funnel() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

/** The signed-in experience: bespoke top bar (project switcher + user menu) + the active board. */
export default function BoardApp({
  me,
  onMeChange,
  onSignOut,
}: {
  me: MeResponse;
  onMeChange: (me: MeResponse) => void;
  onSignOut: () => void;
}) {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  // `users` = all current tenant members (for the bell — mention authors can be
  // cross-project). `projectUsers` = scoped to the selected project (for the
  // assignee picker + @-autocomplete, so we only offer people who actually have
  // access to this board).
  const [users, setUsers] = useState<UserDto[]>([]);
  const [projectUsers, setProjectUsers] = useState<UserDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [boardNonce, setBoardNonce] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [apiKeysOpen, setApiKeysOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [mentionCount, setMentionCount] = useState(0);
  const [nav, setNav] = useState<BoardNav | null>(null);

  const applyFilter = useCallback((f: BoardFilter) => { setFilter(f); setFilterOpen(false); }, []);
  const clearFilter = useCallback(() => { setFilter(EMPTY_FILTER); setFilterOpen(false); }, []);

  // Poll unread-mention count for the bell badge on the same 20s cadence as the
  // board, plus on mount and when the tab regains focus.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void api.getMentions('unread').then((r) => setMentionCount(r.unreadCount)).catch(() => {});
    };
    refresh();
    const interval = window.setInterval(refresh, 20_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, []);

  // Jump to a mention: switch to its project (if needed), then hand the card +
  // location to the Board to open and flash.
  const navigateToMention = useCallback((m: MentionDto) => {
    setSelected((cur) => (m.projectId !== cur ? m.projectId : cur));
    setNav({ cardId: m.cardId, source: m.source });
  }, []);

  async function loadProjects(selectId?: string) {
    const [{ projects: ps }, { users: us }] = await Promise.all([
      api.listProjects('active'),
      api.listUsers(),
    ]);
    setProjects(ps);
    setUsers(us);
    setSelected((cur) => {
      const stored = localStorage.getItem(PROJECT_KEY);
      const valid = (id: string | null | undefined) => (id && ps.some((p) => p.id === id) ? id : null);
      const chosen = valid(selectId) ?? valid(cur) ?? valid(stored) ?? ps[0]?.id ?? null;
      if (chosen) recordProjectView(chosen);
      return chosen;
    });
    setLoading(false);
  }

  useEffect(() => { void loadProjects(); }, []);

  // Load the project-scoped user list whenever the active project changes, so
  // the assignee picker + @-autocomplete only offer people with access to it.
  useEffect(() => {
    if (!selected) { setProjectUsers([]); return; }
    let alive = true;
    void api.listUsers(selected).then(({ users: us }) => { if (alive) setProjectUsers(us); }).catch(() => {});
    return () => { alive = false; };
  }, [selected]);

  // Projects ordered most-recently-viewed first, for the switcher + browser.
  // `selected` is a dep on purpose: selecting a project updates the recency store
  // (localStorage), so we must recompute the order even though it's not read here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const orderedProjects = useMemo(() => orderByRecency(projects), [projects, selected]);

  /** Make a project active and remember the view (feeds recency ordering). */
  const selectProject = useCallback((id: string) => {
    recordProjectView(id);
    setSelected(id);
  }, []);

  /** Admin-only: delete a project, then re-pick a valid active board. */
  async function deleteProjectById(id: string) {
    await api.deleteProject(id);
    await loadProjects();
  }

  // Persist the open project so a browser reload lands you back on it.
  useEffect(() => {
    if (selected) localStorage.setItem(PROJECT_KEY, selected);
  }, [selected]);

  async function createProject(name: string, code: string) {
    const { project } = await api.createProject({ name, code });
    await loadProjects(project.id);
  }

  async function setMyColor(color: string) {
    if (color === me.user.color) return;
    const updated = await api.patchMe(color);
    onMeChange(updated);
    // Re-fetch users so cards assigned to me recolor immediately.
    const [{ users: us }, pu] = await Promise.all([
      api.listUsers(),
      selected ? api.listUsers(selected) : Promise.resolve({ users: [] as UserDto[] }),
    ]);
    setUsers(us);
    setProjectUsers(pu.users);
  }

  function signOut() {
    // Clear both auth modes: the server session cookie and any pasted token.
    void api.logout().catch(() => {});
    clearToken();
    onSignOut();
  }

  return (
    <>
      <header className="topbar">
        <span className="brand"><span className="brand-mark">kb</span> <span className="brand-name">kbRelay</span></span>

        {projects.length > 0 && (
          <ProjectSwitcher
            projects={orderedProjects}
            currentId={selected}
            onSelect={selectProject}
            onBrowse={() => setBrowseOpen(true)}
            onNew={() => setNewProjectOpen(true)}
          />
        )}

        {selected && (
          <button className="icon-btn subtle project-settings-btn" onClick={() => setSettingsOpen(true)} aria-label="Project settings" title="Project settings">
            <Gear />
          </button>
        )}

        {selected && (
          <button
            className={`icon-btn subtle filter-btn ${isFilterActive(filter) ? 'active' : ''}`}
            onClick={() => setFilterOpen(true)}
            aria-label="Filter cards"
            title="Filter cards"
          >
            <Funnel />
            {isFilterActive(filter) && <span className="filter-count">{filterCount(filter)}</span>}
          </button>
        )}

        <div className="spacer" />

        <NotificationBell
          users={users}
          count={mentionCount}
          onCountChange={setMentionCount}
          onNavigate={navigateToMention}
        />

        <Dropdown
          align="right"
          className="user-menu"
          triggerClassName="user-trigger"
          label="Account menu"
          trigger={
            <>
              <span className="avatar" style={{ background: me.user.color }}>{initials(me.user.name)}</span>
              <span className="user-name">{me.user.name}</span>
              <span className="chevron">▾</span>
            </>
          }
        >
          <div className="menu-list user-panel">
            <div className="user-head">
              <span className="avatar lg" style={{ background: me.user.color }}>{initials(me.user.name)}</span>
              <div>
                <div className="user-head-name">
                  {me.user.name}
                  <span className={`kind-badge ${me.user.kind}`}>{me.user.kind}</span>
                </div>
                <div className="user-head-tenant">{me.tenant.name}</div>
              </div>
            </div>

            <div className="menu-divider" />
            <div className="color-picker">
              <span className="view-label">Your color</span>
              <div className="color-swatches">
                {USER_PALETTE.map((c) => (
                  <button
                    key={c}
                    className={`color-swatch ${me.user.color.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                    style={{ background: c }}
                    aria-label={`set color ${c}`}
                    onClick={() => void setMyColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="menu-divider" />
            {me.user.role === 'admin' && (
              <button className="menu-item" onClick={() => setTeamOpen(true)}>Team &amp; access</button>
            )}
            <button className="menu-item" onClick={() => setApiKeysOpen(true)}>API keys</button>
            <button className="menu-item" onClick={signOut}>Sign out</button>
          </div>
        </Dropdown>
      </header>

      {loading ? (
        <div className="loading-wrap"><div className="spinner" /></div>
      ) : selected ? (
        <Board
          key={selected}
          projectId={selected}
          users={projectUsers}
          meId={me.user.id}
          reloadNonce={boardNonce}
          filter={filter}
          nav={nav && nav.cardId ? nav : null}
          onNavHandled={() => setNav(null)}
        />
      ) : (
        <div className="center">
          <div className="gate">
            <div className="brand"><span className="brand-mark">kb</span> kbRelay</div>
            <h1 style={{ margin: 0, fontSize: '1.2rem' }}>No projects yet</h1>
            <p className="muted-note">Create your first board to get going.</p>
            <button className="primary" onClick={() => setNewProjectOpen(true)}>+ New project</button>
          </div>
        </div>
      )}

      {settingsOpen && selected && (
        <ProjectSettings
          projectId={selected}
          onClose={() => setSettingsOpen(false)}
          onChanged={() => setBoardNonce((n) => n + 1)}
          onProjectChanged={() => void loadProjects(selected)}
        />
      )}

      {filterOpen && (
        <FilterModal
          users={projectUsers}
          meId={me.user.id}
          initial={filter}
          onApply={applyFilter}
          onClear={clearFilter}
        />
      )}

      {newProjectOpen && (
        <NewProjectModal onCreate={createProject} onClose={() => setNewProjectOpen(false)} />
      )}
      {browseOpen && (
        <BrowseProjectsModal
          projects={orderedProjects}
          currentId={selected}
          isAdmin={me.user.role === 'admin'}
          onPick={selectProject}
          onDelete={deleteProjectById}
          onClose={() => setBrowseOpen(false)}
        />
      )}
      {apiKeysOpen && <ApiKeysModal onClose={() => setApiKeysOpen(false)} />}
      {teamOpen && (
        <TenantSettings meId={me.user.id} projects={projects} onClose={() => setTeamOpen(false)} />
      )}
    </>
  );
}
