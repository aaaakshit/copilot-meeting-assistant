# Copilot Meeting Assistant

[![CI](https://github.com/aaaakshit/copilot-meeting-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/aaaakshit/copilot-meeting-assistant/actions/workflows/ci.yml)

A local-first Windows desktop overlay that listens to system audio, transcribes
speech locally, detects interview questions and coding prompts, and streams
grounded responses from the GitHub Copilot SDK.

This is an independent project. It is not affiliated with or endorsed by
GitHub. Use it only where assistance is permitted, disclose its use when
required, and follow the rules of the meeting or interview platform.

## Highlights

- Always-on-top, transparent Electron overlay
- Windows system-audio capture through WASAPI loopback
- Local Whisper transcription with rolling multi-segment question detection
- General interview and coding interview modes
- Resume, job description, and STAR evidence grounding
- Screen-aware answers through an explicitly captured image attachment
- Warm, isolated Copilot sessions for low-latency follow-up questions
- TypeScript end to end with strict validation and streamed responses
- Screen-capture protection where supported by Windows and the meeting client
- Real Electron launch, renderer, and graceful-shutdown smoke test

## Privacy model

The desktop application is local-first:

| Data | Stored locally | Sent to GitHub Copilot |
| --- | --- | --- |
| System audio | Processed in memory | No |
| Whisper model | Electron user-data directory | No |
| Transcript | Renderer memory | Only detected/selected question text |
| Candidate profile | Browser `localStorage` | Yes, when generating a general answer |
| Screen image | Not persisted by the app | Only when screen-aware generation is requested |
| Generated answer | Renderer memory | Returned by Copilot |

The repository contains no credentials, user profiles, transcripts, screenshots,
model files, or application caches. Real tokens must remain in the user's
environment or existing GitHub/Copilot credential store.

See [docs/PRIVACY.md](docs/PRIVACY.md) and [SECURITY.md](SECURITY.md) before
changing data flows.

## Requirements

- Windows 10 or Windows 11 for loopback audio capture
- Node.js `^20.19.0` or `>=22.12.0`
- npm
- A GitHub account with Copilot access
- One supported authentication source:
  - existing Copilot CLI sign-in
  - GitHub CLI credentials
  - `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_TOKEN`

The Copilot SDK bundles its runtime. A global Copilot CLI installation is not
required after authentication has been established.

## Quick start

```powershell
npm ci
npm run desktop:start
```

The first transcription downloads the Whisper Tiny English model into the
Electron user-data directory.

### General interview mode

1. Open **Profile**.
2. Add resume highlights or evidence stories, or select **Load demo**.
3. Return to **Live** and choose **Interview**.
4. Select **Start listening** or type a question manually.
5. Keep **Auto-answer detected questions** enabled for automatic generation.

### Coding mode

1. Choose **Coding**.
2. Select a language or keep **Auto-detect**.
3. Start listening, type a coding prompt, or select **Read screen**.
4. Copilot returns an approach, solution, complexity analysis, and interview
   notes.

Coding mode does not require candidate evidence.

## Controls

| Control | Action |
| --- | --- |
| **Start listening** | Capture the primary display and default system output |
| **Read screen** | Capture the current display and answer its visible prompt |
| **Use latest** | Copy the latest transcript segment into the prompt editor |
| `Ctrl+Shift+Enter` | Read the screen from any application |
| `Ctrl+Shift+Space` | Hide or show the overlay |
| Pin button | Toggle always-on-top behavior |
| Blend button | Change overlay visibility |

Content protection is defense in depth, not a guarantee. Some capture tools may
show a blank area or ignore operating-system protection. Sharing a specific
meeting window is safer than sharing the entire desktop.

## Architecture

The renderer follows a React-adapted Model-View-Presenter pattern:

```text
Passive React views
        |
        v
useDesktopPresenter
        |
        +--> Domain model: question detection and audio segmentation
        +--> Electron preload bridge
                    |
                    +--> Local Whisper transcription
                    +--> Screen and loopback capture
                    +--> Copilot answer generator
```

| Layer | Responsibility |
| --- | --- |
| Model | Domain state, capture services, speech segmentation, and question detection |
| View | Passive React components that render model data and invoke actions |
| Presenter | Coordinates state, persistence, capture, IPC, and answer generation |

The Electron main process keeps Node.js isolated from the renderer with
`contextIsolation`, renderer sandboxing, a narrow preload bridge, schema
validation, denied tool permissions, and a restrictive content security policy.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for component boundaries,
lifecycle behavior, and data flow.

## Repository structure

```text
electron/                 Electron lifecycle, IPC, preload, transcription
server/                   Copilot client, prompts, validation, HTTP API
shared/                   Cross-process contracts
src/
  components/             Browser UI components
  desktop/
    model/                Domain classes and pure model helpers
    presenter/            React presenter hook
    view/                 Passive desktop views and styles
  lib/                    Browser API and persistence helpers
scripts/                  Deterministic local/CI smoke tests
docs/                     Architecture and privacy documentation
.github/                  CI and dependency update policy
```

## Development

Browser and API development:

```powershell
npm run dev
```

Desktop development:

```powershell
npm run desktop:dev
```

Production-style desktop launch:

```powershell
npm run desktop:start
```

Build a portable Windows executable:

```powershell
npm run desktop:package
```

The artifact is written to `release/`.

## Quality gates

```powershell
npm run lint
npm test
npm run test:desktop
npm run audit:source
npm audit --audit-level=high
```

`npm run check` runs linting, all unit/regression tests, the production build,
the source privacy/secret audit, the Electron compiler, and the real Electron
smoke test.

The smoke test launches the actual application entrypoint with a hidden window,
waits for the MVP renderer and core controls, and verifies graceful shutdown.

## Configuration

Copy `.env.example` to an untracked `.env` only when overrides are needed.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MEETING_ASSISTANT_MODEL` | `auto` | Copilot model ID |
| `PORT` | `8787` | Local browser/API server port |
| `COPILOT_LOG_LEVEL` | `error` | Copilot runtime logging level |
| `COPILOT_HOME` | `~/.copilot` | Existing Copilot credentials and state |
| `COPILOT_GITHUB_TOKEN` | unset | Explicit Copilot-capable token |

Never commit `.env`, `.npmrc`, credential stores, support bundles, screenshots,
transcripts, or generated model caches.

## Security maintenance

- Dependabot checks npm and GitHub Actions dependencies weekly.
- CI uses pinned action revisions and minimal token permissions.
- `npm audit` blocks high and critical dependency advisories.
- The renderer has no Node.js integration and cannot execute Copilot tools.
- Copilot sessions are isolated by mode, bounded, queued, and closed on exit.
- A single-instance lock prevents duplicate Electron processes from colliding
  over Chromium caches and user-data files.

Report security concerns through the private repository's **Security** tab. Do
not include credentials, transcripts, resumes, or screenshots in reports.

## Known limitations

- Desktop loopback capture is Windows-specific.
- The bundled Whisper model is English-only.
- Browser speech recognition may use the browser vendor's online service.
- Screen-capture protection varies by operating system and capture software.
- Copilot availability, model support, quotas, and authentication are controlled
  by the signed-in user's GitHub account.
- The project is a local single-user application, not a hosted multi-tenant
  service.
