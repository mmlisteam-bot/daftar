import { PAGE } from "./ids";
import { markdownToBlocks } from "./parse";
import type { Block, Page } from "./types";

export const JS_TYPES_FLAG = "daftar-js-types-v3";

const JS_TYPES_BODY = `# انواع داده در JavaScript

جاوااسکریپت از نظر نوع، dynamic و weakly typed است: نوع متغیر در زمان اجرا عوض می‌شود و عملگرها اغلب مقدار را بی‌صدا تبدیل می‌کنند. همین تبدیل بی‌صدا منبع XSS، bypass فیلتر، و bugهای منطقی است.

> [!tip] کدها را از چپ به راست بخوان. جدول نوع‌ها را با \`typeof\` در کنسول چک کن — نتیجه گاهی خلاف حدس است.

## هشت نوع اصلی

| نوع | دسته | مثال | \`typeof\` |
| --- | --- | --- | --- |
| String | Primitive | \`"mmli"\` | \`"string"\` |
| Number | Primitive | \`16\` ، \`7.5\` ، \`NaN\` | \`"number"\` |
| BigInt | Primitive | \`10n\` | \`"bigint"\` |
| Boolean | Primitive | \`true\` / \`false\` | \`"boolean"\` |
| Undefined | Primitive | \`let x;\` | \`"undefined"\` |
| Null | Primitive | \`null\` | \`"object"\` (باگ قدیمی) |
| Symbol | Primitive | \`Symbol("id")\` | \`"symbol"\` |
| Object | Reference | \`{}\` ، \`[]\` ، \`function(){}\` | \`"object"\` / \`"function"\` |

\`\`\`javascript
let color = "Yellow";
let length = 16;
let huge = 1234567890123456789012345n;
let ok = true;
const person = { firstName: "John", lastName: "Doe" };
const cars = ["Peykan", "Samand", "Pride"];
const when = new Date("2022-03-25");
let missing;
let empty = null;
\`\`\`

## Primitive در برابر Reference

Primitive با **مقدار** کپی می‌شود. Object با **ارجاع** (همان خانهٔ حافظه).

\`\`\`javascript
let a = 1;
let b = a;
b = 2;          // a هنوز 1 است

const x = { n: 1 };
const y = x;
y.n = 2;        // x.n هم 2 شد
\`\`\`

> [!warning] برای مقایسهٔ object از \`===\` استفاده نکن؛ دو \`{}\` جدا هرگز برابر نیستند مگر همان ارجاع باشند.

## String

متن. داخل \`'\` ، \`"\` یا backtick. طول با \`.length\` (بر حسب UTF-16 code unit).

\`\`\`javascript
const s = "payload";
s[0];                 // "p"
s.toUpperCase();      // "PAYLOAD"
\`xss \${s}\`;           // template literal
"5" + 1;              // "51"  — به‌علاوه اگر یکی رشته باشد، concat است
\`\`\`

## Number

همهٔ عددهای معمولی IEEE-754 double هستند. \`NaN\` و \`Infinity\` هم Numberاند.

\`\`\`javascript
typeof NaN;           // "number"
0.1 + 0.2;            // 0.30000000000000004
Number("12px");       // NaN
parseInt("12px", 10); // 12
isNaN("foo");         // true   (سست)
Number.isNaN("foo");  // false  (سخت)
\`\`\`

## BigInt

برای عدد بزرگ‌تر از \`Number.MAX_SAFE_INTEGER\` (\`2^53 - 1\`). با Number قاطی نمی‌شود.

\`\`\`javascript
const y = BigInt("1234567890123456789012345");
// 1n + 1  → TypeError
\`\`\`

## Boolean

فقط \`true\` و \`false\`. بقیهٔ مقدارها وقتی در \`if\` می‌آیند Truthy یا Falsy می‌شوند — بخش جدا.

## undefined و null

| | معنی | \`typeof\` |
| --- | --- | --- |
| \`undefined\` | هنوز مقدار نگرفته | \`"undefined"\` |
| \`null\` | عمداً خالی | \`"object"\` |

\`\`\`javascript
let x;
x === undefined;          // true
null == undefined;        // true   (سست)
null === undefined;       // false
\`\`\`

> [!danger] \`typeof null === "object"\` یک باگ تاریخی است. برای خالی بودن از \`== null\` (هر دو را می‌گیرد) یا چک جدا استفاده کن.

## Symbol

کلید یکتا برای object. در \`JSON.stringify\` و حلقهٔ \`for...in\` دیده نمی‌شود.

\`\`\`javascript
const secret = Symbol("k");
const o = { visible: 1, [secret]: "hidden" };
JSON.stringify(o);   // {"visible":1}
\`\`\`

## Object، Array، Function، Date

همه زیرمجموعهٔ Objectاند. Array برای لیست، Function برای رفتار، Date برای زمان.

\`\`\`javascript
typeof [];               // "object"
Array.isArray([]);       // true
typeof function () {};   // "function"
typeof new Date();       // "object"
\`\`\`

## typeof و تشخیص نوع

\`\`\`javascript
typeof "a";        // "string"
typeof 1;          // "number"
typeof 1n;         // "bigint"
typeof true;       // "boolean"
typeof undefined;  // "undefined"
typeof null;       // "object"   ← استثنا
typeof {};         // "object"
typeof [];         // "object"
typeof (() => {}); // "function"
typeof Symbol();   // "symbol"
\`\`\`

| سؤال | روش درست |
| --- | --- |
| آرایه است؟ | \`Array.isArray(v)\` |
| null است؟ | \`v === null\` |
| عدد معتبر؟ | \`typeof v === "number" && !Number.isNaN(v)\` |
| ساختهٔ Date؟ | \`v instanceof Date\` |

## تبدیل نوع (Coercion)

جاوااسکریپت در عملگرها نوع را عوض می‌کند.

\`\`\`javascript
"5" + 1;      // "51"
"5" - 1;      // 4
true + 1;     // 2
null + 1;     // 1
undefined + 1;// NaN
[] + [];      // ""
[] + {};      // "[object Object]"
{} + [];      // 0  (بسته به context)
String(10);   // "10"
Number("10"); // 10
Boolean(1);   // true
!!"xss";      // true
\`\`\`

> [!example] فیلترهایی که فقط \`typeof x === "number"\` را چک می‌کنند با \`Number("1 OR 1")\` به \`NaN\` می‌رسند؛ فیلترهایی که \`==\` دارند با \`"1"\` پاس می‌شوند.

## == در برابر ===

| | معنی |
| --- | --- |
| \`===\` | برابر بدون تبدیل نوع |
| \`==\` | اول coercion، بعد مقایسه |
| \`!==\` / \`!=\` | نقیض همان‌ها |

\`\`\`javascript
5 == "5";     // true
5 === "5";    // false
0 == false;   // true
0 === false;  // false
"" == 0;      // true
null == 0;    // false
null == undefined; // true
\`\`\`

همیشه \`===\` بنویس مگر عمداً \`== null\` برای «null یا undefined».

## Truthy و Falsy

Falsyها فقط این‌ها هستند: \`false\` ، \`0\` ، \`-0\` ، \`0n\` ، \`""\` ، \`null\` ، \`undefined\` ، \`NaN\`.

بقیه Truthyاند — از جمله \`"0"\` ، \`"false"\` ، \`[]\` ، \`{}\` ، \`function(){}\`.

\`\`\`javascript
if ([]) console.log("runs");     // آرایهٔ خالی Truthy است
if ("0") console.log("runs");
Boolean("false");                // true
\`\`\`

## عملگرهای منطقی

\`&&\` و \`||\` مقدار را برمی‌گردانند، نه لزوماً Boolean. \`?\` اختیاری، \`??\` فقط null/undefined.

\`\`\`javascript
true && false;     // false
true || false;     // true
!true;             // false

"admin" && "ok";   // "ok"     — آخرین Truthy
"" || "guest";     // "guest"  — اولین Truthy
null ?? "def";     // "def"
0 ?? "def";        // 0        — صفر را نگه می‌دارد
user?.profile?.id; // اگر user خالی باشد throw نمی‌کند
\`\`\`

> [!warning] \`||\` صفر و رشتهٔ خالی را هم «خالی» می‌بیند. برای مقدار پیش‌فرض از \`??\` استفاده کن.

## عملگرهای مقایسه و حسابی

\`\`\`javascript
5 != "5";     // false
5 !== "5";    // true
10 % 3;       // 1
2 ** 3;       // 8

let n = 1;
n += 2;       // 3
n++;          // 3 سپس n=4
++n;          // n=5 سپس 5
\`\`\`

| عملگر | کار |
| --- | --- |
| \`+\` | جمع یا concat |
| \`-\` \`*\` \`/\` \`%\` \`**\` | حسابی (رشته را به عدد تبدیل می‌کنند) |
| \`<\` \`>\` \`<=\` \`>=\` | مقایسه (رشته: ترتیب Unicode) |
| \`??\` | Nullish coalescing |
| \`?.\` | Optional chaining |
| \`...\` | Spread / Rest |

## چرا در پنتست مهم است

- \`innerHTML = user\` اگر \`user\` رشته باشد XSS است؛ اگر عدد باشد معمولاً نه. نوع ورودی مسیر حمله را عوض می‌کند.
- مقایسهٔ \`role == true\` یا \`id == "1"\` با coercion دور زده می‌شود.
- \`JSON.parse\` نوع را از روی متن می‌سازد؛ \`"1"\` در JSON عدد است نه رشته.
- فیلتر WAF که به دنبال \`<script>\` است با concat تکه‌تکه (\`"scr"+"ipt"\`) یا از \`String.fromCharCode\` رد می‌شود — چون نتیجه در runtime رشته می‌شود.
- \`typeof\` برای Array دروغ می‌گوید؛ bypass روی \`typeof param === "object"\` رایج است.

> [!abstract] قانون عملی: ورودی را با \`===\` و \`Array.isArray\` و \`Number.isNaN\` چک کن. \`==\` و \`typeof null\` را در کد هدف به‌عنوان نشانهٔ ضعف بخوان.
`;

function pageOf(id: string, title: string, body: string, extra?: Partial<Page>): Page {
  const blocks: Block[] = markdownToBlocks(body).map((b, i) => ({
    ...b,
    id: `js-types-b-${i + 1}`,
  }));
  return {
    id,
    title,
    icon: "code",
    tags: ["JavaScript", "مرجع"],
    parentId: PAGE.js,
    blocks,
    body,
    createdAt: 1_724_500_200_000,
    updatedAt: 1_724_500_300_000,
    sort: 5,
    starred: true,
    ...extra,
  };
}

export function isOutdatedJsTypes(page: Page | undefined): boolean {
  if (!page) return false;
  if (page.title.trim().toLowerCase() === "java script") return true;
  const text = `${page.title}\n${page.blocks.map((b) => b.content).join("\n")}`;
  return (
    text.includes("انواع داده‌ی کامل JS") ||
    text.includes("عملگرها: && (and) || (or)") ||
    (text.includes('let color = "Yellow"') && text.includes("انواع داده"))
  );
}

export function findStubJsTypes(pages: Record<string, Page>): Page | undefined {
  const byId = pages[PAGE.jsTypes];
  if (isOutdatedJsTypes(byId)) return byId;
  return Object.values(pages).find((p) => isOutdatedJsTypes(p));
}

export function createJsTypesPage(): Page {
  return pageOf(PAGE.jsTypes, "انواع داده و عملگرها", JS_TYPES_BODY);
}

export function applyJsTypes(
  pages: Record<string, Page>,
  order: string[],
  expanded: Record<string, boolean>,
  keepId?: string,
): { pages: Record<string, Page>; order: string[]; expanded: Record<string, boolean> } {
  const base = createJsTypesPage();
  const id = keepId || PAGE.jsTypes;
  const page = { ...base, id };
  const nextPages = { ...pages, [id]: page };
  if (keepId && keepId !== PAGE.jsTypes && nextPages[PAGE.jsTypes]?.title.toLowerCase() === "java script") {
    delete nextPages[PAGE.jsTypes];
  }
  const nextOrder = order.filter((oid) => oid !== id && oid !== PAGE.jsTypes);
  if (!nextOrder.includes(PAGE.js)) {
    const home = nextOrder.indexOf(PAGE.home);
    nextOrder.splice(home >= 0 ? home + 1 : 0, 0, PAGE.js);
  }
  return {
    pages: nextPages,
    order: nextOrder,
    expanded: { ...expanded, [PAGE.js]: true, [id]: true },
  };
}
