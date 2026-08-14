import { describe, expect, it } from "vitest";
import { FAIXAS, TERRITORIOS } from "./perguntas";
import { montarEmailDiagnostico } from "./email";

const faixa = FAIXAS[0];
const territorio = TERRITORIOS[0];
const DESCADASTRO = "https://usepolia.com.br/descadastrar?t=11111111-2222-3333-4444-555555555555";

function montar(
  args: { faixa?: (typeof FAIXAS)[number]; territorio?: (typeof TERRITORIOS)[number] } = {},
) {
  return montarEmailDiagnostico({
    faixa: args.faixa ?? faixa,
    territorio: args.territorio ?? territorio,
    descadastroUrl: DESCADASTRO,
  });
}

describe("e-mail do diagnóstico", () => {
  it("leva no assunto a faixa da pessoa", () => {
    expect(montar().subject).toContain(faixa.nome);
  });

  it("entrega o mesmo conteúdo da tela: faixa, território e a conta", () => {
    const { text } = montar();
    expect(text).toContain(faixa.nome);
    expect(text).toContain(faixa.resumo);
    expect(text).toContain(territorio.nome);
    expect(text).toContain(territorio.explicacao);
    expect(text).toContain(territorio.conta);
  });

  // O gate promete "você sai quando quiser". O link do rodapé é o cumprimento
  // dessa frase: se ele sumir daqui, a promessa fica sem lastro e o
  // CONSENT_TEXTO tem que mudar junto.
  it("leva o link de descadastro nas duas versões", () => {
    const { text, html } = montar();
    expect(text).toContain(DESCADASTRO);
    expect(html).toContain(`href="${DESCADASTRO}"`);
    expect(html).toContain("Não quero mais receber");
  });

  it("escapa o HTML do corpo", () => {
    // A explicação de "Razão de existir" tem aspas: viram entidade no HTML e
    // ficam literais no texto puro.
    const razao = TERRITORIOS.find((t) => t.id === "razao")!;
    const { html, text } = montar({ territorio: razao });
    expect(html).toContain("&quot;depende&quot;");
    expect(html).not.toContain('"depende"');
    expect(text).toContain('"depende"');
  });

  // Cor solta no e-mail é o jeito mais fácil de ele descolar do site, já que
  // cliente de e-mail não lê variável CSS. Estes dois travam os dois erros que
  // existiam antes: título serifado e o cinza aposentado por reprovar em AA.
  it("usa a tipografia e o cinza do design system", () => {
    const { html } = montar();
    expect(html).toContain("Cabinet Grotesk");
    expect(html).not.toContain("Georgia");
    expect(html).toContain("#6B6B6B");
    expect(html).not.toContain("#9E9E9E");
    expect(html).not.toContain("#767676");
  });

  it("põe a conta na caixa pêssego, igual à tela de resultado", () => {
    const { html } = montar();
    expect(html).toContain("#F6DAD4");
  });

  it("monta pros 6 territórios em todas as 4 faixas, sem travessão", () => {
    for (const f of FAIXAS) {
      for (const t of TERRITORIOS) {
        const { subject, text, html } = montar({ faixa: f, territorio: t });
        expect(text).toContain(t.conta);
        expect(html).toContain("Seguir @usepolia");
        for (const parte of [subject, text]) {
          expect(parte).not.toMatch(/[—–]/);
        }
      }
    }
  });
});
