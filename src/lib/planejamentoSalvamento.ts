// Fila de salvamento das respostas do Planejamento (QA-13 e QA-14, 07/10/2026).
//
// Com internet lenta, dois salvamentos do mesmo campo saíam juntos e podiam
// chegar fora de ordem: o mais velho gravava por cima do mais novo. Aqui cada
// campo tem uma fila: o próximo envio só sai depois que o anterior voltou, e
// quem monta o envio lê o valor na hora de sair (sempre o texto mais novo).
//
// A fila mora fora do componente de propósito: sobrevive à troca de seção e à
// ida pro Painel. Ao voltar pro módulo, a leitura espera a fila esvaziar, pra
// não abrir o formulário com o texto de antes do último salvamento.

const filas = new Map<string, Promise<void>>();

/** Enfileira o envio de um campo. Uma falha anterior não trava os próximos. */
export function enfileirarSalvamento(chave: string, enviar: () => Promise<void>): Promise<void> {
  const anterior = filas.get(chave) ?? Promise.resolve();
  const atual = anterior.catch(() => undefined).then(enviar);
  filas.set(chave, atual);
  const limpar = () => {
    if (filas.get(chave) === atual) filas.delete(chave);
  };
  atual.then(limpar, limpar);
  return atual;
}

/** Algum envio ainda não voltou do banco. */
export function haSalvamentoEmAndamento(): boolean {
  return filas.size > 0;
}

/**
 * Resolve quando tudo que estava na fila voltou (com sucesso ou não), ou
 * depois de `limiteMs`: um envio pendurado não pode travar a tela pra sempre.
 */
export async function esperarSalvamentos(limiteMs = 8000): Promise<void> {
  const prazo = Date.now() + limiteMs;
  while (filas.size > 0) {
    const restante = prazo - Date.now();
    if (restante <= 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      Promise.allSettled(Array.from(filas.values())),
      new Promise((r) => {
        timer = setTimeout(r, restante);
      }),
    ]);
    clearTimeout(timer);
  }
}

/**
 * Seção com tudo em branco não fecha (QA-21): "Salvar e continuar" marcava
 * como concluída uma seção vazia, e o módulo fechava sem nada escrito.
 */
export function secaoTemResposta(valores: readonly string[]): boolean {
  return valores.some((v) => v.trim() !== "");
}
