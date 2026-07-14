import Button from '../ui/Button';
import { useState } from 'react';
import { Layers, Palette, Type, Box, Sparkles } from 'lucide-react';
import { Card } from '../ui/Card';
import Badge from '../ui/Badge';
import Tabs from '../ui/Tabs';
import Modal from '../ui/Modal';
import Spinner from '../ui/Spinner';
import Skeleton from '../ui/Skeleton';
import EmptyState from '../ui/EmptyState';
import { CharacterAvatar } from '../ui/CharacterAvatar';

/* -- tiny helpers -- */

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-base font-black text-text-primary">
        {icon}{title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && <p className="text-xs font-bold uppercase tracking-widest text-text-muted">{label}</p>}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`h-10 w-10 rounded-xl border border-border-custom/30 ${className}`} />
      <span className="text-2xs font-bold text-text-muted">{label}</span>
    </div>
  );
}

export function Divider() {
  return <div className="h-px bg-border-custom/30" />;
}

/* -- gallery sections -- */

export function ColorTokensSection() {
  return (
    <Section icon={<Palette size={16} />} title="Semantic Colors">
      <Row label="Status">
        <Swatch className="bg-success" label="success" />
        <Swatch className="bg-success-hover" label="success-hover" />
        <Swatch className="bg-warning" label="warning" />
        <Swatch className="bg-warning-hover" label="warning-hover" />
        <Swatch className="bg-danger" label="danger" />
        <Swatch className="bg-danger-hover" label="danger-hover" />
        <Swatch className="bg-info" label="info" />
        <Swatch className="bg-info-hover" label="info-hover" />
      </Row>
      <Row label="Surfaces">
        <Swatch className="bg-surface-1 border" label="surface-1" />
        <Swatch className="bg-surface-2 border" label="surface-2" />
        <Swatch className="bg-surface-3 border" label="surface-3" />
        <Swatch className="bg-surface-tonal border" label="tonal" />
        <Swatch className="bg-surface-tonal-strong border" label="tonal-strong" />
      </Row>
      <Row label="Text">
        <div className="flex items-center gap-4">
          <span className="text-text-primary text-sm font-bold">text-primary</span>
          <span className="text-text-secondary text-sm">text-secondary</span>
          <span className="text-text-muted text-sm">text-muted</span>
          <span className="text-text-tertiary text-sm">text-tertiary</span>
        </div>
      </Row>
    </Section>
  );
}

export function TypographyScaleSection() {
  return (
    <Section icon={<Type size={16} />} title="Typography Scale">
      <div className="space-y-1.5">
        {[
          ['text-6xl', '56px', 'Splash large'],
          ['text-5xl', '48px', 'Splash'],
          ['text-4xl', '36px', 'Hero large'],
          ['text-3xl', '30px', 'Hero headings'],
          ['text-2xl', '24px', 'Display numbers'],
          ['text-xl', '20px', 'Large headings'],
          ['text-lg', '18px', 'Headings, card titles'],
          ['text-base', '15px', 'Section headers, primary body'],
          ['text-sm', '13px', 'Form inputs, descriptions'],
          ['text-xs', '11px', 'Labels, metadata'],
          ['text-2xs', '9px', 'Status badges, flags'],
          ['text-3xs', '7px', 'Micro-labels'],
        ].map(([token, size, desc]) => (
          <div key={token} className="flex items-baseline gap-3">
            <code className="text-2xs font-mono text-text-muted w-16 shrink-0">{token}</code>
            <span className={`font-sans ${token} font-bold text-text-primary`}>{size}</span>
            <span className="text-2xs text-text-muted">{desc}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function FontStacksSection() {
  return (
    <Section icon={<Type size={16} />} title="Font Stacks">
      <div className="space-y-2">
        <p className="font-display text-3xl font-black tracking-tight text-text-primary">Display: Cabinet Grotesk</p>
        <p className="font-sans text-xl font-bold text-text-primary">Heading: Plus Jakarta Sans</p>
        <p className="font-sans text-base text-text-primary">Body: 15px regular</p>
        <p className="pixel-label">Pixel Label: 9px uppercase mono</p>
        <p className="font-mono text-sm text-text-muted">Mono: Geist Mono</p>
      </div>
    </Section>
  );
}

export function ButtonGallery() {
  return (
    <Section icon={<Box size={16} />} title="Button">
      <Row label="Variants">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="tonal">Tonal</Button>
      </Row>
      <Row label="Sizes">
        <Button variant="primary" size="sm">Small</Button>
        <Button variant="primary" size="md">Medium</Button>
        <Button variant="primary" size="lg">Large</Button>
      </Row>
      <Row label="States">
        <Button variant="primary" loading>Loading</Button>
        <Button variant="primary" disabled>Disabled</Button>
        <Button variant="primary" icon={<Sparkles size={14} />}>With Icon</Button>
        <Button variant="danger" icon={<Sparkles size={14} />} iconPosition="right">Icon Right</Button>
      </Row>
    </Section>
  );
}

export function CardGallery() {
  return (
    <Section icon={<Layers size={16} />} title="Card">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(['glass', 'immersive', 'canvas', 'receipt', 'outline', 'notice', 'danger', 'accent'] as const).map(v => (
          <Card key={v} variant={v} padding="1rem">
            <p className="text-xs font-black uppercase tracking-widest text-text-muted mb-1">{v}</p>
            <p className="text-sm text-text-secondary">Variant content goes here.</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

export function BadgeGallery() {
  return (
    <Section icon={<Sparkles size={16} />} title="Badge">
      <Row label="Count">
        <Badge variant="count" count={3} />
        <Badge variant="count" count={42} />
        <Badge variant="count" count={999} />
        <Badge variant="count" count={7} color="var(--legacy-color-038)" />
      </Row>
      <Row label="Dot">
        <Badge variant="dot" />
        <Badge variant="dot" color="var(--legacy-color-004)" />
        <Badge variant="dot" color="var(--legacy-color-040)" />
      </Row>
      <Row label="Tag">
        <Badge variant="tag">Pilne</Badge>
        <Badge variant="tag" color="var(--legacy-color-004)">Gotowe</Badge>
        <Badge variant="tag" color="var(--legacy-color-038)">Krytyczne</Badge>
      </Row>
    </Section>
  );
}

const TAB_DEMO = [
  { key: 'tab1', label: 'Dzisiaj' },
  { key: 'tab2', label: 'Tydzien' },
  { key: 'tab3', label: 'Miesiac' },
];

export function TabsGallery() {
  const [activeTab, setActiveTab] = useState('tab1');
  return (
    <Section icon={<Box size={16} />} title="Tabs">
      <div className="max-w-sm">
        <Tabs tabs={TAB_DEMO} active={activeTab} onChange={setActiveTab} />
      </div>
      <p className="text-xs text-text-muted">Active: <span className="font-bold text-text-primary">{activeTab}</span></p>
    </Section>
  );
}

export function ModalGallery() {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSize, setModalSize] = useState<'sm' | 'md' | 'lg' | 'xl'>('md');
  return (
    <Section icon={<Box size={16} />} title="Modal">
      <Row>
        {(['sm', 'md', 'lg', 'xl'] as const).map(s => (
          <Button key={s} variant="outline" size="sm" onClick={() => { setModalSize(s); setModalOpen(true); }}>
            Open {s}
          </Button>
        ))}
      </Row>
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Modal Showcase" subtitle="design-system" size={modalSize}>
        <div className="space-y-3 py-2">
          <p className="text-sm text-text-secondary">
            Size: <span className="font-bold text-text-primary">{modalSize}</span> -- this is the content area.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={() => setModalOpen(false)}>Confirm</Button>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

export function SpinnerGallery() {
  return (
    <Section icon={<Sparkles size={16} />} title="Spinner">
      <div className="flex items-end gap-6">
        <div className="flex flex-col items-center gap-1"><Spinner size="sm" /><span className="text-2xs font-bold text-text-muted">sm</span></div>
        <div className="flex flex-col items-center gap-1"><Spinner size="md" /><span className="text-2xs font-bold text-text-muted">md</span></div>
        <div className="flex flex-col items-center gap-1"><Spinner size="lg" /><span className="text-2xs font-bold text-text-muted">lg</span></div>
      </div>
    </Section>
  );
}

export function SkeletonGallery() {
  return (
    <Section icon={<Box size={16} />} title="Skeleton">
      <div className="max-w-sm space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">text (3 lines)</p>
          <Skeleton variant="text" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">avatar</p>
          <Skeleton variant="avatar" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-2">card</p>
          <Skeleton variant="card" lines={3} />
        </div>
      </div>
    </Section>
  );
}

export function EmptyStateGallery() {
  return (
    <Section icon={<Box size={16} />} title="EmptyState">
      <div className="max-w-sm">
        <EmptyState icon="📭" label="Brak elementow do wyswietlenia" action={{ label: 'Dodaj pierwszy', onClick: () => {} }} />
      </div>
    </Section>
  );
}

export function CharacterAvatarGallery() {
  return (
    <Section icon={<Sparkles size={16} />} title="CharacterAvatar">
      <Row>
        {['Jakub', 'Alice', 'Bob', 'System', 'Dev'].map(seed => (
          <div key={seed} className="flex flex-col items-center gap-1">
            <CharacterAvatar seed={seed} size={40} />
            <span className="text-2xs font-bold text-text-muted">{seed}</span>
          </div>
        ))}
      </Row>
    </Section>
  );
}

export function CssVariablesReference() {
  return (
    <Section icon={<Palette size={16} />} title="CSS Variables (copy-paste)">
      <div className="rounded-xl border border-border-custom/30 bg-surface p-4 font-mono text-xs text-text-secondary space-y-1 overflow-x-auto">
        <p><span className="text-info">--color-info</span>        <span className="text-text-muted">var(--color-info)</span></p>
        <p><span className="text-success">--color-success</span>    <span className="text-text-muted">var(--color-success)</span></p>
        <p><span className="text-warning">--color-warning</span>    <span className="text-text-muted">var(--color-warning)</span></p>
        <p><span className="text-danger">--color-danger</span>      <span className="text-text-muted">var(--color-danger)</span></p>
        <p className="text-text-muted mt-2">Tailwind classes: bg-danger, text-success, border-warning, bg-surface-2, etc.</p>
      </div>
    </Section>
  );
}
