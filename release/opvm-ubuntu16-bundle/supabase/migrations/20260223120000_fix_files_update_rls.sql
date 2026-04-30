-- Fix RLS UPDATE policies for files table
-- Problem: "new row violates row-level security policy for table files"
-- Root cause: When created_by IS NULL, the WITH CHECK (created_by = auth.uid())
-- evaluates to NULL (not TRUE), causing the policy check to fail.
-- Also fixes the case where admins need to soft-delete any file.

-- Drop all existing UPDATE policies on files
DROP POLICY IF EXISTS "Admins can update all files" ON public.files;
DROP POLICY IF EXISTS "Users can update their own files" ON public.files;

-- Recreate admin UPDATE policy: admins can update ANY file
CREATE POLICY "Admins can update all files"
ON public.files
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Recreate employee UPDATE policy:
-- USING: can update rows they created (before update)
-- WITH CHECK: after update, row still belongs to them OR created_by is NULL (legacy data)
CREATE POLICY "Users can update their own files"
ON public.files
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR created_by IS NULL)
WITH CHECK (
  created_by = auth.uid()
  OR created_by IS NULL
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Fix SELECT policy to allow users to see their own deleted files
-- (needed so the UI can reflect state after soft-delete mutation)
DROP POLICY IF EXISTS "Authenticated users can view active files" ON public.files;
DROP POLICY IF EXISTS "Admins can view deleted files" ON public.files;

CREATE POLICY "Authenticated users can view files"
ON public.files
FOR SELECT
TO authenticated
USING (
  is_deleted = false
  OR has_role(auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
);
