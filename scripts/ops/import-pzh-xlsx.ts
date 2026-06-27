import { createClient } from 'npm:@supabase/supabase-js@2'
import * as XLSX from 'npm:xlsx@0.18.5'
import { dotenv } from 'https://deno.land/x/dotenv@v3.2.2/mod.ts'

// Wczytaj zmienne środowiskowe z .env
const config = dotenv()
const supabaseUrl = config.SUPABASE_URL || Deno.env.get('SUPABASE_URL') || ''
const supabaseKey = config.SUPABASE_SERVICE_ROLE_KEY || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

if (!supabaseUrl || !supabaseKey) {
  console.error('Błąd: Brak SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY w pliku .env')
  Deno.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function importPzhXlsx() {
  const filePath = './scripts/ops/pzh.xlsx'
  try {
    const fileBytes = await Deno.readFile(filePath)
    const workbook = XLSX.read(fileBytes, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(worksheet) as any[]

    console.log(`Znaleziono ${rows.length} wierszy w pliku Excel. Rozpoczynam import...`)

    const batch: any[] = []
    for (const row of rows) {
      // Mapowanie kolumn z Excela na bazę danych.
      // Oczekujemy standardowej struktury PZH, np.:
      // "Nazwa produktu", "Energia (kcal)", "Białko (g)", "Węglowodany (g)", "Tłuszcz (g)", "Błonnik (g)", "Cukry (g)"
      // Dopasuj nazwy kluczy do nagłówków z pliku użytkownika.
      const name = row['Nazwa produktu'] || row['Nazwa'] || row['Product name']
      if (!name) continue

      const calories = parseInt(row['Energia (kcal)'] || row['Energia'] || row['Calories'] || 0, 10)
      const protein = parseFloat(row['Białko (g)'] || row['Białko'] || row['Protein'] || 0)
      const carbs = parseFloat(row['Węglowodany (g)'] || row['Węglowodany'] || row['Carbs'] || 0)
      const fat = parseFloat(row['Tłuszcz (g)'] || row['Tłuszcz'] || row['Fat'] || 0)
      const fiber = row['Błonnik (g)'] || row['Błonnik'] || row['Fiber'] ? parseFloat(row['Błonnik (g)'] || row['Błonnik'] || row['Fiber']) : null
      const sugar = row['Cukry (g)'] || row['Cukry'] || row['Sugar'] ? parseFloat(row['Cukry (g)'] || row['Cukry'] || row['Sugar']) : null

      batch.push({
        name: String(name).trim(),
        calories,
        protein,
        carbs,
        fat,
        fiber,
        sugar,
        source_label: 'PZH_Import'
      })

      if (batch.length >= 100) {
        await upsertBatch(batch)
        batch.length = 0
      }
    }

    if (batch.length > 0) {
      await upsertBatch(batch)
    }

    console.log('Import zakończony sukcesem!')
  } catch (err) {
    console.error('Błąd podczas importu pliku PZH:', err.message)
    console.log('\nWskazówka: Upewnij się, że plik Excel znajduje się w "scripts/ops/pzh.xlsx" i zawiera nagłówki takie jak: "Nazwa produktu", "Energia (kcal)", "Białko (g)" itp.')
  }
}

async function upsertBatch(batch: any[]) {
  const { error } = await supabase
    .from('food_reference_pl')
    .upsert(batch, { onConflict: 'name' })

  if (error) {
    console.error('Błąd podczas zapisu paczki do Supabase:', error.message)
  } else {
    console.log(`Zaimportowano paczkę ${batch.length} produktów...`)
  }
}

importPzhXlsx()
