# Regras: agente de IA (bloco condicional)

> **Condicional.** Cole no `CLAUDE.md` do projeto **só quando o produto tiver uma feature de agente de IA** (um assistente que decide e age, não um simples chat). Para um SaaS sem agente, isto não se aplica e não deve poluir o CLAUDE.md. Quando aplicar, estas são as travas mínimas.

```markdown
## Agente de IA (só se o produto tiver um)
- PAOL no system prompt: Papel, Ações permitidas, Objetivo (com métrica de sucesso) e LIMITES (quando parar e escalar pra humano). Limite explícito é obrigatório.
- Guardrail em 3 camadas, nunca só uma:
  1. Prompt: instrua os limites (não decidir em caso ambíguo; pedir validação humana).
  2. Workflow: trava determinística SEM IA (IF que desvia caso sensível ou valor alto pra aprovação manual; filtro de termo proibido).
  3. Ferramentas: acesso só-leitura (read-only) em planilha/banco; menor privilégio. Ação destrutiva exige passo humano.
- NUNCA confie só no prompt: valide a SAÍDA com uma checagem determinística antes de entregar ao usuário (pega alucinação).
- Ferramenta só-leitura por padrão. Escrita/deleção só com aprovação humana no caminho.
- Isole por sessão: chave de sessão (session ID) única por usuário na memória, pra não vazar contexto entre usuários.
- Injete a data atual no prompt quando a tarefa depender de "hoje" (o modelo tem corte de treinamento).
- Temperatura baixa (perto de 0) pra tarefa de dado; alta só pra geração criativa.
- Limite o teto de tokens de saída pra controlar custo (a saída é o que mais custa).
- Defesa contra prompt injection: nunca exponha o system prompt; trate entrada do usuário como não confiável; não deixe a entrada sobrescrever as instruções.
- Segredo (API key, token) só em credencial/variável de ambiente, nunca no prompt nem no código do fluxo.
```
