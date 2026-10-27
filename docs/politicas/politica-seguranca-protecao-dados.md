# Política de Segurança da Informação e Proteção de Dados

**Nunoli Soluções Digitais Ltda** (Pólia One) · CNPJ no cadastro da empresa
Versão 1.0 · Vigente a partir de 23/10/2026 · Aprovada por: Silvia Nunes de Oliveira, sócia administradora

> Esta é a versão de referência, em português. A versão em inglês (`security-data-protection-policy.html` e o PDF)
> tem o mesmo conteúdo e é a que vai para parceiros como o TikTok Shop. Ao adotar, a Pólia passa a cumprir o que
> está escrito aqui. Os itens marcados com ⚠️ ainda precisam de ação para ficarem verdadeiros.

## 1. Objetivo e alcance

Define como a Pólia protege as informações que trata: dados da própria empresa, dados das usuárias da Pólia One
e dados de terceiros que chegam pela usuária, como clientes dela e pedidos de marketplaces (TikTok Shop,
Shopee). Vale para todos os sistemas, contas e aparelhos usados na operação da Pólia, e para qualquer pessoa
que venha a ter acesso a eles.

## 2. Papéis

- **Responsável por segurança e privacidade, e encarregada de dados (DPO):** Silvia Nunes de Oliveira, contato
  privacidade@usepolia.com.br. Aprova esta política, concede e retira acessos, coordena incidentes e responde
  às titulares e às autoridades.
- **Quem tiver acesso** (equipe ou prestadores, quando houver): segue esta política, assina compromisso de
  confidencialidade antes do primeiro acesso e avisa a responsável sobre qualquer suspeita de incidente.

## 3. Classificação dos dados

| Nível | Exemplos | Regra |
|---|---|---|
| Restrito | tokens de acesso de marketplaces, chaves de API, senhas, dados de pagamento | só em cofre de segredos ou criptografado; nunca em código, log, planilha ou chat |
| Confidencial | dados pessoais de usuárias e das clientes delas, pedidos, financeiro das usuárias | acesso só da dona da conta e de processos do servidor; criptografia em trânsito e em repouso |
| Interno | documentos de produto, métricas agregadas | acesso só de quem trabalha na Pólia |
| Público | site, blog, política de privacidade | sem restrição |

## 4. Controle de acesso

- Menor privilégio: cada pessoa e cada processo acessa só o necessário.
- No produto, cada tabela com dado de usuária tem RLS (segurança por linha): a conta só lê e grava os próprios
  dados. A chave de serviço do banco fica só no servidor, nunca no navegador.
- Funções administrativas exigem papel de admin conferido a cada requisição.
- ⚠️ Verificação em duas etapas obrigatória em todas as contas administrativas: Supabase, Cloudflare, GitHub,
  Stripe, Google, Partner Center do TikTok Shop e e-mail da empresa.
- Hoje o acesso de produção é só da responsável. Novos acessos são individuais (sem conta compartilhada),
  registrados, revistos a cada 6 meses e retirados no mesmo dia em que a pessoa deixa de precisar.

## 5. Criptografia e segredos

- Todo tráfego usa TLS (HTTPS).
- O banco (Supabase, PostgreSQL gerenciado) é criptografado em repouso (AES-256).
- Tokens de acesso de marketplaces ficam no Supabase Vault, criptografados e lidos só por código do servidor.
- Segredos de produção ficam só nos cofres das plataformas (secrets do Cloudflare Worker e do Supabase). Nunca
  em código-fonte, repositório, log ou conversa.

## 6. Segurança dos aparelhos e da rotina

- Bloqueio de tela automático, senha forte e única por serviço, guardada em gerenciador de senhas.
- ⚠️ Antivírus ativo e atualizado (Microsoft Defender) e atualizações automáticas do sistema.
- Mesa limpa: nenhum segredo ou dado de cliente em papel ou à vista em tela compartilhada.
- Dado de cliente não é baixado para o aparelho sem necessidade; quando for, é apagado depois do uso.

## 7. Rede e infraestrutura

- A aplicação roda em Cloudflare Workers, atrás da rede da Cloudflare (proteção contra DDoS e TLS).
- O banco não fica exposto diretamente: o acesso passa por APIs autenticadas com RLS.
- CORS restrito, limite de requisições em login e em operações caras, verificação anti-robô (Turnstile) nos
  formulários públicos.

## 8. Desenvolvimento seguro

- Toda entrega passa pelo checklist de segurança antes de subir (`docs/checklist-seguranca.md`): segredos,
  validação de entrada, autorização por objeto, exposição de campos, dependências.
- Consultas ao banco sempre parametrizadas; saída escapada contra XSS.
- Mudança de banco é feita por migração versionada; os alertas de segurança do Supabase são revistos depois de
  cada mudança de estrutura.

## 9. Gestão de vulnerabilidades

- Varredura de dependências com vulnerabilidade conhecida antes de cada entrega.
- Revisão completa de segurança da aplicação pelo menos uma vez por ano e depois de mudança grande
  (a última foi em julho de 2026: 14 achados, todos corrigidos e conferidos em produção).
- Prazo para corrigir: crítica em até 7 dias, alta em até 30 dias, média e baixa no ciclo normal.

## 10. Registro e monitoramento

- Erros da aplicação são registrados sem dados sensíveis.
- Alertas automáticos de produção (falha de webhook de pagamento, pico de erros, site fora do ar) chegam à
  responsável em tempo real pelo Telegram (função `alertas-criticos`).

## 11. Resposta a incidentes

1. **Detectar:** alerta automático, aviso de usuária, de parceiro ou de prestador.
2. **Conter:** revogar tokens e chaves afetados, bloquear o acesso, corrigir a falha.
3. **Avaliar:** quais dados, de quem, quanto e por quanto tempo.
4. **Comunicar:**
   - vendedoras afetadas e o parceiro de origem (por exemplo, TikTok Shop), por e-mail, **em até 48 horas**
     depois da confirmação;
   - titulares e ANPD quando houver risco ou dano relevante, como manda a LGPD (art. 48).
5. **Registrar e aprender:** o que aconteceu, a causa, o que foi feito e o que muda para não repetir.

## 12. Proteção de dados pessoais (LGPD)

- Para os dados das usuárias, a Pólia é controladora. Para os dados das clientes das usuárias e dos pedidos de
  marketplace, a Pólia é **operadora**: trata só para prestar o serviço que a usuária contratou.
- **Minimização:** do pedido de marketplace, a Pólia guarda só o necessário para registrar venda, estoque e taxas.
  Endereço completo da compradora não é guardado.
- **Dados de compradoras de marketplace** não são usados para marketing, não são vendidos e não servem para
  contatar a compradora fora da plataforma de origem.
- **Retenção:**
  - dados da conta: enquanto a conta existir; a usuária exclui a conta sozinha, dentro do produto, e os dados são
    apagados na hora;
  - tokens de marketplace: apagados no momento da desconexão;
  - demais dados vindos de marketplace: apagados em até 30 dias depois da desconexão ou do fim da conta;
  - registros que a lei obriga a guardar (fiscais e financeiros): até 5 anos.
- **Pedidos das titulares** (acesso, correção, exclusão, portabilidade): pelo privacidade@usepolia.com.br,
  respondidos em até 15 dias. Pedidos que chegam por um parceiro, como o TikTok Shop, seguem o mesmo prazo.
- **Prestadores (operadores):** Supabase (banco, EUA), Cloudflare (aplicação), Stripe (pagamento), Resend (e-mail),
  Google (Agenda, Analytics, Gemini). Novo prestador só entra com acordo de tratamento de dados e atualização da
  política de privacidade.
- **Transferência internacional:** os dados ficam nos EUA (Supabase, us-east-2), com base nas garantias do art. 33
  da LGPD (cláusulas contratuais e DPA dos prestadores).

## 13. Revisão

Revista uma vez por ano, e antes disso sempre que mudar a lei, entrar prestador novo ou acontecer um incidente.
A política de privacidade pública (usepolia.com.br/privacidade) segue as mesmas regras.

| Versão | Data | O que mudou |
|---|---|---|
| 1.0 | 23/10/2026 | Primeira versão |
