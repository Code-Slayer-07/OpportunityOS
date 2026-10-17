# OpportunityOS: Demo Script (3.5 minutes)

Spoken lines are in **bold quotes**. Actions are in *italics*. Figures and wording on cards come from the last `npm run prefetch`; the text below matches the seeded demo data, but read what is actually on screen if a number differs.

## Pre-demo checklist (morning of)

- [ ] Run `npm run prefetch -- --reseed` against production. Confirm the table lists **at least 10 matches**.
- [ ] Vercel env has `DEMO_MODE=true`. Optionally `MATCH_CACHE_ONLY=true` so Gemini is never called on stage.
- [ ] Check `https://<app>/api/health`.
- [ ] **Window 1 (incognito, logged out):** the landing page `/`, for the Hook.
- [ ] **Window 2 (normal):** logged in as `demo@opportunityos.dev`, on `/profile`. Action Plan is empty (delete any saved items so the "Saved" buttons start clean).
- [ ] In Window 2, open `/matches` once and confirm the cards load. Find the **Machine Learning Intern (Kiran Analytics)** card: it has a real gap and three quotes, and is the one to expand. The top card is **Software Development Intern (Nimbus Labs)**, 2 days left.
- [ ] Browser zoom 100%, notifications off, bookmarks bar hidden, laptop plugged in.
- [ ] **Backup screen recording** of the full flow saved locally and open in a player tab.
- [ ] Phone hotspot ready.
- [ ] Be ready to say that the listings are a pre-loaded sample set (see Find). If you ran `--refresh`, the card titles will differ from this script: pick the best live card instead.

## 0:00 Hook (20s): *Window 1, landing page*

**"Every student I know has twelve tabs open: Internshala, Unstop, Devfolio, a scholarship portal. For every listing you re-read the eligibility rules, check the deadline, and hope you did not miss something. Job boards give you links. They cannot tell you whether you actually qualify, or prove it. OpportunityOS does."**

*Point at the tagline, then at the sample card on the right. Switch to Window 2.*

## 0:20 Profile (30s): *Window 2, /profile*

**"You tell it about yourself once. This is a B.Tech CSE student, third year, graduating 2027. Skills: React, Python, Node, ML. They want internships, hackathons and scholarships, in Delhi or remote."**

*Scroll the form slowly: Education, Skills & Roles, Preferences. Click Save profile: "Profile saved" appears, and so does the green "Find opportunities" button.*

**"Under three minutes to set up, and it is reusable."**

## 0:50 Find (40s): *open Matches, then click Refresh, from cache*

*Click "Matches" in the navbar: the ranked cards from the last run appear instantly. Click "↻ Refresh" (the same button reads "Find opportunities" the first time you use it). The three progress stages flash by and the list updates.*

**"Behind this button the app searches the web with TinyFish, reads each listing page with a browser agent, and stores the structured result. For the stage demo I am using a pre-loaded set of sample listings, so venue Wi-Fi cannot hurt us. Same pipeline, cached."**

*Point at the list.* **"Twelve matches, ranked by fit. Before any AI sees a listing, a rule gate has already removed the ones this student cannot apply to: a Hyderabad on-site role, a 2026-batch-only role, a job when they asked for internships."**

*Click the Hackathon filter, then All.*

## 1:30 Prove (60s): *expand the Machine Learning Intern card*

*Click "Why you qualify" on the Machine Learning Intern card.*

**"Score 85. But a score is just a number, so here is why."** *Read the reason aloud.*

*Point at the Evidence list.* **"Each requirement is paired with the part of the profile that satisfies it, and the exact sentence quoted from the listing: 'B.Tech or M.Tech students in CSE or ECE.' Next to it is the source link and the date we read it. We also check that every quote really appears in the listing; the model is not allowed to invent evidence."**

*Point at Gaps.* **"And it tells you what you are missing: the profile does not mention scikit-learn, which the listing requires. Honest gaps are how you decide where to spend your time."**

*(Optional, 10s: expand CodeSprint Delhi.)* **"When it cannot be sure, it says so: 'Eligibility unclear, verify on source.'"**

**"This is the part a job board cannot do."**

## 2:30 Act (40s): *save two, open Action Plan*

*Click Save on Software Development Intern (Nimbus Labs), then on CodeSprint Delhi 2026. Both buttons turn to "✓ Saved" instantly. Click "Action Plan" in the navbar.*

**"One click saves it. Now the action plan."** *Point at the red reminder banner.* **"Something closes in two days, so the app tells me, in-app. Colours show urgency: red under three days, amber up to a week, green after that."**

*Point at Top priorities.* **"Priority is fit times urgency, so a strong match that closes soon beats a perfect match with a month left. 'Strong match, 95, and closes in 2 days.'"**

*Use the dropdown to move one card from Saved to Applying.* **"I move it across as I go, and it persists."**

## 3:10 Close (20s)

**"Everything you saw ran through one pipeline: one data model, one rule gate, one evidence format. Internships, jobs, hackathons and scholarships are the same code with different search queries. Find what matters. Prove it is real. Never miss a deadline. Thank you."**

## If something goes wrong

| Problem | Do this |
| --- | --- |
| Wi-Fi fails | Switch to the phone hotspot. If the site still will not load, run locally (`npm run dev`, `DEMO_MODE=true`) or play the backup recording. Supabase is a cloud service, so with no internet the live app cannot log in; the recording is the real fallback. |
| Cards are empty or everything says "Closed" | Run `npm run prefetch -- --reseed` (about 20 s), refresh. If there is no time, play the recording. |
| Refresh / "Find opportunities" errors | Click Retry once. If it fails, refresh: the cached matches load on page open without it. |
| A number or sentence differs from this script | Read what is on screen. Nothing in the script depends on exact wording. |
| Running over time | Skip the optional CodeSprint beat and the Hackathon filter. |
| Judge asks "is this live data?" | Be direct: the stage run uses a cached sample set; live discovery is the same code path (`npm run prefetch -- --refresh`) and takes a few minutes because a browser agent reads each page. |
