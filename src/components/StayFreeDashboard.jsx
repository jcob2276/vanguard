import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  BarChart3, 
  Clock, 
  Smartphone, 
  Monitor, 
  ChevronRight, 
  ChevronLeft, 
  Filter, 
  ArrowUpDown,
  Zap,
  Activity,
  Upload,
  Search,
  LayoutGrid,
  List
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

export default function StayFreeDashboard({ session }) {
  const [rawData, setRawData] = useState([]);
  const [view, setView] = useState('all'); 
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const itemsPerPage = 15;

  // Helper functions
  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const isMobile = (deviceName) => {
    const name = (deviceName || '').toLowerCase();
    return name.includes('xiaomi') || name.includes('iphone') || name.includes('samsung') || name.includes('mobile');
  };

  const getAppCategory = (appName) => {
    const name = (appName || '').toLowerCase();
    if (/youtube|facebook|instagram|tiktok|twitter|reddit|x|social/.test(name)) return { label: 'Social', color: 'text-red-400' };
    if (/gmail|calendar|notion|code|obsidian|slack|linkedin|office|sheets/.test(name)) return { label: 'Productivity', color: 'text-green-400' };
    if (/netflix|spotify|disney|prime|entertainment/.test(name)) return { label: 'Entertainment', color: 'text-blue-400' };
    return { label: 'Other', color: 'text-neutral-500' };
  };

  // 1. Fetch data from Supabase on mount
  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('stayfree_usage')
        .select('*')
        .eq('user_id', session.user.id)
        .order('date', { ascending: false });
      
      if (error) console.error('Error loading stayfree data:', error);
      if (data) setRawData(data);
    };
    fetchData();
  }, [session.user.id]);

  // 2. Process data for views
  const dailyStats = useMemo(() => {
    if (!rawData.length) return [];
    const grouped = rawData.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = { 
          date: item.date, 
          exposureLoad: 0, 
          unlocksByDevice: {},
          durationByDevice: {}
        };
      }
      acc[item.date].exposureLoad += item.duration_seconds;
      acc[item.date].unlocksByDevice[item.device_name] = item.unlocks;
      acc[item.date].durationByDevice[item.device_name] = (acc[item.date].durationByDevice[item.device_name] || 0) + item.duration_seconds;
      return acc;
    }, {});

    return Object.values(grouped).map(day => {
      const durations = Object.values(day.durationByDevice || {});
      const realTimeEstimate = durations.length > 0 ? Math.max(...durations) : 0;
      const totalUnlocks = Math.max(...Object.values(day.unlocksByDevice || {}), 0);
      const overlapFactor = realTimeEstimate > 0 ? day.exposureLoad / realTimeEstimate : 1.0;
      const fragIndex = totalUnlocks / ((realTimeEstimate / 60) || 1);
      
      return { 
        ...day, 
        totalUnlocks, 
        realTimeEstimate, 
        overlapFactor, 
        fragIndex 
      };
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [rawData]);

  const topApps = useMemo(() => {
    if (!rawData.length) return [];
    const grouped = rawData.reduce((acc, item) => {
      if (!acc[item.app_name]) acc[item.app_name] = { name: item.app_name, duration: 0, launches: 0 };
      acc[item.app_name].duration += item.duration_seconds;
      acc[item.app_name].launches += item.launches;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.duration - a.duration);
  }, [rawData]);

  const signals = useMemo(() => {
    if (dailyStats.length === 0) return null;
    const latest = dailyStats[0];
    return {
      fragmentation: latest.fragIndex > 1.2 ? 'HIGH' : 'STABLE',
      attention: latest.realTimeEstimate / latest.totalUnlocks < 60 ? 'LOW' : 'OPTIMAL',
      dopamine: topApps.filter(a => getAppCategory(a.name).label === 'Social').reduce((sum, a) => sum + a.duration, 0) > 3600 ? 'SINK' : 'SAFE',
      exposureLoad: latest.exposureLoad,
      overlapFactor: latest.overlapFactor,
      realTime: latest.realTimeEstimate
    };
  }, [dailyStats, topApps]);

  const processedData = useMemo(() => {
    let filtered = [...rawData];
    if (searchTerm) filtered = filtered.filter(item => item.app_name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (deviceFilter !== 'all') {
      filtered = filtered.filter(item => {
        const mobile = isMobile(item.device_name);
        return deviceFilter === 'mobile' ? mobile : !mobile;
      });
    }
    filtered.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      if (sortConfig.key === 'attention') {
        aValue = a.duration_seconds / (a.launches || 1);
        bValue = b.duration_seconds / (b.launches || 1);
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [rawData, searchTerm, deviceFilter, sortConfig]);

  const paginatedData = processedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(processedData.length / itemsPerPage);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawJson = JSON.parse(event.target.result);
        const aggregated = rawJson.reduce((acc, item) => {
          const key = `${item.date}_${item.app_name}_${item.device_name}`;
          if (!acc[key]) {
            acc[key] = { ...item, user_id: session.user.id };
          } else {
            acc[key].duration_seconds += item.duration_seconds;
            acc[key].launches += item.launches;
            acc[key].unlocks = Math.max(acc[key].unlocks, item.unlocks);
          }
          return acc;
        }, {});
        const finalData = Object.values(aggregated);
        const { error } = await supabase.from('stayfree_usage').upsert(finalData, { onConflict: 'user_id, date, app_name, device_name' });
        if (error) throw error;
        const { data } = await supabase.from('stayfree_usage').select('*').eq('user_id', session.user.id).order('date', { ascending: false });
        if (data) setRawData(data);
      } catch (err) {
        alert('Błąd importu: ' + err.message);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsText(file);
  };

  if (rawData.length === 0 && !isUploading) {
    return (
      <div className="p-8 space-y-6">
        <div className="bg-neutral-900 border-2 border-dashed border-neutral-800 rounded-3xl p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
            <Upload size={32} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase italic">Importuj dane StayFree</h3>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mt-1">Wybierz plik MirrorMode_Vanguard.json</p>
          </div>
          <label className="inline-block bg-primary text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest cursor-pointer hover:scale-105 transition-transform">
            Wybierz Plik
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter">StayFree Matrix</h2>
      </div>

      {/* Decision Layer / Signals */}
      <section className="bg-primary/5 border border-primary/20 rounded-2xl p-4 grid grid-cols-4 gap-2">
        <div className="text-center">
          <p className="text-[7px] font-black text-neutral-500 uppercase">Exposure</p>
          <p className="text-[10px] font-black uppercase text-white">{formatDuration(signals?.exposureLoad || 0)}</p>
        </div>
        <div className="text-center border-x border-neutral-800">
          <p className="text-[7px] font-black text-neutral-500 uppercase">Overlap</p>
          <p className={`text-[10px] font-black uppercase ${signals?.overlapFactor > 1.5 ? 'text-red-500' : 'text-dayC'}`}>
            {signals?.overlapFactor?.toFixed(2)}x
          </p>
        </div>
        <div className="text-center border-r border-neutral-800">
          <p className="text-[7px] font-black text-neutral-500 uppercase">Real Time</p>
          <p className="text-[10px] font-black uppercase text-white">{formatDuration(signals?.realTime || 0)}</p>
        </div>
        <div className="text-center">
          <p className="text-[7px] font-black text-neutral-500 uppercase">Fragmentation</p>
          <p className={`text-[10px] font-black uppercase ${signals?.fragmentation === 'HIGH' ? 'text-red-500' : 'text-dayC'}`}>
            {signals?.fragmentation === 'HIGH' ? 'High' : 'Stable'}
          </p>
        </div>
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4">
          <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Active State</p>
          <p className="text-xl font-black text-white italic uppercase">{signals?.overlapFactor > 1.3 ? 'Multitasking' : 'Focused'}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 relative overflow-hidden group">
          <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">Digital Health</p>
          <p className="text-xl font-black text-dayC italic uppercase">Operative</p>
          <Activity className="absolute -right-2 -bottom-2 text-dayC/10 group-hover:text-dayC/20 transition-colors" size={48} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800">
        {[
          { id: 'all', icon: List, label: 'Wszystko' },
          { id: 'daily', icon: Activity, label: 'Dzienny' },
          { id: 'top_apps', icon: BarChart3, label: 'Ranking' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${view === tab.id ? 'bg-neutral-800 text-white shadow-lg' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {view === 'all' && (
        <>
          {/* Controls */}
          <div className="space-y-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-primary transition-colors" size={14} />
              <input 
                type="text" 
                placeholder="Szukaj aplikacji..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 pl-10 text-[10px] font-bold text-white outline-none focus:border-primary transition-all"
              />
            </div>
            
            <div className="flex gap-2">
              {['all', 'mobile', 'pc'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setDeviceFilter(filter)}
                  className={`flex-1 py-2 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${deviceFilter === filter ? 'bg-primary border-primary text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-500'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/30">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-900 text-[8px] font-black text-neutral-500 uppercase tracking-widest border-b border-neutral-800">
                  <th className="p-4 cursor-pointer hover:text-white" onClick={() => requestSort('date')}>Data</th>
                  <th className="p-4">App</th>
                  <th className="p-4 text-right cursor-pointer hover:text-white" onClick={() => requestSort('duration_seconds')}>Czas</th>
                  <th className="p-4 text-right cursor-pointer hover:text-white" onClick={() => requestSort('attention')}>Span</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50 text-[10px] font-bold text-white">
                {paginatedData.map((item, idx) => {
                  const attention = Math.round(item.duration_seconds / (item.launches || 1));
                  const isHighUsage = item.duration_seconds > 3600;
                  const mobile = isMobile(item.device_name);
                  const category = getAppCategory(item.app_name);

                  return (
                    <tr key={idx} className={`hover:bg-neutral-800/20 transition-colors ${isHighUsage ? 'bg-red-500/5' : ''}`}>
                      <td className="p-4 text-neutral-500 font-black">{format(parseISO(item.date), 'dd.MM')}</td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="flex items-center gap-1.5">
                            {item.app_name}
                            {mobile ? <Smartphone size={10} className="text-primary" /> : <Monitor size={10} className="text-neutral-500" />}
                          </span>
                          <span className={`text-[7px] font-black uppercase ${category.color}`}>{category.label}</span>
                        </div>
                      </td>
                      <td className={`p-4 text-right font-black ${isHighUsage ? 'text-red-500' : ''}`}>
                        {formatDuration(item.duration_seconds)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex flex-col items-end">
                          <span>{attention}s</span>
                          <div className="w-8 h-1 bg-neutral-800 rounded-full mt-1 overflow-hidden">
                            <div 
                              className={`h-full ${attention < 30 ? 'bg-red-500' : attention < 60 ? 'bg-yellow-500' : 'bg-green-500'}`} 
                              style={{ width: `${Math.min(attention / 2, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-[8px] font-black text-neutral-600 uppercase">Page {currentPage} of {totalPages}</p>
            <div className="flex gap-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-500 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-500 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </>
      )}

      {view === 'daily' && (
        <div className="space-y-4">
          {dailyStats.map((day, idx) => {
            const isCritical = day.fragIndex > 1.0; 
            return (
              <div key={idx} className={`bg-neutral-900 border ${isCritical ? 'border-red-500/50' : 'border-neutral-800'} rounded-2xl p-4 flex justify-between items-center group hover:border-primary/50 transition-all`}>
                <div>
                  <p className="text-[10px] font-black text-white uppercase italic">{format(parseISO(day.date), 'EEEE, d MMMM', { locale: pl })}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1" title="Digital Exposure Load">
                      <Clock size={8} /> Exp: {formatDuration(day.exposureLoad)}
                    </span>
                    <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-1">
                      <Zap size={8} /> {day.totalUnlocks} odblokowań
                    </span>
                    <span className={`text-[8px] font-black uppercase tracking-widest flex items-center gap-1 ${isCritical ? 'text-red-500' : 'text-green-500'}`}>
                      Frag: {day.fragIndex.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-full border-2 ${isCritical ? 'border-red-500/30 text-red-500' : 'border-neutral-800 text-primary'} flex items-center justify-center text-[10px] font-black group-hover:scale-110 transition-transform`} title="Real Time Estimate">
                  {Math.round(day.realTimeEstimate / 3600)}h
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === 'top_apps' && (
        <div className="space-y-4">
          {topApps.slice(0, 10).map((app, idx) => (
            <div key={idx} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-black text-white uppercase italic">{app.name}</p>
                  <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">{app.launches} uruchomień</p>
                </div>
                <p className="text-lg font-black text-primary italic">{formatDuration(app.duration)}</p>
              </div>
              <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                  style={{ width: `${(app.duration / (topApps[0]?.duration || 1)) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
