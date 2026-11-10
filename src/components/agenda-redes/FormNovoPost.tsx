import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Film, ImagePlus, Trash2 } from "lucide-react";
import { BTN_ACAO, BTN_MIUDO } from "@/lib/botoes";
import { toastSucesso } from "@/lib/toast";
import { LinkInterno } from "@/components/ui/LinkInterno";
import { agendarPostRedes, lerContaTiktok } from "@/lib/redesPosts.functions";
import type { StatusRede } from "@/lib/redesSociais.functions";
import { NOME_REDE, type Rede } from "../../../supabase/functions/_shared/redesSociais.ts";
import {
  ESCOLHAS_TIKTOK_INICIAIS,
  LEGENDA_MAX,
  TITULO_FOTOS_MAX,
  fraseIncluiPoliticaDeMarca,
  normalizarEscolhas,
  problemasDoPost,
  type EntradaPost,
  type EscolhasTiktok,
  type QuandoPost,
  type TipoPost,
} from "../../../supabase/functions/_shared/redesPosts.ts";
import { BlocoTiktok } from "./BlocoTiktok";
import { CAIXA, CHAVE_POSTS_REDES, ROTULO, deBrasiliaParaIso } from "./comum";
import { apagarPecas, prepararPeca, subirPecas, type Peca } from "./midias";

// Novo post da Agenda das redes (ONE-155), na ordem do wireframe aprovado em
// 09/11: arquivos, onde sai, legenda, regras do TikTok, quando. A ação é uma
// só: agendar. A tela confere as regras antes de subir os arquivos; o servidor
// confere de novo com a conta do TikTok lida na hora.

const MUSICA = "https://www.tiktok.com/legal/page/global/music-usage-confirmation/en";
const POLITICA_MARCA = "https://www.tiktok.com/legal/page/global/bc-policy/en";
const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 font-sans text-[15px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)]";

export function FormNovoPost({ userId, redes }: { userId: string; redes: StatusRede[] }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const idArquivos = useId();
  const idLegenda = useId();
  const idTitulo = useId();
  const idHora = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const postId = useMemo(() => crypto.randomUUID(), []);

  const [pecas, setPecas] = useState<Peca[]>([]);
  const [lendo, setLendo] = useState(false);
  const [avisoArquivo, setAvisoArquivo] = useState<string | null>(null);
  const [destinos, setDestinos] = useState<Rede[]>([]);
  const [legenda, setLegenda] = useState("");
  const [titulo, setTitulo] = useState("");
  const [escolhas, setEscolhas] = useState<EscolhasTiktok>(ESCOLHAS_TIKTOK_INICIAIS);
  const [modo, setModo] = useState<"agora" | "agendar">("agendar");
  const [hora, setHora] = useState("");
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erros, setErros] = useState<string[]>([]);

  // Prévias são objetos vivos: saem quando a peça sai e quando a tela fecha.
  const pecasRef = useRef<Peca[]>([]);
  pecasRef.current = pecas;
  useEffect(() => () => pecasRef.current.forEach((p) => URL.revokeObjectURL(p.previa)), []);

  const conectadas = redes.filter((r) => r.conectada);
  const temTt = destinos.includes("tiktok");
  const tipo: TipoPost = pecas.some((p) => p.tipo === "video") ? "video" : "fotos";

  // creator_info ao abrir o bloco do TikTok, e não guardado: a regra é ler o da hora.
  const conta = useQuery({
    queryKey: ["redes-conta-tiktok", userId],
    enabled: temTt,
    staleTime: 0,
    gcTime: 0,
    queryFn: () => lerContaTiktok(),
  });
  const criador = conta.data?.info ?? null;

  async function receber(lista: FileList | null) {
    if (!lista?.length) return;
    setAvisoArquivo(null);
    setLendo(true);
    const novas: Peca[] = [];
    for (const f of Array.from(lista)) {
      const { peca, erro } = await prepararPeca(f);
      if (peca) novas.push(peca);
      else if (erro) setAvisoArquivo(erro);
    }
    setPecas((atual) => [...atual, ...novas]);
    setLendo(false);
    if (entrada.current) entrada.current.value = "";
  }

  function tirar(chave: string) {
    setPecas((atual) => {
      const sai = atual.find((p) => p.chave === chave);
      if (sai) URL.revokeObjectURL(sai.previa);
      return atual.filter((p) => p.chave !== chave);
    });
  }

  function mover(i: number, d: -1 | 1) {
    setPecas((atual) => {
      const j = i + d;
      if (j < 0 || j >= atual.length) return atual;
      const nova = [...atual];
      [nova[i], nova[j]] = [nova[j], nova[i]];
      return nova;
    });
  }

  const quando: QuandoPost =
    modo === "agora"
      ? { modo: "agora" }
      : { modo: "agendar", em: hora ? deBrasiliaParaIso(hora) : "" };
  const montar = (midias: EntradaPost["midias"]): EntradaPost => ({
    postId,
    tipo,
    legenda,
    titulo: tipo === "fotos" && temTt && titulo.trim() ? titulo.trim() : null,
    midias,
    redes: destinos,
    tiktok: temTt ? normalizarEscolhas(escolhas, tipo) : null,
    quando,
    consentiu: true,
  });

  // Prévia das regras com caminhos de mentira na pasta certa: confere tudo menos o upload.
  const previsao = (): EntradaPost["midias"] =>
    pecas.map((p, ordem) => ({
      ordem,
      tipo: p.tipo,
      caminho: `${userId}/${postId}/${ordem}`,
      mime: p.arquivo.type,
      bytes: p.arquivo.size,
      largura: p.largura,
      altura: p.altura,
      duracaoS: p.duracaoS,
    }));

  // O TikTok pede o botão travado enquanto faltar a privacidade ou a opção de divulgação.
  const travadoPeloTiktok =
    temTt &&
    (!criador ||
      !escolhas.privacidade ||
      (escolhas.divulgaMarca && !escolhas.marcaPropria && !escolhas.conteudoDeMarca));

  async function agendar() {
    setTentou(true);
    const ctx = { userId, agora: Date.now(), conectadas: conectadas.map((r) => r.rede), criador };
    const antes = problemasDoPost(montar(previsao()), ctx);
    setErros(antes);
    if (antes.length) return;

    setEnviando("Subindo os arquivos...");
    const { midias, erro } = await subirPecas(userId, postId, pecas);
    if (erro) {
      setEnviando(null);
      setErros([erro]);
      return;
    }
    setEnviando(modo === "agora" ? "Mandando pra fila..." : "Agendando...");
    try {
      const r = await agendarPostRedes({ data: montar(midias) });
      if (!r.ok) {
        await apagarPecas(midias.map((m) => m.caminho));
        setErros(r.erros);
        setEnviando(null);
        return;
      }
    } catch {
      await apagarPecas(midias.map((m) => m.caminho));
      setErros(["A Pólia One não conseguiu agendar agora. Tenta de novo."]);
      setEnviando(null);
      return;
    }
    qc.invalidateQueries({ queryKey: [CHAVE_POSTS_REDES, userId] });
    toastSucesso(modo === "agora" ? "Post na fila pra sair agora." : "Post agendado.");
    navigate({ to: "/agenda-redes" });
  }

  const contaDe = (r: StatusRede) => (r.usuario ? `@${r.usuario}` : (r.nome ?? "conta conectada"));

  return (
    <div className="flex flex-col gap-4">
      <section className={CAIXA} aria-labelledby="sec-arquivos">
        <h2 id="sec-arquivos" className={ROTULO}>
          1. Arquivos
        </h2>
        <p className="mt-1 font-sans text-[13px] text-[var(--ink-soft)]">
          Fotos em sequência viram carrossel. Um vídeo sai como Reels no Instagram e vídeo no
          TikTok.
        </p>
        <ul className="mt-3 flex flex-wrap gap-3">
          {pecas.map((p, i) => (
            <li key={p.chave} className="flex flex-col items-center gap-1">
              <div className="relative h-28 w-[88px] overflow-hidden rounded-lg bg-[var(--surface)]">
                {p.tipo === "imagem" ? (
                  <img
                    src={p.previa}
                    alt={`Arquivo ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <video
                    src={p.previa}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    aria-label={`Vídeo ${i + 1}`}
                  />
                )}
                {p.tipo === "video" && (
                  <Film
                    size={16}
                    className="absolute left-1.5 top-1.5 text-white"
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  aria-label={`Mover o arquivo ${i + 1} pra trás`}
                  className="rounded p-1.5 text-[var(--ink-soft)] hover:bg-[var(--surface)] disabled:opacity-40"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, 1)}
                  disabled={i === pecas.length - 1}
                  aria-label={`Mover o arquivo ${i + 1} pra frente`}
                  className="rounded p-1.5 text-[var(--ink-soft)] hover:bg-[var(--surface)] disabled:opacity-40"
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => tirar(p.chave)}
                  aria-label={`Tirar o arquivo ${i + 1}`}
                  className="rounded p-1.5 text-[var(--ink-soft)] hover:bg-[var(--surface)] hover:text-[var(--danger)]"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
          <li>
            <label
              htmlFor={idArquivos}
              className="flex h-28 w-[88px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--ink-soft)] font-sans text-[12px] text-[var(--ink-soft)] hover:bg-[var(--surface)] focus-within:outline focus-within:outline-2 focus-within:outline-[var(--ink)]"
            >
              <ImagePlus size={20} aria-hidden="true" />
              {lendo ? "Lendo..." : "Adicionar"}
            </label>
            <input
              id={idArquivos}
              ref={entrada}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
              className="sr-only"
              onChange={(e) => receber(e.target.files)}
            />
          </li>
        </ul>
        {avisoArquivo && (
          <p className="mt-2 font-sans text-[12px] text-[var(--danger)]" role="alert">
            {avisoArquivo}
          </p>
        )}
        <p className="mt-2 font-sans text-[12px] text-[var(--muted)]">
          A ordem aqui é a ordem do post. Foto vira JPEG; vídeo em MP4 ou MOV, até 50 MB.
        </p>
      </section>

      <section className={CAIXA} aria-labelledby="sec-onde">
        <h2 id="sec-onde" className={ROTULO}>
          2. Onde sai
        </h2>
        <div className="mt-2">
          {redes.map((r) => {
            const marcado = destinos.includes(r.rede);
            return (
              <label
                key={r.rede}
                className="flex min-h-11 items-center gap-3 font-sans text-[14px] text-[var(--ink)] md:min-h-9"
              >
                <input
                  type="checkbox"
                  className="h-[18px] w-[18px] accent-[var(--ink)] disabled:cursor-not-allowed"
                  checked={marcado}
                  disabled={!r.conectada}
                  onChange={(e) =>
                    setDestinos((d) =>
                      e.target.checked ? [...d, r.rede] : d.filter((x) => x !== r.rede),
                    )
                  }
                />
                <span className={r.conectada ? "" : "text-[var(--muted)]"}>
                  {NOME_REDE[r.rede]}
                  {r.conectada ? `, ${contaDe(r)}` : ", não conectado"}
                </span>
              </label>
            );
          })}
        </div>
        {redes.some((r) => !r.conectada) && (
          <p className="mt-1 font-sans text-[12px] text-[var(--muted)]">
            Rede não conectada liga em{" "}
            <LinkInterno
              href="/configuracoes"
              className="text-[var(--secondary-text)] hover:underline"
            >
              Configurações
            </LinkInterno>
            .
          </p>
        )}
      </section>

      <section className={CAIXA} aria-labelledby="sec-legenda">
        <h2 id="sec-legenda" className={ROTULO}>
          3. Legenda
        </h2>
        {tipo === "fotos" && temTt && (
          <div className="mt-3">
            <label
              htmlFor={idTitulo}
              className="mb-1 block font-sans text-[14px] font-medium text-[var(--ink)]"
            >
              Título no TikTok <span className="font-normal text-[var(--muted)]">(opcional)</span>
            </label>
            <input
              id={idTitulo}
              value={titulo}
              maxLength={TITULO_FOTOS_MAX}
              onChange={(e) => setTitulo(e.target.value)}
              className={INPUT}
            />
            <p className="mt-1 font-sans text-[12px] text-[var(--muted)]">
              {titulo.length} de {TITULO_FOTOS_MAX}
            </p>
          </div>
        )}
        <label
          htmlFor={idLegenda}
          className="mb-1 mt-3 block font-sans text-[14px] font-medium text-[var(--ink)]"
        >
          Legenda
        </label>
        <textarea
          id={idLegenda}
          rows={6}
          value={legenda}
          maxLength={LEGENDA_MAX}
          onChange={(e) => setLegenda(e.target.value)}
          className={INPUT}
          aria-describedby={`${idLegenda}-conta`}
        />
        <p id={`${idLegenda}-conta`} className="mt-1 font-sans text-[12px] text-[var(--muted)]">
          {legenda.length} de {LEGENDA_MAX}. As hashtags vão dentro da legenda.
        </p>
      </section>

      {temTt && (
        <BlocoTiktok
          tipo={tipo}
          criador={criador}
          carregando={conta.isLoading}
          motivo={
            conta.data?.motivo ??
            (conta.isError ? "A Pólia One não conseguiu falar com o TikTok agora." : null)
          }
          aoTentarDeNovo={() => conta.refetch()}
          escolhas={escolhas}
          aoMudar={setEscolhas}
          tentou={tentou}
        />
      )}

      <section className={CAIXA} aria-labelledby="sec-quando">
        <h2 id="sec-quando" className={ROTULO}>
          {temTt ? "5" : "4"}. Quando
        </h2>
        <div
          className="mt-2 flex flex-col gap-1 md:flex-row md:gap-6"
          role="radiogroup"
          aria-label="Quando o post sai"
        >
          {(
            [
              ["agendar", "Escolher dia e hora"],
              ["agora", "Publicar agora"],
            ] as const
          ).map(([v, r]) => (
            <label
              key={v}
              className="flex min-h-11 items-center gap-2 font-sans text-[14px] text-[var(--ink)] md:min-h-9"
            >
              <input
                type="radio"
                name="quando"
                value={v}
                checked={modo === v}
                onChange={() => setModo(v)}
                className="h-[18px] w-[18px] accent-[var(--ink)]"
              />
              {r}
            </label>
          ))}
        </div>
        {modo === "agendar" && (
          <div className="mt-2 md:max-w-xs">
            <label
              htmlFor={idHora}
              className="mb-1 block font-sans text-[14px] font-medium text-[var(--ink)]"
            >
              Dia e hora (Brasília)
            </label>
            <input
              id={idHora}
              type="datetime-local"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className={INPUT}
            />
          </div>
        )}
      </section>

      {erros.length > 0 && (
        <div
          className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-4"
          role="alert"
        >
          <p className="font-sans text-[14px] font-medium text-[var(--ink)]">
            Antes de agendar, falta:
          </p>
          <ul className="mt-1 list-disc pl-5 font-sans text-[13px] text-[var(--ink-soft)]">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {temTt && (
          <p className="font-sans text-[13px] text-[var(--ink-soft)]">
            Ao publicar, você concorda com{" "}
            {fraseIncluiPoliticaDeMarca(escolhas) && (
              <>
                a{" "}
                <a
                  href={POLITICA_MARCA}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--secondary-text)] underline"
                >
                  Política de Conteúdo de Marca
                </a>{" "}
                e{" "}
              </>
            )}
            a{" "}
            <a
              href={MUSICA}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--secondary-text)] underline"
            >
              Confirmação de Uso de Música
            </a>{" "}
            do TikTok.
          </p>
        )}
        <p className="font-sans text-[12px] text-[var(--muted)]">
          {modo === "agora" ? "O post começa a sair em até 1 minuto. " : ""}
          Depois que sai, o post pode levar alguns minutos pra aparecer no perfil.
        </p>
        <div>
          <button
            type="button"
            onClick={agendar}
            disabled={!!enviando || travadoPeloTiktok}
            className={BTN_ACAO}
            aria-describedby={travadoPeloTiktok ? "motivo-travado" : undefined}
          >
            {enviando ?? (modo === "agora" ? "Publicar agora" : "Agendar post")}
          </button>
          {travadoPeloTiktok && !enviando && (
            <p id="motivo-travado" className="mt-2 font-sans text-[12px] text-[var(--muted)]">
              Escolhe no bloco do TikTok quem pode ver o post
              {escolhas.divulgaMarca ? " e o tipo de divulgação" : ""}.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/agenda-redes" })}
          className={`${BTN_MIUDO} self-start`}
        >
          Voltar pra agenda
        </button>
      </div>
    </div>
  );
}
