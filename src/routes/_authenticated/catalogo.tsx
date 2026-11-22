import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ExternalLink, ImagePlus, Store, Trash2 } from "lucide-react";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useUserMeta } from "@/hooks/useUserMeta";
import { PaginaLogada } from "@/components/layout/PaginaLogada";
import { UpgradeGate } from "@/components/layout/UpgradeGate";
import { Vazio } from "@/components/layout/Vazio";
import { BlockError } from "@/components/ui/BlockError";
import { Campo } from "@/components/ui/Campo";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { Switch } from "@/components/ui/switch";
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import { temProjete } from "@/lib/planos";
import { formatarWhatsapp, sugerirSlug } from "@/lib/leads";
import { MAX_BANNERS, MAX_FOTOS_PRODUTO, lerCoresColadas, reais, slugValido, type ConfigLoja } from "@/lib/loja";
import { abrirFecharLoja, lerMeuCatalogo, salvarCatalogo, trocarCapaCatalogo } from "@/lib/loja.functions";
import { useIdentidadeMarca } from "@/components/orcamentos/dados";
import { useTemLojaDaMarca } from "@/components/lojaDaMarca/dados";
import {
  CHAVE_BANNERS_CATALOGO,
  CHAVE_CATALOGO,
  CHAVE_CORES_CATALOGO,
  adicionarCores,
  atualizarCor,
  removerCor,
  salvarOrdemDasCores,
  useCoresDaVitrine,
  type CorDaPaleta,
  CHAVE_PRODUTOS_CATALOGO,
  chaveCategorias,
  criarCategoria,
  mudarCategoria,
  moverNaLista,
  removerBanner,
  removerFotoProduto,
  salvarOrdemDaVitrine,
  salvarOrdemDosBanners,
  subirBanner,
  subirCapa,
  subirFotoProduto,
  useBannersDaVitrine,
  useCategoriasDaVitrine,
  useProdutosDoCatalogo,
  type BannerDaVitrine,
  type ProdutoDoCatalogo,
  type TipoDaCategoria,
} from "@/components/catalogo/dados";

// Vitrine online (ONE-148, fases 2 e 3, só no Pro; até 22/11/2026 o menu
// chamava de "Catálogo", a rota continua /catalogo). A dona monta a loja da
// marca: endereço, cara da loja, banner rotativo, como vende e quais produtos
// aparecem e em que ordem, com até 4 fotos cada. A loja pública é
// /loja/<endereço> e o pedido cai em Pedidos.

export const Route = createFileRoute("/_authenticated/catalogo")({
  head: () => ({
    meta: [
      { title: "Vitrine online · Pólia One" },
      { name: "description", content: "A loja da marca, com os produtos da Pólia One e pedido direto no quadro." },
    ],
  }),
  component: CatalogoPage,
});

const ENDERECO_BASE = "one.usepolia.com.br/loja/";
const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[15px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)]";

type Form = Omit<ConfigLoja, "prazoDiasUteis" | "sinalPercentual"> & { prazoDiasUteis: string; sinalPercentual: string };

function CatalogoPage() {
  const { user } = useSupabaseSession();
  const userId = user?.id;
  const meta = useUserMeta();
  const ehPro = temProjete(meta.plano);
  const qc = useQueryClient();
  const marca = useIdentidadeMarca(userId);

  const catQuery = useQuery({
    queryKey: [CHAVE_CATALOGO, userId],
    enabled: !!userId && ehPro,
    queryFn: () => lerMeuCatalogo(),
  });
  const cat = catQuery.data?.catalogo ?? null;

  const [form, setForm] = useState<Form | null>(null);
  const [tentou, setTentou] = useState(false);
  const [trocandoAberta, setTrocandoAberta] = useState(false);
  useEffect(() => {
    if (form || !catQuery.isSuccess) return;
    setForm({
      slug: cat?.slug ?? sugerirSlug(marca.data?.nome ?? ""),
      ativo: cat?.ativo ?? false,
      chamada: cat?.chamada ?? "",
      subchamada: cat?.subchamada ?? "",
      corDestaque: cat?.cor_destaque ?? marca.data?.cor ?? "",
      whatsapp: cat?.whatsapp ? formatarWhatsapp(cat.whatsapp) : "",
      instagram: cat?.instagram ?? "",
      prazoDiasUteis: String(cat?.prazo_dias_uteis ?? 7),
      sinalPercentual: String(cat?.sinal_percentual ?? 0),
      entregaTexto: cat?.entrega_texto ?? "",
      pedeEndereco: cat?.pede_endereco ?? true,
      aviso: cat?.aviso ?? "",
      mostrarCores: cat?.mostrar_cores ?? true,
      avisoCor: cat?.aviso_cor ?? "",
    });
  }, [catQuery.isSuccess, cat, form, marca.data]);

  const salvar = useMutation({
    mutationFn: (f: Form) =>
      salvarCatalogo({
        data: { ...f, prazoDiasUteis: Number(f.prazoDiasUteis), sinalPercentual: Number(f.sinalPercentual) } as ConfigLoja,
      }),
    onSuccess: (r) => {
      if (!r.ok) return toastErro(r.error);
      qc.invalidateQueries({ queryKey: [CHAVE_CATALOGO, userId] });
      toastSucesso("Loja salva.");
    },
    onError: () => toastErro("A Pólia One não conseguiu salvar a loja agora."),
  });

  if (meta.carregando) {
    return (
      <PaginaLogada eyebrow="Vitrine online" titulo="A loja da marca.">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      </PaginaLogada>
    );
  }
  if (!ehPro) {
    return (
      <UpgradeGate
        eyebrow="Vitrine online"
        titulo="A Vitrine online é do Pro"
        feature="Uma loja com os produtos da Pólia One, as fotos e as variações de cada um, carrinho e pedido que cai direto em Pedidos."
        rota="/catalogo"
      />
    );
  }

  const slugOk = !!form && slugValido(form.slug);
  const prazo = Number(form?.prazoDiasUteis);
  const sinal = Number(form?.sinalPercentual);
  const erros = {
    slug: tentou && !slugOk ? "Use de 3 a 40 letras minúsculas, números ou hífen, sem espaço." : undefined,
    prazo: tentou && !(prazo >= 1 && prazo <= 60) ? "Entre 1 e 60 dias úteis." : undefined,
    sinal: tentou && !(sinal >= 0 && sinal <= 100) ? "Entre 0 e 100%." : undefined,
  };
  const aberta = !!cat?.ativo;
  const enviar = (f: Form | null = form) => {
    setTentou(true);
    if (!f || !slugValido(f.slug) || !(prazo >= 1 && prazo <= 60) || !(sinal >= 0 && sinal <= 100)) return false;
    salvar.mutate(f);
    return true;
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  // O interruptor grava na hora: antes ele só mudava a tela e a loja seguia
  // fechada até o "Salvar a loja", lá embaixo (bug relatado em 22/11/2026).
  const abrirOuFechar = async (ativo: boolean) => {
    if (!form) return;
    set("ativo", ativo);
    if (!cat) {
      if (!enviar({ ...form, ativo })) set("ativo", !ativo);
      return;
    }
    setTrocandoAberta(true);
    try {
      const r = await abrirFecharLoja({ data: { ativo } });
      if (!r.ok) {
        set("ativo", !ativo);
        return toastErro(r.error);
      }
      qc.invalidateQueries({ queryKey: [CHAVE_CATALOGO, userId] });
      toastSucesso(ativo ? "Loja aberta. O endereço já recebe pedidos." : "Loja fechada. Nenhum pedido novo entra.");
    } catch {
      set("ativo", !ativo);
      toastErro("A Pólia One não conseguiu mudar a loja agora. Tenta de novo.");
    } finally {
      setTrocandoAberta(false);
    }
  };

  return (
    <PaginaLogada
      eyebrow="Vitrine online"
      titulo="A loja da marca, com pedido direto no quadro."
      subtitulo="A cliente escolhe, monta o carrinho e confirma. O pedido entra em Pedidos e ela segue pro WhatsApp da loja."
      acao={
        aberta && cat ? (
          <a className={BTN_MIUDO} href={`/loja/${cat.slug}`} target="_blank" rel="noopener">
            <ExternalLink size={14} aria-hidden="true" /> Ver a loja
          </a>
        ) : undefined
      }
    >
      {catQuery.isError ? (
        <BlockError message="A Pólia One não conseguiu abrir a Vitrine online agora." onRetry={() => catQuery.refetch()} />
      ) : !form ? (
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      ) : (
        <div className="space-y-6">
          <Secao titulo="Endereço" texto="Onde a loja mora. O endereço fica com a marca: depois de usado, não passa pra outra conta.">
            <Campo label="Endereço da loja" error={erros.slug} hint={`${ENDERECO_BASE}${form.slug || "sua-marca"}`}>
              <input className={INPUT} value={form.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} autoComplete="off" />
            </Campo>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] p-4">
              <div>
                <p className="font-sans text-[14px] font-medium text-[var(--ink)]">Loja aberta</p>
                <p className="font-sans text-[12px] text-[var(--ink-soft)]">
                  Vale na hora, sem precisar salvar. Fechada, o endereço mostra que a loja não está aberta agora e
                  nenhum pedido entra.
                </p>
              </div>
              <Switch
                checked={form.ativo}
                disabled={trocandoAberta || salvar.isPending}
                onCheckedChange={(v) => void abrirOuFechar(v)}
                aria-label="Loja aberta"
              />
            </div>
          </Secao>

          <Secao titulo="Cara da loja" texto="O logo e a cor vêm de Configurações. A capa e as frases são só da loja.">
            <div className="flex flex-wrap items-center gap-4">
              {marca.data?.logoUrl ? (
                <img src={marca.data.logoUrl} alt="Logo da marca" className="h-14 w-14 rounded-lg border border-[var(--line)] object-contain bg-white" />
              ) : (
                <span className="font-sans text-[13px] text-[var(--ink-soft)]">Sem logo: a loja mostra o nome da marca.</span>
              )}
              <LinkInterno href="/configuracoes#logo-e-cor" className={BTN_MIUDO}>Trocar o logo em Configurações</LinkInterno>
            </div>
            <Capa userId={userId!} capaUrl={cat?.capaUrl ?? null} temLoja={!!cat} />
            <Campo label="Cor de destaque" hint="Botões, preço do sinal e detalhes da loja. Vazio usa a cor da marca.">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.corDestaque || "#C8387F"}
                  onChange={(e) => set("corDestaque", e.target.value.toUpperCase())}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)]"
                  aria-label="Escolher a cor de destaque"
                />
                <input className={`${INPUT} max-w-[140px]`} value={form.corDestaque ?? ""} onChange={(e) => set("corDestaque", e.target.value)} placeholder="#C8387F" />
              </div>
            </Campo>
            <Campo label="Chamada" hint="A frase grande do topo da loja. Vazio mostra o nome da marca.">
              <input className={INPUT} value={form.chamada ?? ""} onChange={(e) => set("chamada", e.target.value)} maxLength={120} />
            </Campo>
            <Campo label="Texto de apoio">
              <textarea className={INPUT} rows={2} value={form.subchamada ?? ""} onChange={(e) => set("subchamada", e.target.value)} maxLength={300} />
            </Campo>
          </Secao>

          <BannerRotativo userId={userId!} />

          <Secao titulo="Como a loja vende" texto="Aparece pra cliente antes de ela confirmar e vai junto no pedido.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="WhatsApp da loja" hint="Pra onde a cliente manda o pedido depois de confirmar.">
                <input className={INPUT} inputMode="tel" value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="(11) 98888-0000" />
              </Campo>
              <Campo label="Instagram" hint="Sem o @ também vale.">
                <input className={INPUT} value={form.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} placeholder="@suamarca" />
              </Campo>
              <Campo label="Prazo de produção (dias úteis)" error={erros.prazo} hint="Marca o dia da entrega de cada pedido.">
                <input className={INPUT} type="number" min={1} max={60} value={form.prazoDiasUteis} onChange={(e) => set("prazoDiasUteis", e.target.value)} />
              </Campo>
              <Campo label="Sinal pra começar (%)" error={erros.sinal} hint="0 esconde o sinal da loja.">
                <input className={INPUT} type="number" min={0} max={100} value={form.sinalPercentual} onChange={(e) => set("sinalPercentual", e.target.value)} />
              </Campo>
            </div>
            <Campo label="Entrega" hint="Exemplo: envio pros Correios ou retirada em Moema, frete combinado pelo WhatsApp.">
              <input className={INPUT} value={form.entregaTexto ?? ""} onChange={(e) => set("entregaTexto", e.target.value)} maxLength={200} />
            </Campo>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] p-4">
              <div>
                <p className="font-sans text-[14px] font-medium text-[var(--ink)]">Pedir o endereço da cliente</p>
                <p className="font-sans text-[12px] text-[var(--ink-soft)]">Desligado, a loja pede só nome e WhatsApp.</p>
              </div>
              <Switch checked={form.pedeEndereco} onCheckedChange={(v) => set("pedeEndereco", v)} aria-label="Pedir o endereço da cliente" />
            </div>
            <Campo label="Aviso" hint="Uma frase que aparece na página do produto. Exemplo: as cores da foto podem variar na tela.">
              <input className={INPUT} value={form.aviso ?? ""} onChange={(e) => set("aviso", e.target.value)} maxLength={300} />
            </Campo>
          </Secao>

          <PaletaDeCores
            userId={userId!}
            mostrar={form.mostrarCores ?? true}
            aviso={form.avisoCor ?? ""}
            onMostrar={(v) => set("mostrarCores", v)}
            onAviso={(v) => set("avisoCor", v)}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={BTN_ACAO} onClick={() => enviar()} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar a loja"}
            </button>
            {!cat && <span className="font-sans text-[13px] text-[var(--ink-soft)]">Salve uma vez pra poder subir a capa.</span>}
          </div>

          <ProdutosDaLoja userId={userId!} onMudou={() => qc.invalidateQueries({ queryKey: [CHAVE_PRODUTOS_CATALOGO, userId] })} />
        </div>
      )}
    </PaginaLogada>
  );
}

function Secao({ titulo, texto, children }: { titulo: string; texto?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-4 sm:p-6 space-y-4">
      <div>
        <h2 className="font-cabinet text-[20px] font-bold text-[var(--ink)]">{titulo}</h2>
        {texto && <p className="font-sans text-[13px] text-[var(--ink-soft)] mt-1">{texto}</p>}
      </div>
      {children}
    </section>
  );
}

function Capa({ userId, capaUrl, temLoja }: { userId: string; capaUrl: string | null; temLoja: boolean }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [subindo, setSubindo] = useState(false);
  const trocar = async (arquivo: File | null) => {
    setSubindo(true);
    try {
      let caminho: string | null = null;
      if (arquivo) {
        const up = await subirCapa(userId, arquivo);
        if (up.error) return toastErro(up.error);
        caminho = up.caminho;
      }
      const r = await trocarCapaCatalogo({ data: { caminho } });
      if (!r.ok) return toastErro(r.error);
      qc.invalidateQueries({ queryKey: [CHAVE_CATALOGO, userId] });
      toastSucesso(arquivo ? "Capa trocada." : "Capa tirada. A loja mostra as fotos dos produtos.");
    } finally {
      setSubindo(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-4">
      {capaUrl ? (
        <img src={capaUrl} alt="Capa da loja" className="h-20 w-36 rounded-lg border border-[var(--line)] object-cover" />
      ) : (
        <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-[var(--line)] font-sans text-[12px] text-[var(--ink-soft)] text-center px-2">
          Sem capa: a loja usa as fotos dos produtos
        </div>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="capa-loja" onChange={(e) => trocar(e.target.files?.[0] ?? null)} disabled={!temLoja || subindo} />
      <label htmlFor="capa-loja" className={`${BTN_MIUDO} ${!temLoja || subindo ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
        <ImagePlus size={14} aria-hidden="true" /> {subindo ? "Subindo..." : capaUrl ? "Trocar a capa" : "Subir uma capa"}
      </label>
      {capaUrl && (
        <button type="button" className={BTN_MIUDO} onClick={() => trocar(null)} disabled={subindo}>
          Tirar a capa
        </button>
      )}
    </div>
  );
}

function ProdutosDaLoja({ userId, onMudou }: { userId: string; onMudou: () => void }) {
  const qc = useQueryClient();
  const q = useProdutosDoCatalogo(userId, true);
  const [ordenando, setOrdenando] = useState(false);
  const naVitrine = (q.data ?? []).filter((p) => p.noCatalogo);
  const fora = (q.data ?? []).filter((p) => !p.noCatalogo);

  // Sobe ou desce um produto. A tela muda na hora e a ordem inteira é regravada
  // (0, 1, 2...), a mesma que a loja pública lê em catalogo_ordem.
  const mover = async (indice: number, direcao: -1 | 1) => {
    const nova = moverNaLista(naVitrine, indice, direcao);
    const chave = [CHAVE_PRODUTOS_CATALOGO, userId];
    const antes = qc.getQueryData<ProdutoDoCatalogo[]>(chave);
    qc.setQueryData<ProdutoDoCatalogo[]>(chave, [...nova.map((p, i) => ({ ...p, ordem: i })), ...fora]);
    setOrdenando(true);
    const r = await salvarOrdemDaVitrine(nova.map((p) => p.id));
    setOrdenando(false);
    if (r.error) {
      qc.setQueryData(chave, antes);
      return toastErro(r.error);
    }
    onMudou();
  };

  return (
    <Secao
      titulo="Produtos na vitrine"
      texto="Quem entra na vitrine se escolhe em Produtos: abra o produto e marque “Mostrar na Vitrine online”. Aqui ficam a ordem, a categoria e as fotos (até 4, a primeira é a da vitrine)."
    >
      {q.isError ? (
        <BlockError message="A Pólia One não conseguiu abrir os produtos agora." onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      ) : !naVitrine.length ? (
        <Vazio
          icone={Store}
          titulo={q.data?.length ? "Nenhum produto na vitrine ainda" : "Nenhum produto cadastrado ainda"}
          texto={
            q.data?.length
              ? "Abra um produto em Produtos e marque “Mostrar na Vitrine online”. Ele aparece aqui, pra você escolher a ordem e a categoria."
              : "A vitrine mostra os produtos de Produtos. Cadastre o primeiro e marque “Mostrar na Vitrine online”."
          }
          acao={<LinkInterno href="/produtos" className={BTN_ACAO}>Abrir Produtos</LinkInterno>}
          denso
        />
      ) : (
        <>
          <p className="font-sans text-[13px] text-[var(--ink-soft)]">
            {`${naVitrine.length} ${naVitrine.length === 1 ? "produto na vitrine" : "produtos na vitrine"}, nesta ordem.`}{" "}
            <LinkInterno href="/produtos" className="font-medium text-[var(--secondary-text)] hover:underline">
              Pôr ou tirar produtos em Produtos
            </LinkInterno>
          </p>
          {naVitrine.length > 0 && (
            <ol
              className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)]"
              aria-label="Produtos na vitrine, na ordem em que aparecem"
            >
              {naVitrine.map((p, i) => (
                <LinhaProduto
                  key={p.id}
                  p={p}
                  userId={userId}
                  onMudou={onMudou}
                  posicao={{
                    numero: i + 1,
                    primeiro: i === 0,
                    ultimo: i === naVitrine.length - 1,
                    ocupado: ordenando,
                    subir: () => void mover(i, -1),
                    descer: () => void mover(i, 1),
                  }}
                />
              ))}
            </ol>
          )}
        </>
      )}
    </Secao>
  );
}

interface Posicao {
  numero: number;
  primeiro: boolean;
  ultimo: boolean;
  ocupado: boolean;
  subir: () => void;
  descer: () => void;
}

const BTN_SETA =
  "flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] hover:border-[var(--secondary-text)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)] disabled:opacity-40 disabled:pointer-events-none";

function BannerRotativo({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const q = useBannersDaVitrine(userId, true);
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const lista = q.data ?? [];
  const chave = [CHAVE_BANNERS_CATALOGO, userId];
  const recarregar = () => qc.invalidateQueries({ queryKey: chave });

  const subir = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setOcupado(true);
    const r = await subirBanner(userId, arquivo, lista);
    setOcupado(false);
    if (input.current) input.current.value = "";
    if (r.error) return toastErro(r.error);
    toastSucesso("Banner na vitrine.");
    recarregar();
  };
  const tirar = async (b: BannerDaVitrine) => {
    setOcupado(true);
    const r = await removerBanner(b);
    setOcupado(false);
    if (r.error) return toastErro(r.error);
    recarregar();
  };
  const mover = async (i: number, direcao: -1 | 1) => {
    const nova = moverNaLista(lista, i, direcao);
    qc.setQueryData<BannerDaVitrine[]>(chave, nova.map((b, k) => ({ ...b, ordem: k })));
    setOcupado(true);
    const r = await salvarOrdemDosBanners(nova);
    setOcupado(false);
    if (r.error) toastErro(r.error);
    recarregar();
  };

  return (
    <Secao
      titulo="Banner rotativo"
      texto={`Até ${MAX_BANNERS} imagens que passam sozinhas no topo da vitrine, uma a cada 5 segundos. Use imagem deitada, de 1600 x 600 px, em JPG, PNG ou WEBP de até 3 MB. Sem banner, o topo fica como está.`}
    >
      {q.isError ? (
        <BlockError message="A Pólia One não conseguiu abrir os banners agora." onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      ) : (
        <div className="space-y-3">
          {lista.length > 0 && (
            <ol className="grid gap-3 sm:grid-cols-2" aria-label="Banners, na ordem em que passam">
              {lista.map((b, i) => (
                <li key={b.id} className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                  <img
                    src={b.url}
                    alt={`Banner ${i + 1}`}
                    className="aspect-[8/3] w-full rounded-lg border border-[var(--line)] object-cover"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans text-[13px] text-[var(--ink-soft)]">{i + 1}º a aparecer</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={BTN_SETA}
                        onClick={() => void mover(i, -1)}
                        disabled={ocupado || i === 0}
                        aria-label={`Passar o banner ${i + 1} pra antes`}
                      >
                        <ArrowLeft size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={BTN_SETA}
                        onClick={() => void mover(i, 1)}
                        disabled={ocupado || i === lista.length - 1}
                        aria-label={`Passar o banner ${i + 1} pra depois`}
                      >
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className={`${BTN_SETA} hover:text-[var(--danger)]`}
                        onClick={() => void tirar(b)}
                        disabled={ocupado}
                        aria-label={`Tirar o banner ${i + 1}`}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {lista.length < MAX_BANNERS ? (
            <>
              <input
                ref={input}
                id="banner-loja"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => void subir(e.target.files?.[0])}
                disabled={ocupado}
              />
              <label
                htmlFor="banner-loja"
                className={`${BTN_MIUDO} ${ocupado ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
              >
                <ImagePlus size={14} aria-hidden="true" />{" "}
                {ocupado ? "Subindo..." : lista.length ? "Subir mais um banner" : "Subir o primeiro banner"}
              </label>
            </>
          ) : (
            <p className="font-sans text-[13px] text-[var(--ink-soft)]">
              Os {MAX_BANNERS} lugares estão ocupados. Tire um pra subir outro.
            </p>
          )}
        </div>
      )}
    </Secao>
  );
}

function LinhaProduto({
  p,
  userId,
  onMudou,
  posicao,
}: {
  p: ProdutoDoCatalogo;
  userId: string;
  onMudou: () => void;
  posicao?: Posicao;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const subir = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setOcupado(true);
    const r = await subirFotoProduto(userId, p.id, arquivo, p.fotos.map((f) => f.ordem));
    setOcupado(false);
    if (input.current) input.current.value = "";
    if (r.error) return toastErro(r.error);
    onMudou();
  };
  const tirar = async (i: number) => {
    setOcupado(true);
    const r = await removerFotoProduto(p.fotos[i]);
    setOcupado(false);
    if (r.error) return toastErro(r.error);
    onMudou();
  };
  const idInput = `foto-${p.id}`;
  // Coleção só existe na loja da marca (site próprio); a Vitrine online filtra por categoria.
  const lojaDaMarca = useTemLojaDaMarca(userId);
  return (
    <li className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        {posicao && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="w-6 text-right font-sans text-[13px] font-medium text-[var(--muted)]">{posicao.numero}º</span>
            <button type="button" className={BTN_SETA} onClick={posicao.subir} disabled={posicao.ocupado || posicao.primeiro} aria-label={`Subir ${p.nome} na vitrine`}>
              <ArrowUp size={16} aria-hidden="true" />
            </button>
            <button type="button" className={BTN_SETA} onClick={posicao.descer} disabled={posicao.ocupado || posicao.ultimo} aria-label={`Descer ${p.nome} na vitrine`}>
              <ArrowDown size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[14px] font-medium text-[var(--ink)] truncate">{p.nome}</p>
          <p className="font-sans text-[12px] text-[var(--ink-soft)]">
            {reais(p.preco)}
            {p.variacoes ? ` · ${p.variacoes} ${p.variacoes === 1 ? "variação" : "variações"}` : ""}
            {!p.fotos.length ? " · sem foto ainda" : ""}
          </p>
        </div>
      </div>
      {p.noCatalogo && (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <SeletorCategoria p={p} userId={userId} onMudou={onMudou} />
          {lojaDaMarca.data === true && <SeletorCategoria p={p} userId={userId} onMudou={onMudou} tipo="colecao" />}
        </div>
      )}
      {p.noCatalogo && (
        <div className="flex flex-wrap items-center gap-3">
          {p.fotos.map((f, i) => (
            <div key={f.id} className="relative">
              <img src={f.url} alt={`Foto ${i + 1} de ${p.nome}`} className="h-20 w-16 rounded-lg border border-[var(--line)] object-cover" />
              <button
                type="button"
                onClick={() => tirar(i)}
                disabled={ocupado}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:text-[var(--danger)]"
                aria-label={`Tirar a foto ${i + 1} de ${p.nome}`}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>
          ))}
          {p.fotos.length < MAX_FOTOS_PRODUTO && (
            <>
              <input ref={input} id={idInput} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => subir(e.target.files?.[0])} disabled={ocupado} />
              <label
                htmlFor={idInput}
                className={`flex h-20 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--line)] font-sans text-[11px] text-[var(--ink-soft)] ${ocupado ? "opacity-50" : "cursor-pointer hover:border-[var(--secondary-text)]"}`}
              >
                <ImagePlus size={16} aria-hidden="true" />
                {ocupado ? "..." : "Foto"}
              </label>
            </>
          )}
        </div>
      )}
    </li>
  );
}

const NOVA = "__nova__";

/**
 * Categoria do produto na vitrine (22/11/2026). A cliente filtra a vitrine por
 * ela. Mesma tabela da loja de marca (produto_categorias): criar aqui aparece lá.
 * Com tipo "colecao", o mesmo seletor escolhe a coleção (tema da estampa).
 */
function SeletorCategoria({
  p,
  userId,
  onMudou,
  tipo = "categoria",
}: {
  p: ProdutoDoCatalogo;
  userId: string;
  onMudou: () => void;
  tipo?: TipoDaCategoria;
}) {
  const qc = useQueryClient();
  const todas = useCategoriasDaVitrine(userId);
  const ehColecao = tipo === "colecao";
  const palavra = ehColecao ? "coleção" : "categoria";
  const opcoes = (todas.data ?? []).filter((c) => (ehColecao ? c.tipo === "colecao" : c.tipo !== "colecao"));
  const atual = ehColecao ? p.colecaoId : p.categoriaId;
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idSelect = `${tipo}-${p.id}`;
  const idNova = `${tipo}-nova-${p.id}`;

  const escolher = async (valor: string) => {
    if (valor === NOVA) {
      setCriando(true);
      setErro(null);
      return;
    }
    setOcupado(true);
    const r = await mudarCategoria(p.id, valor || null, tipo);
    setOcupado(false);
    if (r.error) return toastErro(r.error);
    onMudou();
  };
  const criar = async () => {
    setOcupado(true);
    setErro(null);
    const r = await criarCategoria(userId, nome, tipo);
    if (r.error || !r.id) {
      setOcupado(false);
      return setErro(r.error);
    }
    await qc.invalidateQueries({ queryKey: chaveCategorias(userId) });
    const m = await mudarCategoria(p.id, r.id, tipo);
    setOcupado(false);
    if (m.error) return toastErro(m.error);
    setCriando(false);
    setNome("");
    toastSucesso(ehColecao ? "Coleção criada." : "Categoria criada.");
    onMudou();
  };

  if (criando)
    return (
      <div className="space-y-1">
        <label htmlFor={idNova} className="font-sans text-[13px] font-medium text-[var(--ink)]">
          Nome da {palavra} nova
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id={idNova}
            className={`${INPUT} max-w-[260px]`}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void criar();
            }}
            maxLength={60}
            placeholder={ehColecao ? "Ex.: Natal" : "Ex.: Bolsas"}
            aria-invalid={!!erro}
            aria-describedby={erro ? `${idNova}-erro` : undefined}
            autoFocus
          />
          <button type="button" className={BTN_MIUDO} onClick={() => void criar()} disabled={ocupado || !nome.trim()}>
            {ocupado ? "Criando..." : "Criar"}
          </button>
          <button
            type="button"
            className="min-h-11 px-2 font-sans text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
            onClick={() => {
              setCriando(false);
              setNome("");
              setErro(null);
            }}
          >
            Cancelar
          </button>
        </div>
        {erro && (
          <p id={`${idNova}-erro`} role="alert" className="font-sans text-[12px] text-[var(--danger)]">
            {erro}
          </p>
        )}
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={idSelect} className="font-sans text-[13px] font-medium text-[var(--ink)]">
        {ehColecao ? "Coleção" : "Categoria"}
      </label>
      <select
        id={idSelect}
        className={`${INPUT} max-w-[260px] py-2`}
        value={atual ?? ""}
        onChange={(e) => void escolher(e.target.value)}
        disabled={ocupado || todas.isLoading}
      >
        <option value="">{ehColecao ? "Sem coleção" : "Sem categoria"}</option>
        {opcoes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
        <option value={NOVA}>{ehColecao ? "+ Nova coleção" : "+ Nova categoria"}</option>
      </select>
      {todas.isError && (
        <span className="font-sans text-[12px] text-[var(--danger)]">A Pólia One não conseguiu ler as categorias.</span>
      )}
    </div>
  );
}

/**
 * Paleta de cores da loja (ONE-217, modelo da Loveless). Cada cor salva na
 * hora; a chave "mostrar" e o aviso vão com o "Salvar a loja", como o resto
 * da configuração. Cada conta tem a sua paleta.
 */
function PaletaDeCores({
  userId,
  mostrar,
  aviso,
  onMostrar,
  onAviso,
}: {
  userId: string;
  mostrar: boolean;
  aviso: string;
  onMostrar: (v: boolean) => void;
  onAviso: (v: string) => void;
}) {
  const qc = useQueryClient();
  const q = useCoresDaVitrine(userId);
  const lista = q.data ?? [];
  const chave = [CHAVE_CORES_CATALOGO, userId];
  const recarregar = () => qc.invalidateQueries({ queryKey: chave });
  const [ocupado, setOcupado] = useState(false);
  const [nova, setNova] = useState({ codigo: "", nome: "", hex: "#C8387F" });
  const [erroNova, setErroNova] = useState<string | null>(null);
  const [colando, setColando] = useState(false);
  const [colado, setColado] = useState("");
  const [avisoColado, setAvisoColado] = useState<string | null>(null);

  const adicionarUma = async () => {
    if (!nova.nome.trim()) return setErroNova("Escreva o nome da cor.");
    setErroNova(null);
    setOcupado(true);
    const r = await adicionarCores(userId, [{ codigo: nova.codigo || null, nome: nova.nome, hex: nova.hex }], lista.length);
    setOcupado(false);
    if (r.error) return toastErro(r.error);
    setNova((n) => ({ ...n, codigo: "", nome: "" }));
    recarregar();
  };
  const adicionarColadas = async () => {
    const { cores, ignoradas } = lerCoresColadas(colado);
    if (!cores.length) {
      setAvisoColado("Nenhuma linha com cor. Use uma por linha, por exemplo: 801 Azul Bondi #6DA9D2");
      return;
    }
    setOcupado(true);
    const r = await adicionarCores(userId, cores, lista.length);
    setOcupado(false);
    if (r.error) return toastErro(r.error);
    toastSucesso(`${cores.length} ${cores.length === 1 ? "cor entrou" : "cores entraram"} na paleta.`);
    setAvisoColado(ignoradas ? `${ignoradas} ${ignoradas === 1 ? "linha ficou" : "linhas ficaram"} de fora, sem cor no formato #RRGGBB.` : null);
    setColado("");
    if (!ignoradas) setColando(false);
    recarregar();
  };
  const salvarCampo = async (c: CorDaPaleta, campos: Partial<Pick<CorDaPaleta, "codigo" | "nome" | "hex">>) => {
    if (campos.nome !== undefined && !campos.nome.trim()) return recarregar();
    const r = await atualizarCor(c.id, campos);
    if (r.error) toastErro(r.error);
    recarregar();
  };
  const mover = async (i: number, direcao: -1 | 1) => {
    const nova = moverNaLista(lista, i, direcao);
    qc.setQueryData<CorDaPaleta[]>(chave, nova.map((c, k) => ({ ...c, ordem: k })));
    setOcupado(true);
    const r = await salvarOrdemDasCores(nova);
    setOcupado(false);
    if (r.error) toastErro(r.error);
    recarregar();
  };
  const tirar = async (c: CorDaPaleta) => {
    setOcupado(true);
    const r = await removerCor(c.id);
    setOcupado(false);
    if (r.error) return toastErro(r.error);
    recarregar();
  };

  return (
    <Secao
      titulo="Paleta de cores"
      texto="As cores que a cliente pode escolher. Valem pra todo produto marcado, em Produtos, com “A cliente escolhe a cor da paleta”. Cada cor salva na hora."
    >
      {q.isError ? (
        <BlockError message="A Pólia One não conseguiu abrir a paleta agora." onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      ) : (
        <div className="space-y-3">
          {lista.length > 0 ? (
            <ol
              className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)]"
              aria-label="Cores da paleta, na ordem em que aparecem"
            >
              {lista.map((c, i) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 p-3">
                  <input
                    type="color"
                    defaultValue={c.hex}
                    onBlur={(e) => e.target.value.toUpperCase() !== c.hex.toUpperCase() && void salvarCampo(c, { hex: e.target.value.toUpperCase() })}
                    className="h-11 w-11 cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)]"
                    aria-label={`Cor de ${c.nome}`}
                  />
                  <input
                    className={`${INPUT} w-20`}
                    defaultValue={c.codigo ?? ""}
                    maxLength={12}
                    placeholder="Código"
                    onBlur={(e) => e.target.value.trim() !== (c.codigo ?? "") && void salvarCampo(c, { codigo: e.target.value.trim() || null })}
                    aria-label={`Código de ${c.nome}`}
                  />
                  <input
                    className={`${INPUT} min-w-[140px] flex-1`}
                    defaultValue={c.nome}
                    maxLength={40}
                    onBlur={(e) => e.target.value.trim() !== c.nome && void salvarCampo(c, { nome: e.target.value.trim() })}
                    aria-label={`Nome da cor ${i + 1}`}
                  />
                  <button type="button" className={BTN_SETA} onClick={() => void mover(i, -1)} disabled={ocupado || i === 0} aria-label={`Subir ${c.nome}`}>
                    <ArrowUp size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className={BTN_SETA} onClick={() => void mover(i, 1)} disabled={ocupado || i === lista.length - 1} aria-label={`Descer ${c.nome}`}>
                    <ArrowDown size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className={`${BTN_SETA} hover:text-[var(--danger)]`} onClick={() => void tirar(c)} disabled={ocupado} aria-label={`Tirar ${c.nome}`}>
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="font-sans text-[13px] text-[var(--ink-soft)]">
              Nenhuma cor ainda. Adicione uma por uma ou cole a lista inteira.
            </p>
          )}

          <div className="space-y-1 rounded-xl border border-dashed border-[var(--line)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={nova.hex}
                onChange={(e) => setNova((n) => ({ ...n, hex: e.target.value.toUpperCase() }))}
                className="h-11 w-11 cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)]"
                aria-label="Cor nova"
              />
              <input
                className={`${INPUT} w-20`}
                value={nova.codigo}
                onChange={(e) => setNova((n) => ({ ...n, codigo: e.target.value }))}
                maxLength={12}
                placeholder="Código"
                aria-label="Código da cor nova (opcional)"
              />
              <input
                className={`${INPUT} min-w-[140px] flex-1`}
                value={nova.nome}
                onChange={(e) => {
                  setNova((n) => ({ ...n, nome: e.target.value }));
                  setErroNova(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void adicionarUma();
                }}
                maxLength={40}
                placeholder="Nome, ex.: Azul Bondi"
                aria-label="Nome da cor nova"
                aria-invalid={!!erroNova}
              />
              <button type="button" className={BTN_MIUDO} onClick={() => void adicionarUma()} disabled={ocupado}>
                Adicionar cor
              </button>
            </div>
            {erroNova && (
              <p role="alert" className="font-sans text-[12px] text-[var(--danger)]">
                {erroNova}
              </p>
            )}
          </div>

          {colando ? (
            <div className="space-y-2">
              <Campo label="Cole a lista, uma cor por linha" hint="Código (opcional), nome e a cor no formato #RRGGBB. Ex.: 801 Azul Bondi #6DA9D2">
                <textarea className={INPUT} rows={6} value={colado} onChange={(e) => setColado(e.target.value)} />
              </Campo>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={BTN_MIUDO} onClick={() => void adicionarColadas()} disabled={ocupado || !colado.trim()}>
                  Adicionar as cores
                </button>
                <button
                  type="button"
                  className="min-h-11 px-2 font-sans text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
                  onClick={() => {
                    setColando(false);
                    setColado("");
                    setAvisoColado(null);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={BTN_MIUDO} onClick={() => setColando(true)}>
              Colar várias de uma vez
            </button>
          )}
          {avisoColado && (
            <p role="status" className="font-sans text-[12px] text-[var(--ink-soft)]">
              {avisoColado}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--line)] p-4">
            <div>
              <p className="font-sans text-[14px] font-medium text-[var(--ink)]">Mostrar as cores na página inicial</p>
              <p className="font-sans text-[12px] text-[var(--ink-soft)]">
                Uma faixa com a paleta e a seção “Escolha a sua cor”. Vale depois de “Salvar a loja”.
              </p>
            </div>
            <Switch checked={mostrar} onCheckedChange={onMostrar} aria-label="Mostrar as cores na página inicial" />
          </div>
          <Campo label="Aviso sobre as cores" hint="Aparece junto da paleta. Ex.: as cores da tela são uma referência e podem variar no fio. Vale depois de “Salvar a loja”.">
            <input className={INPUT} value={aviso} onChange={(e) => onAviso(e.target.value)} maxLength={300} />
          </Campo>
        </div>
      )}
    </Secao>
  );
}
