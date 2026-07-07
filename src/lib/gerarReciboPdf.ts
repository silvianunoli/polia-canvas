import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Recibo simples de assinatura — NÃO é um RPA (Recibo de Pagamento Autônomo).
// RPA vale pra pagamento avulso a autônomo com retenção de INSS/IRRF; assinatura
// de SaaS é serviço recorrente, mais parecido com nota de assinatura comum
// (Netflix/Spotify): emissor, pagador, descrição, valor, data — sem retenção.
export interface DadosRecibo {
  emissorNome: string;
  emissorCpf: string;
  emissorEndereco?: string | null;
  pagadorNome: string;
  pagadorEmail: string;
  descricao: string;
  valor: number;
  dataEmissao: Date;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function gerarReciboPdf(dados: DadosRecibo): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margem = 22;
  let y = 28;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Recibo de pagamento", margem, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text("Pólia", margem, y);
  doc.setTextColor(20);
  y += 10;

  doc.setDrawColor(220);
  doc.line(margem, y, 210 - margem, y);
  y += 10;

  const linha = (rotulo: string, valor: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(rotulo, margem, y);
    doc.setFont("helvetica", "normal");
    doc.text(valor, margem + 42, y);
    y += 7;
  };

  linha("Recebido de:", dados.emissorNome);
  linha("CPF:", dados.emissorCpf);
  if (dados.emissorEndereco) linha("Endereço:", dados.emissorEndereco);
  y += 3;
  linha("Pago por:", dados.pagadorNome);
  linha("E-mail:", dados.pagadorEmail);
  y += 3;
  linha("Referente a:", dados.descricao);
  linha("Valor:", moeda.format(dados.valor));
  linha("Data de emissão:", format(dados.dataEmissao, "dd/MM/yyyy", { locale: ptBR }));

  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text(
    "Recibo de assinatura de serviço (SaaS). Não configura Recibo de Pagamento Autônomo (RPA).",
    margem,
    y,
    { maxWidth: 210 - margem * 2 },
  );

  const arquivo = `recibo-polia-${format(dados.dataEmissao, "yyyy-MM-dd")}.pdf`;
  doc.save(arquivo);
}
