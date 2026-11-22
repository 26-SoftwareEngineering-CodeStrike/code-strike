# Contract differences found between the prototype and the FastAPI backend

The prototype view models in `packages/api-contracts/src/types.ts` were written for the
Assignment 4 screens. The FastAPI backend was written for the Assignment 5 API. The two
describe the same domain but not the same wire format. Every difference found while
comparing the served `openapi.json` (58 paths, 78 operations, 47 schemas) against the
shared contracts is listed here with the way it is handled.

Nothing was resolved by loosening a type with `any`, and no prototype field was deleted.

## Resolved by an explicit adapter

| # | Prototype view model | Backend schema | Difference | Handling |
| --- | --- | --- | --- | --- |
| 1 | `CompetitionSummary.eligibilitySummary` | `CompetitionDetail.eligibilityRules` | The backend sends the full rule text, the prototype shows a summary. | `summarizeEligibility` trims whitespace and caps the length at 120 characters. |
| 2 | `CompetitionSummary.coverTone` | — | The backend has no cover tone; it stores `coverImage` only. | `deriveCoverTone` derives a stable tone from the competition id. It is a presentation field, not backend data. |
| 3 | `CompetitionDetail.eligibility` | `CompetitionDetail.eligibilityRules` | Different field name. | `toCompetitionDetail` maps the rules onto the prototype wording. |
| 4 | `CompetitionDetail.maximumTeamSize` | `CompetitionDetail.maxTeamSize` | Different field name. | Same adapter. |
| 5 | `CompetitionDetail.community` counters | — | The backend exposes no aggregate discussion or resource counters. | The adapter takes the counts it is given and reports zero for the counters the backend does not publish. `publishedRecruitmentCount` is filled from the competition recruitment listing. |
| 6 | `RecruitmentSummary.requiredSkills` | `TeamOut.skills` (`SkillOut[]`) | The backend sends skill objects, the prototype shows names. | `toRecruitmentSummary` maps `skills[].name`. |
| 7 | `SkillMatchStatus` = `Matched` / `NotMatched` | `TeamOut.match` = `Matched` / `Not Matched` | The backend puts a space in the unmatched state. | `toSkillMatchStatus` normalises the spelling. |
| 8 | `RecruitmentAvailability` | `TeamOut.lifecycle`, `publication`, `recruitmentSwitch` | The prototype derives one availability value from three backend fields. | `toRecruitmentAvailability` applies the documented order: dissolved or unpublished is `Delisted`, a passed deadline is `RegistrationClosed`, a closed switch is `ManuallyClosed`, a full team is `Full`, otherwise `Open`. |
| 9 | `TeamMemberView.membershipId` | `MemberOut.id` | Different field name. | `toTeamMemberView` maps the membership identifier. |
| 10 | `ActiveMemberContact.membershipId`, `memberName` | `ContactOut.userId`, `wechatId`, `qqId` | The contact payload carries the user, not the membership, and no display name. | `toActiveMemberContact` takes the membership and the member name from the membership list the caller already holds. |
| 11 | `PendingApplicantProfile.skillTags` | `ApplicantPreview.skills` | Different field name. | `toPendingApplicantProfile` maps the skill names. The five permitted applicant fields are unchanged. |
| 12 | `CaptainPendingApplication.submittedDate` | `ReviewOut.createdAt` | Different field name. | `toCaptainPendingApplication` maps the creation time. |
| 13 | `PlannerOccurrence.type` | `ItemOut.kind` | Different field name. | `toPlannerOccurrence` maps the kind. |
| 14 | `PlannerOccurrence.actualDate` | `ItemOut.date` | Different field name. | Same adapter. |
| 15 | `PlannerOccurrence.batchId` | `ItemOut.recurrenceId` | The backend may leave the recurrence empty. | The adapter falls back to the item id. |
| 16 | `DashboardData.competitions` | `GET /dashboard` returns `CompetitionDetail[]` | The dashboard returns full competition objects, the view model wants summaries. | `toDashboard` maps each entry through `toCompetitionSummary`. |
| 17 | `ApiErrorPayload` | backend envelope `{code, message, details?}` | The backend does not send a request identifier. | `ApiError` keeps `requestId` empty unless the response carries `x-request-id`. |

## Deliberately not represented as a shared DTO

- `HealthResponse` already matched the backend schema exactly, so it stayed in
  `types.ts` and was not duplicated.
- `DashboardDto` has no OpenAPI schema: `GET /api/v1/dashboard` returns a plain object
  without a response model. The DTO mirrors the served body and is checked by the live
  test rather than by the schema comparison.
- `SchoolPeriod` has no backend counterpart. The backend stores start and end period
  numbers but publishes no period table, so the prototype's period list stays on the
  mock surface.

## Observed backend behaviour worth recording

- Framework level failures answer with `{"code": "HTTP_ERROR", "message": "..."}`. A
  missing route therefore reports `HTTP_ERROR` with status 404, not `NOT_FOUND`. The
  transport keeps the code the server sent and only falls back to the documented status
  default when the body carries no envelope.
- The domain vocabulary of the backend (`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
  `CONFLICT`, `VALIDATION_ERROR`, `DATABASE_UNAVAILABLE`) is the one the shared status
  table repeats, so both clients speak one vocabulary.

## Differences left open for later sprint tasks

- The prototype operations that the backend does not serve (actor switching, captain
  review queue, member contacts, planner views) keep the mock path table. In API mode
  they report `NOT_AVAILABLE_IN_API_MODE` instead of calling a route that does not exist.
  The backend equivalents are the work of T3, T4 and T7.
- `GET /api/v1/me/teams` returns `TeamOut[]` without the membership identifier, status
  and role the prototype's `MyTeamItem` shows. The adapter for that view model belongs
  to T4.
- The planner occurrences are grouped by `recurrenceId` in the backend, while the
  prototype numbers the occurrences inside a batch. The adapter accepts the numbers from
  the caller; the grouping itself is T7 work.
