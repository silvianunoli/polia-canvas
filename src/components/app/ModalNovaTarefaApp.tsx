import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { MSG_LIMITE_CARTOES } from "@/lib/planos";
import { hojeISO } from "@/lib/data.functions";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";

// Nova tarefa pelo + do app (AND-07). Mesmo cartão do quick add do quadro
// (planner.$slug.tsx): coluna "Planejado", início e prazo hoje, ajuste fino
// depois no detalhe. O limite do Grátis é travado pelo banco (assert_cota_cartoes).

type Quadro = { id: string; nome: string };

export function ModalNovaTarefaApp({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const tituloId = useId();
  const quadroId = useId();
  const [titulo, setTitulo] = useState("");
  const [quadro, setQuadro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const enviandoRef = useRef(false);

  const quadros = useQuery({
    queryKey: ["quadros-nomes", userId],
    queryFn: async (): Promise<Quadro[]> => {
      const { data, error } = await supabase
        .from("quadros")
        .select("id, nome")
        .eq("user_id", userId)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!quadro && quadros.data?.[0]) setQuadro(quadros.data[0].id);
  }, [quadro, quadros.data]);

  async function salvar() {
    const nome = titulo.trim();
    if (!nome) {
      setErro("Escreve o que precisa ser feito.");
      return;
    }
    if (!quadro || enviandoRef.current) return;
    enviandoRef.current = true;
    setSalvando(true);
    const hoje = hojeISO();
    const { error } = await supabase.from("tarefas").insert({
      user_id: userId,
      quadro_id: quadro,
      titulo: nome,
      status: "planejado",
      fonte: "manual",
      data_inicio: hoje,
      prazo: hoje,
    } as never);
    setSalvando(false);
    enviandoRef.current = false;
    if (error) {
      toastErro(
        /limite do plano Grátis/i.test(error.message)
          ? MSG_LIMITE_CARTOES
          : "A Pólia One não conseguiu salvar a tarefa. Tenta de novo.",
      );
      return;
    }
    track("tarefa_criada", { status: "planejado", origem: "app_mais" });
    void qc.invalidateQueries({ queryKey: ["cartoes-cota", userId] });
    void qc.invalidateQueries();
    toastSucesso("Tarefa guardada no Planner.");
    onClose();
  }

  const semQuadro = quadros.isSuccess && quadros.data.length === 0;

  return (
    <Modal
      open
      onOpenChange={(aberto) => !aberto && onClose()}
      title="Nova tarefa"
      description="Entra no Planner com prazo pra hoje. Dá pra mudar depois no cartão."
      footer={
        semQuadro ? null : (
          <>
            <button type="button" className={BTN_ACAO_CONTORNO} onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className={BTN_ACAO}
              onClick={() => void salvar()}
              disabled={salvando || !quadro}
            >
              {salvando ? "Guardando..." : "Guardar tarefa"}
            </button>
          </>
        )
      }
    >
      {quadros.isLoading && (
        <p className="font-sans text-[13px] text-[var(--muted)]">Carregando os quadros...</p>
      )}
      {quadros.isError && (
        <p className="font-sans text-[14px] text-[var(--danger)]">
          A Pólia One não conseguiu carregar os quadros. Fecha e tenta de novo.
        </p>
      )}
      {semQuadro && (
        <p className="font-sans text-[14px] text-[var(--ink-soft)]">
          Ainda não existe nenhum quadro. Cria o primeiro na aba Planner e volta aqui.
        </p>
      )}
      {quadros.isSuccess && !semQuadro && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={tituloId} className="font-sans text-[13px] text-[var(--ink-soft)]">
              O que precisa ser feito
            </label>
            <input
              id={tituloId}
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                setErro(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && void salvar()}
              placeholder="Responder a encomenda da Maria"
              maxLength={200}
              aria-invalid={!!erro}
              aria-describedby={erro ? `${tituloId}-erro` : undefined}
              className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 font-sans text-[15px] text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
            />
            {erro && (
              <p id={`${tituloId}-erro`} className="font-sans text-[13px] text-[var(--danger)]">
                {erro}
              </p>
            )}
          </div>
          {quadros.data.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={quadroId} className="font-sans text-[13px] text-[var(--ink-soft)]">
                Quadro
              </label>
              <select
                id={quadroId}
                value={quadro}
                onChange={(e) => setQuadro(e.target.value)}
                className="min-h-11 rounded-xl border border-[var(--line)] bg-white px-3 font-sans text-[15px] text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ink)]"
              >
                {quadros.data.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
