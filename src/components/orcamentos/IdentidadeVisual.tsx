import { useEffect, useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ImageUp } from "lucide-react";
import { BlockError } from "@/components/ui/BlockError";
import { BTN_ACAO, BTN_MIUDO_ACAO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { usoDaCor } from "@/lib/orcamentos";
import {
  LOGO_MAX_BYTES,
  LOGO_TIPOS,
  chaveIdentidade,
  removerLogo,
  salvarCorMarca,
  trocarLogo,
  useIdentidadeMarca,
} from "./dados";

const HEX = /^#[0-9a-f]{6}$/i;
// Ponto de partida do seletor quando ela ainda não escolheu: o turquesa da Pólia.
const COR_INICIAL = "#7CCBCD";

/**
 * Logo e cor da marca (ONE-129). Hoje aparecem no orçamento que vai pra
 * cliente; a prévia mostra exatamente o topo que ela vai ver.
 */
export function IdentidadeVisual({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const query = useIdentidadeMarca(userId);
  const inputArquivo = useRef<HTMLInputElement>(null);
  const corId = useId();
  const hexId = useId();
  const erroHexId = useId();
  const [enviando, setEnviando] = useState(false);
  const [cor, setCor] = useState("");
  const [salvandoCor, setSalvandoCor] = useState(false);

  useEffect(() => {
    if (query.data) setCor(query.data.cor ?? "");
  }, [query.data]);

  if (query.isError)
    return (
      <div role="alert" className="mb-8">
        <BlockError
          message="A Pólia One não conseguiu ler o logo e a cor da marca agora."
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  if (!query.isSuccess)
    return (
      <div
        className="mb-8 h-40 animate-pulse rounded-xl border border-[var(--line)] bg-white motion-reduce:animate-none"
        aria-busy="true"
        aria-label="Carregando a identidade da marca"
      />
    );

  const id = query.data;
  const recarregar = () => qc.invalidateQueries({ queryKey: chaveIdentidade(userId) });
  const corValida = HEX.test(cor);
  const corMudou = (cor || null) !== (id.cor ?? null);
  // A prévia usa a mesma regra da página pública (usoDaCor): sem cor, fundo
  // neutro; cor de meio de escala, só uma faixa.
  const corDaPrevia = corValida ? cor : null;
  const uso = usoDaCor(corDaPrevia);
  const textoNaCor = uso.texto === "claro" ? "white" : "var(--ink)";

  const escolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (!(LOGO_TIPOS as readonly string[]).includes(arquivo.type)) {
      toastErro("O logo precisa ser PNG, JPG ou WEBP.");
      return;
    }
    if (arquivo.size > LOGO_MAX_BYTES) {
      toastErro("O logo passou de 1 MB. Exporta numa resolução menor e tenta de novo.");
      return;
    }
    setEnviando(true);
    const { error } = await trocarLogo(userId, arquivo, id.logoPath);
    setEnviando(false);
    if (inputArquivo.current) inputArquivo.current.value = "";
    if (error) {
      console.error("logo_trocar", error);
      toastErro("A Pólia One não conseguiu salvar o logo. Tenta de novo.");
      return;
    }
    track("marca_logo_salvo");
    recarregar();
    toastSucesso("Logo salvo.");
  };

  const tirarLogo = async () => {
    if (!id.logoPath) return;
    setEnviando(true);
    const { error } = await removerLogo(userId, id.logoPath);
    setEnviando(false);
    if (error) {
      toastErro("A Pólia One não conseguiu tirar o logo. Tenta de novo.");
      return;
    }
    recarregar();
    toastSucesso("Logo retirado.");
  };

  const guardarCor = async (nova: string | null) => {
    if (nova && !HEX.test(nova)) return;
    setSalvandoCor(true);
    const { error } = await salvarCorMarca(userId, nova ? nova.toUpperCase() : null);
    setSalvandoCor(false);
    if (error) {
      console.error("cor_marca_salvar", error);
      toastErro("A Pólia One não conseguiu salvar a cor. Tenta de novo.");
      return;
    }
    track(nova ? "marca_cor_salva" : "marca_cor_retirada");
    if (!nova) setCor("");
    recarregar();
    toastSucesso(nova ? "Cor salva." : "Cor retirada.");
  };

  // Hex digitado sem o "#" ganha o "#" sozinho.
  const digitarHex = (texto: string) => {
    const t = texto.trim();
    setCor(t && !t.startsWith("#") ? `#${t}` : t);
  };

  return (
    <section
      aria-labelledby="titulo-identidade"
      className="mb-10 rounded-xl border border-[var(--line)] bg-white p-5 md:p-6"
    >
      <h2 id="titulo-identidade" className="text-[20px] leading-tight text-[var(--ink)]">
        Logo e cor
      </h2>
      <p className="mt-1 text-[13px] text-[var(--muted)]">
        Vão no topo do orçamento que a cliente abre pelo link.
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[12px] text-[var(--muted)]">Logo</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg)]">
              {id.logoUrl ? (
                <img
                  src={id.logoUrl}
                  alt="Logo atual da marca"
                  className="h-full w-full object-contain"
                />
              ) : (
                <ImageUp size={22} aria-hidden="true" className="text-[var(--muted)]" />
              )}
            </div>
            <div className="flex flex-col items-start gap-1">
              <input
                ref={inputArquivo}
                type="file"
                accept={LOGO_TIPOS.join(",")}
                className="sr-only"
                id="arquivo-logo"
                onChange={(e) => void escolherArquivo(e.target.files?.[0])}
              />
              <label
                htmlFor="arquivo-logo"
                className={`${BTN_MIUDO_ACAO} cursor-pointer ${enviando ? "pointer-events-none opacity-60" : ""}`}
              >
                {enviando ? "Salvando…" : id.logoUrl ? "Trocar logo" : "Enviar logo"}
              </label>
              {id.logoUrl && !enviando && (
                <button
                  type="button"
                  onClick={() => void tirarLogo()}
                  className="inline-flex min-h-11 items-center text-[13px] text-[var(--muted)] hover:underline"
                >
                  Tirar o logo
                </button>
              )}
              <p className="text-[12px] text-[var(--muted)]">PNG, JPG ou WEBP, até 1 MB.</p>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor={hexId} className="mb-2 block text-[12px] text-[var(--muted)]">
            Cor principal
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={corId}
              type="color"
              value={corDaPrevia ?? COR_INICIAL}
              onChange={(e) => setCor(e.target.value.toUpperCase())}
              aria-label="Escolher a cor no seletor"
              className="h-11 w-14 cursor-pointer rounded-lg border border-[var(--line)] bg-white p-1"
            />
            <input
              id={hexId}
              value={cor}
              onChange={(e) => digitarHex(e.target.value)}
              placeholder="#000000"
              maxLength={7}
              aria-invalid={!!cor && !corValida}
              aria-describedby={cor && !corValida ? erroHexId : undefined}
              className="w-28 rounded-lg border border-[var(--line)] px-3 py-2 font-mono text-[14px] uppercase text-[var(--ink)] focus:border-[var(--secondary-text)] aria-[invalid=true]:border-[var(--danger)]"
            />
            <button
              type="button"
              onClick={() => void guardarCor(cor || null)}
              disabled={!corMudou || (!!cor && !corValida) || salvandoCor}
              className={BTN_ACAO}
            >
              {salvandoCor ? "Salvando…" : "Salvar cor"}
            </button>
          </div>
          {cor && !corValida && (
            <p id={erroHexId} role="alert" className="mt-1 text-[12px] text-[var(--danger)]">
              Use o formato #RRGGBB, por exemplo #24696B.
            </p>
          )}
          {id.cor && !salvandoCor && (
            <button
              type="button"
              onClick={() => void guardarCor(null)}
              className="inline-flex min-h-11 items-center text-[13px] text-[var(--muted)] hover:underline"
            >
              Tirar a cor
            </button>
          )}

          <p className="mb-2 mt-4 text-[12px] text-[var(--muted)]">Como a cliente vê</p>
          {/* Cor da marca da usuária: dado dela, não token da Pólia. */}
          <div className="overflow-hidden rounded-lg border border-[var(--line)]">
            {uso.modo === "faixa" && (
              <div aria-hidden="true" className="h-1.5" style={{ backgroundColor: corDaPrevia! }} />
            )}
            <div
              className={`flex items-center gap-3 px-4 py-3 ${uso.modo === "fundo" ? "" : "bg-[var(--surface)] text-[var(--ink)]"}`}
              style={
                uso.modo === "fundo"
                  ? { backgroundColor: corDaPrevia!, color: textoNaCor }
                  : undefined
              }
            >
              {id.logoUrl && (
                <img
                  src={id.logoUrl}
                  alt=""
                  className="h-8 w-8 rounded bg-white object-contain p-0.5"
                />
              )}
              <span className="font-cabinet text-[16px]">{id.nome || "Orçamento nº 1"}</span>
              {id.nome && <span className="ml-auto text-[13px]">Orçamento nº 1</span>}
            </div>
          </div>
          {uso.modo === "faixa" && (
            <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
              Com essa cor o texto fica difícil de ler, então o orçamento usa ela numa faixa no
              topo.
            </p>
          )}
          {!id.nome && (
            <p className="mt-2 text-[13px] text-[var(--ink-soft)]">
              O nome da marca vem de Configurações. Sem ele, o orçamento mostra só o número.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
