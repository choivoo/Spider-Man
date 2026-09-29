# Deploy

## Vercel (recommended)
1. Push the repo to GitHub, **Import Project** in Vercel (framework: Vite — detected from `vercel.json`).
2. Environment variables (Production + Preview): `ANTHROPIC_API_KEY` (required for real replies), optional `CLAUDE_MODEL` (default `claude-sonnet-5-5`), `CLAUDE_EFFORT` (`low`), `TTS_*`, `SUPABASE_*`.
3. Every push to `main` deploys automatically; PRs get preview URLs. `vercel.json` ships `personality/**` with the functions and sets caching/security headers.
Without `ANTHROPIC_API_KEY` the app still runs with the offline demo brain (flagged "demo brain" in the chat header).

## Cloudflare Pages + Functions
Build command `npm run build`, output `dist`. The handlers in `api/*.ts` use the standard `Request → Response` signature; wrap each as a Pages Function (`functions/api/chat.ts` → `export const onRequest = ({ request }) => handler(request)`) and add the same env vars.
`process.cwd()/personality` is used to load prompts — on Workers, inline them at build time (`import x from '../personality/identity.md?raw'`) instead.

## Local
```bash
cp .env.example .env      # add ANTHROPIC_API_KEY
npm install
npm run dev               # http://localhost:5173  (serves /api/* through the same handlers)
```
