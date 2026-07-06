/** Safe HTML card templates (Memex pattern library → Vanguard). Placeholders: {{key}} */
const HTML_CARD_TEMPLATES: Record<string, string> = {
  metric_signal_dashboard: `
<div style="font-family:system-ui,sans-serif;padding:4px 0">
  <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5B6CFF">{{title}}</p>
  <p style="margin:0;font-size:28px;font-weight:800;color:#0A0A0A">{{value}}<span style="font-size:14px;font-weight:600;color:#99A1AF;margin-left:4px">{{unit}}</span></p>
  <p style="margin:8px 0 0;font-size:12px;color:#4A5565">{{note}}</p>
</div>`,

  personal_review_magazine: `
<div style="font-family:system-ui,sans-serif">
  <p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#99A1AF">Przegląd</p>
  <h3 style="margin:0 0 10px;font-size:18px;font-weight:700;color:#0A0A0A">{{headline}}</h3>
  <p style="margin:0;font-size:13px;line-height:1.5;color:#4A5565">{{body}}</p>
</div>`,

  work_progress_command: `
<div style="font-family:system-ui,sans-serif;border-left:3px solid #5B6CFF;padding-left:12px">
  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#5B6CFF">{{project}}</p>
  <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#0A0A0A">{{task}}</p>
  <p style="margin:0;font-size:12px;color:#99A1AF">Termin: {{deadline}}</p>
</div>`,

  decision_studio: `
<div style="font-family:system-ui,sans-serif">
  <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#0A0A0A">{{question}}</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <span style="flex:1;min-width:120px;padding:10px;border-radius:12px;background:#F7F8FA;font-size:12px"><strong>A:</strong> {{option_a}}</span>
    <span style="flex:1;min-width:120px;padding:10px;border-radius:12px;background:#F7F8FA;font-size:12px"><strong>B:</strong> {{option_b}}</span>
  </div>
</div>`,

  system_action_receipt: `
<div style="font-family:system-ui,sans-serif;border:1px dashed rgba(153,161,175,0.4);border-radius:16px;padding:12px">
  <p style="margin:0 0 4px;font-size:10px;font-weight:700;text-transform:uppercase;color:#99A1AF">Potwierdzenie</p>
  <p style="margin:0;font-size:13px;font-weight:600;color:#0A0A0A">{{action}}</p>
  <p style="margin:6px 0 0;font-size:11px;color:#4A5565">{{timestamp}}</p>
</div>`,

  visual_memory_editorial: `
<div style="font-family:system-ui,sans-serif">
  <p style="margin:0 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:#99A1AF">{{date}}</p>
  <p style="margin:0;font-size:16px;font-weight:700;line-height:1.3;color:#0A0A0A">{{moment}}</p>
  <p style="margin:8px 0 0;font-size:12px;line-height:1.45;color:#4A5565">{{caption}}</p>
</div>`,
};

const HTML_CARD_TEMPLATE_IDS = Object.keys(HTML_CARD_TEMPLATES);

export function resolveHtmlTemplate(templateOrHtml: string): string {
  return HTML_CARD_TEMPLATES[templateOrHtml] ?? templateOrHtml;
}
