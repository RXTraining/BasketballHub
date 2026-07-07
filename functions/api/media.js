/**
 * RX.TRAINING — Cloudflare Pages Function for media storage on R2.
 *
 * Routes (all under /api/media):
 *   POST   /api/media      → upload a file to R2. Returns { key, url }.
 *   GET    /api/media?key= → stream a file back (public read, CDN-cached).
 *   DELETE /api/media?key= → remove a file.
 *
 * Bindings / vars configured in the Cloudflare Pages project (see setup guide):
 *   env.RX_MEDIA      → R2 bucket binding
 *   env.UPLOAD_TOKEN  → shared secret required for POST/DELETE (write auth)
 *
 * Uploads are namespaced per client:  media/<customerId>/<uid>-<filename>
 */

const MAX_IMAGE = 8 * 1024 * 1024;    // 8 MB (app compresses photos first)
const MAX_VIDEO = 25 * 1024 * 1024;   // 25 MB
const ALLOWED = [/^image\//, /^video\//];

function cors(resp) {
  resp.headers.set("Access-Control-Allow-Origin", "*");
  resp.headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  resp.headers.set("Access-Control-Allow-Headers", "content-type,x-upload-token,x-file-name,x-customer-id");
  return resp;
}
const json = (obj, status = 200) =>
  cors(new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } }));

function safe(s, fallback) {
  return (s || fallback).toString().replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
function rid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  if (!env.RX_MEDIA) return json({ error: "R2 bucket binding RX_MEDIA is not configured." }, 500);

  // ---- GET: public read (no token) ----
  if (method === "GET") {
    const key = url.searchParams.get("key");
    if (!key) return json({ error: "missing key" }, 400);
    const obj = await env.RX_MEDIA.get(key);
    if (!obj) return json({ error: "not found" }, 404);
    const h = new Headers();
    obj.writeHttpMetadata(h);
    h.set("etag", obj.httpEtag);
    h.set("Cache-Control", "public, max-age=31536000, immutable");
    h.set("Access-Control-Allow-Origin", "*");
    return new Response(obj.body, { headers: h });
  }

  // ---- write operations require the token ----
  const token = request.headers.get("x-upload-token") || url.searchParams.get("token");
  if (!env.UPLOAD_TOKEN || token !== env.UPLOAD_TOKEN) return json({ error: "unauthorized" }, 401);

  if (method === "POST") {
    const ctype = request.headers.get("content-type") || "application/octet-stream";
    if (!ALLOWED.some((re) => re.test(ctype))) return json({ error: "file type not allowed" }, 415);
    const isVideo = ctype.startsWith("video/");
    const body = await request.arrayBuffer();
    if (body.byteLength > (isVideo ? MAX_VIDEO : MAX_IMAGE))
      return json({ error: "file too large" }, 413);

    const customer = safe(request.headers.get("x-customer-id"), "unassigned");
    const name = safe(request.headers.get("x-file-name"), isVideo ? "clip.mp4" : "photo.jpg");
    const key = `media/${customer}/${rid()}-${name}`;

    await env.RX_MEDIA.put(key, body, { httpMetadata: { contentType: ctype } });
    return json({ key, url: `${url.origin}/api/media?key=${encodeURIComponent(key)}` });
  }

  if (method === "DELETE") {
    const key = url.searchParams.get("key");
    if (!key) return json({ error: "missing key" }, 400);
    await env.RX_MEDIA.delete(key);
    return json({ ok: true });
  }

  return json({ error: "method not allowed" }, 405);
}
