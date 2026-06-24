DO $$
DECLARE
  old_id uuid := '45c3e5ac-6d15-4085-8e45-e144253c96e1';
  new_id uuid := '0e3cd632-be60-44dd-89da-da05af514ce4';
BEGIN
  UPDATE public.files SET created_by = new_id WHERE created_by = old_id;
  UPDATE public.meeting_minutes SET created_by = new_id WHERE created_by = old_id;
  UPDATE public.summons SET created_by = new_id WHERE created_by = old_id;
  UPDATE public.legal_documents SET created_by = new_id WHERE created_by = old_id;
  DELETE FROM public.user_roles WHERE user_id = old_id;
  DELETE FROM public.profiles WHERE user_id = old_id;
  DELETE FROM auth.users WHERE id = old_id;
END $$;