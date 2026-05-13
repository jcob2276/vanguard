-- 1. Dodanie flagi weryfikacji do bazy wiedzy
ALTER TABLE vanguard_knowledge ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- 2. Tabela na feedback od użytkownika
CREATE TABLE IF NOT EXISTS vanguard_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    message_id TEXT, -- ID wiadomości z Telegrama
    query TEXT, -- Co zapytał Jakub
    reply TEXT, -- Co odpowiedział bot
    score INTEGER, -- 1 dla 👍, -1 dla 👎
    correction TEXT, -- Opcjonalna poprawka od Jakuba
    metadata JSONB, -- Dodatkowe dane (np. model, czas)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indeksy dla szybkości
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON vanguard_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON vanguard_feedback(message_id);

-- 3. Funkcja do automatycznego podbijania ważności zweryfikowanych wpisów
CREATE OR REPLACE FUNCTION verify_vanguard_knowledge()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_verified = true THEN
        NEW.importance_score = 10; -- Max ważność dla zweryfikowanych danych
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_verify_knowledge
BEFORE INSERT OR UPDATE ON vanguard_knowledge
FOR EACH ROW EXECUTE FUNCTION verify_vanguard_knowledge();
