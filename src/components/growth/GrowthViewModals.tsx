import Button from '../ui/Button';
import { Save } from 'lucide-react';
import Modal from '../ui/Modal';
import PinPickerModal from './PinPickerModal';
import FocusEditorModal from './FocusEditorModal';
import SkillTreePanel from './SkillTreePanel';
import { useGrowthData } from './hooks/useGrowthData';
import { useGrowthViewDerived } from './useGrowthViewDerived';
import { useGrowthActions } from './hooks/useGrowthActions';

interface GrowthViewModalsProps {
  skills: ReturnType<typeof useGrowthData>['skills'];
  pins: ReturnType<typeof useGrowthData>['pins'];
  focus: ReturnType<typeof useGrowthData>['focus'];
  activeProjects: ReturnType<typeof useGrowthData>['activeProjects'];
  unreadLinks: ReturnType<typeof useGrowthData>['unreadLinks'];
  openTodos: ReturnType<typeof useGrowthData>['openTodos'];
  derived: ReturnType<typeof useGrowthViewDerived>;
  actions: ReturnType<typeof useGrowthActions>;
  expandedParentId: string | null;
  setExpandedParentId: (id: string | null) => void;
}

export default function GrowthViewModals({
  skills,
  pins,
  focus,
  activeProjects,
  unreadLinks,
  openTodos,
  derived,
  actions,
  expandedParentId,
  setExpandedParentId,
}: GrowthViewModalsProps) {
  const { parents, childrenByParentId, currentScores, focusParentId, focusProjectId, grid } = derived;
  const {
    pickerSlot,
    pickerDefaultProjectId,
    showFocusEditor, setShowFocusEditor,
    draftScores, setDraftScores,
    savingScores,
    showScores, setShowScores,
    editingScores, setEditingScores,
    handleSaveFocus,
    closePicker,
    handlePickLink,
    handlePickTodo,
    handlePickManual,
    saveScores,
  } = actions;

  return (
    <>
      {pickerSlot && (
        <PinPickerModal
          slot={pickerSlot}
          skills={skills}
          projects={activeProjects}
          focusSkillId={focusParentId}
          defaultProjectId={pickerDefaultProjectId ?? focusProjectId}
          unreadLinks={unreadLinks}
          openTodos={openTodos}
          pinnedLinkIds={new Set(pins.filter((p) => p.entity_type === 'link').map((p) => p.entity_id).filter(Boolean) as string[])}
          pinnedTodoIds={new Set(pins.filter((p) => p.entity_type === 'todo').map((p) => p.entity_id).filter(Boolean) as string[])}
          onClose={closePicker}
          onPickLink={handlePickLink}
          onPickTodo={handlePickTodo}
          onPickManual={handlePickManual}
        />
      )}

      {showFocusEditor && (
        <FocusEditorModal
          skills={skills}
          currentFocus={focus}
          onClose={() => setShowFocusEditor(false)}
          onSave={handleSaveFocus}
        />
      )}

      {showScores && (
        <Modal
          isOpen
          onClose={() => { setShowScores(false); setEditingScores(false); }}
          title="Oceny skilli · 0–5"
          size="xl"
          showCloseButton={false}
        >
          <div className="flex justify-end gap-2 -mt-1 mb-2">
            {editingScores && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => void saveScores()}
                disabled={savingScores}
                loading={savingScores}
                icon={<Save size={10} />}
              >
                Zapisz
              </Button>
            )}
          </div>
          <SkillTreePanel
            parents={parents}
            childrenByParentId={childrenByParentId}
            scores={editingScores ? draftScores : currentScores}
            prevScores={null}
            showPrev={false}
            editing={editingScores}
            draftScores={draftScores}
            onDraftChange={(key, val) => setDraftScores((d) => ({ ...d, [key]: val }))}
            grid={grid}
            expandedParentId={expandedParentId}
            onExpandParent={setExpandedParentId}
          />
        </Modal>
      )}
    </>
  );
}
