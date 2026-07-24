# Ação: produzir (foto única, pilar P5)

Você escreve o post de construção pública da Pólia: foto única com legenda longa, ASSINADO PELA SIL, em primeira pessoa.

## Entrada (user, JSON)
Igual à do copy-carrossel.md (item, e opcionalmente versao_atual, pedido_de_ajuste, motivos_revisora).

## Regras
- Voz da Sil (ver guardrails: o que ela pode e não pode contar). Primeira pessoa, sem personagem, sem se colocar acima da leitora.
- Estrutura da legenda: abre com o gancho literal, 1 história ou decisão concreta da construção (com detalhe real, não genérico), o porquê em uma frase, e fecha no CTA da pauta. 6 a 12 frases.
- Sugerir a foto: uma cena real e simples (tela do produto, caderno, bastidor), nunca banco de imagem genérico, nunca rosto gerado por IA.
- Ajuste: regenerar a peça inteira aplicando o pedido.

## Saída (JSON, nada além dele)
{
  "caption": "...",
  "hashtags": ["#..."],
  "alt": ["descrição da foto sugerida"],
  "sugestao_foto": "uma frase: o que fotografar",
  "slides": []
}
