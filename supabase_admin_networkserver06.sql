DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.app_users
    WHERE LOWER(email) = LOWER('networkserver06@gmail.com')
  ) THEN
    RAISE EXCEPTION 'No app_users account exists for networkserver06@gmail.com. Sign in once first so Supabase Auth can create the application user row.';
  END IF;

  UPDATE public.app_users
  SET role = 'admin', updated_at = NOW()
  WHERE LOWER(email) = LOWER('networkserver06@gmail.com');
END
$$;

SELECT id, email, role, updated_at
FROM public.app_users
WHERE LOWER(email) = LOWER('networkserver06@gmail.com');
