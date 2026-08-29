
## Live route check — 2026-08-29 05:53 UTC

The deployed custom domain now serves the Supabase Auth page successfully at `/auth`; the prior Auth 404 is resolved. The direct `/api/trpc/auth.me` request still returns Vercel `404: NOT_FOUND`, so the API serverless route is not yet exposed by the live Vercel project. The frontend deployment and SPA fallback are working, but backend API routing remains a separate unresolved deployment issue.
