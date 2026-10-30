import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ImagePlus, Store, Trash2 } from "lucide-react";
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
import { MAX_FOTOS_PRODUTO, reais, slugValido, type ConfigLoja } from "@/lib/loja";
import { lerMeuCatalogo, salvarCatalogo, trocarCapaCatalogo } from "@/lib/loja.functions";
import { useIdentidadeMarca } from "@/components/orcamentos/dados";
import {
  CHAVE_CATALOGO,
  CHAVE_PRODUTOS_CATALOGO,
  alternarNaLoja,
  removerFotoProduto,
  subirCapa,
  subirFotoProduto,
  useProdutosDoCatalogo,
  type ProdutoDoCatalogo,
} from "@/components/catalogo/dados";

// Catálogo (ONE-148, fases 2 e 3, só no Pro). A dona monta a loja da marca:
// endereço, cara da loja, como vende e quais produtos aparecem, com até 4 fotos
// cada. A loja pública é /loja/<endereço> e o pedido cai em Pedidos.

export const Route = createFileRoute("/_authenticated/catalogo")({
  head: () => ({
    meta: [
      { title: "Catálogo · Pólia One" },
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
      <PaginaLogada eyebrow="Catálogo" titulo="A loja da marca.">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      </PaginaLogada>
    );
  }
  if (!ehPro) {
    return (
      <UpgradeGate
        eyebrow="Catálogo"
        titulo="A loja do catálogo é do Pro"
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
  const enviar = () => {
    setTentou(true);
    if (!form || !slugOk || erros.prazo || erros.sinal || !(prazo >= 1 && prazo <= 60) || !(sinal >= 0 && sinal <= 100)) return;
    salvar.mutate(form);
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <PaginaLogada
      eyebrow="Catálogo"
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
        <BlockError message="A Pólia One não conseguiu abrir o catálogo agora." onRetry={() => catQuery.refetch()} />
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
                  Fechada, o endereço mostra que a loja não está aberta agora e nenhum pedido entra.
                </p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => set("ativo", v)} aria-label="Loja aberta" />
            </div>
          </Secao>

          <Secao titulo="Cara da loja" texto="O logo e a cor vêm de Marca. A capa e as frases são só da loja.">
            <div className="flex flex-wrap items-center gap-4">
              {marca.data?.logoUrl ? (
                <img src={marca.data.logoUrl} alt="Logo da marca" className="h-14 w-14 rounded-lg border border-[var(--line)] object-contain bg-white" />
              ) : (
                <span className="font-sans text-[13px] text-[var(--ink-soft)]">Sem logo: a loja mostra o nome da marca.</span>
              )}
              <LinkInterno href="/marca" className={BTN_MIUDO}>Trocar o logo em Marca</LinkInterno>
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

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={BTN_ACAO} onClick={enviar} disabled={salvar.isPending}>
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
  const q = useProdutosDoCatalogo(userId, true);
  const naLoja = (q.data ?? []).filter((p) => p.noCatalogo).length;
  return (
    <Secao
      titulo="Produtos na loja"
      texto="Preço, nome e variações vêm de Produtos. Cada um leva até 4 fotos: a primeira é a da vitrine."
    >
      {q.isError ? (
        <BlockError message="A Pólia One não conseguiu abrir os produtos agora." onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-[var(--surface)] motion-reduce:animate-none" />
      ) : !q.data?.length ? (
        <Vazio
          icone={Store}
          titulo="Nenhum produto cadastrado ainda"
          texto="A loja mostra os produtos de Produtos. Cadastre o primeiro e volte aqui."
          acao={<LinkInterno href="/produtos" className={BTN_ACAO}>Abrir Produtos</LinkInterno>}
          denso
        />
      ) : (
        <>
          <p className="font-sans text-[13px] text-[var(--ink-soft)]">
            {naLoja === 0 ? "Nenhum produto na loja ainda." : `${naLoja} ${naLoja === 1 ? "produto na loja" : "produtos na loja"}.`}
          </p>
          <ul className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            {q.data.map((p) => (
              <LinhaProduto key={p.id} p={p} userId={userId} onMudou={onMudou} />
            ))}
          </ul>
        </>
      )}
    </Secao>
  );
}

function LinhaProduto({ p, userId, onMudou }: { p: ProdutoDoCatalogo; userId: string; onMudou: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const alternar = async (v: boolean) => {
    setOcupado(true);
    const { error } = await alternarNaLoja(p.id, v);
    setOcupado(false);
    if (error) return toastErro("A Pólia One não conseguiu mudar o produto agora.");
    onMudou();
  };
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
  return (
    <li className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-sans text-[14px] font-medium text-[var(--ink)] truncate">{p.nome}</p>
          <p className="font-sans text-[12px] text-[var(--ink-soft)]">
            {reais(p.preco)}
            {p.variacoes ? ` · ${p.variacoes} ${p.variacoes === 1 ? "variação" : "variações"}` : ""}
            {p.noCatalogo && !p.fotos.length ? " · sem foto ainda" : ""}
          </p>
        </div>
        <Switch checked={p.noCatalogo} disabled={ocupado} onCheckedChange={alternar} aria-label={`${p.nome} na loja`} />
      </div>
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
