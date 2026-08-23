import type { Block, Page } from "./types";

function tableMd(block: Block): string {
  const headers = block.headers ?? [];
  const rows = block.rows ?? [];
  if (!headers.length) return "";
  const line = (cells: string[]) => `| ${cells.map((c) => c.replaceAll("|", "\\|")).join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  return [line(headers), sep, ...rows.map(line)].join("\n");
}

export function blockToMarkdown(block: Block): string {
  const t = block.content;
  switch (block.type) {
    case "h1":
      return `# ${t}`;
    case "h2":
      return `## ${t}`;
    case "h3":
      return `### ${t}`;
    case "ul":
      return `- ${t}`;
    case "ol":
      return `1. ${t}`;
    case "todo":
      return `- [${block.checked ? "x" : " "}] ${t}`;
    case "code":
      return `\`\`\`${block.lang ?? ""}\n${t}\n\`\`\``;
    case "quote":
      return t
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n");
    case "callout": {
      const kind = block.callout ?? "info";
      return `> [!${kind}]\n> ${t.replaceAll("\n", "\n> ")}`;
    }
    case "divider":
      return "---";
    case "image":
      return block.imageId ? `![screenshot](attachment:${block.imageId})` : "";
    case "toggle":
      return `<details>\n<summary>${t}</summary>\n\n${block.inner ?? ""}\n\n</details>`;
    case "table":
      return tableMd(block);
    default:
      return t;
  }
}

export function pageToMarkdown(page: Page): string {
  const tags = page.tags.length ? `\n\nTags: ${page.tags.map((t) => `\`${t}\``).join(" · ")}` : "";
  const body = page.blocks.map(blockToMarkdown).filter(Boolean).join("\n\n");
  return `# ${page.title}${tags}\n\n${body}\n`;
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
