# OpportunityOS: Test Report

Tested 2026-10-17 against the working tree (Next.js 16.4.2, production build and dev server), a real Supabase project, real TinyFish and Gemini keys. No application code was changed during testing. Test scripts and screenshots are in the session scratchpad (`qa/`, `qa/shots/`).

**Totals: 130 PASS, 7 FAIL, 3 NOTE, 2 NOT TESTED.**

How things were tested: HTTP-level tests with real Supabase sessions (cookie injection) against the dev server (:3000); production servers with fetch instrumentation (:3002 outbound-call logging, :3004 bad Gemini key, :3005 bad TinyFish key, :3006 blackholed TinyFish, :3007 DEMO_MODE, :3008 DEMO_MODE with simulated no-internet, :3009 MATCH_CACHE_ONLY); a second throwaway user for RLS tests; and a real headless Chrome driven over the DevTools protocol for the UI flow, mobile (375x812) and console/network errors. All throwaway users and QA-created rows were deleted afterwards.

## Verdict: READY WITH RISKS (cached demo) / NOT READY (any claim of live, real data)

The product works end to end and is solid on auth, validation, RLS, secrets, matching and the action plan. The cached demo runs in about 1-3 s per step. But **live discovery found only 3 real opportunities in 4 minutes** (target: 10+), so everything on stage depends on **synthetic seed data**, and the PRD criterion "10 real opportunities" is not met.

Top 3 to fix first:
1. **Live discovery quality and speed** (Blocker for a "real data" demo). 9 of 12 URLs were skipped (index pages and 120 s timeouts); a run takes about 4 minutes.
2. **Demo-mode caching semantics** (Major). New opportunities trigger Gemini on stage; fallback results are stored permanently and never replaced; non-prefetched users wait 13-33 s.
3. **De-duplication** (Major). The same listing is stored twice when the extracted deadline differs.

## PRD section 4 scorecard

| Done criterion | Result | Evidence |
| --- | --- | --- |
| Full flow runs live: profile, discovery, matches with evidence, action plan | **PARTIAL** | The whole flow works in a real browser (screenshots 01-17). Live discovery returned only 3 listings; matching and the action plan worked on them and on cached data. |
| At least 10 real opportunities fetched and structured for the demo profile | **FAIL** | 3 real rows stored (two runs of about 4 min). The other 17 rows are synthetic seed data. |
| Every match shows a score, at least one evidence snippet and at least one gap | **PASS** for AI matches (12/12), **FAIL** for rule-based fallback matches | AI: all 12 had score, 1-3 verbatim quotes and at least one gap. Fallback (bad Gemini key): 12/12 had 0 evidence by design. |
| Cached results let the demo run in under 5 s with no live network dependency | **PASS** for the prefetched demo user, **FAIL** for a fresh user | Prefetched: 0.6-1.4 s per API step, Refresh 2.3-2.8 s, cached page render about 1.0-1.5 s, zero external calls in simulated no-internet. Fresh user in DEMO_MODE: 13-33 s (Gemini scoring). Supabase must still be reachable. |

## Failures and bugs (by severity)

### Blocker for a "real data" demo

**B1. Live discovery returns too few real opportunities and is slow.**
- What happened: `POST /api/discover` (demo profile) took 245 s and stored 3 rows; the second run took 242 s and added 0. 9 of 12 URLs were skipped.
- Reproduce: log in as a user with the demo profile and call `POST /api/discover` on a server without DEMO_MODE.
- Skipped: unstop.com/internships and buddy4study.com/scholarships/engineering (agent timeout, 120 s); unstop.com/hackathons, wellfound.com/location/india, internshala.com/internships/react-internship/, devfolio.co/hackathons ("Page is not a single identifiable opportunity").
- Suspected cause: search returns category and index pages, which the extractor cannot turn into one opportunity. `src/lib/discovery/run.ts` (`pickUrls`), `src/lib/discovery/queries.ts`.
- Proposed fix: filter index/search URLs before extraction, prefer detail pages, extract top links from index pages, add per-site configs.

### Major

**M1. The demo's 17 listings are synthetic.** `scripts/seed-fallback.json` uses fictional organisations, and the card links go to example.com. Acceptable only if disclosed. Fix: replace with a snapshot of real discovery.

**M2. DEMO_MODE can still call Gemini on stage and keeps AI-failure results forever.**
- What happened: with simulated no-internet and DEMO_MODE on, the prefetched demo user's `POST /api/match` attempted a Gemini call (a new live row existed: 21 opportunities, 1 unscored). The failure was stored as a rule-based match, and in DEMO_MODE `freshMs = Infinity` so it is never re-scored (the demo user then showed 13 matches, one rule-based).
- Suspected: `src/lib/matching/run.ts` (`freshMs`, upsert of fallback rows).
- Fix: do not persist fallback matches (or flag and re-score them), or make DEMO_MODE skip scoring entirely.

**M3. First-run latency for any non-prefetched user.** A new user in DEMO_MODE with real Gemini: "Find opportunities" took 13.4 s, 22.8 s and 33.3 s across three runs (about 12 Gemini calls, 3 at a time). Only the prefetched demo account meets the 5 s criterion. Fix: batch opportunities per Gemini call or pre-score in the background.

**M4. The same listing is stored twice.** The dedupe key and unique index include the deadline, so when a re-fetch extracts a different deadline the same URL produces a second row (React.js & Vite Developer Internship, Centennial Infotech, same sourceUrl, deadlines null and 2026-07-28). Files: `src/lib/discovery/dedupe.ts`, `supabase/migrations/0001_init.sql` (`opportunities_dedupe_idx`). Fix: also dedupe by source URL.

### Minor

- **m1. Console 404s on auth transitions.** Right after logout and login, Next RSC prefetches (`/login?_rsc=...`, `/profile?_rsc=...`) return 307 to the same URL and then 404 (3-4 per transition, reproduced with the demo user). No visible breakage. Suspect `src/proxy.ts` / `src/lib/supabase/middleware.ts` while cookies change. Not seen while staying logged in.
- **m2. Error states appear after about 7.5 s with a generic "Failed to fetch".** React Query default retries (3). Profile, Matches and Action Plan all show a message plus Retry and recover. Fix: `retry: 1` and friendlier text (`src/components/Providers.tsx`).
- **m3. Cards show "Remote · Remote"** when location is "Remote" and the remote flag is true (`src/components/matches/MatchCard.tsx`, the `where` variable).
- **m4. Fallback matches have no evidence** (bad Gemini key: 12/12 empty). Intentional per the earlier spec, but it contradicts "every match has evidence".
- **m5. A bad TinyFish key or total network failure returns HTTP 200 with count 0** and a `skipped` list; the UI does not tell the user (`src/app/api/discover/route.ts`).
- **m6. The 8-character password minimum is enforced only in the browser form;** Supabase accepts 6+ (a 7-character signup succeeds via the API).
- **m7. Visiting /login while logged in always goes to /profile** (proxy), even when the profile is complete; the login form itself correctly goes to /matches.
- **m8. `npm audit`: 5 high vulnerabilities, all in dev tooling** (eslint chain); 0 in production dependencies.
- **m9. Wasted credits:** index pages are sent to the browser agent and then skipped.

## Detailed results

### Setup

| Check | Result | Evidence |
| --- | --- | --- |
| npm install | **PASS** | completed; npm audit: 5 high severity, all in dev tooling (eslint chain); `npm audit --omit=dev` = 0 vulnerabilities |
| npm run lint | **PASS** | eslint . exited clean (0 errors, 0 warnings) |
| npx tsc --noEmit | **PASS** | exit 0, no output (TypeScript 6.0.3) |
| npm run build | **PASS** | Compiled successfully; 16 routes incl. all 8 API routes |
| npm run dev serves the app | **PASS** | GET / 200, GET /api/health 200 on :3000 |
| unit tests (vitest) | **PASS** | 4 files, 38 tests passed (gate 9, matcher 5, priority 20, seed 3, ...) |
| .env.local has all required keys | **PASS** | NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, TINYFISH_API_KEY, GEMINI_API_KEY, NEXT_PUBLIC_SITE_URL all set (values not printed); GEMINI_MODEL/DEMO_MODE/MATCH_CACHE_ONLY optional, unset |
| migration 0003 (indexes) applied in Supabase | **NOT TESTED** | no DDL/introspection access via REST; 0002 confirmed applied (flag column readable) |

### Auth

| Check | Result | Evidence |
| --- | --- | --- |
| 1 signUp returns a session (email confirm off) | **PASS** | session=true user=0a76687c-8551-4ed6-88ec-c288fdbb4131 |
| 7 profiles row auto-created on signup (name+email copied) | **PASS** | {"id":"0a76687c-8551-4ed6-88ec-c288fdbb4131","name":"QA Tester","email":"qa-auth-1792248598788-1704@opportunityos.dev","profile_complete":false} |
| 2 log in after log out returns session | **PASS** | session ok |
| 2 session cookie works on repeated requests (refresh) | **PASS** | status 200, 200 |
| 3 logged-out /profile redirects to /login | **PASS** | 307 -> /login |
| 3 logged-out /matches redirects to /login | **PASS** | 307 -> /login |
| 3 logged-out /action-plan redirects to /login | **PASS** | 307 -> /login |
| 4 logged-in /login redirects away | **PASS** | 307 -> /profile |
| 4 logged-in /signup redirects away | **PASS** | 307 -> /profile |
| 5 wrong password gives clear error, no crash | **PASS** | Invalid login credentials |
| 5 5-char password rejected by Supabase (server side) | **PASS** | Password should be at least 6 characters. |
| 6 all 11 API route/method combos return 401 {error:{message}} without session | **PASS** | all 401 with error envelope |
| 6 /api/health is public and leaks nothing | **PASS** | {"data":{"status":"ok","time":"2026-10-17T14:50:05.107Z"}} |
| UI signup: empty submit shows inline errors (name/email/password) | **PASS** | all 3 errors shown |
| UI 5: 7-char password rejected with message, stays on /signup | **PASS** | url=/signup msg=true |
| UI 1: sign up redirects to /profile | **PASS** | 1885ms, url=/profile |
| UI 3: Log out redirects to /login | **PASS** | url=/login |
| UI 3: logged-out /profile → /login | **PASS** | url=/login |
| UI 3: logged-out /matches → /login | **PASS** | url=/login |
| UI 3: logged-out /action-plan → /login | **PASS** | url=/login |
| UI 5: wrong password shows 'Invalid login credentials', no crash | **PASS** | error message rendered |
| UI 2: login with complete profile lands on /matches | **PASS** | url=/matches |
| UI 2: session persists across page refresh (cards still load) | **PASS** | reloaded /matches, cards present |
| UI 4: visiting /login while logged in redirects away | **PASS** | url=/profile |

### Profile

| Check | Result | Evidence |
| --- | --- | --- |
| API: PUT {} (all required missing) | **PASS** | 200 profileComplete=false (API is lenient by design; strict required-field validation is in the form) |
| 5 profile_complete false until the 9th required field, then true | **PASS** | [false,false,false,false,false,false,false,false,true] |
| 5 emptying a required array flips profile_complete back to false | **PASS** | skills=[] -> complete=false |
| 5 DB column profile_complete matches API | **PASS** | {"profile_complete":false} |
| 2 full save returns 200 and complete=true | **PASS** | 200 {"id":"a1b799fe-9814-415b-a1f2-6a00823bd3cc","name":"QA Tester","email":"qa-prof-1792248628140-5324@opportunityos.dev","degree":"B.Tech","branch":"CSE","gradYea |
| 2 data persists across logout/login (all field types) | **PASS** | {"id":"a1b799fe-9814-415b-a1f2-6a00823bd3cc","name":"QA Tester","email":"qa-prof-1792248628140-5324@opportunityos.dev","degree":"B.Tech","branch":"CSE","gradYear":2027,"currentStatus":"3rd year","cgpa":8.2,"skills":["React","Python","Node.js","ML"],"preferredRoles":["SDE intern"],"experienceLevel":" |
| 3 edit one field persists, others untouched | **PASS** | branch=IT skills=4 |
| 6 11 invalid bodies each return 400 {error} | **PASS** | all 400 |
| 6 malformed JSON body returns 400, not 500 | **PASS** | 400 {"error":{"message":"Invalid input: expected object, received null"}} |
| 6 rejected PUTs did not change stored data | **PASS** | gradYear=2027 |
| 6 extra keys (id/email/profile_complete) cannot be mass-assigned | **PASS** | status 200; email=unchanged; complete=true |
| optional URL can be cleared with empty string | **PASS** | githubUrl=null |
| 1 UI: empty save shows inline errors for all 9 required fields (incl. gradYear + types) | **PASS** | 9/9 errors |
| 4 tag input: Enter adds, duplicate (case-insens.) blocked, comma adds, Backspace removes | **PASS** | after Enter=1, dup=1, comma=2, backspace=1 |
| 2 UI: valid save shows success message and 'Find opportunities' link to /matches | **PASS** | saved msg shown, link=true |
| 2 UI: reload keeps all saved values (selects, tags, toggle) | **PASS** | {"branch":"CSE","degree":"B.Tech","year":"2027","status":"3rd year","remote":"true"} |

### Discovery

| Check | Result | Evidence |
| --- | --- | --- |
| 6 GET /api/opportunities (+?type=) makes no outbound web call (only Supabase) | **PASS** | hosts=["jjhkrukdbpsexnqnfxgu.supabase.co"] statuses=200,200,200,200,200 |
| 6 ?type= filter returns only that type | **PASS** | hackathons=4, all types={"internship":8,"hackathon":4,"scholarship":3,"job":2} |
| 6 results sorted by deadline asc (nulls last) | **PASS** | n=17 |
| 6 invalid ?type= gives 400 | **PASS** | 400 {"error":{"message":"Invalid type"}} |
| 7 invalid TinyFish key: graceful JSON response, no crash | **PASS** | 200 in 1598ms {"data":{"count":0,"opportunities":[],"skipped":[{"url":"search: B.Tech CSE internship React India 2026 Internshala Unstop","reason":"TinyFish responded 401: {\"error\":{\"code\":\"INVALID_API_KEY\",\"message\":\"Invalid or expired API key\"},\"request_id\":\" |
| 7 TinyFish unreachable (blackhole IP): returns within timeout budget, JSON, no crash | **PASS** | 200 in 21.9s {"data":{"count":0,"opportunities":[],"skipped":[{"url":"search: B.Tech CSE internship React India 2026 Internshala Unstop","reason":"TinyFish request failed: fetch failed"},{"url":"search: hackathon India 2026 open registration Devfolio Unstop","reason":"Tiny |
| 2 POST /api/discover (live, demo profile): >=10 opportunities stored | **FAIL** | run #1: 200 in 245s, count=3, skipped=9 (of 12 URLs). Reasons: 'Page is not a single identifiable opportunity' (unstop.com/hackathons, wellfound.com/location/india, internshala.com/internships/react-internship/, devfolio.co/hackathons) and 'TinyFish request timed out after 120000ms' (unstop.com/internships, buddy4study.com/scholarships/en |
| 2 stored live rows have title, org, type, eligibility, deadline, location, sourceUrl, fetchedAt | **PASS** | 3/3 had title, org, type, location, sourceUrl, fetchedAt, 5 evidence snippets each; 1/3 had null deadline and was flagged 'incomplete' |
| 3 all wanted types appear (internship, hackathon, scholarship) | **PASS** | live rows: hackathon (MLH Month Long Hackathon), scholarship (Buddy4Study India Foundation), internship x2 (React.js & Vite Developer Internship) |
| 4 de-duplication: running discover twice leaves no duplicate (org+title+deadline) rows | **PASS** | run #2 (242s, count=0): 20 rows, 0 duplicate keys |
| 4 de-duplication: same listing is not stored twice | **FAIL** | 'React.js & Vite Developer Internship' / Centennial Infotech exists twice with the SAME sourceUrl (unstop.com/internships/reactjs-vite-developer-intern): deadline null (flag incomplete) and deadline 2026-07-28 (flag expired). Key includes deadline, so a changed extraction creates a second row. |
| 5 expired / unparseable records are flagged, not silently shown | **PASS** | MLH hackathon (2024-02-01) flag=expired, React.js internship null deadline flag=incomplete, expired duplicate flag=expired; gate removes expired ones from matches |
| 7 TinyFish invalid key: no crash | **PASS** | 200 in 1.6s, count=0, skipped lists 6 'TinyFish responded 401 INVALID_API_KEY' (no retry on 4xx: 6 calls for 6 queries). Note: success status with empty data, UI shows no warning. |
| 8 TinyFish key not in client bundle | **PASS** | grep of .next/static and .next/dev/static for the key value and names: 0 matches |

### Match

| Check | Result | Evidence |
| --- | --- | --- |
| 2 POST /api/match returns matches | **PASS** | 12 matches in 9.7s |
| 2 every match has score 0-100, reason, >=1 evidence (5 fields), >=1 gap | **PASS** | 12 matches all valid |
| 3 results sorted by score desc | **PASS** | 95,85,85,85,85,85,85,85,85,65,65,25 |
| 3 matches persisted in `matches` table for this user | **PASS** | db rows=12, api=12 |
| 1 gate: wrong-location / wrong-batch / unwanted-type items never appear | **PASS** | absent: Product Engineering Intern; SDE Intern (2026 Batch); Associate Software Engineer; Graduate Engineer Trainee; Frontend Engineering Intern |
| 1 gate: no match has an expired deadline | **PASS** | checked all |
| 4 every evidence quote is verbatim in the opportunity text & sourceUrl matches (all matches) | **PASS** | 27 quotes checked |
| 6 second POST /api/match does not re-call Gemini for fresh matches | **PASS** | gemini calls=0, matchedNow=0, 1189ms |
| GET /api/match returns cached matches (no Gemini) | **PASS** | 200 count=12 791ms |
| 2 reason is 2-3 sentences (spot: sentence counts) | **NOTE** | 2,2,2,2,2,2,2,2,2,2,2,2 |
| 5 invalid Gemini key: no crash, 200 with matches | **PASS** | 200, 12 matches, fallbacks=12 |
| 5 invalid key: each opportunity tried exactly twice (1 retry) | **PASS** | gemini calls=24 for 12 opportunities |
| 5 fallback result has note 'AI reasoning unavailable', gap 'Reasoning unavailable' | **PASS** | {"reason":"AI reasoning unavailable, showing rule-based score","gaps":["Reasoning unavailable"],"score":69,"evidence":0} |
| 5 fallback scores in 0-100, sorted desc | **PASS** | 69,56,56,55,43,35,35,35,35,27,23,21 |
| 5 fallback results have >=1 evidence item (requirement of step 4.2) | **FAIL** | evidence counts: 0,0,0,0,0,0,0,0,0,0,0,0 (design: fallback intentionally returns empty evidenceMap) |
| 1 rule gate unit tests (wrong type, expired, wrong location, unclear passes) | **PASS** | ruleGate.test.ts: 9 tests passed; also ran the gate on live rows: expired MLH -> fail 'Deadline has passed', Buddy4Study (2025 batch) -> fail, incomplete React.js -> pass |

### Action plan

| Check | Result | Evidence |
| --- | --- | --- |
| 1 save 3 opportunities (201 each) | **PASS** | 201,201,201 |
| 1 saved items persist after re-login | **PASS** | 3 items: Software Development Intern | Machine Learning Intern | Future Technologists Scholarship |
| 2 saving same item again returns 200 + same id, no duplicate | **PASS** | status=200 sameId=true dbRows=3 |
| 2 four concurrent duplicate saves: no duplicates, no 5xx | **PASS** | statuses=200,200,200,200 dbRows=3 |
| 3 status Saved>Applying>Applied>Interview>Result>Saved persists across fresh sessions | **PASS** | 5 transitions, each verified after a new login |
| 3 updated_at advances on PATCH (> saved_at) | **PASS** | {"saved_at":"2026-10-17T14:54:53.64085+00:00","updated_at":"2026-10-17T14:55:08.407438+00:00"} |
| 3 invalid status returns 400 | **PASS** | 400 {"error":{"message":"status must be one of: Saved, Applying, Applied, Interview, Result"}} |
| 4 GET returns urgency/daysLeft/priority ordered by priority desc | **PASS** | Software Develop[score 95,d2,red,p161.5] | Machine Learning[score 85,d9,green,p93.5] | Future Technolog[score 85,d16,green,p85] |
| 4 API urgency colour consistent with thresholds for all items | **PASS** | checked against daysLeft |
| 5 passed deadline is grey and sorts last (even with score 99) | **PASS** | last=QA Expired Opp urgency=grey days=-2 priority=19.8 |
| DELETE of an already removed item returns 404 | **PASS** | 404 |
| UI: board has 5 columns, both saved items present | **PASS** | 261ms |
| 6 UI: reminder banner for items due in <3 days | **PASS** | 1 item is due in under 3 days: Software Development Intern. Apply or update the status so it stops showing here. |
| UI: Top priorities strip with reason line | **PASS** | Strong match (95) and closes in 2 days |
| UI: navbar Action Plan link has urgent-count badge | **PASS** | nav text: Action Plan 1 |
| UI: urgency chip colours (red<3d, amber 3-7, green>7) | **NOTE** | Software Development Intern => 95:bg-green-100,2 days left:bg-red-100,Internship:undefined || CodeSprint Delhi 2026 => 85:bg-green-100,6 days left:bg-amber-100,Hackathon:undefined |
| 3 UI: moving a card via dropdown persists after reload | **PASS** | column after reload: Applying |

### Security

| Check | Result | Evidence |
| --- | --- | --- |
| 7 user B PATCH/DELETE of user A application returns 404, A row unchanged | **PASS** | PATCH 404, DELETE 404, A row status=Saved |
| 7 user B GET /api/applications shows none of A items | **PASS** | count=0 |
| 7 RLS via direct PostgREST as user B: select/update/delete/forge-insert on A data all blocked | **PASS** | sel=0 upd=0 del=0 matches=0 forgeErr=42501 |
| RLS profiles: user B cannot read/update user A row; select-all returns only own; anon sees nothing | **PASS** | readA=0 allVisible=1 updateA=0 anon=0 Aname=QA Tester |
| RLS matches/applications: new user sees 0 rows of others (select-all) | **PASS** | matches=0 applications=0 |
| no API keys/secrets appear in any server log produced during QA | **PASS** | 9 logs scanned; leaked in: [] |

### E2E

| Check | Result | Evidence |
| --- | --- | --- |
| 6 Find opportunities (DEMO_MODE) ends with >=10 ranked cards | **PASS** | 14 cards in 33303ms; progress strip seen=true; skeleton seen=true |
| Save 2 cards: buttons turn to '✓ Saved' | **PASS** | ["Software Development Intern","CodeSprint Delhi 2026"] |

### Matches UI

| Check | Result | Evidence |
| --- | --- | --- |
| collapsed card shows score, title, org, type, deadline+urgency, Save, 'as of' date | **PASS** | 95 | MATCH | Software Development Intern |  | Nimbus Labs |  | Save | Internship | Remote · Remote | 💰 ₹30,000/month | Deadline 19 Oct 2026 | 2 days left |  | The student is a perfect match for this  |
| expanded card: reason, quoted evidence, source link+fetched date, gaps, as-of | **PASS** | 327ms; all present; link=https://example.com/demo/kiran-ml-intern target=_blank rel=noopener noreferrer |
| type filter 'Hackathon' shows only hackathon cards | **PASS** | 4 cards |

### UX

| Check | Result | Evidence |
| --- | --- | --- |
| empty state for new user with no matches (message + Find opportunities button) | **PASS** | OpportunityOS | Profile | Matches | Action Plan | Log out | Your matches |  | Ranked by fit, each with the evidence behind it. |  | Find opportunities | All | Internship | Job | Hackatho |
| empty state when filter has no results (suggests another filter/profile) | **PASS** | shown |
| empty state: new user's Action Plan (message + link to matches) | **PASS** | OpportunityOS | Profile | Matches | Action Plan | Log out | Your action plan is empty |  | Save opportunities from your matches and we’ll track deadlines and te |
| empty state: incomplete profile on /matches links to /profile | **PASS** | OpportunityOS | Profile | Matches | Action Plan | Log out | Build your profile first |  | We match opportunities to your degree, skills and preferences. It take |
| page titles and favicon present | **PASS** | title="OpportunityOS: Find what matters. Prove it's real." favicon=true |
| per-page titles on /login and /signup | **PASS** | {"/login":"Log in | OpportunityOS","/signup":"Sign up | OpportunityOS"} |
| error state: Action Plan shows message + Retry when its API fails | **PASS** | Retry shown after 7.7s (React Query default 3 retries); text: OpportunityOS | Profile | Matches | Action Plan | Log out |  | Failed to fetch |  | Retry |
| error state: Action Plan Retry recovers after API is back | **PASS** | OpportunityOS | Profile | Matches | Action Plan | Log out | Your action plan is empty |  | Save oppo |
| error state: Matches shows message + Retry when its API fails | **PASS** | Retry shown after 7.5s (React Query default 3 retries); text: it. |  | Find opportunities | All | Internship | Job | Hackathon | Scholarship |  | Failed to fetch |  | Retry |
| error state: Matches Retry recovers after API is back | **PASS** | OpportunityOS | Profile | Matches | Action Plan | Log out | Your matches |  | Ranked by fit, each wi |
| error state: Profile shows message + Retry when its API fails | **PASS** | Retry shown after 7.4s (React Query default 3 retries); text: OpportunityOS | Profile | Matches | Action Plan | Log out |  | Failed to fetch |  | Retry |
| error state: Profile Retry recovers after API is back | **PASS** | OpportunityOS | Profile | Matches | Action Plan | Log out | Your profile |  | Tell us about you once |

### Responsive

| Check | Result | Evidence |
| --- | --- | --- |
| 375px: /matches has no horizontal page overflow | **PASS** | scrollWidth=375 viewport=375 offenders=[] |
| 375px: /matches expanded card has no horizontal page overflow | **PASS** | scrollWidth=375 viewport=375 offenders=[] |
| 375px: /profile has no horizontal page overflow | **PASS** | scrollWidth=375 viewport=375 offenders=[] |
| 375px: /action-plan (board scrolls inside its own container) has no horizontal page overflow | **PASS** | scrollWidth=375 viewport=375 offenders=[] |
| 375px: navbar fits on one row without overflow | **PASS** | {"h":54,"w":375,"vw":375} |
| 375px: /login has no horizontal page overflow | **PASS** | scrollWidth=375 viewport=375 offenders=[] |
| 375px: /signup has no horizontal page overflow | **PASS** | scrollWidth=375 viewport=375 offenders=[] |
| 375px: / (landing) has no horizontal page overflow | **PASS** | scrollWidth=375 viewport=375 offenders=[] |
| mobile on a physical device | **NOT TESTED** | emulated 375x812 in headless Chrome only |

### Landing

| Check | Result | Evidence |
| --- | --- | --- |
| logged-out landing: tagline, Find/Prove/Act, sample card, signup + login CTAs | **PASS** | missing:  |

### Perf

| Check | Result | Evidence |
| --- | --- | --- |
| 7 demo-mode 'Find opportunities' (discover+match) < 5s | **FAIL** | 33303ms (user had no stored matches, so Gemini scored ~12 listings: includes first-time AI scoring) |
| 7 cached matches page: cards visible after navigation | **PASS** | 1384ms total (goto+render), 470ms waiting for cards (dev machine, remote Supabase) |
| 7 demo-mode Refresh (discover + cached match) < 5s | **PASS** | 2346ms |
| 7 fresh live discovery run in <~20s | **FAIL** | 245s and 242s (browser agent 30-120s per page, 12 pages, 4 at a time) |
| 7 per-step latency in DEMO_MODE for the prefetched demo user (login-state API calls) | **PASS** | GET /api/profile 776ms, GET /api/match 1180ms, POST /api/discover 970ms, POST /api/match 1377ms, GET /api/opportunities 555ms (all <5s) |

### Offline

| Check | Result | Evidence |
| --- | --- | --- |
| 7 DEMO_MODE + no internet (prefetched demo user): discover/match/opps all succeed, each < 5s, zero external calls attempted | **FAIL** | GET /api/profile 200 776ms ; GET /api/match 200 1180ms n=12 ; POST /api/discover 200 970ms n=21 ; POST /api/match 200 1377ms n=13 ; GET /api/opportunities 200 555ms n=21 ; non-Supabase hosts attempted: ["generativelanguage.googleapis.com"] |
| 7 DEMO_MODE + no internet, NEW user: discover from seed + match falls back to rule-based, still >=10 matches | **PASS** | discover 200 940ms n=21; match 200 1341ms matches=13 fallbacks=13; cards say: AI reasoning unavailable, showing rule-based score |
| MATCH_CACHE_ONLY=true serves stored matches only (demo user 12, new user 0), no Gemini attempted | **PASS** | demo user 200 n=13 1063ms; new user 200 n=0; stats={"opportunities":0,"passedGate":0,"matchedNow":0,"fallbacks":0,"cacheOnly":true} |

### Console

| Check | Result | Evidence |
| --- | --- | --- |
| browser console errors/exceptions across the whole run | **FAIL** | {"console":["log-error: Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:3007/profile?_rsc=Y6O1Hi8LHp9YaZau","log-error: Failed to load resource: the server responded with a status of 404 (Not Found) http://localhost:3007/login?_rsc=OaHroMd9mQh4CZ22","log-error: Failed to load resource: the s |

### Network

| Check | Result | Evidence |
| --- | --- | --- |
| HTTP >=400 responses and failed requests during the run | **NOTE** | {"http":["404 /profile?_rsc=Y6O1Hi8LHp9YaZau","404 /login?_rsc=OaHroMd9mQh4CZ22","404 /login?_rsc=cWl7ozZDlDBC93cD","404 /login?_rsc=nIYEbGRaYGTVDHKL","400 /auth/v1/token?grant_type=password"],"failed":[]} |

### Robustness

| Check | Result | Evidence |
| --- | --- | --- |
| no unhandled rejections / uncaught exceptions in server logs | **PASS** | none found |

### Code audit

| Check | Result | Evidence |
| --- | --- | --- |
| no N+1 queries in match/applications endpoints | **PASS** | code read: listApplicationItems = 2 queries, listUserMatches = 1 joined query, runMatching = constant queries + 1 batched upsert (inspection, not query logging) |
| every /api route uses requireUser, bodies validated with Zod | **PASS** | 7 of 7 protected route files call requireUser; /api/health intentionally public; Zod on profile PUT, applications POST/PATCH, opportunities ?type; discover/match take no body |
| RLS enabled on every table in migrations | **PASS** | profiles, opportunities, matches, applications (0001_init.sql lines 43, 92, 113, 135) + behaviour verified live |

## Screenshots

In `qa/shots/`: 01-signup, 02-profile-empty, 03-profile-errors, 04-tags, 05-profile-saved, 06-matches-empty, 07-matches-loading, 08-matches-list, 09-card-expanded, 10-action-plan, 11-action-plan-after-move, 12-login, 13-landing-desktop, 14-action-plan-empty, 15-matches-no-profile, 16-action-plan-error, 17-matches-error, and m1 to m6 at 375 px.

## Not tested

- Migration 0003 (indexes) applied in the database: no way to introspect it from the REST API.
- Physical phone testing; true offline mode (simulated by rejecting every non-Supabase fetch; Supabase itself stayed reachable).
- Google sign-in (not implemented, marked TODO).
- Vercel deployment (not performed).

## Status after fixes (re-tested)

| Finding | Status | Evidence |
| --- | --- | --- |
| B1 live discovery too few rows, slow | **Fixed** | Pages are fetched with TinyFish Fetch and read by Gemini (validated against the page text) instead of the browser agent. A run takes 14-56 s (limit 60 s). The database now holds 47 real rows from 10 sites (Unstop, LinkedIn, Wellfound, Internshala, Devpost, HackerEarth, Hack2skill, Devfolio, Buddy4Study, Reliance Foundation) across internship, hackathon, job and scholarship. |
| M1 synthetic seed data | **Fixed** | Seed code and data removed; 17 fake rows listed and deleted by `npm run clean-urls`; zero example.com rows; every row has origin `live_fetch`; a database constraint blocks fake URLs. |
| M2 DEMO_MODE called Gemini and kept fallbacks | **Fixed** | DEMO_MODE with every non-Supabase host rejected: zero outbound calls attempted. Fallback matches are shown (labelled) but never saved; `matches.is_fallback` added. |
| M3 slow first scoring | **Mostly fixed** | Scoring is batched (4 per Gemini call, hedged retry). 15 opportunities: 6.7 s, 10.9 s, 6.6 s across three runs. A brand-new user in DEMO_MODE gets 17+ cards in about 1 s (instant labelled cards). |
| M4 duplicate listings | **Fixed** | One row per page: unique index on the normalised source URL; existing duplicates merged by migration 0004; unit-tested. |
| m1 RSC 404s after logout/login | **Fixed** | Login and logout use a full-page navigation; no `/login` or `/matches` 404s in the browser console. |
| m2 slow, generic error states | **Fixed** | One retry, none for 4xx; "Couldn't load this. Check your connection and retry." |
| m3 "Remote · Remote" | **Fixed** | "Remote" once, or "<location> · Remote OK". |
| m4 fallback matches have no evidence | **By design** | Fallbacks are labelled "Rule-based, not AI-scored" and never saved. |
| m5 silent 200 with 0 results | **Fixed** | The job ends `partial` with "Live search unavailable (...). Showing saved results.", verified with a bad TinyFish key. |
| m6 password minimum only in the browser | **Documented** | Needs a Supabase dashboard setting (Authentication password policy: minimum length 8); noted in README and DEPLOY.md. Cannot be set from code. |
| m7 /login redirect ignored profile state | **Fixed** | Complete profile goes to /matches, otherwise /profile (unit-tested and verified in the browser). |
| m8 npm audit (dev tooling) | Unchanged | 0 vulnerabilities in production dependencies. |
| m9 wasted credits on index pages | **Fixed** | Index, article, PDF, API and bare-IP URLs are rejected before any fetch. |
