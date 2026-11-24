# WeChat Mini Program Readiness — T9 preparation

This directory records the WeChat mini program preparation and the compatibility
audit that was carried out on 2026-11-24 on the branch `feat/9-weixin-readiness`,
which was branched from `sprint/alpha` at `d78ac52`.

**This round prepares for T9. It does not close T9.** Issue
[#9](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/9) is still open,
nothing was published to the WeChat platform, no review was submitted, and T5, T6 and T7
were not started.

| Field | Value |
| --- | --- |
| Issue | [#9](https://github.com/26-SoftwareEngineering-CodeStrike/code-strike/issues/9) — T9 [P1] MP-Weixin Build Check & Docs |
| Branch | `feat/9-weixin-readiness`, branched from `sprint/alpha` at `d78ac52` |
| AppID | `wxa551256ce5fab6a7` |
| Toolchain | uni-app compiler 5.26 (vue3), Node v22.23.2, pnpm 11.24.0, Python 3.13.9 |
| WeChat Developer Tools | **not installed on this machine** |
| Executed | 2026-11-24 (UTC timestamps are inside every log) |

## What was done

The AppID was written into the mini program configuration, the package was built in both
transport modes, the built package was inspected field by field, the platform compatibility of
the client was audited against the documented mini program API, and the deployment posture of
the backend was audited. Nothing was deployed and nothing was published.

## The AppID configuration

`apps/student-app/src/manifest.json` carries the AppID and the project name:

```json
"mp-weixin" : {
    "appid" : "wxa551256ce5fab6a7",
    "setting" : { "urlCheck" : true },
    "usingComponents" : true
}
```

The top level `name` was empty, so the built package carried `"projectname": ""`. It is now
`"CodeStrike"`. The `app-plus`, `mp-alipay`, `mp-baidu`, `mp-toutiao` and `quickapp` blocks
were not touched.

**`urlCheck` was `false` and is now `true`.** The old value told the developer tools to skip
the legal domain check. The committed and uploaded package now keeps the check on, so the
package behaves on the simulator the way it behaves on a phone. If a developer has to turn the
check off to test before the domain is registered, that is a local toggle in the developer
tools and it must not be committed.

The built `project.config.json` confirms all of it:

| Field | Value |
| --- | --- |
| `appid` | `wxa551256ce5fab6a7` |
| `projectname` | `CodeStrike` |
| `compileType` | `miniprogram` |
| `setting.urlCheck` | `true` |

| Version field | Value | Where it appears |
| --- | --- | --- |
| `versionName` | `1.0.0` | `manifest.json` |
| `versionCode` | `100` | `manifest.json` |

The version fields do not reach the mini program package: `app.json` of a WeChat mini program
carries no version field, and the upload version is set in the WeChat console when the package
is uploaded. The values in the manifest are the app level ones and are used by the H5 and app
builds.

## The build

| Build | Command | Result |
| --- | --- | --- |
| Workspace type check | `pnpm type-check` | exit 0 |
| Mini program, Mock mode | `pnpm build:student:mp-weixin` | exit 0 |
| Mini program, API mode | `VITE_USE_MOCK=false pnpm build:student:mp-weixin` | exit 0 |
| H5, Mock mode | `pnpm build:student:h5` | exit 0 |
| H5, API mode | `VITE_USE_MOCK=false pnpm build:student:h5` | exit 0 |

The mini program package was inspected by `scripts/verify-t9-weixin-build.mjs`, which reads the
build output and reports what it finds:

| Check | Mock mode | API mode |
| --- | --- | --- |
| The AppID is the expected one | PASS | PASS |
| The project name is not empty | PASS | PASS |
| The legal domain check is enabled | PASS | PASS |
| The package is a mini program | PASS | PASS |
| `app.json` lists its pages | PASS — 17 pages | PASS — 17 pages |
| Every page has its four compiled files | PASS — 17 complete | PASS — 17 complete |
| The static directory is present | PASS | PASS |
| The main package is under the 2 MB limit | PASS — 342 KiB | PASS — 342 KiB |
| Exactly one transport mode is compiled in | PASS — Mock | PASS — API |
| The compiled base url is usable on a device | n/a in Mock mode | PASS — https |

The transport mode really is compiled into the bundle. Vite replaces `import.meta.env` with
the literal values, so the Mock build carries an empty environment object and the API build
carries the mode and the base url:

```js
// Mock build
var Qc = {}

// API build
var Qc = { VITE_API_BASE_URL: "https://api.example.invalid/api/v1", VITE_USE_MOCK: "false" }
```

The environment is read through the literal member expression `import.meta.env` in
`packages/api-contracts/src/config.ts`, which is the form the bundler replaces. Reading it
through an alias would leave it unresolved and the app would silently stay in Mock mode.

**The API base url in the committed evidence is `https://api.example.invalid/api/v1`.** That is
a placeholder that exists to prove that the value reaches the bundle. It is not a deployment
target. A real build uses the https domain of the API, which has to be registered as a legal
domain in the WeChat console before the build.

## The WeChat Developer Tools

They are **not installed** on this machine. `scripts/verify-t9-weixin-devtools.mjs` checked the
eleven directories the tools are normally installed in and found none of them, and the
uninstall registry has no entry for them either. The full output is in
`logs/devtools-availability.txt`.

Nothing was installed. The tools are a large download from the official page, and running an
installer that was fetched and executed without a decision from the person who owns the machine
is not a decision this round is allowed to make.

The official download page is
<https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>. That page could not
be reached from this workspace, so the address is given as it is published rather than as a
link that was verified from here.

## The platform compatibility audit

`scripts/verify-t9-weixin-compatibility.mjs` reads the client source and compares every HTTP
method it can send with the method set the mini program documents. The full output is in
`logs/compatibility-audit.txt`.

| Area | Finding |
| --- | --- |
| `uni.request` HTTP methods | 32 of the 33 calls use `GET`, `POST`, `PUT` or `DELETE`, all of which the mini program documents. **One call uses `PATCH`.** |
| The `PATCH` call | `apps/student-app/src/api/client.ts:974` — `saveProfile` sends `PATCH /profiles/me`. `PATCH` is not in the documented method set of the mini program. **The behaviour on the simulator or a device is Not Verified**, because the developer tools are not installed here. |
| The documented method set | The uni-app type definition of `uni.request` (`@dcloudio/types@3.4.32`) lists `OPTIONS, GET, HEAD, POST, PUT, DELETE, TRACE, CONNECT`. `PATCH` is not in it. |
| The `uni.*` APIs in use | `navigateTo`, `reLaunch`, `redirectTo`, `navigateBack`, `showModal`, `showToast`, `setClipboardData`, `request`, `getStorageSync`, `setStorageSync`, `removeStorageSync`. All of them exist in the mini program. |
| Browser DOM APIs | None. The only occurrence of `localStorage` is a comment in `token-store.ts`. |
| Bearer token storage | `uni.setStorageSync` / `getStorageSync` / `removeStorageSync`, which is the key/value store of the mini program. The raw token is never held in a reactive value and never rendered. |
| Registration and sign-in | The account flow runs on the shared client. It is exercised against the real API in `logs/screenshots.txt`. The rendering on a mini program is **Not Verified**. |
| Profile read and save | The profile is read and written through the API. `saveProfile` is the one call that depends on `PATCH`, see above. |
| Skill tags | The catalogue comes from `GET /skills` and the tags are stored through the profile. The write path is the same `PATCH` call. |
| Competition discovery | `GET /competitions` and the detail route. Verified against the real API. |
| Team creation | `POST /teams`. Verified against the real API. |
| Recruitment and application | `POST` on the revision, application and decision routes. All documented methods. |
| Captain review | `GET` on the queue and `POST` on the decision. All documented methods. |
| Page lifecycle | `onLoad` and `onShow` only. Both exist in the mini program. |
| Custom bottom navigation | The package declares **no** native `tabBar`. The navigation is drawn by `CsBottomNav` and navigates with `uni.reLaunch`. It works on the mini program, but every tap closes the page stack and opens the target again, which is slower and loses the page state. The icons are drawn with `<view>` elements, so no icon font is needed. |
| Safe area and scrolling | The bottom navigation and every page that sits above it reserve `constant(safe-area-inset-bottom)` and `env(safe-area-inset-bottom)`. The pages scroll, the navigation is `position: fixed`. |
| Accessibility attributes | `role` and `aria-label` are written on `<view>` elements. They are meaningful in the H5 build and are inert in the mini program, where the equivalents are `aria-role` and `aria-label`. They are harmless but they do not help a screen reader there. |

### The `PATCH` finding, in full

`saveProfile` sends `PATCH /profiles/me`. The mini program documents
`OPTIONS, GET, HEAD, POST, PUT, DELETE, TRACE, CONNECT` and does not document `PATCH`.
Whether the platform refuses the request or passes it through cannot be settled from here,
because that needs the simulator or a device.

**The switch to `PUT` is not a one-line change, and this round did not make it.** The two
routes on the backend are not the same:

| Route | The service call | What it does |
| --- | --- | --- |
| `PATCH /profiles/me` | `save_profile(..., partial=True)` | `model_dump(exclude_unset=True)`, so only the fields that were sent are written. A field that is left out keeps its value. |
| `PUT /profiles/me` | `save_profile(..., partial=False)` | `model_dump(exclude_unset=False)`, so every field is written. Every field of `ProfileUpdate` has an empty default, so a field that is left out is **cleared**. |

`skill_ids` behaves the same way: it defaults to an empty list, so a `PUT` without it deletes
every skill row of the profile.

The client currently sends all eleven fields on every call, so a `PUT` would work for the
profile screen as it stands. But `ProfileUpdateRequest` in
`packages/api-contracts/src/api/dto.ts` makes every field optional, and the end-to-end test
`apps/student-app/tests/e2e/auth-profile-e2e.test.mjs` calls
`api.saveProfile({ skillIds: [python.id] })` with a partial body on purpose. A `PUT` there
would wipe the name, the college and the rest of the profile of that account.

So a switch to `PUT` needs three things together: the client sends the whole profile, the
contract makes the fields required so a partial body cannot compile, and the test is rewritten
to send the whole profile. That is a change to the profile contract of T3 and belongs to the
task that owns the profile, not to a preparation round. It is recorded here so the decision is
made on purpose.

## The deployment readiness audit

`scripts/verify-t9-deployment-readiness.py` reads the deployment posture of the backend. The
full output is in `logs/deployment-readiness.txt`. **Nothing was deployed.**

| Area | Finding | What a production instance needs |
| --- | --- | --- |
| The backend process | FastAPI under uvicorn, started with `app.main:app`. The local runner loads the git ignored `apps/server/.env` into the environment so no credential reaches a command line. | The same command under a process manager. `apps/server/README.md` still names `.venv`, while the venv in this workspace is `.test-venv`. |
| Migrations | Alembic is present, `alembic_version` is at head `0001`. | `alembic upgrade head` as a release step, before the new instance takes traffic. |
| The environment file | The template carries `DATABASE_URL`, `ENABLE_DOCS`, `CORS_ORIGINS`, `TOKEN_TTL_SECONDS` and the SMTP settings. **`APP_NAME` and `APP_ENV` are read by the settings but are not in the template.** | Add them to `apps/server/.env.example`. |
| The OpenAPI document | `ENABLE_DOCS` defaults to `true`, so the routes are readable on a public instance. | `ENABLE_DOCS=false`. |
| `APP_ENV` | It is read into the settings and used for **no** behaviour at all, so it cannot separate a production instance from a local one. | Either use it, or accept that the separation is made by the environment file alone. |
| The API base url | The default is `http://127.0.0.1:8000/api/v1`. A loopback address points at the phone itself on a device, and a plain `http` address is refused outside the developer tools. | The build has to set `VITE_API_BASE_URL` to the https domain of the API, and that domain has to be the one that is registered. |
| The legal domains | A mini program refuses a request to a domain that is not registered. Three entries are needed: `request` for the API, `uploadFile` for the uploads and `downloadFile` for the stored images. | Register them in the WeChat console under **Development → Development Settings → Server Domains**. The domain has to be known before the build, because it is compiled into the bundle. |
| CORS | The list holds the origins of the **browser** client only. A mini program is not a browser origin and is not affected by it. | No change for the mini program. The H5 deployment still needs its own origin in the list. |
| Images | The client sends the picture base64 encoded inside the JSON body, the backend validates the structure and stores the bytes in a binary column of `content_images`, and `GET /content/images/{image_id}` serves them back. The size limit is 5 MiB per picture and 16 megapixels. | Move the bytes to object storage and keep only the reference in the database. The database grows with every picture, the base64 body is about a third larger than the picture, and a mini program should use `wx.uploadFile` rather than a large JSON body. |
| The privacy of the images | A picture that is not public is served only to its owner and to an administrator, and a picture that does not exist answers `404` rather than `403`, so the endpoint does not confirm that it exists. | Keep this gate when the storage moves. The registered `downloadFile` domain is the one that serves the pictures. |
| User content | Posts, comments and competition submissions are all written as a revision with the status `Pending`, and an administrator decides on it. Nothing is public before that decision. | Keep the pre-moderation. The moderation screen itself is T6. |
| The credentials | Passwords are stored as `pbkdf2_sha256` with 600 000 iterations and a random salt, and the comparison is constant time. A session token is stored as a SHA-256 digest, never in the clear. | Keep these. A production instance needs a secret key of its own for the token digest, and the token lifetime of 86400 seconds has to be a decision rather than the default. |
| The administrator account | `apps/server/scripts/provision_admin.py` prompts for the password with `getpass`, so it never appears in a command line, and it refuses to change an existing account. | Run it once against the production database. The moderator account is not created by a migration. |
| The deadline worker | `apps/server/scripts/expire_deadlines.py` is a supervised worker, and the deadline check also runs on admission. | Run it as a service next to the API. |
| The deployment artifacts | There is no `Dockerfile`, no `docker-compose.yml` and no reverse proxy definition. | A container or a service unit, and a TLS terminating proxy in front of uvicorn. |
| The separation from the local environment | The database, the credentials and the compiled base url are the three things that have to differ between a local and a production instance. None of them is separated by a setting today. | A separate database and a separate credential set. The compiled base url is already a build time input, so it differs by construction. |

No database port, no credential and no development data appears in this directory. The audit
reads committed files only, and the git ignored `apps/server/.env` was never printed.

## What was NOT verified

- **The mini program was never started.** The WeChat Developer Tools are not installed here, so
  no mini program screen exists. Every screen in this directory comes from the H5 production
  bundle, and each of them carries a banner on the image itself that says so.
- **The rendering of the mini program is Not Verified.** The layout, the fixed navigation, the
  safe area, the input fields and the scroll behaviour were proven on the H5 build only.
- **The behaviour of `PATCH` on the platform is Not Verified.** See the finding above.
- **The WeChat login was not touched.** The account flow stays the account and password flow
  that T3 delivered. No WeChat one-tap login was introduced, because it would be a new
  mandatory requirement rather than a preparation step.
- **Nothing was deployed, published or submitted for review.** The WeChat console was not
  touched, no domain was registered, and no AppSecret was requested, read or written
  anywhere. The AppID is not a secret; the AppSecret was not needed for any step of this round
  and was not asked for.
- **No CI is configured in this repository**, so no CI run backs any result in this directory.

## The evidence

| File | What it is |
| --- | --- |
| `screenshots/A5_MP_01_Build_Result.png` | The type check, the mini program build and the package verification, rendered from `logs/build-result.txt` |
| `screenshots/A5_MP_03_Competition_Home.png` | The competition home, listing the competitions the API returns. **H5 bundle**, banner on the image |
| `screenshots/A5_MP_04_Account_Login.png` | The account sign-in form in API mode. **H5 bundle**, banner on the image |
| `screenshots/A5_MP_05_Profile_API_Test.png` | The profile, read back from the API after the sign-in above. **H5 bundle**, banner on the image |
| `logs/type-check.txt` | The workspace type check |
| `logs/build-mp-weixin.txt`, `logs/build-mp-weixin-api.txt` | The mini program build in both transport modes |
| `logs/verify-build-mp-weixin-mock.txt`, `logs/verify-build-mp-weixin-api.txt` | The built package, field by field, in both transport modes |
| `logs/build-h5-mock.txt`, `logs/build-h5-api.txt`, `logs/build-h5-api-local.txt` | The H5 builds, including the one against the local API that the screens were taken from |
| `logs/compatibility-audit.txt` | Every HTTP method the client sends, against the documented mini program method set |
| `logs/devtools-availability.txt` | The check that the WeChat Developer Tools are not installed |
| `logs/deployment-readiness.txt` | The deployment posture of the backend |
| `logs/manifest-config.txt` | The committed mini program configuration |
| `logs/build-result.txt`, `logs/render-build-result.txt` | The log the build result picture is rendered from, and the render itself |
| `logs/screenshots.txt` | The three screens, with the API calls they made |

`A5_MP_02_DevTools_Import.png` does not exist, because the import into the developer tools was
never performed. The picture would have to show the developer tools, and they are not
installed.

Every log was produced by `scripts/collect-t9-evidence.sh`, which records the command, the
branch, the SHA, the UTC execution time, the raw output and the real exit code in every file.
The whole directory can be rebuilt with one command, with the backend and the isolated MySQL
8.4 instance running.

The SHA inside the logs is `d78ac52`, the `sprint/alpha` commit this branch was cut from and
the state of the working tree when the commands ran. The commit that carries this directory
comes after it, in the same way the T4 evidence was recorded against the SHA of the
implementation it belongs to.

## The scripts

| Script | What it does |
| --- | --- |
| `scripts/collect-t9-evidence.sh` | Runs every check in this directory and writes the logs and the pictures |
| `scripts/verify-t9-weixin-build.mjs` | Inspects a built mini program package: the AppID, the project name, the legal domain check, the pages, the assets, the size and the compiled transport mode |
| `scripts/verify-t9-weixin-compatibility.mjs` | Compares every HTTP method the client sends with the documented mini program method set |
| `scripts/verify-t9-weixin-devtools.mjs` | Reports whether the WeChat Developer Tools are installed, and where they would be imported from |
| `scripts/verify-t9-deployment-readiness.py` | Reads the deployment posture of the backend |
| `scripts/collect-t9-weixin-evidence.mjs` | Captures the three screens from the H5 bundle against the running backend |
| `scripts/render-evidence-log.mjs` | Renders a captured log into a PNG |

## Secrets

No AppSecret, token, password, hash or email address appears in this directory. The AppID is
not a secret: it is the public identifier of the mini program and it has to be written into
the manifest. The account the screen run creates uses a generated throwaway password, and the
screenshots show the password field masked.
