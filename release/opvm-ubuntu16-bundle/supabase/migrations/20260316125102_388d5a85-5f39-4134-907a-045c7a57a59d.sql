
CREATE POLICY "Non-viewers can soft delete files"
ON public.files
FOR UPDATE
TO authenticated
USING (NOT has_role(auth.uid(), 'viewer'::app_role))
WITH CHECK (NOT has_role(auth.uid(), 'viewer'::app_role));
