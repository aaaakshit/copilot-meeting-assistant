# Architecture

## Design goals

- Keep audio and profile persistence local-first.
- Minimize the Electron renderer's privileges.
- Make Copilot requests explicit, validated, cancellable, and auditable.
- Keep user interface components passive and test domain behavior separately.
- Recover from one renderer failure without creating a crash loop.

## Model-View-Presenter mapping

### Model

`src/desktop/model/` contains state-independent domain behavior:

- `SystemCapture` owns display/system-audio capture and screen snapshots.
- `SpeechSegmenter` performs voice activity segmentation and resampling.
- `RollingQuestionDetector` assembles split transcripts and detects prompts.
- `desktopModel.ts` defines view models, actions, constants, and pure helpers.
- `CaptureSessionGate` invalidates queued transcription when capture ends.

The shared request and IPC contracts live under `shared/`.

### View

`src/desktop/view/` contains passive React components. Views receive a
`DesktopViewModel` and `DesktopActions`; they do not access Electron, browser
storage, transcription, or Copilot directly.

### Presenter

`useDesktopPresenter` owns:

- persisted profile and preference state
- capture lifecycle
- serialized transcription
- question detection
- Copilot readiness and answer generation
- request cancellation and streamed answer updates
- mapping domain state into a `DesktopViewModel`

## Process boundaries

```text
React renderer (sandboxed)
  -> preload bridge (allowlisted IPC)
    -> Electron main process
       -> local Whisper pipeline
       -> display and loopback capture
       -> GitHub Copilot SDK runtime
```

The renderer has `nodeIntegration: false`, `contextIsolation: true`, and
`sandbox: true`. IPC payloads are validated with Zod before use.

## Answer lifecycle

1. System audio is segmented in the renderer.
2. A float audio buffer is sent to the main process.
3. Whisper transcribes the segment locally.
4. The rolling detector emits a complete prompt.
5. The presenter optionally captures the current screen.
6. The main process validates the request.
7. A mode-specific Copilot session streams response deltas.
8. The presenter accepts deltas only for the active request ID.

Copilot sessions are serialized per mode. An aborted or failed session is
discarded, while successful sessions are reused for bounded follow-up context.

## Desktop lifecycle

- A single-instance lock prevents duplicate Chromium cache/user-data access.
- Starting capture stores the normal bounds and snaps to the right third of the
  active display at full working height.
- Stopping capture restores the prior bounds and pin state.
- The frameless title bar remains draggable in both setup and focus modes.
- Startup errors exit with a non-zero code and a local diagnostic.
- One unexpected renderer exit is recovered by reloading the renderer.
- A second failure is not automatically retried, preventing crash loops.
- Active answers are aborted before shutdown.
- Copilot and capture resources are closed before the final app exit.

## Test strategy

- Pure unit tests cover prompts, validation, API streaming, audio segmentation,
  question detection, and renderer recovery policy.
- The Electron smoke test builds production assets, launches the real entrypoint,
  enters answer-only focus mode, verifies one-third native bounds, stops,
  verifies restored bounds and controls, and then verifies graceful shutdown.
- CI runs on Windows because desktop behavior and native packages are
  platform-sensitive.
