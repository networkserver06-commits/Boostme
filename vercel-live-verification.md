
## Post-fix live check — 2026-08-28 17:17 UTC

After GitHub commit `5d50d72` and subsequent `c2c2bd3`, the custom domain still returns `404: NOT_FOUND` for `/auth` and `500: FUNCTION_INVOCATION_FAILED` for `/api/trpc/auth.me`. The API response no longer exposes the original module path in the browser, so Vercel logs are required to confirm whether the function is using the new bundle or failing on a later runtime dependency. The live deployment should not yet be considered healthy.
