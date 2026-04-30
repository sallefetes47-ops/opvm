
-- Drop the policy we just created since it's not working as expected
DROP POLICY IF EXISTS "Non-viewers can soft delete files" ON public.files;

-- Create a security definer function for soft delete
CREATE OR REPLACE FUNCTION public.soft_delete_file(_file_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only non-viewers can soft delete
    IF has_role(auth.uid(), 'viewer'::app_role) THEN
        RAISE EXCEPTION 'Permission denied';
    END IF;
    
    UPDATE public.files 
    SET is_deleted = true, deleted_at = now()
    WHERE id = _file_id AND is_deleted = false;
END;
$$;
