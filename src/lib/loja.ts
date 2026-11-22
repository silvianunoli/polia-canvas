// Loja do catálogo próprio no Pro (ONE-148, fases 2 e 3, 29/10/2026). Puro:
// não conhece Supabase nem React. A dona configura em /catalogo e a cliente
// compra em /loja/<endereço>. O pedido entra em Pedidos pela
// registrar_pedido_loja (migration 20261029230000), com o preço do cadastro.
import { z } from "zod";
import { normalizarWhatsapp, slugValido } from "@/lib/leads";

export { slugValido };

export const MAX_FOTOS_PRODUTO = 4;
export const FOTO_TIPOS = ["image/png", "image/jpeg", "image/webp"] as const;
export const FOTO_MAX_BYTES = 3 * 1024 * 1024;
export const MAX_BANNERS = 5;

/** O que a dona configura na tela Vitrine online (vazio vira null no banco). */
export const configLojaSchema = z.object({
  slug: z.string().trim().toLowerCase().refine(slugValido, "Use de 3 a 40 letras, números ou hífen."),
  ativo: z.boolean(),
  chamada: z.string().trim().max(120).optional(),
  subchamada: z.string().trim().max(300).optional(),
  corDestaque: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .or(z.literal("")),
  whatsapp: z.string().max(30).optional(),
  instagram: z
    .string()
    .trim()
    .transform((s) => s.replace(/^@/, ""))
    .refine((s) => s === "" || /^[A-Za-z0-9._]{1,30}$/.test(s), "Confira o @ do Instagram.")
    .optional(),
  prazoDiasUteis: z.number().int().min(1).max(60),
  sinalPercentual: z.number().int().min(0).max(100),
  entregaTexto: z.string().trim().max(200).optional(),
  pedeEndereco: z.boolean(),
  aviso: z.string().trim().max(300).optional(),
  /** Paleta de cores (ONE-217): mostra a faixa e a seção "Cores" na loja. */
  mostrarCores: z.boolean().optional(),
  avisoCor: z.string().trim().max(300).optional(),
});
export type ConfigLoja = z.infer<typeof configLojaSchema>;

/** Linha do banco a partir do que a tela mandou. WhatsApp inválido volta null (a tela avisa antes). */
export function linhaDaConfig(c: ConfigLoja) {
  const vazio = (s: string | undefined) => (s && s.trim() ? s.trim() : null);
  return {
    slug: c.slug,
    ativo: c.ativo,
    chamada: vazio(c.chamada),
    subchamada: vazio(c.subchamada),
    cor_destaque: vazio(c.corDestaque),
    whatsapp: c.whatsapp ? normalizarWhatsapp(c.whatsapp) : null,
    instagram: vazio(c.instagram),
    prazo_dias_uteis: c.prazoDiasUteis,
    sinal_percentual: c.sinalPercentual,
    entrega_texto: vazio(c.entregaTexto),
    pede_endereco: c.pedeEndereco,
    aviso: vazio(c.aviso),
    mostrar_cores: c.mostrarCores ?? true,
    aviso_cor: vazio(c.avisoCor),
  };
}

export interface VariacaoLoja {
  id: string;
  nome: string;
  /** Só nas opções da paleta: a cor da amostra. "foto" não tem. */
  hex?: string | null;
  /** Pronta entrega com estoque ligado e saldo zerado nesta opção. */
  esgotada?: boolean;
}

/** Cor da paleta da loja (catalogo_cores). */
export interface CorLoja {
  id: string;
  codigo: string | null;
  nome: string;
  hex: string;
}

/** Id da opção "Cor da foto" no produto com paleta. */
export const OPCAO_COR_DA_FOTO = "foto";

/** "Cor 812 Hibisco" / "Cor Hibisco": o mesmo texto que o banco grava no pedido. */
export const rotuloDaCor = (c: Pick<CorLoja, "codigo" | "nome">) =>
  `Cor ${c.codigo ? `${c.codigo} ` : ""}${c.nome}`;

/**
 * Banner da Vitrine online (22/11/2026, Sil: "precisa colocar uma especificação de
 * qual tamanho deve ser o banner, em jpg e png pra nao ficar cortado, se ela colocar
 * maior ou menor que a especificação, mostrar um erro e não permitir subir").
 * A vitrine mostra o banner sempre em 8:3, então 1600 x 600 aparece inteiro.
 */
export const BANNER_LARGURA = 1600;
export const BANNER_ALTURA = 600;
export const BANNER_TIPOS = ["image/jpeg", "image/png"] as const;

/** Por que o banner não pode subir, ou null se pode. */
export function problemaDoBanner(tipo: string, largura: number, altura: number): string | null {
  if (!(BANNER_TIPOS as readonly string[]).includes(tipo)) return "O banner precisa ser JPG ou PNG.";
  if (largura !== BANNER_LARGURA || altura !== BANNER_ALTURA)
    return `Essa imagem tem ${largura} x ${altura} px. O banner precisa ter exatamente ${BANNER_LARGURA} x ${BANNER_ALTURA} px pra aparecer inteiro, sem corte.`;
  return null;
}

/** Favicon da loja (ícone da aba): PNG quadrado, de 48 a 512 px. Sem ele, vale o da Pólia. */
export const FAVICON_MIN = 48;
export const FAVICON_MAX = 512;
export function problemaDoFavicon(tipo: string, largura: number, altura: number): string | null {
  if (tipo !== "image/png") return "O favicon precisa ser PNG.";
  if (largura !== altura) return `Essa imagem tem ${largura} x ${altura} px. O favicon precisa ser quadrado.`;
  if (largura < FAVICON_MIN || largura > FAVICON_MAX)
    return `Essa imagem tem ${largura} x ${altura} px. O favicon precisa ter entre ${FAVICON_MIN} e ${FAVICON_MAX} px de lado (o ideal é 512 x 512).`;
  return null;
}

/** Quantas cores a cliente pode misturar num produto com paleta (produtos.max_cores). */
export const MAX_CORES_PRODUTO = 3;
/** Cores juntas no mesmo item do carrinho e do pedido: "<id>+<id>" (o banco confere). */
export const SEPARADOR_CORES = "+";

/** Prende o máximo de cores entre 1 e 3 (dado estranho vira 1, uma cor só). */
export function maxCoresValido(n: unknown): number {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && v >= 1 ? Math.min(MAX_CORES_PRODUTO, v) : 1;
}

/**
 * Escolha de mais de uma cor vira uma opção só, com id "<id>+<id>" e o mesmo
 * texto que o banco grava: "Cores 812 Hibisco + 806 Off White". Uma cor só
 * devolve a própria opção. null quando a escolha não vale pro produto.
 */
export function opcaoDasCores(
  produto: Pick<ProdutoLoja, "usaPaleta" | "maxCores" | "variacoes">,
  ids: string[],
): VariacaoLoja | null {
  if (!produto.usaPaleta || ids.length < 1 || ids.length > produto.maxCores) return null;
  if (new Set(ids).size !== ids.length) return null;
  if (ids.length === 1) return produto.variacoes.find((v) => v.id === ids[0]) ?? null;
  const cores: VariacaoLoja[] = [];
  for (const id of ids) {
    const v = produto.variacoes.find((x) => x.id === id);
    if (!v || v.id === OPCAO_COR_DA_FOTO) return null;
    cores.push(v);
  }
  return {
    id: ids.join(SEPARADOR_CORES),
    nome: `Cores ${cores.map((c) => c.nome.replace(/^Cor /, "")).join(" + ")}`,
    hex: null,
  };
}

/** A opção guardada (uma cor, várias cores juntas ou variação comum) de volta. */
export function opcaoDoItem(
  produto: Pick<ProdutoLoja, "usaPaleta" | "maxCores" | "variacoes">,
  skuId: string | null,
): VariacaoLoja | null {
  if (!skuId) return null;
  if (produto.usaPaleta && skuId.includes(SEPARADOR_CORES)) return opcaoDasCores(produto, skuId.split(SEPARADOR_CORES));
  return produto.variacoes.find((v) => v.id === skuId) ?? null;
}

/**
 * Opções de um produto com paleta: "Cor da foto" primeiro, depois a paleta.
 * Sem paleta cadastrada, nenhuma opção (o pedido entra como cor da foto).
 */
export function opcoesDaPaleta(cores: CorLoja[], corDaFoto: string | null): VariacaoLoja[] {
  if (!cores.length) return [];
  return [
    { id: OPCAO_COR_DA_FOTO, nome: `Cor da foto${corDaFoto ? ` (${corDaFoto})` : ""}`, hex: null },
    ...cores.map((c) => ({ id: c.id, nome: rotuloDaCor(c), hex: c.hex })),
  ];
}

/** Uma cor por linha: "801 Azul Bondi #6DA9D2", "Azul Bondi #6da9d2" ou "#6DA9D2 Azul". */
export function lerCoresColadas(texto: string): { cores: Array<Omit<CorLoja, "id">>; ignoradas: number } {
  const cores: Array<Omit<CorLoja, "id">> = [];
  let ignoradas = 0;
  for (const bruta of texto.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha) continue;
    const m = linha.match(/#[0-9A-Fa-f]{6}\b/);
    const resto = m ? linha.replace(m[0], " ").replace(/\s+/g, " ").trim() : "";
    if (!m || !resto) {
      ignoradas++;
      continue;
    }
    const cod = resto.match(/^(\d{1,12})\s+(.+)$/);
    const nome = (cod ? cod[2] : resto).slice(0, 40);
    cores.push({ codigo: cod ? cod[1] : null, nome, hex: m[0].toUpperCase() });
  }
  return { cores, ignoradas };
}

export interface ProdutoLoja {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  fotos: string[];
  variacoes: VariacaoLoja[];
  /** Categoria do produto (produto_categorias); null = sem categoria. */
  categoriaId: string | null;
  /** A cliente escolhe a cor da paleta da loja: `variacoes` são as cores. */
  usaPaleta: boolean;
  /** Com paleta: quantas cores a cliente pode misturar (1 a 3). */
  maxCores: number;
  /** Pronta entrega (sai sem prazo de produção); false = sob encomenda. */
  prontaEntrega: boolean;
  /** Pronta entrega com estoque ligado e nada pra vender. */
  esgotado: boolean;
}

export interface CategoriaLoja {
  id: string;
  nome: string;
}

/** Só o que a loja pública mostra: sem user_id, custo, estoque ou dado de cliente. */
export interface LojaPublica {
  slug: string;
  nome: string;
  logoUrl: string | null;
  capaUrl: string | null;
  /** Ícone da aba da loja; null = o da Pólia. */
  faviconUrl: string | null;
  /** Banner rotativo do topo da vitrine (até 5, na ordem da dona). */
  banners: string[];
  cor: string | null;
  chamada: string | null;
  subchamada: string | null;
  whatsapp: string | null;
  instagram: string | null;
  prazoDiasUteis: number;
  sinalPercentual: number;
  entregaTexto: string | null;
  pedeEndereco: boolean;
  aviso: string | null;
  produtos: ProdutoLoja[];
  /** Só as categorias que têm produto na vitrine, na ordem da dona. */
  categorias: CategoriaLoja[];
  /** Paleta da loja (vazia quando ela não montou). */
  cores: CorLoja[];
  /** Faixa e seção "Cores" na página inicial. */
  mostrarCores: boolean;
  avisoCor: string | null;
}

/**
 * O filtro por categoria só aparece quando separa alguma coisa: duas ou mais
 * categorias, ou uma categoria e produtos sem categoria.
 */
export function temFiltroDeCategoria(loja: Pick<LojaPublica, "categorias" | "produtos">): boolean {
  if (loja.categorias.length >= 2) return true;
  return loja.categorias.length === 1 && loja.produtos.some((p) => !p.categoriaId);
}

/** Produtos de uma categoria; null = todos. */
export function produtosDaCategoria<T extends Pick<ProdutoLoja, "categoriaId">>(produtos: T[], categoriaId: string | null): T[] {
  return categoriaId ? produtos.filter((p) => p.categoriaId === categoriaId) : produtos;
}

/** Pedido que a loja manda: produto, variação e quantidade. Preço e nome saem do banco. */
export const pedidoLojaSchema = z.object({
  slug: z.string().min(3).max(40),
  id: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  itens: z
    .array(
      z.object({
        produtoId: z.string().uuid(),
        // Produto com paleta: id da cor, até 3 cores juntas ("<id>+<id>") ou
        // "foto". A função do banco confere cada cor e o máximo do produto.
        skuId: z
          .union([
            z.string().uuid(),
            z.literal("foto"),
            z.string().regex(/^[0-9a-f-]{36}(\+[0-9a-f-]{36}){1,2}$/i),
          ])
          .nullable()
          .optional(),
        quantidade: z.number().int().min(1).max(1000),
      }),
    )
    .min(1)
    .max(50),
  cliente: z.object({ nome: z.string().trim().min(1).max(120), whatsapp: z.string().max(30) }),
  endereco: z.string().trim().max(300).optional(),
  presentePara: z.string().trim().max(120).optional(),
  observacao: z.string().trim().max(400).optional(),
  turnstileToken: z.string().optional(),
  /** Campo-isca: gente não vê, robô preenche. */
  hp: z.string().optional(),
});
export type PedidoLoja = z.infer<typeof pedidoLojaSchema>;

/** Observação do cartão do pedido (até 500, o teto de vendas.observacao). */
export function observacaoDoPedidoLoja(p: Pick<PedidoLoja, "endereco" | "presentePara" | "observacao">): string {
  const partes = ["Pedido pela loja da Pólia One."];
  if (p.endereco) partes.push(`Endereço: ${p.endereco}.`);
  if (p.presentePara) partes.push(`Presente para ${p.presentePara}.`);
  if (p.observacao) partes.push(`Observação da cliente: ${p.observacao}`);
  const junto = partes.join(" ");
  return junto.length > 500 ? `${junto.slice(0, 499)}…` : junto;
}

export type ResultadoPedidoLoja =
  | { ok: true; repetido: boolean }
  | { ok: false; motivo: "turnstile" | "whatsapp" | "indisponivel" | "limite" | "invalido" | "erro" };

/** "R$ 189" / "R$ 144,50": o jeito que a loja escreve preço. */
export function reais(v: number): string {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** Mensagem do WhatsApp que a cliente manda depois de confirmar (o pedido já está salvo). */
export function mensagemDoPedido(
  loja: Pick<LojaPublica, "nome" | "sinalPercentual">,
  itens: Array<{ nome: string; variacao: string | null; quantidade: number; preco: number }>,
  dados: { nome: string; whatsapp: string; endereco?: string; presentePara?: string; observacao?: string },
): string {
  const sub = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const linhas = [`*Pedido pela loja da ${loja.nome}*`, "", `Nome: ${dados.nome}`, `WhatsApp: ${dados.whatsapp}`];
  if (dados.endereco) linhas.push(`Endereço: ${dados.endereco}`);
  if (dados.presentePara) linhas.push(`Presente para: ${dados.presentePara}`);
  linhas.push("", "*Itens*");
  for (const i of itens) linhas.push(`- ${i.nome}${i.variacao ? `, ${i.variacao}` : ""} x${i.quantidade}: ${reais(i.preco * i.quantidade)}`);
  linhas.push("", `*Total: ${reais(sub)}*`);
  if (loja.sinalPercentual) linhas.push(`Sinal de ${loja.sinalPercentual}% pra começar: ${reais((sub * loja.sinalPercentual) / 100)}`);
  if (dados.observacao) linhas.push("", `Observações: ${dados.observacao}`);
  return linhas.join("\n");
}
