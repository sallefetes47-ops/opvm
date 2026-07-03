
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::app_role, 'employee'::app_role)
  )
$$;

DROP POLICY IF EXISTS "Authenticated users can view active files" ON public.files;
CREATE POLICY "Staff can view active files"
ON public.files FOR SELECT TO authenticated
USING (is_deleted = false AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all studies" ON public.file_studies;
CREATE POLICY "Staff can view all studies"
ON public.file_studies FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view meeting minutes" ON public.meeting_minutes;
CREATE POLICY "Staff can view meeting minutes"
ON public.meeting_minutes FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view summons" ON public.summons;
CREATE POLICY "Staff can view summons"
ON public.summons FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view legal documents" ON public.legal_documents;
CREATE POLICY "Staff can view legal documents"
ON public.legal_documents FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));
