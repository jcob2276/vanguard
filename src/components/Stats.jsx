import { useCallback, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Trash2, Scale, Ruler, Activity, Zap, CheckSquare } from 'lucide-react';
import { format, parseISO, subDays } from 'date-fns';
import { pl } from 'date-fns/locale';

import { useStore } from '../store/useStore';
import { calculateProjection, generateNarrative } from './stats/statsCalculations.js';
import { TrendArrow } from './stats/TrendArrow.jsx';

export default function Stats({ session, topSlot = null, runningSlot = null }) {
  const { userSettings } = useStore();
  const [loading, setLoading] = useState(true);
  const [bodyData, setBodyData] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [newMetric, setNewMetric] = useState({ weight: '', waist: '' });
  const [nutritionData, setNutritionData] = useState([]);
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingOura, setIsExportingOura] = useState(false);
  const [includeYazio, setIncludeYazio] = useState(true);
  const [includeJournal, setIncludeJournal] = useState(true);
  const [includeOura, setIncludeOura] = useState(true);
  const [includeHabits, setIncludeHabits] = useState(true);
  const [includeWorkouts, setIncludeWorkouts] = useState(true);
  const [includeBody, setIncludeBody] = useState(true);
  const [includeActivityWatch, setIncludeActivityWatch] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeDate, setAnalyzeDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' }));
  const [analyzePeriod, setAnalyzePeriod] = useState(1);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [editingSession, setEditingSession] = useState(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [editForm, setEditForm] = useState({ date: '', logs: [] });
  const [trends, setTrends] = useState({});
  const [projections, setProjections] = useState(null);
  const [narrative, setNarrative] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: body },
        { data: sessions },
        { data: oura },
        { data: nutrition }
      ] = await Promise.all([
        supabase.from('body_metrics').select('*').eq('user_id', session.user.id).order('date', { ascending: true }),
        supabase.from('workout_sessions').select('*, exercise_logs(*)').eq('user_id', session.user.id).order('date', { ascending: false }),
        supabase.from('oura_daily_summary').select('*').eq('user_id', session.user.id).order('date', { ascending: false }).limit(60),
        supabase.from('daily_nutrition').select('*').eq('user_id', session.user.id).order('date', { ascending: false }).limit(60)
      ]);

      if (body) setBodyData(body);
      
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
  }, [session.user.id]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function saveMetrics(e) {
    e.preventDefault();
    const today = new Intl.DateTimeFormat('sv', { timeZone: 'Europe/Warsaw' }).format(new Date());
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
    } catch (_err) {
      alert('Błąd połączenia z funkcją');
    } finally {
      setIsSyncing(false);
    }
  }

  async function analyzeFood() {
    setIsAnalyzing(true);
    setAnalyzeResult(null);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const body = analyzePeriod === 1
        ? { userId: session.user.id, date: analyzeDate }
        : (() => {
            const to = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
            const from = new Date(Date.now() - (analyzePeriod - 1) * 864e5).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
            return { userId: session.user.id, dateFrom: from, dateTo: to };
          })();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-food-quality`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession.access_token}`
        },
        body: JSON.stringify(body)
      });
      const res = await response.json();
      if (res.success) {
        setAnalyzeResult(res);
      } else {
        alert('Błąd analizy: ' + (res.error || 'Nieznany błąd'));
      }
    } catch (err) {
      alert('Błąd połączenia: ' + err.message);
    } finally {
      setIsAnalyzing(false);
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
    } catch (_err) {
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
        { data: food, error: foodError },
        { data: nutritionSummary },
        { data: journal },
        { data: telegramLogs },
        { data: reviews },
        { data: goals },
        { data: habits },
        { data: habitLogs },
        { data: ouraData },
        { data: ouraEnhanced },
        { data: ouraDerived },
        { data: photos },
        { data: locationHistory },
        { data: fundament },
        { data: stravaData },
        { data: stravaRawData },
        { data: awSummary },
        { data: phoneUsageData }
      ] = await Promise.all([
        includeWorkouts ? supabase.from('workout_sessions').select('*, exercise_logs(*)').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve({ data: [] }),
        includeBody ? supabase.from('body_metrics').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve({ data: [] }),
        includeYazio ? supabase.from('daily_food_entries').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve({ data: [] }),
        includeYazio ? supabase.from('daily_nutrition').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve({ data: [] }),
        includeJournal ? supabase.from('daily_wins').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve({ data: [] }),
        includeJournal ? supabase.from('vanguard_stream').select('id, content, source, created_at, metadata').eq('user_id', session.user.id).eq('source', 'telegram').gte('created_at', exportStartIso).lte('created_at', exportEndIso).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
        supabase.from('weekly_reviews').select('*').eq('user_id', session.user.id).gte('week_start', dateRange.from).lte('week_start', dateRange.to),
        supabase.from('life_goals').select('*').eq('user_id', session.user.id).maybeSingle(),
        includeHabits ? supabase.from('habits').select('*').eq('user_id', session.user.id) : Promise.resolve({ data: [] }),
        includeHabits ? supabase.from('habit_logs').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to) : Promise.resolve({ data: [] }),
        includeOura ? supabase.from('oura_daily_summary').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to) : Promise.resolve({ data: [] }),
        includeOura ? supabase.from('oura_enhanced').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to) : Promise.resolve({ data: [] }),
        includeOura ? supabase.from('oura_derived_daily').select('*').eq('user_id', session.user.id).gte('day', dateRange.from).lte('day', dateRange.to) : Promise.resolve({ data: [] }),
        supabase.from('progress_photos').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to),
        supabase.from('location_history').select('*').eq('user_id', session.user.id).gte('created_at', dateRange.from).lte('created_at', dateRange.to + 'T23:59:59'),
        supabase.from('user_fundament').select('*').eq('user_id', session.user.id).maybeSingle(),
        includeWorkouts ? supabase.from('strava_activities_clean').select('strava_id,name,sport_type,start_date,elapsed_time,moving_time,distance,total_elevation_gain,pace_sec_per_km,cadence_spm,hr_avg,hr_max,hr_source,hr_frozen,splits_with_hr,gear_name,gear_distance_km,has_pr,pause_seconds,is_oura,perceived_exertion,workout_type,best_efforts').eq('user_id', session.user.id).eq('is_oura', false).gte('start_date', exportStartIso).lte('start_date', exportEndIso).order('start_date', { ascending: true }) : Promise.resolve({ data: [] }),
        includeWorkouts ? supabase.from('strava_activities').select('strava_id,raw_data').eq('user_id', session.user.id).gte('start_date', exportStartIso).lte('start_date', exportEndIso) : Promise.resolve({ data: [] }),
        includeActivityWatch ? supabase.from('aw_daily_summary').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true }) : Promise.resolve({ data: [] }),
        supabase.from('phone_usage_daily').select('*').eq('user_id', session.user.id).gte('date', dateRange.from).lte('date', dateRange.to).order('date', { ascending: true })
      ]);

      const foodEntries = food || [];
      const nutritionEntries = nutritionSummary || [];
      const journalEntries = journal || [];
      const telegramEntries = telegramLogs || [];
      const weeklyReviews = reviews || [];
      const stravaCommentById = new Map((stravaRawData || []).map(a => [
        a.strava_id,
        (a.raw_data?.description || a.raw_data?.athlete_comment || '').trim()
      ]).filter(([, comment]) => comment));
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

      // Averages helper for the new weekly dashboard
      const getAvg = (arr, key, decimalPlaces = null) => {
        const valid = (arr || []).filter(x => x[key] != null && Number(x[key]) > 0);
        if (valid.length === 0) return '--';
        const sum = valid.reduce((acc, x) => acc + Number(x[key]), 0);
        const avg = sum / valid.length;
        return decimalPlaces !== null ? avg.toFixed(decimalPlaces) : Math.round(avg);
      };

      const avgWeight = getAvg(bodyMetrics, 'weight', 2);
      const avgWaist = getAvg(bodyMetrics, 'waist', 1);
      const avgCalories = getAvg(nutritionEntries, 'calories');
      const avgProtein = getAvg(nutritionEntries, 'protein');
      const avgSteps = getAvg(ouraData, 'steps');
      const avgSleep = getAvg(ouraData, 'total_sleep_hours', 2);
      const avgReadiness = getAvg(ouraData, 'readiness_score');

      md += `## 📊 PODSUMOWANIE TYGODNIA (DASHBOARD)\n\n`;
      md += `| Metryka | Średnia Wartość |\n`;
      md += `| :--- | :--- |\n`;
      md += `| **Średnia waga** | ${avgWeight} kg |\n`;
      md += `| **Średnia talia** | ${avgWaist} cm |\n`;
      md += `| **Średnie kcal** | ${avgCalories} kcal |\n`;
      md += `| **Średnie białko** | ${avgProtein} g |\n`;
      md += `| **Treningi (siłowe)** | ${sessions.length} |\n`;
      md += `| **Średnie kroki** | ${avgSteps} |\n`;
      md += `| **Średni sen** | ${avgSleep} h |\n`;
      md += `| **Średni Readiness** | ${avgReadiness} |\n\n`;

      if (goals) {
        md += `## 🎯 TWOJE CELE (KONTEKST)\n`;
        md += `- **Ciało:** ${goals.goal_cialo}\n`;
        md += `- **Duch:** ${goals.goal_duch}\n`;
        md += `- **Konto:** ${goals.goal_konto}\n\n`;
      }

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
        const dayNutrition = nutritionEntries.find(n => n.date === dateStr);
        const dayJournal = journalEntries.find(j => j.date === dateStr);
        const dayTelegramLogs = telegramEntries.filter(t => toWarsawDate(t.created_at) === dateStr);
        const dayBody = bodyMetrics.find(b => b.date === dateStr);
        const dayOura = ouraData?.find(o => o.date === dateStr);
        const dayOuraEnhanced = (ouraEnhanced || []).find(o => o.date === dateStr);
        const dayOuraDerived = (ouraDerived || []).find(o => o.day === dateStr);
        const dayPhotos = photos?.filter(p => p.date === dateStr);
        const dayStrava = (stravaData || []).filter(a => {
          const d = new Date(a.start_date).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
          return d === dateStr;
        });
        const dayAw = includeActivityWatch ? (awSummary || []).find(a => a.date === dateStr) : null;

        // Header and Lose Day Logic
        const hasAnyData = (includeWorkouts && (daySessions.length > 0 || dayStrava.length > 0)) || 
                           (includeYazio && (dayFood.length > 0 || dayNutrition)) || 
                           (includeJournal && (dayJournal || dayTelegramLogs.length > 0)) || 
                           (includeBody && dayBody) || 
                           (includeOura && dayOura) || 
                           dayPhotos?.length > 0 ||
                           !!dayAw;

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
          md += `- **Readiness:** ${dayOura.readiness_score || '--'} | **Sleep Score:** ${dayOuraEnhanced?.sleep_score || '--'} | **Activity Score:** ${dayOuraEnhanced?.activity_score || '--'}\n`;

          if (dayOuraEnhanced?.bedtime_start || dayOuraEnhanced?.bedtime_end) {
            const fmtWaw = (iso) => {
              if (!iso) return '--';
              return new Date(iso).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });
            };
            const bedStart = dayOuraEnhanced.bedtime_start;
            const latMin = dayOuraEnhanced.sleep_latency_minutes || 0;
            const onsetIso = bedStart ? new Date(new Date(bedStart).getTime() + latMin * 60000).toISOString() : null;
            const wokeUpStr = dayOuraEnhanced.wake_up_timestamp ? ` → 🔔 Obudził się: ${fmtWaw(dayOuraEnhanced.wake_up_timestamp)}` : '';
            md += `- **Harmonogram snu:** 🛏️ Łóżko: ${fmtWaw(bedStart)} → 😴 Sen od: ${fmtWaw(onsetIso)}${wokeUpStr} → 🚶 Wstał: ${fmtWaw(dayOuraEnhanced.bedtime_end)}\n`;
          }

          md += `- **Sen:** ${dayOura.total_sleep_hours || '--'}h`;
          if (dayOuraEnhanced) {
            const deepH = dayOuraEnhanced.deep_sleep_hours ? `${dayOuraEnhanced.deep_sleep_hours.toFixed(1)}h` : '--';
            const remH = dayOuraEnhanced.rem_sleep_hours ? `${dayOuraEnhanced.rem_sleep_hours.toFixed(1)}h` : '--';
            const lightH = dayOuraEnhanced.light_sleep_hours ? `${dayOuraEnhanced.light_sleep_hours.toFixed(1)}h` : '--';
            const latencyMin = dayOuraEnhanced.sleep_latency_minutes ? `${dayOuraEnhanced.sleep_latency_minutes}m` : '--';
            const efficiency = dayOuraEnhanced.sleep_efficiency ? `${dayOuraEnhanced.sleep_efficiency}%` : '--';
            md += ` (Głęboki: ${deepH}, REM: ${remH}, Lekki: ${lightH}, Latencja: ${latencyMin}, Wydajność: ${efficiency})`;
          }
          md += `\n`;
          md += `- **Kroki:** ${dayOura.steps || '--'}`;
          if (dayOuraEnhanced?.active_calories) {
            md += ` | **Aktywne kalorie:** ${dayOuraEnhanced.active_calories} kcal (Suma: ${dayOuraEnhanced.total_calories || '--'} kcal)`;
          }
          md += `\n`;
          
          if (dayOuraEnhanced || dayOuraDerived) {
            const hrMin = dayOuraDerived?.sleep_hr_min || dayOuraEnhanced?.sleep_lowest_heart_rate || '--';
            const hrAvg = dayOuraDerived?.sleep_hr_avg || dayOuraEnhanced?.sleep_average_heart_rate || '--';
            const hrvAvg = dayOuraDerived?.sleep_hrv_avg || dayOuraEnhanced?.sleep_average_hrv || '--';
            const hrvPeak = dayOuraDerived?.sleep_hrv_peak || '--';
            md += `- **Tętno i HRV (Sen):** Min: ${hrMin} bpm | Średnie: ${hrAvg} bpm || Średnie HRV: ${hrvAvg} ms`;
            if (hrvPeak !== '--') md += ` | Szczytowe HRV: ${hrvPeak} ms`;
            md += `\n`;
          }
          
          if (dayOuraEnhanced) {
            const stressMin = dayOuraEnhanced.stress_high_minutes || 0;
            const recovMin = dayOuraEnhanced.recovery_high_minutes || 0;
            const resilience = dayOuraEnhanced.resilience_level || '--';
            md += `- **Stres i Regeneracja:** Stres (wysoki): ${stressMin} min | Regeneracja: ${recovMin} min | Odporność (Resilience): ${resilience}\n`;
            
            const tempDev = dayOuraEnhanced.temperature_deviation != null ? `${dayOuraEnhanced.temperature_deviation > 0 ? '+' : ''}${dayOuraEnhanced.temperature_deviation.toFixed(2)}°C` : '--';
            const vo2 = dayOuraEnhanced.vo2_max || '--';
            const breathDisturb = dayOuraEnhanced.breathing_disturbance_index || '--';
            md += `- **Biomarkery:** Temp: ${tempDev} | VO2 Max: ${vo2} | Zaburzenia oddychania: ${breathDisturb}\n`;
          }
          
          md += `- **Dyscyplina:** ${dayOura.is_disciplined ? 'TAK' : 'NIE'}\n\n`;
        }

        const dayPhone = (phoneUsageData || []).find(p => p.date === dateStr);
        if (dayPhone) {
          const parts = [
            dayPhone.entertainment_minutes > 0 ? `🎬 ${dayPhone.entertainment_minutes}m` : null,
            dayPhone.social_minutes > 0        ? `📲 soc: ${dayPhone.social_minutes}m` : null,
            dayPhone.messaging_minutes > 0     ? `💬 msg: ${dayPhone.messaging_minutes}m` : null,
            dayPhone.ai_minutes > 0            ? `🤖 AI: ${dayPhone.ai_minutes}m` : null,
            dayPhone.unlocks > 0               ? `🔓 ${dayPhone.unlocks}x` : null,
          ].filter(Boolean).join(' | ');
          const lnAlert = dayPhone.late_night_minutes > 60 ? ` 🌙 PO 23:00: **${dayPhone.late_night_minutes}m** ⚠️` : dayPhone.late_night_minutes > 0 ? ` 🌙 ${dayPhone.late_night_minutes}m` : '';
          md += `### 📱 Telefon (AW)\n`;
          md += `- **Łącznie:** ${dayPhone.total_minutes}min | ${parts}${lnAlert}\n`;
          if (dayPhone.top_apps?.length) {
            const top3 = dayPhone.top_apps.slice(0, 3).map(a => `${a.app} (${a.min}m)`).join(', ');
            md += `- **Top:** ${top3}\n`;
          }
          md += `\n`;
        }

        if (dayAw) {
          const fmtSeconds = (totalSecs) => {
            if (!totalSecs) return '0m';
            const h = Math.floor(totalSecs / 3600);
            const m = Math.floor((totalSecs % 3600) / 60);
            if (h > 0) return `${h}h ${m}m`;
            return `${m}m`;
          };

          const makeProgressBar = (ratio) => {
            const size = 10;
            const dots = Math.round(ratio * size);
            const emptyDots = size - dots;
            return '`[' + '█'.repeat(dots) + '░'.repeat(emptyDots) + ']`';
          };

          md += `### 💻 Aktywność na komputerze (ActivityWatch)\n`;
          md += `- **Czas aktywności (PC):** ${fmtSeconds(dayAw.total_active_seconds)} (AFK: ${fmtSeconds(dayAw.total_afk_seconds)})\n`;
          if (dayAw.phone_active_seconds) {
            md += `- **Czas aktywności (telefon):** ${fmtSeconds(dayAw.phone_active_seconds)}\n`;
          }
          if (dayAw.productivity_ratio != null) {
            const pct = Math.round(dayAw.productivity_ratio * 100);
            md += `- **Ratio produktywności:** ${makeProgressBar(dayAw.productivity_ratio)} **${pct}%**\n`;
          }
          
          if (dayAw.top_apps && dayAw.top_apps.length > 0) {
            md += `- **Top aplikacje:**\n`;
            dayAw.top_apps.slice(0, 5).forEach((app, idx) => {
              const appSec = app.seconds || 0;
              const appPct = dayAw.total_active_seconds ? Math.round((appSec / dayAw.total_active_seconds) * 100) : 0;
              md += `  ${idx + 1}. \`${app.app}\` — ${fmtSeconds(appSec)} (${appPct}%)\n`;
            });
          }

          if (dayAw.web_domains && dayAw.web_domains.length > 0) {
            md += `- **Top domeny:**\n`;
            dayAw.web_domains.slice(0, 5).forEach((domain, idx) => {
              const domSec = domain.seconds || 0;
              const domPct = dayAw.total_active_seconds ? Math.round((domSec / dayAw.total_active_seconds) * 100) : 0;
              md += `  ${idx + 1}. \`${domain.domain}\` — ${fmtSeconds(domSec)} (${domPct}%)\n`;
            });
          }
          md += `\n`;
        }

        if (dayPhotos && dayPhotos.length > 0) {
          md += `### 📸 Zdjęcia Postępu\n`;
          dayPhotos.forEach((p, idx) => {
            md += `![Zdjęcie ${idx + 1}](${p.image_url})\n`;
          });
          md += `\n`;
        }

        if (includeBody && dayBody) {
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
        const detectedPlaces = [...new Set(dayLocations?.filter(l => l.place_name).map(l => l.place_name))];

        if (visitedPOIs.length > 0 || detectedPlaces.length > 0) {
          md += `### 📍 Potwierdzone Lokalizacje\n`;
          visitedPOIs.forEach(poi => {
            md += `- ✅ Obecność w: **${poi.name}**\n`;
          });
          detectedPlaces.forEach(place => {
            if (!visitedPOIs.some(p => p.name === place)) {
              md += `- 🤖 Wykryto: **${place}**\n`;
            }
          });
          md += `\n`;
        }

        if (includeWorkouts) daySessions.forEach(s => {
          md += `### 🏋️ Trening: Dzień ${s.workout_day}\n`;
          let totalSessionVolume = 0;
          
          // Render exercise logs in their raw chronological order to preserve separate sets of the same exercise
          let currentExerciseName = "";
          let currentExerciseVolume = 0;
          let currentSets = [];

          const renderCurrentExercise = () => {
            if (currentSets.length > 0) {
              md += `- **${currentExerciseName}** (Objętość: ${currentExerciseVolume.toLocaleString()} kg):\n`;
              currentSets.forEach((l, idx) => {
                const effort = l.rir ?? l.rpe ?? '--';
                md += `  - Seria ${idx + 1}: ${l.weight}kg x ${l.reps} (RIR/MSP: ${effort}) ${l.is_pws_or_msp ? '🔥' : ''}\n`;
              });
              currentSets = [];
              currentExerciseVolume = 0;
            }
          };

          const sortedLogs = [...(s.exercise_logs || [])].sort((a, b) => a.set_number - b.set_number);
          sortedLogs.forEach(l => {
            const setVol = (Number(l.weight) || 0) * (Number(l.reps) || 0);
            totalSessionVolume += setVol;

            if (l.exercise_name !== currentExerciseName) {
              renderCurrentExercise();
              currentExerciseName = l.exercise_name;
            }
            currentSets.push(l);
            currentExerciseVolume += setVol;
          });
          renderCurrentExercise();

          if (totalSessionVolume > 0) {
            md += `**Łączna objętość treningu:** **${totalSessionVolume.toLocaleString()} kg**\n`;
          }
          if (s.session_notes && s.session_notes.trim()) {
            md += `**Notatki z treningu:** ${s.session_notes.trim()}\n`;
          }
          md += `\n`;
        });

        if (includeWorkouts && dayStrava.length > 0) {
          const fmtPaceMd = (secPerKm) => {
            if (!secPerKm) return '—';
            const m = Math.floor(secPerKm / 60);
            const s = Math.round(secPerKm % 60);
            return `${m}:${String(s).padStart(2, '0')}/km`;
          };
          const fmtTimeMd = (sec) => {
            if (!sec) return '—';
            const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
            return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
          };
          md += `### 🏃 Bieganie (Strava)\n\n`;
          dayStrava.forEach(a => {
            const startTime = new Date(a.start_date).toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });
            const distKm = a.distance ? (a.distance / 1000).toFixed(2) : null;
            const paceStr = a.pace_sec_per_km
              ? fmtPaceMd(a.pace_sec_per_km)
              : (a.moving_time && a.distance ? fmtPaceMd(Math.round(a.moving_time / (a.distance / 1000))) : '—');
            const movingFmt = fmtTimeMd(a.moving_time);
            const hrAvg = a.hr_avg ? Math.round(a.hr_avg) : null;
            const hrMax = a.hr_max ? Math.round(a.hr_max) : null;
            const hrSrc = a.hr_source === 'oura' ? 'Oura Ring' : a.hr_source === 'strava' ? 'Strava/GPS' : null;
            const frozen = a.hr_frozen;
            const paused = (a.pause_seconds || 0) > 30;

            const workoutLabels = { 1: 'Wyścig 🏁', 2: 'Długi bieg 🏔️', 3: 'Trening / Interwały ⚡' };
            const workoutLabel = workoutLabels[a.workout_type] || null;

            md += `#### ${a.name}${a.has_pr ? ' 🏆 PR' : ''} — ${startTime}${workoutLabel ? ` · ${workoutLabel}` : ''}\n`;
            md += `| Dystans | Tempo | Czas ruchu | Kadencja |\n`;
            md += `|---------|-------|------------|----------|\n`;
            md += `| **${distKm ?? '—'} km** | **${paceStr}** | **${movingFmt}** | **${a.cadence_spm ? a.cadence_spm + ' spm' : '—'}** |\n\n`;

            if (hrAvg) {
              md += `**Tętno:** ${hrAvg}${hrMax ? `/${hrMax}` : ''} BPM`;
              if (hrSrc) md += ` _(źródło: ${hrSrc})_`;
              if (frozen) md += ` ⚠️ **sensor lock** — czujnik zamrożony, dane HR nierzetelne`;
              md += `\n`;
            }
            if (a.perceived_exertion) md += `**RPE:** ${a.perceived_exertion}/10\n`;

            // HRV context from Oura: pre-run (day of run) + post-run (day after)
            const runDate = new Date(a.start_date).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
            const nextDate = new Date(new Date(runDate).getTime() + 86400000).toISOString().split('T')[0];
            const ouraPreRun  = ouraData?.find(o => o.date === runDate);
            const ouraPostRun = ouraData?.find(o => o.date === nextDate);
            const enhancedPre = (ouraEnhanced || [])?.find(o => o.date === runDate);

            if (ouraPreRun?.hrv_avg || ouraPostRun?.hrv_avg || enhancedPre?.vo2_max || enhancedPre?.temperature_deviation != null) {
              md += `**Kontekst Biometryczny (Oura):**\n`;
              if (ouraPreRun?.hrv_avg || ouraPostRun?.hrv_avg) {
                md += `- **HRV:**`;
                if (ouraPreRun?.hrv_avg)  md += ` przed: **${Math.round(ouraPreRun.hrv_avg)} ms**${ouraPreRun.rhr_avg ? ` (RHR ${Math.round(ouraPreRun.rhr_avg)} bpm)` : ''}`;
                if (ouraPostRun?.hrv_avg) md += ` → po: **${Math.round(ouraPostRun.hrv_avg)} ms**${ouraPostRun.rhr_avg ? ` (RHR ${Math.round(ouraPostRun.rhr_avg)} bpm)` : ''}`;
                const hrvDelta = (ouraPreRun?.hrv_avg && ouraPostRun?.hrv_avg)
                  ? Math.round(ouraPostRun.hrv_avg - ouraPreRun.hrv_avg) : null;
                if (hrvDelta !== null) md += ` _(${hrvDelta >= 0 ? '+' : ''}${hrvDelta} ms regeneracja)_`;
                md += `\n`;
              }
              if (enhancedPre?.vo2_max) {
                md += `- **VO2 Max:** ${enhancedPre.vo2_max} ml/kg/min\n`;
              }
              if (enhancedPre?.temperature_deviation != null) {
                const tempDev = enhancedPre.temperature_deviation;
                md += `- **Odchylenie temperatury ciała:** ${tempDev > 0 ? '+' : ''}${tempDev.toFixed(2)}°C\n`;
              }
            }

            if (a.total_elevation_gain) md += `**Przewyższenie:** +${Math.round(a.total_elevation_gain)} m\n`;
            if (a.gear_name)            md += `**Buty:** ${a.gear_name}${a.gear_distance_km ? ` (${Math.round(a.gear_distance_km)} km przebiegu)` : ''}\n`;
            if (paused)                 md += `**Przerwy:** ${fmtTimeMd(a.pause_seconds)}\n`;
            const athleteComment = stravaCommentById.get(a.strava_id);
            if (athleteComment)          md += `**Komentarz zawodnika:** ${athleteComment}\n`;

            // Splits table
            const splits = a.splits_with_hr;
            if (splits && splits.length > 0) {
              const hasGapMd = splits.some(s => s.average_grade_adjusted_speed != null);
              md += `\n**Splity:**\n`;
              md += hasGapMd
                ? `| km | Clock | GAP | HR | Elev |\n|----|-------|-----|-----|------|\n`
                : `| km | Clock | HR | Elev |\n|----|-------|-----|------|\n`;
              splits.forEach(s => {
                const clockSec = s.moving_time && s.distance
                  ? Math.round(s.moving_time / (s.distance / 1000))
                  : s.average_speed ? Math.round(1000 / s.average_speed) : null;
                const gapSec = s.average_grade_adjusted_speed
                  ? Math.round(1000 / s.average_grade_adjusted_speed) : null;
                const sPace = clockSec ? fmtPaceMd(clockSec) : '—';
                const sGap  = hasGapMd ? (gapSec ? fmtPaceMd(gapSec) : '—') : null;
                const sHR   = s.average_heartrate ? Math.round(s.average_heartrate) : '—';
                const sElev = s.elevation_difference != null
                  ? `${s.elevation_difference >= 0 ? '+' : ''}${s.elevation_difference.toFixed(1)}m`
                  : '—';
                const sPause = (s.elapsed_time || 0) - (s.moving_time || 0);
                const pauseStr = sPause > 20 ? ` ⏸${fmtTimeMd(sPause)}` : '';
                md += hasGapMd
                  ? `| ${s.split} | ${sPace}${pauseStr} | ${sGap} | ${sHR} | ${sElev} |\n`
                  : `| ${s.split} | ${sPace}${pauseStr} | ${sHR} | ${sElev} |\n`;
              });
            }

            // Best efforts
            const bestEffortNames = ['400m', '1K', '1 mile', '2 mile', '5K', '10K'];
            const efforts = (a.best_efforts || []).filter(e => bestEffortNames.includes(e.name));
            if (efforts.length > 0) {
              md += `\n**Best Efforts:**\n`;
              efforts.forEach(e => {
                const t = fmtTimeMd(e.moving_time);
                const pr = e.pr_rank === 1 ? ' 🥇 PR#1' : e.pr_rank === 2 ? ' 🥈 PR#2' : e.pr_rank === 3 ? ' 🥉 PR#3' : '';
                md += `- **${e.name}**: ${t}${pr}\n`;
              });
            }

            md += `\n`;
          });
          md += `\n`;
        }

        if (includeYazio) {
          const dayFood = foodEntries.filter(f => f.date === dateStr);
          const dayNutrition = nutritionEntries.find(n => n.date === dateStr);
          if (dayFood.length > 0) {
            md += `### 🥗 Dieta (Yazio)\n`;
            const meals = { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja', snack: 'Przekąski' };
            
            Object.entries(meals).forEach(([key, label]) => {
              const mealItems = dayFood.filter(f => f.meal_type === key);
              if (mealItems.length > 0) {
                md += `#### ${label}\n`;
                mealItems.forEach(item => {
                  const extras = [
                    item.fiber != null ? `Bł: ${item.fiber}g` : null,
                    item.sugar != null ? `Cuk: ${item.sugar}g` : null,
                    item.saturated_fat != null ? `Nas: ${item.saturated_fat}g` : null,
                    item.salt != null ? `Sól: ${item.salt}g` : null,
                    item.insulin_load != null ? `IL_est: ${item.insulin_load}` : null,
                  ].filter(Boolean).join(' | ');
                  const brandStr = item.brand ? ` — ${item.brand}` : '';
                  md += `- ${item.name}${brandStr} (${item.amount || ''}): ${item.calories} kcal | B: ${item.protein}g | W: ${item.carbs || 0}g | T: ${item.fat || 0}g${extras ? ' | ' + extras : ''}\n`;
                });
              }
            });
            
            const totalCal = dayFood.reduce((sum, f) => sum + (f.calories || 0), 0);
            const totalProt = dayFood.reduce((sum, f) => sum + (Number(f.protein) || 0), 0);
            const totalCarb = dayFood.reduce((sum, f) => sum + (Number(f.carbs) || 0), 0);
            const totalFat = dayFood.reduce((sum, f) => sum + (Number(f.fat) || 0), 0);
            const totalFiber = dayFood.reduce((sum, f) => sum + (Number(f.fiber) || 0), 0);
            const totalSugar = dayFood.reduce((sum, f) => sum + (Number(f.sugar) || 0), 0);
            const totalIL = dayFood.reduce((sum, f) => sum + (Number(f.insulin_load) || 0), 0);

            const proteinDensity = totalCal > 0 ? ((totalProt / totalCal) * 100).toFixed(1) : '0.0';
            const sugarAlert = totalSugar > 50 ? ' ⚠️ (Wysoki cukier!)' : '';
            const fiberSugarStr = [
              totalFiber > 0 ? `Bł: ${totalFiber.toFixed(1)}g` : null,
              totalSugar > 0 ? `Cuk: ${totalSugar.toFixed(1)}g${sugarAlert}` : null
            ].filter(Boolean).join(' | ');

            const ilLabel = totalIL < 120 ? 'niski' : totalIL < 200 ? 'umiarkowany' : 'wysoki';
            const prevDateStr = new Date(new Date(dateStr).getTime() - 86400000).toISOString().split('T')[0];
            const prevNutrition = nutritionEntries.find(n => n.date === prevDateStr);
            const prevIL = prevNutrition?.insulin_load ? Number(prevNutrition.insulin_load) : null;
            const ilDiff = prevIL ? totalIL - prevIL : null;
            const ilTrend = ilDiff == null ? '' : ilDiff > 15 ? ` ↑ (wczoraj: ${prevIL.toFixed(1)})` : ilDiff < -15 ? ` ↓ (wczoraj: ${prevIL.toFixed(1)})` : ` → (wczoraj: ${prevIL.toFixed(1)})`;
            const hadTraining = dayStrava && dayStrava.length > 0;
            const ilContext = totalIL >= 200
              ? hadTraining ? ' 🏃 dzień treningowy — OK' : ' 🛋️ bez treningu — rozważ'
              : hadTraining ? ' 🏃' : '';

            // Gęstość ładunku insulinowego na 1000 kcal
            const ilPer1000 = totalCal > 0 ? ((totalIL / totalCal) * 1000).toFixed(1) : '0.0';

            // Pierwsze i ostatnie logowanie posiłku
            const loggedTimes = dayFood.map(f => f.logged_at).filter(Boolean).map(t => new Date(t));
            let mealWindowStr = '';
            if (loggedTimes.length >= 2) {
              const firstTs = new Date(Math.min(...loggedTimes.map(t => t.getTime())));
              const lastTs  = new Date(Math.max(...loggedTimes.map(t => t.getTime())));
              const fmtT = (d) => d.toLocaleTimeString('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit' });
              const windowMin = Math.round((lastTs - firstTs) / 60000);
              const windowH = Math.floor(windowMin / 60);
              const windowM = windowMin % 60;
              const windowStr = windowH > 0 ? `${windowH}h${windowM > 0 ? windowM + 'm' : ''}` : `${windowM}m`;
              mealWindowStr = `\n_⏰ Logowanie: pierwsze ${fmtT(firstTs)} → ostatnie ${fmtT(lastTs)} | okno: **${windowStr}** (czas logowania, ~80% zgodny z czasem jedzenia)_`;
            }

            md += `\n**Suma dnia: ${totalCal} kcal | B: ${totalProt.toFixed(1)}g | W: ${totalCarb.toFixed(1)}g | T: ${totalFat.toFixed(1)}g${fiberSugarStr ? ' | ' + fiberSugarStr : ''}**\n`;
            md += `_Gęstość białka: ${proteinDensity}g / 100 kcal | IL_est: ${totalIL.toFixed(1)} (gęstość: ${ilPer1000} / 1000 kcal) — ${ilLabel}${ilTrend}${ilContext}_${mealWindowStr}\n\n`;
          } else if (dayNutrition) {
            md += `### 🥗 Dieta (Yazio)\n`;
            md += foodError
              ? `Nie udało się pobrać szczegółowych produktów z \`daily_food_entries\`: ${foodError.message}\n\n`
              : `Brak szczegółowych produktów w \`daily_food_entries\`, ale dzienna suma z Yazio jest zapisana.\n\n`;
            const calories = dayNutrition.calories || 0;
            const protein = Number(dayNutrition.protein || 0);
            const density = calories > 0 ? ((protein / calories) * 100).toFixed(1) : '0.0';
            md += `**Suma dnia: ${calories} kcal | B: ${protein.toFixed(1)}g**\n`;
            md += `_Gęstość białka: ${density}g / 100 kcal_\n\n`;
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

      const blob = new Blob(['\uFEFF' + md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `raport_kuba_${dateRange.from}.md`; a.click();
    } finally { setIsExporting(false); }
  }

  async function exportOuraCSV() {
    setIsExportingOura(true);
    try {
      // Dzienne agregaty (oura_enhanced)
      const enhancedCols = [
        'sleep_score', 'readiness_score',
        'total_sleep_hours', 'time_in_bed_hours', 'deep_sleep_hours', 'rem_sleep_hours',
        'light_sleep_hours', 'awake_time_minutes', 'restless_periods', 'sleep_efficiency',
        'sleep_latency_minutes', 'bedtime_start', 'bedtime_end',
        'sleep_average_heart_rate', 'sleep_lowest_heart_rate', 'sleep_average_hrv', 'sleep_average_breath',
        'activity_score', 'steps', 'active_calories', 'total_calories', 'target_calories',
        'equivalent_walking_distance', 'high_activity_minutes', 'medium_activity_minutes',
        'low_activity_minutes', 'sedentary_minutes', 'resting_minutes', 'non_wear_minutes',
        'average_met_minutes', 'inactivity_alerts',
        'stress_high_minutes', 'recovery_high_minutes', 'stress_day_summary',
        'resilience_level', 'spo2_percentage', 'breathing_disturbance_index',
        'vascular_age', 'vo2_max',
        'temperature_deviation', 'temperature_trend_deviation'
      ];
      // Metryki pochodne z szeregów czasowych (oura_derived_daily)
      const derivedCols = [
        'sleep_hr_min', 'sleep_hr_avg', 'sleep_hr_max',
        'sleep_hrv_min', 'sleep_hrv_avg', 'sleep_hrv_peak',
        'awakenings', 'deep_blocks',
        'met_peak', 'met_avg', 'vigorous_min', 'moderate_min', 'light_min',
        'hr_min_day', 'hr_avg_day', 'hr_max_day',
        'workout_count', 'workout_minutes', 'workout_calories'
      ];

      const [enhancedRes, derivedRes] = await Promise.all([
        supabase.from('oura_enhanced')
          .select(['date', ...enhancedCols].join(','))
          .eq('user_id', session.user.id)
          .gte('date', dateRange.from).lte('date', dateRange.to)
          .order('date', { ascending: true }),
        supabase.from('oura_derived_daily')
          .select(['day', ...derivedCols].join(','))
          .eq('user_id', session.user.id)
          .gte('day', dateRange.from).lte('day', dateRange.to)
          .order('day', { ascending: true }),
      ]);

      if (enhancedRes.error) { alert('Błąd pobierania Oura: ' + enhancedRes.error.message); return; }
      const enhanced = enhancedRes.data || [];
      const derived = derivedRes.data || [];
      if (enhanced.length === 0 && derived.length === 0) {
        alert('Brak danych Oura w wybranym zakresie dat.'); return;
      }

      // Scalanie po dacie — jeden wiersz na dzień
      const byDate = {};
      enhanced.forEach(r => { byDate[r.date] = { date: r.date, ...r }; });
      derived.forEach(r => { byDate[r.day] = { ...(byDate[r.day] || { date: r.day }), ...r }; });
      const merged = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

      const columns = ['date', ...enhancedCols, ...derivedCols];

      const escape = (val) => {
        if (val === null || val === undefined) return '';
        const s = String(val);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const round = (val) => (typeof val === 'number' && !Number.isInteger(val)) ? Math.round(val * 100) / 100 : val;

      const headerRow = columns.join(',');
      const rows = merged.map(r => columns.map(c => escape(round(r[c]))).join(','));
      const csv = '﻿' + [headerRow, ...rows].join('\n'); // BOM dla poprawnego UTF-8 w Excelu

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oura_${dateRange.from}_${dateRange.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setIsExportingOura(false); }
  }

  if (loading) return <div className="p-8 text-center text-neutral-500 uppercase font-black animate-pulse tracking-widest">Wczytywanie...</div>;

  const isSunday = new Date().getDay() === 0;
  const latestBody = bodyData?.[bodyData.length - 1] || null;
  const todayStr = format(new Date(), 'dd.MM');
  const isLatestToday = nutritionData.length > 0 && nutritionData[nutritionData.length - 1].date === todayStr;
  const todayProtein = isLatestToday ? Number(nutritionData[nutritionData.length - 1].protein || 0) : 0;
  const proteinGoal = 150;
  const proteinPct = Math.min((todayProtein / proteinGoal) * 100, 100);
  
  let recentProtein = [...nutritionData];
  if (recentProtein.length > 0 && recentProtein[recentProtein.length - 1].date !== todayStr) {
    recentProtein.push({
      date: todayStr,
      protein: 0,
      calories: 0
    });
  }
  recentProtein = recentProtein.slice(-7);

  return (
    <div className="space-y-6 pb-4">
      {/* Raport Psychologiczny - Tylko w Niedzielę */}
      {narrative && isSunday && (
        <section className="animate-in fade-in zoom-in duration-700">
          <div className="rounded-lg border border-primary/15 bg-primary/5 p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-primary">
              <Zap size={12} className="text-primary" /> Analiza Behawioralna
            </h3>
            <p className="text-[13px] font-bold leading-relaxed text-white/78">"{narrative}"</p>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-primary">Pomiary</p>
            <h2 className="mt-1 text-[18px] font-black uppercase tracking-tight text-white">Waga i talia</h2>
          </div>
          <Activity className="text-primary/35" size={22} />
        </header>
        <div className="space-y-4 rounded-lg border border-white/[0.08] bg-[linear-gradient(180deg,rgba(24,24,27,0.9),rgba(10,10,11,0.96))] p-5 shadow-2xl shadow-black/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="flex items-center text-[8px] font-black uppercase tracking-widest text-white/35">
                Waga (kg) <TrendArrow current={trends.weight?.cur} previous={trends.weight?.prev} better="down" />
              </label>
              <input type="number" step="0.1" value={newMetric.weight} onChange={e => setNewMetric({...newMetric, weight: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-lg font-black text-white outline-none transition-all placeholder:text-white/16 focus:border-primary/70 focus:bg-black/65" placeholder={latestBody?.weight ? String(latestBody.weight) : '--'} />
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center text-[8px] font-black uppercase tracking-widest text-white/35">
                Talia (cm) <TrendArrow current={trends.waist?.cur} previous={trends.waist?.prev} better="down" />
              </label>
              <input type="number" step="0.1" value={newMetric.waist} onChange={e => setNewMetric({...newMetric, waist: e.target.value})} className="w-full rounded-lg border border-white/[0.08] bg-black/45 p-3 text-lg font-black text-white outline-none transition-all placeholder:text-white/16 focus:border-primary/70 focus:bg-black/65" placeholder={latestBody?.waist ? String(latestBody.waist) : '--'} />
            </div>
          </div>
          <button onClick={saveMetrics} className="w-full rounded-lg bg-primary py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-[0.99]">Zapisz pomiary</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/[0.07] bg-neutral-950/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/32">Waga</p>
            <Scale size={13} className="text-white/24" />
          </div>
          <p className="text-[20px] font-black text-white">{latestBody?.weight ?? '--'}<span className="ml-1 text-[10px] text-white/25">kg</span></p>
          {projections?.weight && <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-white/25">6w: {projections.weight.value} kg</p>}
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-neutral-950/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/32">Talia</p>
            <Ruler size={13} className="text-white/24" />
          </div>
          <p className="text-[20px] font-black text-white">{latestBody?.waist ?? '--'}<span className="ml-1 text-[10px] text-white/25">cm</span></p>
          {projections?.waist && <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-white/25">6w: {projections.waist.value} cm</p>}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Fueling</p>
            <h2 className="mt-1 text-[16px] font-black uppercase tracking-tight text-white">Białko dzisiaj</h2>
          </div>
          <p className="text-[13px] font-black text-primary">{todayProtein}g</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-neutral-950/80 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Cel {proteinGoal}g</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-white/30">{Math.round(proteinPct)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-primary shadow-[0_0_12px_rgba(59,130,246,0.35)]" style={{ width: `${proteinPct}%` }} />
          </div>
          {recentProtein.length > 0 && (
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {recentProtein.map((d) => {
                const pct = Math.min((Number(d.protein || 0) / proteinGoal) * 100, 100);
                return (
                  <div key={d.date} className="flex h-14 flex-col justify-end gap-1">
                    <div className="rounded-sm bg-primary/70" style={{ height: `${Math.max(pct, 6)}%` }} />
                    <span className="text-center text-[7px] font-bold text-white/25">{d.date.slice(0, 2)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {topSlot}

      <section className="space-y-3">
        <h2 className="text-[16px] font-black uppercase tracking-tight text-white">Historia treningów</h2>
        <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-neutral-950/60">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.03] text-[8px] font-black uppercase tracking-widest text-white/30">
                <th className="p-3">Data</th>
                <th className="p-3 text-center">Dzień</th>
                <th className="p-3 text-right">Akcja</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-[10px] font-bold text-white">
              {recentSessions.slice(0, showAllSessions ? 12 : 4).map(s => (
                <tr key={s.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="p-3">
                    {editingSession === s.id ? (
                      <input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="bg-neutral-950 border border-neutral-800 rounded p-1 text-[10px] text-white" />
                    ) : (
                      format(parseISO(s.date), 'dd.MM')
                    )}
                  </td>
                  <td className="p-3 text-center text-white/45">
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
                  <td className="p-3 text-right">
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
          {recentSessions.length > 4 && (
            <button
              onClick={() => setShowAllSessions(v => !v)}
              className="w-full py-2.5 text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white/60 transition-colors border-t border-white/[0.05]"
            >
              {showAllSessions ? 'Zwiń ↑' : `Pokaż więcej (${recentSessions.length - 4}) ↓`}
            </button>
          )}
        </div>
      </section>

      {runningSlot}

      <section className="space-y-4 rounded-lg border border-white/[0.08] bg-neutral-950/80 p-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Eksport</p>
          <h2 className="mt-1 text-[15px] font-black uppercase tracking-tight text-white">Raport danych</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="relative group">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-hover:text-primary transition-colors" size={14} />
            <input 
              type="date" 
              value={dateRange.from} 
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
              onChange={e => setDateRange({...dateRange, from: e.target.value})} 
              className="w-full cursor-pointer appearance-none rounded-lg border border-white/[0.08] bg-black/35 p-3 pl-10 text-[10px] font-bold text-white outline-none transition-all focus:border-primary/70"
            />
          </div>
          <div className="relative group">
            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-hover:text-primary transition-colors" size={14} />
            <input 
              type="date" 
              value={dateRange.to} 
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
              onChange={e => setDateRange({...dateRange, to: e.target.value})} 
              className="w-full cursor-pointer appearance-none rounded-lg border border-white/[0.08] bg-black/35 p-3 pl-10 text-[10px] font-bold text-white outline-none transition-all focus:border-primary/70"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button onClick={() => setIncludeWorkouts(!includeWorkouts)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeWorkouts ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeWorkouts && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Trening (Siłka/Strava)</span>
          </button>

          <button onClick={() => setIncludeBody(!includeBody)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeBody ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeBody && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Pomiary Ciała</span>
          </button>

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

          <button onClick={() => setIncludeActivityWatch(!includeActivityWatch)} className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors">
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${includeActivityWatch ? 'bg-primary border-primary text-white' : 'border-neutral-800'}`}>
              {includeActivityWatch && <CheckSquare size={10} />}
            </div>
            <span className="text-[10px] font-black uppercase">Aktywność komputera (ActivityWatch)</span>
          </button>

        </div>

        <div className="flex items-center justify-between pt-2">
          <button onClick={syncHistory} disabled={isSyncing} className="text-[8px] font-black uppercase text-neutral-600 hover:text-primary transition-colors">
            {isSyncing ? 'Syncing...' : 'Sync Yazio'}
          </button>
          <button onClick={exportData} disabled={isExporting} className="ml-4 flex-1 rounded-lg bg-primary px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20 transition-transform hover:scale-[1.01]">
            {isExporting ? 'Generowanie...' : 'Pobierz Raport (.md)'}
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-1 pt-1">
          {[1, 7, 14, 30].map(p => (
            <button
              key={p}
              onClick={() => { setAnalyzePeriod(p); setAnalyzeResult(null); }}
              className={`flex-1 rounded-lg border py-2 text-[9px] font-black uppercase tracking-widest transition-colors ${analyzePeriod === p ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/[0.08] bg-white/[0.02] text-white/35 hover:text-white/60'}`}
            >
              {p === 1 ? '1D' : `${p}D`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {analyzePeriod === 1 && (
            <input
              type="date"
              value={analyzeDate}
              onChange={e => { setAnalyzeDate(e.target.value); setAnalyzeResult(null); }}
              className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[10px] font-black uppercase text-white/60 focus:outline-none focus:border-primary/40"
            />
          )}
          {analyzePeriod > 1 && (
            <p className="flex-1 text-[10px] font-black uppercase text-white/30">
              Ostatnie {analyzePeriod} dni
            </p>
          )}
          <button
            onClick={analyzeFood}
            disabled={isAnalyzing}
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase text-white/60 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
          >
            {isAnalyzing ? 'Analizuję...' : 'Analizuj'}
          </button>
        </div>

        {analyzeResult && analyzeResult.mode === 'single' && (
          <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-white/40">Jakość dnia {analyzeResult.date}</span>
              <span className={`text-lg font-black ${analyzeResult.day_quality_score >= 70 ? 'text-dayC' : analyzeResult.day_quality_score >= 45 ? 'text-yellow-400' : 'text-dayB'}`}>
                {analyzeResult.day_quality_score}/100
              </span>
            </div>
            <p className="text-[11px] text-white/60 leading-relaxed">{analyzeResult.day_quality_analysis}</p>
            <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
              {analyzeResult.items.sort((a, b) => b.food_quality_score - a.food_quality_score).map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`shrink-0 text-[10px] font-black w-7 text-right ${item.food_quality_score >= 70 ? 'text-dayC' : item.food_quality_score >= 45 ? 'text-yellow-400' : 'text-dayB'}`}>
                    {item.food_quality_score}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black text-white/80 truncate">{item.name}</p>
                    <p className="text-[9px] text-white/35">{item.quality_reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analyzeResult && analyzeResult.mode === 'range' && (
          <div className="mt-2 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 space-y-4">
            {/* Avg score */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-white/40">Średnia {analyzeResult.dateFrom} → {analyzeResult.dateTo}</span>
              <span className={`text-lg font-black ${analyzeResult.avg_score >= 70 ? 'text-dayC' : analyzeResult.avg_score >= 45 ? 'text-yellow-400' : 'text-dayB'}`}>
                {analyzeResult.avg_score}/100
              </span>
            </div>

            {/* Per-day bars */}
            <div className="space-y-1.5">
              {analyzeResult.days.map(d => (
                <div key={d.date} className="flex items-center gap-2">
                  <span className="w-[52px] shrink-0 text-[8px] font-black text-white/30">{d.date.slice(5)}</span>
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${d.score}%`,
                        backgroundColor: d.score >= 70 ? '#10b981' : d.score >= 45 ? '#f59e0b' : '#ef4444'
                      }}
                    />
                  </div>
                  <span className={`w-6 shrink-0 text-[9px] font-black text-right ${d.score >= 70 ? 'text-dayC' : d.score >= 45 ? 'text-yellow-400' : 'text-dayB'}`}>
                    {d.score}
                  </span>
                </div>
              ))}
            </div>

            {/* Pattern analysis */}
            <p className="text-[11px] text-white/60 leading-relaxed border-t border-white/[0.06] pt-3">{analyzeResult.pattern_analysis}</p>

            {/* Issues + strengths */}
            <div className="grid grid-cols-2 gap-3">
              {analyzeResult.top_issues?.length > 0 && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-dayB mb-1.5">Do poprawy</p>
                  <ul className="space-y-1">
                    {analyzeResult.top_issues.map((t, i) => (
                      <li key={i} className="text-[9px] text-white/50">· {t}</li>
                    ))}
                  </ul>
                </div>
              )}
              {analyzeResult.strengths?.length > 0 && (
                <div>
                  <p className="text-[8px] font-black uppercase tracking-widest text-dayC mb-1.5">Mocne strony</p>
                  <ul className="space-y-1">
                    {analyzeResult.strengths.map((s, i) => (
                      <li key={i} className="text-[9px] text-white/50">· {s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <button onClick={exportOuraCSV} disabled={isExportingOura} className="w-full rounded-lg border border-white/[0.08] px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white/45 transition-colors hover:border-primary/40 hover:text-primary">
          {isExportingOura ? 'Generowanie...' : 'Pobierz Oura (.csv)'}
        </button>

      </section>
    </div>
  );
}
