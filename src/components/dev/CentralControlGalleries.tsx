import { Pressable } from '../ui/ControlPrimitives';
import { useState } from 'react';
import { Layers, Search, Settings } from 'lucide-react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import IconButton from '../ui/IconButton';
import Chip from '../ui/Chip';
import Dialog from '../ui/Dialog';
import Sheet from '../ui/Sheet';
import DataCard from '../shared/DataCard';
import SectionBlock from '../shared/Section';
import ContentContainer from '../shared/ContentContainer';
import PageShell from '../shared/PageShell';
import PageToolbar from '../shared/PageToolbar';
import { DashboardPageTemplate, GridPageTemplate, ListPageTemplate, TimelinePageTemplate } from '../shared/PageTemplates';

export function ControlPrimitivesGallery() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-base font-black text-text-primary"><Settings size={16} />Control primitives</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input icon={<Search size={14} />} placeholder="Central Input" />
        <Select aria-label="Przykładowy wybór" options={[{ value: 'calm', label: 'Calm density' }, { value: 'compact', label: 'Compact density' }]} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <IconButton icon={<Settings size={16} />} label="Ustawienia" variant="tonal" />
        <Chip>Neutral</Chip><Chip selected>Selected</Chip><Chip tone="success">Success</Chip>
        <Pressable variant="outline" onClick={() => setDialogOpen(true)}>Dialog</Pressable>
        <Pressable variant="outline" onClick={() => setSheetOpen(true)}>Sheet</Pressable>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Central Dialog" primaryAction={{ label: 'Gotowe', onClick: () => setDialogOpen(false) }} secondaryAction={{ label: 'Anuluj' }}>
        <p className="text-sm text-text-secondary">Wspólny kontrakt akcji, typografii i motion.</p>
      </Dialog>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen} title="Central Sheet"><p className="text-sm text-text-secondary">Treść panelu.</p></Sheet>
    </section>
  );
}

export function LayoutPrimitivesGallery() {
  const sample = <DataCard label="Przykładowa metryka" value="42" detail="Sterowana tokenami" />;
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-base font-black text-text-primary"><Layers size={16} />Layout primitives</h2>
      <ContentContainer width="narrow" className="!p-0"><SectionBlock title="Section" description="Kanoniczna hierarchia sekcji">{sample}</SectionBlock></ContentContainer>
      <div className="hidden" aria-hidden="true">
        <PageToolbar title="Toolbar" />
        <PageShell><ListPageTemplate>{sample}</ListPageTemplate></PageShell>
        <GridPageTemplate>{sample}</GridPageTemplate>
        <DashboardPageTemplate>{sample}</DashboardPageTemplate>
        <TimelinePageTemplate>{sample}</TimelinePageTemplate>
      </div>
    </section>
  );
}
