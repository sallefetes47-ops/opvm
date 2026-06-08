
-- Revoke EXECUTE from anon/authenticated/PUBLIC on SECURITY DEFINER functions that should not be directly callable from the API.
-- has_role and get_user_role are only used inside RLS policies (which evaluate as the function owner via SECURITY DEFINER) and triggers.
-- handle_new_user is a trigger function only.
-- soft_delete_file is an RPC: keep authenticated execute.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Ensure RLS policies that reference has_role still work: policies evaluate USING/WITH CHECK in the security context
-- of the policy owner for SECURITY DEFINER functions; the planner only needs the function to exist. However, to be safe,
-- grant execute back to the postgres/service_role only.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO service_role;
