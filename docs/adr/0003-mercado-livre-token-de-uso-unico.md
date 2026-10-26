# ADR-003: Mercado Livre direto, com renovação de token travada por conexão

- **Data:** 2026-10-25
- **Status:** ☑ Aceito

## Contexto

A Sil decidiu em 24/10/2026 (VND-29) que o Mercado Livre entra antes da Shopee, por conexão direta, como o TikTok
Shop da ADR-002. Duas regras do Mercado Livre mudam o desenho em relação ao TikTok:

- **Token de acesso de 6 horas e token de renovação de USO ÚNICO.** Cada renovação devolve um par novo e o token
  de renovação antigo morre. Se duas partes do sistema renovarem ao mesmo tempo, a segunda usa um token que a
  primeira já gastou, o Mercado Livre recusa e a conexão cai até a vendedora autorizar de novo.
- **Aviso de pedido sem assinatura.** O tópico `orders_v2` só traz `resource`, `user_id`, `topic` e
  `application_id`. Qualquer um que saiba a URL pode mandar um aviso falso.

Quem precisa de token: o Worker (tela "Ligar anúncios") e a edge function `ml-sync` (pedidos, varredura e estoque).

## Decisão

1. **Toda renovação passa por uma trava por conexão, com dono.** Chave `ml_token:<id da conexão>` na tabela
   `canal_sync_travas`, por 60 segundos, pegada por `pegar_trava_com_dono` (devolve um uuid) e solta só por quem
   tem esse uuid. Toda chamada ao Mercado Livre tem prazo de 10 segundos, então a renovação nunca passa da trava.
   Quem pega a trava lê o token de novo (outra parte pode ter acabado de renovar), renova e grava o par novo no
   Vault com até 3 tentativas. Quem não pega espera até 12 segundos o token novo aparecer, sem gastar o de
   renovação. Se o Mercado Livre recusar, a Pólia lê o token de novo antes de derrubar a conexão: se outra parte
   já gravou um par novo, a conexão está de pé. A regra mora
   num lugar só, `supabase/functions/_shared/mercadoLivreAcesso.ts`, usada pelo Worker e pelo `ml-sync`.
2. **Renova quando faltam menos de 10 minutos** para vencer, nunca em laço. Recusa do Mercado Livre (HTTP 400/401)
   põe a conexão em `erro` e o card pede para conectar de novo; falha de rede ou 5xx não derruba a conexão.
3. **O aviso só põe um id na fila.** `ml-webhook` aceita só `orders_v2` do próprio app, de vendedora conectada na
   Pólia, com recurso no formato `/orders/<número>`, e enfileira por `enfileirar_evento_canal`: não zera
   tentativas, não ressuscita evento que desistiu e para em 500 pendentes por vendedora. A venda nasce do pedido
   buscado na API com o token da própria vendedora, e só se ela for a vendedora do pedido (`seller.id`); nada do
   corpo do aviso vira dado de venda.
4. **OAuth com `state` e PKCE (S256)** guardados na conexão e zerados antes da troca do code. Diferente do
   TikTok, não existe autorização que começa no Mercado Livre: volta sem `state` é recusada.

Ajustes da revisão de segurança (3c.5, 25/10): trava com dono e 60 s no lugar de 30 s, prazo de 10 s nas chamadas,
releitura antes de derrubar a conexão, conferência da vendedora do pedido e fila do aviso com teto.

Ajuste em relação ao plano original (§5): o plano dizia que só o `ml-sync` renovaria. A tela de anúncios também
precisa de token, então as duas partes renovam pela mesma trava.

## Alternativas consideradas

- **Só o `ml-sync` renova, a tela espera:** a tela de anúncios ficaria sem resposta por até 1 minuto depois de
  6 horas parada. Rejeitado.
- **Renovar sempre que o token for usado:** gasta e troca o token de renovação a cada chamada, multiplica o risco
  de corrida. Rejeitado.
- **Trava de sessão do Postgres (advisory lock):** cada RPC do PostgREST cai numa conexão diferente do pool e a
  trava não sobreviveria entre chamadas (mesma razão da 3a.5). Rejeitado.
- **Conferir o aviso pela origem (IP do Mercado Livre):** a lista de IPs não é garantida e muda. Ficou a regra de
  "aviso só põe id na fila".

## Consequências

- **Positivas:** a conexão não cai por corrida entre a tela e o sync; aviso falso não cria venda nem mexe em
  estoque; a regra de token é uma só para as duas partes.
- **Negativas / trade-offs:** uma chamada da tela pode esperar até 12 segundos se o sync estiver renovando naquele
  instante; aviso falso de vendedora conectada ainda gasta chamadas à API até o teto de 500 pendentes (o pedido não
  existe ou não é dela, e o evento morre).
- **Riscos:** o Mercado Livre devolver o par novo e a Pólia não conseguir gravar 3 vezes seguidas (sinal: evento
  `integration_failure` com motivo `token_novo_nao_salvo` e conexão em `erro`; resposta: a vendedora conecta de
  novo). Autorização parada por 4 meses é invalidada pelo Mercado Livre; com o `ml-sync` varrendo a cada 15
  minutos, não acontece.

## Referências

- `docs/plano-fase3c-mercado-livre.md` (§2, §5, §8) e ADR-002
- Commits 89b63e3, d1734ee, a6674c0, 54fb676 (etapas 3c.1 a 3c.4)
- Kanban: VND-29 (decisão), VND-30 (fase), VND-31 (app no DevCenter)
