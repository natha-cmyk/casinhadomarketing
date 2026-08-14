// Renderer de markdown MINIMALISTA e seguro (sem dep, sem dangerouslySetInnerHTML).
// Cobre o subconjunto que a LLM emite: títulos (#/##/###), **negrito**, *itálico*,
// `código`, listas (- / 1.), parágrafos e quebras. Tudo como nós React (escapado).
import React from "react";

// tokeniza inline: **negrito**, *itálico* / _itálico_, `código`
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${i++}`;
    if (m[2] != null) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[3] != null) out.push(<code key={k} className="ag-code">{m[3]}</code>);
    else if (m[4] != null) out.push(<em key={k}>{m[4]}</em>);
    else if (m[5] != null) out.push(<em key={k}>{m[5]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function AgentMarkdown({ text }: { text: string }) {
  const lines = (text || "").replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (para.length) { blocks.push(<p key={`p${k++}`}>{inline(para.join(" "), `p${k}`)}</p>); para = []; }
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((it, idx) => <li key={idx}>{inline(it, `li${k}-${idx}`)}</li>);
      blocks.push(list.ordered ? <ol key={`l${k++}`}>{items}</ol> : <ul key={`l${k++}`}>{items}</ul>);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();
    if (!t) { flushPara(); flushList(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(t);
    const ul = /^[-*]\s+(.*)$/.exec(t);
    const ol = /^\d+[.)]\s+(.*)$/.exec(t);
    if (h) {
      flushPara(); flushList();
      const lvl = Math.min(h[1].length, 3);
      const Tag = (["h4", "h5", "h6"] as const)[lvl - 1];
      blocks.push(<Tag key={`h${k++}`} className="ag-h">{inline(h[2], `h${k}`)}</Tag>);
    } else if (ul) {
      flushPara();
      if (!list || list.ordered) { flushList(); list = { ordered: false, items: [] }; }
      list.items.push(ul[1]);
    } else if (ol) {
      flushPara();
      if (!list || !list.ordered) { flushList(); list = { ordered: true, items: [] }; }
      list.items.push(ol[1]);
    } else {
      flushList();
      para.push(t);
    }
  }
  flushPara(); flushList();
  return <div className="ag-md">{blocks}</div>;
}
