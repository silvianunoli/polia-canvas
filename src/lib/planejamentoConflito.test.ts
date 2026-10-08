import { describe, it, expect } from "vitest";
import {
  ConflitoDeVersao,
  ehConflitoDeVersao,
  houveConflito,
  salvarComVersao,
  type OperacoesResposta,
  type VersaoResposta,
} from "./planejamentoConflito";

const v = (resposta: string | null, updated_at: string): VersaoResposta => ({
  resposta,
  updated_at,
});

/** Banco de mentira com uma linha só, que imita UPDATE condicional e INSERT. */
function bancoFalso(inicial: VersaoResposta | null) {
  let linha = inicial;
  let relogio = 100;
  const proximaData = () => `t${relogio++}`;
  const ops: OperacoesResposta = {
    ler: async () => linha,
    atualizarSe: async (lido, resposta) => {
      if (!linha || linha.updated_at !== lido) return null;
      linha = v(resposta, proximaData());
      return linha;
    },
    inserir: async (resposta) => {
      if (linha) return null;
      linha = v(resposta, proximaData());
      return linha;
    },
  };
  return {
    ops,
    get linha() {
      return linha;
    },
    /** Outra aba grava direto. */
    outraAba(resposta: string | null) {
      linha = v(resposta, proximaData());
      return linha;
    },
  };
}

describe("houveConflito", () => {
  it("o banco já tem o texto que vai ser salvo: não é conflito", () => {
    expect(houveConflito(v("a", "t1"), v("b", "t2"), "b")).toBe(false);
  });

  it("a aba não leu linha nenhuma e a outra aba escreveu algo: é conflito", () => {
    expect(houveConflito(null, v("da outra aba", "t2"), "desta aba")).toBe(true);
  });

  it("a aba não leu linha nenhuma e a do banco está em branco: não é conflito", () => {
    expect(houveConflito(null, v("   ", "t2"), "desta aba")).toBe(false);
    expect(houveConflito(null, v(null, "t2"), "desta aba")).toBe(false);
  });

  it("o texto do banco mudou desde a leitura: é conflito", () => {
    expect(houveConflito(v("lido", "t1"), v("outro", "t2"), "novo")).toBe(true);
  });

  it("mudou só a data, o texto é o lido: não é conflito", () => {
    expect(houveConflito(v("lido", "t1"), v("lido", "t9"), "novo")).toBe(false);
  });

  it("null e vazio contam como o mesmo texto", () => {
    expect(houveConflito(v(null, "t1"), v("", "t2"), "novo")).toBe(false);
  });
});

describe("salvarComVersao", () => {
  it("sem ninguém no meio, grava e devolve a versão nova", async () => {
    const b = bancoFalso(v("antes", "t1"));
    const gravada = await salvarComVersao(v("antes", "t1"), "depois", b.ops);
    expect(gravada.resposta).toBe("depois");
    expect(b.linha?.resposta).toBe("depois");
  });

  it("linha que não existia: insere", async () => {
    const b = bancoFalso(null);
    const gravada = await salvarComVersao(null, "primeira", b.ops);
    expect(gravada.resposta).toBe("primeira");
  });

  it("outra aba gravou depois da leitura: não sobrescreve e lança o conflito", async () => {
    const b = bancoFalso(v("antes", "t1"));
    b.outraAba("texto da outra aba");
    const erro = await salvarComVersao(v("antes", "t1"), "texto desta aba", b.ops).catch(
      (e: unknown) => e,
    );
    expect(ehConflitoDeVersao(erro)).toBe(true);
    expect((erro as ConflitoDeVersao).noBanco.resposta).toBe("texto da outra aba");
    // O banco continua com o texto da outra aba.
    expect(b.linha?.resposta).toBe("texto da outra aba");
  });

  it("outra aba criou a linha antes desta: conflito, sem sobrescrever", async () => {
    const b = bancoFalso(null);
    b.outraAba("criado na outra aba");
    await expect(salvarComVersao(null, "desta aba", b.ops)).rejects.toBeInstanceOf(
      ConflitoDeVersao,
    );
    expect(b.linha?.resposta).toBe("criado na outra aba");
  });

  it("manter a versão desta aba: partindo da versão do banco, grava", async () => {
    const b = bancoFalso(v("antes", "t1"));
    const daOutra = b.outraAba("texto da outra aba");
    const gravada = await salvarComVersao(daOutra, "texto desta aba", b.ops);
    expect(gravada.resposta).toBe("texto desta aba");
    expect(b.linha?.resposta).toBe("texto desta aba");
  });

  it("mudou só a data no banco: grava sem acusar conflito", async () => {
    const b = bancoFalso(v("antes", "t1"));
    b.outraAba("antes");
    const gravada = await salvarComVersao(v("antes", "t1"), "depois", b.ops);
    expect(gravada.resposta).toBe("depois");
  });

  it("a escrita no banco é desta mesma aba: não é conflito", async () => {
    const b = bancoFalso(v("antes", "t1"));
    const propria = b.outraAba("salvo por esta aba na seção anterior");
    const gravada = await salvarComVersao(v("antes", "t1"), "texto novo", {
      ...b.ops,
      ehDestaAba: (x) => x.updated_at === propria.updated_at,
    });
    expect(gravada.resposta).toBe("texto novo");
  });

  it("filtro por data não bateu mas o banco está na versão lida: grava sem condição", async () => {
    let gravadoSemCondicao: string | null = null;
    const ops: OperacoesResposta = {
      ler: async () => v("antes", "t1"),
      atualizarSe: async () => null,
      inserir: async () => null,
      gravarSemCondicao: async (r) => {
        gravadoSemCondicao = r;
        return v(r, "t2");
      },
    };
    const gravada = await salvarComVersao(v("antes", "t1"), "depois", ops);
    expect(gravadoSemCondicao).toBe("depois");
    expect(gravada.resposta).toBe("depois");
  });

  it("gravação sem condição nunca é usada quando outra aba mudou o texto", async () => {
    let usou = false;
    const b = bancoFalso(v("antes", "t1"));
    b.outraAba("texto da outra aba");
    const ops: OperacoesResposta = {
      ...b.ops,
      gravarSemCondicao: async (r) => {
        usou = true;
        return v(r, "t9");
      },
    };
    await expect(salvarComVersao(v("antes", "t1"), "desta aba", ops)).rejects.toBeInstanceOf(
      ConflitoDeVersao,
    );
    expect(usou).toBe(false);
  });

  it("linha apagada no meio: grava do zero", async () => {
    const b = bancoFalso(null);
    const gravada = await salvarComVersao(v("antes", "t1"), "de novo", b.ops);
    expect(gravada.resposta).toBe("de novo");
  });

  it("erro de rede sobe como veio, pra fila tentar de novo", async () => {
    const falha = new Error("rede");
    const ops: OperacoesResposta = {
      ler: async () => null,
      atualizarSe: async () => {
        throw falha;
      },
      inserir: async () => null,
    };
    await expect(salvarComVersao(v("a", "t1"), "b", ops)).rejects.toBe(falha);
  });
});
