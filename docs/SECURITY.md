# Security Posture

Terra Sentinel is built as a local/offline-capable prototype. The security goal is to minimize attack surface while keeping exported data transparent.

## Current Controls

- No backend service.
- No database.
- No user accounts.
- No secrets or API keys.
- No external runtime data fetch.
- Dependency audit passes with zero moderate-or-higher vulnerabilities.
- Public warning copy is sanitized before rendering/export.
- Downloaded files are generated from structured in-memory data.
- Service worker caches only app shell and GET responses.

## Threat Model

| Risk | Current Mitigation |
| --- | --- |
| Cross-site scripting through generated warning text | Warning bodies strip angle brackets and control characters. React also escapes rendered text. |
| CSV/JSON export confusion | Exports are explicit user actions with stable filenames and structured fields. |
| Supply-chain vulnerabilities | `npm audit --audit-level=moderate` is part of the verification flow. |
| Leaking sensitive data | App ships with synthetic data and no network ingestion. |
| Over-trusting model output | README and docs state this is not certified for real emergency operations. |

## Production Hardening Roadmap

- Signed briefing packets.
- Operator login and role-based approvals.
- Tamper-evident audit log.
- Server-side input validation for live data ingestion.
- Content Security Policy headers.
- Source data provenance metadata.
- Human-in-the-loop approval for public warning publication.
- Disaster-management expert validation before field use.

