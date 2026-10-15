// Sugestão de correção do domínio do e-mail no cadastro (15/10/2026).
//
// Conta criada com "gmial.com" nunca recebe o link de confirmação nem os
// lembretes, e a pessoa acha que a Pólia não mandou. A dica "Você quis dizer
// ...?" pega o erro antes do envio, sem bloquear: quem usa domínio próprio
// segue em frente.
//
// Puro (sem DOM nem rede). Só mexe no domínio; a parte antes do @ fica como
// foi digitada.

/** Domínios mais comuns no Brasil, separados em nome + final. */
const COMUNS: ReadonlyArray<{ nome: string; final: string }> = [
  { nome: "gmail", final: "com" },
  { nome: "hotmail", final: "com" },
  { nome: "outlook", final: "com" },
  { nome: "yahoo", final: "com.br" },
  { nome: "yahoo", final: "com" },
  { nome: "icloud", final: "com" },
  { nome: "live", final: "com" },
  { nome: "bol", final: "com.br" },
  { nome: "uol", final: "com.br" },
  { nome: "terra", final: "com.br" },
];

const DOMINIOS_COMUNS = new Set(COMUNS.map((c) => `${c.nome}.${c.final}`));

// Final digitado pela metade ou com o dedo ao lado. Lista fechada de propósito:
// ".com.ar" e ".ca" existem de verdade e não podem virar ".com.br"/".com".
const FINAIS_ERRADOS: Readonly<Record<string, ReadonlySet<string>>> = {
  com: new Set(["co", "con", "cm", "om", "comm", "cpm", "xom", "vom", "cim", "coom", "c"]),
  "com.br": new Set(["com.b", "com.brr", "co.br", "con.br", "cm.br", "com.bt", "com.vr"]),
};

// Domínios reais que ficam a uma letra de um comum (ymail é do Yahoo, mail.com
// é um provedor). Sem esta lista, "ana@ymail.com" ouviria "Você quis dizer
// gmail.com?".
const REAIS_PARECIDOS = new Set(["ymail.com", "mail.com", "email.com"]);

/** Distância de edição com troca de duas letras vizinhas contando 1 (gmial). */
function distancia(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

// Nome curto aceita só 1 erro: com 2, "pop.com.br" e "oi.com.br" (reais)
// virariam "bol.com.br", e "serra.com.br" viraria "terra". A partir de 6
// letras (hotmail, outlook, icloud), 2 erros ainda é digitação.
function limiteDoNome(nome: string): number {
  return nome.length >= 6 ? 2 : 1;
}

function finalCasa(digitado: string, certo: string): boolean {
  return digitado === certo || (FINAIS_ERRADOS[certo]?.has(digitado) ?? false);
}

/**
 * O e-mail com o domínio corrigido, quando o domínio digitado parece erro de
 * digitação de um domínio comum. Null quando já está certo, quando não lembra
 * nenhum comum (domínio próprio) ou quando lembra dois ao mesmo tempo.
 */
export function sugerirEmail(email: string): string | null {
  const limpo = email.trim();
  const arroba = limpo.lastIndexOf("@");
  if (arroba <= 0 || arroba === limpo.length - 1) return null;
  const local = limpo.slice(0, arroba);
  const dominio = limpo.slice(arroba + 1).toLowerCase();
  if (DOMINIOS_COMUNS.has(dominio) || REAIS_PARECIDOS.has(dominio)) return null;

  const ponto = dominio.indexOf(".");
  if (ponto <= 0) return null;
  const nome = dominio.slice(0, ponto);
  const final = dominio.slice(ponto + 1);

  let melhor: string | null = null;
  let menor = Infinity;
  let empate = false;
  for (const c of COMUNS) {
    if (!finalCasa(final, c.final)) continue;
    const dist = distancia(nome, c.nome);
    if (dist > limiteDoNome(c.nome)) continue;
    const candidato = `${c.nome}.${c.final}`;
    if (dist < menor) {
      menor = dist;
      melhor = candidato;
      empate = false;
    } else if (dist === menor && candidato !== melhor) {
      empate = true;
    }
  }
  if (!melhor || empate) return null;
  return `${local}@${melhor}`;
}
