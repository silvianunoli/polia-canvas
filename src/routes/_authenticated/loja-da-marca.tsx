import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ExternalLink, ImagePlus, Trash2 } from "lucide-react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { CuponsDeDesconto } from "@/components/catalogo/CuponsDeDesconto";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { Campo } from "@/components/ui/Campo";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import {
  MAX_ALT,
  MAX_BANNERS_LOJA_MARCA,
  MAX_TITULO,
  problemaDoLink,
  problemaParaSalvar,
  titulosVisiveis,
  type BannerDaLoja,
  type BlocoComTitulo,
  type TituloDoBloco,
} from "@/lib/lojaDaMarca";
import {
  chaveColecoes,
  chaveConteudoDaLoja,
  salvarVitrineDaLoja,
  subirImagemDaLoja,
  trocarCapaDaColecao,
  urlDaImagemDaLoja,
  useColecoesDaLoja,
  useConteudoDaLojaDaMarca,
  type ColecaoDaLoja,
} from "@/components/lojaDaMarca/dados";

// Loja da marca (Sil, 22/11/2026): o "CMS" da loja white label (lojas_marca, site
// próprio da marca). A dona troca o título dos carrosséis, os banners e a capa das
// coleções sem pedir pra ninguém. Só aparece pra conta que tem loja da marca; a
// Vitrine online (/catalogo) é outra loja, no endereço da Pólia.

export const Route = createFileRoute("/_authenticated/loja-da-marca")({
  head: () => ({
    meta: [
      { title: "Loja da marca · Pólia One" },
      {
        name: "description",
        content: "Títulos, banners e capas da página inicial da loja da marca.",
      },
    ],
  }),
  component: LojaDaMarcaPage,
});

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[15px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)]";

function Secao({
  titulo,
  texto,
  children,
}: {
  titulo: string;
  texto?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 sm:p-6">
      <div>
        <h2 className="font-cabinet text-[20px] font-bold text-[var(--ink)]">{titulo}</h2>
        {texto && <p className="mt-1 font-sans text-[13px] text-[var(--ink-soft)]">{texto}</p>}
      </div>
      {children}
    </section>
  );
}

function LojaDaMarcaPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const qc = useQueryClient();
  const conteudo = useConteudoDaLojaDaMarca(userId);
  const [titulos, setTitulos] = useState<Record<BlocoComTitulo, TituloDoBloco> | null>(null);
  const [banners, setBanners] = useState<BannerDaLoja[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega o formulário uma vez por leitura do banco (depois de salvar, relê).
  useEffect(() => {
    if (!conteudo.data) return;
    setTitulos(conteudo.data.titulos);
    setBanners(conteudo.data.banners);
  }, [conteudo.data]);

  if (conteudo.isError)
    return (
      <PaginaLogada eyebrow="Loja da marca" titulo="A página inicial da loja." largura="larga">
        <BlockError
          message="A Pólia One não conseguiu abrir a loja agora."
          onRetry={() => conteudo.refetch()}
        />
      </PaginaLogada>
    );
  if (conteudo.isLoading || !userId)
    return (
      <PaginaLogada eyebrow="Loja da marca" titulo="A página inicial da loja." largura="larga">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      </PaginaLogada>
    );
  if (!conteudo.data)
    return (
      <PaginaLogada eyebrow="Loja da marca" titulo="A página inicial da loja." largura="larga">
        <Vazio
          titulo="Esta conta não tem loja da marca."
          texto="A loja da marca é montada pelo Pólia Lab. A loja no endereço da Pólia fica em Vitrine online."
          acao={
            <LinkInterno href="/catalogo" className={BTN_ACAO}>
              Abrir a Vitrine online
            </LinkInterno>
          }
        />
      </PaginaLogada>
    );

  const dados = conteudo.data;
  const salvar = async () => {
    if (!titulos) return;
    const problema = problemaParaSalvar(titulos, banners);
    setErro(problema);
    if (problema) return;
    setSalvando(true);
    const r = await salvarVitrineDaLoja(titulos, banners, dados.banners);
    setSalvando(false);
    if (r.error) return setErro(r.error);
    toastSucesso("Loja salva. A página inicial já mostra o que mudou.");
    await qc.invalidateQueries({ queryKey: chaveConteudoDaLoja(userId) });
  };

  return (
    <PaginaLogada
      eyebrow="Loja da marca"
      titulo="A página inicial da loja."
      subtitulo="Os títulos dos carrosséis, os banners do topo, a capa de cada coleção e os cupons de desconto. Produto, preço, preço promocional, categoria e coleção de cada produto ficam em Produtos."
      largura="larga"
      acao={
        <a className={BTN_MIUDO} href={`https://${dados.dominio}`} target="_blank" rel="noopener">
          <ExternalLink size={14} aria-hidden="true" /> Ver a loja
        </a>
      }
    >
      <div className="space-y-6">
        <Secao
          titulo="Títulos dos carrosséis"
          texto={`Até ${MAX_TITULO} caracteres. Vazio, a loja usa o título padrão.`}
        >
          {titulos &&
            titulosVisiveis(dados.blocos).map((t) => (
              <div
                key={t.bloco}
                className="grid gap-3 border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0 sm:grid-cols-2"
              >
                <Campo label={`${t.nome}: título`}>
                  <input
                    className={INPUT}
                    value={titulos[t.bloco].titulo}
                    placeholder={t.padrao}
                    maxLength={MAX_TITULO}
                    onChange={(e) =>
                      setTitulos({
                        ...titulos,
                        [t.bloco]: { ...titulos[t.bloco], titulo: e.target.value },
                      })
                    }
                  />
                </Campo>
                <Campo label="Linha pequena em cima (opcional)">
                  <input
                    className={INPUT}
                    value={titulos[t.bloco].acima}
                    placeholder="Ex.: Para fechar o kit"
                    maxLength={MAX_TITULO}
                    onChange={(e) =>
                      setTitulos({
                        ...titulos,
                        [t.bloco]: { ...titulos[t.bloco], acima: e.target.value },
                      })
                    }
                  />
                </Campo>
              </div>
            ))}
        </Secao>

        <Banners userId={userId} banners={banners} onMudar={setBanners} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={BTN_ACAO}
            onClick={() => void salvar()}
            disabled={salvando || !titulos}
          >
            {salvando ? "Salvando..." : "Salvar títulos e banners"}
          </button>
          {erro && (
            <p role="alert" className="font-sans text-[13px] text-[var(--danger)]">
              {erro}
            </p>
          )}
        </div>

        <CapasDasColecoes userId={userId} />

        <CuponsDeDesconto
          userId={userId}
          texto="A compradora digita o código na hora de finalizar a compra e vê o desconto antes de pagar. Vale só nos produtos, nunca no frete, e o uso conta quando o pagamento entra. Os cupons são os mesmos da Vitrine online: o código vale nas duas lojas e os usos somam juntos."
        />
      </div>
    </PaginaLogada>
  );
}

/** Botão de arquivo acessível: o input fica escondido e o rótulo é o alvo. */
function EscolherImagem({
  rotulo,
  ocupado,
  onArquivo,
}: {
  rotulo: string;
  ocupado: boolean;
  onArquivo: (f: File) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        disabled={ocupado}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onArquivo(f);
          if (input.current) input.current.value = "";
        }}
      />
      <label htmlFor={id} className={`${BTN_MIUDO} ${ocupado ? "opacity-50" : "cursor-pointer"}`}>
        <ImagePlus size={14} aria-hidden="true" /> {ocupado ? "Subindo..." : rotulo}
      </label>
    </>
  );
}

function Banners({
  userId,
  banners,
  onMudar,
}: {
  userId: string;
  banners: BannerDaLoja[];
  onMudar: (b: BannerDaLoja[]) => void;
}) {
  const [subindo, setSubindo] = useState<string | null>(null);

  const subir = async (chave: string, arquivo: File, aplicar: (path: string) => void) => {
    setSubindo(chave);
    const r = await subirImagemDaLoja(userId, arquivo, "banner");
    setSubindo(null);
    if (r.error || !r.path)
      return toastErro(r.error ?? "A Pólia One não conseguiu subir a imagem agora.");
    aplicar(r.path);
  };
  const mudar = (i: number, m: Partial<BannerDaLoja>) =>
    onMudar(banners.map((b, j) => (j === i ? { ...b, ...m } : b)));
  const mover = (i: number, d: -1 | 1) => {
    const nova = [...banners];
    [nova[i], nova[i + d]] = [nova[i + d], nova[i]];
    onMudar(nova);
  };

  return (
    <Secao
      titulo="Banners do topo"
      texto={`Até ${MAX_BANNERS_LOJA_MARCA}, passando sozinhos. Computador: imagem deitada, 1600 x 600 px. Celular (opcional): mais alta, 800 x 800 px. JPG, PNG ou WEBP até 5 MB.`}
    >
      {!banners.length && (
        <p className="font-sans text-[13px] text-[var(--ink-soft)]">
          Sem banner, a loja abre com a chamada e o logo.
        </p>
      )}
      <ol className="space-y-4">
        {banners.map((b, i) => {
          const erroLink = problemaDoLink(b.link);
          return (
            <li
              key={`${b.imagemPath}-${i}`}
              className="space-y-3 rounded-xl border border-[var(--line)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-sans text-[14px] font-medium text-[var(--ink)]">
                  Banner {i + 1}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className={BTN_MIUDO}
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    aria-label={`Subir o banner ${i + 1}`}
                  >
                    <ArrowUp size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={BTN_MIUDO}
                    onClick={() => mover(i, 1)}
                    disabled={i === banners.length - 1}
                    aria-label={`Descer o banner ${i + 1}`}
                  >
                    <ArrowDown size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={BTN_MIUDO}
                    onClick={() => onMudar(banners.filter((_, j) => j !== i))}
                    aria-label={`Tirar o banner ${i + 1}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <figure className="space-y-2">
                  <img
                    src={urlDaImagemDaLoja(b.imagemPath)}
                    alt=""
                    className="h-24 w-64 max-w-full rounded-lg border border-[var(--line)] object-cover"
                  />
                  <figcaption className="flex items-center gap-2 font-sans text-[12px] text-[var(--ink-soft)]">
                    Computador
                    <EscolherImagem
                      rotulo="Trocar"
                      ocupado={subindo === `pc-${i}`}
                      onArquivo={(f) =>
                        void subir(`pc-${i}`, f, (p) => mudar(i, { imagemPath: p }))
                      }
                    />
                  </figcaption>
                </figure>
                <figure className="space-y-2">
                  {b.celularPath ? (
                    <img
                      src={urlDaImagemDaLoja(b.celularPath)}
                      alt=""
                      className="h-24 w-24 rounded-lg border border-[var(--line)] object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-[var(--line)] px-2 text-center font-sans text-[11px] text-[var(--muted)]">
                      Usa a do computador
                    </div>
                  )}
                  <figcaption className="flex items-center gap-2 font-sans text-[12px] text-[var(--ink-soft)]">
                    Celular
                    <EscolherImagem
                      rotulo={b.celularPath ? "Trocar" : "Subir"}
                      ocupado={subindo === `cel-${i}`}
                      onArquivo={(f) =>
                        void subir(`cel-${i}`, f, (p) => mudar(i, { celularPath: p }))
                      }
                    />
                    {b.celularPath && (
                      <button
                        type="button"
                        className="min-h-11 px-1 font-medium text-[var(--secondary-text)] hover:underline"
                        onClick={() => mudar(i, { celularPath: null })}
                      >
                        Tirar
                      </button>
                    )}
                  </figcaption>
                </figure>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo
                  label="Link ao clicar (opcional)"
                  hint="Ex.: /categoria/natal ou /produtos"
                  error={erroLink ?? undefined}
                >
                  <input
                    className={INPUT}
                    value={b.link}
                    onChange={(e) => mudar(i, { link: e.target.value })}
                    maxLength={300}
                    placeholder="/produtos"
                  />
                </Campo>
                <Campo
                  label="O que o banner diz"
                  hint="Lido por quem usa leitor de tela. Escreva o texto da imagem."
                >
                  <input
                    className={INPUT}
                    value={b.alt}
                    onChange={(e) => mudar(i, { alt: e.target.value })}
                    maxLength={MAX_ALT}
                  />
                </Campo>
              </div>
            </li>
          );
        })}
      </ol>
      {banners.length < MAX_BANNERS_LOJA_MARCA && (
        <EscolherImagem
          rotulo={banners.length ? "Adicionar banner" : "Subir o primeiro banner"}
          ocupado={subindo === "novo"}
          onArquivo={(f) =>
            void subir("novo", f, (p) =>
              onMudar([...banners, { imagemPath: p, celularPath: null, link: "", alt: "" }]),
            )
          }
        />
      )}
      <p className="font-sans text-[12px] text-[var(--muted)]">
        Banner novo ou trocado só aparece na loja depois de "Salvar títulos e banners".
      </p>
    </Secao>
  );
}

function CapasDasColecoes({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const colecoes = useColecoesDaLoja(userId);
  const [ocupada, setOcupada] = useState<string | null>(null);

  const trocar = async (c: ColecaoDaLoja, arquivo: File | null) => {
    setOcupada(c.id);
    let path: string | null = null;
    if (arquivo) {
      const up = await subirImagemDaLoja(userId, arquivo, "colecao");
      if (up.error || !up.path) {
        setOcupada(null);
        return toastErro(up.error ?? "A Pólia One não conseguiu subir a imagem agora.");
      }
      path = up.path;
    }
    const r = await trocarCapaDaColecao(c, path);
    setOcupada(null);
    if (r.error) return toastErro(r.error);
    toastSucesso(
      path ? `Capa de ${c.nome} trocada.` : `${c.nome} voltou pra foto do primeiro produto.`,
    );
    await qc.invalidateQueries({ queryKey: chaveColecoes(userId) });
  };

  return (
    <Secao
      titulo="Capas das coleções"
      texto="A imagem das bolinhas e dos cartões de Explore por coleção. Sem capa, a loja usa a foto do primeiro produto da coleção. Vale na hora, sem salvar."
    >
      {colecoes.isError ? (
        <BlockError
          message="A Pólia One não conseguiu ler as coleções."
          onRetry={() => colecoes.refetch()}
        />
      ) : colecoes.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      ) : !colecoes.data?.length ? (
        <p className="font-sans text-[13px] text-[var(--ink-soft)]">
          Nenhuma coleção ainda. Crie em Produtos: abra um produto e, em "Coleção", escolha "+ Nova
          coleção".
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {colecoes.data.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3"
            >
              {c.capaPath ? (
                <img
                  src={urlDaImagemDaLoja(c.capaPath)}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-full border border-[var(--line)] object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--line)] text-center font-sans text-[10px] text-[var(--muted)]">
                  Foto do produto
                </div>
              )}
              <div className="min-w-0 space-y-1">
                <p className="truncate font-sans text-[14px] font-medium text-[var(--ink)]">
                  {c.nome}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <EscolherImagem
                    rotulo={c.capaPath ? "Trocar" : "Subir capa"}
                    ocupado={ocupada === c.id}
                    onArquivo={(f) => void trocar(c, f)}
                  />
                  {c.capaPath && (
                    <button
                      type="button"
                      className="min-h-11 px-1 font-sans text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
                      onClick={() => void trocar(c, null)}
                      disabled={ocupada === c.id}
                    >
                      Tirar
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}
