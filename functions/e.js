/* Server-rendered preview card for a shared event link — rxtraining.org/e/<eventId>
   ---------------------------------------------------------------------------------
   WHY THIS EXISTS
   WeChat, WhatsApp, iMessage, Facebook, Instagram and the rest fetch a pasted URL with a crawler
   that does NOT run JavaScript, and a "#hash" is never sent to the server at all. So the old
   #e=<id> link could only ever show one generic card for every event.

   This function answers /e/<id> with real HTML carrying that event's Open Graph tags, so the
   preview box shows the title, when and where it is, and the price. A real browser is then sent
   straight into the app's registration form; only the crawler stops at this page.

   It reads the event with the same public anon key the app already ships, so there is nothing new
   to keep secret. Only fields that are already public are emitted.

   The id arrives as a QUERY STRING (/e?i=<id>) rather than a dynamic route (/e/<id>), on purpose:
   a route parameter needs a file literally named "[id].js", and square brackets in a filename are
   the kind of thing a Windows git client, a zip tool or a careless copy quietly mangles. A query
   string reaches the server just as reliably and needs only an ordinary filename.                */

const SUPABASE_URL = 'https://hlqesgnemuquwxetyhaw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhscWVzZ25lbXVxdXd4ZXR5aGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MTM1NDcsImV4cCI6MjA5ODE4OTU0N30.n8xYCIg7eSq-V2dyRPkUDQ8Vdwtgn65LINwZKcV2UjU';
const SITE = 'https://rxtraining.org';
const TZ   = 'America/New_York';

const esc = s => String(s == null ? '' : s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

/* "[en]…[zh]…" multi-language fields: the crawler gets English. */
function plain(v){
  const s = String(v || '');
  if (!/\[[a-z]{2}\]/i.test(s)) return s.trim();
  const m = s.match(/\[en\]([\s\S]*?)(?=\[[a-z]{2}\]|$)/i);
  return (m ? m[1] : s.replace(/\[[a-z]{2}\]/gi,' ')).trim();
}
/* The stored time IS the Boston wall clock, so there is nothing to convert — and converting it
   was wrong: treating "09:00" as UTC and rendering it in Eastern turned a 9am clinic into 5am.
   The DATE is formatted at midday UTC so the weekday can never slip either side of midnight. */
function whenText(date, time){
  if (!date) return 'Date to be confirmed';
  try{
    const day = new Intl.DateTimeFormat('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric'})
      .format(new Date(date + 'T12:00:00Z'));
    if (!time) return day;
    const [h, m] = String(time).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12  = ((h + 11) % 12) + 1;
    return day + ', ' + h12 + ':' + String(m || 0).padStart(2,'0') + ' ' + ampm;
  }catch(e){ return date; }
}

/* MUST match evShortCode() in index.html — the poster prints what that produces and this resolves
   it. FNV-1a, base-31, no O/0 or I/1/L because the whole point is that it gets typed by hand. */
const EVCODE_A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function evShortCode(id){
  let h = 2166136261 >>> 0; const s = String(id || '');
  for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  let out = '';
  for (let i = 0; i < 4; i++){ out = EVCODE_A[h % EVCODE_A.length] + out; h = Math.floor(h / EVCODE_A.length); }
  return out;
}

export async function onRequestGet(context){
  const url = new URL(context.request.url);
  let id = (url.searchParams.get('i') || url.searchParams.get('id') || '')
    .replace(/[^a-z0-9]/gi,'').slice(0,40);
  /* ?c=CODE — the short form printed on a poster for someone typing rather than scanning. Resolved
     by deriving the code for each live event, because the code is computed from the id rather than
     stored. The list is small; if two ever collided the soonest event wins, which is the one a
     poster in someone's hand is overwhelmingly likely to be about. */
  const code = (url.searchParams.get('c') || '').toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,4);
  if (!id && code.length === 4){
    try{
      const r = await fetch(
        SUPABASE_URL + '/rest/v1/events?active=is.true&select=id,date&order=date.asc',
        { headers:{ apikey:SUPABASE_ANON_KEY, Authorization:'Bearer ' + SUPABASE_ANON_KEY } });
      if (r.ok){
        const rows = await r.json();
        const hit = (Array.isArray(rows) ? rows : []).find(e => evShortCode(e.id) === code);
        if (hit) id = String(hit.id).replace(/[^a-z0-9]/gi,'').slice(0,40);
      }
    }catch(e){ /* fall through to the generic card rather than failing the page */ }
  }
  /* Carried through to the app so a poster shared in Chinese opens a Chinese registration form.
     Whitelisted rather than passed along, because this value is reflected into a URL inside the
     page we serve — anything not on this list is simply dropped. */
  const langIn = (url.searchParams.get('l') || '').toLowerCase();
  let lang = ['zh','ko','ja','en'].includes(langIn) ? langIn : '';
  /* The typed short link carries no language — every character on a poster is one more chance the
     reader gives up — so fall back to the browser's own. Somebody typing a Chinese poster's
     address should not land in English when their phone has already said which language they read.
     An explicit ?l= always wins; this only fills the gap. */
  if (!lang){
    const al = (context.request.headers.get('accept-language') || '').toLowerCase();
    if (/^zh|[,;]\s*zh/.test(al)) lang = 'zh';
    else if (/^ko|[,;]\s*ko/.test(al)) lang = 'ko';
    else if (/^ja|[,;]\s*ja/.test(al)) lang = 'ja';
  }
  const appUrl = SITE + '/#e=' + id + (lang && lang !== 'en' ? '&l=' + lang : '');

  let ev = null;
  if (id){
    try{
      const r = await fetch(
        SUPABASE_URL + '/rest/v1/events?id=eq.' + encodeURIComponent(id) +
        '&select=id,title,detail,date,time,location,price,capacity,active',
        { headers:{ apikey:SUPABASE_ANON_KEY, Authorization:'Bearer ' + SUPABASE_ANON_KEY } });
      if (r.ok){ const rows = await r.json(); ev = Array.isArray(rows) && rows[0] ? rows[0] : null; }
    }catch(e){ /* fall through to the generic card — never fail the page */ }
  }

  const live  = ev && ev.active !== false;
  const title = live ? plain(ev.title) : 'RX.TRAINING';
  const bits  = live ? [ whenText(ev.date, ev.time), ev.location || '',
                         (ev.price ? '$' + ev.price + ' per player' : 'Free') ].filter(Boolean) : [];
  const detail = live ? plain(ev.detail) : '';
  const desc  = live
    ? (bits.join(' · ') + (detail ? ' — ' + detail.slice(0,120) : '') + ' · Tap to register').slice(0,300)
    : 'Youth athletic training in Lexington, MA. Tap to see what is coming up.';
  /* A 1200x630 card carrying the wordmark and the slogan, not the bare app icon. It is the first
     thing a stranger sees in a chat, and an anonymous rounded square says nothing about who is
     inviting their child. Every chat app expects this ratio; a square icon gets cropped or shown
     tiny beside the text. */
  // the card Admin last published (falls back to the committed file) — see functions/api/og-card.js
  const img   = SITE + '/api/og-card';

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — RX.TRAINING</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="RX.TRAINING">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(SITE + '/e?i=' + id)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_US">
<link rel="canonical" href="${esc(SITE + '/e?i=' + id)}">
<link rel="image_src" href="${esc(img)}">
<link rel="apple-touch-icon" href="${esc(img)}">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
  background:#f6f8f4;color:#1b2418;padding:24px;text-align:center}
 a{color:#4d8000;font-weight:800}</style>
</head><body>
<div>
  <!-- A REAL <img>, not only the og:image tag. WeChat and QQ do not read Open Graph: when a link is
       shared (rather than pasted as text) they build the card themselves from the page title and
       the first usable image in the document. A text-only page therefore produced a card with no
       picture. link rel="image_src" is the other legacy signal those crawlers still honour. -->
  <img src="${esc(img)}" alt="RX.TRAINING" width="600" height="315"
       style="width:100%;max-width:420px;height:auto;border-radius:12px;margin:0 auto 18px;display:block">
  <h1 style="font-size:20px;margin:0 0 8px">${esc(title)}</h1>
  <p style="margin:0 0 16px;color:#5b6b55">${esc(bits.join(' · '))}</p>
  <p><a href="${esc(appUrl)}">Opening registration… tap here if nothing happens</a></p>
</div>
<!-- The redirect is JavaScript ONLY, deliberately. A <meta http-equiv="refresh"> is followed by
     some preview crawlers before they read anything, so they end up describing the destination
     page instead of this one — which is how a per-event card silently becomes the generic site
     card. Crawlers do not run scripts; real browsers do. -->
<script>location.replace(${JSON.stringify(appUrl)});</script>
</body></html>`;

  return new Response(html, { headers:{
    'content-type':'text/html; charset=utf-8',
    /* Short cache: an event fills up and the card should not keep saying otherwise for long. */
    'cache-control':'public, max-age=300'
  }});
}
