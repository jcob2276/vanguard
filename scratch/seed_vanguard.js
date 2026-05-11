/**
 * VANGUARD HISTORY SEEDER
 * Odpala funkcję save-daily-aggregate dla ostatnich 7 dni.
 */
const fetch = require('node-fetch');

const SUPABASE_URL = 'https://pdvqkgfsqziqlhptatgf.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdnFrZ2ZzcXppcWxocHRhdGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQ0NzgsImV4cCI6MjA5Mjk2MDQ3OH0.vM69FS8w1K3N_eJjD7LLYxi59T2xCnMH1STEsAICyqU';
const USER_ID = '165ae341-670c-46ce-82dc-434c4dbfcdfd';

async function seed() {
  console.log('🚀 Rozpoczynam seedowanie historii Vanguarda (7 dni)...');
  
  for (let i = 7; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    console.log(`[${dateStr}] Agregowanie danych...`);
    
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/save-daily-aggregate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`
        },
        body: JSON.stringify({
          userId: USER_ID,
          date: dateStr
        })
      });
      
      const data = await res.json();
      if (data.success) {
        console.log(`✅ Sukces: Stan=${data.state}, Score=${data.identity_score}`);
      } else {
        console.log(`⚠️  Błąd dla ${dateStr}: ${data.error || 'Nieznany błąd'}`);
      }
    } catch (e) {
      console.log(`❌ Krytyczny błąd dla ${dateStr}: ${e.message}`);
    }
  }
  
  console.log('✨ Seedowanie zakończone. Możesz teraz odświeżyć Mirror Mode!');
}

seed();
