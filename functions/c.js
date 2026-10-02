/* One coach's page — rxtraining.org/c?k=<slug>
   ------------------------------------------------------------------------------------------
   WHY THIS EXISTS
   A poster is a picture. Nothing drawn into it can be tapped — not in WeChat, not anywhere — so a
   coach's name on a poster needs an address short enough that a parent will actually TYPE it.
   "rxtraining.org/c?k=sabina" is that address; this function turns it into the app link
   (/#coach=sabina), which the app reads on arrival and opens on that coach's bio.

   A query string rather than a dynamic route, for the same reason as /e: a route parameter needs a
   file literally named "[k].js", and square brackets in a filename are the kind of thing a Windows
   git client, a zip tool or a careless copy quietly mangles.

   Deliberately NOT a Supabase lookup. The coach list is small, it already ships inside the app,
   and the app resolves the slug forgivingly (an exact miss falls back to a first-name match, so a
   poster printed before a second Sabina joined still works). Doing it here would mean a second
   copy of that rule, and two copies of a matching rule drift. The only job here is the redirect.   */

const SITE = 'https://rxtraining.org';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

export async function onRequestGet(context){
  const url = new URL(context.request.url);
  /* Letters and digits only, lower-cased, length-capped: whatever is typed off a poster ends up
     inside an href and a JS string, so it is narrowed to something that cannot carry markup. */
  const k = (url.searchParams.get('k') || url.searchParams.get('c') || '')
    .toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,40);

  const appUrl = SITE + '/' + (k ? '#coach=' + k : '#lpCoaches');

  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RX.TRAINING — coach</title>
<meta name="robots" content="noindex">
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#fff;color:#0f1410;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .w{text-align:center;padding:32px}
  h1{font-size:28px;font-weight:900;letter-spacing:-.5px;margin:0 0 10px}
  h1 i{color:#ff8a1a;font-style:normal}
  p{color:#5c6b60;font-size:15px;margin:0 0 18px}
  a{color:#4d8000;font-weight:800}
</style></head>
<body><div class="w">
  <h1>RX<i>.</i>TRAINING</h1>
  <p>Opening the coach's page&hellip;</p>
  <p><a href="${esc(appUrl)}">Tap here if nothing happens</a></p>
</div>
<!-- JavaScript only, deliberately: a <meta http-equiv="refresh"> is followed by link crawlers too,
     which would make every shared link look like it pointed at the app root. -->
<script>location.replace(${JSON.stringify(appUrl)});</script>
</body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' }
  });
}
