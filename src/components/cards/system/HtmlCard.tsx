import { resolveHtmlTemplate } from '../../../lib/htmlCardTemplates';
import { sanitizeHtml } from '../../notes/keepUtils';

export interface HtmlCardProps {
  data: {
    html_template: string;
    widget_data?: Record<string, unknown>;
  };
}

export function HtmlCard({ data }: HtmlCardProps) {
  let template = resolveHtmlTemplate(data.html_template || '');
  const widgetData = data.widget_data || {};

  // Replace {{key}} with widgetData[key]
  Object.entries(widgetData).forEach(([key, val]) => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    template = template.replace(regex, String(val));
  });

  const sanitized = sanitizeHtml(template);

  return (
    <div
      className="text-sm leading-relaxed text-text-primary"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
