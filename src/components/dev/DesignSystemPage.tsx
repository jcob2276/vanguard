import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { BrandTitle } from '../ui/BrandTitle';
import {
  Divider,
  ColorTokensSection,
  TypographyScaleSection,
  FontStacksSection,
  ButtonGallery,
  CardGallery,
  BadgeGallery,
  TabsGallery,
  ModalGallery,
  SpinnerGallery,
  SkeletonGallery,
  EmptyStateGallery,
  CharacterAvatarGallery,
  CssVariablesReference,
} from './DesignSystemGalleries';

function DesignSystemHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border-custom/30">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          icon={<ArrowLeft size={16} />}
          className="p-1.5 rounded-lg h-auto min-w-0 text-text-muted hover:text-text-primary"
        />
        <BrandTitle className="text-base" />
        <span className="text-xs font-bold uppercase tracking-widest text-text-muted ml-auto">/dev/design-system</span>
      </div>
    </div>
  );
}

/* -- main page -- */

export default function DesignSystemPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <DesignSystemHeader onBack={() => navigate(-1)} />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        <ColorTokensSection />
        <Divider />
        <TypographyScaleSection />
        <Divider />
        <FontStacksSection />
        <Divider />
        <ButtonGallery />
        <Divider />
        <CardGallery />
        <Divider />
        <BadgeGallery />
        <Divider />
        <TabsGallery />
        <Divider />
        <ModalGallery />
        <Divider />
        <SpinnerGallery />
        <Divider />
        <SkeletonGallery />
        <Divider />
        <EmptyStateGallery />
        <Divider />
        <CharacterAvatarGallery />
        <Divider />
        <CssVariablesReference />

        {/* footer spacer */}
        <div className="pb-20" />
      </div>
    </div>
  );
}
