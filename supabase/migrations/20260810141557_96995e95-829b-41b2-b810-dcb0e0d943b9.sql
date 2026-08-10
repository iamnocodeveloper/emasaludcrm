-- Backfill missing user_roles rows from users.role
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, u.role::public.app_role
FROM public.users u
WHERE u.role IN ('admin','usuario_normal','prestador','paciente')
ON CONFLICT (user_id, role) DO NOTHING;

-- Keep user_roles in sync when a users row is created or its role changes
CREATE OR REPLACE FUNCTION public.sync_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role IS DISTINCT FROM NEW.role THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.id AND role = OLD.role::public.app_role;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, NEW.role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_user_role_trigger ON public.users;
CREATE TRIGGER sync_user_role_trigger
AFTER INSERT OR UPDATE OF role ON public.users
FOR EACH ROW EXECUTE FUNCTION public.sync_user_role();