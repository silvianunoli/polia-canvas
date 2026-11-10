import { useId } from "react";
import {
  PRIVACIDADES_TIKTOK,
  ROTULO_PRIVACIDADE,
  rotuloComercial,
  type EscolhasTiktok,
  type InfoCriadorTiktok,
  type PrivacidadeTiktok,
  type TipoPost,
} from "../../../supabase/functions/_shared/redesPosts.ts";
import { CAIXA, ROTULO } from "./comum";

// Bloco do TikTok no Novo post (ONE-155). Cada item vem das Content Sharing
// Guidelines, e é isto que a auditoria do TikTok confere:
// - apelido e foto da conta que vai receber o post, lidos do creator_info;
// - privacidade só entre as opções da conta, SEM nenhuma marcada de início;
// - comentário, dueto e stitch desmarcados; em cinza quando a conta desligou;
//   dueto e stitch somem em post de fotos;
// - divulgação comercial desligada de início, com "Sua marca" e "Conteúdo de
//   marca"; conteúdo de marca nunca privado (as duas opções se travam);
// - a dona nunca tem a escolha trocada sozinha.

const CAIXINHA =
  "h-[18px] w-[18px] flex-none accent-[var(--ink)] disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]";

function Opcao({
  rotulo,
  marcado,
  aoMudar,
  desligado,
  dica,
}: {
  rotulo: string;
  marcado: boolean;
  aoMudar: (v: boolean) => void;
  desligado?: boolean;
  dica?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-start gap-3 py-1 md:min-h-8">
      <input
        id={id}
        type="checkbox"
        className={`${CAIXINHA} mt-0.5`}
        checked={marcado}
        disabled={desligado}
        onChange={(e) => aoMudar(e.target.checked)}
        aria-describedby={dica ? `${id}-dica` : undefined}
      />
      <label
        htmlFor={id}
        className={`font-sans text-[14px] ${desligado ? "text-[var(--muted)]" : "text-[var(--ink)]"}`}
      >
        {rotulo}
        {dica && (
          <span id={`${id}-dica`} className="block text-[12px] text-[var(--muted)]">
            {dica}
          </span>
        )}
      </label>
    </div>
  );
}

export function BlocoTiktok({
  tipo,
  criador,
  carregando,
  motivo,
  aoTentarDeNovo,
  escolhas,
  aoMudar,
  tentou,
}: {
  tipo: TipoPost;
  criador: InfoCriadorTiktok | null;
  carregando: boolean;
  motivo: string | null;
  aoTentarDeNovo: () => void;
  escolhas: EscolhasTiktok;
  aoMudar: (e: EscolhasTiktok) => void;
  tentou: boolean;
}) {
  const idPrivacidade = useId();
  const set = <K extends keyof EscolhasTiktok>(k: K, v: EscolhasTiktok[K]) =>
    aoMudar({ ...escolhas, [k]: v });

  if (carregando) {
    return (
      <section className={CAIXA} aria-busy="true">
        <h2 className={ROTULO}>4. Regras do TikTok</h2>
        <div className="mt-3 h-24 animate-pulse rounded-lg bg-[var(--surface)] motion-reduce:animate-none" />
      </section>
    );
  }
  if (!criador) {
    return (
      <section className={CAIXA}>
        <h2 className={ROTULO}>4. Regras do TikTok</h2>
        <p className="mt-3 font-sans text-[14px] text-[var(--danger)]" role="alert">
          {motivo ?? "A Pólia One não conseguiu ler a conta do TikTok agora."}
        </p>
        <button
          type="button"
          onClick={aoTentarDeNovo}
          className="mt-3 font-sans text-[13px] font-medium text-[var(--secondary-text)] hover:underline"
        >
          Tentar de novo
        </button>
      </section>
    );
  }

  const conta = criador.usuario ? `@${criador.usuario}` : null;
  const semDivulgacao =
    escolhas.divulgaMarca && !escolhas.marcaPropria && !escolhas.conteudoDeMarca;
  const rotulo = rotuloComercial(escolhas);

  return (
    <section className={CAIXA} aria-labelledby="bloco-tiktok">
      <h2 id="bloco-tiktok" className={ROTULO}>
        4. Regras do TikTok
      </h2>

      <div className="mt-3 flex items-center gap-3">
        {criador.fotoUrl ? (
          <img src={criador.fotoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="h-9 w-9 rounded-full bg-[var(--surface)]" aria-hidden="true" />
        )}
        <p className="font-sans text-[14px] text-[var(--ink)]">
          Publicando em{" "}
          <strong className="font-semibold">{criador.nome ?? conta ?? "conta conectada"}</strong>
          {criador.nome && conta ? <span className="text-[var(--muted)]"> {conta}</span> : null}
        </p>
      </div>

      <div className="mt-4">
        <label
          htmlFor={idPrivacidade}
          className="mb-1 block font-sans text-[14px] font-medium text-[var(--ink)]"
        >
          Quem pode ver
        </label>
        <select
          id={idPrivacidade}
          value={escolhas.privacidade ?? ""}
          onChange={(e) => set("privacidade", (e.target.value || null) as PrivacidadeTiktok | null)}
          aria-invalid={tentou && !escolhas.privacidade ? true : undefined}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 font-sans text-[15px] text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--secondary-text)] md:max-w-sm"
        >
          <option value="" disabled>
            Escolher
          </option>
          {PRIVACIDADES_TIKTOK.filter((p) => criador.privacidades.includes(p)).map((p) => (
            <option
              key={p}
              value={p}
              disabled={p === "SELF_ONLY" && escolhas.conteudoDeMarca}
              title={
                p === "SELF_ONLY" && escolhas.conteudoDeMarca
                  ? "Conteúdo de marca não pode ficar só pra você."
                  : undefined
              }
            >
              {ROTULO_PRIVACIDADE[p]}
            </option>
          ))}
        </select>
        {tentou && !escolhas.privacidade && (
          <p className="mt-1 font-sans text-[12px] text-[var(--danger)]">
            Escolhe quem pode ver o post no TikTok.
          </p>
        )}
      </div>

      <fieldset className="mt-4">
        <legend className="mb-1 font-sans text-[14px] font-medium text-[var(--ink)]">
          Quem segue pode
        </legend>
        <Opcao
          rotulo="Comentar"
          marcado={escolhas.permiteComentario}
          aoMudar={(v) => set("permiteComentario", v)}
          desligado={criador.comentarioDesligado}
          dica={
            criador.comentarioDesligado
              ? "Desligado nas configurações da conta no TikTok."
              : undefined
          }
        />
        {tipo === "video" && (
          <>
            <Opcao
              rotulo="Fazer dueto"
              marcado={escolhas.permiteDueto}
              aoMudar={(v) => set("permiteDueto", v)}
              desligado={criador.duetoDesligado}
              dica={
                criador.duetoDesligado
                  ? "Desligado nas configurações da conta no TikTok."
                  : undefined
              }
            />
            <Opcao
              rotulo="Fazer stitch"
              marcado={escolhas.permiteStitch}
              aoMudar={(v) => set("permiteStitch", v)}
              desligado={criador.stitchDesligado}
              dica={
                criador.stitchDesligado
                  ? "Desligado nas configurações da conta no TikTok."
                  : undefined
              }
            />
          </>
        )}
      </fieldset>

      <fieldset className="mt-4">
        <legend className="sr-only">Divulgação</legend>
        <Opcao
          rotulo="Este post divulga uma marca, produto ou serviço"
          marcado={escolhas.divulgaMarca}
          aoMudar={(v) =>
            aoMudar({
              ...escolhas,
              divulgaMarca: v,
              marcaPropria: v && escolhas.marcaPropria,
              conteudoDeMarca: v && escolhas.conteudoDeMarca,
            })
          }
          dica="O TikTok pede que você indique se o post divulga a sua marca, a de outra pessoa ou as duas."
        />
        {escolhas.divulgaMarca && (
          <div className="ml-7 border-l border-[var(--line)] pl-4">
            <Opcao
              rotulo="Sua marca"
              marcado={escolhas.marcaPropria}
              aoMudar={(v) => set("marcaPropria", v)}
              dica="Divulga o seu produto ou serviço."
            />
            <Opcao
              rotulo="Conteúdo de marca"
              marcado={escolhas.conteudoDeMarca}
              aoMudar={(v) => set("conteudoDeMarca", v)}
              desligado={escolhas.privacidade === "SELF_ONLY"}
              dica={
                escolhas.privacidade === "SELF_ONLY"
                  ? "Conteúdo de marca não pode ficar só pra você. Troca quem pode ver antes."
                  : "Divulga outra marca, em parceria paga."
              }
            />
            {semDivulgacao && (
              <p className="mt-1 font-sans text-[12px] text-[var(--danger)]" role="alert">
                Marca se o post divulga a sua marca, a de outra pessoa ou as duas.
              </p>
            )}
            {rotulo && (
              <p className="mt-1 font-sans text-[12px] text-[var(--ink-soft)]">
                No TikTok, o post vai aparecer como "{rotulo}".
              </p>
            )}
          </div>
        )}
      </fieldset>

      <div className="mt-2">
        <Opcao
          rotulo="Feito com IA"
          marcado={escolhas.conteudoIa}
          aoMudar={(v) => set("conteudoIa", v)}
          dica="O TikTok mostra o selo de conteúdo gerado por IA."
        />
      </div>
    </section>
  );
}
