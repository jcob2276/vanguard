import React, { useEffect, useState, useMemo } from 'react';
import { fetchMeasurements } from '../../lib/visionApi';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card } from '../ui/Card';

import type { Measurement } from '../../lib/visionApi';

function getTimeOfDay(dateStr: string): 'Rano' | 'Południe' | 'Wieczór' {
  const hour = new Date(dateStr).getHours();
  if (hour >= 4 && hour < 12) return 'Rano';
  if (hour >= 12 && hour < 17) return 'Południe';
  return 'Wieczór';
}

function getMonthYear(dateStr: string) {
  const d = new Date(dateStr);
  const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
  return `${months[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
}

export default function VisionJournal({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly'>('daily');

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchMeasurements();
        setMeasurements(data);
      } catch (e: unknown) {
        console.error('[VisionJournal] fetch measurements failed:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [refreshTrigger]);

  // Process data for charts
  const chartDataLeft = useMemo(() => {
    const grouped: Record<string, { sortKey: string; name: string; rano: number[]; poludnie: number[]; wieczor: number[] }> = {};
    measurements.filter(m => m.eye_measured === 'left' || m.eye_measured === 'both').forEach(m => {
      let key: string;
      let label: string;
      if (viewMode === 'daily') {
        const d = new Date(m.measured_at);
        const pad = (n: number) => n.toString().padStart(2, '0');
        key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        label = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
      } else {
        const d = new Date(m.measured_at);
        const pad = (n: number) => n.toString().padStart(2, '0');
        key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        label = getMonthYear(m.measured_at);
      }

      if (!grouped[key]) grouped[key] = { sortKey: key, name: label, rano: [], poludnie: [], wieczor: [] };
      const tod = getTimeOfDay(m.measured_at);
      if (tod === 'Rano') grouped[key].rano.push(m.diopters);
      else if (tod === 'Południe') grouped[key].poludnie.push(m.diopters);
      else grouped[key].wieczor.push(m.diopters);
    });

    return Object.values(grouped)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(g => ({
        name: g.name,
        'Rano - L': g.rano.length ? (g.rano.reduce((a,b)=>a+b,0)/g.rano.length).toFixed(2) : null,
        'Południe - L': g.poludnie.length ? (g.poludnie.reduce((a,b)=>a+b,0)/g.poludnie.length).toFixed(2) : null,
        'Wieczór - L': g.wieczor.length ? (g.wieczor.reduce((a,b)=>a+b,0)/g.wieczor.length).toFixed(2) : null,
      }));
  }, [measurements, viewMode]);

  const chartDataRight = useMemo(() => {
    const grouped: Record<string, { sortKey: string; name: string; rano: number[]; poludnie: number[]; wieczor: number[] }> = {};
    measurements.filter(m => m.eye_measured === 'right' || m.eye_measured === 'both').forEach(m => {
      let key: string;
      let label: string;
      if (viewMode === 'daily') {
        const d = new Date(m.measured_at);
        const pad = (n: number) => n.toString().padStart(2, '0');
        key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        label = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
      } else {
        const d = new Date(m.measured_at);
        const pad = (n: number) => n.toString().padStart(2, '0');
        key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
        label = getMonthYear(m.measured_at);
      }

      if (!grouped[key]) grouped[key] = { sortKey: key, name: label, rano: [], poludnie: [], wieczor: [] };
      const tod = getTimeOfDay(m.measured_at);
      if (tod === 'Rano') grouped[key].rano.push(m.diopters);
      else if (tod === 'Południe') grouped[key].poludnie.push(m.diopters);
      else grouped[key].wieczor.push(m.diopters);
    });

    return Object.values(grouped)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(g => ({
        name: g.name,
        'Rano - P': g.rano.length ? (g.rano.reduce((a,b)=>a+b,0)/g.rano.length).toFixed(2) : null,
        'Południe - P': g.poludnie.length ? (g.poludnie.reduce((a,b)=>a+b,0)/g.poludnie.length).toFixed(2) : null,
        'Wieczór - P': g.wieczor.length ? (g.wieczor.reduce((a,b)=>a+b,0)/g.wieczor.length).toFixed(2) : null,
      }));
  }, [measurements, viewMode]);

  if (loading) return <div className="p-4 text-text-muted">Wczytywanie dziennika...</div>;

  return (
    <Card variant="glass" className="w-full flex flex-col gap-8 bg-surface/50 border-border-custom" padding="1.5rem">
      <div className="flex items-center justify-between border-b border-border-custom/40 pb-4">
        <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Agregacja wykresu</span>
        <div className="flex bg-slate-100 dark:bg-white/[0.02] border border-border-custom/60 rounded-xl p-0.5">
          <button
            onClick={() => setViewMode('daily')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'daily'
                ? 'bg-primary text-white shadow-sm font-black'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Dzienna
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'monthly'
                ? 'bg-primary text-white shadow-sm font-black'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Miesięczna
          </button>
        </div>
      </div>
      <div>
        <h3 className="text-xl font-bold mb-4">Lewe Oko</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={chartDataLeft}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
              <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-solid)', border: '1px solid var(--color-border-custom)' }} />
              <Legend />
              <Line type="monotone" dataKey="Rano - L" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="Południe - L" stroke="var(--color-danger)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="Wieczór - L" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Prawe Oko</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart data={chartDataRight}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
              <YAxis domain={['auto', 'auto']} stroke="var(--text-muted)" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface-solid)', border: '1px solid var(--color-border-custom)' }} />
              <Legend />
              <Line type="monotone" dataKey="Rano - P" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="Południe - P" stroke="var(--color-danger)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="Wieczór - P" stroke="var(--color-warning)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
