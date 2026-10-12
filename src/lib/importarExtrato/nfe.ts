// XML de NF-e (nota de produto, modelo 55/65). Nota emitida com o CNPJ dela
// é venda (entrada); qualquer outra é compra (saída). Nota de serviço (NFS-e)
// tem um layout por prefeitura e fica de fora por enquanto.

import { CATEGORIA_INSUMOS } from "@/lib/projecao.functions";
import { CATEGORIAS_DE_VENDA } from "@/lib/numerosDoMes";
import { lerDataExtrato, limparTexto, soDigitos, type ResultadoLeitura } from "./comum";

function texto(pai: Element | Document | undefined, tag: string): string | null {
  const el = pai?.getElementsByTagNameNS("*", tag)[0];
  const v = el?.textContent?.trim();
  return v ? v : null;
}

function documento(pai: Element | undefined): string {
  return soDigitos(texto(pai, "CNPJ") ?? texto(pai, "CPF"));
}

export function lerNfe(xml: string, cnpjDela: string | null): ResultadoLeitura {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    return { erro: "Esse arquivo não é um XML válido." };
  }
  const infNFe = doc.getElementsByTagNameNS("*", "infNFe")[0];
  if (!infNFe) {
    return {
      erro: "Esse XML não é de NF-e de produto. Nota de serviço (NFS-e) muda de cidade pra cidade e ainda não entra.",
    };
  }
  const chave = soDigitos(infNFe.getAttribute("Id"));
  const ide = infNFe.getElementsByTagNameNS("*", "ide")[0];
  const emit = infNFe.getElementsByTagNameNS("*", "emit")[0];
  const dest = infNFe.getElementsByTagNameNS("*", "dest")[0];
  const total = infNFe.getElementsByTagNameNS("*", "ICMSTot")[0];
  const data = lerDataExtrato(texto(ide, "dhEmi") ?? texto(ide, "dEmi") ?? "");
  const valor = Number(texto(total, "vNF") ?? "");
  if (!data || !Number.isFinite(valor) || valor <= 0) {
    return { erro: "A nota não tem data de emissão ou valor total." };
  }
  const numero = texto(ide, "nNF") ?? "";
  const meu = soDigitos(cnpjDela);
  const ehVenda = meu.length > 0 && documento(emit) === meu;
  const outraParte = limparTexto(texto(ehVenda ? dest : emit, "xNome") ?? "");
  const avisos =
    meu.length === 0
      ? [
          "Sem CNPJ em Configurações, a Pólia trata a nota como compra. Se for venda sua, troque pra entrada na revisão.",
        ]
      : [];
  return {
    linhas: [
      {
        data,
        descricao: limparTexto(`NF ${numero}${outraParte ? ` · ${outraParte}` : ""}`),
        valor,
        tipo: ehVenda ? "entrada" : "saida",
        idExterno: chave ? `nfe:${chave}` : null,
        categoria: ehVenda ? CATEGORIAS_DE_VENDA[0] : CATEGORIA_INSUMOS,
      },
    ],
    avisos,
  };
}
