# Assignment 5 — Alpha Sprint evidence

Evidence for the CodeStrike Alpha Sprint (2026-11-21 → 2026-11-28), tasks T1 to T4.

This directory records what was **actually executed** in this workspace. Every log, screenshot
and manifest here was produced by a real command on 2026-11-22. Nothing is transcribed by hand
and no result is asserted that was not observed.

## Layout

| Directory | Meaning |
| --- | --- |
| `sprint-baseline/` | State inherited into the sprint before this round: the Assignment 4 prototype line and the backend implementation imported by T1. Records *what was carried in*, not what was re-run. |
| `sprint-new/` | Work performed or re-verified during the sprint: the T1 integration itself and every verification executed against the integrated `sprint/alpha` tree. |
| `t2-shared-http/` | The T2 round: shared contracts, the HTTP transport for both clients and the verification executed against the `feat/2-shared-http` branch. |
| `t3-auth-profile/` | The T3 round: the isolated MySQL 8.4 environment, the account and profile integration and the verification executed against the `feat/3-auth-profile` branch. |
| `t4-competitions-teams/` | The T4 round: the contract audit, the recruitment, application and captain admission integration, and the verification executed against the `feat/4-competitions-teams` branch. |
| `t9-weixin-readiness/` | The WeChat mini program preparation for T9: the AppID configuration, the package builds in both transport modes, the platform compatibility audit and the deployment posture audit. The mini program itself was **not** started, because the WeChat Developer Tools are not installed on this machine. |
| `t9-devtools-release/` | The round that follows it: the WeChat Developer Tools are installed, the project is opened on the **source tree** so their version management panel works on the repository, and version `1.0.0` was uploaded to the WeChat console. |
| `sprint-essay-1/` | The burn-up record of the first sprint essay, covering 2026-11-21 and 2026-11-22. |

`sprint-baseline` is a snapshot of inherited material. `sprint-new` is the output of this
round's own commands. Re-running a baseline check does not move it into `sprint-new`.

## Commits

| Commit | Branch | Subject |
| --- | --- | --- |
| `fe94176` | `feature/assignment4-prototype` | `docs(prototype): archive MoDao handoff assets` |
| `eae892a` | `sprint/alpha` | `chore(sprint): record backend branch ancestry for T1 baseline merge` |
| `15e3b94` | `sprint/alpha` | `feat(sprint): import FastAPI backend into alpha baseline (T1)` |
| `c54bcc6` | `feat/2-shared-http` | `feat(api): integrate shared contracts and HTTP transport (#2)` |
| `f36660f` | `sprint/alpha` | Merge pull request #10 from feat/2-shared-http |
| `5900b11` | `feat/3-auth-profile` | `feat(auth): integrate registration and profile flows (#3)` |
| `8f84d65` | `feat/4-competitions-teams` | `feat(teams): integrate recruitment and application flows (#4)` |
| `e05d333` | `sprint/alpha` | Merge pull request #12 from feat/4-competitions-teams |
| `36315b8` | `sprint/alpha` | `docs(evidence): record the sprint essay 2 burn-up record (#4)` |

The T4 merge commit is `e05d3331a22bcbe2af86e3bf56153cc1ac995f18`; the burn-up record of
Sprint Essay 2 follows it in `36315b8`. The tip at the time of the T1 record was
`15e3b947433f6fa09c4f69ed4b9009d150bd8d97`
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
| MySQL client | 8.0.37 (the pre-existing installation; **not** 8.4) |
| MySQL server used by the sprint | 8.4.6, isolated instance on port 3307, see `t3-auth-profile/README.md` |
| Docker | not installed |
| Browser | Microsoft Edge 157.0.4341.60 (headless, DevTools Protocol) |

The backend virtualenv lives at `.test-venv/` in the repository root and is ignored by git.

## Known limitation — MySQL 8.4

Seven backend tests require a real MySQL 8.4 instance and were **skipped**, not passed.
The exact reasons are in `sprint-new/backend-pytest.txt` and summarised in
`sprint-new/mysql-8.4-skip-record.md`. No SQLite result is presented as MySQL evidence.

The T3 round installed the isolated MySQL 8.4.6 instance that removed this limitation; the
rounds from T3 on run the backend suite against it with no skip. The statement above still
describes the T1 round, whose log was produced before that instance existed.

Log files use the `.txt` extension because the repository's `.gitignore` excludes `*.log`.
