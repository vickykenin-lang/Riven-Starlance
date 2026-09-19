"use client";

/*
 * Safe, intentionally small Markdown renderer for model-produced synthesis.
 * It never injects HTML. Only headings, paragraphs, ordered/unordered lists,
 * emphasis, inline code, and http(s) links are rendered as elements.
 */

function stripOuterFence(value) {
  const text = String(value || "").trim();
  if (!text.startsWith("```") || !text.endsWith("```")) return text;
  const newline = text.indexOf("\n");
  return newline === -1 ? text : text.slice(newline + 1, -3).trim();
}

function inline(text) {
  const parts = String(text).split(/(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`)/g);
  const nodes = [];

  for (let index = 0; index < parts.length; index += 1) {
    const value = parts[index];
    if (!value) continue;

    if (value.startsWith("[") && parts[index + 1] && parts[index + 2]) {
      nodes.push(<a key={`link-${index}`} href={parts[index + 2]} target="_blank" rel="noreferrer">{parts[index + 1]}</a>);
      index += 2;
    } else if (value.startsWith("**") && parts[index + 3]) {
      nodes.push(<strong key={`strong-${index}`}>{parts[index + 3]}</strong>);
      index += 3;
    } else if (value.startsWith("`") && parts[index + 4]) {
      nodes.push(<code key={`code-${index}`}>{parts[index + 4]}</code>);
      index += 4;
    } else {
      nodes.push(value);
    }
  }

  return nodes;
}

function flushBlock(blocks, paragraph, list) {
  if (paragraph.length) blocks.push({ type: "paragraph", items: paragraph.splice(0) });
  if (list.type && list.items.length) {
    blocks.push({ type: list.type, items: list.items.splice(0) });
    list.type = null;
  }
}

function parseBrief(answer) {
  const lines = stripOuterFence(answer).split("\n");
  const blocks = [];
  const paragraph = [];
  const list = { type: null, items: [] };

  for (const raw of lines) {
    const line = raw.trim();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);

    if (heading) {
      flushBlock(blocks, paragraph, list);
      blocks.push({ type: `h${Math.min(heading[1].length + 2, 4)}`, items: [heading[2]] });
    } else if (ordered || bullet) {
      if (paragraph.length) flushBlock(blocks, paragraph, list);
      const type = ordered ? "ol" : "ul";
      if (list.type && list.type !== type) flushBlock(blocks, paragraph, list);
      list.type = type;
      list.items.push((ordered || bullet)[1]);
    } else if (!line) {
      flushBlock(blocks, paragraph, list);
    } else {
      if (list.type) flushBlock(blocks, paragraph, list);
      paragraph.push(line);
    }
  }

  flushBlock(blocks, paragraph, list);
  return blocks;
}

export default function FinalBrief({ answer }) {
  const blocks = parseBrief(answer);

  return (
    <article className="final-brief" aria-label="Riven's reviewed final brief">
      <header className="final-brief-header">
        <div>
          <p className="eyebrow">RIVEN'S REVIEWED BRIEF</p>
          <h2>Final research answer</h2>
        </div>
        <span className="reviewed-stamp">Reviewed & formatted</span>
      </header>
      <div className="final-brief-content">
        {blocks.map((block, index) => {
          if (block.type === "ul" || block.type === "ol") {
            const List = block.type;
            return <List key={`list-${index}`}>{block.items.map((item, itemIndex) => <li key={`item-${itemIndex}`}>{inline(item)}</li>)}</List>;
          }
          if (block.type.startsWith("h")) {
            const Heading = block.type;
            return <Heading key={`heading-${index}`}>{inline(block.items[0])}</Heading>;
          }
          return <p key={`paragraph-${index}`}>{inline(block.items.join(" "))}</p>;
        })}
      </div>
    </article>
  );
}
