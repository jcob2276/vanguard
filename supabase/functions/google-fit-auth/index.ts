import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createServiceClient, corsHeaders } from '../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    return new Response(`Błąd autoryzacji Google: ${error}`, { status: 400 })
  }

  if (!code) {
    return new Response('Brak kodu autoryzacji', { status: 400 })
  }

  try {
    const supabaseClient = createServiceClient()

    // 1. Get credentials from any user (we assume the first one with client_id for simplicity in this setup, 
    // or we could pass a state with user_id)
    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('google_fit_client_id, google_fit_client_secret, user_id')
      .not('google_fit_client_id', 'is', null)
      .limit(1)
      .single()

    if (settingsError || !settings) {
      return new Response('Nie znaleziono konfiguracji Google Fit w bazie danych.', { status: 500 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    if (!supabaseUrl) {
      return new Response('SUPABASE_URL is required for Google Fit auth.', { status: 500 })
    }
    const redirectUri = `${supabaseUrl}/functions/v1/google-fit-auth`

    // 2. Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: settings.google_fit_client_id,
        client_secret: settings.google_fit_client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokens = await tokenResponse.json()

    if (tokens.error) {
      return new Response(`Błąd Google Token: ${tokens.error_description || tokens.error}`, { status: 400 })
    }

    // 3. Save refresh token to user_settings
    const { error: updateError } = await supabaseClient
      .from('user_settings')
      .update({ google_fit_refresh_token: tokens.refresh_token })
      .eq('user_id', settings.user_id)

    if (updateError) {
      throw updateError
    }

    // 4. Redirect back to app (assuming it's running locally or on a standard port)
    // We try to guess the origin or just show a nice message
    return new Response(`
      <html>
        <body style="background: #0a0a0a; color: white; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0;">
          <div style="border: 1px solid #3b82f6; padding: 40px; border-radius: 20px; text-align: center; background: rgba(59,130,246,0.05);">
            <h1 style="color: #3b82f6; text-transform: uppercase; letter-spacing: 2px;">Sukces!</h1>
            <p>Twoje konto Google Fit zostało połączone.</p>
            <p style="font-size: 12px; color: #525252;">Możesz teraz wrócić do aplikacji i odświeżyć stronę.</p>
            <button onclick="window.close()" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; font-weight: bold; margin-top: 20px;">ZAMKNIJ OKNO</button>
          </div>
        </body>
      </html>
    `, { headers: { ...corsHeaders, 'Content-Type': 'text/html' } })

  } catch (err) {
    return new Response(`Błąd serwera: ${err.message}`, { status: 500 })
  }
})
