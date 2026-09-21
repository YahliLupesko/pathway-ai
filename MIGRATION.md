# Pathway AI — Base44 → AWS Migration Plan

Companion to [README.md](README.md), which describes the current system. This document is the
plan to move it onto AWS.

**Scope.** Everything Base44 currently provides: database, authentication, the LLM gateway
(including web-search grounding and schema-constrained output), transactional email, the one
serverless function, static hosting, and the platform's implicit per-user data isolation.

**Headline.** The React app survives largely intact, and there is **no data to migrate** — the
Base44 app has no real users yet, so this is a greenfield build on AWS rather than a migration
with a cutover. The one architectural change that matters: **all LLM prompting moves from the
browser to the server.** Today the client composes prompts and calls the LLM gateway with the end
user's token (README §6, findings 8–9). With open signup, carrying that forward would hand anyone
with the URL an uncapped Gemini budget.

**Timeline: ~4.5 weeks** for one engineer.

---

## Status — updated 2026-09-13

| Phase | State | Notes |
|---|---|---|
| 0 — Discovery & prep | ✅ **Done** | SES production-access **pending AWS review** (only trailing item) |
| 1 — Foundation | ▶ **In progress** | CDK app in `infra/`. **All six stacks deployed to dev & verified; CI (OIDC) live on push-to-main.** Only remaining item: Google IdP (needs OAuth client). |
| 2 — Data API | ⬜ Not started | |
| 3 — LLM services | ⬜ Not started | |
| 4 — Email | ⬜ Not started | SES **DNS/identity already done** in Phase 0; only the Lambda + bounce handling remain |
| 5 — Frontend | ⬜ Not started | |
| 6 — Launch | ⬜ Not started | |

**Confirmed in Phase 0** (details in §3; setup facts also in project memory):
- **Repo published:** `github.com/YahliLupesko/pathway-ai` (push as the `YahliLupesko` account).
- **AWS access:** CLI profile `pathway`, account `044771288438` (IAM user `iam_pathway_ai`), region `us-west-2`.
- **Model — "Flash everywhere":** `gemini-3.5-flash` for both chat *and* plan generation. This supersedes decision #3's wording and the `gemini_3_1_pro` alias currently in `GeneratePlan.jsx:125`.
- **Gemini key:** Secrets Manager `pathway/gemini-api-key` (paid tier). Grounding via `tools:[{google_search:{}}]` confirmed working — billed **per search query** (~2 queries/prompt observed; $14/1k after 5k free prompts/mo). Responses carry `searchEntryPoint.renderedContent` (Google Search Suggestions) that **must be rendered in the UI** per grounding terms — see §7.3 / §9.
- **SES:** domain `pathway-ai.org` **verified** in `us-west-2` — Easy DKIM + custom MAIL FROM `mail.pathway-ai.org` + DMARC `v=DMARC1; p=none; rua=mailto:dmarc@pathway-ai.org`. DNS in Cloudflare (Email Routing enabled; `dmarc@` forwards to owner). Production-access request submitted 2026-09-13; **status PENDING** (responded to AWS's follow-up for use-case detail). Re-check with `aws sesv2 get-account --profile pathway --region us-west-2` for `ProductionAccessEnabled: true`.

**Immediate next step:** start **Phase 1**. One external prerequisite blocks the Cognito Google IdP — create a **Google OAuth 2.0 client** (client ID + secret) in the *same* Google Cloud project as the Gemini key.

---

## 0. Decisions — all settled

Confirmed 2026-09-13. Recorded so they don't get re-opened mid-build.

| # | Decision | Choice | Rejected |
|---|---|---|---|
| 1 | Compute | **Serverless** — Lambda + API Gateway + DynamoDB | ECS Fargate + ALB |
| 2 | Database | **DynamoDB**, single table | Aurora Postgres, S3 objects — §4.3 |
| 3 | LLM | **Gemini 3 Flash via Google's API**, called from Lambda | Bedrock + Claude — §7.6 |
| 4 | Web-search grounding | **Google Search grounding** (native to Gemini) | Building a search tool loop |
| 5 | Identity | **Cognito + Google IdP, open signup** | Domain restriction, invite allowlist |
| 6 | Data migration | **None needed** — no real data — §4.5 | Export/transform/load, freeze cutover |
| 7 | IaC | **AWS CDK (TypeScript)**, single account, dev + prod stacks | Terraform; multi-account Organization |

**Context that shapes the rest of the plan:**

- **Audience: a small private pilot** (friends, one school) with real students. So the cheap
  security fixes stay in scope — output escaping, server-side prompts, rate limits, a deletion
  endpoint, model safety settings. Deferred to wider launch: AWS WAF, a formal retention policy,
  and legal review. See §10.
- **Domain owned, DNS in Cloudflare.** Manual record entry, with one gotcha in §9.4.
- **Feature scope:** email-the-plan **in**; the finding-19 fix **in**; College Scorecard **in**;
  streaming chat **out**. Async plan generation is in regardless — it's forced by the API Gateway
  timeout (§7.4).

Keeping Gemini is the decision that most improves this plan. It means prompts need no re-tuning,
`response_json_schema` maps 1:1 onto Gemini's `responseSchema`, and — most importantly —
`add_context_from_internet: true` maps onto **native Google Search grounding** rather than a
component we'd have to build. Base44 was almost certainly doing exactly this underneath. Bedrock
remains available later at low cost, because every model call sits behind our own Lambda (§7.6).

---

## 1. Target architecture

```
                            ┌──────────────────────────┐
     Cloudflare DNS ───────▶│       CloudFront         │
   pathway.example.com      │   (DNS-only, grey cloud) │
                            └────────────┬─────────────┘
                                         │
                    ┌────────────────────┴────────────────┐
                    │ /*                                  │ /api/*
                    ▼                                     ▼
             ┌────────────┐                      ┌──────────────────┐
             │  S3 (OAC)  │                      │  API Gateway     │
             │  SPA build │                      │  HTTP API        │
             └────────────┘                      │  JWT authorizer  │
                                                 └────────┬─────────┘
                                                          │
                        ┌──────────────┬──────────────────┼───────────────┐
                        ▼              ▼                  ▼               ▼
                 ┌────────────┐ ┌────────────┐   ┌──────────────┐ ┌────────────┐
                 │ profile-api│ │ chat-turn  │   │  plan-start  │ │ email-plan │
                 │   Lambda   │ │   Lambda   │   │    Lambda    │ │   Lambda   │
                 └─────┬──────┘ └──────┬─────┘   └──────┬───────┘ └──────┬─────┘
                       │               │                │ async          │
                       │               │                ▼                │
                       │               │        ┌────────────────┐       │
                       │               │        │  plan-worker   │       │
                       │               │        │ Lambda (15min) │       │
                       │               │        └───┬────────┬───┘       │
                       │               │            │        │           │
                       ▼               ▼            ▼        ▼           ▼
                 ┌──────────┐   ┌──────────────────────┐ ┌─────────┐ ┌────────┐
                 │ DynamoDB │   │  Gemini 3 Flash API  │ │ College │ │ SES v2 │
                 │  single  │   │  + Search grounding  │ │Scorecard│ │        │
                 │  table   │   │  (key: Secrets Mgr)  │ │   API   │ └───┬────┘
                 └──────────┘   └──────────────────────┘ └─────────┘     │
                       ▲                                                 ▼
                 ┌─────┴──────┐        ┌────────────────┐        bounce/complaint
                 │    PITR    │        │    Cognito     │         SNS → Lambda
                 └────────────┘        │ + Google IdP   │
                                       └────────────────┘
```

Everything is served from **one CloudFront distribution**: the SPA from S3, `/api/*` to API
Gateway. Same-origin requests mean **no CORS configuration at all**. Lambdas run **outside any
VPC**, so outbound calls to Google and College Scorecard need no NAT gateway (~$32/mo saved — a
second dividend from choosing DynamoDB over Aurora).

### 1.1 Service mapping

| Base44 capability | AWS replacement | Notes |
|---|---|---|
| `entities.StudentProfile.*` | DynamoDB + `profile-api` Lambda | §4 |
| Implicit per-user row scoping | Partition key from the JWT `sub`, server-side only | §4.2 — **never trust a client-supplied user id** |
| `auth.me()` / `redirectToLogin` / `logout` | Cognito user pool, Hosted UI, OIDC + PKCE | §6 |
| `integrations.Core.InvokeLLM` (free text) | Gemini `generateContent` from Lambda | §7.1 |
| `InvokeLLM` (`response_json_schema`) | Gemini `responseSchema` + zod validation | §7.2 |
| `InvokeLLM` (`add_context_from_internet`) | **Google Search grounding** + College Scorecard | §7.3 |
| `integrations.Core.SendEmail` | SES v2 | §8 |
| `functions.invoke('emailPlan')` | `email-plan` Lambda | §8.2 |
| Deno function runtime | Lambda, Node 22, TypeScript | Trivial rewrite (115 lines) |
| Static hosting + CDN | S3 + CloudFront + OAC | §9.3 |
| `appLogs.logUserInApp` | CloudWatch EMF metric, or drop | §11 |
| LLM credentials | **Secrets Manager** (Gemini API key) | Rotate on a schedule |
| MCP server / `OAuthConsent` | **Drop** | Unrouted and unwired today (README §6, finding 3) |
| `functions_version` param | Drop | Lambda aliases if ever needed |
| Base44 visual editor hooks | **Delete** | `VisualEditAgent`, `NavigationTracker`, HMR bridge |

---

## 2. Phase plan

| Phase | Work | Duration | Gate to exit |
|---|---|---|---|
| **0** | Discovery & prep | **1 day** | SES access requested; Gemini paid tier + model ids confirmed |
| **1** | Foundation: CDK skeleton, CI/CD, DynamoDB, Cognito | 1 week | `cdk deploy` works in dev; a Google account can log in |
| **2** | Data API: `profile-api` + ownership model + tests | 3 days | CRUD parity; cross-user access test passes |
| **3** | LLM: chat turn, plan worker, grounding, Scorecard, facts extraction | 1.5 weeks | Plan validates against schema and cites real courses |
| **4** | Email: SES + `email-plan` + escaping + bounce handling | 3 days | Email delivered, DMARC-aligned, injection-safe |
| **5** | Frontend rewiring + hosting | 1 week | Full flow works end-to-end in staging |
| **6** | Hardening + launch + observation | 3 days | Prod live; quotas verified; Base44 decommissioned |

**Total: ~4.5 weeks.** The original estimate was 6–8 weeks; three of the confirmed decisions cut
it down:

- **No data to migrate** removes an entire phase, plus the export/transform/load runbook, the
  exhaustive verifier, the freeze-window cutover, and claim-on-first-login identity linking.
- **Keeping Gemini** removes the Bedrock access request, prompt re-tuning, the behaviour-drift
  eval set, and — the big one — building web search from scratch.
- **No streaming** removes the Lambda Function URL and a second CloudFront origin.

One long-lead item must be started on **day 1**, because it's outside your control: **SES
production access**. New accounts are sandboxed to verified recipients only, and the request takes
days. Everything else can proceed in parallel.

---

## 3. Phase 0 — Discovery (1 day)

Short, now that there's no data to inventory and no Bedrock to request. Four things:

**1. Pin down the models.** Base44's `"gemini_3_flash"` is a *platform alias*, not a Google model
id — find the real id (e.g. `gemini-3-flash-…`) for the direct API. More importantly:
[GeneratePlan.jsx:104](src/pages/GeneratePlan.jsx#L104) passes **no `model` parameter at all**, so
plan generation currently runs on whatever Base44 defaults to. That prompt is tuned against an
unknown model. Check the Base44 docs or app settings for the default; if you can't determine it,
plan to test plan-generation quality on Flash and on a Pro-tier model and pick.

**2. Get on the paid Gemini tier.** The free AI Studio tier permits Google to use submitted data
for product improvement. This app submits named high schools, GPAs, test scores and free-text
goals belonging to minors, so the free tier is not acceptable even for a pilot. Paid Gemini API,
or Vertex AI if you later want data-residency guarantees and a DPA. Create the key, put it
straight into Secrets Manager, never into a `.env` that could reach the client bundle.

**3. Confirm Search grounding.** Verify `tools: [{googleSearch: {}}]` works on your chosen model
and tier, and check the **per-request grounding price** and free daily allowance — grounding is
billed separately from tokens and is the one place pilot costs could surprise you (§11).

**4. Request SES production access**, and verify the sending domain (§8.1). Do this first thing;
it's the only item with external lead time.

**Also decide, no investigation needed:** region **`us-west-2`** (closest to California users;
ACM certificates for CloudFront must be in `us-east-1` regardless, which CDK handles).

What's *not* in Phase 0 any more: record counts, per-user distributions, runtime type sampling,
the admin-scope export gate, email-domain distribution, and the Bedrock access request. All moot.

---

## 4. Database

### 4.1 What we're building

One entity, four access patterns (README §3). Every read is *"my newest profile."* Pure key-value
with no queries, joins, aggregation, or cross-user access.

### 4.2 DynamoDB single-table design

One table, `pathway-ai-{env}`, on-demand billing, PITR enabled, KMS CMK encryption.

| Item | PK | SK | Purpose |
|---|---|---|---|
| Profile | `USER#<cognito_sub>` | `PROFILE#<createdAt ISO8601>#<ulid>` | the student record |
| Plan job | `USER#<cognito_sub>` | `JOB#<jobId>` | async generation status, TTL 7d |
| Usage counter | `USER#<cognito_sub>` | `QUOTA#<yyyy-mm-dd>` | daily rate limiting, TTL 2d |

The sort-key design reproduces `list("-created_date", 1)` exactly:

```ts
// GET /profile  →  "my newest profile", one request, no scan, no index
const res = await ddb.send(new QueryCommand({
  TableName: TABLE,
  KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
  ExpressionAttributeValues: { ':pk': `USER#${sub}`, ':sk': 'PROFILE#' },
  ScanIndexForward: false,   // newest first, because the SK is time-prefixed
  Limit: 1,
}))
```

**The ownership rule.** `sub` comes from the verified JWT in the Lambda authorizer context and
*nowhere else*. Writes to a specific record carry a condition so a guessed id can't cross a user
boundary:

```ts
ConditionExpression: 'PK = :pk'   // on every UpdateItem / DeleteItem
```

This — plus the fact that no API ever accepts a user identifier as input — is the explicit
replacement for the rule Base44 was enforcing implicitly. It's the highest-consequence code in
the build and gets a dedicated test: *authenticate as user A, attempt to read, update, and delete
user B's record by id; assert 404 on all three.*

**Field naming.** Keep the existing `snake_case` field names (`grade_level`, `plan_data`,
`conversation_history`). Renaming to camelCase would touch every page component for no functional
gain. Change the storage, not the vocabulary.

**Item size.** `plan_data` runs ~10–30 KB, transcripts a few KB, against a 400 KB item limit.
Cap the transcript at the last N turns — which also fixes the quadratic prompt-cost problem
(README §6, finding 16) — and add a CloudWatch alarm at 300 KB so it can't surprise you.

### 4.3 Alternatives considered and rejected

| | **DynamoDB** ✅ | Aurora Serverless v2 | S3 objects |
|---|---|---|---|
| Fit to the four access patterns | Exact | Fine (over-provisioned) | Fine |
| Idle cost | **$0** | ~$40/mo min (0.5 ACU) | **$0** |
| Cold start / VPC | None needed | Lambdas in a VPC, + NAT for Google calls | None needed |
| Atomic partial update (transcript append) | **Native** (`list_append`) | Native | Rewrite whole object |
| Conditional writes / transactions | **Native** | Native | `If-Match` CAS, hand-rolled retries |
| TTL for `JOB#` / `QUOTA#` items | **Native** | Cron job | Lifecycle rules (day granularity) |
| `plan_data` handling | Native nested maps | `JSONB` blob | Native |
| Ad-hoc analytics | Export to S3 + Athena | **`SELECT`** | List + fetch everything |
| Future relational needs | Painful | **Easy** | Painful |
| Item/object size ceiling | **400 KB** | ~1 GB | 5 TB |

**Why not relational.** Nothing in this schema is relational: one entity, zero joins, no
aggregation, no cross-user reads, and a `plan_data` field Postgres would store as a `JSONB` blob
it never queries into. That buys a database engine's operational weight, a VPC in the Lambda path
(and therefore a NAT gateway for the Google API calls), and ~$40/mo idle for no capability the app
uses.

**Why not flat files in S3.** This would largely work — one self-contained document per user,
keyed lookups only. It breaks on writes: the transcript is rewritten on *every* chat turn and
shares a document with `plan_data`, so two tabs, or the plan worker racing a chat turn, silently
clobber each other. The §4.2 ownership condition would become a hand-rolled compare-and-swap
loop. And there's no saving to offset it — DynamoDB on-demand is also zero-idle-cost, ~$1/mo at
pilot volume.

**Revisit if** any of these reach the roadmap: plan history/versioning with queries across
versions, counselor or parent accounts with shared access (many-to-many), or schools and districts
as first-class shared entities rather than free-text per profile. The first two would justify
Postgres; the third belongs in a retrieval corpus, not an RDBMS.

### 4.4 No data migration

The Base44 app has no real users, so there is nothing to export, transform, load, verify, or
reconcile — and no identity mapping problem, since no existing accounts need to keep their data.

Two cheap precautions anyway:

1. **Take one throwaway export** of whatever test records exist, to S3, before decommissioning
   Base44. Costs an hour and means a surprise ("actually my friend made a plan last week") isn't
   unrecoverable.
2. **Enable PITR on the DynamoDB table from day one**, before any real student uses the pilot.
   The first real data will arrive on AWS, not from Base44, and that's the data worth protecting.

Launch is therefore a **DNS change, not a cutover**: point the domain at CloudFront, keep the
Base44 app alive and reachable for a couple of weeks in case you need to demo it, then delete it
and rotate its credentials. No freeze window, no rollback runbook beyond reverting DNS.

---

## 5. Phase 2 — The data API

An HTTP API on API Gateway with a **JWT authorizer** pointed at the Cognito user pool, so token
validation happens before any Lambda runs.

| Method | Path | Replaces | Notes |
|---|---|---|---|
| `GET` | `/api/me` | `auth.me()` | from JWT claims; no DB read |
| `GET` | `/api/profile` | `list("-created_date", 1)` | newest for caller; `404` if none |
| `POST` | `/api/profile` | `create()` | zod-validated body |
| `PATCH` | `/api/profile/{id}` | `update(id, partial)` | ownership condition; partial merge |
| `DELETE` | `/api/profile/{id}` | `delete(id)` | ownership condition |
| `POST` | `/api/chat` | client-side `InvokeLLM` | §7.1 — **prompt lives here, not in the browser** |
| `POST` | `/api/plan` | client-side `InvokeLLM` | §7.4 — returns `202 {jobId}` |
| `GET` | `/api/plan/{jobId}` | — | poll status |
| `POST` | `/api/plan/email` | `functions.invoke('emailPlan')` | §8.2 — body is `{recipientEmail}` **only** |
| `DELETE` | `/api/me` | — | new: account + data deletion (§10) |

Implementation notes:

- **One Lambda per route group**, not a monolith — narrower IAM. `profile-api` gets DynamoDB only;
  only the LLM Lambdas read the Gemini secret; only `email-plan` gets `ses:SendEmail`.
- **Validate every body with zod** (already a dependency). Reject unknown fields.
- **Never accept a user identifier** in a path, query, or body. `sub` comes from the authorizer.
- Structured JSON logs with a request id, and **no PII in logs** — no GPA, school name, transcript,
  or email address.
- Return problem-JSON so the frontend can render real error states, which it currently cannot
  (README §6, finding 13).

---

## 6. Phase 1 — Identity

No existing users, so this is a straightforward setup with no migration or linking logic.

- **Cognito user pool**, `email` as the sign-in alias.
- **Google as the sole federated IdP**, open signup — no domain restriction, no allowlist. Google
  has already verified the address, so Cognito needs no email verification of its own.
- **Hosted UI** with **OIDC Authorization Code + PKCE**, which replaces `redirectToLogin()` and
  `logout()` directly.
- App client: no client secret (public SPA), 15-minute access tokens, refresh-token rotation.
- Frontend: `oidc-client-ts` (small, standards-based) rather than Amplify (much larger dependency
  for what we need here).

**Open signup has a cost consequence.** Anyone who finds the URL can create a profile and spend
your Gemini quota, so the rate limits in §7.5 are load-bearing rather than nice-to-have. They are
the *only* thing standing between a bored visitor and your bill.

`src/lib/app-params.js` is deleted outright — it's the file that reads tokens from query strings
and persists them to `localStorage` (README §6, finding 11).

---

## 7. Phase 3 — LLM services

The core of the build. The prompts themselves are already written and tuned; what's new is that
they run server-side.

### 7.1 Chat turns

`InvokeLLM({prompt, model, add_context_from_internet})` becomes a `chat-turn` Lambda:

1. Check and increment the caller's daily quota (`QUOTA#` item); reject over-limit with `429`.
2. Load the caller's profile from DynamoDB — **the client sends only its new message**.
3. Compose the system prompt server-side: lift the text verbatim from
   [AIConversation.jsx:96-125](src/pages/AIConversation.jsx#L96-L125) into the Lambda, where the
   user can't rewrite it.
4. Call Gemini `generateContent` with Search grounding enabled and both tools attached (§7.3).
5. Persist the new messages plus any extracted facts.
6. Return `{message, readyToGenerate}` as JSON.

Chat turns run ~5–15s, comfortably inside API Gateway's timeout, so no streaming and no Function
URL (decision 7, scope). Keep the existing bouncing-dots indicator.

**Use a real `contents` array.** Today every turn rebuilds one giant single-turn prompt with the
transcript pasted in as text. Gemini takes a proper multi-turn `contents` array — use it. That cuts
token spend, lets the stable system instruction be cached, and removes the quadratic growth in
README §6 finding 16.

**Fix finding 19 here** — the app's actual product bug, and confirmed in scope. The chat gathers
school name, district and current classes, but nothing ever writes them to their structured
fields, so `GeneratePlan` reports `"Not specified"` for the school it just spent six messages
asking about. Attach a function-calling declaration:

```ts
{
  name: 'record_student_facts',
  parameters: { type: 'object', properties: {
    school_name:     { type: 'string' },
    district:        { type: 'string' },
    school_type:     { type: 'string', enum: ['public','private','charter','homeschool'] },
    current_classes: { type: 'array', items: { type: 'string' } },
  }},
}
```

Persist whatever the model emits. ~20 lines, and it's what makes the flagship feature work as
designed.

### 7.2 Structured output

`response_json_schema` maps almost exactly onto Gemini's native structured output:

```ts
const res = await gemini.generateContent({
  model: PLAN_MODEL,
  contents: [{ role: 'user', parts: [{ text: planPrompt }] }],
  config: {
    responseMimeType: 'application/json',
    responseSchema: PLAN_SCHEMA,      // the literal from GeneratePlan.jsx:107-170
  },
})
const plan = PlanSchema.parse(JSON.parse(res.text))   // zod — hard-fail on drift
```

Define the schema **once**, from a zod schema via `zod-to-json-schema`, and share it between the
Lambda, the email template and the frontend types. Today the same shape is hand-maintained in four
places (README §3); this is the moment to collapse that. Retry once on validation failure, feeding
the error back to the model.

One caveat: structured output and Search grounding **cannot always be combined in a single call**
on Gemini — a grounded response wants to return citations and text, not a bare JSON object. Verify
this in Phase 0. If they conflict, split plan generation into two steps inside `plan-worker`:
(a) a grounded research call that gathers the course catalog and college facts as text, then
(b) an ungrounded structured call that turns that research into the plan JSON. This is a better
design anyway — it separates retrieval from formatting and makes the research step cacheable.

### 7.3 Grounding: Search + College Scorecard

`add_context_from_internet: true` becomes native Google Search grounding:

```ts
config: { tools: [{ googleSearch: {} }] }
```

This is the decision that saved the most time in the whole plan — the alternative was building a
search tool loop, an HTML extractor and a retrieval corpus. Two notes: grounding is **billed per
request** on top of tokens (check the free daily allowance in Phase 0), and grounded responses
carry `groundingMetadata` with source URLs. **Surface those URLs in the UI** — for an app whose
whole disclaimer is "verify this on official college websites," showing students the sources it
actually used is close to free and materially more honest.

**College Scorecard for college data** (confirmed in scope). The app currently asks an LLM to
recall tuition figures, locations and program lists for 8–10 colleges, then displays a warning
telling students to go verify all of it. Instead, in `plan-worker`: let the model propose college
*names* with reach/match/safety classification and the `why_good_fit` reasoning, then look each
one up in the free US DOE [College Scorecard API](https://collegescorecard.ed.gov/data/api/) and
overwrite `estimated_cost` and `location` with real figures. Drop any college that can't be
resolved. Roughly a day's work, and it turns the two most consequential numbers on the page from
guesses into data.

### 7.4 Plan generation must be asynchronous

Plan generation with grounding will take 30–120 seconds. **API Gateway's integration timeout is
~29–30 seconds** (raisable for REST APIs only via a quota increase, and not to minutes). Today
this works only because the browser calls the LLM gateway directly, with no gateway in the path.
So:

```
POST /api/plan
  → plan-start: check quota, write JOB#<id> {status:PENDING}, async-invoke worker, 202 {jobId}
  → plan-worker (timeout 900s): grounded research → Scorecard lookups → structured call
      → validate → write plan_data, updating JOB#<id>.stage as it goes
GET /api/plan/{jobId}
  → {status: PENDING|RUNNING|DONE|FAILED, stage, error?}
```

The frontend polls every 2s. This is a small change to
[GeneratePlan.jsx](src/pages/GeneratePlan.jsx) and it **makes the existing UI honest**: the six
cosmetic steps currently driven by a `setTimeout` (README §6, finding 14) become the worker's real
reported stages. The UI was already designed for this — it just wasn't wired to anything. Map the
stages to the existing labels: *Analyzing your profile* → *Looking up your school's course
catalog* (grounded research) → *Researching matching colleges* (Scorecard) → *Creating your
personalized roadmap* (structured call).

A plain async Lambda invoke is right for a single-step job; reach for Step Functions only if
generation later needs per-step retries.

### 7.5 Cost control and safety — load-bearing under open signup

- **Per-user daily quotas** in DynamoDB (`QUOTA#<date>` items, TTL 2 days): ~30 chat turns and
  ~3 plan generations per user per day. Enforced *before* any model call.
- **A global daily circuit breaker.** A single counter that caps total plan generations across all
  users per day and fails closed. Per-user limits don't help if someone scripts 500 Google
  accounts; this does.
- **AWS Budget alert plus Cost Anomaly Detection** from day one. Separately, set a **billing cap
  or budget alert on the Google Cloud project** — AWS budgets can't see Gemini spend, which will be
  your largest variable cost.
- **Gemini `safetySettings`** configured explicitly on every call (harassment, hate, sexually
  explicit, dangerous content). This replaces the Bedrock Guardrails the earlier draft assumed.
  Non-negotiable for a product whose users are 14–18 and whose output is life advice.
- **A short output-sanity check** in `plan-worker`: reject plans with zero colleges, zero yearly
  plans, or a missing summary, and retry once. Cheaper than a student seeing a blank plan.
- **Timeouts and one retry with backoff** on every Google and Scorecard call, and a `FAILED` job
  status with a user-visible message — the current code has no error handling around the LLM calls
  at all (README §6, finding 13).

### 7.6 Keeping the Bedrock door open

Put every model call behind one internal module (`llm.ts`) exposing `generate()` and
`generateStructured()`. Gemini lives behind it today. If cost, latency or data-residency
considerations later favour Bedrock, that's a one-file change plus prompt re-tuning, not a
re-architecture. Don't build an abstraction layer beyond that — a single provider behind a narrow
interface is enough.

---

## 8. Phase 4 — Email

### 8.1 SES setup

Started in Phase 0, since production access has lead time.

1. Verify the sending domain; enable **Easy DKIM** (3 CNAMEs).
2. SPF (`include:amazonses.com`) and **DMARC** records; custom MAIL FROM subdomain for alignment.
3. **Request production access** to leave the sandbox.
4. Configuration set → event destination → SNS → a `ses-events` Lambda that records bounces and
   complaints and honours the suppression list. Not optional: this app lets users type arbitrary
   recipient addresses, and unhandled bounces destroy sending reputation.
5. CloudWatch alarms: bounce rate > 5%, complaint rate > 0.1%.

All DNS records go into Cloudflare by hand — see the §9.4 gotcha.

### 8.2 Rewriting `emailPlan`

A direct port of the Deno function to a Node Lambda, with three defects fixed:

1. **Load the plan server-side.** The current function takes `planData` and `profileData` from the
   request body (README §6, finding 8), making any logged-in user able to send arbitrary HTML to
   arbitrary addresses through your domain — an open relay, and worse under open signup. The new
   request body is `{recipientEmail}` and nothing else; the Lambda reads the plan from DynamoDB for
   the authenticated `sub`.
2. **Escape everything.** Every interpolated value is HTML-escaped. The content is
   model-generated and user-influenced (finding 7).
3. **Validate and rate-limit the recipient**: syntax check, reject role and known disposable
   addresses, check the SES suppression list, cap at ~5 sends/user/day via the `QUOTA#` item.

Also **extract the template.** The email HTML in
[emailPlan/entry.ts:19-100](base44/functions/emailPlan/entry.ts#L19-L100) and the print HTML in
[ViewPlan.jsx:56-132](src/pages/ViewPlan.jsx#L56-L132) are near-duplicates that must be edited in
lockstep. Move both into one `renderPlanHtml(plan, profile)` module shared by the Lambda and the
browser, and add a `text/plain` alternative part while you're there.

---

## 9. Phase 5 — Frontend

### 9.1 Delete

| Path | Why |
|---|---|
| [src/lib/VisualEditAgent.jsx](src/lib/VisualEditAgent.jsx) | Base44 builder overlay; ~400 LOC of dead weight |
| [src/lib/app-params.js](src/lib/app-params.js) | Base44 session plumbing, and the source of finding 11 |
| [src/api/base44Client.js](src/api/base44Client.js) | replaced by `src/api/client.ts` |
| [src/api/entities.js](src/api/entities.js) | stale; exports a nonexistent `Query` entity |
| [src/api/integrations.js](src/api/integrations.js) | six of eight exports unused |
| [src/pages/OAuthConsent.jsx](src/pages/OAuthConsent.jsx) | unrouted, unwired MCP consent (finding 3) |
| `main.jsx` HMR bridge ([L12-19](src/main.jsx#L12-L19)) | posts to a parent frame that won't exist |
| `@base44/vite-plugin` in `vite.config.js` | platform-specific build step |
| `@base44/sdk`, `@base44/vite-plugin` in `package.json` | — |

[NavigationTracker.jsx](src/lib/NavigationTracker.jsx) loses its `postMessage` block; keep the
page-name logic only if you want page-view analytics (§11).

**Prune the unused dependency mass** carried in from the Base44 starter: `three`, `react-leaflet`,
`recharts`, `@stripe/*`, `react-quill`, `@hello-pangea/dnd`, `jspdf`, `html2canvas`,
`canvas-confetti`, `moment`, `lodash`. None are imported by app code (README §5). Largest
bundle-size win available, and it costs nothing.

### 9.2 Rewire

**New `src/api/client.ts`** — a thin `fetch` wrapper that attaches the Cognito ID token, refreshes
on `401`, and throws typed errors. Deliberately mirror the Base44 call shape so page diffs stay
small:

```ts
export const api = {
  me:      ()       => get('/api/me'),
  profile: {
    get:    ()      => get('/api/profile'),          // was list("-created_date", 1)
    create: (d)     => post('/api/profile', d),
    update: (id, d) => patch(`/api/profile/${id}`, d),
    remove: (id)    => del(`/api/profile/${id}`),
  },
  chat:  { send: (message) => post('/api/chat', { message }) },
  plan:  { start: () => post('/api/plan'), status: (id) => get(`/api/plan/${id}`),
           email: (to) => post('/api/plan/email', { recipientEmail: to }) },
}
```

| File | Change |
|---|---|
| [AuthContext.jsx](src/lib/AuthContext.jsx) | Rewrite on Cognito/OIDC. The two-phase "app public settings" dance disappears — it was Base44-specific. Keep the `authError` shape so `App.jsx` and `UserNotRegisteredError` still work |
| [Home.jsx](src/pages/Home.jsx) | `base44.entities.*` → `api.profile.*`; `redirectToLogin` → OIDC sign-in |
| [Onboarding.jsx](src/pages/Onboarding.jsx) | `create()` → `api.profile.create()`; coerce `gpa` to a number at the boundary |
| [AIConversation.jsx](src/pages/AIConversation.jsx) | **Delete both prompt strings** (they move server-side). Call `api.chat.send()`; take `readyToGenerate` from the response instead of phrase-matching (finding 15). Add error handling |
| [GeneratePlan.jsx](src/pages/GeneratePlan.jsx) | **Delete the prompt and the schema literal.** `api.plan.start()` → poll `api.plan.status()`; drive the six-step display from the worker's real stages. Add error handling |
| [ViewPlan.jsx](src/pages/ViewPlan.jsx) | `api.profile.get()`; email → `api.plan.email(to)`; print → shared `renderPlanHtml()` with escaping; show grounding source URLs (§7.3) |
| [ProtectedRoute.jsx](src/components/ProtectedRoute.jsx) | **Fix it** — it destructures `authChecked`/`checkUserAuth`, which `AuthContext` never provided (finding 2) — then mount it on `/AIConversation`, `/GeneratePlan`, `/ViewPlan` (finding 10) |
| [App.jsx](src/App.jsx) / [pages.config.js](src/pages.config.js) | Keep config-driven routing; wrap the three private pages in `ProtectedRoute` |
| all pages | Replace `window.location.href = createPageUrl(...)` with `useNavigate()` — full reloads currently re-run the entire auth bootstrap on every transition (finding 18) |
| [index.html](index.html) | Real title, own favicon, and either add `manifest.json` or drop the dead `<link>` |

### 9.3 Hosting

- Private S3 bucket, CloudFront with **Origin Access Control**.
- SPA fallback: custom error responses map `403`/`404` → `/index.html` with `200`.
- Cache policy: `index.html` → `no-cache`; hashed assets → `max-age=31536000, immutable`.
- Security headers via a response-headers policy: HSTS, `X-Content-Type-Options`,
  `Referrer-Policy: strict-origin-when-cross-origin`, frame-ancestors `none`, and a **CSP** — now
  realistic, since nothing needs to be framed by a builder any more.
- `/api/*` → API Gateway origin on the same distribution.
- Deploy = `aws s3 sync` + CloudFront invalidation of `/index.html`.

### 9.4 Cloudflare DNS — the gotcha

DNS lives in Cloudflare, so ~6 records go in by hand: the ACM validation CNAME, 3 SES DKIM CNAMEs,
an SPF TXT, a DMARC TXT, plus the CloudFront CNAME (Cloudflare's CNAME flattening handles the apex
if you want it there).

**The ACM validation CNAME and the three DKIM CNAMEs must be DNS-only — grey cloud, not
proxied.** If Cloudflare proxies them it returns its own values and validation silently never
completes; you'll sit watching a "pending validation" status with no error anywhere. TXT records
are never proxied, so SPF and DMARC are safe.

For the CloudFront record you have a choice. **DNS-only (grey cloud) is the default here** —
CloudFront terminates TLS, and behaviour matches the architecture as designed. Alternatively,
leaving the proxy **on** puts Cloudflare's free DDoS and bot protection in front of an
open-signup app, which partly substitutes for the AWS WAF deferred in §10. If you do that, set
Cloudflare SSL mode to **Full (strict)** and expect two layers of caching to reason about. Worth
considering precisely because signup is open.

---

## 10. Security and privacy — pilot scope

A pilot with real students still means real minors' academic records: named high school, district,
GPA, test scores, free-text goals, and a full AI conversation.

**In scope now** (all from README §6):

| Finding | Fix | Phase |
|---|---|---|
| 7 — unescaped LLM output in HTML/email | Escape in the shared template module | 4 |
| 8 — `emailPlan` trusts client payload / open relay | Server-side load + recipient validation + rate limit | 4 |
| 9 — browser-side LLM calls | Prompts move into Lambdas; per-user and global quotas | 3 |
| 10 — unauthenticated pages hitting the API | `ProtectedRoute` + JWT authorizer | 5 |
| 11 — tokens in URLs and `localStorage` | OIDC + PKCE; delete `app-params.js` | 1/5 |
| 13 — no error handling around LLM calls | Typed errors + `FAILED` job status + UI states | 3/5 |
| 19 — school/classes never persisted | `record_student_facts` function call | 3 |

Plus: KMS CMK on DynamoDB, S3 and log groups; one least-privilege role per Lambda; **no PII in
logs** (redact `plan_data`, `conversation_history`, `school_name`, `gpa`, email addresses);
`DELETE /api/me` for data + Cognito user deletion; paid Gemini tier so submissions aren't used for
product improvement (§3); Gemini `safetySettings` on every call; CloudTrail on.

**Deferred to wider launch** — but with a clear trigger: **if a school starts distributing this to
students, do the legal review before that happens, not after.** FERPA applies to schools rather
than direct-to-student tools, so the moment a school is in the loop the analysis changes, and
state student-privacy laws (California's SOPIPA among them) come into scope. Also deferred: AWS
WAF (partly covered by the Cloudflare proxy option in §9.4), a formal retention policy with TTL
enforcement, and a published privacy policy. The app currently ships a one-line assurance in the
onboarding footer; even for a pilot, a real privacy page is an hour of work and worth doing before
students outside your family use it.

---

## 11. Observability and cost

**Observability**

- Structured JSON logs, retention set explicitly (30 days at pilot scale).
- Alarms: API 5xx rate, Lambda errors and throttles, Gemini call failures and p99 latency,
  DynamoDB throttles, SES bounce/complaint rates, plan-generation failure rate, **quota-rejection
  rate** (tells you whether limits are biting real users or blocking abuse).
- **X-Ray** across API Gateway → Lambda → DynamoDB/Gemini/Scorecard. Generation is a multi-second,
  multi-hop path; tracing is how you learn whether grounding or the structured call is slow.
- EMF metrics: plans generated, chat turns, tokens per request, grounded requests per day,
  schema-validation failures, cost per plan.
- One dashboard. `appLogs.logUserInApp` becomes a page-view EMF metric, or is dropped.

**Cost estimate** — pilot scale, ~50 students, ~50 plans and ~300 chat turns per month:

| Service | Est. monthly |
|---|---|
| CloudFront + S3 | ~$1 |
| Cognito (free tier) | $0 |
| API Gateway + Lambda | ~$1 |
| DynamoDB on-demand + PITR | ~$1 |
| SES | <$1 |
| Gemini 3 Flash tokens | ~$2–5 |
| **Google Search grounding** (per-request) | **~$5–15** |
| CloudWatch + X-Ray | ~$5 |
| **Total** | **~$15–30/mo** |

Verify Gemini token and grounding prices in Phase 0 rather than trusting these figures — Flash-tier
pricing moves, and grounding is the line item most likely to surprise you, since it's charged per
request and this app makes several grounded calls per plan. Two things worth noting: at this scale
the pilot is *cheap* — roughly the cost of a couple of coffees — and idle cost is near zero, which
matters for an app that advertises itself as free. What could break that is abuse via open signup,
which is exactly what §7.5's quotas and circuit breaker exist to prevent.

---

## 12. Risk register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Structured output + Search grounding can't combine in one Gemini call | Plan generation needs restructuring | **Medium–High** | Verify in Phase 0; two-step research-then-format design in §7.2 — which is better anyway |
| Unknown default model behind current plan-generation prompt | Plan quality regresses vs. Base44 | **Medium** | Phase 0 item 1; A/B Flash vs. Pro on the same prompt before committing |
| Open signup abused for Gemini quota | Surprise bill | **Medium** | Per-user quotas + global circuit breaker + budget alarms on *both* clouds (§7.5); Cloudflare proxy option (§9.4) |
| Grounding per-request cost underestimated | Bill 5–10× the estimate | Medium | Confirm pricing and free allowance in Phase 0; EMF metric on grounded requests/day; alarm |
| Plan generation exceeds API Gateway's ~29s | Feature fails in prod, works locally | **High if unaddressed** | Async job + polling (§7.4) — designed in, not retrofitted |
| SES still sandboxed at launch | Email silently limited to verified recipients | Medium | Request production access on day 1 of Phase 0 |
| Cloudflare proxying breaks ACM/DKIM validation | Silent, confusing multi-hour stall | **Medium** | §9.4 — grey-cloud those four CNAMEs |
| Cross-cloud dependency on Google API | Outage takes out chat and generation | Low | Timeouts, one retry, `FAILED` status with a clear user message; `llm.ts` seam (§7.6) |
| Student PII sent to Google | Privacy exposure | Low if handled | Paid tier or Vertex AI (§3); never the free AI Studio tier |
| Team unfamiliar with CDK | Timeline slips | Medium | Phase 1 is deliberately a thin end-to-end slice first |

Risks removed outright by the confirmed decisions: no admin-scope export blocker, no
identity-mismatch support burden, no model-swap behaviour drift, no web-search build, no DynamoDB
400 KB migration risk, no cutover-window failure.

---

## 13. Checklist

**Phase 0 — Discovery (1 day) — ✅ COMPLETE (2026-09-13)**
- [x] Verify sending domain — `pathway-ai.org` verified (DKIM + MAIL FROM + DMARC)
- [x] Request SES production access — submitted; **status PENDING AWS review** (only open item)
- [x] Resolve `gemini_3_flash` alias to a real Google model id — **`gemini-3.5-flash`**
- [x] Determine default `InvokeLLM` model — moot: code now passes explicit models; **standardized on `gemini-3.5-flash` (Flash everywhere)**
- [x] Create a **paid-tier** Gemini API key → Secrets Manager — **`pathway/gemini-api-key`**
- [x] Confirm Search grounding works; record price — **confirmed**; $14/1k queries after 5k free prompts/mo, ~2 queries/prompt
- [ ] Confirm whether `responseSchema` and `googleSearch` can combine in one call (§7.2) — **STILL OPEN**; verify early in Phase 3 (some docs say search tools can't mix with non-search tools)
- [x] Region `us-west-2` (ACM cert in `us-east-1` via CDK)
- [~] ~~One throwaway export of Base44 test records to S3~~ — **skipped: no data to migrate**

**Phase 1 — Foundation (1 week) — ▶ IN PROGRESS** (CDK app in `infra/`; PR #3)
- [ ] **PREREQ (external):** Google OAuth 2.0 client (ID + secret) in the same GCP project as the Gemini key → feeds the Cognito Google IdP. Set redirect URIs to the Cognito Hosted UI domain.
- [x] Bootstrap CDK (TypeScript) into account `044771288438` / `us-west-2` using profile `pathway`
- [x] CDK app; all six stacks (Data, Auth, Api, Web, Observability, Ci) **deployed to dev**
- [x] GitHub Actions + OIDC role — `ci-stack` deployed; trust scoped to `repo:YahliLupesko/pathway-ai:ref:refs/heads/main`; `AWS_DEPLOY_ROLE_ARN` secret set; `deploy.yml` auto-deploys core stacks on push to `main`
- [x] DynamoDB table: on-demand, **PITR**, CMK, TTL attribute — `pathway-dev` ACTIVE
- [x] Cognito pool + Hosted UI + PKCE app client (open signup) — Google IdP **gated/stubbed** pending OAuth client
- [~] Hello Lambda behind JWT authorizer — deployed; `/health`→200, `/hello`→401 without token. "Google account logs in" blocked on the OAuth client prereq.

_dev resource ids (User Pool, API URL, Hosted UI domain, etc.) are recorded in local session memory, not committed (account-id hygiene for the public repo)._

_Carried-over open question (blocks Phase 3, not Phase 1): confirm `responseSchema` + `googleSearch` can combine in one Gemini call — plan generation relies on both. If they can't, plan-gen needs a two-step (grounded research → schema-constrained synthesis)._

**Phase 2 — Data API (3 days)**
- [ ] `profile-api` Lambda; five routes; zod validation
- [ ] Ownership conditions on every write
- [ ] **Cross-user access test** (A cannot read/update/delete B) — mandatory
- [ ] `QUOTA#` counter helper with TTL

**Phase 3 — LLM (1.5 weeks)**
- [ ] `llm.ts` seam; Gemini client; key from Secrets Manager
- [ ] `chat-turn`: prompts server-side, real `contents` array, `safetySettings`
- [ ] `record_student_facts` function call → **fixes finding 19**
- [ ] `readyToGenerate` returned from the server → retires the phrase match (finding 15)
- [ ] Shared zod plan schema → `responseSchema`; validate + retry once
- [ ] `plan-start` + `plan-worker`; job status; real stage reporting
- [ ] Grounded research step; surface `groundingMetadata` source URLs
- [ ] College Scorecard lookups overwrite `estimated_cost` and `location`
- [ ] Per-user quotas + global circuit breaker + budget alarms on AWS **and** Google
- [ ] Output sanity check (non-empty colleges, yearly plans, summary)

**Phase 4 — Email (3 days)**
- [ ] DKIM + SPF + DMARC + custom MAIL FROM in Cloudflare (grey cloud — §9.4); out of sandbox
- [ ] `email-plan`: server-side load, escaping, recipient validation, rate limit
- [ ] Shared `renderPlanHtml()` for email + print; `text/plain` part
- [ ] Bounce/complaint handler + alarms

**Phase 5 — Frontend (1 week)**
- [ ] Delete Base44 files, plugin, SDK, unused deps
- [ ] `src/api/client.ts`; Cognito `AuthContext` via `oidc-client-ts`
- [ ] Rewire all five pages; add error states
- [ ] Fix and mount `ProtectedRoute`; `useNavigate` throughout
- [ ] S3 + CloudFront + OAC + SPA fallback + CSP; Cloudflare records
- [ ] Full flow green in staging

**Phase 6 — Launch (3 days)**
- [ ] Privacy page published
- [ ] `DELETE /api/me` working
- [ ] Verify quotas and circuit breaker by actually hitting them
- [ ] Point domain at CloudFront; smoke test signup → onboarding → chat → plan → email → print
- [ ] Monitor a week; keep Base44 reachable ~2 weeks, then delete and rotate its credentials
