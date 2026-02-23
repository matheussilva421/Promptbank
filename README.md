# 📚 Promptbank — Banco de Prompts

> Gerenciador visual de prompts para IA, com categorias, filtros, tags e sincronização com Google Drive. Tudo em um único arquivo HTML — sem servidor, sem dependências externas.

---

## ✨ Funcionalidades

- **Categorias e subcategorias** personalizadas (Análise por Eixo, Informação Técnica, Casos Especiais, etc.)
- **Busca global e lateral** por título, texto, tags e metadados
- **Filtros** por Formato, Status, IA utilizada e Tags
- **Cards de prompt** com cópia rápida, edição e duplicação
- **Editor modal** completo com campos: título, texto, categoria, subcategoria, formato, status, IA, tags, quando usar, quando não usar, saída esperada e nota interna
- **Drawer de detalhe** com todos os metadados do prompt
- **Exportar / Importar** em JSON (com suporte a migração de versão anterior v2 → v3)
- **Sincronização com Google Drive** via OAuth 2.0 (salva `banco_prompts.json` no Drive)
- **Tema claro / escuro** com alternância por botão
- **100% offline** — funciona localmente via `localStorage`
- **Atalhos de teclado**: `Esc` para fechar, `Ctrl+Enter` para salvar, `Ctrl+N` para novo prompt

---

## 🏗️ Tecnologias

| Tecnologia | Uso |
|---|---|
| HTML5 / CSS3 | Estrutura e estilos (sem framework CSS) |
| JavaScript (Vanilla) | Toda a lógica da aplicação |
| Google Identity Services | Autenticação OAuth 2.0 para Drive |
| Google Drive API v3 | Sincronização de dados na nuvem |
| localStorage | Persistência local dos prompts |
| Google Fonts (Geist Mono, Syne, DM Sans) | Tipografia |

---

## 🚀 Como usar

### Uso local (sem Drive)
1. Faça o download do arquivo `banco_prompts_v5-3.html`
2. Abra diretamente no navegador
3. Seus prompts são salvos automaticamente no `localStorage` do navegador

### Uso com Google Drive (sincronização na nuvem)
1. Acesse [console.cloud.google.com](https://console.cloud.google.com) e crie um projeto
2. Vá em **APIs & Services → Library** e ative a **Google Drive API**
3. Vá em **Credentials → Create → OAuth 2.0 Client ID → Web Application**
4. Em **Authorized JavaScript origins**, adicione a URL onde o arquivo está hospedado
5. Em **OAuth consent screen → Test users**, adicione o seu e-mail
6. Copie o **Client ID** gerado
7. No app, clique no ícone do Drive (barra lateral esquerda) e cole o Client ID

> Os dados são salvos como `banco_prompts.json` no Google Drive do usuário.

---

## 📂 Estrutura do projeto

```
Promptbank/
├── banco_prompts_v5-3.html   # Aplicação completa (single-file)
├── README.md                  # Documentação do projeto
└── .gitignore                 # Arquivos ignorados pelo Git
```

---

## 🗂️ Estrutura dos dados (JSON)

Os prompts são armazenados no formato abaixo:

```json
{
  "version": 3,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-06-01T12:00:00.000Z",
  "prompts": [
    {
      "id": "abc123",
      "title": "Análise Eixo 1",
      "text": "Texto do prompt...",
      "categoria": "analise",
      "subcategoria": "eixo1",
      "formato": "compacto",
      "status": "homologado",
      "ai": "gpt",
      "tags": ["eixo1", "triagem"],
      "quandoUsar": "Primeira leitura do processo",
      "naoUsarQuando": "Processo já analisado",
      "saidaEsperada": "3 parágrafos técnicos",
      "note": "Nota interna",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-06-01T12:00:00.000Z"
    }
  ]
}
```

---

## 🎨 Temas e aparência

A aplicação suporta **tema escuro** (padrão) e **tema claro**, com variáveis CSS customizadas (`--bg0`, `--t1`, `--blue`, etc.) para fácil personalização.

---

## ⌨️ Atalhos de teclado

| Atalho | Ação |
|---|---|
| `Esc` | Fechar modal/drawer aberto |
| `Ctrl + Enter` | Salvar prompt no editor |
| `Ctrl + N` | Abrir editor de novo prompt |

---

## 📦 Exportar e Importar

- **Exportar**: clique no ícone de dados (dock esquerda) → *Exportar JSON* — gera `banco-prompts.json`
- **Importar**: clique em *Importar JSON* e selecione um arquivo. Suporta migração automática do formato v2 para v3.

---

## 📄 Licença

Este projeto é de uso pessoal/interno. Sinta-se livre para adaptar conforme necessidade.
