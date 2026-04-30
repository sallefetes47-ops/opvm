-- Allow employees to UPDATE any row in public.files (needed for shared office workflows)
-- and keep SELECT policy restrictive for deleted rows.
--
-- UI symptom:
--   "new row violates row-level security policy for table \"files\""
-- when trying to soft-delete (UPDATE is_deleted=true).
-- Causes:
--   1) UPDATE policy was too strict (created_by only) for employees managing shared files.
--   2) PostgREST returns updated rows by default; if SELECT policy doesn't allow the
--      updated row (is_deleted=true), the request can fail unless the client uses
--      returning: 'minimal'. We also fix the UPDATE policy here.

-- Drop prior UPDATE policies (names used across previous migrations)
DROP POLICY IF EXISTS "Admins can update all files" ON public.files;
DROP POLICY IF EXISTS "Users can update their own files" ON public.files;
DROP POLICY IF EXISTS "Employees can update all files" ON public.files;

-- Admins: can update ANY file
CREATE POLICY "Admins can update all files"
ON public.files
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Employees: can update ANY file (including soft delete)
CREATE POLICY "Employees can update all files"
ON public.files
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'employee'::app_role))
WITH CHECK (has_role(auth.uid(), 'employee'::app_role));

