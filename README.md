# FormFlow Relay

FormFlow Relay is an application-specific capability demo for a small n8n automation: receive a Google Forms submission, validate required data, normalize it for Google Sheets, route by priority, send a Gmail notification, and expose failures for safe retry.

> This is a capability prototype built with realistic dummy data. It is not presented as previous paid client work and contains no client data or credentials.

## Live workflow

The browser demo lets a reviewer:

- submit valid and invalid form data;
- watch each automation node change state;
- confirm that invalid submissions stop before side effects;
- see normalized rows appear in a Sheets-style table;
- inspect the generated Gmail notification;
- simulate a Google Sheets timeout and retry without duplicating the email.

## Architecture

```mermaid
flowchart LR
  A[Google Forms webhook] --> B{Required fields valid?}
  B -- No --> E[Stop and log validation error]
  B -- Yes --> C[Normalize data and assign priority]
  C --> D[Append Google Sheets row]
  D --> F[Send Gmail notification]
  D -. timeout .-> G[Capture error for retry]
```

`workflow.js` contains framework-independent validation, normalization, notification, and failure behavior. `app.js` visualizes the execution. `n8n-workflow.json` provides an importable starter workflow with credential placeholders.

## Run locally

```bash
npm run serve
```

Open `http://localhost:4173`.

## Test

```bash
npm test
```

The tests cover missing fields, malformed email, normalized Sheet rows, priority-aware notifications, and retryable Sheets failures.

## Production setup

1. Import `n8n-workflow.json` into n8n.
2. Add Google Sheets and Gmail OAuth credentials inside n8n—never in source control.
3. Replace the placeholder Sheet ID and recipient.
4. Map the real Google Form response fields.
5. Add an error workflow or alert channel for failed executions.
6. Test with sandbox data, then activate the workflow.

## Error handling and tradeoffs

- Validation happens before Sheets or Gmail to prevent partial writes.
- Gmail runs only after the Sheet append succeeds, preventing notifications for unrecorded submissions.
- The demo intentionally keeps state in the browser; a production workflow relies on n8n execution history and credential storage.
- Google Forms normally writes directly to Sheets. A webhook, Apps Script bridge, or polling trigger can start n8n depending on the client's existing setup and account permissions.
- Real OAuth calls are not made in the public demo so no Google account or private information is exposed.

## Limitations

The public demo simulates Google services while preserving the workflow rules. Final production activation requires client-owned Google and n8n credentials after contract start.
