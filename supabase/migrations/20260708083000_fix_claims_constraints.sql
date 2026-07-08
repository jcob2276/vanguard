-- ============================================================
-- VANGUARD OS — DAY 3.5: FIX CLAIMS CONSTRAINTS
-- ============================================================

-- 1. Update claims status check constraint
ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_status_check;
ALTER TABLE public.claims ADD CONSTRAINT claims_status_check CHECK (status IN ('active', 'deprecated', 'historical', 'disputed'));

-- 2. Update claims superseded_by foreign key to ON UPDATE CASCADE
ALTER TABLE public.claims DROP CONSTRAINT IF EXISTS claims_superseded_by_fkey;
ALTER TABLE public.claims ADD CONSTRAINT claims_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.claims(id) ON UPDATE CASCADE ON DELETE SET NULL;
