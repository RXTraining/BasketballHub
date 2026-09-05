/**
 * RX.TRAINING — the link-preview image, at one address that never changes.
 *
 * WHY THIS EXISTS
 * The picture chat apps show when somebody pastes a link has to list the sports we actually coach,
 * and that list lives in Admin — it changes. But an <meta property="og:image"> tag is read by
 * crawlers that do not run JavaScript, so the page cannot pick the image at view time, and the URL
 * in that tag can never change without re-deploying every page that carries it.
 *
 * So the URL is fixed and the *image behind it* is what changes: Admin → "Update link preview
 * card" draws the card from the live sports list and uploads it to R2 under the fixed key
 * brand/og-card.png. This endpoint serves whatever is at that key.
 *
 * If nothing has been published yet — a fresh deploy, or the R2 binding is missing — it falls back
 * to the committed og-card.png so a shared link always has a picture. A preview that 404s is worse
 * than a slightly out-of-date one.
 *
 * Caching is deliberately short. R2 media is served immutable because those objects are write-once
 * under a unique key; this one is written repeatedly under the SAME key, so a year-long cache would
 * pin the old sports list in every CDN edge and the update would appear to do nothing.
 */

const KEY = "brand/og-card.png";

export async function onRequestGet(context) {
  const { env, request } = context;
  const origin = new URL(request.url).origin;

  if (env && env.RX_MEDIA) {
    try {
      const obj = await env.RX_MEDIA.get(KEY);
      if (obj) {
        const h = new Headers();
        obj.writeHttpMetadata(h);
        h.set("content-type", "image/png");
        h.set("etag", obj.httpEtag);
        // long enough that a crawler hitting us repeatedly is cheap, short enough that publishing
        // a new card is visible the same day
        h.set("Cache-Control", "public, max-age=300, s-maxage=300");
        h.set("Access-Control-Allow-Origin", "*");
        return new Response(obj.body, { headers: h });
      }
    } catch (e) {
      // fall through to the committed file rather than failing the preview
    }
  }
  return Response.redirect(origin + "/og-card.png", 302);
}
