import { TrendChart, type TrendChartData } from './TrendChart';
import { BarChartWidget, type BarChartData } from './BarChart';
import { TimelineWidget, type TimelineWidgetData } from './TimelineWidget';

export type WidgetType = 'trend' | 'bar' | 'timeline';

export function WidgetFactory({
  type,
  data,
}: {
  type: WidgetType | string;
  data: Record<string, unknown>;
}) {
  switch (type) {
    case 'trend':
      return <TrendChart data={data as unknown as TrendChartData} />;
    case 'bar':
      return <BarChartWidget data={data as unknown as BarChartData} />;
    case 'timeline':
      return <TimelineWidget data={data as unknown as TimelineWidgetData} />;
    default:
      return null;
  }
}
