# WeChat Developer Tools — git management and the first uploaded version

This directory records what was executed on 2026-11-24 on the branch
`feat/9-devtools-git-release`, which was branched from `sprint/alpha` at `ec37402`.

**The WeChat Developer Tools are installed on this machine now.** They were not installed when
`t9-weixin-readiness` was recorded, and that directory still says so. The tools are at
`D:\Program Files\Apps\Tencent\微信web开发者工具`, version `2.02.2609250 Stable`, and an account
is signed in.

**A version was uploaded to the WeChat platform.** Version `1.0.0` is in the WeChat console as
the development version. It was **not** submitted for review and it was **not** released to the
users; that is a decision for the account holder and it needs the console.

## What the problem was

The mini program is a uni-app project, so the developer tools can only open a **built** package.
The built package lives in `apps/student-app/dist/build/mp-weixin`, and `dist/` is git ignored.
A developer tools project opened there therefore has **nothing for its version management panel
to show**: every file in it is ignored by git, so the panel cannot commit, cannot push and cannot
pull. The team could not work on the mini program from the tools at all.

## What was done

`apps/student-app/project.config.json` was added to the **source tree**. It carries the AppID,
the project name and:

```json
"miniprogramRoot": "dist/build/mp-weixin/"
```

The developer tools are now opened on `apps/student-app`. The mini program still runs from the
built package, but the **project the tools manage is the source tree**, which sits inside the
`code-strike` repository. The version management panel works on the repository, so the team can
commit, push and pull from the tools, and every member of the organisation works on the same
branch.

`project.private.config.json` is the per developer part of the configuration. It is **git
ignored** now, so a personal setting on one machine does not travel to the others.

The uni-app build does not touch the source level `project.config.json`: it writes its own into
the output directory and keeps it there. The two files are independent.

## The evidence

### The developer tools resolved the project to the repository

`logs/devtools-git-repository.txt` is the log of the git extension **inside** the developer
tools. It is the tools' own record, not a reconstruction:

| Line | What it means |
| --- | --- |
| `Using git "2.53.0.windows.2"` | the tools found the git on this machine |
| `git rev-parse --show-toplevel` | the tools asked git where the repository is |
| `Open repository: d:\Project\VSCode\code-strike` | the answer: the monorepo |
| `git for-each-ref ... refs/heads/sprint/alpha` | the branch is read, with its upstream |
| `git status -z -uall` | the working tree status is tracked, and it repeats as the tree changes |

The file tree in the tools shows the same thing: the new `project.config.json` carries the git
decoration **U** for untracked, which only appears when the tools have resolved the project to a
git repository. See `screenshots/A5_MP_06_DevTools_Project.png`.

### The project setup checks out

`scripts/verify-t9-devtools-project.mjs` checks the whole setup in one command. The run is in
`logs/devtools-project-check.txt`, and every one of the thirteen checks passed:

| Check | Result |
| --- | --- |
| `project.config.json` is in the source tree | PASS |
| the AppID is `wxa551256ce5fab6a7` | PASS |
| the project name is not empty | PASS |
| the package type is a mini program | PASS |
| the legal domain check is enabled | PASS |
| `miniprogramRoot` is declared | PASS |
| the mini program root exists | PASS |
| the mini program root holds the built package | PASS |
| the built package carries the same AppID | PASS |
| the project directory is inside a git repository | PASS |
| the branch is readable from the project directory | PASS — `sprint/alpha` |
| the developer tools command line is installed | PASS |
| an account is signed in to the developer tools | PASS — `{"login":true}` |

The script is read only by default. The `--login` flag adds the last check, and that one starts
the IDE if it is not running, so it is not done unless it is asked for.

### The version was uploaded

`logs/upload-version-1.0.0.txt` is the raw output of the upload:

| Field | Value |
| --- | --- |
| Version | `1.0.0` |
| AppID | `wxa551256ce5fab6a7` |
| Package size | 591.5 KB (605666 bytes) |
| Result | `✔ upload`, exit 0 |

The description was written in Chinese. The console echoed it through the machine's code page,
which renders the characters as mojibake, so the string was read back out of PowerShell as UTF-8
and compared byte for byte with the source file. The comparison came out identical. The
characters that reached the platform are the ones in the log.

## The mini program in the simulator

The tools compiled the package and the mini program started. The tools' own log records
`[appservice] simulator launch success` and `appservice webview loadstop`, and the debugger
shows the compiled Wxml tree of the index page:

```
<pages/index/index>
  #shadow-root
</pages/index/index>
```

`build` reads **100** and no compile error appears in the tools' log. See
`screenshots/A5_MP_07_DevTools_Simulator.png`.

**What was NOT verified:** the rendered screen was not photographed. The developer tools window
is wider than the screen of this machine, so the simulator pane was cut off in every capture,
and the automated clicks that were meant to reach the panel landed on another window instead.
The page is proven to compile, to boot and to build its Wxml tree, and the package is proven to
upload. What the screen looks like is **Not Verified**.

**The console was not read.** The debugger tab carries a badge of **2,3**. The contents of that
badge were not opened, so this directory does **not** claim that the console is clean. Reading
it is the obvious next check, and the automation port of the tools
(`cli auto --project apps/student-app --auto-port <port>`) is the way to read it without a
mouse.

## What was NOT done

- **The version was not submitted for review and was not released.** The upload put `1.0.0` in
  the console as the development version. Submission and release are console actions that need
  the account holder.
- **No member was added to the WeChat console.** The organisation's members still have to be
  added under **管理 → 成员管理** in <https://mp.weixin.qq.com> before they can open the trial
  version or upload their own.
- **The WeChat co-development mode was not enabled.** It needs the AppID to be bound to a
  Tencent organisation with its own git service, which is a console decision. The git
  synchronisation the team uses today is the GitHub repository, and the tools now point at it.
- **The API mode was not uploaded.** The uploaded version carries the mock transport. There is
  no deployed https API and no registered legal domain, so an API build would fail on a device.
  The domain has to be registered in the console **before** the build, because it is compiled
  into the bundle.
- **The base library is pinned to `3.17.6`** in the shared configuration, which is the version
  the tools on this machine resolved. A member whose tools do not have it will download it.

## How the team uses it

| Step | Command |
| --- | --- |
| get the code | `git clone https://github.com/26-SoftwareEngineering-CodeStrike/code-strike.git` then `pnpm install` |
| build the mini program | `pnpm build:student:mp-weixin` |
| check the setup | `node scripts/verify-t9-devtools-project.mjs` |
| open it | WeChat Developer Tools → 导入项目 → the directory `apps/student-app` |
| work on it | the 版本管理 panel of the tools: branch, commit, push, pull |
| upload a version | `cli upload --project apps/student-app -v <version> -d "<description>"` |

The git proxy on this machine is not the one in the git config. Use the working one per
command: `git -c http.proxy=http://127.0.0.1:12000 -c https.proxy=http://127.0.0.1:12000 push`.

## The files

| File | What it is |
| --- | --- |
| `logs/devtools-project-check.txt` | the run of `scripts/verify-t9-devtools-project.mjs --login` |
| `logs/devtools-git-repository.txt` | the excerpt of the git extension log inside the developer tools |
| `logs/upload-version-1.0.0.txt` | the raw output of the upload of version `1.0.0` |
| `screenshots/A5_MP_06_DevTools_Project.png` | the project open in the tools, the source tree with the git decoration |
| `screenshots/A5_MP_07_DevTools_Simulator.png` | the debugger, the compiled Wxml tree of the index page |

## Secrets

No AppSecret, token, password or personal account identifier appears in this directory. The
AppID is not a secret: it is the public identifier of the mini program and it is written into
the manifest. The screenshot shows the project name, the file tree and the Wxml tree, and
nothing else.
