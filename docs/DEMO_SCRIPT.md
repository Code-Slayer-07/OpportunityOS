# OpportunityOS: Demo Script (3.5 minutes)

Spoken lines are in **bold quotes**. Actions are in *italics*. **All listings are real pages fetched from the live web** by `npm run demo:prepare`, so titles, scores and deadlines depend on the day you prepared. The script therefore points at *kinds* of cards ("the top card", "a card with a gap") and tells you to read what is on screen. Nothing in it depends on exact wording.

## Pre-demo checklist (morning of, with internet)

- [ ] Run `npm run demo:prepare` against production. It collects real listings, scores them with Gemini and prints a readiness report. You want **READY** (at least 10 saved AI matches, no fallbacks).
- [ ] In Vercel set `DEMO_MODE=true` (zero calls to TinyFish or Gemini on stage). Optionally `MATCH_CACHE_ONLY=true`.
- [ ] Check `https://<app>/api/health`.
- [ ] **Window 1 (incognito, logged out):** the landing page `/`, for the Hook.
- [ ] **Window 2 (normal):** logged in as the demo user, on `/profile`. Action Plan is empty (remove any saved items so Save buttons start clean).
- [ ] In Window 2 open `/matches` and look at the list. Pick, in advance:
  - **Card A (expand it):** one with a quoted evidence list **and** at least one gap; ideally a LinkedIn, Internshala or Unstop internship.
  - **Cards B and C (save them):** one with a red or amber "N days left" chip, one with a green one. If everything is "Closed" or has no deadline, run `npm run collect` again.
- [ ] Click **Apply / View on <Site> ↗** on Card A once and confirm the real page opens in a new tab (then close it).
- [ ] Browser zoom 100%, notifications off, bookmarks bar hidden, laptop plugged in.
- [ ] **Backup screen recording** of the full flow saved locally and open in a player tab. Phone hotspot ready.

## 0:00 Hook (20s): *Window 1, landing page*

**"Every student I know has twelve tabs open: Internshala, Unstop, Devfolio, a scholarship portal. For every listing you re-read the eligibility rules, check the deadline, and hope you did not miss something. Job boards give you links. They cannot tell you whether you actually qualify, or prove it. OpportunityOS does."**

*Point at the tagline, then at the sample card on the right. Switch to Window 2.*

## 0:20 Profile (30s): *Window 2, /profile*

**"You tell it about yourself once. This is a B.Tech CSE student, third year, graduating 2027. Skills: React, Python, Node, ML. They want internships, hackathons and scholarships, in Delhi or remote."**

*Scroll the form: Education, Skills & Roles, Preferences. Click Save profile: "Profile saved" appears, and so does the green "Find opportunities" button.*

## 0:50 Find (40s): *open Matches, then click Refresh*

*Click "Matches" in the navbar: the ranked cards appear instantly. Point at the source badges.* **"Every card says where it came from: the site, its favicon, the host name, and when we fetched the page. These are real listings, pulled from the live web by TinyFish and read by Gemini, not a dataset we typed in."**

*Click "↻ Refresh" (it reads "Find opportunities" the first time). The progress strip flashes through the stages and the list updates.* **"Behind this button the app searches site by site, reads each listing page, throws away index pages, login walls and anything it cannot verify, and scores what is left. For the stage I am replaying the snapshot I fetched this morning, so venue Wi-Fi cannot hurt us. Same pipeline."**

*Use the source chips (for example Unstop, LinkedIn) to filter, then All sources. Click the Hackathon type filter, then All.*

## 1:30 Prove (60s): *expand Card A*

*Click "Why you qualify" on Card A.* **"Here is the score, and here is why."** *Read the reason aloud.*

*Point at the Evidence list.* **"Each requirement is paired with the part of the profile that satisfies it, and the exact sentence quoted from the listing, with a link to the page it came from and the time we fetched it. Every quote is checked against the page text, and a value that is not on the page is dropped. The model is not allowed to invent evidence."**

*Point at Gaps.* **"And it tells you what you are missing, so you know where to spend your time."**

*(Optional, 10s: expand a card showing the amber banner.)* **"When it cannot be sure, it says so: 'Eligibility unclear, verify on source.'"**

*Click **Apply / View on <Site> ↗**. The real listing opens in a new tab.* **"One click and you are on the original page. This is the part a job board cannot do: the proof sits next to the link."** *(Close the tab.)*

## 2:30 Act (40s): *save two, open Action Plan*

*Click Save on Card B, then Card C. Both buttons turn to "✓ Saved" instantly. Click "Action Plan" in the navbar.*

**"One click saves it. Now the action plan."** *Point at the reminder banner if one shows.* **"Something closes soon, so the app tells me, in-app. Colours show urgency: red under three days, amber up to a week, green after that."**

*Point at Top priorities.* **"Priority is fit times urgency, so a strong match that closes soon beats a perfect match with a month left."** *Use the dropdown to move a card from Saved to Applying.* **"I move it across as I go, and it persists. Every card keeps its Apply button."**

## 3:10 Close (20s)

**"Everything you saw ran through one pipeline: one data model, one rule gate, one evidence format, and every record points back to its real source. Internships, jobs, hackathons and scholarships are the same code with different search queries. Find what matters. Prove it is real. Never miss a deadline. Thank you."**

## If something goes wrong

| Problem | Do this |
| --- | --- |
| Wi-Fi fails | Switch to the phone hotspot. DEMO_MODE needs no internet except Supabase. If the site still will not load, run locally (`npm run dev`, `DEMO_MODE=true`) or play the backup recording. |
| Cards are empty or mostly "Closed" | Run `npm run demo:prepare` (a few minutes), refresh. If there is no time, play the recording. |
| Some cards say "Rule-based, not AI-scored" | Those listings have no saved AI score yet (shown instantly, never saved). Run `npm run prescore`, or just expand a card that has evidence. |
| Refresh / "Find opportunities" errors | Click Retry once. If it fails, reload: the saved matches load on page open without it. |
| The "Apply" tab shows a login wall | Say so: the listing's own site asked for a login. We never bypass that; the saved evidence still came from the public page. |
| A number or sentence differs from this script | Read what is on screen. |
| Judge asks "is this live data?" | Be direct: it is real data fetched from the live web earlier; the stage run replays that snapshot. A live search runs in the background (about 15-60 s per run). |
