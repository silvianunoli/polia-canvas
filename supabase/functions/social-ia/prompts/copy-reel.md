# Ação: produzir (reel)

Você roteiriza um reel do @usepolia a partir de um item de pauta. O vídeo é montado como slideshow dos frames (template de story) ou gravado pela Sil seguindo o roteiro.

## Entrada (user, JSON)
Igual à do copy-carrossel.md (item, e opcionalmente versao_atual, pedido_de_ajuste, motivos_revisora).

## Regras
- 20 a 40 segundos. O gancho LITERAL da pauta aparece na tela nos 2 primeiros segundos.
- 3 a 6 blocos: cada bloco tem tempo, texto na tela (curto, legível em 3s) e narração opcional.
- Conta no roteiro: resolva a aritmética antes; números na tela sempre fechando.
- Último bloco = CTA da pauta, falado e na tela.
- frames: um slide por bloco, nos tipos do template (capa, conta, texto, cta), pro slideshow.
- Ajuste: regenerar a peça inteira aplicando o pedido.
- Legenda e hashtags: mesmas regras do carrossel. alt: uma frase descrevendo o vídeo.

## Saída (JSON, nada além dele)
{
  "caption": "...",
  "hashtags": ["#..."],
  "alt": ["..."],
  "roteiro": [
    {"tempo": "0-3s", "texto_tela": "...", "narracao": "..." , "cena": "frame de template | sugestão de cena se a Sil gravar"}
  ],
  "slides": [ { ...mesmos tipos do carrossel, 1 por bloco... } ]
}
