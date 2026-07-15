import { describe, expect, it } from 'vitest';
import { buildSectionGoalMaps } from './goalLineage';

describe('goalLineage', () => {
  describe('buildSectionGoalMaps', () => {
    it('returns empty maps when input lists are empty', () => {
      const result = buildSectionGoalMaps([], [], []);
      expect(result).toEqual({
        sectionGoalMap: {},
        sectionDreamMap: {},
      });
    });

    it('correctly maps section to project to dream to life_goal and dream title', () => {
      const sections = [
        { id: 'sec-1', project_id: 'proj-1' },
        { id: 'sec-2', project_id: 'proj-2' }, // project does not exist
        { id: 'sec-3', project_id: null }, // no project
      ];
      const projects = [
        { id: 'proj-1', dream_id: 'dream-1' },
        { id: 'proj-3', dream_id: 'dream-2' }, // section does not point to it
      ];
      const dreams = [
        { id: 'dream-1', title: 'Run a marathon', life_goal: 'Cardio Elite' },
        { id: 'dream-2', title: 'Write a book', life_goal: 'Creative Master' },
      ];

      const result = buildSectionGoalMaps(sections, projects, dreams);

      expect(result.sectionGoalMap).toEqual({
        'sec-1': 'Cardio Elite',
      });
      expect(result.sectionDreamMap).toEqual({
        'sec-1': 'Run a marathon',
      });
    });

    it('handles projects without dreams or dreams without life_goals gracefully', () => {
      const sections = [
        { id: 'sec-1', project_id: 'proj-1' },
        { id: 'sec-2', project_id: 'proj-2' },
      ];
      const projects = [
        { id: 'proj-1', dream_id: null }, // no dream
        { id: 'proj-2', dream_id: 'dream-2' },
      ];
      const dreams = [
        { id: 'dream-2', title: 'Sleep 8 hours', life_goal: null }, // no life_goal
      ];

      const result = buildSectionGoalMaps(sections, projects, dreams);

      expect(result.sectionGoalMap).toEqual({});
      expect(result.sectionDreamMap).toEqual({
        'sec-2': 'Sleep 8 hours',
      });
    });
  });
});
