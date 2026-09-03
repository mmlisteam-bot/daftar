import { PAGE } from "./ids";
import { createJsRefPages } from "./js-ref";
import { createJsTypesPage } from "./js-types";
import { createSqliRefPages } from "./sqli-ref";
import type { Block, BlockType, Page } from "./types";

let seq = 0;
function blk(type: BlockType, content = "", extra: Partial<Block> = {}): Block {
  seq += 1;
  return { id: `seed-b-${seq}`, type, content, ...extra };
}

const now = 1_724_400_000_000;

function page(
  id: string,
  title: string,
  icon: Page["icon"],
  tags: string[],
  parentId: string | null,
  blocks: Block[],
): Page {
  return {
    id,
    title,
    icon,
    tags,
    parentId,
    blocks,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSeed(): { pages: Record<string, Page>; order: string[] } {
  const pages: Record<string, Page> = {};

  pages[PAGE.home] = page(
    PAGE.home,
    "خانه",
    "book",
    ["شروع"],
    null,
    [
      blk("h1", "دفتر جزوه‌های پنتست وب"),
      blk(
        "p",
        "این یک دفتر شخصی شبیه نوت‌بوک است: صفحات تو‌در‌تو، بلاک، تگ، جستجو، اسکرین‌شات و خروجی Markdown. همه چیز روی همین مرورگر ذخیره می‌شود.",
      ),
      blk("callout", "برای ساخت صفحه جدید از دکمه «صفحه» در سایدبار استفاده کن. زیرصفحه را از منوی همان صفحه بساز.", {
        callout: "tip",
      }),
      blk("h2", "میانبرها"),
      blk("ul", "تایپ / برای باز شدن منوی بلاک"),
      blk("ul", "Ctrl + K جستجو بین همه نوت‌ها"),
      blk("ul", "Enter بلاک بعدی · Backspace روی بلاک خالی حذف می‌کند"),
      blk("ul", "اسکرین‌شات را در بلاک تصویر رها کن یا از کلیپ‌بورد بچسبان"),
      blk("h2", "نمونه ساختار کلاس"),
      blk(
        "p",
        "جزوه HTTP، مرجع «SQL Injection صفر تا صد»، و درخت «جاوااسکریپت» (انواع داده + آسیب‌پذیری سمت کلاینت) به‌صورت صفحه و زیرصفحه آمده‌اند.",
      ),
    ],
  );
  pages[PAGE.home]!.starred = true;

  pages[PAGE.http] = page(
    PAGE.http,
    "Web Application و HTTP",
    "globe",
    ["HTTP", "پایه"],
    null,
    [
      blk("h1", "Web Application و پروتکل HTTP"),
      blk("h2", "Web Application چیست؟"),
      blk(
        "p",
        "برنامه‌ای که از طریق مرورگر اجرا می‌شود و بر پایه معماری Client-Server کار می‌کند. ارتباط معمولاً با HTTP یا HTTPS است.",
      ),
      blk("table", "", {
        headers: ["نقش", "توضیح"],
        rows: [
          ["Client", "مرورگر کاربر (Chrome، Firefox و ...)"],
          ["Server", "سروری که درخواست را دریافت و پاسخ می‌دهد"],
        ],
      }),
      blk("h2", "HTTP چیست؟"),
      blk(
        "p",
        "HyperText Transfer Protocol — پروتکل انتقال داده بین Client و Server. Stateless است و به‌خودی‌خود رمزنگاری ندارد؛ نسخه امن آن HTTPS است.",
      ),
      blk("callout", "HTTP بدون رمزنگاری است. برای مسیر امن از HTTPS / TLS استفاده می‌شود.", { callout: "info" }),
      blk("h2", "نسخه‌های HTTP"),
      blk("table", "", {
        headers: ["نسخه", "ویژگی مهم", "وضعیت"],
        rows: [
          ["HTTP/0.9", "فقط GET", "منسوخ"],
          ["HTTP/1.0", "Header و Status Code", "منسوخ"],
          ["HTTP/1.1", "Keep-Alive، Host Header", "هنوز بسیار پرکاربرد"],
          ["HTTP/2", "Multiplexing و فشرده‌سازی Header", "رایج در سایت‌های مدرن"],
          ["HTTP/3", "مبتنی بر QUIC روی UDP", "در حال گسترش"],
        ],
      }),
      blk("callout", "اکثر تست‌ها و ابزارهای پنتست هنوز روی HTTP/1.1 اجرا می‌شوند.", { callout: "tip" }),
      blk("h2", "ساختار پیام"),
      blk("ul", "Request — درخواست از سمت Client"),
      blk("ul", "Response — پاسخ از سمت Server"),
      blk("h2", "URL"),
      blk("code", "http://target.com/user/profile?id=1&name=reza", { lang: "http" }),
      blk("ul", "http:// → پروتکل"),
      blk("ul", "target.com → دامنه"),
      blk("ul", "/user/profile → Path"),
      blk("ul", "?id=1&name=reza → Query String"),
      blk("h2", "Headers"),
      blk("p", "هدرها اطلاعات اضافی درخواست را حمل می‌کنند."),
      blk("table", "", {
        headers: ["دسته", "مثال", "کاربرد در پنتست"],
        rows: [
          ["احراز هویت", "Authorization ، Cookie", "Session Hijacking ، JWT"],
          ["امنیت", "CSP ، X-Frame-Options", "CSP Bypass ، Clickjacking"],
          ["تعامل کاربری", "User-Agent ، Referer", "Fingerprinting ، CSRF"],
          ["کنترل محتوا", "Content-Type ، Content-Length", "Content-Type Confusion"],
        ],
      }),
      blk(
        "code",
        "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...\nCookie: PHPSESSID=123abc; token=eyJhbGciOi...\nContent-Security-Policy: default-src 'self'",
        { lang: "http" },
      ),
      blk("h2", "متدها (CRUD)"),
      blk("table", "", {
        headers: ["Method", "CRUD", "نکته"],
        rows: [
          ["GET", "Read", "Query String ، Cacheable ، History"],
          ["POST", "Create", "Body نامحدود ، مناسب عملیات حساس"],
          ["PUT", "Update کامل", "جایگزینی کل منبع"],
          ["PATCH", "Update جزئی", "فقط فیلدهای ارسالی"],
          ["DELETE", "Delete", "حذف منبع"],
          ["OPTIONS", "کشف", "لیست متدهای مجاز / CORS"],
          ["HEAD", "Read بدون Body", "فقط Header"],
          ["TRACE", "Debug", "خطر XST — معمولاً باید بسته باشد"],
          ["CONNECT", "Tunnel", "Proxy و MITM"],
        ],
      }),
      blk("h3", "GET"),
      blk("code", "GET /user/1?id=1&nt=2 HTTP/1.1\nHost: target.com", { lang: "http" }),
      blk("ul", "داده در Query String است."),
      blk("ul", "محدودیت تقریبی طول URL حدود ۱۰۲۴ کاراکتر."),
      blk("ul", "برای لاگین یا تغییر داده مناسب نیست."),
      blk("h3", "POST"),
      blk(
        "code",
        "POST /user HTTP/1.1\nHost: target.com\nContent-Type: application/x-www-form-urlencoded\n\nname=reza&email=user@example.com",
        { lang: "http" },
      ),
      blk("h3", "PUT در برابر PATCH"),
      blk(
        "p",
        "PUT کل منبع را جایگزین می‌کند؛ اگر فقط name بفرستی بقیه فیلدها ممکن است خالی شوند. PATCH فقط همان فیلد را عوض می‌کند.",
      ),
      blk("h3", "OPTIONS / HEAD / TRACE / CONNECT"),
      blk("code", "curl -X OPTIONS https://example.com -i", { lang: "bash" }),
      blk("callout", "TRACE می‌تواند به Cross-Site Tracing ختم شود و معمولاً باید غیرفعال باشد.", {
        callout: "warning",
      }),
      blk("h2", "Body"),
      blk("p", "فقط در POST و PUT و PATCH. فرمت‌های رایج:"),
      blk("ul", "application/x-www-form-urlencoded"),
      blk("ul", "application/json"),
      blk("ul", "multipart/form-data برای آپلود فایل"),
      blk("h2", "Status Code"),
      blk("table", "", {
        headers: ["دسته", "معنی", "نمونه و نکته پنتست"],
        rows: [
          ["1xx", "Informational", "کمتر دیده می‌شود"],
          ["2xx", "Success", "200 OK"],
          ["3xx", "Redirect", "301 / 302 — Open Redirect"],
          ["4xx", "Client Error", "401 ، 403 ، 404 — پیام خطا"],
          ["5xx", "Server Error", "500 — نشت اطلاعات سرور"],
        ],
      }),
      blk(
        "callout",
        "کدهای 5xx به‌خصوص 500 اغلب مسیر فایل، نسخه نرم‌افزار یا Stack Trace را لو می‌دهند.",
        { callout: "warning" },
      ),
      blk("h2", "HTTPS"),
      blk(
        "p",
        "نسخه امن HTTP با TLS. از کلید عمومی و خصوصی استفاده می‌کند و در مسیر بین Client و Server داده را رمز می‌کند. اگر درست پیاده شده باشد از MITM جلوگیری می‌کند.",
      ),
      blk("p", "برای بررسی کیفیت پیاده‌سازی: ssllabs.com/ssltest"),
    ],
  );

  Object.assign(pages, createSqliRefPages());
  Object.assign(pages, createJsRefPages());
  pages[PAGE.jsTypes] = createJsTypesPage();

  pages[PAGE.xss] = page(
    PAGE.xss,
    "XSS",
    "code",
    ["XSS", "Injection"],
    null,
    [
      blk("h1", "Cross-Site Scripting"),
      blk("p", "صفحه را با مدل‌های Reflected، Stored و DOM گسترش بده. زیرصفحه جدا برای هر مدل بساز."),
      blk("toggle", "سه خانواده", {
        open: true,
        inner: "Reflected — در همان پاسخ.\nStored — ذخیره و نمایش به دیگران.\nDOM — در سمت مرورگر، بدون رفت‌وبرگشت لازم.",
      }),
    ],
  );

  pages[PAGE.authn] = page(
    PAGE.authn,
    "احراز هویت و Session",
    "lock",
    ["Auth", "Session"],
    null,
    [
      blk("h1", "احراز هویت و Session"),
      blk("p", "Cookie، JWT، reset password، MFA و تثبیت نشست را اینجا جمع کن."),
      blk("ul", "Cookie بدون HttpOnly / Secure / SameSite"),
      blk("ul", "JWT در localStorage و XSS"),
      blk("ul", "ثابت ماندن session بعد از عوض کردن رمز"),
    ],
  );

  return {
    pages,
    order: [PAGE.home, PAGE.js, PAGE.http, PAGE.sqli, PAGE.xss, PAGE.authn],
  };
}
