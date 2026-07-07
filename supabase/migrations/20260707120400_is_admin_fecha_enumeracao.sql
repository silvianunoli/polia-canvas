-- Fecha a enumeração via /rest/v1/rpc/is_admin: antes, qualquer usuária logada podia
-- perguntar "o UID X é admin?" passando um uuid arbitrário. Agora a função IGNORA o
-- argumento e responde sempre sobre o próprio chamador (auth.uid()).
-- Seguro: todas as ~15 policies chamam is_admin(auth.uid()), então o comportamento delas
-- não muda; e o app lê is_admin direto de profiles, nunca via esta RPC.
CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false)
$function$;
