Below is a clean, implementation-ready product spec written for an engineer / builder, not marketing, not investors.
This is the document you hand to the guy doing the build so intent, logic, and boundaries are crystal clear.

No fluff. No ambiguity.

HomeProHub – Homeowner Experience & Monetization

Engineering / Product Build Specification

PURPOSE

Design the homeowner-facing experience so that:

Core problem exploration is free

Contractor connection is free

Contractors pay for leads

Homeowners only pay for on-demand expert access

Trust, clarity, and autonomy are preserved throughout

This is not a funnel. It is a decision-support system.

1. CORE PRINCIPLES (DO NOT VIOLATE)

No hidden paywalls

No implied free human labor

AI ≠ authority

Paid access = time + immediacy, not necessity

Homeowners control pace

Contractors are protected from unnecessary calls

If any UI or flow violates these, it needs to be reworked.

2. HOMEOWNER ACCESS RULES (GLOBAL)

Free for Homeowners:

AI issue exploration

Photo upload

Safety & urgency guidance

DIY context

“What to tell a contractor” summaries

Posting jobs

Browsing vetted, licensed contractors

Receiving bids / responses

Paid for Homeowners:

On-demand access to a real professional

Video / phone / chat / email

Immediate, scheduled at homeowner’s convenience

One-time call OR subscription

Contractors:

Pay for access to homeowner job leads

Do NOT pay homeowners

Do NOT get bypassed by expert tier

3. MAIN HOMEOWNER HOMEPAGE (AI ENTRY POINT)

Primary Intent

Allow homeowners to explore and understand issues on their own, without pressure to act.

Required UI Elements

Headline:
What’s going on with your home?

Subhead:
Describe what you’re seeing or upload a photo. Our AI helps you understand what might be happening, how serious it could be, and what your options are — completely free.

Helper Text (small):
Many homeowners use this just to understand the issue before deciding what to do.

Notes for Build

No CTA to hire

No pricing shown

No contractor prompts yet

This must feel like a sandbox

4. AI ANALYSIS RESULTS PAGE (CRITICAL)

Layout Rule

After AI analysis, present three clearly separated paths, not stacked CTAs.

PATH 1: UNDERSTAND (FREE, DEFAULT)

Title:
What This Might Be

Content:

AI explanation

Safety & urgency guidance

Optional DIY checks

“What to tell a contractor” language

Footer text:
This guidance is educational and does not replace an in-person inspection.

NO BUTTON HERE

This is the “thinking space.”

PATH 2: HIRE A PRO (FREE CONNECTION)

Title:
When You’re Ready, Hire a Pro

Copy:
If you’d rather have this handled, you can connect with vetted, licensed contractors in your area. Contractors are graded on performance and experience — not ads or paid placement.

Bullets:

Free to post your job

No obligation to hire

You choose who to contact

Button:
Browse Verified Contractors

Notes:

Make it explicit that this is free

No urgency language

No sales framing

PATH 3: ASK AN EXPERT NOW (PAID)

Title:
Want a Straight Answer Right Now?

Copy:
Sometimes you don’t need a visit — you just want to talk to someone experienced. You can get on-demand access to a professional by phone or video for immediate guidance.

Examples (static text):

“Is this urgent or can it wait?”

“Does this quote make sense?”

“Could this be something simple?”

Button (must include pricing indicator):
Talk to an Expert (Paid)

Pricing Display Rules

Pricing shown before confirmation

No “free trial” language

No auto-renew without explicit opt-in

5. EXPERT ACCESS (UNCLE / GRANDPA MODEL)

What Experts Are

Experienced tradespeople

Advisory only

No job selling

No competing with contractors

What Experts Are NOT

Diagnosticians

Inspectors

Replacement for in-person service

Expert UI Guardrails

Experts must emphasize uncertainty

Experts must avoid contradicting contractors casually

Experts should default to: 

“This still may need an in-person look, but here’s how to think about it.”

6. CONTRACTOR PROTECTION REQUIREMENTS

From contractor POV, homeowner jobs should:

Include structured AI summaries

Include photos

Include homeowner behavior grade

Reduce “just come look at it” calls

Expert tier exists to:

Filter small / simple issues

Reduce wasted service visits

Improve homeowner preparedness

If expert tier causes contractors to lose trust → rollback.

7. USER JOURNEY SUMMARY (FOR ENGINEERING REFERENCE)

Session 1 (Free)

AI exploration

Learning

No pressure

Session 2 (Free)

Job posting

Contractor connection

Session 3 (Optional Paid)

On-demand expert access

Decision confidence

Paid access is never required to proceed.

8. NON-NEGOTIABLE COPY RULES

Never say:

“Free consultation”

“Talk to a pro for free”

“Get help now” (too vague)

Always say:

“Free to connect”

“Optional paid expert access”

“No obligation”

9. SUCCESS CRITERIA (ENGINEERING + PRODUCT)

Homeowners understand where money is and isn’t required

Contractors report fewer wasted visits

Expert tier feels optional, not coercive

No confusion between AI, experts, and contractors

If users ask “wait, when do I have to pay?” → the UI failed.

FINAL NOTE TO BUILDER

This product succeeds by restraint, not pressure.

If something feels like a funnel, upsell, or trick:

Stop

Simplify

Remove

Trust is the feature.
