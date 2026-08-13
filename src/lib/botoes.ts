/**
 * Forma canônica do botão, para o site público E para a área logada.
 *
 * Existe porque a auditoria de 13/08/2026 encontrou TRÊS formas convivendo:
 * pílula turquesa sem borda (8 telas logadas), retângulo turquesa sem borda
 * (Assinar, portões) e retângulo com borda de tinta (site, auth, Painel,
 * Planejamento). A terceira é a única que a usuária vê antes de entrar, então é
 * ela que vira o padrão — quem sai da home e cai no app não troca de linguagem.
 *
 * Regra que o CSS não garante sozinho: `rounded-full` fica reservado para SELO
 * que não é clicável. Se é clicável, é uma das formas abaixo.
 */

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--ink)] font-semibold no-underline transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";

const GRANDE = "px-[26px] py-[13px] text-[15px]";
const MEDIO = "px-5 py-2.5 text-[14px]";
const PEQUENO = "px-3.5 py-1.5 text-[13px]";

const PREENCHIDO =
  "bg-[var(--secondary)] text-[var(--secondary-ink)] hover:-translate-y-px hover:opacity-90";
const CONTORNO = "text-[var(--ink)] hover:-translate-y-px hover:bg-white";

/** Ação principal do site público (hero, planos). */
export const BTN_PRIMARIO = `${BASE} ${GRANDE} ${PREENCHIDO}`;
/** Ação secundária do site público. */
export const BTN_CONTORNO = `${BASE} ${GRANDE} ${CONTORNO}`;

/** Ação principal de uma tela logada — o botão do cabeçalho. */
export const BTN_ACAO = `${BASE} ${MEDIO} ${PREENCHIDO}`;
/** Ação secundária de uma tela logada. */
export const BTN_ACAO_CONTORNO = `${BASE} ${MEDIO} ${CONTORNO}`;

/** Ação miúda dentro de cartão, linha de lista ou barra de filtro. */
export const BTN_MIUDO = `${BASE} ${PEQUENO} ${CONTORNO}`;
