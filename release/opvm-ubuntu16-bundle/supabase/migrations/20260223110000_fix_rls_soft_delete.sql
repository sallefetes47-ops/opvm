-- Fix RLS policies to allow soft delete (is_deleted update) for all authenticated users
-- The problem: updating is_deleted=true violates the "view active files" SELECT policy
-- because the updated row no longer satisfies is_deleted=false

-- Fix: Add WITH CHECK to allow update regardless of is_deleted value
-- Admins: can update any file
DROP POLICY IF EXISTS "Admins can update all files" ON public.files;
CREATE POLICY "Admins can update all files"
ON public.files
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Employees: can update files they created (including soft delete)
DROP POLICY IF EXISTS "Users can update their own files" ON public.files;
CREATE POLICY "Users can update their own files"
ON public.files
FOR UPDATE
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Also fix SELECT policy to allow authenticated users to see their own deleted files
-- (so the UI can reflect state properly after mutation)
DROP POLICY IF EXISTS "Authenticated users can view active files" ON public.files;
CREATE POLICY "Authenticated users can view active files"
ON public.files
FOR SELECT
USING (
  is_deleted = false
  OR has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
);

-- Drop the redundant admin-only deleted files policy (merged into above)
DROP POLICY IF EXISTS "Admins can view deleted files" ON public.files;
