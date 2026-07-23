import type { VanguardIdentityData, LibraryItem, PracticeEvidence } from '../../../lib/growth/growth.types';
import type { LearningSkill } from '../../../lib/growth/growth';
import { GrowthDirectionModal } from './GrowthDirectionModal';
import { GrowthIdentityModal } from './GrowthIdentityModal';
import { GrowthLibraryModal } from './GrowthLibraryModal';
import { GrowthPracticeModal } from './GrowthPracticeModal';

interface GrowthModalsProps {
  activeModal: 'direction' | 'identity' | 'library' | 'practice' | null;
  onClose: () => void;
  identity: VanguardIdentityData | null;
  skills: LearningSkill[];
  editingLibraryItem?: LibraryItem | null;
  editingPracticeItem?: PracticeEvidence | null;
  onSaveIdentity: (updates: Partial<VanguardIdentityData>) => Promise<void>;
}

export default function GrowthModals(props: GrowthModalsProps) {
  const shared = {
    identity: props.identity,
    onClose: props.onClose,
    onSave: props.onSaveIdentity,
  };

  if (props.activeModal === 'direction') {
    return <GrowthDirectionModal {...shared} skills={props.skills} />;
  }
  if (props.activeModal === 'identity') {
    return <GrowthIdentityModal {...shared} />;
  }
  if (props.activeModal === 'library') {
    return <GrowthLibraryModal {...shared} skills={props.skills} item={props.editingLibraryItem} />;
  }
  if (props.activeModal === 'practice') {
    return <GrowthPracticeModal {...shared} skills={props.skills} item={props.editingPracticeItem} />;
  }
  return null;
}
