import { describe, expect, it } from "vitest";
import { FAIXAS, TERRITORIOS, type Territorio } from "./perguntas";
import { montarEmailDiagnostico } from "./email";

const faixa = FAIXAS[0];
const territorio = TERRITORIOS[0];
const DESCADASTRO = "https://usepolia.com.br/descadastrar?t=11111111-2222-3333-4444-555555555555";

function montar(args: { faixa?: (typeof FAIXAS)[number]; territorio?: Territorio } = {}) {
  return montarEmailDiagnostico({
    faixa: args.faixa ?? faixa,
    territorio: args.territorio ?? territorio,
    descadastroUrl: DESCADASTRO,
  });
}

describe("e-mail do diagnóstico", () => {
  // Assunto fixo e sem "quase pronto": o diagnóstico já vai no corpo (08/10/2026).
  it("leva assunto fixo, igual em toda faixa", () => {
    expect(montar({ faixa: FAIXAS[0] }).subject).toBe("Seu diagnóstico");
    expect(montar({ faixa: FAIXAS[3] }).subject).toBe("Seu diagnóstico");
  });

  // A abertura fixa de 16/09 elogiava até a pior faixa. Agora ela é a da
  // própria faixa, igual à tela de resultado.
  it("abre pela faixa, sem o elogio fixo, e entrega território e a conta", () => {
    for (const f of FAIXAS) {
      const { text, html } = montar({ faixa: f });
      expect(text).toContain(f.nome);
      expect(text).toContain(f.resumo);
      expect(html).toContain(f.resumo);
      expect(text).not.toContain("Você já resolveu boa parte");
      expect(text).not.toContain("quase pronto");
    }
    const { text } = montar();
    expect(text).toContain(territorio.nome);
    expect(text).toContain(territorio.explicacao);
    expect(text).toContain(territorio.conta);
  });

  // O quiz terminava só no Instagram. O botão do e-mail leva pro cadastro
  // Grátis com origem=quiz; o Instagram continua como link de texto.
  it("leva o cadastro grátis no botão e o Instagram no texto", () => {
    const { text, html } = montar();
    const cadastro = "https://one.usepolia.com.br/auth/cadastro?origem=quiz";
    expect(text).toContain(`Quero começar grátis: ${cadastro}`);
    expect(html).toContain(`href="${cadastro}"`);
    expect(html).toContain("Quero começar grátis");
    expect(text).toContain("https://www.instagram.com/hub.polia/");
    expect(html).toContain('href="https://www.instagram.com/hub.polia/"');
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
    // Território sintético só pra testar o escape -- não depende de aspas
    // estarem presentes na copy real de nenhum território.
    const comAspas = {
      ...territorio,
      explicacao: 'Ela ouve "não sei" e trava.',
    } as unknown as Territorio;
    const { html, text } = montar({ territorio: comAspas });
    expect(html).toContain("&quot;não sei&quot;");
    expect(html).not.toContain('"não sei"');
    expect(text).toContain('"não sei"');
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
        expect(html).toContain("Seguir @hub.polia");
        for (const parte of [subject, text]) {
          expect(parte).not.toMatch(/[—–]/);
        }
      }
    }
  });
});
