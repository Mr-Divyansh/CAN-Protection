-- Existing remote migration: 20261124155837_revoke_public_execute_rls_auto_enable
-- Reconstructed in-repository copy of the already-applied remote migration.
-- Restrict the optional public helper so browser roles cannot invoke it.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM authenticated';
  END IF;
END
$$;
