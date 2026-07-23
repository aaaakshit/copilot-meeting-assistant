# Privacy and data handling

## Local data

Candidate context and preferences are saved in browser `localStorage`. The app
does not include cloud synchronization or its own analytics service.

Audio samples are processed in memory and transcribed locally by Whisper.
Downloaded model files live in Electron's user-data directory and are excluded
from source control.

## Data sent to GitHub Copilot

A generation request can contain:

- the detected or manually entered question
- response preferences
- candidate context for general interview mode
- target role and job description for coding mode
- an optional, explicitly captured screen image

GitHub processes these inputs according to the signed-in user's Copilot terms
and settings.

## Data not collected by this project

The application does not intentionally collect:

- passwords or authentication tokens
- raw meeting recordings
- background screenshots
- contact lists
- browser history
- telemetry or crash reports

## User controls

- Stop listening to end display/audio capture.
- Disable automatic answering.
- Avoid **Read screen** to prevent image attachments.
- Clear the application's local storage through Electron/Chromium user data.
- Remove the Electron user-data directory to delete downloaded models and local
  browser state.

## Screen sharing

Electron content protection requests exclusion from supported Windows capture
APIs. Third-party capture software can ignore the request or display a blank
region. The application must not claim guaranteed invisibility.
