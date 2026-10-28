import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import { ativarPush, estadoPush, mandarAvisoDeTeste, type EstadoPush } from "@/lib/push";

// Avisos push em Configurações (AND-06, 27/10/2026). Só aparece dentro do app
// Android (a página decide com isNativeApp). Três estados da permissão do
// Android: ainda não decidida (botão pra ligar), negada (como ligar nas
// configurações do celular) e ativa (interruptores por tipo + aviso de teste).

type Campo = "notif_push_vendas" | "notif_push_resumo";

const LINHAS: { campo: Campo; titulo: string; descricao: string }[] = [
  {
    campo: "notif_push_vendas",
    titulo: "Lembrete de vendas",
    descricao: "às 20h, quando o dia ainda não tem venda registrada",
  },
  {
    campo: "notif_push_resumo",
    titulo: "Resumo da semana",
    descricao: "toda segunda às 9h, quanto a marca vendeu na semana que fechou",
  },
];

export function AvisosNoCelular({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [ativando, setAtivando] = useState(false);
  const [testando, setTestando] = useState(false);

  useEffect(() => {
    void estadoPush()
      .then(setEstado)
      .catch(() => setEstado("indisponivel"));
  }, []);

  const chave = ["push-prefs", userId];
  const prefs = useQuery({
    queryKey: chave,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notif_push_vendas, notif_push_resumo")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  async function alternar(campo: Campo, valor: boolean) {
    const anterior = prefs.data;
    queryClient.setQueryData(chave, { ...anterior, [campo]: valor });
    const payload =
      campo === "notif_push_vendas" ? { notif_push_vendas: valor } : { notif_push_resumo: valor };
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    if (error) {
      queryClient.setQueryData(chave, anterior);
      toastErro("A Pólia One não conseguiu salvar essa preferência. Tenta de novo em instantes.");
    }
  }

  async function ligar() {
    setAtivando(true);
    try {
      setEstado(await ativarPush());
    } catch {
      toastErro("A Pólia One não conseguiu ligar os avisos agora. Tenta de novo em instantes.");
    } finally {
      setAtivando(false);
    }
  }

  async function testar() {
    setTestando(true);
    try {
      const resultado = await mandarAvisoDeTeste();
      if (resultado === "ok") {
        toastSucesso("Aviso de teste enviado. Ele chega neste celular em alguns segundos.");
      } else if (resultado === "sem_aparelho") {
        toastErro(
          "Este celular ainda não terminou o cadastro. Fecha e abre o app e tenta de novo.",
        );
      } else {
        toastErro("A Pólia One não conseguiu mandar o aviso agora. Tenta de novo em instantes.");
      }
    } finally {
      setTestando(false);
    }
  }

  if (estado === null) {
    return <p className="font-sans text-[13px] text-[var(--muted)]">Carregando...</p>;
  }

  if (estado === "indisponivel") {
    return (
      <p className="font-sans text-[14px] text-[var(--ink-soft)]">
        Os avisos não estão disponíveis neste aparelho.
      </p>
    );
  }

  if (estado === "pendente") {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="font-sans text-[14px] text-[var(--ink-soft)]">
          Com os avisos ligados, a Pólia One lembra de registrar as vendas do dia e manda o resumo
          da semana.
        </p>
        <button type="button" className={BTN_ACAO_CONTORNO} onClick={ligar} disabled={ativando}>
          {ativando ? "Ligando..." : "Quero receber os avisos"}
        </button>
      </div>
    );
  }

  if (estado === "negado") {
    return (
      <p className="font-sans text-[14px] text-[var(--ink-soft)]">
        Os avisos da Pólia estão desligados no Android. Pra ligar: Configurações do celular, Apps,
        Pólia, Notificações.
      </p>
    );
  }

  return (
    <div>
      <div className="divide-y divide-[var(--line)]">
        {LINHAS.map((linha) => (
          <div key={linha.campo} className="flex items-center justify-between gap-4 py-3.5">
            <div>
              <p className="font-sans text-[14px] font-medium text-[var(--ink)]">{linha.titulo}</p>
              <p className="font-sans text-[12px] text-[var(--ink-soft)]">{linha.descricao}</p>
            </div>
            <Switch
              checked={prefs.data?.[linha.campo] ?? true}
              disabled={prefs.isLoading || prefs.isError}
              onCheckedChange={(v) => void alternar(linha.campo, v)}
              aria-label={linha.titulo}
            />
          </div>
        ))}
      </div>
      {prefs.isError && (
        <p className="font-sans text-[13px] text-[var(--danger)] mt-2">
          A Pólia One não conseguiu carregar as preferências. Fecha e abre a tela de novo.
        </p>
      )}
      <button
        type="button"
        className={`${BTN_ACAO_CONTORNO} mt-4`}
        onClick={testar}
        disabled={testando}
      >
        {testando ? "Mandando..." : "Mandar um aviso de teste"}
      </button>
    </div>
  );
}
