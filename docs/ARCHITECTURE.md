# Vanguard OS — Architektura Systemu

## Mapa Tabel Bazy Danych

### 1. Rdzeń Behawioralny i Analityczny
*   `vanguard_daily_aggregates`: Dzienny snapshot stanu (biometria, egzekucja, stan). Kluczowy dla baseline i Pearsona.
*   `vanguard_correlations`: Wyniki analizy korelacji Pearsona dla sygnałów (cache korelacji).
*   `vanguard_temporal_links`: Powiązania czasowe między interwencjami a skutkami (Feedback Loop).
*   `vanguard_signatures`: Rozpoznane wzorce zachowań i ich przewidywane skutki.

### 2. Wiedza i Tożsamość (GraphRAG)
*   `vanguard_entity_links`: Graf wiedzy (triady: źródło, relacja, cel). Rdzeń GraphRAG.
*   `vanguard_relation_ontology`: Słownik 35 kanonicznych relacji (np. `jest`, `prowadzi_do`, `chce`).
*   `vanguard_entity_aliases`: Mapowanie synonimów encji na formy kanoniczne (np. `Kuba` -> `Jakub`).
*   `vanguard_knowledge`: Semantyczna baza wiedzy (wzorce, osoby, lekcje).
*   `user_fundament`: Statyczny profil tożsamości (filozofia, misja, wizja).

### 3. Strumienie Danych i Logi
*   `vanguard_stream`: Strumień myśli, notatek i idei (wejście z Telegrama/Głosu).
*   `vanguard_raw_events`: Niezmienne źródło surowych zdarzeń do późniejszego przetwarzania.
*   `vanguard_footprint`: Aktywność desktopowa (ActivityWatch) - live context dla Oracle.
*   `ai_chat_messages`: Historia rozmów z Oracle.
*   `vanguard_oracle_runs`: "Czarna Skrzynka" - audit log każdego zapytania do Oracle.

### 4. Dane Biometryczne i Treningowe
*   `oura_daily_summary`: Dane z pierścienia Oura (sen, HRV, readiness).
*   `stayfree_usage`: Statystyki użycia aplikacji mobilnych.
*   `daily_wins`: Power Lista (5 zadań), dziennik i nastrój.
*   `workout_sessions` & `exercise_logs`: Szczegółowe logi treningowe.
*   `daily_nutrition` & `daily_food_entries`: Dane żywieniowe z Yazio.

---

## Przepływ Danych (Input Streams)

### Wejście: Telegram (Vanguard-Telegram)
1.  **Wysłanie wiadomości**: Użytkownik pisze do bota na Telegramie.
2.  **Edge Function**: Bot przesyła tekst do funkcji `vanguard-telegram`.
3.  **Klasyfikacja**: System klasyfikuje wpis (np. `thought`, `idea`, `chaos`).
4.  **Zapis do Strumienia**: Wpis trafia do `vanguard_stream`.
5.  **Trigger (Architect)**: Automatyczny trigger odpala `vanguard-architect` dla nowego wpisu.
6.  **Ekstrakcja Triad**: LLM (DeepSeek) wyciąga triady relacji.
7.  **Graph Update**: Triady są zapisywane w `vanguard_entity_links` (po kanonizacji).

---

## Edge Functions

| Funkcja | Opis | Wejście | Wyjście |
|---|---|---|---|
| `vanguard-oracle` | Główny silnik rozumowania | `query`, `mode` (mirror/chat) | `answer`, `sources`, `claims` |
| `vanguard-architect` | Budowniczy grafu wiedzy | `type` (stream/knowledge), `offset`, `limit` | `triads_created`, `items_processed` |
| `save-daily-aggregate` | Tworzy snapshot dnia | `userId`, `date` | `status: success` |
| `refresh-vanguard-correlations` | Liczy korelacje sygnałów | `userId` | `correlations_updated` |
| `sync-oura` | Synchronizacja z API Oura | `userId` | `records_synced` |
| `vanguard-telegram` | Bramka dla bota Telegram | `message_text`, `chat_id` | `status: ok` |

---

## Harmonogram zadań (pg_cron)

| Zadanie | Harmonogram | Opis |
|---|---|---|
| `vanguard-daily-snapshot` | `0 4 * * *` (Codziennie 06:00) | Tworzy snapshot `vanguard_daily_aggregates` dla wszystkich użytkowników. |
| `vanguard-sunday-cleanup` | `0 5 * * 0` (Niedziela 05:00) | Scalanie synonimów w grafie i czyszczenie nieaktywnych linków. |
| `vanguard-analyst-loop` | `0 */6 * * *` (Co 6 godzin) | Uruchamia analityka do wykrywania nowych wzorców w danych surowych. |
| `vanguard-weekly-intentions` | `0 0 * * 1` (Poniedziałek 00:00) | Reset i archiwizacja tygodniowych intencji. |
| `vanguard-daily-analyst` | `0 3 * * *` (Codziennie 03:00) | Głęboka analiza dnia poprzedniego pod kątem korelacji. |
