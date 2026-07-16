-- Expand municipality enum values and standardize names
-- Target: غرداية، العطف، بنورة، الضاية، متليلي

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'municipality'
      AND e.enumlabel = 'بونورة'
  ) THEN
    ALTER TYPE public.municipality RENAME VALUE 'بونورة' TO 'بنورة';
  END IF;
END $$;

ALTER TYPE public.municipality ADD VALUE IF NOT EXISTS 'الضاية';
ALTER TYPE public.municipality ADD VALUE IF NOT EXISTS 'متليلي';

