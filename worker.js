export default {
  async fetch(request, env) {
    if (!env?.ASSETS || typeof env.ASSETS.fetch !== "function") {
      return new Response(
        "ASSETS binding não encontrado. Execute: wrangler versions deploy --latest && wrangler triggers deploy",
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
      );
    }
    return env.ASSETS.fetch(request);
  },
};
