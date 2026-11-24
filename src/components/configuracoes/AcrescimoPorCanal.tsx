import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Campo } from "@/components/ui/Campo";
import { BTN_ACAO } from "@/lib/botoes";
import { toastSucesso } from "@/lib/toast";
import { CANAIS_ACRESCIMO } from "@/lib/custosMarca";
import {
  CHAVE_CUSTOS_MARCA,
  salvarAcrescimoCanais,
  useCustosMarca,
} from "@/components/financeiro/custosMarcaDados";
import {
  normalizarDigitado,
  numeroParaCampo,
  numInvalido,
  numPos,
} from "@/components/produtos/tipos";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

/**
 * Acréscimo no preço por marketplace (ONE-259, 24/11/2026, pedido da Sil):
 * "vou colocar 40% em cima do valor do produto por conta dos marketplaces".
 * Vale com ou sem integração. O cadastro do produto mostra o preço de cada
 * canal; a Loja da marca e a venda direta usam o preço sem acréscimo. A Pólia
 * não muda o preço do anúncio no canal (decisão dela: só mostrar, por ora).
 */
export function AcrescimoPorCanal({ userId }: { userId: string | undefined }) {
  const qc = useQueryClient();
  const custos = useCustosMarca(userId);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [carregou, setCarregou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!custos.data || carregou) return;
    const inicial: Record<string, string> = {};
    for (const c of CANAIS_ACRESCIMO) {
      const v = custos.data.acrescimoCanais[c.chave];
      inicial[c.chave] = v ? numeroParaCampo(v).replace(/,00$/, "") : "";
    }
    setValores(inicial);
    setCarregou(true);
  }, [custos.data, carregou]);

  const invalido = CANAIS_ACRESCIMO.some((c) => {
    const s = valores[c.chave] ?? "";
    return numInvalido(s) || numPos(s) > 500;
  });

  const salvar = async () => {
    if (!userId || invalido || salvando) return;
    setSalvando(true);
    setErro(null);
    const numeros: Record<string, number> = {};
    for (const c of CANAIS_ACRESCIMO) numeros[c.chave] = numPos(valores[c.chave] ?? "");
    const falha = await salvarAcrescimoCanais(userId, numeros);
    setSalvando(false);
    if (falha) {
      setErro(falha);
      return;
    }
    void qc.invalidateQueries({ queryKey: [CHAVE_CUSTOS_MARCA, userId] });
    toastSucesso("Acréscimo salvo. O cadastro dos produtos já mostra o preço de cada canal.");
  };

  return (
    <section
      aria-labelledby="acrescimo-canais-titulo"
      className="mb-6 rounded-xl border border-[var(--line)] bg-white p-5"
    >
      <h2
        id="acrescimo-canais-titulo"
        className="font-cabinet text-[18px] tracking-[-0.02em] text-[var(--ink)]"
      >
        Acréscimo no preço por canal
      </h2>
      <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
        Quanto o preço sobe em cada marketplace, por causa da comissão e do frete dele. Vale com ou
        sem conexão. O cadastro do produto mostra o preço de cada canal pra pôr no anúncio, e a Loja
        da marca e a venda direta ficam com o preço sem acréscimo.
      </p>
      {custos.isLoading ? (
        <p className="mt-4 text-[14px] text-[var(--muted)]">Carregando...</p>
      ) : custos.isError ? (
        <p role="alert" className="mt-4 text-[14px] text-[var(--danger)]">
          A Pólia One não conseguiu ler o acréscimo agora. Recarrega a página pra tentar de novo.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {CANAIS_ACRESCIMO.map((c) => {
              const s = valores[c.chave] ?? "";
              return (
                <Campo
                  key={c.chave}
                  label={`${c.nome} (%)`}
                  error={
                    numInvalido(s) || numPos(s) > 500 ? "Coloque um número de 0 a 500." : undefined
                  }
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    value={s}
                    onChange={(e) =>
                      setValores((v) => ({ ...v, [c.chave]: normalizarDigitado(e.target.value) }))
                    }
                    className={INPUT}
                    placeholder="0"
                  />
                </Campo>
              );
            })}
          </div>
          {erro && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
              {erro}
            </p>
          )}
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando || invalido || !userId}
            className={`${BTN_ACAO} mt-4`}
          >
            {salvando ? "Salvando..." : "Salvar o acréscimo"}
          </button>
        </>
      )}
    </section>
  );
}
