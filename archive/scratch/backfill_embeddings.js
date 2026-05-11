/**
 * VANGUARD BACKFILL: EMBEDDINGS
 * Ten skrypt przechodzi przez wszystkie historyczne wpisy tekstowe i generuje dla nich embeddingi OpenAI.
 */

import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

const SUPABASE_URL = 'https://pdvqkgfsqziqlhptatgf.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkdnFrZ2ZzcXppcWxocHRhdGdmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM4NDQ3OCwiZXhwIjoyMDkyOTYwNDc4fQ.lmEaTT7CmrMtdsM9EMyPY6HU8ZnDWYKQSYTr-mGkbTA'; // Musisz to podać ręcznie lub w env
const OPENAI_API_KEY = 'sk-placeholder-do-not-push-secrets';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function getEmbedding(text) {
    if (!text || text.trim() === '') return null;

    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: text.replace(/\n/g, ' '),
        }),
    });

    const result = await response.json();
    if (result.error) {
        console.error('OpenAI Error:', result.error);
        return null;
    }
    return result.data[0].embedding;
}

async function backfillTable(tableName, textColumns, idColumn = 'id') {
    console.log(`\n--- Backfilling ${tableName} ---`);

    const { data: records, error } = await supabase
        .from(tableName)
        .select(`*`)
        .is('embedding', null);

    if (error) {
        console.error(`Error fetching ${tableName}:`, error);
        return;
    }

    console.log(`Found ${records.length} records to process.`);

    for (const record of records) {
        const combinedText = textColumns
            .map(col => record[col])
            .filter(val => val && val.trim() !== '')
            .join(' | ');

        let text = combinedText;

        if (tableName === 'daily_wins') {
            const journal = record.journal_entry || '';
            const gratitude = record.gratitude_entry || '';
            
            if (journal.trim() || gratitude.trim()) {
                text = `Dziennik: ${journal}\n\nWdzięczność: ${gratitude}`;
            } else {
                // Syntetyczny opis dla dni bez notatek
                const tasks = [1,2,3,4,5]
                    .map(i => record[`task_${i}`])
                    .filter(Boolean)
                    .join(', ');
                text = `Dzień: ${record.date}. Status: ${record.result === 'Z' ? 'WYGRANY' : 'PRZEGRANY'}. Zadania: ${tasks}. Nastrój: ${record.mood_score || 'brak'}/5.`;
                console.log(`[Synthetic] ID: ${record.id}`);
            }
        }

        if (!text) continue;

        console.log(`Processing ${tableName} ID: ${record[idColumn]}...`);
        const embedding = await getEmbedding(text);

        if (embedding) {
            const { error: updateError } = await supabase
                .from(tableName)
                .update({ embedding })
                .eq(idColumn, record[idColumn]);

            if (updateError) {
                console.error(`Error updating ${tableName} ${record[idColumn]}:`, updateError);
            } else {
                console.log(`✅ Success`);
            }
        }

        // Rate limiting avoidance
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

async function runBackfill() {
    console.log('🚀 Rozpoczynam backfill embeddingów...');

    // 1. Knowledge
    await backfillTable('vanguard_knowledge', ['title', 'content']);

    // 2. Journal (daily_wins)
    await backfillTable('daily_wins', ['journal_entry', 'gratitude_entry']);

    // 3. Weekly Reviews
    await backfillTable('weekly_reviews', ['proud_of', 'sabotage', 'do_differently']);

    // 4. Fundament
    await backfillTable('user_fundament', ['identity', 'philosophy', 'vision', 'finances', 'knowledge', 'relationships'], 'user_id');

    // 5. Workout Sessions
    await backfillTable('workout_sessions', ['session_notes']);

    // 6. Vanguard Stream
    await backfillTable('vanguard_stream', ['content']);

    console.log('\n✨ Backfill zakończony!');
}

runBackfill();
