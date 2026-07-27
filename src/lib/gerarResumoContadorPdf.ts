import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ResumoContadorMes } from "@/lib/resumoContador.functions";

export interface DadosResumoContadorPdf {
  razaoSocial: string | null;
  cnpj: string | null;
  mes: number;
  ano: number;
  resumo: ResumoContadorMes;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MARGEM = 22;
const LARGURA_UTIL = 210 - MARGEM * 2;
const Y_LIMITE = 275;

function fmtDataBR(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function gerarResumoContadorPdf(dados: DadosResumoContadorPdf): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 28;

  const novaPaginaSeNecessario = (proximaAltura: number) => {
    if (y + proximaAltura > Y_LIMITE) {
      doc.addPage();
      y = 28;
    }
  };

  const tituloSecao = (texto: string, total?: number) => {
    novaPaginaSeNecessario(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(texto, MARGEM, y);
    if (total != null) {
      doc.text(moeda.format(total), 210 - MARGEM, y, { align: "right" });
    }
    y += 7;
  };

  const linhaItem = (esquerda: string, direita: string) => {
    novaPaginaSeNecessario(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(70);
    doc.text(esquerda, MARGEM, y, { maxWidth: LARGURA_UTIL - 35 });
    doc.text(direita, 210 - MARGEM, y, { align: "right" });
    y += 6;
  };

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text("Resumo do mês pro contador", MARGEM, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  const mesReferencia = format(new Date(dados.ano, dados.mes - 1, 1), "MMMM 'de' yyyy", {
    locale: ptBR,
  });
  doc.text(`Pólia · ${mesReferencia}`, MARGEM, y);
  y += 8;

  if (dados.razaoSocial || dados.cnpj) {
    doc.setFontSize(10);
    doc.setTextColor(70);
    if (dados.razaoSocial) {
      doc.text(dados.razaoSocial, MARGEM, y);
      y += 5;
    }
    if (dados.cnpj) {
      doc.text(`CNPJ ${dados.cnpj}`, MARGEM, y);
      y += 5;
    }
    y += 3;
  }

  doc.setDrawColor(220);
  doc.line(MARGEM, y, 210 - MARGEM, y);
  y += 8;

  // Receitas
  tituloSecao("Receitas", dados.resumo.receitas.total);
  if (dados.resumo.receitas.itens.length === 0) {
    linhaItem("Nenhuma receita no mês", "");
  } else {
    for (const item of dados.resumo.receitas.itens) {
      linhaItem(
        `${fmtDataBR(item.data)} · ${item.descricao?.trim() || "sem descrição"}`,
        moeda.format(item.valor),
      );
    }
  }
  y += 4;

  // Despesas por categoria
  tituloSecao("Despesas", dados.resumo.despesas.total);
  if (dados.resumo.despesas.porCategoria.length === 0) {
    linhaItem("Nenhuma despesa no mês", "");
  } else {
    for (const cat of dados.resumo.despesas.porCategoria) {
      linhaItem(cat.categoria, moeda.format(cat.total));
    }
  }
  y += 4;

  // Pró-labore
  tituloSecao("Pró-labore", dados.resumo.proLabore.total);
  y += 4;

  // Resultado
  novaPaginaSeNecessario(10);
  doc.setDrawColor(220);
  doc.line(MARGEM, y, 210 - MARGEM, y);
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20);
  doc.text("Resultado do mês", MARGEM, y);
  doc.text(moeda.format(dados.resumo.resultado), 210 - MARGEM, y, { align: "right" });
  y += 12;

  // Rodapé de aviso
  novaPaginaSeNecessario(14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text(
    "Resumo gerencial do que você registrou na Pólia. Não substitui as notas fiscais, as guias de imposto e os extratos bancários, que o seu contador também precisa.",
    MARGEM,
    y,
    { maxWidth: LARGURA_UTIL },
  );

  const arquivo = `resumo-contador-polia-${String(dados.mes).padStart(2, "0")}-${dados.ano}.pdf`;
  doc.save(arquivo);
}
