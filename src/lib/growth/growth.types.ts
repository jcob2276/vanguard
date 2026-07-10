/** Shared types for growth domain — used by both lib/ and components/growth/hooks/. */

export interface GrowthLinkRow {
  id: string;
  url: string;
  title: string;
  status: string;
  category: string;
  resource_type: string | null;
  thumbnail_url: string | null;
  domain: string;
  updated_at?: string | null;
}

export interface GrowthWeekNote {
  id: string;
  title: string;
  created_at: string;
}

export interface GrowthTodoRow {
  id: string;
  title: string;
  status: string;
}

export interface GrowthProjectSummary {
  id: string;
  name: string;
  goal: string | null;
  status: string;
  primarySkillId: string | null;
  kpis: { id: string; name: string; current: number | null; target: number | null }[];
}
