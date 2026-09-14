# Claude Code — project guide

Pathway AI: a React app being migrated **off Base44 onto AWS**. This file is auto-loaded each
session (on any machine that clones the repo) and tells you how to resume and operate.

## Resume here
1. **Read [`MIGRATION.md`](MIGRATION.md) → the `## Status` section at the top first.** It is the
   authoritative, live plan + progress tracker (Phases 0–6).
2. As of the last update: **Phase 0 (Discovery & prep) is complete.** Next is **Phase 1 —
   Foundation** (CDK skeleton, CI/CD, DynamoDB, Cognito + Google IdP).
3. Two things to check on resume (both noted in MIGRATION.md): SES production-access review status,
   and creating a **Google OAuth 2.0 client** (the one external prereq for Phase 1's Cognito IdP).
4. Rebuild your working task list from the `## 13. Checklist` in MIGRATION.md if it isn't present.

> Operational specifics that shouldn't live in a public repo (AWS account id, IAM user, the exact
> Secrets Manager secret name) are kept in the local Claude memory on the primary machine, not here.

## Operating rules
- **AWS CLI:** use the project's dedicated profile (`pathway`) and region **`us-west-2`**; always
  pass `--profile pathway` explicitly. If the shell has stale `AWS_ACCESS_KEY_ID/SECRET/SESSION_TOKEN`
  env vars, `unset` them first — env vars override the profile.
- **Shell is zsh:** unquoted `$VAR` does **not** word-split. Put CLI flags inline, not in a variable.
- **Git/GitHub:** push using the account that owns the repo (`YahliLupesko`). Changes go through a
  **PR reviewed by @lupesko before merge** — don't push straight to `main`.
- **LLM:** model **`gemini-3.5-flash`** for both chat and plan generation ("Flash everywhere").
  The Gemini API key lives in **AWS Secrets Manager** — never in `.env`, the client bundle, or the
  repo. Grounding uses the `google_search` tool; the response's `searchEntryPoint` (Google Search
  Suggestions) **must be rendered in the UI** per Google's grounding terms.
- **Email/SES:** sending domain `pathway-ai.org`, verified in `us-west-2` (DKIM + custom MAIL FROM
  `mail.pathway-ai.org` + DMARC). DNS is in Cloudflare — records must be **DNS-only (grey cloud)**;
  Cloudflare appends the zone, so enter short record names.

## Setting up a new machine (no secrets are stored in this repo)
1. Clone the repo; `npm install`.
2. Install the AWS CLI and configure the `pathway` profile with your own AWS credentials
   (`aws configure --profile pathway`, region `us-west-2`). Credentials are never committed.
3. `gh auth login` as the `YahliLupesko` account.
4. Ensure the Gemini API key exists in Secrets Manager for the target account (create it if this is
   a fresh account); reference it by the name recorded in local memory.
5. Read `MIGRATION.md` `## Status` and continue from the current phase.
