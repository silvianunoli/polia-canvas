import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Modal } from "@/components/ui/Modal";
import { Campo } from "@/components/ui/Campo";
import { BTN_ACAO, BTN_ACAO_CONTORNO } from "@/lib/botoes";
import { toastErro, toastSucesso } from "@/lib/toast";
import { track } from "@/lib/analytics";
import { urlCanonica } from "@/lib/seo";
import { slugValido, sugerirSlug } from "@/lib/leads";
import { salvarLinkCaptura, useLinkCaptura, type LinkCaptura } from "./dados";

const INPUT =
  "w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[14px] text-[var(--ink)] focus:border-[var(--secondary-text)] focus:outline-none";

/** "Seu link de captura" (VND-04): endereço, título, pergunta, liga/desliga e copiar. */
export function ModalLinkCaptura({
  userId,
  nomeDaMarca,
  onClose,
}: {
  userId: string;
  nomeDaMarca: string | null;
  onClose: () => void;
}) {
  const query = useLinkCaptura(userId);

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Seu link de captura"
      description="Pra bio do Instagram, o status do WhatsApp ou um QR na feira. Quem preenche entra em Clientes como Primeiro contato."
    >
      {query.isError ? (
        <p role="alert" className="text-[14px] text-[var(--danger)]">
          A Pólia One não conseguiu ler o seu link agora. Fecha e abre de novo.
        </p>
      ) : query.isLoading ? (
        <p className="text-[14px] text-[var(--muted)]">Carregando…</p>
      ) : !nomeDaMarca?.trim() ? (
        // O aceite da página diz de quem são as mensagens: sem nome de marca, o
        // link não abre (LGPD). Mesma regra no servidor (captura.functions.ts).
        <div className="text-[14px] text-[var(--ink-soft)]">
          <p>
            O link mostra o nome da marca pra quem preenche, e a autorização de WhatsApp é dada pra
            ela. Cadastre o nome da marca antes.
          </p>
          <Link
            to="/configuracoes"
            className="mt-2 inline-flex min-h-11 items-center font-medium text-[var(--secondary-text)] hover:underline"
          >
            Ir para Configurações
          </Link>
        </div>
      ) : (
        <Formulario
          userId={userId}
          inicial={
            query.data ?? {
              slug: sugerirSlug(nomeDaMarca ?? ""),
              ativo: true,
              titulo: null,
              pergunta: null,
            }
          }
          jaExiste={!!query.data}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}

function Formulario({
  userId,
  inicial,
  jaExiste,
  onClose,
}: {
  userId: string;
  inicial: LinkCaptura;
  jaExiste: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [slug, setSlug] = useState(inicial.slug);
  const [titulo, setTitulo] = useState(inicial.titulo ?? "");
  const [pergunta, setPergunta] = useState(inicial.pergunta ?? "");
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [salvo, setSalvo] = useState(jaExiste);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const limpo = slug.trim().toLowerCase();
  const endereco = urlCanonica(`/l/${limpo}`);
  const mudou =
    !salvo ||
    limpo !== inicial.slug ||
    titulo.trim() !== (inicial.titulo ?? "") ||
    pergunta.trim() !== (inicial.pergunta ?? "") ||
    ativo !== inicial.ativo;

  const salvar = async () => {
    if (!slugValido(limpo)) {
      setErro("Use de 3 a 40 letras sem acento, números e hífen no meio. Ex: doces-da-ana");
      return;
    }
    setSalvando(true);
    setErro(null);
    const { error } = await salvarLinkCaptura(userId, {
      slug: limpo,
      ativo,
      titulo: titulo.trim() || null,
      pergunta: pergunta.trim() || null,
    });
    setSalvando(false);
    if (error) {
      console.error("link_captura_salvar", error);
      setErro(
        error.code === "23505"
          ? "Esse endereço já é de outra marca. Tenta outro."
          : "A Pólia One não conseguiu salvar o link. Tenta de novo.",
      );
      return;
    }
    setSalvo(true);
    track(jaExiste ? "link_captura_editado" : "link_captura_criado", { ativo });
    void qc.invalidateQueries({ queryKey: ["link-captura", userId] });
    toastSucesso(ativo ? "Link salvo e recebendo contatos." : "Link salvo e desligado.");
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(endereco);
      toastSucesso("Link copiado.");
      track("link_captura_copiado");
    } catch {
      toastErro("Não deu pra copiar. Selecione o endereço e copie à mão.");
    }
  };

  return (
    <div>
      <div className="rounded-xl bg-[var(--surface)] p-4">
        <p className="break-all text-[15px] text-[var(--ink)]">
          {limpo ? endereco : "Escolha um endereço abaixo."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copiar()}
            disabled={!salvo || mudou}
            className={BTN_ACAO}
          >
            Copiar link
          </button>
          {salvo && !mudou && ativo && (
            <a
              href={endereco}
              target="_blank"
              rel="noopener noreferrer"
              className={BTN_ACAO_CONTORNO}
            >
              Ver como a cliente vê
            </a>
          )}
        </div>
        {(!salvo || mudou) && (
          <p className="mt-2 text-[12px] text-[var(--muted)]">Salve pra copiar o link.</p>
        )}
      </div>

      <div className="mt-5 grid gap-4">
        <Campo label="Endereço" hint="letras sem acento, números e hífen">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={40}
            autoCapitalize="none"
            spellCheck={false}
            className={INPUT}
            placeholder="doces-da-ana"
          />
        </Campo>
        <Campo label="Título da página" hint="opcional">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={120}
            className={INPUT}
            placeholder="Quer um bolo com a sua frase?"
          />
        </Campo>
        <Campo label="Pergunta de interesse" hint="opcional">
          <input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            maxLength={120}
            className={INPUT}
            placeholder="O que você procura?"
          />
        </Campo>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-[var(--ink)]">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="h-4 w-4 accent-[var(--secondary-text)]"
          />
          Link ligado (recebendo contatos)
        </label>
      </div>

      <p className="mt-3 text-[12px] text-[var(--muted)]">
        O logo e a cor vêm da identidade da marca, a mesma do orçamento.
      </p>

      {erro && (
        <p role="alert" className="mt-3 text-[13px] text-[var(--danger)]">
          {erro}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onClose} className={BTN_ACAO_CONTORNO}>
          Fechar
        </button>
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={salvando || !mudou}
          className={BTN_ACAO}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
