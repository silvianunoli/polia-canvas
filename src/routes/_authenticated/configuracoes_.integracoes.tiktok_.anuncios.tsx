import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { LinkInterno } from "@/components/ui/LinkInterno";
import {
  listarAnunciosTiktok,
  salvarVinculosTiktok,
  type LinhaPrevia,
} from "@/lib/tiktokShopAnuncios.functions";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";

// Prévia de ligar anúncios do TikTok Shop aos produtos da Pólia (wireframe 6.3 do
// plano da Fase 3a, aprovado em 24/10). Nada é ligado sem ela clicar em Salvar.

export const Route = createFileRoute("/_authenticated/configuracoes_/integracoes/tiktok_/anuncios")(
  {
    head: () => ({ meta: [{ title: "Ligar anúncios do TikTok Shop · Pólia One" }] }),
    component: LigarAnuncios,
  },
);

const ESCOLHER = "";
const SELECT =
  "min-h-11 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

function destinoInicial(l: LinhaPrevia): string {
  if (l.skuIdAtual) return `sku:${l.skuIdAtual}`;
  if (l.sugestao) return `sku:${l.sugestao.skuId}`;
  return ESCOLHER;
}

function etiqueta(l: LinhaPrevia, destino: string): string {
  if (l.skuIdAtual && destino === `sku:${l.skuIdAtual}`) return "já ligado";
  if (l.sugestao && destino === `sku:${l.sugestao.skuId}`)
    return l.sugestao.motivo === "codigo" ? "pelo código" : "pelo nome";
  if (destino === "novo") return "produto novo";
  if (destino === "nenhum") return "não liga";
  if (destino === ESCOLHER) return "sem par";
  return "escolhido";
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function LigarAnuncios() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const consulta = useQuery({
    queryKey: ["tiktok-anuncios"],
    queryFn: () => listarAnunciosTiktok(),
    staleTime: 0,
  });
  const dados = consulta.data?.ok ? consulta.data : null;
  const [destinos, setDestinos] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!dados) return;
    setDestinos(Object.fromEntries(dados.linhas.map((l) => [l.skuExternoId, destinoInicial(l)])));
  }, [dados]);

  const aSalvar = useMemo(
    () =>
      (dados?.linhas ?? []).filter((l) => {
        const d = destinos[l.skuExternoId] ?? ESCOLHER;
        if (d === ESCOLHER) return false;
        if (d === "nenhum") return !!l.skuIdAtual;
        return d !== `sku:${l.skuIdAtual}`;
      }),
    [dados, destinos],
  );
  const ligacoes = aSalvar.filter((l) => destinos[l.skuExternoId] !== "nenhum").length;

  const salvar = useMutation({
    mutationFn: () =>
      salvarVinculosTiktok({
        data: {
          itens: aSalvar.map((l) => ({
            produtoExternoId: l.produtoExternoId,
            skuExternoId: l.skuExternoId,
            destino: destinos[l.skuExternoId],
            titulo: l.titulo,
            variacao: l.variacao,
            codigo: l.codigo,
            preco: l.preco,
            quantidade: l.quantidade,
          })),
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toastErro(res.error ?? "A Pólia One não conseguiu salvar as ligações.");
        return;
      }
      for (const aviso of res.avisos) toastErro(aviso);
      const partes = [
        `${res.ligados} ${res.ligados === 1 ? "anúncio ligado" : "anúncios ligados"}`,
      ];
      if (res.criados)
        partes.push(`${res.criados} ${res.criados === 1 ? "produto criado" : "produtos criados"}`);
      toastSucesso(`${partes.join(", ")}.`);
      qc.invalidateQueries({ queryKey: ["tiktok-status"] });
      qc.invalidateQueries({ queryKey: ["tiktok-anuncios"] });
      navigate({ to: "/configuracoes" });
    },
    onError: () => toastErro("A Pólia One não conseguiu salvar as ligações. Tenta de novo."),
  });

  const voltar = (
    <LinkInterno href="/configuracoes" className={BTN_ACAO_CONTORNO}>
      Voltar para Configurações
    </LinkInterno>
  );

  return (
    <PaginaLogada
      titulo="Ligar anúncios do TikTok aos produtos da Pólia"
      eyebrow="TikTok Shop"
      subtitulo="A Pólia sugeriu pelo código (SKU) e depois pelo nome. Confere antes de salvar: os pedidos só baixam o estoque de anúncio ligado."
      largura="larga"
    >
      {consulta.isLoading && (
        <p
          className="font-sans text-[var(--ink-soft)] text-[14px]"
          role="status"
          aria-live="polite"
        >
          Buscando os anúncios da loja...
        </p>
      )}

      {consulta.data && !consulta.data.ok && (
        <div className="space-y-4" role="alert">
          <p className="font-sans text-[var(--danger)] text-[14px]">{consulta.data.error}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className={BTN_ACAO} onClick={() => consulta.refetch()}>
              Tentar de novo
            </button>
            {voltar}
          </div>
        </div>
      )}
      {consulta.isError && (
        <div className="space-y-4" role="alert">
          <p className="font-sans text-[var(--danger)] text-[14px]">
            A Pólia One não conseguiu buscar os anúncios agora.
          </p>
          <button type="button" className={BTN_ACAO} onClick={() => consulta.refetch()}>
            Tentar de novo
          </button>
        </div>
      )}

      {dados && dados.linhas.length === 0 && (
        <div className="space-y-4">
          <p className="font-sans text-[var(--ink-soft)] text-[14px]">
            A loja não tem anúncios ativos no TikTok Shop. Quando tiver, eles aparecem aqui.
          </p>
          {voltar}
        </div>
      )}

      {dados && dados.linhas.length > 0 && (
        <>
          {dados.incompleto && (
            <p className="font-sans text-[var(--ink-soft)] text-[13px] mb-4">
              A loja tem mais de 500 anúncios: aparecem os 500 primeiros.
            </p>
          )}
          <div className="border border-[var(--line)] rounded-xl divide-y divide-[var(--line)] bg-white">
            <div className="hidden md:grid md:grid-cols-[1fr_1fr_120px] gap-4 px-4 py-3 font-sans text-[12px] font-medium text-[var(--muted)]">
              <span>Anúncio no TikTok</span>
              <span>Produto na Pólia</span>
              <span />
            </div>
            {dados.linhas.map((l) => {
              const destino = destinos[l.skuExternoId] ?? ESCOLHER;
              const idSelect = `destino-${l.skuExternoId}`;
              return (
                <div
                  key={l.skuExternoId}
                  className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_1fr_120px] md:items-center md:gap-4"
                >
                  <div>
                    <p className="font-sans text-[14px] text-[var(--ink)]">
                      {l.titulo}
                      {l.variacao ? ` · ${l.variacao}` : ""}
                    </p>
                    <p className="font-sans text-[12px] text-[var(--muted)]">
                      {[
                        l.codigo ? `código ${l.codigo}` : "sem código",
                        l.preco != null ? moeda(l.preco) : null,
                        `${l.quantidade} em estoque no TikTok`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div>
                    <label htmlFor={idSelect} className="sr-only">
                      Produto da Pólia para {l.titulo}
                      {l.variacao ? ` ${l.variacao}` : ""}
                    </label>
                    <select
                      id={idSelect}
                      className={SELECT}
                      value={destino}
                      disabled={salvar.isPending}
                      onChange={(e) =>
                        setDestinos((d) => ({ ...d, [l.skuExternoId]: e.target.value }))
                      }
                    >
                      <option value={ESCOLHER}>Escolher...</option>
                      <option value="novo">Criar produto novo na Pólia</option>
                      <option value="nenhum">Não ligar</option>
                      {dados.skus.length > 0 && (
                        <optgroup label="Produtos e variações da Pólia">
                          {dados.skus.map((s) => (
                            <option key={s.skuId} value={`sku:${s.skuId}`}>
                              {s.rotulo}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {dados.produtosSemEstoque.length > 0 && (
                        <optgroup label="Produtos sem estoque ligado (liga ao salvar)">
                          {dados.produtosSemEstoque.map((p) => (
                            <option key={p.produtoId} value={`produto:${p.produtoId}`}>
                              {p.nome}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <span className="font-sans text-[12px] text-[var(--ink-soft)]">
                    {etiqueta(l, destino)}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="font-sans text-[12px] text-[var(--muted)] mt-3">
            Criar produto novo usa o nome, o preço e a quantidade que estão no TikTok. Produto sem
            estoque ligado passa a controlar estoque com uma variação.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <button
              type="button"
              className={BTN_ACAO}
              disabled={aSalvar.length === 0 || salvar.isPending}
              onClick={() => salvar.mutate()}
            >
              {salvar.isPending
                ? "Salvando..."
                : ligacoes > 0
                  ? `Salvar ${ligacoes} ${ligacoes === 1 ? "ligação" : "ligações"}`
                  : "Salvar"}
            </button>
            {voltar}
          </div>
        </>
      )}
    </PaginaLogada>
  );
}
