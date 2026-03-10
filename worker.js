const DEFAULT_KV_KEY = "banco_prompts_v3";
const MAX_SYNC_PAYLOAD_BYTES = 1024 * 1024;

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

function buildCorsHeaders(request, allowedOrigin) {
  const origin = request.headers.get("Origin") || "";

  // If allowedOrigin is not set, we don't allow any cross-origin requests by default.
  let finalOrigin = "";
  if (allowedOrigin === "*") {
    finalOrigin = "*";
  } else if (allowedOrigin) {
    const allowed = allowedOrigin.split(",").map((o) => o.trim());
    if (allowed.includes(origin)) {
      finalOrigin = origin;
    } else if (allowed.length > 0 && !allowedOrigin.includes(",")) {
      // Fallback to the single allowed origin if it doesn't match and isn't a list
      finalOrigin = allowedOrigin;
    }
  }

  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (finalOrigin) {
    headers["Access-Control-Allow-Origin"] = finalOrigin;
  }

  return headers;
}

function jsonResponse(payload, status, cors) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...SECURITY_HEADERS,
      ...cors,
    },
  });
}

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN;
    const cors = buildCorsHeaders(request, allowedOrigin);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (url.pathname === "/sync") {
      if (!env?.PROMPTBANK_KV) {
        return jsonResponse({ error: "kv_binding_missing" }, 500, cors);
      }

      const token = env.API_TOKEN;
      if (token) {
        const auth = request.headers.get("Authorization") || "";
        if (auth !== `Bearer ${token}`) {
          return jsonResponse({ error: "unauthorized" }, 401, cors);
        }
      }

      const kvKey = env.KV_KEY || DEFAULT_KV_KEY;

      if (request.method === "GET") {
        const data = await env.PROMPTBANK_KV.get(kvKey, "text");
        if (!data) {
          return jsonResponse({ error: "not_found" }, 404, cors);
        }
        return new Response(data, {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
            ...SECURITY_HEADERS,
            ...cors,
          },
        });
      }

      if (request.method === "POST") {
        const contentLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
        if (Number.isFinite(contentLength) && contentLength > MAX_SYNC_PAYLOAD_BYTES) {
          return jsonResponse({ error: "payload_too_large" }, 413, cors);
        }

        const body = await request.text();
        if (body.length > MAX_SYNC_PAYLOAD_BYTES) {
          return jsonResponse({ error: "payload_too_large" }, 413, cors);
        }

        try {
          const parsed = JSON.parse(body);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return jsonResponse({ error: "invalid_payload" }, 400, cors);
          }
          if (!Array.isArray(parsed.prompts)) {
            return jsonResponse({ error: "invalid_prompts" }, 400, cors);
          }
        } catch {
          return jsonResponse({ error: "invalid_json" }, 400, cors);
        }

        await env.PROMPTBANK_KV.put(kvKey, body);
        return jsonResponse({ ok: true }, 200, cors);
      }

      return jsonResponse({ error: "method_not_allowed" }, 405, cors);
    }

    if (env?.ASSETS && typeof env.ASSETS.fetch === "function") {
      return env.ASSETS.fetch(request);
    }

    return new Response("Static assets indisponíveis neste deploy.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", ...SECURITY_HEADERS, ...cors },
    });
  },
};
