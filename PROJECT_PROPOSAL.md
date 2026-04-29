# Project Proposal: Pear

## One-Line Description
Pear is a Chrome extension + web dashboard that helps Gen Z stop doomscrolling during their highest-risk hours of the day — by adding intentional friction and social accountability, not all-or-nothing blocking.

## The Problem
Gen Z (including me) is painfully aware that we doomscroll, and we've tried the existing tools — Opal, Jomo, one sec, ScreenZen. They all have the same problem: they're either **all-or-nothing** (block the app entirely — too restrictive, so you turn it off within a week) or they rely on **pure willpower** (soft nudges that are too easy to ignore).

The real pattern isn't "I'm addicted to TikTok all day." It's: I have specific, predictable **high-risk windows** — 5-7pm after I get home, 11pm before bed, the 30 minutes after lunch. In those windows, I open TikTok on autopilot and lose an hour. Outside of those windows, I'm fine.

Pear targets those windows specifically. Block only when you're most at risk. Add a friction layer that lets you through if you really need to — but forces you to either **wait one minute** (long enough to notice you don't actually want to be here) or **type a reason** (logged publicly to a dashboard your friends can see). No all-or-nothing. No secret relapses.

This is the tool I actually want for myself, and I think most of my friends would use it. I've tried the existing ones. None of them feel right.

## Target User
Gen Z college students and early-career professionals who:
- Are self-aware about their doomscrolling habits
- Have identifiable high-risk time windows (after work, late at night, after lunch, etc.)
- Have tried existing blockers and found them too rigid
- Want social accountability but not surveillance

Starting user base: me + my friend group at UChicago. A tool built for people exactly like me first.

Not for: people who want total blocking, parents managing kids (Screen Time is better for that), or enterprise productivity tools.

## Core Features (v1)
1. **Account creation + onboarding** via Supabase Auth. Onboarding asks: high-risk time windows (e.g., 5-7pm on weekdays), which sites to block (presets: TikTok, Instagram, X/Twitter, YouTube, Reddit, Facebook + custom URLs), and an optional friend invite code.
2. **Chrome extension** (Manifest V3) that checks active block windows and intercepts navigation to blocked sites during those windows, redirecting to a custom block screen.
3. **Block screen with two override options**: (a) **"Wait 1 minute"** — timer UI, after which a short grace period unlocks the site; (b) **"Enter a reason"** — text input, logged to Supabase, then grace period unlocks the site.
4. **Personal dashboard** showing override log (most recent + most common reasons), current streaks, and basic stats (overrides this week vs. last week).
5. **Friends + social layer**: invite friends by code, see their override reasons and activity, with opt-in notification settings (real-time, daily digest, or off) so friends can be pinged when you override.

## Tech Stack
- **Frontend (dashboard)**: Next.js 15 (App Router) + React. Already familiar with it and it's the recommended stack.
- **Frontend (extension)**: Plasmo framework (React-based Manifest V3 extension framework with Next.js-like DX). Fast iteration and plays well with Claude Code.
- **Styling**: Tailwind CSS + shadcn/ui for production-quality components without overbuilding.
- **Database**: Supabase (Postgres). Already familiar with it; generous free tier; handles auth, realtime, and storage in one service.
- **Auth**: Supabase Auth — shared between the web dashboard and the extension so users sign in once.
- **Realtime**: Supabase Realtime channels for friend-notification push.
- **APIs**: None strictly required. Claude API (free via class access) reserved for optional features like analyzing override reasons for patterns (stretch).
- **Deployment**: Vercel for the Next.js app (free tier). Chrome Web Store for extension distribution (one-time $5 developer fee). During development, use unpacked extension locally.
- **MCP Servers**:
  - **Supabase MCP** — managing schema, RLS policies, auth, realtime channels
  - **Playwright MCP** — automated end-to-end testing of onboarding + block + override flows
  - **Chrome DevTools MCP** — debugging the extension (the highest-risk component)

## Stretch Goals
- **iOS companion app** using FamilyControls / DeviceActivity to extend blocking to native mobile apps. Biggest value-add — if the extension works well, mobile doubles the product's usefulness.
- **AI-powered pattern insights**: Claude analyzes your override reasons and surfaces themes ("You mostly override when you're bored or tired — here are your top patterns"). Free via class API access.
- **Smart window suggestions**: after a couple weeks of usage data, the app suggests block windows based on when you most frequently try to override.
- **Commitment contracts**: Beeminder-style stakes (e.g., a small donation to a cause you dislike if you break your streak).
- **Firefox / Safari extension ports** for wider browser coverage.
- **Accountability-buddy matching**: pair users with strangers for mutual accountability if they don't have friends on the app yet (addresses the cold-start problem).
- **Streak leaderboards / gamification** for friend groups.

## Biggest Risk
Two major risks, both identified during scoping:

1. **Chrome extension Manifest V3 mechanics.** MV3 uses `declarativeNetRequest` for blocking, which has different semantics than the legacy `webRequest` API. The flow — block redirect → full-page block screen → override decision → grace-period re-allow → re-block after grace expires — has tricky state management. Edge cases: multiple tabs on the same blocked site, grace-period timing across tabs, interaction between scheduled block windows and user overrides. This is the component most likely to have subtle bugs. **Mitigation:** build this end-to-end first, in Week 5. Test aggressively with Playwright + Chrome DevTools MCP. Get the core loop working before touching any polish.

2. **Friend notifications and real-time sync.** Supabase Realtime handles the transport, but the feature space is complicated: invite flows, privacy defaults, per-friend notification settings, debouncing to avoid spam, handling users who disable notifications. Also a **cold-start problem**: if your friends aren't on Pear, the social layer is useless. **Mitigation:** make the solo experience genuinely complete and valuable first. Build invite flow and notifications in weeks 3-4 (project weeks 7-8). Design notification defaults conservatively (daily digest by default, opt-in to real-time).

Secondary risks:
- **Chrome Web Store review timing** can take 3-14 days. If we want a publicly listed extension by the Week 9 fair, submit by Week 7. Unpacked extension is fine for development.
- **Users bypassing by disabling the extension**: explicitly out of scope for v1. This is a commitment tool, not a prison.

## Week 5 Goal
By the end of Week 5 (first week of building), demo a rough end-to-end working slice:
- Next.js dashboard deployed to Vercel with Supabase Auth sign-up/sign-in
- Onboarding form that saves block windows + selected sites to Supabase
- Chrome extension (unpacked, dev mode) that reads the signed-in user's config from Supabase and blocks configured sites during configured windows
- Placeholder block page with a **"Wait 1 minute"** button that runs a real timer and grants grace-period access
- **Override-reason** text input that writes to Supabase and shows up on the dashboard as the most recent reason

No polish, no friends, no stats yet — just the core loop working: **sign up → configure → install → hit a block → override → see it logged.** That proves the riskiest component (the extension) works end-to-end, freeing the remaining 4 weeks for polish, social features, stats, and stretch goals.
