import { describe, it, expect } from "vitest";
import {
  LIMITE_LINHA,
  LIMITE_MENSAGEM,
  LIMITE_STACK_CARACTERES,
  LIMITE_STACK_LINHAS,
  mascararDadoPessoal,
  sanitizarMensagemErro,
  sanitizarPagina,
  sanitizarStack,
} from "./error-sanitize";

describe("mascararDadoPessoal", () => {
  it("mascara e-mail no meio do texto", () => {
    const saida = mascararDadoPessoal("Usuária ana.silva+teste@gmail.com não encontrada");
    expect(saida).toBe("Usuária [email] não encontrada");
  });

  it("não confunde versão de pacote com e-mail", () => {
    const linha = "at load (file:///app/node_modules/.vite/deps/react-router@6.2.1/index.js:10:3)";
    expect(mascararDadoPessoal(linha)).toContain("react-router@6.2.1");
  });

  it("não mascara caminho de pacote com escopo", () => {
    expect(mascararDadoPessoal("import de @tanstack/react-router falhou")).toContain(
      "@tanstack/react-router",
    );
  });

  it("mascara JWT", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(mascararDadoPessoal(`token ${jwt} inválido`)).toBe("token [jwt] inválido");
  });

  it("mascara header Bearer", () => {
    expect(mascararDadoPessoal("Authorization: Bearer abc123def456ghi")).toBe(
      "Authorization: Bearer [token]",
    );
  });

  it("mascara chave de serviço", () => {
    expect(mascararDadoPessoal("stripe sk_live_51HxyzABCdefGHI falhou")).toBe(
      "stripe [chave] falhou",
    );
  });

  it("esconde o valor de query string sensível e mantém o nome do parâmetro", () => {
    const saida = mascararDadoPessoal("GET /ativar?token=abc123&plano=controle 401");
    expect(saida).toBe("GET /ativar?token=[oculto]&plano=controle 401");
  });

  it("mascara CPF formatado e cru", () => {
    expect(mascararDadoPessoal("cpf 123.456.789-01")).toBe("cpf [cpf]");
    expect(mascararDadoPessoal("cpf 12345678901 inválido")).toBe("cpf [cpf] inválido");
  });

  it("mascara CNPJ formatado", () => {
    expect(mascararDadoPessoal("cnpj 12.345.678/0001-99")).toBe("cnpj [cnpj]");
  });

  it("mascara telefone com DDD", () => {
    expect(mascararDadoPessoal("whats (11) 98888-7777 falhou")).toBe("whats [telefone] falhou");
    expect(mascararDadoPessoal("whats +55 11 98888-7777 falhou")).toBe("whats [telefone] falhou");
  });

  it("não mascara posição de linha:coluna do stack", () => {
    const linha = "at handler (/app/dist/server.js:1420:37)";
    expect(mascararDadoPessoal(linha)).toBe(linha);
  });
});

describe("sanitizarMensagemErro", () => {
  it("corta a mensagem no limite", () => {
    const longa = "x".repeat(LIMITE_MENSAGEM + 500);
    expect(sanitizarMensagemErro(longa)).toHaveLength(LIMITE_MENSAGEM);
  });

  it("sanitiza antes de cortar", () => {
    expect(sanitizarMensagemErro("falhou para ana@usepolia.com.br")).toBe("falhou para [email]");
  });
});

describe("sanitizarStack", () => {
  it("devolve null quando não há stack", () => {
    expect(sanitizarStack(undefined)).toBeNull();
    expect(sanitizarStack(null)).toBeNull();
    expect(sanitizarStack("")).toBeNull();
  });

  it("preserva o topo e marca o corte quando passa do limite de linhas", () => {
    const stack = Array.from({ length: 60 }, (_, i) => `at frame${i} (/app/x.js:${i}:1)`).join(
      "\n",
    );
    const saida = sanitizarStack(stack)!;
    expect(saida).toContain("at frame0 ");
    expect(saida).toContain(`at frame${LIMITE_STACK_LINHAS - 1} `);
    expect(saida).not.toContain(`at frame${LIMITE_STACK_LINHAS} `);
    expect(saida.endsWith("[stack truncado]")).toBe(true);
  });

  it("não marca corte quando o stack é curto", () => {
    const stack = "Error: falhou\n    at f (/app/x.js:1:1)";
    expect(sanitizarStack(stack)).toBe(stack);
  });

  it("corta linha gigante de bundle minificado", () => {
    const stack = `Error: falhou\n${"a".repeat(5000)}`;
    const saida = sanitizarStack(stack)!;
    const linhaLonga = saida.split("\n")[1];
    expect(linhaLonga).toHaveLength(LIMITE_LINHA);
    expect(saida.endsWith("[stack truncado]")).toBe(true);
  });

  it("respeita o teto de caracteres mesmo com poucas linhas", () => {
    const stack = Array.from({ length: LIMITE_STACK_LINHAS }, () => "b".repeat(LIMITE_LINHA)).join(
      "\n",
    );
    const saida = sanitizarStack(stack)!;
    expect(saida.length).toBeLessThanOrEqual(LIMITE_STACK_CARACTERES + "\n[stack truncado]".length);
  });

  it("mascara dado pessoal dentro do stack", () => {
    const stack = "Error: cliente ana@usepolia.com.br sem plano\n    at f (/app/x.js:1:1)";
    expect(sanitizarStack(stack)).toContain("[email]");
    expect(sanitizarStack(stack)).not.toContain("ana@usepolia.com.br");
  });
});

describe("sanitizarPagina", () => {
  it("descarta query string e fragmento", () => {
    expect(sanitizarPagina("/ativar?token=abc123#topo")).toBe("/ativar");
  });

  it("mantém o caminho limpo", () => {
    expect(sanitizarPagina("/painel/financeiro")).toBe("/painel/financeiro");
  });

  it("devolve null quando não há página", () => {
    expect(sanitizarPagina(undefined)).toBeNull();
    expect(sanitizarPagina("")).toBeNull();
  });
});
