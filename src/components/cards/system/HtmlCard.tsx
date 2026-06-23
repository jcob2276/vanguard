import React from 'react';

export interface HtmlCardProps {
  data: {
    html_template: string;
    widget_data?: Record<string, any>;
  };
}

function sanitizeHtml(html: string): string {
  if (!html) return '';
  // Strip script and iframe tags
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
}

export function HtmlCard({ data }: HtmlCardProps) {
  let template = data.html_template || '';
  const widgetData = data.widget_data || {};

  // Replace {{key}} with widgetData[key]
  Object.entries(widgetData).forEach(([key, val]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    template = template.replace(regex, String(val));
  });

  const sanitized = sanitizeHtml(template);

  return (
    <div
      className="text-[12px] leading-relaxed text-text-primary"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
