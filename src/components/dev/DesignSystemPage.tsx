import Button from '../ui/Button';
import { useEffect, useState } from 'react';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import { ControlPrimitivesGallery, LayoutPrimitivesGallery } from './CentralControlGalleries';

import { BorderBeamGallery, ThinkingOrbGallery } from './AntalikEffectsGalleries';

function DesignSystemHeader({ onBack, dark, onToggleTheme }: { onBack: () => void; dark: boolean; onToggleTheme: () => void }) {

  return (
    <div className="sticky top-0 z-[var(--z-modal)] backdrop-blur-[var(--blur-xl)] bg-background/80 border-b border-border-custom/30">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          icon={<ArrowLeft size={16} />}
          className="p-1.5 rounded-lg h-auto min-w-0 text-text-muted hover:text-text-primary"
        />
        <BrandTitle className="text-base" />
        <span className="ml-auto hidden text-xs font-bold uppercase tracking-widest text-text-muted sm:block">/dev/design-system</span>
        <Button variant="tonal" size="sm" onClick={onToggleTheme} aria-label={dark ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}>
          {dark ? <Sun size={15} /> : <Moon size={15} />}
        </Button>
      </div>
    </div>
  );
}

/* -- main page -- */

export default function DesignSystemPage() {
  const navigate = useNavigate();
  const [initialDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [dark, setDark] = useState(initialDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    return () => {
      document.documentElement.classList.toggle('dark', initialDark);
    };
  }, [dark, initialDark]);

  return (
    <div className="min-h-screen bg-background">
      <DesignSystemHeader onBack={() => navigate(-1)} dark={dark} onToggleTheme={() => setDark((value) => !value)} />

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
        <ThinkingOrbGallery />
        <Divider />
        <BorderBeamGallery />
        <Divider />
        <SkeletonGallery />
        <Divider />
        <EmptyStateGallery />
        <Divider />
        <CharacterAvatarGallery />
        <Divider />
        <ControlPrimitivesGallery />
        <Divider />
        <LayoutPrimitivesGallery />
        <Divider />
        <CssVariablesReference />

        {/* footer spacer */}
        <div className="pb-20" />
      </div>
    </div>
  );
}
