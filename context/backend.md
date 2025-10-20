# Backend & Data Guidelines for LastCall 2.0

- Use **Supabase** for database, authentication, and edge functions.
- Never write serverless logic inside Next.js pages.
- All data interactions must go through `/lib/supabaseClient.ts`.
- Use **TypeScript types** in `/types/` to define DB entities.
- Always handle null or empty responses gracefully.
- Use async/await and include error handling (try/catch).
- Never expose API keys in the client.
- All environment variables must be stored in `.env.local`.

