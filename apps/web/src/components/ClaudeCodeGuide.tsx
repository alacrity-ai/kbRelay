import { useEffect, useState, type ReactNode } from 'react';
import type { ColumnRole } from '@kbrelay/shared';
import { ROLE_META } from '../lib/roles';
import { mcpAddCommand, LOOP_COMMAND, CHANNELS_HINT } from '../lib/setupSnippets';

/**
 * "Claude Code setup" — a paged tutorial/guide opened from the account menu.
 * Two jobs: (1) configure (copyable, origin-aware setup commands) and (2) teach
 * the canonical relay flow with an animated mini-board that reuses the board's
 * column/card language. Built on the existing modal system; web-only.
 * See docs/v0.15.0/3-CLAUDE_CODE_GUIDE.md.
 */

/** A copyable code block with a Copy button (shared behavior across pages). */
function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the user can select manually */
    }
  }
  return (
    <div className="code-block">
      <pre><code>{code}</code></pre>
      <button className="ghost sm copy-btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  );
}

const DEMO_LANES: { name: string; role: ColumnRole | null }[] = [
  { name: 'Backlog', role: null },
  { name: 'Ready', role: 'ready' },
  { name: 'In Progress', role: 'in_progress' },
  { name: 'In Review', role: 'review' },
  { name: 'Done', role: 'done' },
];

/**
 * A non-interactive mini-board that reuses the board's visual language. One demo
 * card sits under the lane at index `lane` (−1 hides it) and slides between lanes
 * as the flow advances. `blocked` recolors the card to signal the Blocked detour.
 */
function FlowDemo({ lane, blocked = false }: { lane: number; blocked?: boolean }) {
  const n = DEMO_LANES.length;
  const showCard = lane >= 0;
  const accent = blocked ? ROLE_META.blocked.color : '#dc2626'; // Claude's color
  return (
    <div className="flowdemo" aria-hidden="true">
      <div className="flowdemo-lanes">
        {DEMO_LANES.map((l) => {
          const meta = l.role ? ROLE_META[l.role] : null;
          return (
            <div className="flowdemo-lane" key={l.name}>
              <span className="flowdemo-lane-name">{l.name}</span>
              {meta && (
                <span className="flowdemo-role" style={{ color: meta.color, borderColor: meta.color }}>
                  {meta.label}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flowdemo-track">
        {showCard && (
          <div
            className="flowdemo-card"
            style={{ left: `${((lane + 0.5) / n) * 100}%`, borderLeftColor: accent }}
          >
            <span className="flowdemo-card-key">KBR-42</span>
            <span className="flowdemo-card-summary">Fix the mint-token script</span>
          </div>
        )}
      </div>
    </div>
  );
}

/** The step-by-step relay, driven by an inline stepper on the flow page. */
const FLOW_STEPS: { lane: number; blocked?: boolean; actor: string; text: ReactNode }[] = [
  { lane: 1, actor: '🧑 You', text: (<>Drag the card into <strong>Ready</strong> (assigned to Claude). One card, deliberately — <em>you</em> meter the work.</>) },
  { lane: 2, actor: '🤖 Claude', text: (<>Picks it up → <strong>In Progress</strong> and comments “on it.” You see it working the moment it starts.</>) },
  { lane: 2, actor: '🤖 Claude', text: (<>Does the work against the card’s acceptance criteria.</>) },
  { lane: 3, actor: '🤖 Claude', text: (<>→ <strong>In Review</strong> with a handoff comment, and @-mentions you. 🔔 You get notified.</>) },
  { lane: 3, actor: '🧑 You', text: (<>You review — comment “LGTM / move to done,” or send it back with a note.</>) },
  { lane: 4, actor: '🤖 Claude', text: (<>Only when told → <strong>Done</strong>. Nothing auto-completes; closing is your call.</>) },
];

export default function ClaudeCodeGuide({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const [flowStep, setFlowStep] = useState(0);
  const command = mcpAddCommand();

  const pages: { title: string; body: ReactNode }[] = [
    {
      title: 'Relay work with Claude',
      body: (
        <>
          <p className="muted-note">
            kbRelay is where you and Claude <strong>relay work</strong>: you file and authorize
            tickets, Claude works them, and everything is audited on the timeline. Your board has
            lanes; some carry a <strong>role</strong> that gives them meaning for you and your agents.
          </p>
          <FlowDemo lane={0} />
          <p className="muted-note">
            <strong>Ready</strong> = fair game to work · <strong>In Progress</strong> = an agent has it ·
            <strong> In Review</strong> = handed back for you · <strong>Done</strong> = closed ·
            <strong> Blocked</strong> = stuck. Other lanes (like Backlog) are neutral.
          </p>
        </>
      ),
    },
    {
      title: 'Step 1 — Connect Claude to kbRelay',
      body: (
        <>
          <p className="muted-note">Give Claude Code kbRelay’s tools over the <strong>MCP</strong> (one time):</p>
          <CopyBlock code={command} />
          <p className="muted-note">
            Get a key from <strong>API keys</strong> in this menu — or, best, have an admin create an
            <em> agent</em> under <strong>Team &amp; access → Agents</strong> and mint its key, so Claude’s
            work is attributed to it. This lets Claude <em>read and work</em> tickets; the next step makes
            it <em>hear about</em> new work.
          </p>
        </>
      ),
    },
    {
      title: 'Step 2 — Make Claude hear about work',
      body: (
        <>
          <p className="muted-note"><strong>Simplest — polling (start here).</strong> Leave a Claude Code session running and:</p>
          <CopyBlock code={LOOP_COMMAND} />
          <p className="muted-note">
            Every 10 minutes Claude checks its queue (cards assigned to it in a <strong>Ready</strong> lane)
            and works them. A <code>.claude/loop.md</code> in your repo can hold the same instructions for a
            bare <code>/loop</code>.
          </p>
          <p className="muted-note"><strong>Instant — push (optional).</strong> For real-time reaction, wire a Claude Code <em>channel</em> (research preview):</p>
          <CopyBlock code={CHANNELS_HINT} />
          <p className="muted-note">You don’t need both — start with <code>/loop</code>.</p>
        </>
      ),
    },
    {
      title: 'The relay flow',
      body: (
        <>
          <FlowDemo lane={FLOW_STEPS[flowStep]!.lane} blocked={FLOW_STEPS[flowStep]!.blocked} />
          <div className="flow-caption">
            <span className="flow-actor">{FLOW_STEPS[flowStep]!.actor}</span>
            <span className="flow-text">{FLOW_STEPS[flowStep]!.text}</span>
          </div>
          <div className="flow-stepper">
            <button
              className="ghost sm"
              disabled={flowStep === 0}
              onClick={() => setFlowStep((s) => Math.max(0, s - 1))}
            >◀ Prev step</button>
            <span className="flow-step-count">{flowStep + 1} / {FLOW_STEPS.length}</span>
            <button
              className="ghost sm"
              disabled={flowStep === FLOW_STEPS.length - 1}
              onClick={() => setFlowStep((s) => Math.min(FLOW_STEPS.length - 1, s + 1))}
            >Next step ▶</button>
          </div>
          <p className="muted-note">
            <strong>Stuck?</strong> Claude moves the card to <strong>Blocked</strong> with a note explaining why
            and @-mentions you — never a silent stall.
          </p>
        </>
      ),
    },
    {
      title: 'The rules that keep it safe',
      body: (
        <ul className="guide-rules">
          <li><strong>You meter the work.</strong> Only <em>Ready</em> + assigned cards are fair game. Drag one, or drag five — your call.</li>
          <li><strong>Claude shows its hand.</strong> It moves the card to In Progress and comments the moment it starts.</li>
          <li><strong>Nothing auto-completes.</strong> Finished work waits in In Review for you; Claude closes only when told.</li>
          <li><strong>Stuck ≠ silent.</strong> Blockers land in Blocked with a reason and a ping.</li>
        </ul>
      ),
    },
    {
      title: 'Cheat-sheet',
      body: (
        <>
          <p className="muted-note">Connect Claude:</p>
          <CopyBlock code={command} />
          <p className="muted-note">Work the queue on a loop:</p>
          <CopyBlock code={LOOP_COMMAND} />
          <p className="muted-note">
            <strong>Assign to Claude + move to Ready = go.</strong> Claude → In Progress → In Review, then you
            close it. That’s the whole loop.
          </p>
        </>
      ),
    },
  ];

  const last = pages.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setPage((p) => Math.min(last, p + 1));
      else if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, last]);

  const current = pages[page]!;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card cc-guide" role="dialog" aria-modal="true" aria-labelledby="cc-guide-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: 'var(--accent)' }} />
          <h2 className="modal-title" id="cc-guide-title">{current.title}</h2>
          <div className="modal-header-actions">
            <button className="icon-btn ghost" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="modal-body cc-guide-body">{current.body}</div>

        <div className="modal-footer cc-guide-footer">
          <button className="ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>← Back</button>
          <div className="cc-dots" role="tablist" aria-label="Guide pages">
            {pages.map((p, i) => (
              <button
                key={p.title}
                className={`cc-dot ${i === page ? 'active' : ''}`}
                aria-label={`Page ${i + 1}: ${p.title}`}
                aria-selected={i === page}
                onClick={() => setPage(i)}
              />
            ))}
          </div>
          {page < last ? (
            <button className="primary" onClick={() => setPage((p) => Math.min(last, p + 1))}>Next →</button>
          ) : (
            <button className="primary" onClick={onClose}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
}
