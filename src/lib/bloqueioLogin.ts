// Bloqueio de 60 s depois de 5 senhas erradas no /auth/login.
//
// Até 09/10/2026 o contador morava só no estado da tela: um F5 zerava as
// tentativas e o bloqueio, e ele não protegia nada (QA-10, achado da Sil). Agora
// fica no localStorage do navegador. Não substitui o limite do servidor (o
// Supabase Auth tem rate limit próprio e o captcha); é a trava de primeira linha
// pra quem está chutando senha na mesma tela.

export const MAX_TENTATIVAS_LOGIN = 5;
export const BLOQUEIO_LOGIN_SEGUNDOS = 60;

const CHAVE = "polia-login-bloqueio";

export interface EstadoBloqueio {
  tentativas: number;
  /** Epoch em ms até quando o login fica travado. null = sem bloqueio. */
  ate: number | null;
}

const VAZIO: EstadoBloqueio = { tentativas: 0, ate: null };

/** Lê o que está guardado, descartando lixo e bloqueio já vencido. */
export function interpretarBloqueio(bruto: string | null, agora: number): EstadoBloqueio {
  if (!bruto) return VAZIO;
  try {
    const v = JSON.parse(bruto) as Partial<EstadoBloqueio>;
    const tentativas =
      Number.isInteger(v.tentativas) && (v.tentativas as number) > 0 ? (v.tentativas as number) : 0;
    const ate = typeof v.ate === "number" && Number.isFinite(v.ate) ? v.ate : null;
    // Bloqueio que já passou zera tudo: a próxima tentativa começa do 1.
    if (ate !== null && ate <= agora) return VAZIO;
    return { tentativas, ate };
  } catch {
    return VAZIO;
  }
}

/** Segundos que faltam pro bloqueio acabar (0 = liberado). */
export function segundosRestantes(estado: EstadoBloqueio, agora: number): number {
  if (estado.ate === null) return 0;
  return Math.max(0, Math.ceil((estado.ate - agora) / 1000));
}

/** Soma uma senha errada e, na 5ª, trava por 60 s. */
export function somarFalha(estado: EstadoBloqueio, agora: number): EstadoBloqueio {
  const tentativas = estado.tentativas + 1;
  if (tentativas >= MAX_TENTATIVAS_LOGIN) {
    return { tentativas, ate: agora + BLOQUEIO_LOGIN_SEGUNDOS * 1000 };
  }
  return { tentativas, ate: null };
}

function armazenamento(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function lerBloqueioLogin(agora = Date.now()): EstadoBloqueio {
  return interpretarBloqueio(armazenamento()?.getItem(CHAVE) ?? null, agora);
}

export function gravarBloqueioLogin(estado: EstadoBloqueio): void {
  try {
    const s = armazenamento();
    if (!s) return;
    if (estado.tentativas === 0 && estado.ate === null) s.removeItem(CHAVE);
    else s.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    // Modo privado restrito: o bloqueio volta a valer só pela tela, nada quebra.
  }
}

export function limparBloqueioLogin(): void {
  gravarBloqueioLogin(VAZIO);
}
