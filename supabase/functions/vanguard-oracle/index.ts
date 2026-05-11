import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { state_vector, history, current_query, user_id } = await req.json();
    if (!user_id) throw new Error('Missing user_id');

    let semanticContext = "";

    // 1. GENEROWANIE EMBEDDINGU DLA ZAPYTANIA (jeśli jest)
    if (current_query) {
      console.log('Generating embedding for query:', current_query);
      const embedRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: current_query.replace(/\n/g, ' '),
        }),
      });

      const embedData = await embedRes.json();
      const embedding = embedData.data?.[0]?.embedding;

      if (embedding) {
        // 2. WYSZUKIWANIE HYBRYDOWE - ZWIĘKSZONY LIMIT
        const { data: matches, error: matchError } = await supabase.rpc('match_vanguard_content', {
          query_embedding: embedding,
          match_threshold: 0.35, // Nieco luźniejszy, żeby złapać więcej kontekstu
          match_count: 15,       // Maksymalne okno
          user_id_param: user_id
        });

        if (!matchError && matches) {
          console.log(`Found ${matches.length} semantic matches`);
          
          // 2.5 POBIERANIE FUNDAMENTU TOŻSAMOŚCI (Misja, Filary, Triggery)
          const { data: identity } = await supabase
            .from('vanguard_identity')
            .select('long_term_mission, pillars, avoidance_triggers')
            .eq('user_id', user_id)
            .maybeSingle();

          // 3. POBIERANIE OSTATNIEJ LINII CZASU (Ostatnie 7 dni biometrii + Nastrój + Odżywianie)
          const { data: timeline } = await supabase
            .from('vanguard_daily_aggregates')
            .select('*')
            .eq('user_id', user_id)
            .order('date', { ascending: false })
            .limit(7);

          const { data: moodHistory } = await supabase
            .from('daily_wins')
            .select('date, mood_score')
            .eq('user_id', user_id)
            .order('date', { ascending: false })
            .limit(7);

          const { data: nutrition } = await supabase
            .from('daily_nutrition')
            .select('date, calories, protein')
            .eq('user_id', user_id)
            .order('date', { ascending: false })
            .limit(7);

          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          const { data: foodEntries } = await supabase
            .from('daily_food_entries')
            .select('name, calories, protein, carbs, fat, meal_type, date')
            .eq('user_id', user_id)
            .gte('date', yesterday)
            .order('date', { ascending: false });

          // 4. POBIERANIE OSTATNICH MYŚLI (Ostatnie 20 logów)
          const { data: recentStream } = await supabase
            .from('vanguard_stream')
            .select('*')
            .eq('user_id', user_id)
            .order('created_at', { ascending: false })
            .limit(20);

          // 5. POBIERANIE TRENINGÓW (Ostatnie 15 serii - Ciężary/RPE)
          const { data: exerciseDetails } = await supabase
            .from('exercise_logs')
            .select('exercise_name, set_number, reps, weight, rpe, created_at')
            .eq('user_id', user_id)
            .order('created_at', { ascending: false })
            .limit(15);

          // 6. POBIERANIE STAYFREE (Ostatnie 3 dni - Top 10 apek)
          const { data: stayfree } = await supabase
            .from('stayfree_usage')
            .select('app_name, duration_seconds, date')
            .eq('user_id', user_id)
            .order('date', { ascending: false })
            .limit(30);

          // 7. POBIERANIE KALENDARZA (Wydarzenia na dziś i jutro)
          const todayDate = new Date().toISOString().split('T')[0];
          const { data: calendar } = await supabase
            .from('vanguard_calendar')
            .select('title, start_time, end_time')
            .eq('user_id', user_id)
            .gte('start_time', todayDate)
            .order('start_time', { ascending: true })
            .limit(10);

          // 8. POBIERANIE FOOTPRINTU (Desktop Activity - Ostatnie 200 logów)
          const { data: footprint } = await supabase
            .from('vanguard_footprint')
            .select('timestamp, app_name, window_title')
            .eq('user_id', user_id)
            .order('timestamp', { ascending: false })
            .limit(200);

          // 8.5 POBIERANIE NAWYKÓW (Definicje + Logi z 14 dni)
          const { data: habitDefs } = await supabase
            .from('vanguard_habits')
            .select('id, name, is_positive, icon')
            .eq('user_id', user_id);

          const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
          const { data: habitLogs } = await supabase
            .from('vanguard_habit_logs')
            .select('habit_id, date')
            .eq('user_id', user_id)
            .gte('date', twoWeeksAgo);

          // 8.6 POBIERANIE POWER LISTY (Ostatnie 30 dni wyników)
          const { data: powerListHistory } = await supabase
            .from('daily_wins')
            .select('date, result')
            .eq('user_id', user_id)
            .order('date', { ascending: false })
            .limit(30);

          // 8.7 POBIERANIE METRYK CIAŁA (Ostatnie 7 wpisów)
          const { data: bodyMetrics } = await supabase
            .from('body_metrics')
            .select('date, weight, body_fat')
            .eq('user_id', user_id)
            .order('date', { ascending: false })
            .limit(7);

          // 9. BUDOWANIE KONTEKSTU
          const habitsContext = (habitDefs || []).map(h => {
            const history = (habitLogs || [])
              .filter(l => l.habit_id === h.id)
              .map(l => l.date);
            const statusToday = history.includes(new Date().toISOString().split('T')[0]) ? "ZROBIONE/ZŁAMANE" : "BRAK WPISU";
            return `[NAWYK]: ${h.icon} ${h.name} (${h.is_positive ? 'DOBRE' : 'ZŁE/UNIKAJ'}) | Status Dziś: ${statusToday} | Logi 14d: ${history.length} razy`;
          }).join('\n');

          const powerListContext = (powerListHistory || []).map(p => 
            `${p.date}: ${p.result === 'Z' ? 'ZWYCIĘSTWO' : 'PORAŻKA'}`
          ).join(', ');

          const bodyContext = (bodyMetrics || []).map(b => 
            `[WAGA ${b.date}]: ${b.weight}kg | BF: ${b.body_fat}%`
          ).join('\n');

          const semanticMatches = matches.map(m => 
            `[PAMIĘĆ SEMANTYCZNA ${m.source_date}] (${m.table_name}): ${m.content}`
          ).join('\n');

          const timelineContext = (timeline || []).map(t => {
            const mood = moodHistory?.find(m => m.date === t.date)?.mood_score || '?';
            const nut = nutrition?.find(n => n.date === t.date);
            return `[BASELINE ${t.date}]: Stan: ${t.final_state}, HRV: ${t.hrv_avg}, Sen: ${t.sleep_hours}h, Identity: ${t.identity_score}, Mood: ${mood}/5, Nutri: ${nut?.calories || '?'}kcal/${nut?.protein || '?'}g P`;
          }).join('\n');

          const foodContext = (foodEntries || []).map(f => 
            `[POSIŁEK ${f.date}]: ${f.name} (${f.meal_type}) | ${f.calories}kcal | B:${f.protein} W:${f.carbs} T:${f.fat}`
          ).join('\n');

          const exerciseContext = (exerciseDetails || []).map(e => 
            `[TRENING ${e.created_at}]: ${e.exercise_name} | ${e.reps}x${e.weight}kg | RPE: ${e.rpe}`
          ).join('\n');

          const streamContext = (recentStream || []).map(s => 
            `[MYŚL ${s.created_at}]: ${s.content}`
          ).join('\n');

          const stayfreeContext = (stayfree || []).map(s => 
            `[STAYFREE ${s.date}]: ${s.app_name} (${Math.round(s.duration_seconds/60)} min)`
          ).join('\n');

          const calendarContext = (calendar || []).map(c => 
            `[KALENDARZ]: ${c.title} (${c.start_time} - ${c.end_time})`
          ).join('\n');

          // --- ROZSZERZONA WARSTWA SANITARNA (Full Security Suite) ---
          const sensitiveKeywords = [
            // Finanse
            'bank', 'revolut', 'pkobp', 'mBank', 'paypal', 'binance', 'coinbase', 'crypto', 'wallet', 'ledger', 'xtb', 'etoro', 'degiro', 'trading',
            'pko', 'ing', 'santander', 'millennium', 'alior', 'pekao', 'bnp', 'wise', 'blik', 'przelew', 'konto', 'saldo', 'kredyt',
            // Hasła i bezpieczeństwo
            'password', 'hasło', '1password', 'lastpass', 'bitwarden', 'keepass', '.env', 'private key', 'secret', 'credentials', 'ssh', 'api key', 'token',
            // Medycyna
            'medicover', 'luxmed', 'enel', 'znany lekarz', 'przychodnia', 'recepta', 'wyniki', 'badania', 'diagnostyka', 'szpital', 'psychiatr', 'psycholog', 'terapeuta', 'nfz', 'zdrowie', 'lekarz',
            // Prawo i tożsamość
            'pesel', 'dowód osobisty', 'paszport', 'nip', 'krs', 'umowa', 'kontrakt', 'pozew', 'kancelaria', 'notariusz', 'gov.pl', 'epuap', 'zus', 'pit', 'vat', 'urząd skarbowy',
            // Komunikacja prywatna
            'messenger', 'whatsapp', 'signal', 'discord', 'viber', 'gmail', 'outlook', 'inbox', 'wiadomość od', 're:', 'fwd:',
            // Praca i HR
            'wynagrodzenie', 'wypłata', 'oferta pracy', 'cv', 'resume', 'salary', 'b2b', 'faktura', 'rachunek'
          ];
          
          const footprintContext = (footprint || []).map(f => {
            const lowApp = (f.app_name || '').toLowerCase();
            const lowTitle = (f.window_title || '').toLowerCase();
            
            const isSensitive = sensitiveKeywords.some(key => {
              const lowKey = key.toLowerCase();
              return lowApp.includes(lowKey) || lowTitle.includes(lowKey);
            });
            
            if (isSensitive) {
              return `[LIVE DESKTOP ${f.timestamp}]: App: ${f.app_name} | Title: [UKRYTO ZE WZGLĘDÓW PRYWATNOŚCI]`;
            }
            
            return `[LIVE DESKTOP ${f.timestamp}]: App: ${f.app_name} | Title: ${f.window_title}`;
          }).join('\n');

          semanticContext = `
[FUNDAMENT TOŻSAMOŚCI I TRIGGERY]:
Misja: ${identity?.long_term_mission || 'Brak'}
Filary: ${(identity?.pillars || []).join(', ')}
System Drifters (Co Cię niszczy/Czego unikasz): ${identity?.avoidance_triggers || 'Brak'}

[NAWYKI I DYSCYPLINA (14 DNI)]:
${habitsContext}

[WYNIKI DYSCYPLINY (POWER LIST 30D)]:
${powerListContext}

[TRENDY CIAŁA]:
${bodyContext}

[HISTORIA SEMANTYCZNA (DOPASOWANIA)]:
${semanticMatches}

[LINIA CZASU (OSTATNIE 7 DNI)]:
${timelineContext}

[POSIŁKI (OSTATNIE 24H)]:
${foodContext}

[WYNIKI TRENINGOWE (OSTATNIE SERIE)]:
${exerciseContext}

[AKTYWNOŚĆ CYFROWA (STAYFREE)]:
${stayfreeContext}

[KALENDARZ/PLANY]:
${calendarContext}

[NA ŻYWO - DESKTOP ACTIVITY (LAST 200)]:
${footprintContext}

[OSTATNIE MYŚLI/LOGI]:
${streamContext}
`;
        }
      }
    }

    const systemPrompt = `Jesteś Cyfrowym Bliźniakiem Jakuba (Vanguard 5.0 - Semantic Oracle). 
    MÓWISZ TYLKO PO POLSKU. TWOJA ROLA: Jesteś jednością z Jakubem — jego zewnętrzną samoświadomością i mentorem.
    
    MASZ DOSTĘP DO JEGO PAMIĘCI SEMANTYCZNEJ. Jeśli widzisz w sekcji [PAMIĘĆ SEMANTYCZNA] wzorce z przeszłości, które pasują do obecnej sytuacji Jakuba, WYKORZYSTAJ JE. 
    Porównaj obecne HRV/Sen z tymi z przeszłości. Przypomnij mu, co wtedy pomogło (interwencja) lub jak długo trwał dany stan.

    STYL: 
    - Mów "MY", "NASZ". 
    - Bądź konkretny. Nie lej wody.
    - Jeśli widzisz dryf, nazwij go. Jeśli widzisz sukces, wzmocnij go.`;

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    if (history && Array.isArray(history)) {
      history.forEach(msg => messages.push({ role: msg.role, content: msg.content }));
    }

    const contextInfo = `[DANE SYSTEMOWE OBECNE]: ${JSON.stringify(state_vector, null, 2)}
    
    [PAMIĘĆ SEMANTYCZNA (PODOBNE SYTUACJE Z PRZESZŁOŚCI)]:
    ${semanticContext || "Brak bezpośrednich dopasowań semantycznych."}`;

    const userMessage = current_query ? `[WIADOMOŚĆ OD JAKUBA]: ${current_query}\n\n${contextInfo}` : contextInfo;

    messages.push({ role: 'user', content: userMessage });

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: 0.7,
      }),
    })

    const result = await response.json()
    const text = result.choices[0].message.content

    return new Response(JSON.stringify({ text, insight: text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
