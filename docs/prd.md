# OpportunityOS — Product Requirements Document (PoV)

**Find what matters. Prove it's real. Never miss a deadline.**

Oct 16, 2026 · Owner: @Krishna Jaiswal · Status: Draft v1.0 · Team size: 4 · Hackathon deadline: 18 Oct 2026

---

## 1. Executive Summary & Proof of Value

OpportunityOS turns a messy, manual opportunity hunt into one guided workflow: discover live opportunities, prove the user qualifies with evidence, and act before deadlines pass.

**The core insight:** the value is not the links. Job boards already list those. The value is the reasoning layer that explains *why* this specific user qualifies, *cites the evidence* for that conclusion, and tells them *exactly what to do next*. That is the part a student cannot easily do alone across a dozen tabs.

**Proof of Value (the demo in one line):** a B.Tech CSE student fills one profile and, in under a minute, gets a ranked, evidence-backed shortlist across internships, jobs, hackathons and scholarships — replacing hours of visiting sites, re-reading eligibility rules, and tracking deadlines by hand.

**Why it wins:** most projects stop at “we found some links with AI.” OpportunityOS goes one level deeper — it defends every recommendation with a source, a quote, and a match reason — which is exactly what makes it feel like a product, not a demo.

## 2. Problem Statement & Why Now

Students and freshers lose opportunities not because they lack skill, but because the discovery process is broken.

- Opportunities are scattered across company career pages, university portals, hackathon sites and scholarship pages, with no single view.
- Every listing must be opened, read, and manually checked for eligibility and deadlines.
- As a result, students apply to the wrong things, miss deadlines, or give up before finding a real fit.

**Why now:** large language models can now read and reason over messy web pages reliably, and agentic web tools (TinyFish) can fetch and structure live listings on demand. Together they make real-time, *explained* matching possible for the first time at low cost — something that required a manual research team even two years ago.

## 3. Goals & Non-Goals

**Goals (MVP must achieve):**

1. Let a user build a reusable opportunity profile in under 3 minutes.
2. Discover live opportunities across all four types for India + remote-friendly global roles.
3. Produce evidence-backed match explanations — not just a number, but the reason and the proof.
4. Help users save, prioritise, and never miss a deadline.

**Non-Goals (explicitly out of scope for the MVP):** naming these protects your weekend.

- No auto-apply or auto-filling of application forms.
- No AI résumé builder or résumé parsing (optional stretch only).
- No email or push notifications — in-app deadline reminders only.
- No native mobile app — responsive web only.
- No payments, and no employer-side / recruiter portal.

## 4. Success Metrics

**Hackathon “done” criteria (what must be true by the 18th):**

- The full flow runs live: profile → discovery → matches with evidence → action plan.
- At least 10 real opportunities are fetched and structured for the demo profile.
- Every match shows a score, at least one evidence snippet, and at least one gap.
- Cached results let the demo run in under 5 seconds with no live network dependency.

**Product metrics (how we would judge it in the real world):**

| Metric | What it measures | Target |
| --- | --- | --- |
| Time-to-first-shortlist | Speed from sign-up to a usable list | < 60 seconds |
| Match relevance | % of matches the user rates “relevant” | > 70% |
| Applications started | Shortlisted items the user acts on | ≥ 3 per active user |
| Deadline-miss rate | Saved opportunities that expired unactioned | Trending down |

## 5. Target Users & Personas

The primary user is a student or fresher who is ambitious but time-poor and overwhelmed by scattered sources.

| Persona | Who | Primary goal | Biggest pain | What success feels like |
| --- | --- | --- | --- | --- |
| **Aarav (primary)** | 3rd-year B.Tech CSE | Land an internship + join good hackathons | Too many sites, unsure what he qualifies for | A short list he trusts, with deadlines he won't miss |
| **Neha (secondary)** | Final-year, job-hunting | Secure a full-time role before graduation | Generic job boards, no fit signal | Roles matched to her exact skills and eligibility |
| **Rohit (secondary)** | Student seeking higher studies | Find scholarships he qualifies for | Scholarship info is buried and confusing | Clear eligibility proof before he invests time applying |

All three share one job-to-be-done: *“Show me what's worth my time, prove I qualify, and make sure I don't miss it.”*

## 6. User Stories (Jobs To Be Done)

Each story maps to one of the four features, so every build task traces back to a user need.

| # | As a... | I want to... | So that... | Feature |
| --- | --- | --- | --- | --- |
| 1 | student | save my profile once | I don't re-enter details for every search | F1 |
| 2 | student | see current, open opportunities | I'm not relying on stale or expired lists | F2 |
| 3 | student | know *why* I qualify and what's missing | I apply with confidence and fix my gaps | F3 |
| 4 | student | see the evidence behind each match | I can trust the recommendation | F3 |
| 5 | student | shortlist and track deadlines | I never miss an application window | F4 |
| 6 | student | see what to apply to first | I spend my limited time on the best bets | F4 |

## 7. Scope: MVP vs Stretch

**The unified-pipeline principle (the key architecture decision).** All four opportunity types flow through *one* data model and *one* processing pipeline. A type is just a field, plus a couple of type-specific extras. This is why supporting all four is realistic in a weekend — it is not four codebases, it is one pipeline with four sets of search queries.

Unified opportunity model: `type, title, org, eligibility, deadline, location, remote, reward, source_url, evidence[]`. The only type-specific extras are `reward` (stipend / salary / prize / scholarship amount) and a few eligibility nuances.

| Area | MVP (must-have, by the 18th) | Stretch (only if time allows) |
| --- | --- | --- |
| Types | All 4 via unified pipeline; demo 2 deeply | Equal polish on all 4 |
| Profile | Core fields + login, saved to MongoDB | Résumé upload + auto-fill of fields |
| Discovery | TinyFish Search + Fetch, results cached | More sources, scheduled re-crawl, alerts |
| Matching | Rule gate + Gemini reasoning + evidence | Embeddings-based semantic ranking |
| Action plan | Shortlist, status, in-app deadline urgency | Email reminders, calendar (.ics) export |

## 8. Feature 1 — Personal Opportunity Profile

**Purpose:** capture everything the match engine needs, once, and persist it to MongoDB so every future search is instant and personalised.

**Fields:**

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| Name | text | Yes | Display only |
| Email | email | Yes | Login identity |
| Degree | select | Yes | B.Tech, BCA, B.Sc, M.Tech, MBA, Other |
| Branch / major | text | Yes | e.g. CSE, ECE |
| Graduation year | number | Yes | Drives eligibility gate |
| Current year/status | select | Yes | 1st–4th year / graduated / fresher |
| CGPA | number | No | Used only if a listing requires a cutoff |
| Skills | tags | Yes | Free tags, e.g. React, Python, ML |
| Preferred roles | tags | Yes | e.g. SDE intern, Data analyst |
| Experience level | select | Yes | None / projects / internship done |
| Opportunity types wanted | multi-select | Yes | Internship, Job, Hackathon, Scholarship |
| Preferred locations | tags | Yes | Cities; plus an “Open to remote” toggle |
| Availability / start date | date | No | Helps deadline feasibility |
| GitHub / LinkedIn | url | No | Evidence of skills (stretch use) |
| Résumé | file | No | Stretch: parse to pre-fill fields |

**Acceptance criteria:**

- A logged-in user can create, view, edit and save a profile; it persists across sessions.
- Required fields are validated before save; graduation year and types are never empty.
- The saved profile is the single input the match engine reads — no field is re-asked later.

## 9. Feature 2 — Live Opportunity Discovery

**Purpose:** find current, open opportunities from the live web and turn messy pages into clean, structured records.

**Pipeline:**

1. **Build queries** from the profile (type + role + skills + location), e.g. `“B.Tech CSE summer internship React India 2026”`.
2. **TinyFish Search** returns candidate URLs for each query.
3. **TinyFish Fetch / Web Agent** opens the promising pages and extracts structured fields into the unified model.
4. **Normalise & de-duplicate** (same org + title + deadline = one record).
5. **Cache in MongoDB** with a fetch timestamp, so repeat views and the live demo are fast and network-independent.

**Candidate sources by type (India + remote-friendly):**

| Type | Example sources |
| --- | --- |
| Internship | Internshala, LinkedIn, company career pages |
| Full-time job | LinkedIn, Wellfound, company careers |
| Hackathon | Devfolio, Devpost, Unstop, MLH |
| Scholarship | Buddy4Study, government & university portals |

**Acceptance criteria:**

- A discovery run returns ≥ 10 structured opportunities for the demo profile.
- Each record has: title, org, type, eligibility text, deadline, location/remote, source URL, fetch timestamp.
- Records with a passed deadline or unparseable data are flagged, not silently shown.
- Results are cached; re-opening the list does not re-hit the web.

## 10. Feature 3 — Eligibility & Match Engine (the differentiator)

**Purpose:** decide fit, explain it, and back it with evidence. This is the feature judges should remember.

**Stage 1 — Rule gate (cheap, deterministic).** Drop anything the user plainly cannot get, before spending an LLM call:

- Degree / branch eligible?
- Graduation year within the listing's window?
- Location or remote compatible?
- Opportunity type requested by the user?
- Deadline still open?

**Stage 2 — Gemini reasoning (structured JSON out).** For survivors of the gate, Gemini returns: a fit score (0–100), a short “why you qualify” explanation, an **evidence map** (each listing requirement ↔ the matching profile field), and a **gaps** list (missing skills or eligibility uncertainty).

**Scoring weights (eligibility is a hard gate, not a weight):**

| Factor | Weight | Meaning |
| --- | --- | --- |
| Skills match | 40% | Overlap of required vs user's skills |
| Role fit | 25% | Listing role vs preferred roles |
| Deadline feasibility | 20% | Enough time to realistically apply |
| Location / remote fit | 15% | Matches location or remote preference |

**Acceptance criteria:**

- Ineligible opportunities never reach the results list (gate works).
- Every shown match has a score, a one-paragraph reason, ≥ 1 evidence snippet, and ≥ 1 gap (or “no gaps found”).
- Output is valid structured JSON the frontend can render without guessing.
- If Gemini fails or returns malformed JSON, the system retries once, then shows the rule-based score with a “reasoning unavailable” note — it never crashes the flow.

## 11. Feature 4 — Action Plan & Deadline Tracking

**Purpose:** turn matches into action — save, prioritise, track, and never miss a deadline.

**Capabilities:**

- **Shortlist:** save any match to a personal list, stored in MongoDB.
- **Status tracker:** each saved item moves through `Saved → Applying → Applied → Interview → Result`.
- **Deadline view with urgency colours:** red = due in < 3 days, amber = 3–7 days, green = > 7 days, grey = passed.
- **Auto-prioritised shortlist:** sorted by `fit score × deadline urgency`, so the best bets that close soonest rise to the top.

**Prioritisation (simple, explainable):** `priority = fit_score × urgency_multiplier`, where urgency\_multiplier is higher as the deadline nears. This keeps a strong match with a close deadline above a slightly better match that isn't due for weeks.

**Acceptance criteria:**

- A user can save, re-open and update the status of any opportunity across sessions.
- Deadlines display with the correct urgency colour based on today's date.
- The shortlist is sorted by the priority rule and updates when a deadline passes.
- Reminders are in-app only for the MVP (no email), matching our non-goals.

## 12. Data Model (MongoDB)

Four core collections. Keep them simple; add fields only when a feature needs one.

**`users`** — auth + profile in one document (fine for a hackathon).

```json
{
  "_id": "ObjectId",
  "name": "Aarav S",
  "email": "aarav@example.com",
  "authProvider": "google | password",
  "profile": {
    "degree": "B.Tech", "branch": "CSE", "gradYear": 2027,
    "currentStatus": "3rd year", "cgpa": 8.2,
    "skills": ["React", "Python"],
    "preferredRoles": ["SDE intern"],
    "experienceLevel": "projects",
    "types": ["internship", "hackathon"],
    "locations": ["Delhi"], "openToRemote": true
  },
  "createdAt": "ISODate"
}
```

**`opportunities`** — the unified, cached, de-duplicated records.

```json
{
  "_id": "ObjectId",
  "type": "internship",
  "title": "SDE Intern", "org": "Acme",
  "eligibilityText": "B.Tech CSE, 2026-27 batch",
  "deadline": "ISODate",
  "location": "Remote", "remote": true,
  "reward": "₹25,000/month",
  "sourceUrl": "https://...", "fetchedAt": "ISODate",
  "evidenceSnippets": ["Open to final and pre-final year B.Tech"]
}
```

**`matches`** — the engine's output, linked to a user + opportunity.

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId", "opportunityId": "ObjectId",
  "score": 82,
  "reason": "Your React + Python skills match 4 of 5 requirements...",
  "evidenceMap": [{"requirement": "B.Tech CSE", "profileField": "degree/branch"}],
  "gaps": ["No Docker experience listed"],
  "createdAt": "ISODate"
}
```

**`applications`** — saved items + tracking state.

```json
{
  "_id": "ObjectId",
  "userId": "ObjectId", "opportunityId": "ObjectId",
  "status": "Saved | Applying | Applied | Interview | Result",
  "savedAt": "ISODate", "updatedAt": "ISODate"
}
```

## 13. System Architecture & Data Flow

**Components:**

| Layer | Component | Responsibility |
| --- | --- | --- |
| Client | Next.js app | Profile form, results, action-plan board |
| API | Node + Express | Auth, profile CRUD, orchestration |
| Discovery | TinyFish Search + Fetch | Find URLs, extract structured listings |
| Intelligence | Gemini API | Reasoning, scoring, evidence, gaps |
| Data | MongoDB | Users, opportunities, matches, applications |

**Request lifecycle (what happens when a user clicks “Find opportunities”):**

1. The Next.js app sends the user's profile id to `POST /discover`.
2. Express builds search queries from the profile and calls **TinyFish Search**.
3. For promising URLs, Express calls **TinyFish Fetch / Web Agent** to extract structured fields.
4. Records are normalised, de-duplicated, and **cached in `opportunities`** with a timestamp.
5. The **rule gate** filters out ineligible records (no LLM cost).
6. Survivors go to **Gemini**, which returns score + reason + evidence map + gaps as JSON.
7. Results are saved to `matches` and returned to the Next.js app, which renders evidence-backed cards.
8. The user saves items; those write to `applications` for the action plan.

**Design note:** discovery and scoring are separate steps so the demo can run against *cached* opportunities — the live network is never on the critical path during judging.

## 14. API Surface

A small, REST-style set of endpoints. Keep auth simple (JWT in an HTTP-only cookie or header).

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| POST | `/auth/signup` | Create account (email or Google) | No |
| POST | `/auth/login` | Log in, issue token | No |
| GET | `/profile` | Fetch current user's profile | Yes |
| PUT | `/profile` | Create / update profile | Yes |
| POST | `/discover` | Run discovery for the profile, cache results | Yes |
| GET | `/opportunities` | List cached opportunities (filters by type) | Yes |
| POST | `/match` | Run rule gate + Gemini, return matches | Yes |
| POST | `/applications` | Save an opportunity to the shortlist | Yes |
| PATCH | `/applications/:id` | Update status (Saved→Applied…) | Yes |
| GET | `/applications` | List saved items for the action plan | Yes |

**Note:** `/discover` and `/match` can be merged into one call for a smoother demo, but keeping them separate makes caching and debugging easier during the build.

## 15. UX — Screens & Primary Flow

**Core screens (keep it to five):**

1. **Auth** — sign up / log in.
2. **Profile** — the form from Feature 1; shown first for new users.
3. **Results / Matches** — evidence-backed cards: score badge, “why you qualify”, evidence snippet, gaps, deadline, Save button.
4. **Action Plan** — shortlist board with status columns and deadline-urgency colours.
5. **Opportunity detail** — full listing + source link + full evidence map (optional modal).

**Primary flow (the happy path you demo):**

1. Sign up → land on Profile.
2. Fill profile → Save.
3. Click **Find opportunities** → results appear as ranked, evidence-backed cards.
4. Expand a card → see the match reason, the quoted evidence, and the gaps.
5. Save two or three → open **Action Plan** → see them sorted by priority with deadline colours.

**UX principle:** every recommendation must answer “why am I seeing this?” on the card itself. No black boxes — that is the whole pitch.

## 16. Tech Stack

Next.js stack with Supabase for database and authentication, TinyFish for discovery, and Gemini for reasoning.

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | Next.js (React) + Tailwind CSS | Routing, SSR and API routes built in; deploys natively to Vercel |
| State/data | React Query or fetch + hooks | Simple server-state handling |
| Backend | Node.js + Express | Lightweight REST API; or use Next.js API routes to skip a separate server |
| Database | Supabase (PostgreSQL) | Managed relational database for users, opportunities, matches and applications |
| Auth | Supabase Auth | Managed authentication integrated with the Supabase project |
| Discovery | TinyFish Search + Fetch / Web Agent | Live listings → structured data |
| Reasoning | Google Gemini API | Scoring, evidence, gaps as JSON |
| Hosting | Vercel (frontend) + Render/Railway (API) | Free, fast deploys for the demo |

**One-language advantage:** the whole stack is JavaScript/JSON end to end, so your team of four can move between frontend and backend without context-switching languages.

## 17. Non-Functional Requirements

- **Performance:** cached results render in under 2 seconds; a fresh discovery run completes in under \~20 seconds. Never block the UI — show a loading state.
- **Reliability:** the demo path works offline against cached data. Every external call (TinyFish, Gemini) has a timeout and a fallback so one failure never breaks the whole flow.
- **Security:** passwords hashed with bcrypt; API keys only on the server, never in the React bundle; all protected routes require a valid token.
- **Cost control:** rule gate runs before any Gemini call; cache opportunities and matches so you don't re-pay for the same work; cap discovery to a sensible number of pages per run.
- **Data freshness:** every opportunity stores a `fetchedAt` timestamp and shows an “as of” date, so stale data is visible, not hidden.

## 18. Risks & Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| TinyFish rate limits / credits run out | Discovery stops mid-demo | Cache aggressively; pre-fetch demo data the night before |
| Live network fails during judging | Demo breaks | Run the demo against cached opportunities; never fetch live on stage |
| Gemini returns malformed JSON | Match cards won't render | Strict JSON prompt + one retry + rule-based fallback |
| Pages are unparseable / inconsistent | Missing fields | Flag incomplete records; don't show half-empty cards |
| Over-scoping all 4 types equally | Nothing is polished | Build unified pipeline, demo 2 types deeply |
| Team of 4 steps on each other's code | Merge chaos | Clear ownership (next section) + feature branches |
| Eligibility wrongly excludes good matches | Thin results | Keep the rule gate conservative; let Gemini explain edge cases |

## 19. Build Plan & Team Roles (4 people, deadline 18 Oct)

**Role split (clear ownership avoids merge chaos):**

| Dev | Owns | Key deliverables |
| --- | --- | --- |
| **Dev A – Backend & Data** | MongoDB, auth, API skeleton | Schemas, signup/login, profile CRUD, `/applications` |
| **Dev B – Discovery** | TinyFish integration | `/discover`, extraction, caching, de-dupe |
| **Dev C – Match engine** | Gemini + rules | Rule gate, prompt, scoring, evidence JSON |
| **Dev D – Frontend & Demo** | React UI + presentation | All screens, action board, demo script, PoV deck |

**Phased schedule:**

| Phase | When | Goal | Checkpoint |
| --- | --- | --- | --- |
| 0. Setup | Thu night / Fri AM | Repo, MongoDB Atlas, keys, shared data model agreed | Everyone can run the app locally |
| 1. Skeleton | Fri | Auth + profile save; TinyFish returns raw results; static UI | Profile persists; one real listing fetched |
| 2. Core loop | Fri PM – Sat AM | Discovery → cache → rule gate → Gemini → cards | One profile returns evidence-backed matches end to end |
| 3. Action plan | Sat PM | Save, status, deadline colours, prioritisation | Shortlist works and persists |
| 4. Polish + demo | Sat night | Pre-fetch demo data, rehearse, build PoV deck | Full demo runs in < 4 min on cached data |
| 5. Submit | Sun 18 Oct AM | Final deploy, buffer for bugs | Links + deck submitted with time to spare |

**Golden rule:** have an end-to-end (even ugly) flow working by Saturday morning. A complete rough demo beats three polished-but-disconnected features.

## 20. Demo Script (3–4 minutes)

Tell the story in the product's own words: *find → prove → act*.

1. **Hook (20s):** “Students miss opportunities not for lack of skill, but because they're scattered everywhere. OpportunityOS finds them, proves you qualify, and makes sure you never miss a deadline.”
2. **Profile (30s):** fill the pre-built B.Tech CSE profile live — skills, roles, location, types.
3. **Find (40s):** click *Find opportunities*; ranked, evidence-backed cards appear (from cache — fast and safe).
4. **Prove (60s, the money moment):** expand one card. Show the fit score, the “why you qualify” reason, the quoted evidence from the source, and the gaps. Say: *“This is the part a job board can't do.”*
5. **Act (40s):** save two, open the Action Plan, show deadline-urgency colours and priority sorting.
6. **Close (20s):** one line on the unified pipeline (“same engine powers jobs, hackathons and scholarships”) and what's next.

**Tips:** rehearse on cached data, keep one strong match ready to expand, and never fetch live on stage.

## 21. Judging Alignment

Since the exact rubric is unknown, this maps to standard hackathon categories. Adjust once criteria are shared.

| Judging category | How OpportunityOS scores |
| --- | --- |
| Innovation | Evidence-backed reasoning layer, not just link aggregation |
| Technical execution | TinyFish + Gemini + MERN, with rule gate, caching and fallbacks |
| UX / design | Clean 5-screen flow; every match explains itself |
| Impact / viability | Real pain for millions of students; clear path to a product |
| Presentation | Tight *find → prove → act* demo on reliable cached data |

**Your sharpest talking point:** “We don't just find opportunities — we prove you qualify, with the source quoted on screen.”

## 22. Out of Scope & Future Roadmap

Beyond the hackathon, the obvious next steps:

- **Auto-fill applications** via browser agents (the natural extension of discovery).
- **Résumé upload + parsing** to pre-fill the profile and strengthen evidence.
- **Email + calendar reminders** so “never miss a deadline” works even when the user is away.
- **Saved searches & alerts** that notify when new matching opportunities appear.
- **Semantic ranking** with embeddings for finer-grained skill matching.
- **Feedback loop:** learn from which matches users actually apply to, to improve scoring.

## 23. Assumptions & Open Questions

Things to confirm — none block the build, but each sharpens it.

- **Judging criteria** are assumed standard (innovation, execution, UX, impact, presentation). Confirm with organisers and re-weight the demo accordingly.
- **TinyFish limits:** confirm rate limits and credit allowance so discovery can be pre-run safely before the demo.
- **Gemini tier/model:** pick the specific model and confirm the free-tier quota is enough for demo volume.
- **Source list:** the sources named are examples; confirm which ones TinyFish parses cleanly and lock those for the demo.
- **De-duplication rule:** `org + title + deadline` is the proposed key — adjust if duplicates still slip through.
- **Auth method:** email/password is simplest; use Google OAuth only if the team already has it wired.

## 24. Appendix — Gemini Prompt & Evidence Schema

**A. Gemini prompt sketch** (ask for strict JSON, give it the profile and one listing):

```text
SYSTEM: You are an eligibility matcher. Compare the student profile to the
opportunity. Return ONLY valid JSON matching the schema. Do not invent facts;
use only text present in the opportunity. If unsure, say so in gaps.

USER:
Profile: { ...user.profile... }
Opportunity: { ...one opportunity record... }

Return JSON:
{
  "score": 0-100,
  "reason": "2-3 sentences on why they qualify",
  "evidenceMap": [{"requirement": "...", "profileField": "...", "quote": "..."}],
  "gaps": ["..."],
  "eligibilityUncertain": true|false
}
```

**B. Evidence object** (what each match card renders from):

```json
{
  "requirement": "Open to pre-final year B.Tech",
  "profileField": "currentStatus = 3rd year",
  "quote": "Eligible: 2nd and 3rd year B.Tech students",
  "sourceUrl": "https://...",
  "fetchedAt": "2026-10-16"
}
```

**Why this matters:** the `quote` + `sourceUrl` + `fetchedAt` is your “prove it's real” promise made concrete — every claim on screen is traceable to a real page at a real time.
