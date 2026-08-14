// Sanitizador determinístico da saída da IA. Regra nº 1 da marca: nunca
// travessão nem meia-risca em texto visível. O prompt até pede, mas modelo
// desobedece; a garantia mora aqui, no único caminho de volta do Gemini
// (gemini.server.ts), antes de persistir e antes de chegar no cliente.
//
// NUNCA aplicar em texto digitado pela usuária. O que ela escreve é dela.

// — U+2014 (em dash), – U+2013 (en dash), ― U+2015 (barra horizontal).
const TRACO = "[—–―]";

export function sanitizarTextoIA(texto: string): string {
  let t = texto;

  // ‑ U+2011 (hífen não separável) é hífen, não travessão: vira hífen simples
  // sempre, senão "e‑mail" viraria "e, mail" na regra B.
  t = t.replace(/‑/g, "-");

  // Regra A: entre dígitos é intervalo, e intervalo é hífen ("10—20" -> "10-20",
  // "R$ 30 – 60" -> "R$ 30-60").
  t = t.replace(new RegExp(`(\\d) *${TRACO} *(?=\\d)`, "g"), "$1-");

  // Regra C: no início da string ou de linha, some junto com o espaço seguinte
  // (não vira vírgula).
  t = t.replace(new RegExp(`(^|\\n) *${TRACO} ?`, "g"), "$1");

  // Traço pendurado no fim de linha ou da string também some, senão a regra B
  // deixaria uma vírgula órfã no fim.
  t = t.replace(new RegExp(` *${TRACO} *(?=\\n|$)`, "g"), "");

  // Regra B: qualquer outro vira ", " (sem espaço antes da vírgula).
  t = t.replace(new RegExp(` *${TRACO} *`, "g"), ", ");

  // Regra D: nunca vírgula duplicada nem vírgula recém-criada colada em outra
  // pontuação ("a —, b" -> "a, b"; "palavra —." -> "palavra.").
  t = t.replace(/,[ \t]*(?:,[ \t]*)+/g, ", ");
  t = t.replace(/, +(?=[.,;:!?])/g, "");
  t = t.replace(/,(?=[.;:!?])/g, "");

  return t;
}
