
## Latest post-schema live check — 2026-08-28 17:31 UTC

After GitHub main was updated through `f030d6e`, the custom domain still returns `404: NOT_FOUND` at `/auth` and `500: FUNCTION_INVOCATION_FAILED` at `/api/trpc/auth.me`. The corrected Vercel configuration is present on GitHub and passes local validation. This confirms the remaining issue is that the Vercel project has not redeployed the corrected main commit, is connected to a different repository/branch, or has a separate dashboard build configuration overriding the repository settings. Live confirmation remains pending until the correct Vercel project deploys `f030d6e`.

## Hobby-compatible deployment check — 2026-08-29 05:11 UTC

After the Hobby cron fix was pushed, `/auth` and `/api/trpc/auth.me` both returned Vercel `404: NOT_FOUND`. The result indicates the custom domain is still not serving the expected repository deployment or the Vercel project has not successfully built/assigned the latest deployment. The repository configuration itself passes local validation and the final code is on GitHub main.
