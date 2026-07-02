import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MeResponse, ProjectDto, UserDto, MentionDto } from '@kbrelay/shared';
import * as api from '../lib/api';
import { clearToken } from '../lib/auth';
import { CardLinksContext, parseCardDeepLink, type CardLinks } from '../lib/cardLinks';
import { useDialog } from '../components/Dialog';
import { recordProjectView, orderByRecency } from '../lib/recentProjects';
import Board, { type BoardNav } from '../components/Board';
import ActivityFeed from '../components/ActivityFeed';
import QuickFind from '../components/QuickFind';
import MyWork from '../components/MyWork';
import Dropdown from '../components/Dropdown';
import ProjectSwitcher from '../components/ProjectSwitcher';
import BrowseProjectsModal from '../components/BrowseProjectsModal';
import NotificationBell from '../components/NotificationBell';
import ProjectSettings from '../components/ProjectSettings';
import FilterModal, { EMPTY_FILTER, isFilterActive, filterCount, type BoardFilter } from '../components/FilterModal';
import NewProjectModal from '../components/NewProjectModal';
import ApiKeysModal from '../components/ApiKeysModal';
import ClaudeCodeGuide from '../components/ClaudeCodeGuide';
import ProfileSettings from '../components/ProfileSettings';
import TenantSettings from '../components/TenantSettings';
import BrandMark from '../components/BrandMark';

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

function Pulse() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function Kebab() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  );
}

function Inbox() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function Magnifier() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

/** Small colored line-glyphs for the account menu (KBR-21). Not emojis. */
const GLYPH_PATHS: Record<string, string> = {
  profile: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8',
  team: 'M17 21v-2a4 4 0 0 0-3-3.87 M7 21v-2a4 4 0 0 1 3-3.87 M9 3.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7 M16 3.6a3.5 3.5 0 0 1 0 6.8',
  key: 'M7.5 20a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9 M10.6 12.4 21 2 M16 7l3 3',
  guide: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  signout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
};

function Glyph({ name, color }: { name: keyof typeof GLYPH_PATHS | string; color: string }) {
  const d = GLYPH_PATHS[name] ?? '';
  return (
    <svg className="menu-glyph" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d.split(' M').map((seg, i) => <path key={i} d={i === 0 ? seg : `M${seg}`} />)}
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
  const dialog = useDialog();
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
  const [guideOpen, setGuideOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [mentionCount, setMentionCount] = useState(0);
  // "Needs me" total for the My Work badge (KBR-70 follow-up): queue + reviews.
  // Mentions are added at render time so a mark-read updates the badge instantly.
  const [queueCount, setQueueCount] = useState(0);
  const [nav, setNav] = useState<BoardNav | null>(null);
  // My Work (default landing, KBR-64) vs board vs Activity feed (KBR-67).
  // A card jump always returns to the board.
  const [view, setView] = useState<'mywork' | 'board' | 'activity'>('mywork');
  // Global quick-find palette (v0.17.0, KBR-68) — Cmd/Ctrl+K or the topbar button.
  const [findOpen, setFindOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setFindOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const applyFilter = useCallback((f: BoardFilter) => { setFilter(f); setFilterOpen(false); }, []);
  const clearFilter = useCallback(() => { setFilter(EMPTY_FILTER); setFilterOpen(false); }, []);

  // Poll unread-mention count (bell badge) + queue/review counts (My Work
  // badge) on the same 20s cadence as the board, plus on mount and focus.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void api.getMentions('unread').then((r) => setMentionCount(r.unreadCount)).catch(() => {});
      void api.getMyQueue().then((q) => setQueueCount(q.work.length + q.review.length)).catch(() => {});
    };
    refresh();
    const interval = window.setInterval(refresh, 20_000);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, []);

  // Everything that needs me: queue + reviews + unread mentions.
  const needsMe = queueCount + mentionCount;

  // Jump to a mention: switch to its project (if needed), then hand the card +
  // location to the Board to open and flash.
  const navigateToMention = useCallback((m: MentionDto) => {
    setSelected((cur) => (m.projectId !== cur ? m.projectId : cur));
    setNav({ cardId: m.cardId, source: m.source });
    setView('board');
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

  // Ticket-key autolinks (KBR-65): resolve `CODE-seq` → card, then reuse the
  // mention-jump plumbing. Resolution is client-side (no by-key endpoint): the
  // accessible projects list gives code → project; one cards fetch gives
  // seq → card. Unresolvable keys (deleted card, stale text) are a silent no-op —
  // the rendered text is still there, nothing to break.
  const openCardByKey = useCallback(async (key: string): Promise<boolean> => {
    const code = key.split('-')[0];
    const project = projects.find((p) => p.code === code);
    if (!project) return false;
    try {
      const { cards } = await api.listCards(project.id);
      const card = cards.find((c) => c.key === key);
      if (!card) {
        // Keys are never reused (KBR-60): the card may be archived. Point the
        // user at the restore path instead of failing as "doesn't exist".
        const { cards: archived } = await api.listCards(project.id, { archived: true });
        if (archived.some((c) => c.key === key)) {
          void dialog.alert({
            title: `${key} is archived`,
            message: `Restore it from Project Settings → Archive in “${project.name}” to open it.`,
          });
          return true; // resolved — just not openable on the board
        }
        return false;
      }
      selectProject(project.id);
      setNav({ cardId: card.id });
      setView('board');
      return true;
    } catch {
      /* lost access mid-session or transient failure — leave the text alone */
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, selectProject]);

  const cardLinks = useMemo<CardLinks>(() => ({
    // A project may pre-date codes (code: null) — it can't have ticket keys.
    codes: new Set(projects.map((p) => p.code).filter((c): c is string => c != null)),
    openCard: (key) => void openCardByKey(key),
  }), [projects, openCardByKey]);

  // External card links (KBR-71): consume a /c/<KEY> deep link once projects
  // are known. The URL is cleaned first so a failed open doesn't loop; an
  // unresolvable key (no such card, or no access to its project) gets an
  // explicit error instead of the autolinks' silent no-op.
  useEffect(() => {
    if (loading) return;
    const key = parseCardDeepLink(window.location.pathname);
    if (!key) return;
    window.history.replaceState(null, '', '/');
    void openCardByKey(key).then((ok) => {
      if (!ok) {
        void dialog.alert({
          title: 'Card not available',
          message: `${key} doesn't exist, or you don't have access to its project.`,
        });
      }
    });
    // Run once, when the first projects load completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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

  // Apply an updated /me (from the Profile modal): update the header, then
  // re-fetch users so cards assigned to me recolor immediately.
  async function applyMe(updated: MeResponse) {
    onMeChange(updated);
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
    <CardLinksContext.Provider value={cardLinks}>
      <header className="topbar">
        <span className="brand"><BrandMark /> <span className="brand-name">kbRelay</span></span>

        <button
          className={`icon-btn subtle topbar-tool mywork-btn ${view === 'mywork' ? 'active' : ''}`}
          onClick={() => setView('mywork')}
          aria-label={`My Work${needsMe > 0 ? ` (${needsMe} items)` : ''}`}
          title="My Work — your queue, reviews, and mentions"
        >
          <Inbox />
          {needsMe > 0 && <span className="notif-badge">{needsMe > 99 ? '99+' : needsMe}</span>}
        </button>

        {projects.length > 0 && (
          <ProjectSwitcher
            projects={orderedProjects}
            currentId={selected}
            onSelect={(id) => { selectProject(id); setView('board'); }}
            onBrowse={() => setBrowseOpen(true)}
            onNew={() => setNewProjectOpen(true)}
          />
        )}

        {selected && view !== 'mywork' && (
          <button className="icon-btn subtle topbar-tool project-settings-btn" onClick={() => setSettingsOpen(true)} aria-label="Project settings" title="Project settings">
            <Gear />
          </button>
        )}

        {selected && view !== 'mywork' && (
          <button
            className={`icon-btn subtle topbar-tool filter-btn ${isFilterActive(filter) ? 'active' : ''}`}
            onClick={() => setFilterOpen(true)}
            aria-label="Filter cards"
            title="Filter cards"
          >
            <Funnel />
            {isFilterActive(filter) && <span className="filter-count">{filterCount(filter)}</span>}
          </button>
        )}

        {selected && view !== 'mywork' && (
          <button
            className={`icon-btn subtle topbar-tool activity-btn ${view === 'activity' ? 'active' : ''}`}
            onClick={() => setView((v) => (v === 'activity' ? 'board' : 'activity'))}
            aria-label={view === 'activity' ? 'Show board' : 'Show activity'}
            title={view === 'activity' ? 'Show board' : 'Project activity'}
          >
            <Pulse />
          </button>
        )}

        <button
          className="icon-btn subtle topbar-tool quickfind-btn"
          onClick={() => setFindOpen(true)}
          aria-label="Quick find"
          title="Quick find (⌘K / Ctrl+K)"
        >
          <Magnifier />
        </button>

        {/* Mobile (≤640px, KBR-70): the five tools collapse into one menu so the
            project switcher keeps its space. Hidden on desktop via CSS. */}
        <Dropdown
          className="topbar-tools-menu"
          triggerClassName="icon-btn subtle"
          label="Tools menu"
          trigger={
            <>
              <Kebab />
              {needsMe > 0 && <span className="notif-badge">{needsMe > 99 ? '99+' : needsMe}</span>}
            </>
          }
        >
          <div className="menu-list">
            <button className="menu-item" onClick={() => setView('mywork')}>
              <Inbox /> My Work{needsMe > 0 ? ` (${needsMe})` : ''}
            </button>
            <button className="menu-item" onClick={() => setFindOpen(true)}>
              <Magnifier /> Quick find
            </button>
            {selected && view !== 'mywork' && (
              <>
                <div className="menu-divider" />
                <button className="menu-item" onClick={() => setSettingsOpen(true)}>
                  <Gear /> Project settings
                </button>
                <button className="menu-item" onClick={() => setFilterOpen(true)}>
                  <Funnel /> Filter cards{isFilterActive(filter) ? ` (${filterCount(filter)})` : ''}
                </button>
                <button className="menu-item" onClick={() => setView((v) => (v === 'activity' ? 'board' : 'activity'))}>
                  <Pulse /> {view === 'activity' ? 'Show board' : 'Project activity'}
                </button>
              </>
            )}
          </div>
        </Dropdown>

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
            <button className="menu-item" onClick={() => setProfileOpen(true)}>
              <Glyph name="profile" color="#7c3aed" /> Profile
            </button>

            <div className="menu-divider" />
            <span className="menu-section-label">Configuration</span>
            {me.user.role === 'admin' && (
              <button className="menu-item" onClick={() => setTeamOpen(true)}>
                <Glyph name="team" color="#0891b2" /> Team &amp; access
              </button>
            )}
            <button className="menu-item" onClick={() => setApiKeysOpen(true)}>
              <Glyph name="key" color="#d97706" /> API keys
            </button>

            <div className="menu-divider" />
            <span className="menu-section-label">Guides</span>
            <button className="menu-item" onClick={() => setGuideOpen(true)}>
              <Glyph name="guide" color="#16a34a" /> Claude Code setup
            </button>

            <div className="menu-divider" />
            <button className="menu-item" onClick={signOut}>
              <Glyph name="signout" color="#dc2626" /> Sign out
            </button>
          </div>
        </Dropdown>
      </header>

      {loading ? (
        <div className="loading-wrap"><div className="spinner" /></div>
      ) : view === 'mywork' ? (
        <MyWork
          users={users}
          onOpenCard={(projectId, cardId) => {
            selectProject(projectId);
            setNav({ cardId });
            setView('board');
          }}
          onMention={navigateToMention}
          onMentionCountChange={setMentionCount}
        />
      ) : selected && view === 'activity' ? (
        <ActivityFeed key={selected} projectId={selected} users={projectUsers} />
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
            <div className="brand"><BrandMark /> kbRelay</div>
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
      {findOpen && (
        <QuickFind
          recentProjects={orderedProjects}
          onPickProject={(id) => { selectProject(id); setView('board'); }}
          onPickCard={({ projectId, cardId }) => {
            selectProject(projectId);
            setNav({ cardId });
            setView('board');
          }}
          onClose={() => setFindOpen(false)}
        />
      )}
      {apiKeysOpen && <ApiKeysModal onClose={() => setApiKeysOpen(false)} />}
      {guideOpen && <ClaudeCodeGuide onClose={() => setGuideOpen(false)} />}
      {profileOpen && <ProfileSettings me={me} onClose={() => setProfileOpen(false)} onSaved={applyMe} />}
      {teamOpen && (
        <TenantSettings meId={me.user.id} projects={projects} onClose={() => setTeamOpen(false)} />
      )}
    </CardLinksContext.Provider>
  );
}
