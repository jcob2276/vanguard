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

export interface LibraryItem {
  id: string;
  title: string;
  type: 'book' | 'article' | 'podcast' | 'video' | 'course' | 'note' | 'mentor' | 'experiment';
  status: 'inbox' | 'want_to_learn' | 'in_progress' | 'processed' | 'applied' | 'deferred';
  url?: string;
  connectedNotes?: string;
  connectedSkill?: string;
  connectedDecision?: string;
  connectedPractice?: string;
  createdAt: string;
}

export interface PracticeEvidence {
  id: string;
  title: string;
  type: 'task' | 'project' | 'talk' | 'material' | 'feature' | 'workout' | 'problem' | 'feedback' | 'result';
  date: string;
  skillId?: string;
  projectId?: string;
  competenceLevel: 'consume' | 'understand' | 'try' | 'can_do' | 'apply_regularly';
  details: string;
}

interface ActivePath {
  mainSkillId?: string;
  mainSkillWhy?: string;
  mainSkillDefinition?: string;
  mainSkillMaterials?: string[];
  mainSkillExercises?: string[];
  mainSkillTasks?: string[];
  mainSkillEvidences?: string[];
  mainSkillReviewDate?: string;

  subSkillId?: string;
  subSkillWhy?: string;
  subSkillDefinition?: string;
  subSkillMaterials?: string[];
  subSkillExercises?: string[];
  subSkillTasks?: string[];
  subSkillEvidences?: string[];
  subSkillReviewDate?: string;

  experimentTitle?: string;
  experimentWhy?: string;
  experimentDefinition?: string;
  experimentMaterials?: string[];
  experimentExercises?: string[];
  experimentTasks?: string[];
  experimentEvidences?: string[];
  experimentReviewDate?: string;
}

export interface VanguardIdentityData {
  long_term_mission: string | null;
  pillars: any | null;
  avoidance_triggers: any | null;
  behavioral_baseline: any | null;
  updated_at: string | null;
  user_id: string;

  // New fields
  development_theme: string | null;
  development_gap: string | null;
  current_role: string | null;
  developed_role: string | null;
  values_standards: string[] | null;
  confirming_behaviors: string[] | null;
  conflicting_behaviors: string[] | null;
  active_path: ActivePath | null;
  library_items: LibraryItem[] | null;
  practice_evidences: PracticeEvidence[] | null;
  development_review: any | null;
}

