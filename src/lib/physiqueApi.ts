import { invokeEdge } from './supabase';
import { TIMEOUTS } from './constants';
import { updateProgressPhotoAnalysis } from './photosApi';
import type { Json } from './database.types';

export interface MuscleGroupAnalysis {
  name: string;
  score: number; // 0-100
  status: 'strong' | 'balanced' | 'lagging';
  notes: string;
}

export interface PhysiqueAnalysisResult {
  overall_score: number; // 0-100
  body_fat_estimate: string; // e.g. "14.5% (13–16%)"
  body_fat_num: number; // e.g. 14.5
  symmetry_score: number; // 0-100
  conditioning_score: number; // 0-100
  proportion_score: number; // 0-100
  coaching_summary: string;
  priorities: string[];
  muscle_groups: MuscleGroupAnalysis[];
  analyzed_at: string;
}

export async function requestPhysiqueAnalysis(
  photoId: string,
  imageUrl: string,
  userId: string
): Promise<PhysiqueAnalysisResult> {
  const response = await invokeEdge('analyze-physique', {
    body: {
      photoId,
      imageUrl,
      userId,
    },
    signal: AbortSignal.timeout(TIMEOUTS.llmHeavy || 45000),
  });

  if (!response || !response.analysis) {
    throw new Error('Brak poprawnego wyniku analizy sylwetki z Edge Function.');
  }

  const analysis = response.analysis as PhysiqueAnalysisResult;

  // Persist into Supabase progress_photos
  await updateProgressPhotoAnalysis(userId, photoId, analysis as unknown as Json);

  return analysis;
}
