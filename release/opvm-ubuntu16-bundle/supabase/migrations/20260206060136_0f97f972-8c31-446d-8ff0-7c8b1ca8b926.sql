-- Add soft delete support to files table for Trash Bin feature
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;

-- Create index for faster deleted file queries
CREATE INDEX IF NOT EXISTS idx_files_is_deleted ON public.files(is_deleted);

-- Update RLS policies to exclude deleted files by default for regular queries
-- But allow admins to see deleted files for trash bin

-- Drop existing policies first
DROP POLICY IF EXISTS "Authenticated users can view all files" ON public.files;

-- Create new policy that excludes deleted files for regular view
CREATE POLICY "Authenticated users can view active files" 
ON public.files 
FOR SELECT 
USING (is_deleted = false);

-- Create policy for admins to view deleted files (for trash bin)
CREATE POLICY "Admins can view deleted files" 
ON public.files 
FOR SELECT 
USING (is_deleted = true AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update is_deleted field (for soft delete and restore)
DROP POLICY IF EXISTS "Admins can update all files" ON public.files;
CREATE POLICY "Admins can update all files" 
ON public.files 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow employees to soft delete their own files
DROP POLICY IF EXISTS "Users can update their own files" ON public.files;
CREATE POLICY "Users can update their own files" 
ON public.files 
FOR UPDATE 
USING (created_by = auth.uid());