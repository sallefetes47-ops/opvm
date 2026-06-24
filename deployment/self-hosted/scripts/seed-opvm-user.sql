-- Seed the built-in OPVM admin user on a fresh local install.
-- Run once after `docker compose up -d`:
--   docker compose exec db psql -U postgres -f /docker-entrypoint-initdb.d/seed-opvm-user.sql
-- (or copy this file into ./supabase/migrations before the first boot).

DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'opvm@opvm.local') THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change, email_change_token_new
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'opvm@opvm.local', crypt('OPVM2026', gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"OPVM"}'::jsonb, now(), now(), '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
            jsonb_build_object('sub', v_user_id::text, 'email', 'opvm@opvm.local'),
            'email', v_user_id::text, now(), now(), now());

    INSERT INTO public.profiles (user_id, full_name) VALUES (v_user_id, 'OPVM');
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin');
  END IF;
END $$;
