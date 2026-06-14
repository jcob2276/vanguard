import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportStatsMarkdown({
  supabase,
  session,
  dateRange,
  userSettings,
  includeYazio,
  includeJournal,
  includeOura,
  includeHabits,
  includeWorkouts,
  includeBody,
  includeActivityWatch,
}) {
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
      includeWorkouts ? supabase.from('strava_activities_clean').select('strava_id,name,sport_type,start_date,elapsed_time,moving_time,distance,total_elevation_gain,pace_sec_per_km,cadence_spm,hr_avg,hr_max,hr_source,hr_frozen,splits_with_hr,gear_name,gear_distance_km,has_pr,pause_seconds,is_oura,perceived_exertion,workout_type,best_efforts,gc_hr_zones,gc_weather,gc_training_effect_aerobic,gc_training_effect_anaerobic,gc_vo2max,gc_enriched_at').eq('user_id', session.user.id).eq('is_oura', false).gte('start_date', exportStartIso).lte('start_date', exportEndIso).order('start_date', { ascending: true }) : Promise.resolve({ data: [] }),
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
      const next = new Date(current);
      next.setDate(current.getDate() + 1);
      current = next;
    }

    allDatesInRange.forEach(dateStr => {
      const daySessions = sessions.filter(s => s.date === dateStr);
      const dayFood = foodEntries.filter(f => f.date === dateStr);
      const dayNutrition = nutritionEntries.find(n => n.date === dateStr);
      const dayJournal = journalEntries.find(j => j.date === dateStr);
      const seenContent = new Set();
      const dayTelegramLogs = telegramEntries
        .filter(t => toWarsawDate(t.created_at) === dateStr)
        .filter(t => t.metadata?.mode === 'stream')
        .filter(t => {
          const key = (t.content || '').trim();
          if (seenContent.has(key)) return false;
          seenContent.add(key);
          return true;
        });
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

      const dayLocations = locationHistory?.filter(l => toWarsawDate(l.created_at) === dateStr);
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

          if (a.gc_enriched_at) {
            const gcParts = [];
            if (a.gc_training_effect_aerobic != null) gcParts.push(`TE aerob: **${a.gc_training_effect_aerobic}**`);
            if (a.gc_training_effect_anaerobic != null) gcParts.push(`TE anaerob: **${a.gc_training_effect_anaerobic}**`);
            if (a.gc_vo2max != null) gcParts.push(`VO2max: **${a.gc_vo2max}**`);
            if (a.gc_weather?.temp_c != null) gcParts.push(`${a.gc_weather.temp_c}°C${a.gc_weather.condition ? ` ${a.gc_weather.condition}` : ''}${a.gc_weather.humidity != null ? ` ${a.gc_weather.humidity}% wilg.` : ''}`);
            if (gcParts.length > 0) md += `**Garmin Connect:** ${gcParts.join(' | ')}\n`;
            if (Array.isArray(a.gc_hr_zones) && a.gc_hr_zones.length > 0) {
              const zones = a.gc_hr_zones.map((z, i) => {
                const mins = z.secsInZone != null ? Math.round(z.secsInZone / 60) : null;
                return mins != null && mins > 0 ? `Z${i + 1}: ${mins}min` : null;
              }).filter(Boolean);
              if (zones.length > 0) md += `**Strefy HR (GC):** ${zones.join(' | ')}\n`;
            }
          }

          // HRV context from Oura: pre-run (day of run) + post-run (day after)
          const runDate = new Date(a.start_date).toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
          const [ry, rm, rd] = runDate.split('-').map(Number);
          const nextDateObj = new Date(ry, rm - 1, rd + 1);
          const nextDate = `${nextDateObj.getFullYear()}-${String(nextDateObj.getMonth()+1).padStart(2,'0')}-${String(nextDateObj.getDate()).padStart(2,'0')}`;
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
          const [py, pm, pd] = dateStr.split('-').map(Number);
          const prevDateObj = new Date(py, pm - 1, pd - 1);
          const prevDateStr = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth()+1).padStart(2,'0')}-${String(prevDateObj.getDate()).padStart(2,'0')}`;
          const prevNutrition = nutritionEntries.find(n => n.date === prevDateStr);
          const prevIL = prevNutrition?.insulin_load != null ? Number(prevNutrition.insulin_load) : null;
          const ilDiff = prevIL != null ? totalIL - prevIL : null;
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
            const windowMin = Math.round((lastTs.getTime() - firstTs.getTime()) / 60000);
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
            const label = habit.is_positive ? 'Wykonano' : 'Wpadka';
            const stimulus = log.final_stimulus ? ` — bodziec: "${log.final_stimulus}"` : '';
            const ctx = log.context_note ? ` (${log.context_note})` : '';
            md += `- ${habit.icon} ${habit.name}: ${label}${stimulus}${ctx}\n`;
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
    downloadBlob(blob, `raport_kuba_${dateRange.from}.md`);
}

export async function exportOuraCsv({ supabase, session, dateRange }) {
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
    const byDate: Record<string, any> = {};
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
    downloadBlob(blob, `oura_${dateRange.from}_${dateRange.to}.csv`);
}
