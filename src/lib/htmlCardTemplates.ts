/** Safe HTML card templates (Memex pattern library → Vanguard). Placeholders: {{key}} */
const HTML_CARD_TEMPLATES: Record<string, string> = {
  metric_signal_dashboard: `
<div style="font-family:var(--font-sans);padding:var(--html-card-padding-compact)">
  <p style="margin:var(--legacy-inline-css-030);font-size:var(--legacy-inline-css-007);font-weight:var(--legacy-inline-css-016);text-transform:uppercase;letter-spacing:var(--legacy-inline-css-021);color:var(--legacy-lib-color-013)">{{title}}</p>
  <p style="margin:var(--legacy-inline-css-026);font-size:var(--legacy-inline-css-014);font-weight:var(--legacy-inline-css-017);color:var(--legacy-lib-color-003)">{{value}}<span style="font-size:var(--legacy-inline-css-010);font-weight:var(--legacy-inline-css-015);color:var(--legacy-lib-color-017);margin-left:var(--space-1)">{{unit}}</span></p>
  <p style="margin:var(--legacy-inline-css-032);font-size:var(--legacy-inline-css-008);color:var(--legacy-lib-color-011)">{{note}}</p>
</div>`,

  personal_review_magazine: `
<div style="font-family:var(--font-sans)">
  <p style="margin:var(--legacy-inline-css-029);font-size:var(--legacy-inline-css-006);font-weight:var(--legacy-inline-css-016);text-transform:uppercase;letter-spacing:var(--legacy-inline-css-022);color:var(--legacy-lib-color-017)">Przegląd</p>
  <h3 style="margin:var(--legacy-inline-css-027);font-size:var(--legacy-inline-css-013);font-weight:var(--legacy-inline-css-016);color:var(--legacy-lib-color-003)">{{headline}}</h3>
  <p style="margin:var(--legacy-inline-css-026);font-size:var(--legacy-inline-css-009);line-height:var(--legacy-inline-css-025);color:var(--legacy-lib-color-011)">{{body}}</p>
</div>`,

  work_progress_command: `
<div style="font-family:var(--font-sans);border-left:var(--border-html-card-accent);padding-left:var(--space-3)">
  <p style="margin:var(--legacy-inline-css-028);font-size:var(--legacy-inline-css-007);font-weight:var(--legacy-inline-css-016);color:var(--legacy-lib-color-013)">{{project}}</p>
  <p style="margin:var(--legacy-inline-css-029);font-size:var(--legacy-inline-css-011);font-weight:var(--legacy-inline-css-016);color:var(--legacy-lib-color-003)">{{task}}</p>
  <p style="margin:var(--legacy-inline-css-026);font-size:var(--legacy-inline-css-008);color:var(--legacy-lib-color-017)">Termin: {{deadline}}</p>
</div>`,

  decision_studio: `
<div style="font-family:var(--font-sans)">
  <p style="margin:var(--legacy-inline-css-030);font-size:var(--legacy-inline-css-009);font-weight:var(--legacy-inline-css-016);color:var(--legacy-lib-color-003)">{{question}}</p>
  <div style="display:flex;gap:var(--legacy-inline-css-018);flex-wrap:wrap">
    <span style="flex:1;min-width:var(--legacy-inline-css-033);padding:var(--legacy-inline-css-037);border-radius:var(--legacy-inline-css-004);background:var(--legacy-lib-color-024);font-size:var(--html-card-text-compact)"><strong>A:</strong> {{option_a}}</span>
    <span style="flex:1;min-width:var(--legacy-inline-css-033);padding:var(--legacy-inline-css-037);border-radius:var(--legacy-inline-css-004);background:var(--legacy-lib-color-024);font-size:var(--html-card-text-compact)"><strong>B:</strong> {{option_b}}</span>
  </div>
</div>`,

  system_action_receipt: `
<div style="font-family:var(--font-sans);border:var(--border-html-card-receipt);border-radius:var(--legacy-inline-css-005);padding:var(--space-3)">
  <p style="margin:var(--legacy-inline-css-028);font-size:var(--legacy-inline-css-006);font-weight:var(--legacy-inline-css-016);text-transform:uppercase;color:var(--legacy-lib-color-017)">Potwierdzenie</p>
  <p style="margin:var(--legacy-inline-css-026);font-size:var(--legacy-inline-css-009);font-weight:var(--legacy-inline-css-015);color:var(--legacy-lib-color-003)">{{action}}</p>
  <p style="margin:var(--legacy-inline-css-031);font-size:var(--legacy-inline-css-007);color:var(--legacy-lib-color-011)">{{timestamp}}</p>
</div>`,

  visual_memory_editorial: `
<div style="font-family:var(--font-sans)">
  <p style="margin:var(--legacy-inline-css-029);font-size:var(--legacy-inline-css-006);font-weight:var(--legacy-inline-css-016);text-transform:uppercase;color:var(--legacy-lib-color-017)">{{date}}</p>
  <p style="margin:var(--legacy-inline-css-026);font-size:var(--legacy-inline-css-012);font-weight:var(--legacy-inline-css-016);line-height:var(--legacy-inline-css-023);color:var(--legacy-lib-color-003)">{{moment}}</p>
  <p style="margin:var(--legacy-inline-css-032);font-size:var(--legacy-inline-css-008);line-height:var(--legacy-inline-css-024);color:var(--legacy-lib-color-011)">{{caption}}</p>
</div>`,
};


export function resolveHtmlTemplate(templateOrHtml: string): string {
  return HTML_CARD_TEMPLATES[templateOrHtml] ?? templateOrHtml;
}
