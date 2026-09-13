# Pathway AI — Codebase Analysis

Pathway AI is an AI-powered college-planning web app for US high school students. A student
completes a short onboarding questionnaire, has a short chat with an AI counselor that fills in
the gaps (what school they attend, what classes they've taken), and then receives a generated
year-by-year college preparation plan that they can view, print, or email.

This app was built on [Base44](https://base44.com) — a hosted "vibe-coding" platform that
provides the database, auth, LLM access, email, and serverless functions behind a single SDK.
This document describes what the code actually is and how it works. For moving it off Base44,
see [MIGRATION.md](MIGRATION.md).

---

## 1. Executive summary

| Aspect | Reality |
|---|---|
| Type | Client-heavy React SPA. There is essentially **no application backend of our own**. |
| Frontend | React 18 + Vite 6 + Tailwind 3 + shadcn/ui (vendored) + React Router 6 + TanStack Query 5 |
| Backend | Base44 platform: managed DB, auth, LLM gateway, email, Deno serverless functions |
| Own server code | **One** Deno function, 115 lines: [base44/functions/emailPlan/entry.ts](base44/functions/emailPlan/entry.ts) |
| Data model | **One** entity, `StudentProfile` — a single document holding profile + chat + plan |
| App code size | ~3,800 LOC (excl. `src/components/ui`, which is ~4,000 LOC of vendored shadcn/ui) |
| Pages | 5 routed pages + 1 unrouted (`OAuthConsent`) |
| Build output | Static assets in `./dist` |

The architectural headline: **all business logic, including all LLM prompting, runs in the
browser.** The React app calls Base44's LLM gateway directly with the end user's bearer token.
The only thing that runs server-side is sending an email.

---

## 2. Product flow

```
                    ┌──────────────────────────────────────────────┐
                    │  Home  (/)  — marketing page + entry point   │
                    └────────────────────┬─────────────────────────┘
                                         │  reads newest StudentProfile
                     ┌───────────────────┼───────────────────┐
                no profile          profile, no plan      has plan
                     │                   │                   │
                     ▼                   ▼                   ▼
            ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐
            │  /Onboarding   │  │ /AIConversation │  │  /ViewPlan   │
            │  4-step wizard │─▶│  LLM chat loop  │─▶│  tabs, print │
            └────────────────┘  └────────┬────────┘  │  email       │
                 creates profile         │           └──────┬───────┘
                                         ▼                  │
                               ┌───────────────────┐         │ invoke
                               │  /GeneratePlan    │         ▼
                               │  one big LLM call │   emailPlan fn
                               │  → JSON schema    │   (Deno, SES-like)
                               └───────────────────┘
```

Routing is derived from a config object rather than declared inline. [src/pages.config.js](src/pages.config.js)
exports a `PAGES` map; [src/App.jsx](src/App.jsx#L46-L64) turns each key into a route at `/<Key>`
(so the URL is the PascalCase component name, e.g. `/AIConversation`) and mounts `mainPage`
(`Home`) at `/`. [src/utils/index.ts](src/utils/index.ts) is a 3-line `createPageUrl()` helper that
reproduces that convention for links. Navigation between pages is done with
`window.location.href = createPageUrl(...)` — full page reloads, not client-side routing.

### Stage 1 — Onboarding

[src/pages/Onboarding.jsx](src/pages/Onboarding.jsx) is a 4-step wizard over local `useState`
(no `react-hook-form` here despite the dependency). Steps: basic info (grade, GPA) → interests →
goals + budget → extras (activities, test scores). `canProceed()` gates the Continue button per
step. On submit it does a single `StudentProfile.create()` and hard-navigates to the chat.

### Stage 2 — AI conversation

[src/pages/AIConversation.jsx](src/pages/AIConversation.jsx) is the most interesting file. It is a
chat loop where **the entire prompt is rebuilt from scratch on every turn** — there is no
conversation API. Each call passes a large instruction block that embeds the student profile and
the full transcript as text ([AIConversation.jsx:96-125](src/pages/AIConversation.jsx#L96-L125)),
and asks the model to figure out what information is still missing and ask exactly one question.

The LLM's job here is deliberately narrow: find out the student's **high school and district**,
and **which classes they've taken**, so that course recommendations are realistic (the prompt
explicitly warns against telling an Algebra 1 student to take AP Calculus BC). It uses
`add_context_from_internet: true` so the model can look up the school's real course catalog.

Two notable mechanics:

- **Persistence**: after every turn the whole message array is written back via
  `StudentProfile.update(id, { conversation_history })`
  ([AIConversation.jsx:150-156](src/pages/AIConversation.jsx#L150-L156)). Resuming the page
  re-hydrates from that field.
- **Readiness detection is a string match.** Whether the "Generate My Plan" button appears is
  decided by scanning the model's reply for phrases like `"ready to build"` or
  `"everything i need"`, OR by the message count reaching 6
  ([AIConversation.jsx:140-147](src/pages/AIConversation.jsx#L140-L147)). The prompt asks the model
  to emit one of those phrases. This is a brittle contract — a paraphrase breaks it — but the
  message-count fallback keeps the app usable.

### Stage 3 — Plan generation

[src/pages/GeneratePlan.jsx](src/pages/GeneratePlan.jsx) makes one large LLM call that returns
**structured JSON** via `response_json_schema` ([GeneratePlan.jsx:107-170](src/pages/GeneratePlan.jsx#L107-L170)).
The schema is the app's real data contract for a plan:

```
summary                string
yearly_plans[]         { year, grade, courses[], activities[], milestones[] }
summer_programs[]      { name, description, timing, cost }
college_recommendations[] { name, type: reach|match|safety, location,
                            estimated_cost, why_good_fit, notable_programs[] }
immediate_actions[]    { action, deadline, priority: high|medium|low }
test_prep_plan         { recommended_tests[], timeline, target_scores }
```

The prompt branches on grade level: 9th–11th get a multi-year plan, 12th gets a single year
([GeneratePlan.jsx:50-56](src/pages/GeneratePlan.jsx#L50-L56)). It restates the course-sequencing
rules and again relies on web search for the school's catalog. The result is written to
`plan_data` and `plan_generated: true`.

The six-step progress list the user watches ("Looking up your school's course catalog…") is
**purely cosmetic** — a `setTimeout` advances it every 2s independent of actual progress
([GeneratePlan.jsx:40-47](src/pages/GeneratePlan.jsx#L40-L47)). There is one real request behind it.
`handleRegenerate()` nulls out `plan_data` and re-runs.

### Stage 4 — View, print, email

[src/pages/ViewPlan.jsx](src/pages/ViewPlan.jsx) renders `plan_data` into four tabs (Roadmap,
Colleges, Summer, Next Steps) using the presentational components in
[src/components/plan/](src/components/plan/). Two export paths:

- **Print**: builds a full HTML document as a template string and `document.write()`s it into a
  new window, then calls `print()` ([ViewPlan.jsx:53-135](src/pages/ViewPlan.jsx#L53-L135)). Note
  that `jspdf` and `html2canvas` are dependencies but are not used — printing is native.
- **Email**: opens [EmailPlanDialog](src/components/plan/EmailPlanDialog.jsx) (which caches recent
  recipients in `localStorage` and plays a two-tone Web Audio chime on success), then calls
  `base44.functions.invoke('emailPlan', {...})`.

[base44/functions/emailPlan/entry.ts](base44/functions/emailPlan/entry.ts) is the only server-side
code. It's a `Deno.serve` handler that re-authenticates the caller from the request, rebuilds the
plan as inline-styled HTML (a near-duplicate of the print template), and sends it through
`base44.integrations.Core.SendEmail`.

---

## 3. Data model

There is exactly one entity: [base44/entities/StudentProfile.jsonc](base44/entities/StudentProfile.jsonc),
declared as a JSON Schema. Base44 implicitly adds `id`, `created_date`, `updated_date`, and
`created_by`. Only `grade_level` is required.

```
StudentProfile
├─ Onboarding input
│   grade_level 9th|10th|11th|12th   gpa: number
│   interests[]  extracurriculars[]  goals
│   budget_range low|medium|high|no_preference
│   location_preference
│   test_scores { sat, act, psat }
├─ Gathered during the AI chat
│   school_name  district  school_type public|private|charter|homeschool
│   current_classes[]
├─ Conversation
│   conversation_history[] { role, content }
└─ Output / state flags
    plan_data (freeform object — shape defined only by the generation schema)
    plan_generated: bool   onboarding_complete: bool
```

This is a **single-document design**: profile, transcript, and generated plan all live in one
record that grows over the session. There are no relations, no joins, no second table.

`plan_data` is typed as a bare `"type": "object"` with no properties — the platform stores it
opaquely. Its actual shape exists only in the `response_json_schema` literal inside
`GeneratePlan.jsx`, and is read by field name in `ViewPlan.jsx`, the plan components, and the
email function. **Those four places must be kept in sync by hand.**

### Access patterns

The entire app uses four operations, all against `StudentProfile`:

| Operation | Where |
|---|---|
| `list("-created_date", 1)` — newest record | Home, AIConversation, GeneratePlan, ViewPlan |
| `create(data)` | Onboarding |
| `update(id, partial)` | AIConversation (transcript), GeneratePlan (plan) |
| `delete(id)` | Home "Start Over" |

Every read is "give me my newest profile." The app never filters by user — it relies on Base44's
implicit per-user row scoping to make `list()` return only the caller's records. **That implicit
ownership rule is the single most important thing to reproduce when migrating**, because nothing
in this repo states it; the entity file declares no access rules at all.

Note that the `delete` + `create` flow (Start Over) means a user can accumulate multiple rows,
which is why every read is `newest-first, limit 1` rather than a lookup by user.

---

## 4. Platform integration layer

### The SDK client

[src/api/base44Client.js](src/api/base44Client.js) creates the singleton. Its config comes from
[src/lib/app-params.js](src/lib/app-params.js), which resolves each parameter — `app_id`,
`server_url`, `access_token`, `functions_version` — by checking, in order: a URL query parameter
(persisting it to `localStorage`), a Vite env var default (`VITE_BASE44_APP_ID`,
`VITE_BASE44_BACKEND_URL`), then previously stored `localStorage`. So **auth tokens arrive as a
`?access_token=` query param** and are stripped from the URL via `history.replaceState`.

`requiresAuth: false` is set on the client, meaning the SDK won't force a login redirect; pages
check auth themselves (and mostly don't — see §6).

### The full SDK surface in use

This is the complete list of platform capabilities to replace:

| SDK call | Used by | Purpose |
|---|---|---|
| `entities.StudentProfile.{list,create,update,delete}` | all pages | the database |
| `auth.me()` | AuthContext, ViewPlan, PageNotFound | current user (`email`, `role`) |
| `auth.isAuthenticated()` | Home | gate before reads |
| `auth.redirectToLogin(returnTo)` | AuthContext, Home | hosted login |
| `auth.logout(returnTo)` | AuthContext | token cleanup + redirect |
| `integrations.Core.InvokeLLM(...)` | AIConversation, GeneratePlan | **LLM gateway (client-side)** |
| `integrations.Core.SendEmail(...)` | emailPlan function | transactional email |
| `functions.invoke('emailPlan', payload)` | ViewPlan | call the Deno function |
| `appLogs.logUserInApp(pageName)` | NavigationTracker | page-view analytics |
| `/api/apps/.../mcp/{consent-info,authorize-grant}` | OAuthConsent | MCP OAuth consent |

`InvokeLLM` is worth calling out: it takes `{ prompt, model, add_context_from_internet,
response_json_schema }`. Three platform features are bundled into that one call — model routing
(`"gemini_3_flash"`), **web search grounding**, and **schema-constrained JSON output**. All three
are load-bearing. [src/api/integrations.js](src/api/integrations.js) re-exports six more Core
integrations (`SendSMS`, `UploadFile`, `GenerateImage`, `ExtractDataFromUploadedFile`) that are
**not used anywhere** — it's boilerplate.

### Auth

[src/lib/AuthContext.jsx](src/lib/AuthContext.jsx) runs a two-phase check on mount:

1. Fetch the app's **public settings** (`GET /api/apps/public/prod/public-settings/by-id/:appId`)
   using a raw axios client. A `403` with `extra_data.reason` tells the app whether the reason is
   `auth_required` (→ redirect to login) or `user_not_registered` (→ render
   [UserNotRegisteredError](src/components/UserNotRegisteredError.jsx)).
2. If a token exists, call `auth.me()` to populate `user`.

`App.jsx` blocks rendering on a spinner until both settings and auth resolve, then dispatches on
`authError.type`. Auth state is Base44's session, surfaced through this context.

### Builder-only machinery

Three pieces exist to serve the Base44 visual editor, not end users:

- [src/lib/VisualEditAgent.jsx](src/lib/VisualEditAgent.jsx) (~400 LOC) — listens for `postMessage`
  from a parent frame to enter "visual edit mode," draws hover/selection overlays on elements, and
  round-trips Tailwind class edits back to the builder.
- [src/lib/NavigationTracker.jsx](src/lib/NavigationTracker.jsx) — posts `app_changed_url` to the
  parent frame on every route change, and logs page views via `appLogs`.
- [src/main.jsx](src/main.jsx#L12-L19) — forwards Vite HMR events as `sandbox:beforeUpdate` /
  `sandbox:afterUpdate` messages to the parent frame.

All three are dead weight outside the Base44 iframe. Similarly, `vite.config.js` loads
`@base44/vite-plugin`, whose `legacySDKImports` flag (gated on `BASE44_LEGACY_SDK_IMPORTS`)
rewrites old-style `@/entities` imports to the new SDK; this code already uses the new imports.

---

## 5. Repository map

```
base44/                        Platform manifest — deployed by Base44, not bundled
  config.jsonc                 App name + build/serve commands, output dir ./dist
  entities/StudentProfile.jsonc  The one table, as JSON Schema
  functions/emailPlan/entry.ts   The one server function (Deno)

src/
  main.jsx                     React root + HMR→parent-frame bridge
  App.jsx                      Providers (Auth, Query, Router) + config-driven routes
  pages.config.js              PAGES map → routes; mainPage = Home

  pages/
    Home.jsx                   Marketing page; branches on profile/plan state
    Onboarding.jsx             4-step wizard → StudentProfile.create()
    AIConversation.jsx         Prompt-rebuilding chat loop; persists transcript
    GeneratePlan.jsx           Single schema-constrained LLM call → plan_data
    ViewPlan.jsx               Tabbed plan view, print window, email dialog
    OAuthConsent.jsx           MCP OAuth consent screen — NOT in pages.config (unrouted)

  api/
    base44Client.js            SDK singleton
    entities.js                Entity re-exports (stale — see §6)
    integrations.js            Core integration re-exports (mostly unused)

  lib/
    AuthContext.jsx            Two-phase auth/app-settings bootstrap
    app-params.js              URL param → localStorage → env config resolution
    query-client.js            TanStack Query defaults (no refetch on focus, retry 1)
    VisualEditAgent.jsx        Base44 builder overlay (dead outside the iframe)
    NavigationTracker.jsx      Parent-frame URL posts + page-view logging
    PageNotFound.jsx           404, with an admin-only hint
    utils.js                   cn() — clsx + tailwind-merge

  components/
    ui/                        ~50 vendored shadcn/ui primitives (~4,000 LOC)
    onboarding/                ProgressSteps + 4 step forms
    chat/                      ChatInput, ChatMessage
    plan/                      YearlyPlanCard, CollegeCard, SummerProgramsList,
                               ActionItemsList, EmailPlanDialog
    AuthLayout.jsx             Shell for auth screens
    ProtectedRoute.jsx         Route guard — UNUSED and broken (see §6)
    UserNotRegisteredError.jsx Access-denied screen

  utils/index.ts               createPageUrl()
```

`jsconfig.json` enables `checkJs` but **excludes** `src/api`, `src/lib`, and `src/components/ui`
from type checking, and only includes `src/pages/**/*.jsx` plus `src/components/**/*.js` (note:
`.js`, not `.jsx` — so most components aren't actually checked). ESLint is configured with
`react-hooks` and `unused-imports`; `vite.config.js` sets `logLevel: 'error'` to suppress warnings.

Dependency footprint is much larger than what's used: `three`, `react-leaflet`, `recharts`,
`@stripe/*`, `react-quill`, `@hello-pangea/dnd`, `jspdf`, `html2canvas`, `canvas-confetti`,
`moment`, `lodash`, `zod`, and `react-hook-form` are all installed but never imported by app code.
That's the Base44 starter template, not this app's needs.

---

## 6. Observations, defects, and risks

Found while reading the code. None of these block the app's happy path, but they matter for
migration and for a production hardening pass.

**Correctness / dead code**

1. [src/api/entities.js:4](src/api/entities.js#L4) exports `base44.entities.Query` — an entity that
   does not exist. `StudentProfile` is never exported here; pages reach through `base44.entities`
   directly. The file is stale.
2. [src/components/ProtectedRoute.jsx](src/components/ProtectedRoute.jsx) destructures
   `authChecked` and `checkUserAuth` from `useAuth()`, but `AuthContext` provides **neither**.
   Calling `checkUserAuth()` would throw. The component is never mounted, so it's latent.
3. [src/pages/OAuthConsent.jsx](src/pages/OAuthConsent.jsx) is not registered in `pages.config.js`,
   so `/OAuthConsent` renders the 404 page. It also references `base44/mcp/config.json`, which is
   absent from this download. MCP consent is effectively not wired up.
4. [src/pages/GeneratePlan.jsx:21](src/pages/GeneratePlan.jsx#L21) — `useState(null, false)`; the
   second argument is meaningless.
5. `index.html` has the title `Base44 APP`, a Base44 favicon, and a `<link rel="manifest"
   href="/manifest.json">` for a file that doesn't exist in the repo.
6. `plan_generated` and the presence of `plan_data` encode the same fact and are updated
   separately — they can diverge.

**Security**

7. **Unescaped LLM output rendered as HTML, twice.** The print template
   ([ViewPlan.jsx:56-132](src/pages/ViewPlan.jsx#L56-L132)) and the email body
   ([emailPlan/entry.ts:19-100](base44/functions/emailPlan/entry.ts#L19-L100)) interpolate
   model-generated strings straight into HTML via template literals and `document.write`. Model
   output is influenced by user chat input, so this is a user-controlled injection path into a
   document and into outbound email. Both need escaping.
8. **`emailPlan` trusts the client's payload.** The function takes `planData` and `profileData`
   from the request body rather than loading them from the database for the authenticated user
   ([entry.ts:12](base44/functions/emailPlan/entry.ts#L12)). It authenticates the caller but then
   emails whatever content and `recipientEmail` it is handed — usable as an open relay for
   arbitrary HTML to arbitrary addresses by any logged-in user. There is no rate limiting and no
   recipient validation.
9. **LLM calls originate in the browser.** Prompts, the model choice, and the response schema are
   all client-side and therefore client-modifiable; any authenticated user can drive the platform's
   LLM gateway with arbitrary prompts on the app's account. There is no server-side cost control.
10. **Most pages don't check auth.** Only `Home` calls `isAuthenticated()` before reading.
    `AIConversation`, `GeneratePlan`, and `ViewPlan` issue entity reads immediately on mount with
    `requiresAuth: false`, so an anonymous visitor hitting those URLs gets an unhandled API
    rejection rather than a login redirect.
11. **Tokens in URLs and `localStorage`.** `?access_token=` is read from the query string and
    persisted to `localStorage` ([app-params.js:43-48](src/lib/app-params.js#L43-L48)). Tokens can
    leak via referrers, history, and logs, and are reachable by any XSS.
12. **Sensitive data about minors.** Records contain a named high school, district, GPA, test
    scores, and free-text goals for students aged ~14–18. This is the kind of data that attracts
    FERPA and state student-privacy obligations; it is currently governed entirely by the
    platform's defaults.

**Robustness / UX**

13. **No error handling around the LLM calls.** `generatePlan()` and `handleSendMessage()` `await`
    `InvokeLLM` with no `try/catch`. A failure leaves the spinner running forever with no message.
14. **The progress stepper is fake** ([GeneratePlan.jsx:40-47](src/pages/GeneratePlan.jsx#L40-L47)) —
    it finishes on a timer while the real request may still be in flight (or already failed).
15. **Readiness detection by phrase match** ([AIConversation.jsx:140-147](src/pages/AIConversation.jsx#L140-L147))
    breaks if the model paraphrases; only the `length >= 6` fallback saves it.
16. **The whole transcript is rewritten on every turn**, and the full transcript is re-sent in every
    prompt. Cost and latency grow quadratically with conversation length.
17. `window.confirm` guards a destructive delete ([Home.jsx:70](src/pages/Home.jsx#L70)), and the
    delete is not undoable.
18. **Full page reloads for navigation** (`window.location.href`) despite React Router being
    mounted — this discards app state and re-runs the entire auth bootstrap on every transition.
19. `school_name`, `district`, and `current_classes` exist on the entity and are used in the
    generation prompt, but **nothing ever writes them** — the AI gathers that information in chat,
    where it only ever lands inside `conversation_history`. So `GeneratePlan` reports
    `"Not specified"` for the school while separately pasting the transcript that contains it. An
    extraction step is missing.

Item 19 is a genuine product bug worth fixing regardless of hosting: the app's central promise is
course recommendations grounded in the student's real school catalog, and the structured fields
meant to carry that are always empty.

---

## 7. How to run it

```bash
npm install
npm run dev      # vite dev server
npm run build    # → ./dist
npm run lint     # eslint
npm run typecheck
```

As downloaded this **will not function standalone**: the app needs `VITE_BASE44_APP_ID` and
`VITE_BASE44_BACKEND_URL` (there is no `.env` in the repo, and `.env*` is gitignored), plus a
valid Base44 session token, a deployed `StudentProfile` entity, and the deployed `emailPlan`
function. Reads and LLM calls will fail without a live Base44 app behind it.
