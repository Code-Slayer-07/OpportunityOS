# OpportunityOS: Pitch Outline (10 slides, about 5 minutes + demo)

Judging categories: **Innovation**, **Technical execution**, **UX**, **Impact**, **Presentation**. Each slide is tagged with the categories it earns.

---

### 1. Title: "Find what matters. Prove it's real. Never miss a deadline."  `Presentation`
- Logo, tagline, team name, one-line description: *"Evidence-backed opportunity matching for students."*
- **Notes:** 10 seconds. Say the tagline slowly; the rest of the talk is those three clauses in order (Find, Prove, Act).

### 2. The problem  `Impact`
- Opportunities are scattered across career pages, college portals, hackathon sites and scholarship pages.
- Each listing must be opened, read, and checked by hand for eligibility and deadlines.
- Result: students apply to the wrong things, miss deadlines, or give up.
- Visual: a screenshot of 12 browser tabs.
- **Notes:** Make it personal. The loss is not lack of skill; it is lack of a process. Do not cite statistics we have not measured.

### 3. Why now  `Innovation`
- LLMs can read messy pages and reason over them reliably.
- Agentic web tools (TinyFish) fetch and structure live listings on demand.
- Together they make real-time, *explained* matching possible at low cost, something that needed a research team two years ago.
- **Notes:** The point is the pairing: an agent that can read the live web plus a model that can reason, with guardrails.

### 4. The solution (one picture)  `Innovation` `UX`
- Auth → Profile → Discover → Match (with evidence) → Action Plan.
- Four opportunity types, one product.
- Visual: the landing-page sample card.
- **Notes:** "A job board gives you links. We give you the reasoning layer: why you qualify, the proof, and what to do next."

### 5. Live demo (3.5 minutes): follow `docs/DEMO_SCRIPT.md`  `UX` `Presentation`
- Profile → Find → Prove (expand a card) → Act (save, action plan) → Close.
- **Notes:** Say up front that the stage run uses a cached sample set and why (venue Wi-Fi). Have the backup recording ready. Slide shows only "LIVE DEMO".

### 6. The differentiator: "prove it"  `Innovation` `Technical execution`
- Every match carries: score, reason, **quoted evidence**, source URL, fetched date, and honest gaps.
- Guardrails: the AI may only cite text in the listing. Quotes are checked verbatim against the listing text and dropped if they do not appear. Source URL and date come from our data, never from the model.
- When unsure, the card says "Eligibility unclear, verify on source" rather than guessing.
- Visual: an expanded card with the blockquote highlighted.
- **Notes:** This is why it feels like a product, not a demo. Most projects stop at "we found links with AI". We defend every recommendation.

### 7. Architecture and the unified pipeline  `Technical execution`
- **Diagram description (draw left to right):** Browser (Next.js App Router, React Query) → Next.js Route Handlers → three boxes underneath: **Discovery** (TinyFish Search → TinyFish Agent with a structured schema → normalise → dedupe), **Matching** (deterministic rule gate → Gemini JSON mode → Zod validation → evidence verification → rule-based fallback), **Tracking** (applications, urgency, priority = fit × urgency). All three read and write **Supabase Postgres** with Row Level Security; Supabase Auth issues sessions through a proxy that refreshes cookies.
- One data model for internships, jobs, hackathons and scholarships; a new type is a new set of search queries.
- **Notes:** Stress three decisions: (1) a deterministic gate in front of the LLM, so cheap rules do the obvious filtering; (2) schema-validated model output with a fallback, so the system never crashes on a bad response; (3) the service-role key lives only on the server.

### 8. Engineering quality and metrics  `Technical execution`
- Measured: with cached data every step of the flow (login, profile, find, save, status change) responded in about 1 second in our end-to-end run; pre-loading 12 scored matches took about 20 seconds; 38 automated tests (rule gate, matcher fallbacks, priority maths, seed data); lint and production build clean; RLS verified with a second user.
- Resilience: timeouts and one retry on every external call; Gemini failure falls back to a rule-based score; per-URL failures never fail a run.
- Product targets (not yet measured with users): profile in under 3 minutes; ranked shortlist in under a minute; zero missed deadlines for saved items.
- **Notes:** Clearly separate *measured* from *target*. Judges trust the honest split.

### 9. Impact and roadmap  `Impact` `Innovation`
- **Now:** four types, evidence-backed matches, deadline tracking, in-app reminders.
- **Next:** Google sign-in, email and push reminders, more source adapters, application-form prefill (never auto-submit), résumé upload to enrich the profile.
- **Later:** campus and placement-cell dashboards; alumni signals; regional language support.
- Who benefits: first-generation students without a mentor to point out what they qualify for.
- **Notes:** Name the non-goals we chose on purpose (no auto-apply, no résumé builder) and why: trust first.

### 10. Team and ask  `Presentation`
- **Dev A** Backend / Data / Auth: *name*
- **Dev B** Discovery: *name*
- **Dev C** Match engine: *name*
- **Dev D** Frontend / Demo: *name*
- Ask: feedback, a pilot with a college placement cell, mentors in ed-tech.
- Close on the tagline.
- **Notes:** One sentence per person on what they owned. End on time.

---

## Category checklist

| Category | Where we earn it |
| --- | --- |
| Innovation | "Prove it" evidence layer (slides 3, 6); unified pipeline across four types (7) |
| Technical execution | Agent extraction + rule gate + validated LLM + fallback; RLS; tests (6, 7, 8) |
| UX | Evidence cards that answer "why am I seeing this?", urgency colours, instant cached loads (4, 5) |
| Impact | Real student pain, honest roadmap and non-goals (2, 9) |
| Presentation | One story arc (Find, Prove, Act), rehearsed demo, backup recording (1, 5, 10) |

## Likely questions

- **"How do you know the quotes are real?"** Each quote is checked against the extracted listing text before it is shown; unverifiable ones are removed and a gap is added.
- **"What if the AI is down?"** One retry, then a rule-based score labelled as such. The app never errors out on a bad response.
- **"Is the demo data live?"** The stage run uses a cached sample set; the live path is the same code and is run ahead of time because browser-agent extraction takes tens of seconds per page.
- **"Why not just use ChatGPT?"** It cannot read the live listings for you, cannot cite the source and date, and does not track your deadlines.
