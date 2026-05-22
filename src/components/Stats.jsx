import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Trophy, Clock, Trash2, FileText, ChevronDown, ChevronUp, Scale, Ruler, Activity, Zap, TrendingUp, Target, Battery, CheckSquare } from 'lucide-react';
import { format, differenceInDays, parseISO, startOfWeek, addWeeks, subDays } from 'date-fns';
import { pl } from 'date-fns/locale';

const START_DATE = new Date('2026-04-26');

const TrendArrow = ({ current, previous, better = 'up' }) => {
  if (previous === undefined || previous === null || current === undefined || current === null) return null;
  
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return <span className="ml-1 text-neutral-500">→</span>;
  
  const isImproving = better === 'up' ? diff > 0 : diff < 0;
  
  return (
    <span className={`ml-1 font-black ${isImproving ? 'text-dayC' : 'text-dayB'}`}>
      {diff > 0 ? '↑' : '↓'}
    </span>
  );
};

const calculateProjection = (data, field, daysIntoFuture = 42) => {
  if (!data || data.length < 3) return null;
  
  // Use last 14 days for a more relevant trend
  const recentData = data.slice(-14);
  const n = recentData.length;
  
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  const firstDay = new Date(recentData[0].date).getTime();
  
  recentData.forEach((d, i) => {
    const x = i; // Days from start of sample
    const val = Number(d[field]);
    if (isNaN(val) || val === 0) return;
    
    sumX += x;
    sumY += val;
    sumXY += x * val;
    sumXX += x * x;
  });
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  // Predict value at current day index + daysIntoFuture
  const currentIndex = n - 1;
  const projectedValue = slope * (currentIndex + daysIntoFuture) + intercept;
  const currentActual = recentData[n - 1][field];
  
  return {
    value: projectedValue.toFixed(1),
    change: (projectedValue - currentActual).toFixed(1)
  };
};

const generateNarrative = (body, oura, sessions) => {
  if (!sessions || sessions.length === 0) return null;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // 1. Treningi
  const lastWeekSessions = sessions.filter(s => new Date(s.date) >= sevenDaysAgo).length;
  
  // 2. Sen
  const lastWeekSleep = oura?.filter(o => new Date(o.date) >= sevenDaysAgo && Number(o.total_sleep_hours) > 0);
  const prevWeekSleep = oura?.filter(o => new Date(o.date) >= fourteenDaysAgo && new Date(o.date) < sevenDaysAgo && Number(o.total_sleep_hours) > 0);
  
  const avgSleepLast = lastWeekSleep?.length ? lastWeekSleep.reduce((acc, o) => acc + Number(o.total_sleep_hours), 0) / lastWeekSleep.length : 0;
  const avgSleepPrev = prevWeekSleep?.length ? prevWeekSleep.reduce((acc, o) => acc + Number(o.total_sleep_hours), 0) / prevWeekSleep.length : 0;
  
  const sleepDiffMin = (lastWeekSleep?.length >= 2 && prevWeekSleep?.length >= 2) 
    ? Math.round((avgSleepLast - avgSleepPrev) * 60) 
    : 0;

  // 3. Waga i Talia
  const lastWeekBody = body?.filter(b => new Date(b.date) >= sevenDaysAgo && Number(b.weight) > 0);
  const bodyDiffWeight = lastWeekBody?.length >= 2 ? (Number(lastWeekBody[lastWeekBody.length - 1].weight) - Number(lastWeekBody[0].weight)).toFixed(1) : null;
  const bodyDiffWaist = lastWeekBody?.length >= 2 ? (Number(lastWeekBody[lastWeekBody.length - 1].waist) - Number(lastWeekBody[0].waist)).toFixed(1) : null;

  let text = `To był ${lastWeekSessions >= 4 ? 'wybitnie mocny' : lastWeekSessions >= 3 ? 'solidny' : 'rozgrzewkowy'} tydzień. `;
  text += `Zrealizowałeś ${lastWeekSessions} treningi. `;
  
  if (sleepDiffMin !== 0) {
    text += `Twój sen ${sleepDiffMin > 0 ? 'poprawił się' : 'pogorszył się'} średnio o ${Math.abs(sleepDiffMin)} min na dobę. `;
  } else if (avgSleepLast > 0) {
    text += `Średnio sypiałeś po ${Math.floor(avgSleepLast)}h ${Math.round((avgSleepLast % 1) * 60)}m. `;
  }

  if (bodyDiffWaist && bodyDiffWaist != 0) {
    text += `W obwodzie pasa ${bodyDiffWaist < 0 ? 'zeszło' : 'przybyło'} ${Math.abs(bodyDiffWaist)} cm. `;
  } else if (bodyDiffWeight && bodyDiffWeight != 0) {
    text += `Waga ${bodyDiffWeight < 0 ? 'spadła' : 'wzrosła'} o ${Math.abs(bodyDiffWeight)} kg. `;
  }

  text += `Rób swoje, proces działa.`;
  return text;
};

import { useStore } from '../store/useStore';

export default function Stats({ session }) {
  const { userSettings } = useStore();
  const [loading, setLoading] = useState(true);
  const [bodyData, setBodyData] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [newMetric, setNewMetric] = useState({ weight: '', waist: '' });
  const [ouraTrend, setOuraTrend] = useState([]);
  const [nutritionData, setNutritionData] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({ compliance: 0 });
  const [correlation, setCorrelation] = useState(null);
  const [dateRange, setDateRange] = useState({ 
    from: format(addWeeks(new Date(), -4), 'yyyy-MM-dd'), 
    to: format(new Date(), 'yyyy-MM-dd') 
  });
  const [isExporting, setIsExporting] = useState(false);
  const [includeYazio, setIncludeYazio] = useState(true);
  const [includeJournal, setIncludeJournal] = useState(true);
  const [includeOura, setIncludeOura] = useState(true);
  const [includeHabits, setIncludeHabits] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [includeLocation, setIncludeLocation] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingFit, setIsSyncingFit] = useState(false);
  const [googleFitConnected, setGoogleFitConnected] = useState(false);
  const [googleFitConfig, setGoogleFitConfig] = useState({ id: '', secret: '' });
  const [editingSession, setEditingSession] = useState(null);
  const [editForm, setEditForm] = useState({ date: '', logs: [] });
  const [trends, setTrends] = useState({});
  const [projections, setProjections] = useState(null);
  const [narrative, setNarrative] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const [
        { data: logs },
        { data: body },
        { data: sessions },
        { data: oura },
        { data: nutrition },
        { data: settings }
      ] = await Promise.all([
        supabase.from('exercise_logs').select('*, workout_sessions(created_at, workout_day, msp_passed)').eq('user_id', session.user.id).order('created_at', { ascending: true }),
        supabase.from('body_metrics').select('*').eq('user_id', session.user.id).order('date', { ascending: true }),
        supabase.from('workout_sessions').select('*, exercise_logs(*)').eq('user_id', session.user.id).order('date', { ascending: false }),
        supabase.from('oura_daily_summary').select('*').eq('user_id', session.user.id).order('date', { ascending: false }).limit(60),
        supabase.from('daily_nutrition').select('*').order('date', { ascending: false }).limit(60),
        supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle()
      ]);
      
      if (logs) {
        const now = new Date();
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
        const thisWeekSessions = sessions?.filter(s => parseISO(s.created_at) >= thisWeekStart).length || 0;
        setWeeklyStats({ compliance: thisWeekSessions });
      }

      if (settings) {
        setGoogleFitConnected(!!settings.google_fit_refresh_token);
        setGoogleFitConfig({ id: settings.google_fit_client_id, secret: settings.google_fit_client_secret });
      }

      if (body) setBodyData(body);
      
      if (oura) {
        setOuraTrend(oura.reverse().map(o => ({
          date: format(parseISO(o.date), 'dd.MM'),
          readiness: o.readiness_score,
          sleep: o.total_sleep_hours
        })));
      }

      if (nutrition) {
        setNutritionData(nutrition.reverse().map(n => ({
          date: format(parseISO(n.date), 'dd.MM'),
          protein: n.protein,
          calories: n.calories
        })));
      }

      if (sessions) {
        setRecentSessions(sessions.map(s => ({
          ...s,
          duration: s.start_time && s.end_time ? Math.round((new Date(s.end_time) - new Date(s.start_time)) / 60000) : '--'
        })));
      }

      // Calculate Trends
      const newTrends = {};
      const ouraRaw = oura || [];
      const nutrRaw = nutrition || [];
      
      if (body && body.length >= 2) {
        newTrends.weight = { cur: body[body.length - 1].weight, prev: body[body.length - 2].weight };
        newTrends.waist = { cur: body[body.length - 1].waist, prev: body[body.length - 2].waist };
      }
      if (ouraRaw.length >= 2) {
        // oura was reversed for trend, but let's use the raw data which was ordered desc
        newTrends.readiness = { cur: ouraRaw[0].readiness_score, prev: ouraRaw[1].readiness_score };
        newTrends.sleep = { cur: ouraRaw[0].total_sleep_hours, prev: ouraRaw[1].total_sleep_hours };
      }
      if (nutrRaw.length >= 2) {
        newTrends.protein = { cur: nutrRaw[0].protein, prev: nutrRaw[1].protein };
      }
      setTrends(newTrends);

      // Calculate Projections (6 weeks)
      if (body && body.length >= 3) {
        setProjections({
          weight: calculateProjection(body, 'weight'),
          waist: calculateProjection(body, 'waist')
        });
      }

      setNarrative(generateNarrative(body, ouraRaw, sessions));
    } catch (err) {
      console.error('Fetch Stats Error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveMetrics(e) {
    e.preventDefault();
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('body_metrics').upsert({
      user_id: session.user.id,
      date: today,
      weight: newMetric.weight ? parseFloat(newMetric.weight) : null,
      waist: newMetric.waist ? parseFloat(newMetric.waist) : null
    });
    if (error) alert(error.message);
    else { alert('Zapisano!'); fetchStats(); }
  }

  async function deleteSession(id) {
    if (confirm('Usunąć trening?')) {
      await supabase.from('workout_sessions').delete().eq('id', id);
      fetchStats();
    }
  }
  async function syncHistory() {
    setIsSyncing(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-yazio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify({ userId: session.user.id, sync_history: true, days: 25 })
      });
      const res = await response.json();
      if (res.success) {
        alert(`Zsynchronizowano ${res.synced_days} dni!`);
        fetchStats();
      } else {
        alert('Błąd synchronizacji: ' + res.error);
      }
    } catch (err) {
      alert('Błąd połączenia z funkcją');
    } finally {
      setIsSyncing(false);
    }
  }

  async function connectGoogleFit() {
    if (!googleFitConfig.id) {
      alert('Najpierw wpisz Client ID w bazie danych (tabela user_settings).');
      return;
    }
    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-fit-auth`;
    const scope = 'https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/fitness.location.read';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleFitConfig.id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    
    window.open(authUrl, '_blank', 'width=600,height=600');
  }

  async function syncGoogleFit() {
    setIsSyncingFit(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-google-fit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify({ userId: session.user.id })
      });
      const res = await response.json();
      if (res.success) {
        alert(`Zsynchronizowano wagę! (${res.synced_days} dni)`);
        fetchStats();
      } else {
        alert('Błąd synchronizacji Google Fit: ' + res.error);
      }
    } catch (err) {
      alert('Błąd połączenia z funkcją Google Fit');
    } finally {
      setIsSyncingFit(false);
    }
  }
  async function startEditing(session) {
    setEditingSession(session.id);
    setEditForm({
      date: session.date,
      logs: [...session.exercise_logs]
    });
  }

  async function updateSession() {
    try {
      // 1. Update session date
      await supabase.from('workout_sessions').update({ date: editForm.date }).eq('id', editingSession);
      
      // 2. Update all logs
      for (const log of editForm.logs) {
        await supabase.from('exercise_logs').update({ 
          weight: parseFloat(log.weight), 
          reps: parseInt(log.reps) 
        }).eq('id', log.id);
      }
      
      alert('Trening zaktualizowany!');
      setEditingSession(null);
      fetchStats();
    } catch (err) {
      alert('Błąd podczas aktualizacji');
    }
  }
  async function deleteLog(id) {
    if (confirm('Usunąć tę serię?')) {
      await supabase.from('exercise_logs').delete().eq('id', id);
      setEditForm({ ...editForm, logs: editForm.logs.filter(l => l.id !== id) });
    }
  }

  async function exportData() {
    setIsExporting(true);
    try {
      const exportStartIso = new Date(`${dateRange.from}T00:00:00`).toISOString();
      const exportEndIso = new Date(`${dateRange.to}T23:59:59.999`).toISOString();
      const [
        { data: sessions },
        { data: bodyMetrics },
        { data: food },
        { data: journal },
        { data: telegramLogs },
        { data: reviews },
        { data: goals },
        { data: habits },
        { data: habitLogs },
        { data: ouraData },
        { data: photos },
        { data: locationHistory },
        { data: fundament }
      ] = await Promise.all([
        supabase.from('workout_sessions').select('*, exercise_logs(*)').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }),
        supabase.from('body_metrics').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }),
        includeYazio ? supabase.from('daily_food_entries').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve({ data: [] }),
        includeJournal ? supabase.from('daily_wins').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve({ data: [] }),
        includeJournal ? supabase.from('vanguard_stream').select('id, content, source, created_at, metadata').eq('user_id', session.user.id).eq('source', 'telegram').gte('created_at', exportStartIso).lte('created_at', exportEndIso).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
        supabase.from('weekly_reviews').select('*').eq('user_id', session.user.id).gte('week_start', dateRange.from).lte('week_start', dateRange.to),
        supabase.from('life_goals').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('habits').select('*').eq('user_id', session.user.id),
        supabase.from('habit_logs').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to),
        supabase.from('oura_daily_summary').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to),
        supabase.from('progress_photos').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to),
        supabase.from('location_history').select('*').eq('user_id', session.user.id).gte('created_at', dateRange.from).lte('created_at', dateRange.to + 'T23:59:59'),
        supabase.from('user_fundament').select('*').eq('user_id', session.user.id).maybeSingle()
      ]);

      const foodEntries = food || [];
      const journalEntries = journal || [];
      const telegramEntries = telegramLogs || [];
      const weeklyReviews = reviews || [];
      const toWarsawDate = (value) => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
      const toWarsawTime = (value) => new Date(value).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });

      const userPOI = [
        { name: 'Dom', lat: userSettings?.home_lat, lng: userSettings?.home_lng, radius: 150 },
        { name: 'Rzeszów', lat: 50.0413, lng: 21.9990, radius: 5000 }
      ].filter(p => p.lat && p.lng);

      function getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }

      let md = `# ROZDZIAŁ 0: FUNDAMENT TOŻSAMOŚCI I WIZJA\n\n`;
      if (fundament) {
        md += `## 1. TOŻSAMOŚĆ\n${fundament.identity || 'Brak wpisów.'}\n\n`;
        md += `## 2. WARTOŚCI I FILOZOFIA\n${fundament.philosophy || 'Brak wpisów.'}\n\n`;
        md += `## 3. WIZJA\n${fundament.vision || 'Brak wpisów.'}\n\n`;
        md += `## 4. PRACA I FINANSE\n${fundament.finances || 'Brak wpisów.'}\n\n`;
        md += `## 5. WIEDZA\n${fundament.knowledge || 'Brak wpisów.'}\n\n`;
        md += `## 6. RELACJE\n${fundament.relationships || 'Brak wpisów.'}\n\n`;
      }
      md += `---\n\n`;
      md += `# RAPORT TRENINGOWY I LIFESTYLE\n`;
      md += `Okres: ${dateRange.from} do ${dateRange.to}\n\n`;

      if (goals) {
        md += `## 🎯 TWOJE CELE (KONTEKST)\n`;
        md += `- **Ciało:** ${goals.goal_cialo}\n`;
        md += `- **Duch:** ${goals.goal_duch}\n`;
        md += `- **Konto:** ${goals.goal_konto}\n\n`;
      }

      const dates = [...new Set([
        ...sessions.map(s => s.date),
        ...foodEntries.map(f => f.date),
        ...journalEntries.map(j => j.date),
        ...telegramEntries.map(t => toWarsawDate(t.created_at)),
        ...bodyMetrics.map(b => b.date)
      ])].sort();

      // Generate full date range to detect missing days
      const allDatesInRange = [];
      let current = parseISO(dateRange.from);
      const end = parseISO(dateRange.to);
      while (current <= end) {
        allDatesInRange.push(format(current, 'yyyy-MM-dd'));
        current = new Date(current.getTime() + 86400000);
      }

      allDatesInRange.forEach(dateStr => {
        const daySessions = sessions.filter(s => s.date === dateStr);
        const dayFood = foodEntries.filter(f => f.date === dateStr);
        const dayJournal = journalEntries.find(j => j.date === dateStr);
        const dayTelegramLogs = telegramEntries.filter(t => toWarsawDate(t.created_at) === dateStr);
        const dayBody = bodyMetrics.find(b => b.date === dateStr);
        const dayOura = ouraData?.find(o => o.date === dateStr);
        const dayPhotos = photos?.filter(p => p.date === dateStr);

        // Header and Lose Day Logic
        const hasAnyData = daySessions.length > 0 || (includeYazio && dayFood.length > 0) || (includeJournal && (dayJournal || dayTelegramLogs.length > 0)) || dayBody || (includeOura && dayOura) || (includePhotos && dayPhotos?.length > 0);

        if (!hasAnyData) {
          md += `## ${format(parseISO(dateStr), 'd MMMM yyyy (EEEE)', { locale: pl })}\n`;
          md += `### ❌ DZIEŃ PRZEGRANY (Brak Celu)\n`;
          md += `*„Jeśli nie wypełniłem nawet nie dodałem pięciu zadań jakie są do zrobienia... to i tak wziąć się zalicza jako przegrany bo po prostu no nie zrobiłem niczego w kierunku swoich własnych marzeń więc tak naprawdę żyłem dzisiaj bez celu.”*\n\n`;
          md += `---\n\n`;
          return;
        }

        md += `## ${format(parseISO(dateStr), 'd MMMM yyyy (EEEE)', { locale: pl })}\n\n`;

        if (includeOura && dayOura) {
          md += `### 💍 Oura Ring\n`;
          md += `- **Readiness:** ${dayOura.readiness_score || '--'}\n`;
          md += `- **Sen:** ${dayOura.total_sleep_hours || '--'}h\n`;
          md += `- **Kroki:** ${dayOura.steps || '--'}\n`;
          md += `- **Dyscyplina:** ${dayOura.is_disciplined ? 'TAK' : 'NIE'}\n\n`;
        }

        if (includePhotos && dayPhotos && dayPhotos.length > 0) {
          md += `### 📸 Zdjęcia Postępu\n`;
          dayPhotos.forEach((p, idx) => {
            md += `![Zdjęcie ${idx + 1}](${p.image_url})\n`;
          });
          md += `\n`;
        }


        if (dayBody) {
          md += `### ⚖️ Pomiary Ciała\n`;
          if (dayBody.weight) md += `- **Waga:** ${dayBody.weight} kg\n`;
          if (dayBody.waist) md += `- **Talia:** ${dayBody.waist} cm\n`;
          
          const extraMetrics = {
            neck: 'Szyja', chest: 'Klatka', hips: 'Biodra', belly: 'Brzuch',
            biceps_l: 'Biceps (L)', biceps_r: 'Biceps (P)', forearm: 'Przedramię',
            thigh: 'Udo', calf: 'Łydka'
          };
          
          Object.entries(extraMetrics).forEach(([key, label]) => {
            if (dayBody[key]) md += `- **${label}:** ${dayBody[key]} cm\n`;
          });
          md += `\n`;
        }

        const dayLocations = locationHistory?.filter(l => l.created_at.startsWith(dateStr));
        const visitedPOIs = userPOI.filter(poi => 
          dayLocations?.some(loc => getDistance(loc.latitude, loc.longitude, poi.lat, poi.lng) < poi.radius)
        );
        
        // Wykryte inteligentnie przez API Google Maps
        const detectedPlaces = [...new Set(dayLocations?.filter(l => l.place_name).map(l => l.place_name))];

        if (includeLocation && (visitedPOIs.length > 0 || detectedPlaces.length > 0)) {
          md += `### 📍 Potwierdzone Lokalizacje\n`;
          visitedPOIs.forEach(poi => {
            md += `- ✅ Obecność w: **${poi.name}**\n`;
          });
          detectedPlaces.forEach(place => {
            // Unikaj dublowania jeśli nazwa POI i PlaceName są podobne
            if (!visitedPOIs.some(p => p.name === place)) {
              md += `- 🤖 Wykryto: **${place}**\n`;
            }
          });
          md += `\n`;
        }

        daySessions.forEach(s => {
          md += `### 🏋️ Trening: Dzień ${s.workout_day}\n`;
          s.exercise_logs.forEach(l => { 
            md += `- **${l.exercise_name}**: ${l.weight}kg x ${l.reps} (MSP: ${l.rpe ?? '--'}) ${l.is_pws_or_msp ? '🔥' : ''}\n`; 
          });
          md += `\n`;
        });

        if (includeYazio) {
          const dayFood = foodEntries.filter(f => f.date === dateStr);
          if (dayFood.length > 0) {
            md += `### 🥗 Dieta (Yazio)\n`;
            const meals = { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja', snack: 'Przekąski' };
            
            Object.entries(meals).forEach(([key, label]) => {
              const mealItems = dayFood.filter(f => f.meal_type === key);
              if (mealItems.length > 0) {
                md += `#### ${label}\n`;
                mealItems.forEach(item => {
                  md += `- ${item.name} (${item.amount || ''}): ${item.calories} kcal | B: ${item.protein}g | W: ${item.carbs || 0}g | T: ${item.fat || 0}g\n`;
                });
              }
            });
            
            const totalCal = dayFood.reduce((sum, f) => sum + (f.calories || 0), 0);
            const totalProt = dayFood.reduce((sum, f) => sum + (Number(f.protein) || 0), 0);
            const totalCarb = dayFood.reduce((sum, f) => sum + (Number(f.carbs) || 0), 0);
            const totalFat = dayFood.reduce((sum, f) => sum + (Number(f.fat) || 0), 0);
            md += `\n**Suma dnia: ${totalCal} kcal | B: ${totalProt.toFixed(1)}g | W: ${totalCarb.toFixed(1)}g | T: ${totalFat.toFixed(1)}g**\n`;
          }
        }
        if (includeJournal && dayTelegramLogs.length > 0) {
          md += `### Notatnik (Telegram)\n`;
          md += `#### Logi z Telegrama\n`;
          dayTelegramLogs.forEach(log => {
            const mode = log.metadata?.mode ? ` [${log.metadata.mode}]` : '';
            const content = (log.content || '').trim().replace(/\n/g, '\n  ');
            if (content) {
              md += `- **${toWarsawTime(log.created_at)}**${mode}: ${content}\n`;
            }
          });
          md += `\n`;
        }

        if (includeJournal && dayJournal) {
          md += `### 📓 Notatnik & Power Lista\n`;
          md += `**Wynik Dnia:** ${dayJournal.result === 'Z' ? 'WYGRANA (Z)' : 'PORAŻKA (P)'}\n\n`;
          
          md += `#### Zadania:\n`;
          for (let i = 1; i <= 5; i++) {
            const task = dayJournal[`task_${i}`];
            const cat = dayJournal[`category_${i}`];
            const done = dayJournal[`done_${i}`];
            if (task) {
              md += `- [${done ? 'x' : ' '}] (${cat}) ${task}\n`;
            }
          }
          md += `\n`;

          if (dayJournal.mood_score) {
            const moods = ['Źle', 'Słabo', 'Ok', 'Dobrze', 'Świetnie'];
            md += `**Nastrój:** ${moods[dayJournal.mood_score - 1] || 'Nieokreślony'}\n`;
          }
          if (dayJournal.gratitude_entry) {
            md += `**Wdzięczność:** ${dayJournal.gratitude_entry}\n`;
          }
          if (dayJournal.journal_entry) {
            md += `**Refleksja:** ${dayJournal.journal_entry}\n`;
          }
          md += `\n`;
        }

        // Daily Habits
        const dayHabitLogs = habitLogs?.filter(l => l.date === dateStr);
        if (includeHabits && dayHabitLogs?.length > 0) {
          md += `### ✅ Nawyki Dnia\n`;
          dayHabitLogs.forEach(log => {
            const habit = habits?.find(h => h.id === log.habit_id);
            if (habit) {
              md += `- ${habit.icon} ${habit.name}: ${habit.is_positive ? 'Wykonano' : 'Uniknięto'}\n`;
            }
          });
          md += `\n`;
        }

        md += `---\n\n`;
      });

      if (weeklyReviews.length > 0) {
        md += `# 📑 PRZEGLĄDY TYGODNIA\n\n`;
        weeklyReviews.forEach(r => {
          md += `## Tydzień od ${r.week_start}\n`;
          md += `**Duma:** ${r.proud_of}\n`;
          md += `**Sabotaż:** ${r.sabotage}\n`;
          md += `**Inaczej:** ${r.do_differently}\n\n`;
        });
      }

      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `raport_kuba_${dateRange.from}.md`; a.click();
    } finally { setIsExporting(false); }
  }
  
  if (loading) return <div className="p-8 text-center text-neutral-500 uppercase font-black animate-pulse tracking-widest">Wczytywanie...</div>;

  const isSunday = new Date().getDay() === 0;

  return (
    <div className="flex-1 p-6 space-y-12 pb-24">
      {/* Raport Psychologiczny - Tylko w Niedzielę */}
      {narrative && isSunday && (
        <section className="animate-in fade-in zoom-in duration-1000">
          <div className="bg-neutral-900 border-l-4 border-primary p-6 rounded-r-2xl shadow-xl">
            <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Zap size={12} className="text-primary" /> Analiza Behawioralna
            </h3>
            <p className="text-lg font-black text-white leading-tight uppercase italic tracking-tighter">
              „{narrative}”
            </p>
          </div>
        </section>
      )}

      <section className="space-y-6">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter">Parametry</h2>
          </div>
          <Activity className="text-primary/20" size={32} />
        </header>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest flex items-center">
                Waga (kg) <TrendArrow current={trends.weight?.cur} previous={trends.weight?.prev} better="down" />
              </label>
              <input type="number" step="0.1" value={newMetric.weight} onChange={e => setNewMetric({...newMetric, weight: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-lg font-black text-white outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-neutral-500 uppercase tracking-widest flex items-center">
                Talia (cm) <TrendArrow current={trends.waist?.cur} previous={trends.waist?.prev} better="down" />
              </label>
              <input type="number" step="0.1" value={newMetric.waist} onChange={e => setNewMetric({...newMetric, waist: e.target.value})} className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-lg font-black text-white outline-none focus:border-primary" />
            </div>
          </div>
          <button onClick={saveMetrics} className="w-full bg-primary text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest">Zapisz Pomiary</button>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter">Body Trends</h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 h-64 overflow-hidden">
          {bodyData?.length > 0 ? (
            <ResponsiveContainer width="100%" height={224}>
              <LineChart data={bodyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" hide />
                <YAxis yAxisId="left" domain={['dataMin - 1', 'dataMax + 1']} stroke="#ffffff" fontSize={8} />
                <YAxis yAxisId="right" orientation="right" domain={['dataMin - 1', 'dataMax + 1']} stroke="#3b82f6" fontSize={8} />
                <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }} />
                <Line yAxisId="left" type="monotone" dataKey="weight" name="Waga (kg)" stroke="#ffffff" strokeWidth={3} dot={{ fill: '#ffffff', r: 2 }} connectNulls={true} />
                <Line yAxisId="right" type="monotone" dataKey="waist" name="Talia (cm)" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 2 }} connectNulls={true} />
                <Line yAxisId="right" type="monotone" dataKey="body_fat" name="Tłuszcz (%)" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={false} connectNulls={true} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-neutral-700 uppercase">Brak danych trendu</div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter flex items-center gap-4">
          Oura Readiness <TrendArrow current={trends.readiness?.cur} previous={trends.readiness?.prev} />
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 h-64 overflow-hidden">
          {ouraTrend?.length > 0 ? (
            <ResponsiveContainer width="100%" height={224}>
              <LineChart data={ouraTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" stroke="#525252" fontSize={8} />
                <YAxis domain={[50, 100]} stroke="#525252" fontSize={8} />
                <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '12px' }} />
                <Line type="monotone" dataKey="readiness" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3, fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-neutral-700 uppercase">Brak danych Oura</div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter flex items-center gap-4">
          Protein Intake <TrendArrow current={trends.protein?.cur} previous={trends.protein?.prev} />
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 h-64 overflow-hidden">
          {nutritionData?.length > 0 ? (
            <ResponsiveContainer width="100%" height={224}>
              <LineChart data={nutritionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" stroke="#525252" fontSize={8} />
                <YAxis domain={[0, 200]} stroke="#525252" fontSize={8} />
                <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '12px' }} />
                <ReferenceLine y={150} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'GOAL', position: 'right', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }} />
                <Line type="monotone" dataKey="protein" name="Białko (g)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 3, fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-neutral-700 uppercase">Brak danych żywieniowych</div>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-black uppercase italic text-white tracking-tighter">Historia</h2>
        <div className="overflow-hidden rounded-2xl border border-neutral-900 bg-neutral-900/30">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-900 text-[8px] font-black text-neutral-500 uppercase tracking-widest">
                <th className="p-4">Data</th>
                <th className="p-4 text-center">Dzień</th>
                <th className="p-4 text-right">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900 text-[10px] font-bold text-white">
              {recentSessions.slice(0, 40).map(s => (
                <tr key={s.id} className="hover:bg-neutral-900/50 transition-colors">
                  <td className="p-4">
                    {editingSession === s.id ? (
                      <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="bg-neutral-950 border border-neutral-800 rounded p-1 text-[10px] text-white" />
                    ) : (
                      format(parseISO(s.date), 'dd.MM')
                    )}
                  </td>
                  <td className="p-4 text-center text-neutral-400">
                    {editingSession === s.id ? (
                      <div className="space-y-2 text-left">
                        {editForm.logs.map((log, idx) => (
                          <div key={log.id} className="flex items-center gap-2 bg-neutral-950 p-2 rounded border border-neutral-800">
                            <span className="text-[8px] w-12 truncate">{log.exercise_name}</span>
                            <input type="number" step="0.5" value={log.weight} onChange={e => {
                              const newLogs = [...editForm.logs];
                              newLogs[idx].weight = e.target.value;
                              setEditForm({...editForm, logs: newLogs});
                            }} className="w-12 bg-neutral-900 border border-neutral-800 rounded p-1 text-[10px]" />
                            <span className="text-[8px]">kg x</span>
                            <input type="number" value={log.reps} onChange={e => {
                              const newLogs = [...editForm.logs];
                              newLogs[idx].reps = e.target.value;
                              setEditForm({...editForm, logs: newLogs});
                            }} className="w-10 bg-neutral-900 border border-neutral-800 rounded p-1 text-[10px]" />
                            <button onClick={() => deleteLog(log.id)} className="text-red-900 hover:text-red-500 ml-auto"><Trash2 size={10} /></button>
                          </div>
                        ))}
                        <button onClick={updateSession} className="w-full bg-primary text-white py-2 rounded text-[8px] font-black uppercase">Zapisz Zmiany</button>
                        <button onClick={() => setEditingSession(null)} className="w-full text-neutral-500 py-1 text-[8px] font-black uppercase">Anuluj</button>
                      </div>
                    ) : (
                      s.workout_day
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {editingSession !== s.id && (
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEditing(s)} className="text-neutral-700 hover:text-primary p-2"><Zap size={12} /></button>
                        <button onClick={() => deleteSession(s.id)} className="text-neutral-700 hover:text-red-500 p-2"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="relative group">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-hover:text-primary transition-colors" size={14} />
            <input 
              type="date" 
              value={dateRange.from} 
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
              onChange={e => setDateRange({...dateRange, from: e.target.value})} 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 pl-10 text-[10px] font-bold text-white outline-none focus:border-primary transition-all cursor-pointer appearance-none" 
            />
          </div>
          <div className="relative group">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-hover:text-primary transition-colors" size={14} />
            <input 
              type="date" 
              value={dateRange.to} 
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
              onChange={e => setDateRange({...dateRange, to: e.target.value})} 
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 pl-10 text-[10px] font-bold text-white outline-none focus:border-primary transition-all cursor-pointer appearance-none" 
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button onClick={() => setIncludeYazio(!includeYazio)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeYazio ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeYazio && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Dieta (Yazio)</span>
          </button>

          <button onClick={() => setIncludeJournal(!includeJournal)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeJournal ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeJournal && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Notatnik (Telegram)</span>
          </button>

          <button onClick={() => setIncludeOura(!includeOura)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeOura ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeOura && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Oura Ring</span>
          </button>

          <button onClick={() => setIncludeHabits(!includeHabits)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeHabits ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeHabits && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Nawyki</span>
          </button>

          <button onClick={() => setIncludePhotos(!includePhotos)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includePhotos ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includePhotos && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Zdjęcia</span>
          </button>

          <button onClick={() => setIncludeLocation(!includeLocation)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeLocation ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeLocation && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Lokalizacja</span>
          </button>
        </div>

        <div className="flex justify-between items-center pt-2">
          <button onClick={syncHistory} disabled={isSyncing} className="text-[8px] font-black uppercase text-neutral-600 hover:text-primary transition-colors">
            {isSyncing ? 'Syncing...' : 'Wymuś Sync Yazio (30 dni)'}
          </button>
          <button onClick={exportData} disabled={isExporting} className="bg-primary text-white px-6 py-4 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-transform shadow-xl shadow-primary/20 flex-1 ml-4">
            {isExporting ? 'Generowanie...' : 'Pobierz Raport (.md)'}
          </button>
        </div>

        <div className="pt-6 border-t border-primary/10 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${googleFitConnected ? 'bg-dayC animate-pulse' : 'bg-neutral-800'}`} />
              <span className="text-[10px] font-black uppercase text-white">Google Fit (Waga)</span>
            </div>
            {googleFitConnected ? (
              <button onClick={syncGoogleFit} disabled={isSyncingFit} className="text-[8px] font-black uppercase text-primary hover:underline">
                {isSyncingFit ? 'Syncing...' : 'Sync Teraz'}
              </button>
            ) : (
              <button onClick={connectGoogleFit} className="bg-white text-black px-4 py-2 rounded-lg text-[8px] font-black uppercase hover:bg-primary hover:text-white transition-all">
                Połącz Google Fit
              </button>
            )}
          </div>
          {!googleFitConnected && (
            <p className="text-[7px] text-neutral-600 uppercase font-bold leading-tight">
              Automatyczny import wagi z Twojej inteligentnej wagi przez Google Fit.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
