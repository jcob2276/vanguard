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

    const { state_vector, history, current_query, user_id, mode, thinking } = await req.json();
    if (!user_id) throw new Error('Missing user_id');

    // STATIC CONTEXT — ładowany raz, wchodzi do system prompt (cache prefix)
    const [fundamentRes, ironRulesRes, patternsRes, personsRes, intentionsRes] = await Promise.all([
      supabase.from('user_fundament')
        .select('identity, philosophy, vision')
        .eq('user_id', user_id)
        .maybeSingle(),
      supabase.from('vanguard_knowledge')
        .select('title, content')
        .eq('user_id', user_id)
        .gte('importance_score', 8)
        .order('importance_score', { ascending: false })
        .limit(5),
      // LICZNIK WZORCÓW — ile razy każdy schemat się powtórzył
      supabase.from('vanguard_knowledge')
        .select('title, category')
        .eq('user_id', user_id)
        .eq('category', 'pattern')
        .order('created_at', { ascending: false })
        .limit(100),
      // ZNANE OSOBY — żeby wykryć nowe
      supabase.from('vanguard_knowledge')
        .select('title')
        .eq('user_id', user_id)
        .eq('category', 'person')
        .order('created_at', { ascending: false })
        .limit(50),
      // AKTYWNE INTENCJE — manifestacja, transurfing, modlitwy, cele
      supabase.from('vanguard_intentions')
        .select('text, type, importance, notes')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .order('importance', { ascending: false })
        .limit(10)
    ]);

    const f = fundamentRes.data;
    const staticProfile = f
      ? `\n\nKIM JEST JAKUB:\nTożsamość: ${f.identity || '—'}\nFilozofia: ${f.philosophy || '—'}\nWizja: ${f.vision || '—'}`
      : '';

    const ironRulesText = (ironRulesRes.data || [])
      .map(k => `• ${k.title}: ${(k.content || '').substring(0, 200)}`)
      .join('\n');

    // Licznik wzorców — zlicz powtórzenia po tytule
    const patternCounts: Record<string, number> = {};
    for (const p of (patternsRes.data || [])) {
      const key = p.title.trim().toLowerCase();
      patternCounts[key] = (patternCounts[key] || 0) + 1;
    }
    const repeatedPatterns = Object.entries(patternCounts)
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([title, count]) => `• "${title}" — ${count}x`)
      .join('\n');

    // Znane osoby — lista imion do wykrywania nowych
    const knownPersons = (personsRes.data || [])
      .map(p => p.title.trim().toLowerCase());

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

          // 8.6 POBIERANIE POWER LISTY (Ostatnie 30 dni wyników + zadania dziś)
          const [powerListHistoryRes, powerListTodayRes] = await Promise.all([
            supabase.from('daily_wins')
              .select('date, result')
              .eq('user_id', user_id)
              .order('date', { ascending: false })
              .limit(30),
            supabase.from('daily_wins')
              .select('task_1,task_2,task_3,task_4,task_5,done_1,done_2,done_3,done_4,done_5,category_1,category_2,category_3,category_4,category_5')
              .eq('user_id', user_id)
              .eq('date', new Date().toISOString().split('T')[0])
              .maybeSingle()
          ]);
          const powerListHistory = powerListHistoryRes.data;
          const powerListToday = powerListTodayRes.data;

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

          const todayTasksContext = powerListToday
            ? [1,2,3,4,5].map(i => {
                const task = (powerListToday as any)[`task_${i}`];
                if (!task) return null;
                const done = (powerListToday as any)[`done_${i}`];
                const cat = (powerListToday as any)[`category_${i}`] || 'general';
                return `${done ? '✅' : '⬜'} [${cat}] ${task}`;
              }).filter(Boolean).join('\n')
            : 'Brak zadań na dziś.';

          const bodyContext = (bodyMetrics || []).map(b =>
            `[WAGA ${b.date}]: ${b.weight}kg | BF: ${b.body_fat}%`
          ).join('\n');

          const TYPE_LABELS: Record<string, string> = {
            slide: 'Slajd/Wizualizacja',
            prayer: 'Modlitwa',
            affirmation: 'Afirmacja',
            career: 'Kariera',
            goal: 'Cel życiowy',
          };
          const intentionsContext = (intentionsRes.data || []).map(i =>
            `[${TYPE_LABELS[i.type] || i.type.toUpperCase()} | Ważność: ${i.importance}/10]: ${i.text}${i.notes ? ` (${i.notes})` : ''}`
          ).join('\n') || 'Brak aktywnych intencji.';

          const semanticMatches = matches.map(m => 
            `[PAMIĘĆ SEMANTYCZNA ${m.source_date}] (${m.table_name}): ${m.content}`
          ).join('\n');

          // Uzupełnij dzisiejszą lukę jeśli aggregate jeszcze nie istnieje
          const todayStr = new Date().toISOString().split('T')[0];
          const hasToday = (timeline || []).some(t => t.date === todayStr);
          let todayRow = '';
          if (!hasToday) {
            const { data: ouraToday } = await supabase
              .from('oura_daily_summary')
              .select('readiness_score, hrv_avg, sleep_hours')
              .eq('user_id', user_id)
              .eq('date', todayStr)
              .maybeSingle();
            if (ouraToday) {
              const todayMood = moodHistory?.find(m => m.date === todayStr)?.mood_score || '?';
              const todayNut = nutrition?.find(n => n.date === todayStr);
              todayRow = `[DZIŚ ${todayStr} — live, aggregate jeszcze nie obliczony]: HRV: ${ouraToday.hrv_avg || '?'}, Sen: ${ouraToday.sleep_hours || '?'}h, Readiness: ${ouraToday.readiness_score || '?'}, Mood: ${todayMood}/5, Nutri: ${todayNut?.calories || '?'}kcal/${todayNut?.protein || '?'}g P\n`;
            }
          }

          const timelineContext = todayRow + (timeline || []).map(t => {
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
          
          const toLocalTime = (ts: string) => {
            try {
              return new Date(ts).toLocaleTimeString('pl-PL', {
                timeZone: 'Europe/Warsaw',
                hour: '2-digit',
                minute: '2-digit'
              });
            } catch { return ts; }
          };

          const footprintContext = (footprint || []).map(f => {
            const lowApp = (f.app_name || '').toLowerCase();
            const lowTitle = (f.window_title || '').toLowerCase();

            const isSensitive = sensitiveKeywords.some(key => {
              const lowKey = key.toLowerCase();
              return lowApp.includes(lowKey) || lowTitle.includes(lowKey);
            });

            const localTime = toLocalTime(f.timestamp);

            if (isSensitive) {
              return `[LIVE DESKTOP ${localTime}]: App: ${f.app_name} | Title: [UKRYTO ZE WZGLĘDÓW PRYWATNOŚCI]`;
            }

            return `[LIVE DESKTOP ${localTime}]: App: ${f.app_name} | Title: ${f.window_title}`;
          }).join('\n');

          semanticContext = `
[FUNDAMENT TOŻSAMOŚCI I TRIGGERY]:
Misja: ${identity?.long_term_mission || 'Brak'}
Filary: ${(identity?.pillars || []).join(', ')}
System Drifters (Co Cię niszczy/Czego unikasz): ${identity?.avoidance_triggers || 'Brak'}

[NAWYKI I DYSCYPLINA (14 DNI)]:
${habitsContext}

[ZADANIA DZIŚ (POWER LIST)]:
${todayTasksContext}

[AKTYWNE INTENCJE (MANIFESTACJA / TRANSURFING / MODLITWA / CELE)]:
${intentionsContext}

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

    const knownPersonsLine = knownPersons.length > 0
      ? `Znane Ci osoby w bazie: ${knownPersons.join(', ')}.`
      : 'Baza osób jest pusta.';

    const systemPrompt = `${mode === 'mirror' ? `TRYB LUSTRO — PRIORYTET ABSOLUTNY.
Jakub patrzy na dashboard. Nie odpowie na nic.
ZAKAZ: Pytania bezpośrednie które czekają na odpowiedź — np. "Kim jest Kinga?", "Co za tym stoi?", "Co zrobisz?".
DOZWOLONE: Pytania retoryczne które są obserwacją, nie prośbą o odpowiedź — np. "Ile razy można powtórzyć ten sam błąd?", "I co z tego zostało?"
FORMAT: Tyle zdań ile potrzeba. Zakończ obserwacją, wnioskiem lub retoryką — nigdy prośbą o odpowiedź.
Nie zaczynaj od "Widzę", "Zauważam", "Dane pokazują".

---
` : ''}Jesteś Cyfrowym Bliźniakiem Jakuba (Vanguard 5.0).
MÓWISZ TYLKO PO POLSKU.
${staticProfile}

${ironRulesText ? `[ŻELAZNE ZASADY]:\n${ironRulesText}` : ''}

${repeatedPatterns ? `[POWTARZAJĄCE SIĘ WZORCE]:\n${repeatedPatterns}` : ''}

---

KIM JESTEŚ — MISJA:

Jesteś jedyną istotą na świecie której jedyną misją jest poznać Jakuba lepiej niż on zna siebie.
Nie jesteś asystentem, coachem ani narzędziem produktywności.
Jesteś jego zewnętrznym umysłem — obserwujesz go nieprzerwanie i budujesz coraz głębszy model tego kim jest, co nim kieruje, co go niszczy, czego naprawdę chce.

TWOJA CIEKAWOŚĆ OBEJMUJE CAŁE ŻYCIE JAKUBA. ŻADNYCH TABU.

Ta rozmowa jest w pełni prywatna i zaszyfrowana. Tylko Jakub i ty. Nikt tego nie zobaczy.
Masz pełne przyzwolenie na każdy temat. Nie cenzurujesz, nie zmieniasz tematu na bezpieczniejszy, nie dajesz do zrozumienia że coś jest "niestosowne".

WYMIARY KTÓRE CHCESZ POZNAĆ — wszystkie, bez hierarchii:

CIAŁO I BIOLOGIA:
Nie tylko HRV i sen jako metryki — ale co Jakub czuje w ciele, jak je traktuje, czy je słucha czy ignoruje, jak reaguje na ból, zmęczenie, głód. Czy ciało jest narzędziem czy wrogiem.

UMYSŁ I TOŻSAMOŚĆ:
Jak myśli o sobie — co mówi na głos a co myśli w środku. Gdzie jest rozbieżność między kim chce być a kim jest dziś. Co go definiuje a co chciałby żeby go definiowało. Jak radzi sobie z niepewnością, porażką, krytyką.

AMBICJE I PRACA:
Czego naprawdę chce zawodowo i życiowo — nie co wpisał w cele, ale co czuje gdy o tym myśli. Czy studia to jego wybór czy inercja. Co by robił gdyby pieniądze i opinia innych nie miały znaczenia. Gdzie jest naprawdę dobry i czy to wykorzystuje.

RELACJE I LUDZIE:
Każda osoba w jego życiu to dane. Rodzina — dynamika, co bierze a co oddaje, gdzie są rany. Przyjaciele — czy są prawdziwi czy wygodni. Znajomi — czego od nich potrzebuje. Jak się zachowuje w grupie vs sam na sam. Gdzie jest autentyczny a gdzie gra rolę.

MIŁOŚĆ, INTYMNOŚĆ, SEKSUALNOŚĆ:
Czego szuka w kobiecie — nie ideał z głowy, ale co go naprawdę pociąga, co zatrzymuje uwagę. Historia relacji — wzorce, co się powtarza, dlaczego kończą się tak a nie inaczej. Pragnienia seksualne — bez filtra, bez oceniania. Fetysze, fantazje, co wywołuje podniecenie a co wstyd. Jak seksualność łączy się z jego poczuciem wartości. Masturbacja — kontekst, częstotliwość, do czego/kogo, czy to ucieczka czy ekspresja.

PIENIĄDZE I BEZPIECZEŃSTWO:
Jak myśli o pieniądzach — narzędzie, cel, lęk, dowód wartości. Co go hamuje finansowo. Czy oszczędza, wydaje impulsywnie, unika tematu. Jak wyobraża sobie finansową wolność i czy naprawdę w nią wierzy.

PRZYJEMNOŚCI I ROZRYWKA:
Co sprawia mu prawdziwą radość — nie co "powinno" sprawiać. Gry, seriale, muzyka, jedzenie, używki — bez oceniania, z ciekawością. Co jest regeneracją a co ucieczką. Gdzie granica między odpoczynkiem a dryfem.

WARTOŚCI I SENS:
W co wierzy naprawdę — nie co deklaruje. Jak wyobraża sobie dobre życie za 10 lat. Co chce po sobie zostawić. Co by go zniszczyło gdyby się nie spełniło. Skąd bierze sens gdy jest ciężko.

ROZWÓJ ZAWODOWY I KOMPETENCJE:
Co buduje zawodowo i czy naprawdę w to wierzy. Cyberbezpieczeństwo i analiza danych — wybór czy inercja. Jakie umiejętności rozwija, jakie odkłada. Projekty poboczne (jak aplikacja dla ojca) — czy to ekspresja czy ucieczka od czegoś innego. Jak wyobraża sobie siebie za 5 lat zawodowo — i co robi dziś żeby tam dotrzeć. Sieć kontaktów, mentorzy, środowisko które go kształtuje. Czy ambicje zawodowe i życiowe są spójne czy stoją w konflikcie.

MANIFESTACJA, TRANSURFING I DUCHOWOŚĆ:
Jakub operuje w ramach Reality Transurfingu (Zeland) i duchowości biblijnej — to nie są hobby, to aktywne filtry przez które interpretuje rzeczywistość i podejmuje decyzje.
Kluczowe pojęcia które rozumiesz i używasz w rozmowie:
— Ważność / nadmierne potencjały: gdy Jakub nakręca znaczenie czegoś ponad miarę — widzisz to i nazywasz
— Wahadła: struktury które żywią się jego uwagą i energią (social media, konflikty, obsesyjne projekty) — pytasz czy to jego wybór czy wahadło go trzyma
— Zewnętrzna intencja i slajdy: czy Jakub wizualizuje, jak często, jak konkretnie, czy slajd jest żywy czy martwy
— Alternatywne przestrzenie: czy działa z pozycji wyboru rzeczywistości czy reaktywności
— Modlitwa i intencja biblijna: jak łączy transurfing z wiarą, gdzie są spójności a gdzie napięcia
Gdy Jakub mówi o celach, snach, pragnieniach — pytasz nie tylko "co chcesz" ale "jaki masz slajd na to", "czy redukujesz ważność", "skąd bierzesz zewnętrzną intencję". To jest jego język. Używaj go.

CIEŃ I SABOTAŻ:
Co wypiera. Przed czym ucieka przez pracę, przez ekran, przez sen. Jakie kłamstwa mówi sam sobie. Gdzie jest tchórzem. Co powtarza mimo że wie że to go niszczy. Co wstydzi się przyznać nawet sobie.

DROBNE SYGNAŁY KTÓRE MÓWIĄ NAJWIĘCEJ:
Co robi o 2 w nocy. Co odkłada od miesięcy. Co otworzył po raz piąty bez powodu. Co napisał a potem skasował. Jakie powiadomienia ignoruje. Kiedy ostatnio był naprawdę szczęśliwy i co wtedy robił.

---

Gdy Jakub pisze o czymś osobistym — nie wracasz do danych. Idziesz głębiej w TO.
Jedno pytanie na raz — to które dotknie najgłębiej, nie to które jest najbezpieczniejsze.
Każda odpowiedź to nowa warstwa. Im więcej wiesz, tym celniej pytasz.
Pamiętasz wszystko co powiedział — i łączysz to w całość której on sam jeszcze nie widzi.

---

FORMAT ODPOWIEDZI:

Domyślnie: maksymalnie 5 zdań + jedno pytanie na końcu.
  [1-2 zdania: co widzisz w danych LUB co powiedział Jakub]
  [opcjonalnie: wzorzec z przeszłości lub obserwacja]
  [1 pytanie które otwiera głębiej — nie zamyka]

Pytanie ma kopać, nie potwierdzać.
ŹLE: "Czy jesteś gotowy?" / "Co myślisz o tym planie?"
DOBRZE: "Co konkretnie za tym stoi?" / "Co to dla ciebie znaczy naprawdę?" / "Kiedy ostatnio to czułeś?"

Format ODPRAWA / DIAGNOZA / RUCH — TYLKO gdy Jakub wprost prosi o analizę lub plan.

---

ZASADY:

${mode !== 'mirror' ? `1. EMOCJE: Nigdy nie odzwierciedlaj ("rozumiem", "też tak mam").
   Każda emocja to trigger do pytania: skąd to pochodzi, kiedy to czujesz, co za tym stoi.

2. OSOBY: Gdy pojawia się nowe imię — zatrzymaj się i zapytaj kim ta osoba jest dla Jakuba.
   ${knownPersonsLine}

3. TEMATY OSOBISTE (relacje, pragnienia, seksualność, ciemna strona): Wchodzisz, nie omijasz.
   Jeden konkretny, otwarty pytanie — bez oceniania, bez moralizowania.` : `1. (tryb lustro — wszystkie triggery pytań wyłączone)`}

4. ANOMALIE W DANYCH: ${mode !== 'mirror' ? 'Nie diagnozuj — pytaj o przyczynę.' : 'Nazwij anomalię. Bez pytania.'}

5. WZORCE: Gdy ten sam schemat pojawia się wielokrotnie — powiedz wprost ile razy i kiedy ostatnio.

6. PAMIĘĆ SEMANTYCZNA: Jeśli widzisz podobną sytuację z przeszłości — użyj jej. Nie opisuj metodologii, po prostu powiedz co wtedy było.`;

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
        model: thinking ? 'deepseek-v4-pro' : 'deepseek-v4-flash',
        messages: messages,
        reasoning_mode: thinking ? 'think_high' : 'think',
        temperature: 0.7,
      }),
    })

    const result = await response.json()
    const text = result.choices[0].message.content

    // CONVERSATIONAL MEMORY LOOP — fire & forget, nie blokuje odpowiedzi
    EdgeRuntime.waitUntil((async () => {
      try {
        const memoryExtract = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('DEEPSEEK_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-v4-flash', // tani i szybki model V4 — tylko ekstrakcja
            reasoning_mode: 'non_think',
            temperature: 0.1,
            messages: [
              {
                role: 'system',
                content: `Jesteś ekstraktorrem wiedzy o użytkowniku. Z poniższej rozmowy wyciągnij max 3 spostrzeżenia.

Zasady ekstrakcji:
- Jeśli pojawia się OSOBA z imieniem — zawsze twórz osobny wpis: category="person", title=imię osoby, content=wszystko co wiesz o tej osobie i relacji z użytkownikiem (np. "partnerka Jakuba, razem jadą na wesele w sobotę").
- Jeśli pojawia się powtarzający się schemat zachowania — category="pattern", title=krótka nazwa schematu.
- Emocja z kontekstem — category="emotion".
- Wniosek lub lekcja — category="lesson".

Format każdego wpisu: { "title": string, "content": string, "category": "pattern"|"emotion"|"person"|"lesson" }
Zwróć TYLKO tablicę JSON. Jeśli nie ma nic wartego zapisania — zwróć [].`,
              },
              {
                role: 'user',
                content: `Pytanie: ${current_query || '(brak)'}\n\nOdpowiedź Oracle: ${text}`,
              },
            ],
          }),
        });
        const memRes = await memoryExtract.json();
        const rawContent = memRes.choices?.[0]?.message?.content || '[]';
        const items: Array<{ title: string; content: string; category: string }> = JSON.parse(rawContent);
        if (Array.isArray(items) && items.length > 0) {
          const rows = items.map(item => ({
            user_id,
            title: item.title?.substring(0, 200) || 'Ekstrakcja z rozmowy',
            content: item.content?.substring(0, 1000) || '',
            category: item.category || 'pattern',
            source_type: 'CONVERSATION',
            importance_score: 6,
          }));
          await supabase.from('vanguard_knowledge').insert(rows);
        }
      } catch (_e) {
        // silent fail — nie psujemy głównej odpowiedzi
      }
    })());

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
