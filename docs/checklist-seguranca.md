# Checklist de segurança (gate antes de subir)

> Passe a feature por aqui antes de colocar em produção. Reprovou num item de impacto, não sobe. O agente `revisor-de-seguranca` automatiza boa parte disto lendo o código; este checklist é a sua confirmação final.

## Segredos e dados
- [ ] Nenhum segredo hardcoded (chave, token, senha, connection string). Tudo em env/cofre.
- [ ] Dado sensível criptografado em repouso e em trânsito (TLS).
- [ ] Logs não vazam dado sensível nem segredo.
- [ ] Coleta de dado pessoal minimizada e com consentimento (LGPD). Dev/qa com dado mascarado.

## Entrada
- [ ] Toda entrada validada (allowlist) e sanitizada.
- [ ] Banco só com query parametrizada (sem concatenar SQL).
- [ ] Output com escape (sem XSS).

## Autenticação e autorização
- [ ] Autorização por objeto checada em toda requisição (sem BOLA).
- [ ] Papel checado em funções sensíveis (sem function-level broken). Nega por padrão.
- [ ] IDs expostos são imprevisíveis (UUID), não sequenciais.
- [ ] Tokens validados e assinados. Operações sensíveis pedem reautenticação. MFA onde dá.
- [ ] API key só em integração B2B, não para usuário final.

## Exposição e configuração
- [ ] Resposta retorna só campos autorizados (sem serialização genérica).
- [ ] Sem mass assignment (input não faz bind automático em objeto interno).
- [ ] Erro não expõe stack trace. CORS restrito.
- [ ] Rate limiting em auth e em operações caras.

## Dependências
- [ ] SCA rodado: nenhuma biblioteca com vulnerabilidade conhecida (ou já corrigida).
- [ ] Dependências e plataforma atualizadas.

## Mobile (só se for app nativo)
- [ ] Chaves em KeyStore seguro, não em texto plano.
- [ ] TLS com certificate pinning.
- [ ] FLAG_SECURE nas telas sensíveis.
- [ ] Entrada de IPC/WebView validada. Mecanismo de forçar atualização.

## Final
- [ ] Rodei o agente revisor-de-seguranca e tratei os achados de impacto.
