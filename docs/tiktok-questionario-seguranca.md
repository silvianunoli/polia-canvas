# TikTok Shop: questionário de segurança e privacidade de dados

> Preparado em 23/10/2026. Perguntas lidas no Partner Center (Minha conta > Categoria e mercado).
> O TikTok pede as respostas **em inglês** e diz para responder "de forma completa e verdadeira".
> Cada resposta abaixo foi conferida no código, na /privacidade e nos docs do polia-app.
> Onde está **CONFIRA**, só você sabe se é verdade: troque a resposta se não for.

## Antes de colar: o ponto que pesa

Cinco perguntas falam em **política publicada** (segurança, controle de acesso, classificação de dados,
resposta a incidente, política interna de dados). A Pólia **pratica** quase tudo isso (RLS, criptografia,
alertas, revisão de segurança), mas **não tem um documento formal publicado**. Responder "Sim" sem o documento
seria falso, e o TikTok pode pedir o arquivo (campo "Carregar").

Duas saídas:
- **A (agora):** responder "Não" nessas cinco e explicar o que é praticado, como está abaixo.
- **B (melhor para a aprovação):** o Claude escreve uma "Política de Segurança da Informação e Proteção de Dados"
  de 3 a 4 páginas, você lê e adota, e aí as cinco viram "Sim" com o PDF anexado. Dá para usar **Salvar** no
  questionário e enviar depois.

As respostas abaixo estão na versão A, com a troca para B indicada.

**ATUALIZADO 23/10 (noite): seguiu a saída B.** A política foi escrita (`docs/politicas/`, PDF
`Polia-Security-Data-Protection-Policy-v1.pdf`) e o Claude preencheu o questionário no Chrome: 15 Sim
e 3 Não (incidente, reclamação, certificação), textos curtos em inglês em cada pergunta e o PDF anexado em seis
delas. A Sil escolheu os países (Estados Unidos e Brasil) e **enviou em 23/10/2026**.

**ATUALIZADO 27/10: reprovado em 26/10, reenviar.** O TikTok pediu um "Personal Information Protection
Standard" ou provas de cada "Sim". Foi feito `docs/politicas/Polia-Personal-Information-Protection-Standard-v1.pdf`
(6 páginas, inglês): inventário dos dados do TikTok por escopo, nada da compradora guardado, controles, prazos de
exclusão, pedidos de titular, subprocessadores, aviso em 48 h, Apêndice A com provas conferidas no banco em
produção (RLS em 107 de 107 tabelas etc.) e Apêndice B ligando cada "Sim" a uma seção.
Reenvio: Partner Center > Avaliação de segurança e privacidade de dados > Editar; anexar o PDF novo nas
perguntas 1, 5, 6, 7, 12 e 13 (junto do PDF da política onde já estiver); em "Comentário final" colar:
> Following your review on October 26, we attached our Personal Information Protection Standard v1.0. It
> includes the TikTok Shop data inventory by scope, retention and deletion rules, and an evidence appendix
> (Appendix A) and a map from each "Yes" answer to the supporting section (Appendix B).

**REENVIADO 27/10 (noite):** PDF anexado nas 9 perguntas com Sim que aceitam arquivo (1 a 8 e 12), comentário
final atualizado, a Sil clicou em Enviar. Status no Partner Center: "em análise".

---

## Segurança

**1. Sua organização tem uma política ou programa de segurança da informação publicado?**
Resposta: **Não** (vira Sim na saída B)
> We do not yet have a standalone published information security policy document. Our security program is
> documented internally and enforced in our development process: a mandatory pre-release security checklist
> (secrets, input validation, authorization, dependency scanning), row-level security on every database table
> holding user data, and periodic security reviews (the last full review in July 2026 covered 14 findings, all
> remediated). We are formalizing these practices into a published policy.

**2. Segregação de rede e proteção contra ameaças?**
Resposta: **Sim**
> Our application runs on Cloudflare Workers (serverless) behind Cloudflare's network, which provides DDoS
> protection and TLS termination. The database (Supabase, managed PostgreSQL) is not exposed directly: access
> goes through authenticated APIs with row-level security, and privileged keys are used only on the server side.
> Production incidents (payment webhook failures, error rate spikes, external health check failures) trigger
> automatic alerts to the founder.

**3. Antivírus nos terminais da empresa?**
Resposta: **Sim**. CONFIRA se o Microsoft Defender está ligado no seu notebook (Windows 11 vem com ele ativo).
> Company endpoints run Microsoft Defender Antivirus with real-time protection and automatic updates.

**4. Linha de base de segurança (bloqueio de tela, senha forte, mesa limpa, MFA)?**
Resposta: **Sim**. CONFIRA se a autenticação em duas etapas está ligada no Supabase, Cloudflare, GitHub e Stripe.
Se faltar em algum, ligue antes de enviar.
> Yes. Screen lock and strong, unique passwords stored in a password manager on all company devices;
> multi-factor authentication on all administrative accounts (cloud infrastructure, source code repository,
> payment provider); production secrets are stored only in the platform secret managers, never in source code
> or chat tools.

**5. Política de controle de acesso publicada e privilégio mínimo?**
Resposta: **Não** (vira Sim na saída B)
> We do not have a standalone published access control policy, but least privilege is enforced technically:
> row-level security on every table with personal data, scoped to the account owner; OAuth tokens from sales
> channels are stored encrypted and readable only by server-side code; administrative functions require an
> admin role checked on every request; production access is limited to the founder.

**6. Política de classificação de dados publicada e criptografia em trânsito e em repouso?**
Resposta: **Não** (vira Sim na saída B)
> We do not have a published data classification policy. All data is encrypted in transit (TLS) and at rest
> (Supabase managed PostgreSQL, AES-256). Third-party access tokens are stored in Supabase Vault (encrypted).
> We apply data minimization: from marketplace orders we keep only what is needed to record the sale, stock
> movement and fees, and not the buyer's full address.

**7. Política de resposta a incidentes publicada, com papéis e canais?**
Resposta: **Não** (vira Sim na saída B)
> We do not have a standalone published incident response policy. In practice: automated alerts for
> production incidents reach the founder in real time; the founder is responsible for triage, containment and
> communication; our public privacy policy commits us to notify affected users and the Brazilian data
> protection authority (ANPD) of relevant incidents.

**8. Procedimento de gestão de vulnerabilidades ou ameaças?**
Resposta: **Sim**
> Yes. Every release goes through a security checklist that includes dependency vulnerability scanning;
> database security advisors are reviewed after schema changes; we run periodic full security reviews of the
> application (the July 2026 review produced 14 findings, all fixed and verified in production).

## Privacidade e conformidade

**9. Violação com notificação a autoridade ou cliente nos últimos 3 anos?**
Resposta: **Não**. CONFIRA.

**10. Reclamação ou notificação de autoridade ou cliente sobre dados pessoais nos últimos 3 anos?**
Resposta: **Não**. CONFIRA.

**11. Em que países os dados serão armazenados ou processados?**
> United States (database hosted on Supabase, AWS us-east-2 region) and Brazil (company operations).
> Application requests are processed on Cloudflare's global network.

**12. Política interna de proteção de dados atualizada regularmente?**
Resposta: **Não** (vira Sim na saída B)
> We do not have a separate internal data protection policy yet. Our public privacy policy, aligned with the
> Brazilian LGPD, is reviewed whenever we add a data processor or feature (last update: October 20, 2026).

**13. Vai ajudar vendedores ou o TikTok Shop a excluir, atualizar ou fornecer dados quando o usuário pedir?**
Resposta: **Sim**
> Yes. Sellers can delete their account and all associated data themselves inside the product, and can
> disconnect their TikTok Shop at any time (tokens are deleted on disconnection). Any data request from a
> seller or from TikTok Shop is handled through privacidade@usepolia.com.br.

**14. Política de privacidade atualizada regularmente?**
Resposta: **Sim**
> Yes: https://usepolia.com.br/privacidade (last updated October 20, 2026).

**15. Tem encarregado de dados (DPO)? E-mail.**
Resposta: **Sim**, `privacidade@usepolia.com.br`

**16. Processo para avisar o TikTok ou os vendedores sobre violação suspeita ou confirmada?**
Resposta: **Sim**. Isto é um compromisso: o prazo de 48 horas passa a valer para a Pólia.
> Yes. Production alerts reach the founder in real time. Once a breach involving TikTok Shop data is suspected
> or confirmed, we notify the affected sellers and TikTok Shop by email within 48 hours, and the ANPD as
> required by the LGPD.

**17. No fim da relação contratual, vai excluir os dados coletados?**
Resposta: **Sim**. Compromisso: 30 dias.
> Yes. When a seller disconnects the TikTok Shop or closes the account, access tokens are deleted immediately
> and the remaining TikTok Shop data is deleted within 30 days, except records we are legally required to keep
> (Brazilian tax rules).

**18. Certificação ISO 27001, ISO 27701, SOC 2 Tipo 2 ou outra?**
Resposta: **Não**
Comentário opcional:
> We do not hold certifications ourselves. Our infrastructure providers do: Supabase (SOC 2 Type 2),
> Cloudflare (ISO 27001, SOC 2 Type II) and Stripe (PCI DSS Level 1).

**Comentário final para o avaliador (opcional):**
> Pólia One is an early-stage Brazilian SaaS (launched October 2026) run by its founder. Some policies are
> practiced but not yet published as standalone documents; we are formalizing them and can share them on request.

---

## Compromissos que estas respostas criam (entram no código da Fase 3a)

- Tokens do TikTok no Supabase Vault, apagados na hora em que a loja é desconectada.
- Dados do TikTok apagados em até 30 dias depois de desconectar ou fechar a conta.
- Do pedido do marketplace, sem endereço completo da compradora.
- Aviso de vazamento a vendedoras e ao TikTok em até 48 horas.
