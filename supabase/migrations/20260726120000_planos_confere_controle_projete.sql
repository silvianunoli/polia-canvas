-- Ativa o Confere de verdade como plano gratuito padrão pra cadastro novo,
-- em vez de "beta" (que hoje dá acesso total sem pagar, para sempre — era
-- pensado só pra convidadas de antes do Stripe). As contas beta existentes
-- não são tocadas; continuam com acesso total.
alter table public.profiles alter column plano set default 'confere';
