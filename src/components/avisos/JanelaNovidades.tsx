import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { novidadesPendentes, type Novidade } from "@/lib/avisos";
import { useAvisos, useMarcarLidos } from "./dados";

// Janela "Novidades da Pólia One" (ONE-152). Abre sozinha uma vez quando há
// novidade sem ler e, ao fechar por qualquer caminho, marca como lidas as que
// mostrou: não volta a cada página. Depois disso elas seguem no sino.

// Espera a tela assentar e não abre por cima de outra janela (tour, pesquisa).
const ESPERA_MS = 1500;

export function JanelaNovidades({ pausada = false }: { pausada?: boolean }) {
  const { data } = useAvisos();
  const marcarLidos = useMarcarLidos();
  const navigate = useNavigate();
  const [mostrando, setMostrando] = useState<Novidade[] | null>(null);
  const jaAbriu = useRef(false);

  const pendentes = data ? novidadesPendentes(data.novidades, data.lidas) : [];
  const temPendente = pendentes.length > 0;

  useEffect(() => {
    if (pausada || jaAbriu.current || !temPendente) return;
    const t = window.setTimeout(() => {
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      jaAbriu.current = true;
      setMostrando(pendentes);
    }, ESPERA_MS);
    return () => window.clearTimeout(t);
    // pendentes muda de identidade a cada render; temPendente basta pra decidir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pausada, temPendente]);

  const fechar = () => {
    if (mostrando?.length) void marcarLidos([], mostrando.map((n) => n.id));
    setMostrando(null);
  };

  const irPara = async (link: string) => {
    fechar();
    await navigate({ to: link });
  };

  if (!mostrando) return null;
  const unica = mostrando.length === 1;

  return (
    <Modal
      open
      onOpenChange={(aberto) => {
        if (!aberto) fechar();
      }}
      title={unica ? "Novidade na Pólia One" : "Novidades na Pólia One"}
      description="O que entrou desde a última visita. Elas também ficam no sino, no alto da tela."
      footer={
        <button type="button" onClick={fechar} className={unica && mostrando[0].link ? BTN_ACAO_CONTORNO : BTN_ACAO}>
          Entendi
        </button>
      }
    >
      <ul className="flex flex-col gap-3">
        {mostrando.map((n) => (
          <li key={n.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <h3 className="font-cabinet text-[17px] leading-[1.3] text-[var(--ink)]">{n.titulo}</h3>
            <p className="mt-1 text-[14px] leading-[1.55] text-[var(--ink-soft)]">{n.texto}</p>
            {n.imagem_url && (
              <img
                src={n.imagem_url}
                alt=""
                loading="lazy"
                className="mt-3 w-full rounded-lg border border-[var(--line)] object-cover"
              />
            )}
            {n.link && (
              <button
                type="button"
                onClick={() => void irPara(n.link!)}
                className={`${unica ? BTN_ACAO : BTN_ACAO_CONTORNO} mt-3`}
              >
                {n.link_rotulo ?? "Ver agora"}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
