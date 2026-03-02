# Guia completo — Cloudflare Pages + Workers KV para o Promptbank

Este guia te leva do zero até produção para sincronizar o Promptbank com Cloudflare.

Arquitetura final:
- **Cloudflare Pages**: hospeda o app estático (`index.html`).
- **Cloudflare Worker**: API `GET/POST /sync` para leitura e escrita.
- **Workers KV**: armazena o JSON de dados.

---

## Pré-requisitos

- Conta Cloudflare com permissão para **Pages**, **Workers** e **KV**.
- Repositório com o arquivo `index.html` na raiz.
- (Opcional) Node.js + `wrangler` para deploy via CLI.

---

## Passo 1) Criar o namespace do Workers KV

### Opção A — Dashboard (mais simples)
1. Cloudflare Dashboard → **Workers & Pages** → **KV**.
2. Clique em **Create namespace**.
3. Nome sugerido: `PROMPTBANK_KV`.
4. Guarde o `Namespace ID`.

### Opção B — CLI
```bash
npx wrangler kv namespace create PROMPTBANK_KV
```

Guarde o `id` retornado.

---

## Passo 2) Criar o Worker de sincronização

Crie um Worker chamado, por exemplo, `promptbank-sync` e use este código:

```js
export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Segurança por token Bearer
    const auth = request.headers.get("Authorization") || "";
    if (auth !== `Bearer ${env.API_TOKEN}`) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json", ...cors }
      });
    }

    const KV_KEY = "banco_prompts_v3";

    if (path === "/sync" && request.method === "GET") {
      const data = await env.PROMPTBANK_KV.get(KV_KEY, "text");
      return new Response(data || "", {
        status: data ? 200 : 404,
        headers: { "content-type": "application/json", ...cors }
      });
    }

    if (path === "/sync" && request.method === "POST") {
      const body = await request.text();

      // validação mínima
      const parsed = JSON.parse(body);
      if (!parsed || typeof parsed !== "object") {
        return new Response(JSON.stringify({ error: "invalid_payload" }), {
          status: 400,
          headers: { "content-type": "application/json", ...cors }
        });
      }

      await env.PROMPTBANK_KV.put(KV_KEY, body);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json", ...cors }
      });
    }

    return new Response("Not found", { status: 404, headers: cors });
  }
};
```

---

## Passo 3) Configurar bindings e secrets do Worker

### Se usar `wrangler.toml`

```toml
name = "promptbank-sync"
main = "src/index.js"
compatibility_date = "2026-01-01"

[[kv_namespaces]]
binding = "PROMPTBANK_KV"
id = "SEU_KV_NAMESPACE_ID"
```

Defina secrets:
```bash
npx wrangler secret put API_TOKEN
npx wrangler secret put ALLOWED_ORIGIN
```

Valores sugeridos:
- `API_TOKEN`: token forte e único.
- `ALLOWED_ORIGIN`: URL exata do Pages (ex.: `https://promptbank.seudominio.com`).

Deploy:
```bash
npx wrangler deploy
```

### Se usar só Dashboard
- Em **Worker Settings**:
  - Adicione KV Binding `PROMPTBANK_KV` apontando para o namespace criado.
  - Adicione secret `API_TOKEN`.
  - Adicione variable/secret `ALLOWED_ORIGIN` com a URL do Pages.


#### Guia rápido (Dashboard) — Binding `PROMPTBANK_KV`
Depois disso, faça o binding do Workers KV na aba **Bindings** para ativar o sync:
1. Abra **Workers & Pages** → selecione o Worker/API de sync (ex.: `promptbank-sync`).
2. Vá na aba **Bindings**.
3. Clique em **Add** → **KV namespace**.
4. Em **Variable name**, informe exatamente: `PROMPTBANK_KV`.
5. Em **KV namespace**, selecione o namespace criado no Passo 1.
6. Salve e faça um novo deploy do Worker.
7. No app Promptbank, configure a URL `https://SEU-WORKER.workers.dev/sync` + token `API_TOKEN` e teste sincronização.


---

## Passo 4) Publicar o Promptbank no Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → **Pages** → **Create project**.
2. Conecte seu repositório.
3. Como é site estático:
   - Build command: vazio (ou `echo "no build"`)
   - Output directory: `/` (raiz)
4. Garanta que o arquivo `index.html` esteja publicado na raiz do deploy.
5. (Opcional) Configure domínio customizado.

---

## Passo 5) Configurar o sync no Promptbank

No app:
1. Clique em **☁️ Configurar / Sincronizar**.
2. Preencha:
   - **URL Cloudflare**: `https://SEU-WORKER.workers.dev/sync`
   - **Token Cloudflare**: mesmo valor de `API_TOKEN`
3. Salve.
4. Clique em sincronizar para validar.

Fluxo esperado:
- **GET inicial** para verificar versão remota.
- **POST** após salvar local (sync debounced).

---

## Passo 6) Checklist de validação

- [ ] `GET /sync` retorna `404` antes de haver dados.
- [ ] Após primeiro save no app, `POST /sync` retorna `200`.
- [ ] Em novo navegador/dispositivo, app oferece importar remoto quando mais novo.
- [ ] Sem erros de CORS no console.
- [ ] `ALLOWED_ORIGIN` está específico (não `*`) em produção.

---

## Troubleshooting rápido

### 401 unauthorized
- Token no app diferente de `API_TOKEN` do Worker.
- Header `Authorization` não está no formato `Bearer ...`.

### CORS bloqueado
- `ALLOWED_ORIGIN` não bate com domínio real do Pages.
- Faltou permitir `Authorization` em `Access-Control-Allow-Headers`.

### Sempre 404 no GET
- Nunca houve `POST` válido ainda.
- KV binding incorreto (`PROMPTBANK_KV` não aponta para namespace certo).

### POST 500
- Payload inválido (JSON quebrado) ou Worker sem permissão/binding KV.

---

## Boas práticas de produção

- Rotacione `API_TOKEN` periodicamente.
- Restrinja `ALLOWED_ORIGIN` ao domínio do app.
- Considere chave por usuário (`banco_prompts_v3:<userId>`) se houver multiusuário.
- Para histórico/auditoria, avalie **D1** ou **R2** além do KV.


> Nota: para deploy em Cloudflare Pages/Workers Static Assets, o arquivo de entrada deve ser `index.html` na raiz.
