-- Add new ownership type for Certificate of Assignment
ALTER TYPE public.ownership_type ADD VALUE IF NOT EXISTS 'شهادة إستفادة';

-- Add new columns for Certificate of Assignment fields
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS lot_number text,
ADD COLUMN IF NOT EXISTS subdivision_name text;

-- Update existing fields for subdivision permit if missing
-- plot_area already exists, add plots_count if not exists
-- plots_count already exists in the table