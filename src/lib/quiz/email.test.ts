import { describe, expect, it } from "vitest";
import { FAIXAS, TERRITORIOS } from "./perguntas";
import { montarEmailDiagnostico } from "./email";

const faixa = FAIXAS[0];
const territorio = TERRITORIOS[0];

describe("e-mail do diagnóstico", () => {
  it("leva no assunto a faixa da pessoa", () => {
    expect(montarEmailDiagnostico({ faixa, territorio }).subject).toContain(faixa.nome);
  });

  it("entrega o mesmo conteúdo da tela: faixa, território e a conta", () => {
    const { text } = montarEmailDiagnostico({ faixa, territorio });
    expect(text).toContain(faixa.nome);
    expect(text).toContain(faixa.resumo);
    expect(text).toContain(territorio.nome);
    expect(text).toContain(territorio.explicacao);
    expect(text).toContain(territorio.conta);
  });

  // O gate promete "você sai quando quiser". Sem rota de descadastro, a saída
  // é o endereço de contato, e ele não pode sumir do corpo sem a promessa
  // sumir junto do CONSENT_TEXTO.
  it("diz como sair da lista", () => {
    const { text, html } = montarEmailDiagnostico({ faixa, territorio });
    expect(text).toContain("oi@usepolia.com.br");
    expect(html).toContain("oi@usepolia.com.br");
  });

  it("escapa o HTML do corpo", () => {
    // A explicação de "Razão de existir" tem aspas: viram entidade no HTML e
    // ficam literais no texto puro.
    const razao = TERRITORIOS.find((t) => t.id === "razao")!;
    const { html, text } = montarEmailDiagnostico({ faixa, territorio: razao });
    expect(html).toContain("&quot;depende&quot;");
    expect(html).not.toContain('"depende"');
    expect(text).toContain('"depende"');
  });

  it("monta pros 6 territórios em todas as 4 faixas, sem travessão", () => {
    for (const f of FAIXAS) {
      for (const t of TERRITORIOS) {
        const { subject, text, html } = montarEmailDiagnostico({ faixa: f, territorio: t });
        expect(text).toContain(t.conta);
        expect(html).toContain("Seguir @usepolia");
        for (const parte of [subject, text]) {
          expect(parte).not.toMatch(/[—–]/);
        }
      }
    }
  });
});
