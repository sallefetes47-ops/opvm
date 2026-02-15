-- Add optional location columns for map focus on permit location
ALTER TABLE public.files
  ADD COLUMN location_lat DOUBLE PRECISION,
  ADD COLUMN location_lng DOUBLE PRECISION;

-- Add a comment explaining the purpose
COMMENT ON COLUMN public.files.location_lat IS 'Optional latitude for focusing the permit location on the map';
COMMENT ON COLUMN public.files.location_lng IS 'Optional longitude for focusing the permit location on the map';
