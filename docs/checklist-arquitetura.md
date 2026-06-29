# Checklist de arquitetura

> Passe a feature por aqui. O agente `revisor-de-arquitetura` automatiza boa parte lendo o código; este é a sua confirmação.

## Princípios
- [ ] Cada classe tem uma responsabilidade (sem classe-deus).
- [ ] Extensão sem modificar código existente (sem if/switch por tipo onde caberia polimorfismo).
- [ ] Subtipos substituem o tipo base sem quebrar (Liskov).
- [ ] Interfaces pequenas; ninguém implementa método que não usa.
- [ ] Dependência de abstração + injeção (não instancia banco/serviço concreto na regra).
- [ ] Sem duplicação (DRY). Sem over-engineering (KISS/YAGNI).

## Estrutura
- [ ] Domínio não importa banco, framework, HTTP nem libs externas.
- [ ] Dependência aponta para dentro; banco/framework atrás de interface.
- [ ] Baixo acoplamento, alta coesão. Repositório por agregado.

## Padrão e tamanho
- [ ] O padrão arquitetural cabe no tamanho do projeto (monolito para MVP; nada de microsserviço sem necessidade).
- [ ] Design patterns usados só onde o problema existe.

## Código e testes
- [ ] Nomes claros, funções curtas, erros tratados (sem exceção silenciosa).
- [ ] Domínio coberto por testes unitários. Pirâmide respeitada (poucos E2E).

## Decisões
- [ ] Decisões de arquitetura relevantes registradas em ADR (contexto, alternativas, consequências).

## Final
- [ ] Rodei o agente revisor-de-arquitetura e tratei os achados.
