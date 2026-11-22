# Assignment 5 — Alpha Sprint evidence

Evidence for the CodeStrike Alpha Sprint (2026-11-21 → 2026-11-28), task T1 only.

This directory records what was **actually executed** in this workspace. Every log, screenshot
and manifest here was produced by a real command on 2026-11-22. Nothing is transcribed by hand
and no result is asserted that was not observed.

## Layout

| Directory | Meaning |
| --- | --- |
| `sprint-baseline/` | State inherited into the sprint before this round: the Assignment 4 prototype line and the backend implementation imported by T1. Records *what was carried in*, not what was re-run. |
| `sprint-new/` | Work performed or re-verified during the sprint: the T1 integration itself and every verification executed against the integrated `sprint/alpha` tree. |

`sprint-baseline` is a snapshot of inherited material. `sprint-new` is the output of this
round's own commands. Re-running a baseline check does not move it into `sprint-new`.

## Commits

| Commit | Branch | Subject |
| --- | --- | --- |
| `fe94176` | `feature/assignment4-prototype` | `docs(prototype): archive MoDao handoff assets` |
| `eae892a` | `sprint/alpha` | `chore(sprint): record backend branch ancestry for T1 baseline merge` |
| `15e3b94` | `sprint/alpha` | `feat(sprint): import FastAPI backend into alpha baseline (T1)` |

`sprint/alpha` tip at the time of recording: `15e3b947433f6fa09c4f69ed4b9009d150bd8d97`
(tree `13fac42430e0a5e3fdd52a07e0715e03bc98d422`).

## Sprint issues

The T1–T9 issues were created from the published blog's task table, snapshotted in
`sprint-baseline/published-blog-task-plan.txt`.

| Issue | Task | Priority | Module |
| --- | --- | --- | --- |
| [#1](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/1) | T1 | P0 | Baseline Merge |
| [#2](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/2) | T2 | P0 | Shared Types & HTTP Client |
| [#3](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/3) | T3 | P0 | Auth & Profile Integration |
| [#4](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/4) | T4 | P0 | Competitions & Teams Integration |
| [#5](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/5) | T5 | P1 | Community Posts & Interactions |
| [#6](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/6) | T6 | P1 | Admin Web Integration |
| [#7](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/7) | T7 | P1 | Notifications & Planner Integration |
| [#8](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/8) | T8 | P0 | Testing & QA Automation |
| [#9](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/9) | T9 | P1 | MP-Weixin Build Check & Docs |

## Environment

| Component | Version |
| --- | --- |
| OS | Windows 11 Pro 10.0.26200.9974 |
| Node | v22.23.2 |
| pnpm | 11.24.0 |
| Python (backend venv) | 3.13.9 |
| pytest | 9.1.1 |
| FastAPI | 0.162.0 |
| SQLAlchemy | 2.0.55 |
| MySQL client | 8.0.37 (server not running; **not** 8.4) |
| Docker | not installed |
| Browser | Microsoft Edge 157.0.4341.60 (headless, DevTools Protocol) |

The backend virtualenv lives at `.test-venv/` in the repository root and is ignored by git.

## Known limitation — MySQL 8.4

Seven backend tests require a real MySQL 8.4 instance and were **skipped**, not passed.
The exact reasons are in `sprint-new/backend-pytest.txt` and summarised in
`sprint-new/mysql-8.4-skip-record.md`. No SQLite result is presented as MySQL evidence.

Log files use the `.txt` extension because the repository's `.gitignore` excludes `*.log`.
