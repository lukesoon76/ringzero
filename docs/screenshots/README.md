# Console screenshots

Captured from the live Next.js console (`pnpm --filter @ring-zero/console dev`)
rendering the real telemetry produced by `pnpm demo`. Commercial
governance-platform register (Credo AI / Fiddler), dark theme.

| File | Page | What it shows |
|------|------|---------------|
| `01-dashboard.png` | Dashboard | KPI cards, framework-coverage bars (EU AI Act / MAS / MGF, 100%), governance activity table |
| `02-trace-viewer.png` | Activity → Trace Viewer | The `verify` step of the EBITDA attack — guard decision `blocked`, `2.82 ≠ 1.82`, binding guard evaluations |
| `03-frameworks.png` | Frameworks | The 8-pillar board, P4 highlighted as the owned white space |
| `04-attestation.png` | Reports | Compliance attestation — every control SATISFIED, each resolving to a real trace step, no gaps |
| `05-inventory.png` | Inventory | The agent card (purpose, owner, Tier 4, capabilities, scopes) with live trace links |
| `06-monitoring.png` | Monitoring | Real capability/trajectory signals + the labelled MOCK orchestration-drift panel |

To regenerate: run `pnpm demo`, start the console, and screenshot at a 1440×900
desktop viewport.
