import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Share, Users, Zap, Activity } from 'lucide-react';

export default function GraphMind({ session }) {
  const containerRef = useRef(null);
  const [stats, setStats] = useState('Inicjalizacja...');
  const [currentFilter, setCurrentFilter] = useState('current');
  const [allData, setAllData] = useState({ nodes: [], edges: [] });
  const networkRef = useRef(null);

  useEffect(() => {
    // Ładowanie vis-network z CDN
    const script = document.createElement('script');
    script.src = "https://unpkg.com/vis-network/standalone/umd/vis-network.min.js";
    script.async = true;
    script.onload = () => initGraph();
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  async function initGraph() {
    const { data, error } = await supabase
      .from('vanguard_entity_links')
      .select('source_entity, source_type, target_entity, target_type, relation, temporal_status, evidence_count')
      .eq('user_id', session.user.id);

    if (error) {
      setStats("Błąd: " + error.message);
      return;
    }

    const counts = { current: 0, declared: 0, hypothesis: 0, unknown: 0, historical: 0, stale: 0 };
    (data || []).forEach(l => {
      const s = l.temporal_status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    const currentTotal = (counts.current || 0) + (counts.declared || 0);
    setStats(
      `Wszystkie: ${data.length} | Aktualne: ${currentTotal} | Hipotezy: ${counts.hypothesis || 0} | Legacy: ${counts.unknown + (counts.historical || 0) + (counts.stale || 0)}`
    );

    const nodesMap = new Map();
    const edges = [];

    data.forEach(link => {
      const addNode = (id, type) => {
        if (!nodesMap.get(id)) {
          let color = '#00f2ff';
          let category = 'other';
          if (type === 'person') { color = '#ff0055'; category = 'person'; }
          if (type === 'career' || id.toLowerCase().includes('studia') || id.toLowerCase().includes('mgr')) { 
            color = '#ffcc00'; category = 'career'; 
          }
          if (type === 'state' || type === 'physical_state') { color = '#7700ff'; category = 'state'; }
          if (type === 'event') { color = '#00ff66'; category = 'event'; }
          
          nodesMap.set(id, { id, label: id, color, category });
        }
      };

      addNode(link.source_entity, link.source_type);
      addNode(link.target_entity, link.target_type);

      const edgeColor = {
        current:    { color: 'rgba(0,242,255,0.6)',   highlight: '#00f2ff' },
        declared:   { color: 'rgba(0,255,102,0.5)',   highlight: '#00ff66' },
        hypothesis: { color: 'rgba(255,204,0,0.3)',   highlight: '#ffcc00' },
        unknown:    { color: 'rgba(255,255,255,0.04)', highlight: 'rgba(255,255,255,0.15)' },
        historical: { color: 'rgba(255,255,255,0.04)', highlight: 'rgba(255,255,255,0.15)' },
        stale:      { color: 'rgba(255,255,255,0.04)', highlight: 'rgba(255,255,255,0.15)' },
      }[link.temporal_status || 'unknown'] || { color: 'rgba(255,255,255,0.04)', highlight: '#fff' };

      edges.push({
        from: link.source_entity,
        to: link.target_entity,
        label: link.relation,
        arrows: 'to',
        color: edgeColor,
        font: { size: 8, color: 'rgba(255,255,255,0.2)', strokeWidth: 0 },
        temporalStatus: link.temporal_status || 'unknown'
      });
    });

    const nodesArray = Array.from(nodesMap.values());
    setAllData({ nodes: nodesArray, edges });

    const options = {
      nodes: {
        shape: 'dot',
        size: 12,
        font: { color: '#888', size: 10, face: 'Inter' },
        borderWidth: 2,
        shadow: true
      },
      physics: {
        forceAtlas2Based: { gravitationalConstant: -40, centralGravity: 0.005, springLength: 180 },
        solver: 'forceAtlas2Based',
        stabilization: { iterations: 100 }
      }
    };

    const container = containerRef.current;
    // @ts-ignore
    networkRef.current = new window.vis.Network(container, { 
      nodes: new window.vis.DataSet(nodesArray), 
      edges: new window.vis.DataSet(edges) 
    }, options);
  }

  useEffect(() => {
    if (!networkRef.current || allData.nodes.length === 0) return;

    const TEMPORAL_FILTERS = ['current', 'declared', 'hypothesis', 'unknown'];

    let activeEdges = allData.edges;
    if (TEMPORAL_FILTERS.includes(currentFilter)) {
      activeEdges = allData.edges.filter(e => e.temporalStatus === currentFilter ||
        (currentFilter === 'current' && (e.temporalStatus === 'current' || e.temporalStatus === 'declared'))
      );
    } else if (currentFilter !== 'all') {
      const directNodes = allData.nodes.filter(n => n.category === currentFilter);
      const nodeIds = new Set(directNodes.map(n => n.id));
      const connectedEdges = allData.edges.filter(e => nodeIds.has(e.from) || nodeIds.has(e.to));
      const connectedNodeIds = new Set([...connectedEdges.map(e => e.from), ...connectedEdges.map(e => e.to)]);
      activeEdges = connectedEdges;
      const filteredNodes = allData.nodes.filter(n => connectedNodeIds.has(n.id));
      const filteredEdgeSubset = filteredNodes.length > 0
        ? allData.edges.filter(e => connectedNodeIds.has(e.from) && connectedNodeIds.has(e.to))
        : [];
      const edgeNodeIds = new Set([...filteredEdgeSubset.map(e => e.from), ...filteredEdgeSubset.map(e => e.to)]);
      networkRef.current.setData({
        nodes: new window.vis.DataSet(allData.nodes.filter(n => edgeNodeIds.has(n.id))),
        edges: new window.vis.DataSet(filteredEdgeSubset)
      });
      return;
    }

    const visibleNodeIds = new Set([...activeEdges.map(e => e.from), ...activeEdges.map(e => e.to)]);
    networkRef.current.setData({
      nodes: new window.vis.DataSet(allData.nodes.filter(n => visibleNodeIds.has(n.id))),
      edges: new window.vis.DataSet(activeEdges)
    });
  }, [currentFilter, allData]);

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] animate-in fade-in duration-1000">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Mind Architecture</h2>
          <p className="text-[10px] text-white/40 font-bold">{stats}</p>
        </div>
        <div className="p-2 bg-primary/10 rounded-xl border border-primary/20">
          <Share size={16} className="text-primary" />
        </div>
      </div>

      <div className="flex-1 bg-neutral-900/40 border border-white/5 rounded-3xl relative overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />
        
        {/* Kontrolki filtrów */}
        <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {[
            { id: 'current',    label: 'Aktualne',   icon: Activity },
            { id: 'hypothesis', label: 'Hipotezy',   icon: Zap },
            { id: 'unknown',    label: 'Legacy',     icon: Share },
            { id: 'all',        label: 'Wszystko',   icon: Users },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setCurrentFilter(f.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                currentFilter === f.id ? 'bg-primary border-primary text-black' : 'bg-black/40 border-white/10 text-white/40'
              }`}
            >
              <f.icon size={10} />
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
