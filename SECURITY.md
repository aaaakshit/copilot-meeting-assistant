# Security policy

## Supported version

Security fixes are applied to the latest revision on the default branch.

## Reporting a vulnerability

Use the private repository's **Security** tab to open a private vulnerability
report. Do not create an issue containing exploit details or sensitive data.

Reports should include:

- affected component and version
- reproducible steps using synthetic data
- expected and observed behavior
- impact assessment
- suggested mitigation, if known

Never attach real credentials, resumes, transcripts, meeting recordings,
screenshots, Copilot session data, or local filesystem paths.

## Security boundaries

- The renderer is sandboxed and uses context isolation.
- A narrow preload bridge exposes only validated application operations.
- Copilot tool execution is disabled.
- Audio is transcribed locally.
- Profile text and optional screenshots leave the device only during an
  explicit Copilot generation request.
- Secrets are read from existing credential stores or environment variables and
  are never persisted by the application.

## Dependency policy

High and critical advisories block publication. Dependency changes must preserve
a clean `npm audit --audit-level=high` result and pass the full `npm run check`
quality gate.
