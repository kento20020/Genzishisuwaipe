/*
 * 「広告なしパック」の購入を確認する、Cloudflare Workers の小さな処理です。
 * 公開サイト（public/）と同じアドレスの /api/ だけを受け持ち、それ以外は静的ファイルが返ります。
 *
 *   POST /api/redeem  { session_id }  Stripe に問い合わせて、支払い済みなら「購入済みの印（トークン）」を返す
 *   POST /api/check   { token }       印が本物かどうかを確かめる（毎回の起動時に使う）
 *
 * 必要な設定（Cloudflare の Variables and Secrets に入れる。コードやGitHubには書かない）:
 *   STRIPE_SECRET_KEY  Stripe の秘密キー（sk_test_... / sk_live_...）  ※Secret
 *   PAYMENT_LINK_ID    （任意）この支払いリンクのIDだけを購入として認める（plink_...）
 *   SIGNING_SECRET     （任意）印の署名に使う文字列。なければ STRIPE_SECRET_KEY を使う  ※Secret
 *   STRIPE_API_BASE    （テスト用）Stripe のかわりに問い合わせる先
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{10,250}$/;
const TOKEN = /^v1\.(cs_(?:test|live)_[A-Za-z0-9]{10,250})\.([A-Za-z0-9_-]{43})$/;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmacKey(env, usages) {
  const secret = env.SIGNING_SECRET || env.STRIPE_SECRET_KEY;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

async function makeToken(env, sessionId) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env, ["sign"]), new TextEncoder().encode(`v1:${sessionId}`));
  return `v1.${sessionId}.${b64url(sig)}`;
}

async function verifyToken(env, token) {
  const m = TOKEN.exec(token || "");
  if (!m) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(env, ["verify"]), unb64url(m[2]), new TextEncoder().encode(`v1:${m[1]}`));
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return {};
  }
}

async function redeem(request, env) {
  const { session_id: sessionId } = await readJson(request);
  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) return json({ ok: false, reason: "bad_request" }, 400);

  const base = env.STRIPE_API_BASE || "https://api.stripe.com";
  let res;
  try {
    res = await fetch(`${base}/v1/checkout/sessions/${sessionId}`, {
      headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
    });
  } catch (_) {
    return json({ ok: false, reason: "stripe_unreachable" }, 502);
  }
  if (res.status === 404) return json({ ok: false, reason: "not_found" }, 404);
  if (!res.ok) return json({ ok: false, reason: "stripe_error" }, 502);

  const s = await res.json();
  const paid = s.object === "checkout.session" && s.mode === "payment" && s.status === "complete" && s.payment_status === "paid";
  if (!paid) return json({ ok: false, reason: "not_paid" }, 402);
  if (env.PAYMENT_LINK_ID && s.payment_link !== env.PAYMENT_LINK_ID) return json({ ok: false, reason: "wrong_product" }, 403);

  return json({ ok: true, token: await makeToken(env, s.id) });
}

async function check(request, env) {
  const { token } = await readJson(request);
  return json({ ok: await verifyToken(env, token) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Not found", { status: 404 });

    if (request.method !== "POST") return json({ ok: false, reason: "method_not_allowed" }, 405);
    // 自分のサイトからの呼び出しだけ受けつける
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ ok: false, reason: "forbidden" }, 403);
    if (!env.STRIPE_SECRET_KEY) return json({ ok: false, reason: "not_configured" }, 500);

    if (url.pathname === "/api/redeem") return redeem(request, env);
    if (url.pathname === "/api/check") return check(request, env);
    return json({ ok: false, reason: "not_found" }, 404);
  },
};
