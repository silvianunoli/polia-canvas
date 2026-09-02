// Higiene de LGPD para o que entra em `erros_app` (LGPD-03).
//
// Stack trace e mensagem de erro são texto livre gerado por terceiros: podem
// carregar dado pessoal por acidente (um erro lançado com template string que
// interpola o e-mail da cliente, uma URL com token na query, o corpo de uma
// resposta de API que devolve o destinatário). A tabela guarda isso para
// sempre, e a tela do admin mostra.
//
// A regra aqui é: mascarar o que é identificável e cortar o rabo do stack,
// preservando o topo — que é a parte que serve pra debug. Nada de schema:
// o corte acontece antes do insert.
//
// Módulo sem dependência de Supabase, React ou runtime: roda igual no browser
// e no Worker, e por isso é testável isolado.

/** Limite de caracteres da mensagem do erro. */
export const LIMITE_MENSAGEM = 2000;
/** Limite de caracteres do stack já truncado (topo preservado). */
export const LIMITE_STACK_CARACTERES = 2000;
/** Quantidade de frames/linhas do topo do stack que ficam. */
export const LIMITE_STACK_LINHAS = 25;
/** Corte por linha: bundle minificado tem linha de milhares de caracteres. */
export const LIMITE_LINHA = 400;
/** Limite do caminho de página. */
export const LIMITE_PAGINA = 300;

const MARCA_TRUNCADO = "[stack truncado]";

// A ordem importa: o que é mais específico (JWT, chave, query string) roda
// antes do que é mais genérico (e-mail, número), pra não sobrar metade de um
// token mascarado como se fosse outra coisa.
const PADROES: Array<[RegExp, string]> = [
  // JWT (access token do Supabase, por exemplo).
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, "[jwt]"],
  // Authorization: Bearer <token>
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [token]"],
  // Chaves de serviço (Stripe sk_live/pk_live, Resend re_, service role sb_).
  [/\b(?:sk|pk|rk|whsec|re|sb)_[A-Za-z0-9_-]{8,}/g, "[chave]"],
  // Query string sensível: preserva o nome do parâmetro, esconde o valor.
  [
    /([?&](?:token|access_token|refresh_token|code|email|senha|password|pwd|key|apikey|api_key|secret|signature)=)[^&\s"'`)]+/gi,
    "$1[oculto]",
  ],
  // E-mail. O TLD exigido em letras evita comer `pacote@1.2.3` de caminho de
  // bundle, que aparece o tempo todo em stack de Worker.
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)*\.[A-Za-z]{2,}/g, "[email]"],
  // CNPJ antes de CPF: o `\b` já separa, mas a ordem deixa a intenção clara.
  [/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g, "[cnpj]"],
  [/\b\d{14}\b/g, "[cnpj]"],
  [/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[cpf]"],
  [/\b\d{11}\b/g, "[cpf]"],
  // Telefone só nas formas que carregam DDD explícito — número solto de 8 a 9
  // dígitos em stack costuma ser offset de linha/coluna, não telefone.
  [/(?:\+55[\s-]?)?\(\d{2}\)\s?\d{4,5}[-\s]?\d{4}/g, "[telefone]"],
  [/\+55[\s-]?\d{2}[\s-]?\d{4,5}[-\s]?\d{4}/g, "[telefone]"],
];

/**
 * Mascara dado pessoal e credencial dentro de um texto livre de erro.
 * Best-effort: reduz a chance de captura acidental, não substitui a regra de
 * nunca interpolar dado da usuária em mensagem de erro.
 */
export function mascararDadoPessoal(texto: string): string {
  let saida = texto;
  for (const [padrao, troca] of PADROES) {
    saida = saida.replace(padrao, troca);
  }
  return saida;
}

/** Mensagem do erro: mascarada e cortada. */
export function sanitizarMensagemErro(mensagem: string): string {
  return mascararDadoPessoal(mensagem).slice(0, LIMITE_MENSAGEM);
}

/**
 * Stack: mascarado, limitado às primeiras {@link LIMITE_STACK_LINHAS} linhas
 * (o topo é o que aponta o bug), com cada linha cortada em
 * {@link LIMITE_LINHA} e o total em {@link LIMITE_STACK_CARACTERES}.
 * Quando algo foi cortado, o texto termina com uma marca explícita, pra
 * ninguém no admin achar que o stack acabou ali.
 */
export function sanitizarStack(stack?: string | null): string | null {
  if (!stack) return null;
  const linhas = mascararDadoPessoal(stack).split("\n");
  let truncado = linhas.length > LIMITE_STACK_LINHAS;

  const topo = linhas
    .slice(0, LIMITE_STACK_LINHAS)
    .map((linha) => (linha.length > LIMITE_LINHA ? linha.slice(0, LIMITE_LINHA) : linha));

  let texto = topo.join("\n");
  if (linhas.slice(0, LIMITE_STACK_LINHAS).some((l) => l.length > LIMITE_LINHA)) truncado = true;
  if (texto.length > LIMITE_STACK_CARACTERES) {
    texto = texto.slice(0, LIMITE_STACK_CARACTERES);
    truncado = true;
  }
  return truncado ? `${texto}\n${MARCA_TRUNCADO}` : texto;
}

/** Caminho de página: sem query string (é lá que mora token e e-mail). */
export function sanitizarPagina(pagina?: string | null): string | null {
  if (!pagina) return null;
  const semQuery = pagina.split(/[?#]/)[0];
  return mascararDadoPessoal(semQuery).slice(0, LIMITE_PAGINA) || null;
}
