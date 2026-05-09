import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // 1. Pobierz wszystkich użytkowników (w tym przypadku głównie Jakub)
    const { data: users, error: usersError } = await supabaseClient
      .from('user_settings')
      .select('user_id')
    
    if (usersError) throw usersError

    for (const u of users) {
      const { data: { user }, error: authError } = await supabaseClient.auth.admin.getUserById(u.user_id)
      
      if (authError || !user?.email) continue

      // 2. Wyślij maila przypominającego
      if (RESEND_API_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Kuba Workout <onboarding@resend.dev>',
            to: user.email,
            subject: '🔥 PODSUMUJ DZIEŃ I ZAPLANUJ JUTRO',
            html: `
              <div style="background: black; color: white; padding: 40px; font-family: 'Courier New', Courier, monospace; border: 5px solid #3b82f6;">
                <h1 style="text-transform: uppercase; font-style: italic; font-size: 30px;">Dzień się kończy.</h1>
                <p style="color: #3b82f6; font-weight: bold; font-size: 18px;">GODZINA 20:30 - CZAS NA RAPORT</p>
                <hr style="border: 1px solid #262626;">
                <ul style="list-style: none; padding: 0;">
                  <li style="margin-bottom: 10px;">✅ Oznacz dzisiejszą Power Listę</li>
                  <li style="margin-bottom: 10px;">🎯 Zaplanuj 5 zwycięstw na jutro</li>
                  <li style="margin-bottom: 10px;">📓 Uzupełnij dziennik i wdzięczność</li>
                </ul>
                <div style="margin-top: 30px;">
                  <a href="https://pdvqkgfsqziqlhptatgf.supabase.co" style="background: #3b82f6; color: white; padding: 15px 25px; text-decoration: none; font-weight: bold; display: inline-block;">OTWÓRZ SYSTEM</a>
                </div>
              </div>
            `
          })
        })
      }
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500 
    })
  }
})
