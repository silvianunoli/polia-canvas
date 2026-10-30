import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import {
  desconectarRede,
  iniciarConexaoRede,
  statusRedesSociais,
  type StatusRede,
} from "@/lib/redesSociais.functions";
import { NOME_REDE, type Rede } from "../../../supabase/functions/_shared/redesSociais.ts";
import { ConfirmarAcao } from "@/components/ui/ConfirmarAcao";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";

// Cards do TikTok e do Instagram em Configurações > Integrações (Agenda das redes,
// ONE-154). Só no Pro; somem quando o servidor não tem as credenciais da rede e,
// até as revisões do TikTok e da Meta aprovarem, para quem não é admin.

export const CHAVE_STATUS_REDES = "redes-sociais-status";

const ANTES_DE_CONECTAR: Record<Rede, string> = {
  tiktok: "Antes de conectar: entrar no TikTok com a conta onde os posts vão sair.",
  instagram:
    "Antes de conectar: a conta do Instagram precisa ser profissional (comercial ou de criador de conteúdo).",
};

export function CardRedesSociais({ userId }: { userId: string | undefined }) {
  const statusQuery = useQuery({
    queryKey: [CHAVE_STATUS_REDES, userId],
    enabled: !!userId,
    queryFn: () => statusRedesSociais(),
  });
  const status = statusQuery.data?.visivel ? statusQuery.data : null;
  if (!status) return null;
  return (
    <>
      {status.redes.map((r) => (
        <CardRede key={r.rede} userId={userId} rede={r} liberado={status.liberado} />
      ))}
    </>
  );
}

function CardRede({
  userId,
  rede,
  liberado,
}: {
  userId: string | undefined;
  rede: StatusRede;
  liberado: boolean;
}) {
  const queryClient = useQueryClient();
  const nome = NOME_REDE[rede.rede];
  const [confirmandoDesconectar, setConfirmandoDesconectar] = useState(false);

  const conectar = useMutation({
    mutationFn: () => iniciarConexaoRede({ data: { rede: rede.rede } }),
    onSuccess: (res) => {
      if (res.error || !res.url) {
        toastErro(res.error ?? `A Pólia One não conseguiu conectar com o ${nome} agora.`);
        return;
      }
      window.location.href = res.url;
    },
    onError: () => toastErro(`A Pólia One não conseguiu iniciar a conexão com o ${nome}.`),
  });

  const desconectar = useMutation({
    mutationFn: () => desconectarRede({ data: { rede: rede.rede } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toastErro(res.error ?? "A Pólia One não conseguiu desconectar agora.");
        return;
      }
      setConfirmandoDesconectar(false);
      queryClient.invalidateQueries({ queryKey: [CHAVE_STATUS_REDES, userId] });
      toastSucesso(`${nome} desconectado.`);
    },
    onError: () => toastErro("A Pólia One não conseguiu desconectar agora."),
  });

  const conta = rede.usuario ? `@${rede.usuario}` : rede.nome;

  return (
    <>
      <div className="p-4 border border-[var(--line)] rounded-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-sans text-[var(--ink)] text-[14px] font-medium mb-0.5">
              {nome}
              {rede.conectada && conta ? ` · ${conta}` : ""}
            </p>
            <p className="font-sans text-[var(--ink-soft)] text-[12px]">
              {rede.conectada
                ? "conectado · os posts agendados na Pólia saem nesta conta"
                : `os posts agendados na Pólia saem na conta do ${nome} no horário marcado`}
            </p>
          </div>
          {!rede.conectada && !liberado ? (
            <LinkInterno
              href={`/upgrade?rota=${encodeURIComponent("/configuracoes")}&tier=projete`}
              className={BTN_MIUDO}
            >
              <Lock size={13} aria-hidden="true" /> Abre no Pro
            </LinkInterno>
          ) : rede.conectada ? (
            <button
              type="button"
              onClick={() => setConfirmandoDesconectar(true)}
              className={`${BTN_MIUDO} hover:border-[var(--danger)] hover:text-[var(--danger)]`}
            >
              Desconectar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => conectar.mutate()}
              disabled={conectar.isPending}
              className={BTN_MIUDO}
            >
              {conectar.isPending ? "Conectando..." : rede.erro ? "Conectar de novo" : "Conectar"}
            </button>
          )}
        </div>
        {rede.erro && !rede.conectada && (
          <p className="font-sans text-[var(--danger)] text-[12px] mt-2" role="alert">
            {rede.erro}
          </p>
        )}
        {!rede.conectada && (
          <ul className="font-sans text-[var(--ink-soft)] text-[12px] mt-3 space-y-1">
            <li>A Pólia publica: só os posts que forem agendados e confirmados na Pólia.</li>
            <li>A Pólia não faz: ler mensagens, comentar, curtir ou seguir ninguém.</li>
            <li>{ANTES_DE_CONECTAR[rede.rede]}</li>
          </ul>
        )}
      </div>
      <ConfirmarAcao
        open={confirmandoDesconectar}
        onOpenChange={(aberto) => {
          if (!desconectar.isPending) setConfirmandoDesconectar(aberto);
        }}
        titulo={`Desconectar o ${nome}?`}
        descricao={`Os posts agendados para o ${nome} deixam de sair e a Pólia apaga o acesso à conta. Os posts que já saíram continuam no ${nome}.`}
        textoConfirmar="Desconectar"
        textoCarregando="Desconectando..."
        destrutivo
        carregando={desconectar.isPending}
        onConfirmar={() => desconectar.mutateAsync()}
      />
    </>
  );
}
