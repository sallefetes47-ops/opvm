-- Create table for file study history (re-examination records)
CREATE TABLE public.file_studies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  study_date DATE NOT NULL DEFAULT CURRENT_DATE,
  permit_type TEXT,
  committee_opinion TEXT NOT NULL,
  rejection_reason TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.file_studies ENABLE ROW LEVEL SECURITY;

-- Policies for file_studies
CREATE POLICY "Authenticated users can view all studies" 
ON public.file_studies 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create studies" 
ON public.file_studies 
FOR INSERT 
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update studies" 
ON public.file_studies 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete studies" 
ON public.file_studies 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add index for faster lookups
CREATE INDEX idx_file_studies_file_id ON public.file_studies(file_id);
CREATE INDEX idx_file_studies_study_date ON public.file_studies(study_date DESC);