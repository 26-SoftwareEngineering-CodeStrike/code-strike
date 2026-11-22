# Sprint baseline — state inherited into the Alpha Sprint

Material that already existed before this round. This directory records **what was carried
into `sprint/alpha`**, with the Git object identifiers that fix its content.

## Source branches

| Branch | Commit | Role |
| --- | --- | --- |
| `feature/assignment4-prototype` | `fe94176e933cf33525d1d24c8c73692bbcfc09e6` | Assignment 4 prototype line — student client, admin client, shared contracts, SRS, engineering notes, standalone HTML prototypes, evidence archive |
| `origin/feature/backend-implementation` | `c2b027b3137cf04c517cc6932c0c85f74cfb39c1` | FastAPI backend implementation (72 new files plus 5 newer server/ADR files) |
| `origin/main` | `5afd42b5ad70182b4af7e1e7cbed74dc4aeec510` | Phase 1 workspace baseline |

`origin/feature/assignment4-prototype` was at `ceac8ece060ec9c064e7668ba169253b4614fa57`
(the `a4-prototype-freeze-20261028` tag) when `fe94176` was created on top of it.

## Baseline files

- `baseline-manifest.txt` — ancestry, SHAs and the commit graph of `sprint/alpha` at import time.
- `imported-backend-files.txt` — every path the T1 import touched, with the committed blob SHA.
  72 added, 6 modified, **0 deleted**.
- `preserved-inherited-tree.txt` — the inherited subtree that T1 deliberately left untouched.

## Why the backend was not plain-merged

`feature/backend-implementation` descends from `0829aa1`, a re-created baseline with **no common
ancestor** with the prototype line (`git merge-base` returns nothing). The backend branch was
forked before the Assignment 4 prototype work, so a plain merge would have reverted that work:
116 files would have been deleted across `docs/evidence/**`, `scripts/`, `prototype/`, `log/`,
`apps/student-app/src/pages/**` and `apps/student-app/src/components/**`, and `packages/api-contracts`
would have lost 243 lines of shared types.

T1 therefore recorded ancestry with `git merge -s ours --allow-unrelated-histories` (commit
`eae892a`, tree unchanged at 195 files) and imported the backend with a path-scoped
`git checkout origin/feature/backend-implementation -- apps/server/ ...` (commit `15e3b94`).

This is a claim about what the recorded commands did, and the two commits are the proof:
`eae892a` has the prototype tree, `15e3b94` adds only backend paths on top of it.

## Inherited content that T1 did not touch

The student client, admin client, shared contracts, SRS
(`docs/requirements/CodeStrike_Group5_SRS.docx`), engineering notes, verification scripts and
all standalone HTML prototypes were carried across byte-for-byte. The exact blob SHAs that
were preserved are listed in `preserved-inherited-tree.txt`.

## The five MoDao artboard exports

`fe94176` added five MoDao artboard exports to the prototype line **before** `sprint/alpha` was
branched, so they are baseline material from the sprint's point of view. They are additional
artboard renders kept alongside the existing interactive wave4-pilot pages and do not replace
them: the exports contain no `<script>` and three UI-05 tabs, while the interactive pages carry
four tabs and the JS that `scripts/verify-html-wave4.mjs` asserts.

The five files are:

- `prototype/html/wave4-pilot/UI04_Modao_Editable_Test.html`
- `prototype/html/wave4-pilot/UI05_Modao_Editable_Test.html`
- `prototype/html/wave4-pilot/UI05_Recruitment_State_Modao.html`
- `prototype/html/wave4-pilot/UI09_Modao_Editable_Test.html`
- `prototype/html/wave4-pilot/UI09_Pending_State_Modao.html`

They contain fictional prototype data only. No account, token, credential or real personal data
was found in them.
