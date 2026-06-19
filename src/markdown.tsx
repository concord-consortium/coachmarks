import type { ReactNode } from "react";

// Constrained, bold-focused markdown subset for popover text. We deliberately
// support only bold (`**…**` / `__…__`) — feedback strings come from an
// author-edited Google Sheet, so the surface stays small and predictable.
//
// HTML is never interpreted: the parser emits plain strings and <strong>
// elements as React children, and React escapes any markup inside those strings.
// We do NOT use dangerouslySetInnerHTML, so raw HTML in the source renders as
// literal text instead of being injected into the DOM.

// Opening delimiter, a non-space boundary, lazy content ending on a non-space,
// then the same delimiter (backreference). Mixed delimiters (`**x__`) don't match.
const BOLD = /(\*\*|__)(?=\S)([\s\S]*?\S)\1/g;

export function renderMarkdown(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  BOLD.lastIndex = 0;
  // biome-ignore lint/suspicious/noAssignInExpressions: canonical regex exec loop.
  while ((match = BOLD.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(<strong key={key++}>{match[2]}</strong>);
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  // Collapse to a bare string when there was no markup so callers/snapshots see
  // a plain text node rather than a single-element array.
  if (nodes.length === 0) return "";
  if (nodes.length === 1 && typeof nodes[0] === "string") return nodes[0];
  return nodes;
}
