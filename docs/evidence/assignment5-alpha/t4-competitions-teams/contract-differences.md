# T4 Contract Differences — Real API vs. Assignment 4 Prototype View Models

- Task: T4 — Competitions & Teams Integration (GitHub Issue #4)
- Branch: `feat/4-competitions-teams`
- Baseline: `15059fe60d61272c3fcc69796f06203c17a498c9` (`sprint/alpha`)
- Audit date: 2026-11-23
- Backend under audit: `apps/server` running on `http://127.0.0.1:8000`, OpenAPI 3.1 served at
  `http://127.0.0.1:8000/api/v1/openapi.json` (document `CodeStrike API 0.1.0`)

This document was produced **before** any T4 implementation, as the task requires. Every route and
field below was read from the served OpenAPI document and the backend service source, not from the
prototype.

---

## 1. Route inventory

### 1.1 Real routes used by T4 (prefix `/api/v1`)

| Prototype operation | Real method + path | Notes |
| --- | --- | --- |
| competition list | `GET /competitions` | Public listing, `published = true` only. Supports `q` title search. |
| competition detail | `GET /competitions/{competition_id}` | 404 for unpublished or deleted competitions. |
| competition recruitments | `GET /competitions/{competition_id}/recruitments` | Only `publication = 'Published'` **and** `lifecycle = 'Active'` teams. |
| team detail | `GET /teams/{team_id}` | 404 unless published, or the caller is a current member of the team. |
| create team | `POST /teams` | → `201`, `TeamCreated`. |
| my teams | `GET /me/teams` | Active memberships only. |
| my team history | `GET /me/team-history` | All membership episodes of the caller. |
| my applications | `GET /me/applications` | Application rows where the caller is the applicant. |
| recruitment revisions (read) | `GET /teams/{team_id}/recruitment/revisions` | Captain only. |
| submit recruitment revision | `POST /teams/{team_id}/recruitment/revisions` | Body is `TeamFields` (**no** `competitionId`, **no** `submitRecruitment`). |
| recruitment switch | `PUT /teams/{team_id}/recruitment/switch` | Body `{ "state": "Open" \| "Closed" }`. |
| apply to team | `POST /teams/{team_id}/applications` | No request body. |
| captain review queue | `GET /teams/{team_id}/applications` | Captain only, Pending rows only. |
| application decision | `POST /applications/{application_id}/decision` | Body `{ "decision": "Approved" \| "Rejected", "reason": "" }`. |
| withdraw application | `POST /applications/{application_id}/withdraw` | Applicant only. |
| team members | `GET /teams/{team_id}/members` | Current team membership required. |
| member contact | `GET /teams/{team_id}/members/{member_id}/contact` | **Captain** required; `member_id` is the **user id**. |
| applicant profile | `GET /applications/{application_id}/applicant-profile` | Captain only, Pending applications only. |

### 1.2 Real routes used by the T4 end-to-end test, outside the student client

| Purpose | Real method + path | Why it is not in the student client |
| --- | --- | --- |
| Moderation queue | `GET /moderation/recruitments` | Administrator surface, belongs to T6. |
| Approve / reject a recruitment revision | `POST /moderation/recruitments/{revision_id}/decision` | Administrator surface, belongs to T6. |
| Delist a published recruitment | `DELETE /moderation/recruitments/team/{team_id}` | Administrator surface, belongs to T6. |

The task states the administrator API is used in the end-to-end test but that the T6 administrator
interface must not be built yet. The student client therefore keeps `moderateRecruitment` and
`getRecruitmentDesignReview` on the Mock path, and the test drives the administrator endpoints with
a real administrator token.

### 1.3 Routes deliberately left on the Mock path

| Operation | Real endpoint | Reason |
| --- | --- | --- |
| `moderateRecruitment` | `POST /moderation/recruitments/{revision_id}/decision` | T6 administrator interface. |
| `getRecruitmentDesignReview` | — | Prototype-only isolation screen (no public equivalent). |
| `listPrototypeActors`, `getPrototypeActor`, `selectPrototypeActor` | — | Local Mock personas; they grant no server authority. |
| Planner, community, notification operations | — | T5 / T7. |

---

## 2. Field-level differences

### 2.1 `TeamCreate` (POST /teams) — the prototype's `CreateTeamInput`

| Prototype `CreateTeamInput` | Real `TeamCreate` | Difference and handling |
| --- | --- | --- |
| `competitionId: string` | `competitionId: string` | Identical. |
| `name: string` | `name: string` (1…150) | Identical. |
| `summary: string` | `summary: string` (1…10000) | Identical. |
| `capacity: number` | `capacity: int` (1…10000) | The real limit is `competition.maxTeamSize`, enforced server-side. |
| `requiredSkills: string[]` | `skillIds: string[]` | **Type change.** The prototype sends skill *names*; the API accepts skill *ids* from the administrator catalog and rejects unknown ids with `INVALID_SKILLS` (422). The adapter resolves names → ids through `GET /skills` and sends `skillIds`. |
| `submitRecruitment: boolean` | `submitRecruitment: boolean` (default `false`) | Identical. The team is created first and the recruitment revision is submitted inside the same transaction. |

The captain is inserted as an `Active` membership in the same transaction, so the captain already
counts towards `capacity` when the team is created.

### 2.2 `TeamOut` / `TeamCreated` — the prototype's `TeamStateSummary` / `MyTeamItem`

| Real field | Prototype field | Handling |
| --- | --- | --- |
| `id`, `name`, `memberCount`, `capacity`, `lifecycle`, `publication`, `recruitmentSwitch` | same names in `TeamStateSummary` | Direct. |
| `competitionId` | `competitionId` | Direct. |
| `captainUsername` | `captainUsername` | Direct. |
| `skills: [{id, name}]` | `requiredSkills: string[]` (names) | Adapter maps to names. |
| `match: 'Matched' \| 'Not Matched' \| null` | `matchStatus: 'Matched' \| 'NotMatched'` | The adapter already normalises `Not Matched` → `NotMatched`. `null` (no viewer skills) also becomes `NotMatched`. |
| — | `competitionTitle` | **Not sent by the API.** Resolved by the client from `GET /competitions`. |
| — | `membershipId`, `membershipStatus`, `membershipRole` | **Not sent by `GET /me/teams`.** Resolved by the client from `GET /teams/{team_id}/members` (the caller is a current member, so the call is authorised) and `GET /me/team-history`. |
| — | `canManageRecruitment`, `canReviewApplications`, `canManageMembers`, `canLeave` | **Not sent by the API.** Derived by the adapter from the membership role: the captain may manage recruitment, review applications and manage members; only a non-captain member may leave. |
| `revision: {...} \| null` (`TeamCreated` only) | — | Present only on the creation response. Describes the recruitment revision created by `submitRecruitment`. |

### 2.3 Recruitment management — the prototype's `RecruitmentManagementView`

The prototype expects one aggregated screen model. The API splits it across three endpoints.

| Prototype field | Real source | Handling |
| --- | --- | --- |
| `teamId`, `memberCount`, `lifecycle`, `publication`, `recruitmentSwitch` | `GET /teams/{team_id}` (`TeamOut`) | Direct. |
| `competitionId` | `GET /teams/{team_id}` | Direct. |
| `competitionTitle`, `competitionMaximumTeamSize` | `GET /competitions/{competition_id}` | Resolved by the client. |
| `effective: RecruitmentSettings` | `GET /teams/{team_id}` | `teamName ← name`, `summary ← summary`, `capacity ← capacity`, `requiredSkills ← skills[].name`. |
| `draft: RecruitmentSettings` | `GET /teams/{team_id}/recruitment/revisions` | The newest revision whose status is `Pending` (or the newest `Rejected` one when no revision is pending). `skillIds` are resolved to names through the skill catalog. |
| `draftRevisionId` | same | The id of that revision. |
| `reviewHistory: [{revisionId, decision, settings}]` | same | Every revision whose status is `Approved` or `Rejected`. The backend spells the decision `Approved` / `Rejected`; the prototype's `RecruitmentModerationHistoryItem` uses exactly the same spelling. |
| `canModerateInPrototype` | — | Always `false` in API mode. Moderation is an administrator capability (T6). |

`RecruitmentSettings` in the prototype carries **skill names**, while the revision payload carries
**skill ids** (`{name, summary, capacity, skillIds}`). This is the single place where the prototype
view model and the wire payload disagree about the shape of a skill list, and it is resolved by an
explicit adapter rather than by sending names to the server.

### 2.4 `ApplicationOut` — the prototype's `ApplicationHistoryItem`

| Real field | Prototype field | Handling |
| --- | --- | --- |
| `id`, `competitionId`, `teamName`, `status` | same | Direct. |
| `reason: string \| null` | `reason?: string` | Adapter omits the key when the server sends `null`. |
| `createdAt` | `submittedDate` | Direct (ISO timestamp). |
| `decidedAt: datetime \| null` | `updatedDate` | `decidedAt ?? createdAt`. |
| — | `teamId` | Present on `ApplicationOut`. Direct. |
| — | `competitionTitle` | Resolved by the client from `GET /competitions`. |
| — | `isCurrentMembership` | Derived: the caller currently holds an `Active` membership for that team (`GET /me/teams`). |
| — | `canWithdraw` | Derived: `status === 'Pending'` and the caller is not already a current member. The server remains the authority. |
| — | `canReapply` | Derived: the status is `Rejected`, `Withdrawn` or `Invalidated`, the caller is not a current member, and the team is not already full. The server re-checks all of it. |

### 2.5 `ReviewOut` — the prototype's `CaptainPendingApplication`

| Real field | Prototype field | Handling |
| --- | --- | --- |
| `id`, `competitionId`, `teamId`, `teamName` | same | Direct. |
| `createdAt` | `submittedDate` | Direct. |
| `applicant: ApplicantPreview` | `applicant: PendingApplicantProfile` | `name`, `college`, `sex`, `briefCv` are nullable in the API and default to `''` in the view model. `skills[].name` → `skillTags`. |
| `match: 'Matched' \| 'Not Matched'` | `matchStatus: 'Matched' \| 'NotMatched'` | Adapter normalises the spelling. |
| `highlightName: boolean` | — | The server marks an unmatched applicant; the view model expresses the same fact through `matchStatus`, so the flag is not carried. |

### 2.6 Decision vocabulary — the mismatch the task calls out

| Prototype | Real API |
| --- | --- |
| `approveApplication(id)` / `rejectApplication(id)` | one endpoint `POST /applications/{application_id}/decision` |
| implied action `approve` | `{"decision": "Approved"}` |
| implied action `reject` | `{"decision": "Rejected"}` |

The prototype's `MockTransport` exposes two separate endpoints
(`/captain/applications/{id}/approve` and `/captain/applications/{id}/reject`); the API exposes one.
The conversion is therefore made **only** in the API branch of the student client, in an explicit
adapter, and the Mock path is untouched. The server rejects any other value with HTTP 422
(`Literal["Approved", "Rejected"]`), so a wrong mapping could not pass silently.

### 2.7 Switch vocabulary

| Prototype | Real API |
| --- | --- |
| `setRecruitmentSwitch(teamId, 'Open' \| 'Closed')` | `PUT /teams/{team_id}/recruitment/switch` with `{"state": "Open" \| "Closed"}` |

The prototype's Mock transport names the field `value`; the API names it `state`.

### 2.8 Member handle — `TeamMemberView.membershipId` and `ActiveMemberContact.membershipId`

The API addresses a member inside a team by the **user id** in every member-scoped route:

- `GET /teams/{team_id}/members/{member_id}/contact`
- `DELETE /teams/{team_id}/members/{member_id}`
- `POST /teams/{team_id}/captain` with `{"memberId": "..."}`

`MemberOut` carries both `id` (the membership row id) and `userId`. The prototype view model has a
single field, `membershipId`, which is the handle the client passes back to member-scoped
operations. The adapter therefore populates it with the **user id**, because that is the value the
server accepts; the Mock path keeps the Mock membership id, which is the value the Mock transport
accepts. The adapter comment states this explicitly so the field is not read as a row id.

### 2.9 `GET /me/team-history` — a real gap found in the backend

The projection returns `{id, teamName, competitionId, status, joinedAt, endedAt, reason}`. It has no
`teamId`, so the client cannot tell which team a past membership belongs to, and `MyTeamsView.history`
cannot be built from the API.

This is a genuine front/back inconsistency rather than a prototype artefact: the endpoint already
returns the team name, so the team id is the missing half. The fix is additive — `teamId` is added
to the projection — and it does not change the OpenAPI document, because the route has no
`response_model` and therefore contributes no schema. A backend regression test is added with it.

### 2.10 Everything else that matched

- `CompetitionDetailDto` ↔ `CompetitionDetail`: `registrationDeadline`, `deadlineStatus`
  (`BeforeDeadline` / `AfterDeadline`), `eligibilityRules`, `maxTeamSize`, `officialSourceUrl`,
  `coverImage`, `published`, `communityId` all exist and are already carried by the T2 adapter.
- `SkillDto` ↔ `SkillOut`: `id`, `name`.
- `MemberOut` ↔ `TeamMemberView`: `id`, `userId`, `teamId`, `username`, `status`
  (`Active` / `Ended`), `role` (`Captain` / `Member`).
- `ContactOut` ↔ `ActiveMemberContact`: `userId`, `wechatId`, `qqId`.
- `ApplicationStatus`, `MembershipStatus`, `RecruitmentPublicationStatus`, `RecruitmentSwitch`,
  `TeamLifecycle` and `CompetitionDeadlineStatus` in `packages/api-contracts/src/enums.ts` are
  already identical to the backend `Literal` types.

---

## 3. Behavioural differences that the UI must surface

| Rule | Backend behaviour | Prototype assumption |
| --- | --- | --- |
| Captain counts towards capacity | The captain is an `Active` membership from the moment the team is created, and `count_members` counts `Active` rows. | The prototype already states "Captain included". |
| Team full | `require_space` raises `TEAM_FULL` (422) on apply and on approve. `close_full_team` then closes the switch and invalidates the remaining `Pending` applications of that team. | The prototype shows "This team is full." |
| One `Pending` application | `uq_pending_application` (`applicant_id`, `team_id`, generated `pending_guard`) plus an explicit check. A second `Pending` raises `DUPLICATE_PENDING` (422). | The prototype shows "A Pending application already exists". |
| New revision delists a published recruitment | `_submit_revision` sets `publication = "Delisted"` when the team already has an approved revision, and the previous `Pending` revision becomes `Superseded`. | The prototype's recruitment page states this. |
| Rejected revision | `publication` becomes `Rejected` (or `Delisted` when a previous revision was already approved); the captain must submit a new revision, and only the latest revision can be moderated (`STALE_REVISION`). | The prototype states that a rejected draft must be resubmitted. |
| Deadline expiry | `expire_competition` invalidates every `Pending` application of the competition and closes every recruitment switch. An approval after the deadline raises `DEADLINE_PASSED` (422). | The prototype shows "Registration closed". |
| Publication states | `Private` (no recruitment yet) → `Pending` (under review) → `Published` (approved) → `Delisted` (revision under review or removed by an administrator) / `Rejected`. | The prototype's `RecruitmentPublicationStatus` already enumerates all five. |
| Match status is guidance only | `Not Matched` never blocks an application; only the team state, capacity, deadline, profile completeness and the one-`Pending` rule do. | The prototype already says "You may apply without an overlap". |
| Profile completeness | `require_complete_profile` demands `name`, `college`, `major`, `academicYear`, `sex`, `briefCv`, at least one skill and at least one contact field. | The prototype has an "incomplete student" persona. |

---

## 4. Consequence for the implementation

1. The shared contracts gain DTOs for the recruitment revision payload, the revision list, the team
   creation result and the team history, plus adapters that produce `MyTeamItem`,
   `ApplicationHistoryItem`, `RecruitmentManagementView` and `TeamOperationsView`.
2. The student client keeps the prototype's `MockCommandResult` envelope so that the screens do not
   change shape; in API mode the envelope reports the server's own error code and message.
3. The screens stop using the hard-coded Mock skill list and the hard-coded Mock team ids, and they
   stop offering the Prototype Lab in API mode, because a Mock persona must never be mistaken for a
   server-authorised identity.
4. The administrator moderation step is exercised through the real administrator API inside the
   end-to-end test, not through a student screen.
