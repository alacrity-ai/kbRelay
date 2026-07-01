import { useEffect, useState } from 'react';

/**
 * A small "(?)" badge that opens a KISS guide for connecting the kbRelay MCP.
 * Dropped next to the MCP/agent-key blurbs in the Agents tab and the API-keys
 * modal. Self-contained (owns its open state) so it's a one-liner to place.
 */
export function McpGuideButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="help-badge"
        onClick={() => setOpen(true)}
        aria-label="How to set up the MCP"
        title="How to set up the MCP"
      >
        ?
      </button>
      {open && <McpGuideModal onClose={() => setOpen(false)} />}
    </>
  );
}

function McpGuideModal({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  // Same-origin API → the current origin is the right base URL (works for the
  // hosted app AND a self-host instance without hardcoding a domain).
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://kbrelay.lalalimited.com';
  const command =
    `claude mcp add kbrelay --scope user \\\n` +
    `  --env KBRELAY_BASE_URL=${base} \\\n` +
    `  --env KBRELAY_API_KEY=<your key> \\\n` +
    `  -- npx -y @alacrity-ai/kbrelaymcp`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card mcp-guide" role="dialog" aria-modal="true" aria-labelledby="mcp-guide-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-accent" style={{ background: 'var(--accent)' }} />
          <h2 className="modal-title" id="mcp-guide-title">Connect the kbRelay MCP</h2>
          <div className="modal-header-actions">
            <button className="icon-btn ghost" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        <div className="modal-body">
          <p className="muted-note">
            Give your agent (Claude Code, Cursor, Windsurf, …) kbRelay's tools — projects, cards,
            timeline, mentions — over the <strong>MCP</strong>.
          </p>

          <ol className="mcp-steps">
            <li>
              <strong>Get a key.</strong> Best: create an agent under <em>Team &amp; access → Agents</em> and
              mint its key — then the agent's work is attributed to it. (Your own key from <em>API keys</em> also works.)
            </li>
            <li>
              <strong>Add the server</strong> (swap in your key):
              <div className="code-block">
                <pre><code>{command}</code></pre>
                <button className="ghost sm copy-btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
            </li>
            <li>
              <strong>Restart your MCP client.</strong> Reopen it and the <code>kbrelay</code> tools
              appear — try <em>“list my projects”</em>.
            </li>
          </ol>

          <p className="muted-note">
            Other clients (Cursor / Windsurf / Cline): run <code>npx -y @alacrity-ai/kbrelaymcp</code> with the
            same two env vars — <code>KBRELAY_BASE_URL</code> and <code>KBRELAY_API_KEY</code>.
          </p>
        </div>

        <div className="modal-footer">
          <div className="spacer" />
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
