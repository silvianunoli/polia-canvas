import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Regras de marca da Pólia que o ESLint não conhece (CLAUDE.md, BRAND.md):
// nada de travessão, nome de plano morto, vocabulário territorial, emoji ou
// exclamação em texto que a usuária vê. A varredura usa o parser do
// TypeScript, então só entra o que vira texto de verdade (string literal,
// template, texto JSX): comentário, identificador e nome de coluna ficam de
// fora, e `console.*` também, porque log não é copy.
//
// Prompt de IA que ENSINA o modelo a não usar travessão/"transforme"/emoji
// cita esses termos de propósito; esses textos ficam de fora pela frase de
// instrução ("Nunca use", "Não use").
//
// Quando uma regra pega uma ocorrência antiga conhecida, ela fica listada em
// EXCECOES_* com arquivo + trecho. É catraca: o que já existe não bloqueia,
// mas nada novo entra. Corrigiu a copy, apague a exceção.

const RAIZ = join(__dirname, "..");
const SRC = join(RAIZ, "src");

const IGNORAR_ARQUIVO = /\.test\.|routeTree\.gen|integrations[\\/]supabase[\\/]types\.ts$|\.d\.ts$/;

function listarArquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) listarArquivos(caminho, saida);
    else if (/\.(ts|tsx)$/.test(nome) && !IGNORAR_ARQUIVO.test(caminho)) saida.push(caminho);
  }
  return saida;
}

function dentroDeConsole(no: ts.Node): boolean {
  for (let p = no.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && /^console\./.test(p.expression.getText())) return true;
  }
  return false;
}

interface Ocorrencia {
  arquivo: string;
  linha: number;
  texto: string;
}

// Todo texto "visível" do src, lido uma vez só e compartilhado pelas regras.
const TEXTOS: Ocorrencia[] = (() => {
  const saida: Ocorrencia[] = [];
  for (const caminho of listarArquivos(SRC)) {
    const fonte = readFileSync(caminho, "utf8");
    const sf = ts.createSourceFile(
      caminho,
      fonte,
      ts.ScriptTarget.Latest,
      true,
      caminho.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const arquivo = relative(RAIZ, caminho).split("\\").join("/");
    const visitar = (no: ts.Node) => {
      let texto: string | null = null;
      if (
        ts.isStringLiteral(no) ||
        ts.isNoSubstitutionTemplateLiteral(no) ||
        ts.isTemplateHead(no) ||
        ts.isTemplateMiddle(no) ||
        ts.isTemplateTail(no) ||
        ts.isJsxText(no)
      ) {
        texto = no.text;
      }
      if (texto !== null && texto.trim() && !dentroDeConsole(no)) {
        saida.push({
          arquivo,
          linha: sf.getLineAndCharacterOfPosition(no.getStart()).line + 1,
          texto,
        });
      }
      ts.forEachChild(no, visitar);
    };
    visitar(sf);
  }
  return saida;
})();

// [arquivo, trecho do texto]. Trecho em vez de linha: linha muda a cada
// edição acima e faria o teste gritar sem motivo.
type Excecao = readonly [arquivo: string, trecho: string];

const INSTRUCAO_DE_IA = /Nunca use|Não use|nunca use|não use/;

function procurar(
  regra: RegExp,
  opcoes: { ignorarTexto?: RegExp; ignorarArquivo?: RegExp; excecoes?: readonly Excecao[] } = {},
): string[] {
  const achados: string[] = [];
  for (const { arquivo, linha, texto } of TEXTOS) {
    if (opcoes.ignorarArquivo?.test(arquivo)) continue;
    if (!regra.test(texto)) continue;
    if (opcoes.ignorarTexto?.test(texto)) continue;
    const excecao = opcoes.excecoes?.some(([a, trecho]) => a === arquivo && texto.includes(trecho));
    if (excecao) continue;
    achados.push(`${arquivo}:${linha}  ${JSON.stringify(texto.trim().slice(0, 80))}`);
  }
  return achados;
}

// Dívida de copy conhecida em 22/09/2026. Corrigir e apagar daqui.
const EXCECOES_TRAVESSAO: readonly Excecao[] = [
  ["src/components/DiagnosticPanel.tsx", "—"],
  ["src/routes/termos.tsx", "A cobrança é recorrente e renova automaticamente"],
];
const EXCECOES_EXCLAMACAO: readonly Excecao[] = [
  ["src/routes/ajuda.tsx", "Recebemos a mensagem!"],
  ["src/routes/_authenticated/assinar.tsx", "Pagamento confirmado!"],
];

describe("regras de marca no texto visível do src", () => {
  it("varreu o código de verdade (sanidade da varredura)", () => {
    expect(TEXTOS.length).toBeGreaterThan(500);
  });

  it("não tem travessão nem meia-risca em texto visível", () => {
    const achados = procurar(/[—–]/, {
      ignorarTexto: /travess/,
      // O sanitizador precisa citar o caractere pra removê-lo.
      ignorarArquivo: /sanitizarTextoIA\.ts$/,
      excecoes: EXCECOES_TRAVESSAO,
    });
    expect(achados).toEqual([]);
  });

  // Nomes de plano mortos (Começo/Alcance/Voo desde jul/2026, Confere/
  // Controle/Projete desde 14/09/2026). "Confere" e "Controle" também são
  // verbo em copy ("Confere o @", "Controle o negócio"), então esses três só
  // contam como nome de plano: depois de "plano" ou listados em série.
  it("não exibe nome de plano morto", () => {
    const achados = procurar(
      /\b(Começo|Alcance|Voo)\b|\b[Pp]lanos? (Confere|Controle|Projete)\b|\b(Confere|Controle|Projete)(, | e | ou )(Confere|Controle|Projete)\b/,
    );
    expect(achados).toEqual([]);
  });

  // Mundo territorial, frases que vendem ausência e hype (BRAND.md).
  // "etapa", "trilha" e "jornada" ficam livres como identificador de código,
  // mas não como palavra que a usuária lê.
  it("não usa vocabulário proibido", () => {
    const achados = procurar(
      /no seu ritmo|no seu tempo|do seu jeito|\binfoprodutos?\b|\btrilhas?\b|\bjornadas?\b|\betapas?\b|planilha por fora|\bDani\b|\bturma\b|girlboss|\bpoderosa\b|\btransforme\b|\brevolucion|fatura mais|Quero faturar|marca clara é marca que fatura/i,
      { ignorarTexto: INSTRUCAO_DE_IA },
    );
    expect(achados).toEqual([]);
  });

  // Emoji nunca vira ícone nem recurso de marketing. ©, ® e ™ são
  // tipografia, não emoji.
  it("não usa emoji em texto visível", () => {
    const achados = procurar(/(?![\u00A9\u00AE\u2122])\p{Extended_Pictographic}/u, {
      ignorarTexto: INSTRUCAO_DE_IA,
    });
    expect(achados).toEqual([]);
  });

  // Exclamação gratuita é hype. Só conta "!" que fecha frase (seguido de
  // espaço, fim ou aspas); `!important`, `!border-...` do Tailwind e
  // `<!doctype` são código.
  it("não usa exclamação em texto visível", () => {
    const achados = procurar(/!(\s|$|["'”])/, { excecoes: EXCECOES_EXCLAMACAO });
    expect(achados).toEqual([]);
  });
});

describe("planos visíveis", () => {
  // Fonte real dos nomes de plano (CLAUDE.md da raiz): a home.
  it("a home oferece Grátis, Premium e Pro", () => {
    const home = TEXTOS.filter((t) => t.arquivo === "src/routes/index.tsx").map((t) => t.texto);
    for (const nome of ["Grátis", "Premium", "Pro"]) {
      expect(
        home.some((t) => new RegExp(`\\b${nome}\\b`).test(t)),
        `plano ${nome}`,
      ).toBe(true);
    }
  });
});
