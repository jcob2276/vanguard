import { TrendChart, type TrendChartData } from './TrendChart';
import { BarChartWidget, type BarChartData } from './BarChart';
import { TimelineWidget, type TimelineWidgetData } from './TimelineWidget';

export type WidgetType = 'trend' | 'bar' | 'timeline';

export function WidgetFactory({
  type,
  data,
}: {
  type: WidgetType | string;
  data: unknown;
}) {
  switch (type) {
    case 'trend':
      return <TrendChart data={data as TrendChartData} />;
    case 'bar':
      return <BarChartWidget data={data as BarChartData} />;
    case 'timeline':
      return <TimelineWidget data={data as TimelineWidgetData} />;
    default:
      return null;
  }
}
