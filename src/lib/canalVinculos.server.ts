import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { temProjete } from "@/lib/planos";
import {
  sugerirVinculos,
  type AnuncioLinha,
  type SkuPolia,
} from "../../supabase/functions/_shared/canais.ts";

// "Ligar anúncios" de qualquer canal (TikTok Shop na 3a.2, Mercado Livre na
// 3c.2). Cada canal busca os próprios anúncios; daqui pra frente a regra é a
// mesma: a Pólia sugere o par, ela aprova na tela e nada é ligado sem salvar.
// Criar produto e ligar estoque passam pelo cliente com a sessão dela
// (context.supabase), pelas mesmas RPCs da tela de Produtos.

export type CanalAnuncios = "tiktok_shop" | "mercado_livre";

export async function temPro(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("plano")
    .eq("id", userId)
    .maybeSingle();
  return temProjete(data?.plano as string | null | undefined);
}

export type OpcaoSku = { skuId: string; produtoId: string; rotulo: string };
export type LinhaPrevia = AnuncioLinha & {
  skuIdAtual: string | null;
  sugestao: { skuId: string; motivo: "codigo" | "nome" } | null;
};
export type Previa = {
  linhas: LinhaPrevia[];
  skus: OpcaoSku[];
  produtosSemEstoque: { produtoId: string; nome: string }[];
};

type SkuRow = {
  id: string;
  produto_id: string;
  variacao: string | null;
  sku: string | null;
  produtos: { nome: string; arquivado: boolean } | null;
};

/** Junta os anúncios do canal com as variações da Pólia, as ligações atuais e as sugestões. */
export async function montarPrevia(
  userId: string,
  canal: CanalAnuncios,
  anuncios: AnuncioLinha[],
): Promise<Previa> {
  // Variações da Pólia (só de produto ativo) e produtos ainda sem estoque ligado.
  const [skusRes, produtosRes, vinculosRes] = await Promise.all([
    supabaseAdmin
      .from("produto_skus")
      .select("id, produto_id, variacao, sku, produtos!inner(nome, arquivado)")
      .eq("user_id", userId)
      .eq("arquivado", false),
    supabaseAdmin
      .from("produtos")
      .select("id, nome, tipo")
      .eq("user_id", userId)
      .eq("arquivado", false),
    supabaseAdmin
      .from("anuncio_vinculos" as never)
      .select("sku_externo_id, sku_id")
      .eq("user_id", userId)
      .eq("canal", canal),
  ]);
  const skuRows = ((skusRes.data as unknown as SkuRow[]) ?? []).filter(
    (s) => s.produtos && !s.produtos.arquivado,
  );
  const skus: OpcaoSku[] = skuRows
    .map((s) => ({
      skuId: s.id,
      produtoId: s.produto_id,
      rotulo: s.variacao ? `${s.produtos!.nome} / ${s.variacao}` : s.produtos!.nome,
    }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const comSku = new Set(skuRows.map((s) => s.produto_id));
  const produtosSemEstoque = (
    (produtosRes.data as { id: string; nome: string; tipo: string }[] | null) ?? []
  )
    .filter((p) => p.tipo === "fisico" && !comSku.has(p.id))
    .map((p) => ({ produtoId: p.id, nome: p.nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const atuais = new Map(
    ((vinculosRes.data as unknown as { sku_externo_id: string; sku_id: string }[]) ?? []).map(
      (v) => [v.sku_externo_id, v.sku_id],
    ),
  );
  const sugestoes = sugerirVinculos(
    anuncios.filter((a) => !atuais.has(a.skuExternoId)),
    skuRows
      .filter((s) => ![...atuais.values()].includes(s.id))
      .map(
        (s): SkuPolia => ({
          skuId: s.id,
          codigo: s.sku,
          produtoNome: s.produtos!.nome,
          variacao: s.variacao,
        }),
      ),
  );
  const porSku = new Map(sugestoes.map((s) => [s.skuExternoId, s]));

  const linhas: LinhaPrevia[] = anuncios.map((a) => {
    const s = porSku.get(a.skuExternoId);
    return {
      ...a,
      skuIdAtual: atuais.get(a.skuExternoId) ?? null,
      sugestao: s?.skuId && s.motivo ? { skuId: s.skuId, motivo: s.motivo } : null,
    };
  });
  return { linhas, skus, produtosSemEstoque };
}

const texto = (max: number) => z.string().trim().min(1).max(max);
const itemInput = z.object({
  produtoExternoId: texto(100),
  skuExternoId: texto(100),
  /** "sku:<uuid>", "produto:<uuid>", "novo" ou "nenhum". */
  destino: z.union([
    z.string().regex(/^(sku|produto):[0-9a-f-]{36}$/),
    z.literal("novo"),
    z.literal("nenhum"),
  ]),
  // Só usados em "novo": o que o canal mostrou para essa linha.
  titulo: z.string().trim().max(200).optional(),
  variacao: z.string().trim().max(80).nullable().optional(),
  codigo: z.string().trim().max(60).nullable().optional(),
  preco: z.number().min(0).max(1_000_000).nullable().optional(),
  quantidade: z.number().int().min(0).max(1_000_000).optional(),
});
export const salvarVinculosInput = z.object({ itens: z.array(itemInput).min(1).max(1000) });
type Item = z.infer<typeof itemInput>;

export type ResultadoSalvar = {
  ok: boolean;
  error: string | null;
  ligados: number;
  criados: number;
  avisos: string[];
};

export async function salvarVinculos(p: {
  userId: string;
  /** Cliente com a sessão dela: cria produto e liga estoque pelas regras da tela de Produtos. */
  supabase: SupabaseClient;
  canal: CanalAnuncios;
  /** "TikTok Shop", "Mercado Livre": entra nas mensagens e no nome de produto sem título. */
  nomeCanal: string;
  itens: Item[];
}): Promise<ResultadoSalvar> {
  const falha = (error: string, criados = 0, avisos: string[] = []): ResultadoSalvar => ({
    ok: false,
    error,
    ligados: 0,
    criados,
    avisos,
  });
  if (!(await temPro(p.userId))) return falha(`A integração com o ${p.nomeCanal} é do plano Pro.`);
  const { data: conexao } = await supabaseAdmin
    .from("canal_conexoes" as never)
    .select("status")
    .eq("user_id", p.userId)
    .eq("canal", p.canal)
    .maybeSingle();
  if ((conexao as unknown as { status: string } | null)?.status !== "conectada")
    return falha(`O ${p.nomeCanal} não está conectado.`);

  const avisos: string[] = [];
  const destinoFinal = new Map<string, string>(); // skuExternoId → sku_id da Pólia

  // 1. Variações escolhidas: só as da própria conta.
  const idsSku = [
    ...new Set(p.itens.filter((i) => i.destino.startsWith("sku:")).map((i) => i.destino.slice(4))),
  ];
  if (idsSku.length) {
    const { data: donas } = await supabaseAdmin
      .from("produto_skus")
      .select("id")
      .eq("user_id", p.userId)
      .eq("arquivado", false)
      .in("id", idsSku);
    const validos = new Set(((donas as { id: string }[]) ?? []).map((s) => s.id));
    for (const i of p.itens)
      if (i.destino.startsWith("sku:") && validos.has(i.destino.slice(4)))
        destinoFinal.set(i.skuExternoId, i.destino.slice(4));
  }

  // 2. Produto sem estoque ligado: liga com uma variação padrão (mesma RPC da tela de Produtos).
  const idsProduto = [
    ...new Set(
      p.itens.filter((i) => i.destino.startsWith("produto:")).map((i) => i.destino.slice(8)),
    ),
  ];
  for (const produtoId of idsProduto) {
    // Só produto sem variação ativa: com variações, salvar_estoque_produto([padrão])
    // arquivaria todas. Tela desatualizada cai aqui e ela escolhe a variação.
    const { count: ativas } = await supabaseAdmin
      .from("produto_skus")
      .select("id", { count: "exact", head: true })
      .eq("user_id", p.userId)
      .eq("produto_id", produtoId)
      .eq("arquivado", false);
    if (ativas) {
      avisos.push(
        "Um produto escolhido já tem estoque por variação. Escolhe a variação na lista e salva de novo.",
      );
      continue;
    }
    const { error } = await p.supabase.rpc("salvar_estoque_produto", {
      p_produto_id: produtoId,
      p_controla: true,
      p_variacoes: [{ variacao: null, sku: null }],
    } as never);
    const { data: sku } = await supabaseAdmin
      .from("produto_skus")
      .select("id")
      .eq("user_id", p.userId)
      .eq("produto_id", produtoId)
      .eq("arquivado", false)
      .limit(1)
      .maybeSingle();
    if (error || !sku) {
      avisos.push("Um produto escolhido não pôde ligar o estoque. Confere em Produtos > Estoque.");
      continue;
    }
    for (const i of p.itens)
      if (i.destino === `produto:${produtoId}`)
        destinoFinal.set(i.skuExternoId, (sku as { id: string }).id);
  }

  // 3. Produto novo: um por anúncio do canal, com uma variação por SKU.
  const novos = new Map<string, Item[]>();
  for (const i of p.itens)
    if (i.destino === "novo")
      novos.set(i.produtoExternoId, [...(novos.get(i.produtoExternoId) ?? []), i]);
  let criados = 0;
  for (const itens of novos.values()) {
    const nome = itens[0].titulo || `Produto do ${p.nomeCanal}`;
    const { data: produto, error: erroProduto } = await p.supabase
      .from("produtos")
      .insert({
        user_id: p.userId,
        nome,
        tipo: "fisico",
        preco_venda: itens[0].preco ?? 0,
      } as never)
      .select("id")
      .single();
    if (erroProduto || !produto) {
      avisos.push(`"${nome}" não foi criado na Pólia.`);
      continue;
    }
    const produtoId = (produto as { id: string }).id;
    const variacoes = itens.map((i) => ({
      variacao: itens.length > 1 ? i.variacao || i.codigo || i.skuExternoId : null,
      sku: i.codigo || null,
      inicial: i.quantidade ?? 0,
    }));
    const { error: erroEstoque } = await p.supabase.rpc("salvar_estoque_produto", {
      p_produto_id: produtoId,
      p_controla: true,
      p_variacoes: variacoes,
    } as never);
    if (erroEstoque) {
      avisos.push(
        `"${nome}" foi criado, mas o estoque não ligou (código repetido?). Confere em Produtos > Estoque.`,
      );
      continue;
    }
    criados++;
    const { data: criadas } = await supabaseAdmin
      .from("produto_skus")
      .select("id, variacao, sku")
      .eq("produto_id", produtoId)
      .eq("arquivado", false);
    const lista = (criadas as { id: string; variacao: string | null; sku: string | null }[]) ?? [];
    itens.forEach((i, k) => {
      const alvo = variacoes[k];
      const achada =
        lista.find((s) => s.variacao === alvo.variacao && s.sku === alvo.sku) ??
        (lista.length === 1 ? lista[0] : null);
      if (achada) destinoFinal.set(i.skuExternoId, achada.id);
    });
  }

  // 4. Grava as ligações e apaga as que ela marcou como "não ligar".
  const linhas = p.itens
    .filter((i) => destinoFinal.has(i.skuExternoId))
    .map((i) => ({
      user_id: p.userId,
      canal: p.canal,
      produto_externo_id: i.produtoExternoId,
      sku_externo_id: i.skuExternoId,
      sku_id: destinoFinal.get(i.skuExternoId)!,
    }));
  if (linhas.length) {
    const { error } = await supabaseAdmin
      .from("anuncio_vinculos" as never)
      .upsert(linhas as never, { onConflict: "user_id,canal,sku_externo_id" });
    if (error)
      return falha("A Pólia One não conseguiu salvar as ligações. Tenta de novo.", criados, avisos);
  }
  const desligar = p.itens.filter((i) => i.destino === "nenhum").map((i) => i.skuExternoId);
  if (desligar.length)
    await supabaseAdmin
      .from("anuncio_vinculos" as never)
      .delete()
      .eq("user_id", p.userId)
      .eq("canal", p.canal)
      .in("sku_externo_id", desligar);

  return { ok: true, error: null, ligados: linhas.length, criados, avisos };
}
