UPDATE public.app_users
SET role = 'admin', updated_at = NOW()
WHERE LOWER(email) = LOWER('networkserver06@gmail.com');

SELECT id, email, role
FROM public.app_users
WHERE LOWER(email) = LOWER('networkserver06@gmail.com');
