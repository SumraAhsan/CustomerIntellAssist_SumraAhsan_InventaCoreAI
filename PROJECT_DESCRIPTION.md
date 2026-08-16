# Project Description — Customer IntellAssist

**InventaCore AI Business Automation Challenge 2026**
**Track 1 — Customer Operations**

## Problem

Support teams manually read, classify, prioritize, and route every incoming complaint — a slow,
inconsistent process with no visibility into duplicate issues or SLA risk.

## Current manual workflow

An agent reads the complaint, decides its category and urgency by judgment, manually assigns it to
a department, and has no systematic way to check whether a similar complaint was already logged.
This varies agent to agent, has no audit trail by default, and gives no early warning when a
response deadline is at risk of being missed.

## Proposed automation

Customer IntellAssist accepts a raw customer complaint and runs it through a deterministic
rule-based intelligence engine that:

- Classifies **category**, **sentiment**, **priority**, and **urgency** from the complaint text
- Detects **missing information** the agent will need (order numbers, dates, amounts, device details)
- Detects **duplicate or related cases** using text-overlap similarity, scoped to the same customer
  and a recent time window
- Auto-routes the case to the correct **department** and load-balances the **assignment** across
  the team
- Calculates and tracks an **SLA deadline**, with automatic Healthy / At Risk / Breached state
  changes and notifications
- Assists the agent in **drafting a response** in one of five tones — always reviewed and manually
  approved before being marked as sent, never auto-sent

Every classification is shown with a confidence score and the specific reasoning behind it, so an
agent can trust it or override it — this is not a black box. All of it is backed by a persistent
local database with a full, timestamped audit trail of every action taken.

## Target users

Customer support teams, small businesses, and support managers who need consistent triage without
paying for a helpdesk SaaS subscription or standing up a backend.

## Core features

- Automated case classification with visible confidence and reasoning
- SLA engine with configurable per-priority targets and breach detection
- Duplicate/related-case detection with one-click linking
- Knowledge-base recommendations matched to the case category
- Response drafting assistant (five tones, always human-approved)
- Full audit log, CSV/JSON export, dashboard analytics with live-calculated metrics
- Realistic, clearly-tagged sample data, loaded only by explicit user choice

## Architecture

React 19 + Vite frontend, Tailwind CSS, Dexie.js (IndexedDB) for persistence — fully local-first,
with zero external services, zero API keys, and zero backend to configure or pay for. The
intelligence engine is entirely rule-based and runs on-device; no external AI API is called
anywhere in the app. 40 automated tests (vitest, against a real IndexedDB implementation) cover the
intelligence engine, the SLA engine, and the full case lifecycle end to end.

## Measurable impact

- Reduces manual triage time from roughly **3–5 minutes per ticket** to **near-instant** automated
  classification
- Eliminates inconsistent, agent-dependent prioritization decisions
- Surfaces recurring or duplicate issues automatically, which would otherwise go unnoticed in a
  manual process
- Every action is auditable, giving managers visibility that a manual process doesn't provide by
  default

## Team

Solo build — Sumra Ahsan, ML Engineering Intern, InventaCore AI Internship Program 2026. Designed
and implemented the intelligence engine, SLA and routing logic, the full data layer, and the
interface.
