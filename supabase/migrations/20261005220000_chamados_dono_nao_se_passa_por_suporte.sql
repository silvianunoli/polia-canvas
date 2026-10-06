-- Chamados de suporte: a cliente só fala como cliente e só mexe no próprio
-- chamado pra reabrir (QA-36, 05/10/2026).
--
-- Antes:
-- 1) ticket_messages aceitava author_role='admin' de qualquer dona de chamado:
--    chamando a API direto, a mensagem aparecia como "Suporte" na tela.
-- 2) tickets tinha uma policy FOR ALL pra dona: pela API ela podia marcar o
--    chamado como resolvido, trocar prioridade, título e corpo, ou apagar.
--
-- O app (chamados.index.tsx / chamados.$id.tsx) só faz três coisas: abre
-- chamado, manda mensagem como "user" e reabre um chamado resolvido quando
-- volta a escrever. O office (polia-admin) entra como admin pela policy
-- "Tickets: admin acessa tudo", que não muda.

-- ── Mensagens ───────────────────────────────────────────────────────────────
drop policy if exists "Ticket messages: participantes insere" on public.ticket_messages;

create policy "Ticket messages: participantes insere"
  on public.ticket_messages
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and (
      (
        author_role = 'user'
        and exists (
          select 1 from public.tickets t
          where t.id = ticket_messages.ticket_id and t.user_id = auth.uid()
        )
      )
      or (
        author_role = 'admin'
        and public.is_admin(auth.uid())
        and exists (select 1 from public.tickets t where t.id = ticket_messages.ticket_id)
      )
    )
  );

-- ── Chamados ────────────────────────────────────────────────────────────────
drop policy if exists "Tickets: dono acessa" on public.tickets;

create policy "Tickets: dono lê"
  on public.tickets
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Tickets: dono abre"
  on public.tickets
  for insert
  to authenticated
  with check (auth.uid() = user_id and status = 'aberto' and resolved_at is null);

create policy "Tickets: dono reabre"
  on public.tickets
  for update
  to authenticated
  using (auth.uid() = user_id and status = 'resolvido')
  with check (auth.uid() = user_id and status = 'aberto');

-- Sem policy de DELETE pra dona: chamado só sai pela exclusão de conta
-- (excluir_dados_do_usuario) ou pelo admin.

-- Policy de UPDATE não enxerga coluna: sem isto, ao reabrir ela poderia trocar
-- título, corpo e prioridade no mesmo update.
create or replace function public.tickets_dono_so_reabre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (auth.uid() nulo) e admin seguem livres.
  if auth.uid() is null or public.is_admin(auth.uid()) then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.priority is distinct from old.priority
     or new.module_ref is distinct from old.module_ref
     or new.created_at is distinct from old.created_at
     or new.resolved_at is distinct from old.resolved_at then
    raise exception 'Chamado: a cliente só pode reabrir, não editar.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.tickets_dono_so_reabre() from public, anon, authenticated;

drop trigger if exists tickets_dono_so_reabre on public.tickets;
create trigger tickets_dono_so_reabre
  before update on public.tickets
  for each row execute function public.tickets_dono_so_reabre();
