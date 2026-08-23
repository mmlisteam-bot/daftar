import { normalizeLang } from "./parse";

type Kind = "kw" | "str" | "cm" | "num" | "plain";

type Rule = { kind: Kind; re: RegExp };

function rules(lang: string): Rule[] {
  const str = { kind: "str" as const, re: /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/y };
  const num = { kind: "num" as const, re: /\b\d+(?:\.\d+)?\b/y };
  switch (lang) {
    case "sql":
      return [
        { kind: "cm", re: /--[^\n]*/y },
        str,
        {
          kind: "kw",
          re: /\b(?:SELECT|FROM|WHERE|AND|OR|NOT|NULL|INSERT|INTO|UPDATE|DELETE|UNION|ALL|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|LIKE|IN|IS|SET|VALUES|CREATE|TABLE|DROP|ALTER|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|CASE|WHEN|THEN|ELSE|END|DISTINCT|COUNT|SUM|SLEEP|WAITFOR|DELAY|INFORMATION_SCHEMA|CONCAT|IFNULL|VERSION|DATABASE|USER|PASS|PASSWORD)\b/iy,
        },
        num,
      ];
    case "http":
      return [
        { kind: "cm", re: /#[^\n]*/y },
        {
          kind: "kw",
          re: /\b(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|TRACE|CONNECT|HTTP\/\d\.\d|Host|Cookie|Authorization|Content-Type|User-Agent|Content-Length)\b/y,
        },
        str,
        num,
      ];
    case "bash":
      return [
        { kind: "cm", re: /#[^\n]*/y },
        str,
        { kind: "kw", re: /\b(?:if|then|else|fi|for|do|done|in|while|case|esac|function|return|echo|curl|export|sudo)\b/y },
        { kind: "kw", re: /--?[a-zA-Z][\w-]*/y },
      ];
    case "python":
      return [
        { kind: "cm", re: /#[^\n]*/y },
        { kind: "str", re: /'''[\s\S]*?'''|"""[\s\S]*?"""|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/y },
        {
          kind: "kw",
          re: /\b(?:def|class|return|if|elif|else|for|while|import|from|as|try|except|with|pass|True|False|None|in|not|and|or|lambda|yield)\b/y,
        },
        num,
      ];
    case "javascript":
      return [
        { kind: "cm", re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y },
        str,
        {
          kind: "kw",
          re: /\b(?:const|let|var|function|return|if|else|for|while|class|import|from|export|async|await|new|this|true|false|null|undefined)\b/y,
        },
        num,
      ];
    case "json":
      return [
        { kind: "str", re: /"(?:\\.|[^"\\])*"/y },
        { kind: "kw", re: /\b(?:true|false|null)\b/y },
        num,
      ];
    case "php":
      return [
        { kind: "cm", re: /\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\//y },
        str,
        { kind: "kw", re: /\b(?:function|return|if|else|foreach|echo|class|public|private|protected|new|true|false|null)\b/y },
        num,
      ];
    default:
      return [
        { kind: "cm", re: /\/\/[^\n]*|#[^\n]*|--[^\n]*/y },
        str,
        num,
      ];
  }
}

export function highlight(code: string, langRaw?: string) {
  const lang = normalizeLang(langRaw);
  const rs = rules(lang);
  const out: { kind: Kind; v: string }[] = [];
  let i = 0;
  while (i < code.length) {
    let hit: { kind: Kind; v: string } | null = null;
    for (const r of rs) {
      r.re.lastIndex = i;
      const m = r.re.exec(code);
      if (m && m.index === i) {
        hit = { kind: r.kind, v: m[0] };
        break;
      }
    }
    if (hit) {
      out.push(hit);
      i += hit.v.length;
    } else {
      const last = out[out.length - 1];
      if (last?.kind === "plain") last.v += code[i];
      else out.push({ kind: "plain", v: code[i] ?? "" });
      i += 1;
    }
  }
  return out;
}

export function HighlightedCode({ code, lang }: { code: string; lang?: string }) {
  const parts = highlight(code, lang);
  return (
    <pre dir="ltr" className="code-pre">
      <code>
        {parts.map((p, i) =>
          p.kind === "plain" ? (
            <span key={i}>{p.v}</span>
          ) : (
            <span key={i} className={`tok-${p.kind}`}>
              {p.v}
            </span>
          ),
        )}
      </code>
    </pre>
  );
}
