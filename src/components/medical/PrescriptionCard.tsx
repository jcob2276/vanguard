import React from 'react';
import { Calendar, Info, Glasses } from 'lucide-react';
import type { Prescription } from './GlassesCabinet';

interface PrescriptionCardProps {
  title: string;
  prescription?: Prescription;
}

export default function PrescriptionCard({ title, prescription }: PrescriptionCardProps) {
  if (!prescription) {
    return (
      <div className="rounded-2xl border border-border-custom bg-surface/40 p-6 flex flex-col items-center justify-center text-center">
        <Glasses className="text-text-muted opacity-30 mb-2" size={32} />
        <h4 className="text-sm font-semibold text-text-muted">{title}</h4>
        <p className="text-xs text-text-muted mt-1">Brak aktywnych szkieł w bazie</p>
      </div>
    );
  }

  const isNormalized = prescription.type === 'normalized';

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all ${isNormalized ? 'bg-blue-500/5 border-blue-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-20 pointer-events-none ${isNormalized ? 'bg-blue-500' : 'bg-emerald-500'}`} />
      
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full ${isNormalized ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
            {isNormalized ? 'NORMALIZATION' : 'DIFFERENTIALS'}
          </span>
          <p className="text-xs text-text-muted mt-2 flex items-center gap-1">
            <Calendar size={12} /> Od {prescription.started_at}
          </p>
        </div>
        {prescription.notes && (
          <div className="flex items-center gap-1 text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded">
            <Info size={12} /> {prescription.notes}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left Eye */}
        <div className="bg-surface/50 rounded-xl p-3 border border-border-custom">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Lewe Oko (OS)</div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[10px] text-text-muted">Sfera</div>
              <div className="font-display font-black text-xl">{prescription.sphere_l ?? '-'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-text-muted">Cyl / Oś</div>
              <div className="text-sm font-semibold">{prescription.cyl_l ?? '-'} / {prescription.axis_l ? `${prescription.axis_l}°` : '-'}</div>
            </div>
          </div>
        </div>

        {/* Right Eye */}
        <div className="bg-surface/50 rounded-xl p-3 border border-border-custom">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Prawe Oko (OD)</div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[10px] text-text-muted">Sfera</div>
              <div className="font-display font-black text-xl">{prescription.sphere_r ?? '-'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-text-muted">Cyl / Oś</div>
              <div className="text-sm font-semibold">{prescription.cyl_r ?? '-'} / {prescription.axis_r ? `${prescription.axis_r}°` : '-'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
