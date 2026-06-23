import { Card } from '../ui/Card';

import { LinkCard } from './entities/link';
import { PersonCard } from './entities/person';
import { PlaceCard } from './entities/place';
import { SpecSheetCard } from './entities/spec_sheet';
import { TransactionCard } from './entities/transaction';

import { MetricCard } from './quantifiable/metric';
import { RatingCard } from './quantifiable/rating';
import { MoodCard } from './quantifiable/mood';
import { ProgressCard } from './quantifiable/progress';

import { CanvasCard } from './visual/canvas';
import { GalleryCard } from './visual/gallery';
import { SnapshotCard } from './visual/snapshot';
import { VideoCard } from './visual/video';

import { ArticleCard } from './textual/article';
import { CompactCard } from './textual/compact';
import { ConversationCard } from './textual/conversation';
import { InsightSummaryCard } from './textual/insight_summary';
import { QuoteCard } from './textual/quote';
import { SnippetCard } from './textual/snippet';

import { DurationCard } from './temporal/duration';
import { EventCard } from './temporal/event';
import { ProcedureCard } from './temporal/procedure';
import { RoutineCard } from './temporal/routine';
import { TaskCard } from './temporal/task';

import { ScheduleBriefingCard } from './system/schedule_briefing';

export type CardTemplateId =
  | 'link' | 'person' | 'place' | 'spec_sheet' | 'transaction'
  | 'metric' | 'rating' | 'mood' | 'progress'
  | 'canvas' | 'gallery' | 'snapshot' | 'video'
  | 'article' | 'compact' | 'conversation' | 'insight_summary' | 'quote' | 'snippet'
  | 'duration' | 'event' | 'procedure' | 'routine' | 'task'
  | 'schedule_briefing';

interface CardFactoryProps {
  templateId: CardTemplateId;
  data: unknown;
  title?: string;
  tags?: string[];
  onTap?: () => void;
  className?: string;
}

export function CardFactory({ templateId, data, onTap, className }: CardFactoryProps) {
  const inner = renderInner(templateId, data);
  if (!inner) return null;
  return (
    <Card variant="glass" onClick={onTap} className={className} padding="1rem">
      {inner}
    </Card>
  );
}

function renderInner(templateId: CardTemplateId, data: unknown) {
  const d = data as any;
  switch (templateId) {
    case 'link':             return <LinkCard data={d} />;
    case 'person':           return <PersonCard data={d} />;
    case 'place':            return <PlaceCard data={d} />;
    case 'spec_sheet':       return <SpecSheetCard data={d} />;
    case 'transaction':      return <TransactionCard data={d} />;
    case 'metric':           return <MetricCard data={d} />;
    case 'rating':           return <RatingCard data={d} />;
    case 'mood':             return <MoodCard data={d} />;
    case 'progress':         return <ProgressCard data={d} />;
    case 'canvas':           return <CanvasCard data={d} />;
    case 'gallery':          return <GalleryCard data={d} />;
    case 'snapshot':         return <SnapshotCard data={d} />;
    case 'video':            return <VideoCard data={d} />;
    case 'article':          return <ArticleCard data={d} />;
    case 'compact':          return <CompactCard data={d} />;
    case 'conversation':     return <ConversationCard data={d} />;
    case 'insight_summary':  return <InsightSummaryCard data={d} />;
    case 'quote':            return <QuoteCard data={d} />;
    case 'snippet':          return <SnippetCard data={d} />;
    case 'duration':         return <DurationCard data={d} />;
    case 'event':            return <EventCard data={d} />;
    case 'procedure':        return <ProcedureCard data={d} />;
    case 'routine':          return <RoutineCard data={d} />;
    case 'task':             return <TaskCard data={d} />;
    case 'schedule_briefing': return <ScheduleBriefingCard data={d} />;
    default:                 return null;
  }
}
