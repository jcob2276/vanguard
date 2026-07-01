import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
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

type Measurement = {
  id: string;
  measured_at: string;
  eye_measured: 'left' | 'right' | 'both';
  diopters: number;
};

type DailyLog = {
  id: string;
  date: string;
  active_focus_minutes: number;
  screen_time_hours: number;
};

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
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [mRes, logsRes] = await Promise.all([
        supabase.from('endmyopia_measurements').select('*').order('measured_at', { ascending: true }),
        supabase.from('endmyopia_daily_logs').select('*').order('date', { ascending: true })
      ]);
      if (mRes.data) setMeasurements(mRes.data);
      if (logsRes.data) setDailyLogs(logsRes.data);
      setLoading(false);
    }
    loadData();
  }, [refreshTrigger]);

  // Process data for charts
  // We want to group by Month/Year and show Rano-L, Południe-L, Wieczór-L, etc.
  const chartDataLeft = useMemo(() => {
    const grouped: Record<string, { name: string; rano: number[]; poludnie: number[]; wieczor: number[] }> = {};
    measurements.filter(m => m.eye_measured === 'left' || m.eye_measured === 'both').forEach(m => {
      const my = getMonthYear(m.measured_at);
      if (!grouped[my]) grouped[my] = { name: my, rano: [], poludnie: [], wieczor: [] };
      const tod = getTimeOfDay(m.measured_at);
      if (tod === 'Rano') grouped[my].rano.push(m.diopters);
      else if (tod === 'Południe') grouped[my].poludnie.push(m.diopters);
      else grouped[my].wieczor.push(m.diopters);
    });

    return Object.values(grouped).map(g => ({
      name: g.name,
      'Rano - L': g.rano.length ? (g.rano.reduce((a,b)=>a+b,0)/g.rano.length).toFixed(2) : null,
      'Południe - L': g.poludnie.length ? (g.poludnie.reduce((a,b)=>a+b,0)/g.poludnie.length).toFixed(2) : null,
      'Wieczór - L': g.wieczor.length ? (g.wieczor.reduce((a,b)=>a+b,0)/g.wieczor.length).toFixed(2) : null,
    }));
  }, [measurements]);

  const chartDataRight = useMemo(() => {
    const grouped: Record<string, { name: string; rano: number[]; poludnie: number[]; wieczor: number[] }> = {};
    measurements.filter(m => m.eye_measured === 'right' || m.eye_measured === 'both').forEach(m => {
      const my = getMonthYear(m.measured_at);
      if (!grouped[my]) grouped[my] = { name: my, rano: [], poludnie: [], wieczor: [] };
      const tod = getTimeOfDay(m.measured_at);
      if (tod === 'Rano') grouped[my].rano.push(m.diopters);
      else if (tod === 'Południe') grouped[my].poludnie.push(m.diopters);
      else grouped[my].wieczor.push(m.diopters);
    });

    return Object.values(grouped).map(g => ({
      name: g.name,
      'Rano - P': g.rano.length ? (g.rano.reduce((a,b)=>a+b,0)/g.rano.length).toFixed(2) : null,
      'Południe - P': g.poludnie.length ? (g.poludnie.reduce((a,b)=>a+b,0)/g.poludnie.length).toFixed(2) : null,
      'Wieczór - P': g.wieczor.length ? (g.wieczor.reduce((a,b)=>a+b,0)/g.wieczor.length).toFixed(2) : null,
    }));
  }, [measurements]);

  if (loading) return <div className="p-4 text-text-muted">Wczytywanie dziennika...</div>;

  return (
    <div className="w-full flex flex-col gap-8 bg-surface/50 p-6 rounded-3xl border border-border-custom shadow-xl">
      <div>
        <h3 className="text-xl font-bold mb-4">Lewe Oko</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartDataLeft}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" fontSize={12} />
              <YAxis domain={['auto', 'auto']} stroke="#888" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
              <Legend />
              <Line type="monotone" dataKey="Rano - L" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="Południe - L" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="Wieczór - L" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Prawe Oko</h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartDataRight}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#888" fontSize={12} />
              <YAxis domain={['auto', 'auto']} stroke="#888" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }} />
              <Legend />
              <Line type="monotone" dataKey="Rano - P" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="Południe - P" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="Wieczór - P" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
