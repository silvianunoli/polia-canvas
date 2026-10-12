// OFX: o formato de extrato que quase todo banco exporta. Vem em duas
// variantes, SGML (tag sem fechar: "<TRNAMT>-29.90") e XML (com fechamento);
// a leitura por bloco <STMTTRN> e valor até o próximo "<" cobre as duas.

import { lerDataExtrato, limparTexto, type LinhaImportada, type ResultadoLeitura } from "./comum";

function campo(bloco: string, tag: string): string | null {
  const m = bloco.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  const v = m?.[1]?.trim();
  return v ? v : null;
}

function lerValorOfx(bruto: string): number | null {
  // No OFX o ponto é a casa decimal; alguns bancos daqui mandam vírgula.
  const n = Number(bruto.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function lerOfx(texto: string): ResultadoLeitura {
  if (!/<OFX>/i.test(texto) && !/<STMTTRN>/i.test(texto)) {
    return { erro: "Esse arquivo não parece um extrato OFX." };
  }
  const conta = campo(texto, "ACCTID") ?? "";
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const linhas: LinhaImportada[] = [];
  let ignoradas = 0;
  for (const cru of blocos) {
    const bloco = cru.split(/<\/STMTTRN>/i)[0];
    const data = lerDataExtrato(campo(bloco, "DTPOSTED") ?? "");
    const valor = lerValorOfx(campo(bloco, "TRNAMT") ?? "");
    if (!data || valor === null || valor === 0) {
      ignoradas++;
      continue;
    }
    const memo = campo(bloco, "MEMO");
    const nome = campo(bloco, "NAME");
    const fitid = campo(bloco, "FITID");
    linhas.push({
      data,
      descricao: limparTexto(memo ?? nome ?? "Movimentação do extrato"),
      valor: Math.abs(valor),
      tipo: valor > 0 ? "entrada" : "saida",
      idExterno: fitid ? `ofx:${conta}:${fitid}` : null,
    });
  }
  if (linhas.length === 0) {
    return { erro: "A Pólia não achou nenhuma movimentação nesse extrato." };
  }
  const avisos =
    ignoradas > 0
      ? [
          `${ignoradas} ${ignoradas === 1 ? "linha ficou" : "linhas ficaram"} de fora por não ter data ou valor.`,
        ]
      : [];
  return { linhas, avisos };
}
