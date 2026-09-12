# Agents, Everywhere — Hackathon Brainstorm (Columbus, AI Tinkerers)

Status: superseded as the hackathon plan on Sep 11 by the Midwife concept — see `plan.md`. Second Reader is kept here as a candidate for later (it shares the institutional-memory thesis; see the Battelle section of the plan). Event facts below remain current.

## Event facts

Event: AI Tinkerers Columbus, "Agents, Everywhere" hackathon. Page: https://columbus.aitinkerers.org/hackathons/h_Lv03K-ob6sU. Submission deadline: Sep 12, 2026, 5:00 PM EDT.

Schedule: 10:00–10:30 check-in, 10:30–11:00 opening broadcast/challenge briefing/starter-kit walkthrough, 11:00–11:15 team formation, 11:15–3:30 build (~4h15m of actual build time), 3:30–4:00 submit in portal, 4:00–4:45 optional local show-and-tell, 4:45–5:00 wrap and group photo.

Theme: build an agent for a place people already work, talk, or live — not just a chatbox — and make the agent meaningfully more useful because of that environment's context.

Judging: scored 1–5 across four categories, judged globally after submissions close, based on the GitHub repo plus a 2-minute demo video — not live testing. Categories: Core Requirements & Functionality; Innovation & Theme Alignment (top score requires "a surprising new agent pattern whose central value could not be reproduced in a standalone chatbox"); Technical Execution & Integration; Usefulness & Agentic Experience.

Submission requires: project title, written description, public GitHub repo, 2-minute demo video, a social media post tagging event partners.

Build eligibility: must be a net-new build created during the event, but existing templates, libraries, prompts, and starter code are allowed as long as the core functionality is built live.

Prizes: 1st — $10,000 OpenAI credits, a Mac mini per team member, $1,000 Exa credits, Exa swag. 2nd — $5,000 OpenAI credits, Ray-Ban Meta glasses per team member, $500 Exa credits, Exa swag. 3rd — $2,500 OpenAI credits, a LOOI Robot per team member, $250 Exa credits, Exa swag. Side-prizes: Best Use of Ambiguous AI (NVIDIA DGX Spark), Best Use of CopilotKit (AirPods Max per team member).

Sponsors: OpenAI (marquee), CopilotKit, OpenRouter, Exa, Rev1 Ventures (sponsor/community partner/venue), Auth0, GDG Columbus, Ambiguous AI, Team Claws, Trigger.dev, Mozilla, Google Cloud Run.

No mandatory framework as of this writing — starter kit/resources hadn't been published yet, so nothing locks in a stack.

## Strategic framing

Judging is done off a recorded video and repo, not live testing, so a more ambitious environment integration is viable as long as the one filmed take is clean. The real tradeoff is novelty of environment vs. reliability of finishing in ~4h15m of actual build time.

Ambient wearables were considered and set aside as a crowded space, despite genuine interest in voice as a modality.

The seam that emerged: hands-busy/lab environments are an underused place for voice, and it connects directly to a real problem at Battelle (David's employer) — his tech fellow lead's stated ideal is "throw all the data Battelle has, including handwritten or printed notebooks, into an AI and find common themes."

Battelle's actual proprietary notebook data can't be used for a public hackathon. Public-domain historical science archives substitute, and arguably make for a better demo story: built for a proprietary problem, demoed on public archives.

## Leading concept: "Second Reader"

One-line: an agent that lives in paper. Point a phone at a physical handwritten page — an old notebook, or a page just written by hand — and the agent reads it aloud, explains what it is, links it to related entries across a large ingested archive, and cross-references published literature, including surfacing abandoned research threads that later literature validates.

The "place" is paper itself, not a screen. A chatbox can't do "look at this page" — the environment (the physical page in front of you) is the query.

Demo beat: hand-write a page today ("tested wing camber 1/20, lift lower than expected"), point the phone at it, and the agent responds with a matching historical entry, its data, and a modern paper that confirms or contradicts it. A new page becomes a query into 100+ years of institutional memory, on camera.

How it maps to judging criteria: Theme/Innovation — a novel pattern not reproducible in a chatbox. Technical Execution — a parallel ingestion pipeline, structured extraction, corpus-wide theme synthesis (not simple RAG), external literature cross-referencing. Usefulness — it directly executes the tech fellow's actual stated wish, with visible provenance (it shows the source page) for trust. Core Functionality — the filmed demo loop stays small (point → read → speak) even though the backend is deep.

### Alternates considered, not pursued as primary

Proactive Historian — same backend, but the agent proactively posts findings (e.g. to Slack) instead of waiting to be asked: "3 abandoned experiments new literature says are worth revisiting." Possible stretch add-on if a teammate is free.

Bench Voice — a pure hands-free voice lab assistant, narrating observations while hands are busy. Solid and clearly useful, but a lower innovation ceiling — closer to "Siri for the lab."

Tell It To The Bench — the same idea delivered via phone call as the interface. Very literally "not a chatbox" and easy to film, but less technically deep than Second Reader.

## Corpus plan (verified working the night before)

Primary: Wilbur & Orville Wright Papers, Library of Congress. Handwritten diaries and notebooks of real experiments — glider tests, wind-tunnel lift/drag tables, meteorological logs, 1900–1940 — with roughly 49,000 digitized images across the collection. Rights: writings are "dedicated to the public," the cleanest of everything considered. Bulk access confirmed: `https://www.loc.gov/item/{id}/?fo=json` (needs a browser User-Agent) → `resources[0].files` gives full-resolution IIIF JPEG/TIFF per page, for example `https://tile.loc.gov/image-services/iiif/service:mss:mss46706:mss46706-01007:0001/full/pct:100/0/default.jpg`. Bonus: the Wright collection's rights metadata includes 1944–45 letters from Battelle Memorial Institute — a real, verifiable callback for the pitch. Location tie-in: the Wright brothers worked out of Dayton, OH; the hackathon is in Columbus, OH.

Supplement: NASA NTRS / NACA technical reports. Typed reports, 1915–1958, on airfoils, camber, and lift — the direct scientific descendants of the Wrights' wind-tunnel notebooks — and public domain as US government works. Confirmed working: `https://ntrs.nasa.gov/api/citations/search?q=...` → direct PDF at `https://ntrs.nasa.gov/api/citations/{id}/downloads/{id}.pdf`, no auth needed. Purpose: gives the corpus a second, typed format alongside the handwritten notebooks, mirroring Battelle's real disparate-format problem. Plan is to rasterize PDF pages and run them through the same vision pipeline as the notebook scans.

Considered and set aside: Thomas Edison Papers (Rutgers, Omeka S REST API, `o:original_url` confirmed working) — a good scale flex (roughly 150,000 documents) if ingestion is running smoothly early, but not needed for the core demo. Linus Pauling Research Notebooks (Oregon State, predictable `/coll/pauling/rnb/{nb}/{nb}-{page}.jpg` URL pattern) — the closest domain match (chemistry) but rights are asserted by OSU with no open license stated, so garnish only, not headline. Smithsonian Transcription Center / Field Book Project — has human transcriptions alongside images, useful only as a small ground-truth set to quote an OCR accuracy number.

## Live tools during the build (capped at two, to limit integration risk)

Exa (sponsor credits) as the primary "what's been published since?" search. OpenAlex (free, no key, confirmed working — e.g. 6,890 hits on a camber/lift query with year, citation count, DOI, and open-access flag) for structured, citable metadata that Exa doesn't provide.

Set aside: Semantic Scholar (rate-limited to HTTP 429 without an API key; worth a free key only if TL;DR snippets are wanted for the video) and a separate arXiv client (OpenAlex already indexes arXiv, e.g. the `physics.flu-dyn` category for aero papers).

## Vendor → role mapping

OpenAI — vision model for handwriting OCR, embeddings, and voice (push-to-talk with Whisper + TTS as the safe path, Realtime API as a stretch). Trigger.dev — durable, retried, parallel ingestion jobs across corpus pages; the "robust orchestration" story for Technical Execution. Exa + OpenAlex — literature cross-referencing, as above. Google Cloud Run — hosting and concurrency for ingestion workers. OpenRouter — optional: ensemble two models on OCR and reconcile disagreements for messy handwriting. CopilotKit — web/phone frontend shell, voice plus generative UI; also the path to the "Best Use of CopilotKit" side-prize if pursued deliberately. Ambiguous AI — sponsor with a DGX Spark side-prize; what they actually offer is still unresearched. Eve (Vercel) — the framework originally planned going into the event; shelved for this brainstorm while exploring the Second Reader concept and corpus, not ruled out and not committed either.

## 4-hour build shape (draft, not committed)

Core, must ship: ingest N pages in parallel from Wright and NACA sources into theme cards with citations; a phone camera reads a physical page and returns a voice answer with related historical pages.

Stretch, only if core is solid early: abandoned-thread discovery (an old notebook entry paired with confirming or contradicting modern literature); Exa/OpenAlex literature contradictions surfaced automatically; full-duplex realtime voice instead of push-to-talk.

Reserve the final ~45 minutes of the day for filming the 2-minute demo video — it is the actual artifact judges see, not the live build.

## Open questions, not yet decided

Commit to Second Reader as the concept, or keep exploring alternates — this has been pure brainstorming so far, nothing chosen. Solo or team of 2–3 at the event, which determines how much of "core vs. stretch" is realistic. Add the Edison corpus for a "thousands of pages in minutes" scale flex, or keep the corpus small (Wright + NACA only) and the demo tight. Chase the CopilotKit side-prize deliberately, or let it fall out naturally if CopilotKit ends up used for the frontend anyway. Look up what Ambiguous AI's DGX Spark prize track actually requires. Verify whether Eve, if revisited, or a simpler stack is the right backend runtime for this specific pipeline.
