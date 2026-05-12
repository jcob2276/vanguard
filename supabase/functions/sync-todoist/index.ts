import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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

    const { userId } = await req.json()
    if (!userId) throw new Error('Missing userId')

    // 1. Pobierz token Todoist
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('todoist_token')
      .eq('user_id', userId)
      .single()

    if (settingsError || !settings?.todoist_token) throw new Error('Token Todoist nie został skonfigurowany w ustawieniach.')

    const token = settings.todoist_token

    // 2. Pobierz aktywne zadania z Todoist
    const response = await fetch('https://api.todoist.com/api/v1/tasks', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Todoist API error (${response.status}): ${errText}`);
    }
    const body = await response.json()
    const tasks: any[] = Array.isArray(body) ? body : (body.results ?? body.items ?? [])

    console.log(`[TODOIST SYNC] Found ${tasks.length} tasks for user ${userId}`);

    // 3. Synchronizacja do vanguard_stream
    let syncedCount = 0;
    for (const task of tasks) {
      const content = `${task.content}\n${task.description || ''}`.trim();
      const todoistId = task.id;
      
      // Sprawdź czy już istnieje w strumieniu (szukamy po todoist_id w metadanych)
      const { data: existing } = await supabase
        .from('vanguard_stream')
        .select('id, content')
        .eq('metadata->>todoist_id', todoistId)
        .maybeSingle();

      if (existing) {
        // Jeśli treść się zmieniła, aktualizujemy (i regenerujemy embedding)
        if (existing.content !== content) {
          console.log(`[TODOIST SYNC] Updating task ${todoistId}`);
          const embedding = await generateEmbedding(content);
          await supabase
            .from('vanguard_stream')
            .update({ 
              content, 
              embedding,
              metadata: { ...task, todoist_id: todoistId, synced_at: new Date().toISOString() } 
            })
            .eq('id', existing.id);
          syncedCount++;
        }
      } else {
        // Nowe zadanie
        console.log(`[TODOIST SYNC] Inserting new task ${todoistId}`);
        const embedding = await generateEmbedding(content);
        await supabase
          .from('vanguard_stream')
          .insert({
            user_id: userId,
            source: 'todoist',
            content,
            embedding,
            classification: 'idea', // Brainstorming = idea
            metadata: { ...task, todoist_id: todoistId, synced_at: new Date().toISOString() }
          });
        syncedCount++;
      }
    }

    return new Response(JSON.stringify({ success: true, total: tasks.length, synced: syncedCount }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (error: any) {
    console.error(`[TODOIST SYNC ERROR] ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})

async function generateEmbedding(text: string) {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    console.warn('[TODOIST SYNC] No OPENAI_API_KEY found, skipping embedding');
    return null;
  }

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.replace(/\n/g, ' '),
      }),
    })
    
    if (!res.ok) {
        console.error(`[TODOIST SYNC] OpenAI Error: ${res.status}`);
        return null;
    }
    
    const data = await res.json()
    return data.data?.[0]?.embedding
  } catch (err) {
    console.error('[TODOIST SYNC] Embedding generation failed:', err)
    return null
  }
}
