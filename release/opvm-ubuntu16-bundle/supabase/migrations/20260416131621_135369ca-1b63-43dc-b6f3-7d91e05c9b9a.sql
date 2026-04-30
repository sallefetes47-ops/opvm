-- Fix: files table SELECT policy should only be for authenticated users, not public
DROP POLICY IF EXISTS "Authenticated users can view active files" ON public.files;
CREATE POLICY "Authenticated users can view active files"
ON public.files
FOR SELECT
TO authenticated
USING (is_deleted = false);

-- Fix: files INSERT policy should exclude viewers
DROP POLICY IF EXISTS "Users can create files" ON public.files;
CREATE POLICY "Non-viewers can create files"
ON public.files
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() AND NOT has_role(auth.uid(), 'viewer'::app_role));

-- Fix: file_studies INSERT policy should exclude viewers
DROP POLICY IF EXISTS "Users can create studies" ON public.file_studies;
CREATE POLICY "Non-viewers can create studies"
ON public.file_studies
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() AND NOT has_role(auth.uid(), 'viewer'::app_role));

-- Also fix files UPDATE policies that use 'public' role instead of 'authenticated'
DROP POLICY IF EXISTS "Admins can update all files" ON public.files;
CREATE POLICY "Admins can update all files"
ON public.files
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update their own files" ON public.files;
CREATE POLICY "Users can update their own files"
ON public.files
FOR UPDATE
TO authenticated
USING (created_by = auth.uid());

-- Fix file_studies policies that use 'public' role
DROP POLICY IF EXISTS "Authenticated users can view all studies" ON public.file_studies;
CREATE POLICY "Authenticated users can view all studies"
ON public.file_studies
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can update studies" ON public.file_studies;
CREATE POLICY "Admins can update studies"
ON public.file_studies
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete studies" ON public.file_studies;
CREATE POLICY "Admins can delete studies"
ON public.file_studies
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix: Admins can view deleted files should also be 'authenticated' only
DROP POLICY IF EXISTS "Admins can view deleted files" ON public.files;
CREATE POLICY "Admins can view deleted files"
ON public.files
FOR SELECT
TO authenticated
USING (is_deleted = true AND has_role(auth.uid(), 'admin'::app_role));