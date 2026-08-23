import { emptyBlock, nid, type Block, type Page, type PageIcon } from "./types";

export type PageTemplate = {
  id: string;
  title: string;
  hint: string;
  icon: PageIcon;
  tags: string[];
  blocks: () => Block[];
};

function b(type: Block["type"], content = "", extra: Partial<Block> = {}): Block {
  return { ...emptyBlock(type), id: nid(), content, ...extra };
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "http-notes",
    title: "جزوه HTTP",
    hint: "متد، هدر، وضعیت",
    icon: "globe",
    tags: ["HTTP", "پایه"],
    blocks: () => [
      b("callout", "جزوه جلسه: پروتکل، متدها، هدرها و کد وضعیت.", { callout: "abstract" }),
      b("h2", "Web Application چیست؟"),
      b("p", ""),
      b("h2", "HTTP در برابر HTTPS"),
      b("table", "", {
        headers: ["مورد", "HTTP", "HTTPS"],
        rows: [
          ["پورت پیش‌فرض", "80", "443"],
          ["رمزنگاری", "", "TLS"],
          ["قابل شنود", "", ""],
        ],
      }),
      b("h2", "متدها"),
      b("table", "", {
        headers: ["متد", "بدنه؟", "کاربرد / نکته امنیتی"],
        rows: [
          ["GET", "نه", "خواندن — پارامتر در URL"],
          ["POST", "بله", "ارسال داده"],
          ["PUT", "بله", "جایگزینی منبع"],
          ["PATCH", "بله", "تغییر جزئی"],
          ["DELETE", "اختیاری", "حذف"],
          ["OPTIONS", "نه", "CORS / متدهای مجاز"],
          ["HEAD", "نه", "فقط هدر"],
        ],
      }),
      b("h2", "هدرهای مهم"),
      b("table", "", {
        headers: ["هدر", "سمت", "کاربرد"],
        rows: [
          ["Host", "درخواست", ""],
          ["Cookie", "درخواست", ""],
          ["Authorization", "درخواست", ""],
          ["Content-Type", "هر دو", ""],
          ["Set-Cookie", "پاسخ", ""],
          ["Location", "پاسخ", "ریدایرکت"],
        ],
      }),
      b("h2", "کد وضعیت"),
      b("ul", "1xx اطلاعاتی"),
      b("ul", "2xx موفق"),
      b("ul", "3xx ریدایرکت"),
      b("ul", "4xx خطای کلاینت"),
      b("ul", "5xx خطای سرور"),
      b("h2", "نمونه درخواست"),
      b("code", "GET /login HTTP/1.1\nHost: target.tld\nUser-Agent: Mozilla/5.0\nCookie: session=…", { lang: "http" }),
      b("h2", "نکات جلسه"),
      b("p", ""),
    ],
  },
  {
    id: "sqli-lab",
    title: "لاب SQL Injection",
    hint: "هدف، payload، نتیجه",
    icon: "database",
    tags: ["SQL Injection", "لاب"],
    blocks: () => [
      b("callout", "قبل از تست، اسکوپ و قانون لاب را چک کن. payloadها را همین‌جا ثبت کن.", { callout: "warning" }),
      b("h2", "هدف و اسکوپ"),
      b("table", "", {
        headers: ["فیلد", "مقدار"],
        rows: [
          ["URL", ""],
          ["پارامتر", ""],
          ["متد", "GET / POST"],
          ["نوع تزریق", "Union / Error / Boolean / Time"],
          ["WAF / فیلتر", ""],
        ],
      }),
      b("h2", "چک‌لیست"),
      b("todo", "نقل‌قول و کاراکترهای خاص را تست کردم", { checked: false }),
      b("todo", "تعداد ستون‌ها را با ORDER BY / UNION پیدا کردم", { checked: false }),
      b("todo", "دیتابیس و نسخه را درآوردم", { checked: false }),
      b("todo", "لیست جداول / ستون‌ها", { checked: false }),
      b("todo", "دادهٔ حساس (users, password)", { checked: false }),
      b("h2", "Payloadهای تست‌شده"),
      b("code", "' OR '1'='1' --\n' UNION SELECT NULL,NULL,NULL --\n' AND SLEEP(5) --", { lang: "sql" }),
      b("h2", "نتیجه"),
      b("p", ""),
      b("h2", "اسکرین‌شات"),
      b("image", ""),
      b("h2", "یادداشت برای گزارش"),
      b("p", ""),
    ],
  },
  {
    id: "bug-report",
    title: "گزارش باگ",
    hint: "خلاصه، reproduce، اثر",
    icon: "bug",
    tags: ["گزارش", "باگ"],
    blocks: () => [
      b("h2", "خلاصه"),
      b("p", ""),
      b("table", "", {
        headers: ["فیلد", "مقدار"],
        rows: [
          ["عنوان", ""],
          ["شدت", "Critical / High / Medium / Low"],
          ["CWE", ""],
          ["آدرس", ""],
          ["نقش کاربر", ""],
        ],
      }),
      b("h2", "مراحل Reproduce"),
      b("ol", ""),
      b("ol", ""),
      b("ol", ""),
      b("h2", "Payload / درخواست"),
      b("code", "", { lang: "http" }),
      b("h2", "نتیجهٔ مشاهده‌شده"),
      b("p", ""),
      b("h2", "نتیجهٔ مورد انتظار"),
      b("p", ""),
      b("h2", "اثر (Impact)"),
      b("p", ""),
      b("h2", "پیشنهاد رفع"),
      b("p", ""),
      b("h2", "شواهد"),
      b("image", ""),
    ],
  },
];

export function pageFromTemplate(tpl: PageTemplate, parentId: string | null = null): Page {
  const now = Date.now();
  return {
    id: nid(),
    title: tpl.title,
    parentId,
    icon: tpl.icon,
    tags: [...tpl.tags],
    blocks: tpl.blocks(),
    createdAt: now,
    updatedAt: now,
    sort: now,
  };
}
