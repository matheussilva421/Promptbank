# Cloudflare Pages + Workers KV (sincronização do Promptbank)

Este guia mostra uma arquitetura simples:

- **Cloudflare Pages**: hospeda o arquivo HTML estático do Promptbank.
- **Cloudflare Worker**: expõe API HTTP para ler/gravar os dados.
- **Workers KV**: guarda o JSON (`banco_prompts_v3`).

## 1) Criar o KV

```bash
npx wrangler kv namespace create PROMPTBANK_KV
```

Copie o `id` retornado.

## 2) Criar o Worker

Crie um projeto Worker e use o código abaixo em `src/index.js`:

```js
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Defina no dashboard/secret do Worker:
    // API_TOKEN=seu-token-forte
    const auth = request.headers.get("Authorization") || "";
    if (auth !== `Bearer ${env.API_TOKEN}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json", ...cors }
      });
    }

    if (path === "/sync" && request.method === "GET") {
      const data = await env.PROMPTBANK_KV.get("banco_prompts_v3", "text");
      return new Response(data || "", {
        status: data ? 200 : 404,
        headers: { "content-type": "application/json", ...cors }
      });
    }

    if (path === "/sync" && request.method === "POST") {
      const body = await request.text();
      // validação mínima
      JSON.parse(body);

      await env.PROMPTBANK_KV.put("banco_prompts_v3", body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json", ...cors }
      });
    }

    return new Response("Not found", { status: 404, headers: cors });
  }
};
```

### wrangler.toml (exemplo)

```toml
name = "promptbank-sync"
main = "src/index.js"
compatibility_date = "2026-01-01"

[[kv_namespaces]]
binding = "PROMPTBANK_KV"
id = "SEU_KV_NAMESPACE_ID"
```

Publique:

```bash
npx wrangler secret put API_TOKEN
npx wrangler deploy
```

## 3) Publicar o Promptbank no Pages

- Conecte este repositório no Cloudflare Pages.
- Como é arquivo estático, use build simples (ou sem build) e publique `banco_prompts_v5 (3).html`.
- Defina domínio final (ex.: `promptbank.seudominio.com`).

## 4) Integrar no front-end

No Promptbank, adicione configuração para:

- `CF_SYNC_URL` (URL do Worker, ex.: `https://promptbank-sync.seu-subdominio.workers.dev/sync`)
- `CF_SYNC_TOKEN` (token Bearer)

Fluxo de sincronização:

1. **Pull inicial**: `GET /sync` ao abrir app.
2. Se remoto estiver mais novo, perguntar ao usuário se quer importar.
3. **Push** após salvar local: `POST /sync` com JSON completo.

## 5) Segurança recomendada

- Trocar `Access-Control-Allow-Origin` por domínio exato do Pages.
- Rotacionar `API_TOKEN` periodicamente.
- Se quiser multiusuário, use uma chave por usuário (`banco_prompts_v3:<userId>`).

## 6) Observações

- KV é excelente para JSON pequeno/médio e leitura global.
- Para histórico/versionamento mais robusto, considere D1 ou R2.
