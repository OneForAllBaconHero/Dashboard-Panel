# Studio Management Dashboard (Next.js)

Painel de gerenciamento de membros com sistema de tracking de personagens,
punições e integração com Discord. Convertido da estrutura original
Vite + Express para **Next.js (App Router)**.

## Rodando localmente

**Pré-requisitos:** Node.js 18.18+

1. Instale as dependências:
   ```bash
   npm install
   ```
2. (Opcional) Configure os webhooks do Discord em `.env.local` a partir de
   `.env.example`.
3. Rode o app:
   ```bash
   npm run dev
   ```
4. Acesse `http://localhost:3000`.

## O que mudou na conversão

- **`server.ts` (Express) → `app/api/image-proxy/route.ts`**: o endpoint de
  proxy de imagens virou uma Route Handler nativa do Next.js.
- **`src/App.tsx` → `components/Dashboard.tsx`**: componente client
  (`'use client'`), carregado em `app/page.tsx` via `next/dynamic` com
  `ssr: false`, já que o estado inicial depende de `localStorage`/`window`
  (que não existem durante o SSR).
- **`import.meta.env.VITE_*` → `process.env.NEXT_PUBLIC_*`**: variáveis de
  ambiente usadas no cliente precisam do prefixo `NEXT_PUBLIC_` no Next.js.
- **`src/index.css` → `app/globals.css`**: mantém o Tailwind v4
  (`@import "tailwindcss"` + `@theme`), agora carregado via
  `postcss.config.mjs` com `@tailwindcss/postcss`.
- **Vite/Express removidos**: `vite`, `@vitejs/plugin-react`,
  `@tailwindcss/vite`, `express`, `tsx`, `esbuild` e `dotenv` saíram do
  `package.json`, substituídos por `next`.
- **`@google/genai`**: estava nas dependências originais mas não é usado em
  nenhum lugar do código — removido. Se você precisar dele, reinstale com
  `npm install @google/genai` e use dentro de uma Route Handler (nunca no
  client) para não expor a API key no browser.

## Build de produção

```bash
npm run build
npm run start
```
