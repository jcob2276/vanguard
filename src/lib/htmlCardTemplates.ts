/** Safe HTML card templates (Memex pattern library → Vanguard). Placeholders: {{key}} */
const HTML_CARD_TEMPLATES: Record<string, string> = {
  metric_signal_dashboard: `
<div style="font-family:var(--font-sans);padding:var(--html-card-padding-compact)">
  <p style="margin:var(--ds-inline-css-0-0-8px);font-size:var(--ds-inline-css-11px);font-weight:var(--ds-inline-css-700);text-transform:uppercase;letter-spacing:var(--ds-inline-css-0-08em);color:var(--color-theme-hex-5b6cff)">{{title}}</p>
  <p style="margin:var(--ds-inline-css-0-coll-3);font-size:var(--ds-inline-css-28px);font-weight:var(--ds-inline-css-800);color:var(--color-theme-hex-0a0a0a-coll-2)">{{value}}<span style="font-size:var(--ds-inline-css-14px);font-weight:var(--ds-inline-css-600);color:var(--color-theme-hex-99a1af);margin-left:var(--space-1)">{{unit}}</span></p>
  <p style="margin:var(--ds-inline-css-8px-0-0);font-size:var(--ds-inline-css-12px-coll-2);color:var(--color-theme-hex-4a5565)">{{note}}</p>
</div>`,

  personal_review_magazine: `
<div style="font-family:var(--font-sans)">
  <p style="margin:var(--ds-inline-css-0-0-6px);font-size:var(--ds-inline-css-10px);font-weight:var(--ds-inline-css-700);text-transform:uppercase;letter-spacing:var(--ds-inline-css-0-1em);color:var(--color-theme-hex-99a1af)">Przegląd</p>
  <h3 style="margin:var(--ds-inline-css-0-0-10px);font-size:var(--ds-inline-css-18px);font-weight:var(--ds-inline-css-700);color:var(--color-theme-hex-0a0a0a-coll-2)">{{headline}}</h3>
  <p style="margin:var(--ds-inline-css-0-coll-3);font-size:var(--ds-inline-css-13px);line-height:var(--ds-inline-css-1-5);color:var(--color-theme-hex-4a5565)">{{body}}</p>
</div>`,

  work_progress_command: `
<div style="font-family:var(--font-sans);border-left:var(--border-html-card-accent);padding-left:var(--space-3)">
  <p style="margin:var(--ds-inline-css-0-0-4px);font-size:var(--ds-inline-css-11px);font-weight:var(--ds-inline-css-700);color:var(--color-theme-hex-5b6cff)">{{project}}</p>
  <p style="margin:var(--ds-inline-css-0-0-6px);font-size:var(--ds-inline-css-15px);font-weight:var(--ds-inline-css-700);color:var(--color-theme-hex-0a0a0a-coll-2)">{{task}}</p>
  <p style="margin:var(--ds-inline-css-0-coll-3);font-size:var(--ds-inline-css-12px-coll-2);color:var(--color-theme-hex-99a1af)">Termin: {{deadline}}</p>
</div>`,

  decision_studio: `
<div style="font-family:var(--font-sans)">
  <p style="margin:var(--ds-inline-css-0-0-8px);font-size:var(--ds-inline-css-13px);font-weight:var(--ds-inline-css-700);color:var(--color-theme-hex-0a0a0a-coll-2)">{{question}}</p>
  <div style="display:flex;gap:var(--ds-inline-css-8px);flex-wrap:wrap">
    <span style="flex:1;min-width:var(--ds-inline-css-120px);padding:var(--ds-inline-css-10px-coll-2);border-radius:var(--ds-inline-css-12px);background:var(--color-theme-hex-f7f8fa);font-size:var(--html-card-text-compact)"><strong>A:</strong> {{option_a}}</span>
    <span style="flex:1;min-width:var(--ds-inline-css-120px);padding:var(--ds-inline-css-10px-coll-2);border-radius:var(--ds-inline-css-12px);background:var(--color-theme-hex-f7f8fa);font-size:var(--html-card-text-compact)"><strong>B:</strong> {{option_b}}</span>
  </div>
</div>`,

  system_action_receipt: `
<div style="font-family:var(--font-sans);border:var(--border-html-card-receipt);border-radius:var(--ds-inline-css-16px);padding:var(--space-3)">
  <p style="margin:var(--ds-inline-css-0-0-4px);font-size:var(--ds-inline-css-10px);font-weight:var(--ds-inline-css-700);text-transform:uppercase;color:var(--color-theme-hex-99a1af)">Potwierdzenie</p>
  <p style="margin:var(--ds-inline-css-0-coll-3);font-size:var(--ds-inline-css-13px);font-weight:var(--ds-inline-css-600);color:var(--color-theme-hex-0a0a0a-coll-2)">{{action}}</p>
  <p style="margin:var(--ds-inline-css-6px-0-0);font-size:var(--ds-inline-css-11px);color:var(--color-theme-hex-4a5565)">{{timestamp}}</p>
</div>`,

  visual_memory_editorial: `
<div style="font-family:var(--font-sans)">
  <p style="margin:var(--ds-inline-css-0-0-6px);font-size:var(--ds-inline-css-10px);font-weight:var(--ds-inline-css-700);text-transform:uppercase;color:var(--color-theme-hex-99a1af)">{{date}}</p>
  <p style="margin:var(--ds-inline-css-0-coll-3);font-size:var(--ds-inline-css-16px-coll-2);font-weight:var(--ds-inline-css-700);line-height:var(--ds-inline-css-1-3);color:var(--color-theme-hex-0a0a0a-coll-2)">{{moment}}</p>
  <p style="margin:var(--ds-inline-css-8px-0-0);font-size:var(--ds-inline-css-12px-coll-2);line-height:var(--ds-inline-css-1-45);color:var(--color-theme-hex-4a5565)">{{caption}}</p>
</div>`,
};


export function resolveHtmlTemplate(templateOrHtml: string): string {
  return HTML_CARD_TEMPLATES[templateOrHtml] ?? templateOrHtml;
}
