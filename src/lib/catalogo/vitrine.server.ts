// GET /api/catalogo/vitrine?dominio=... (02/11/2026, SERV-59). Quem chama é o
// Worker do catálogo online da loja (Pólia Lab, ex.: lovelesscrochet.com.br),
// de servidor pra servidor, a cada visita (com cache curto lá). É o que faz o
// site mostrar na hora o que a dona mudou em Produtos: nome, preço, descrição,
// fotos e quais produtos estão "no catálogo".
//
// Só sai o que o próprio site já mostra em público. A loja é achada pela
// conexão do canal catalogo (a mesma do pedido) e só responde no Pro, igual à
// registrar_pedido_catalogo.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizarDominio } from "@/lib/catalogo";
import { temProjete } from "@/lib/planos";

export const CAMINHO_VITRINE_CATALOGO = "/api/catalogo/vitrine";

export interface ProdutoVitrine {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  /** Ordem que a dona deu na tela Catálogo; null quando ela nunca ordenou. */
  ordem: number | null;
  /** URLs públicas do Storage, na ordem das fotos do produto. */
  fotos: string[];
}

function resposta(status: number, corpo: unknown, cache: string): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });
}
const indisponivel = () => resposta(404, { ok: false }, "no-store");

export async function responderVitrineCatalogo(request: Request): Promise<Response> {
  if (request.method !== "GET") return resposta(405, { ok: false }, "no-store");
  const dominio = normalizarDominio(new URL(request.url).searchParams.get("dominio"));
  if (!dominio) return indisponivel();

  try {
    const { data: conexao, error } = await supabaseAdmin
      .from("canal_conexoes" as never)
      .select("user_id")
      .eq("canal" as never, "catalogo" as never)
      .eq("shop_id" as never, dominio as never)
      .eq("status" as never, "conectada" as never)
      .maybeSingle();
    if (error) throw error;
    const uid = (conexao as { user_id: string } | null)?.user_id;
    if (!uid) return indisponivel();

    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("plano")
      .eq("id", uid)
      .maybeSingle();
    if (!temProjete(perfil?.plano)) return indisponivel();

    const { data: prods, error: erroProdutos } = await supabaseAdmin
      .from("produtos")
      .select("id, nome, descricao, preco_venda, foto_url, catalogo_ordem, created_at")
      .eq("user_id", uid)
      .eq("arquivado", false)
      .eq("no_catalogo" as never, true as never)
      .order("catalogo_ordem" as never, { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (erroProdutos) throw erroProdutos;
    const lista = (prods ?? []) as unknown as Array<{
      id: string;
      nome: string;
      descricao: string | null;
      preco_venda: number;
      foto_url: string | null;
      catalogo_ordem: number | null;
    }>;

    const ids = lista.map((p) => p.id);
    const { data: fotos } = ids.length
      ? await supabaseAdmin
          .from("produto_fotos" as never)
          .select("produto_id, path, ordem")
          .in("produto_id" as never, ids as never)
          .order("ordem" as never)
      : { data: [] };
    const fotosPor = new Map<string, string[]>();
    for (const f of (fotos ?? []) as unknown as Array<{ produto_id: string; path: string }>) {
      const url = supabaseAdmin.storage.from("produtos-fotos").getPublicUrl(f.path).data.publicUrl;
      fotosPor.set(f.produto_id, [...(fotosPor.get(f.produto_id) ?? []), url]);
    }

    const produtos: ProdutoVitrine[] = lista.map((p) => {
      const daGaleria = fotosPor.get(p.id) ?? [];
      // Produto antigo, de antes das 4 fotos, só tem foto_url.
      const legado = p.foto_url?.startsWith("https://") ? [p.foto_url] : [];
      return {
        id: p.id,
        nome: p.nome,
        descricao: p.descricao,
        preco: Number(p.preco_venda),
        ordem: p.catalogo_ordem ?? null,
        fotos: daGaleria.length ? daGaleria : legado,
      };
    });
    // Cache curto: a mudança da dona aparece no site em até meio minuto.
    return resposta(200, { ok: true, produtos }, "public, max-age=30");
  } catch (e) {
    console.error("[Catálogo] vitrine", e instanceof Error ? e.message : e);
    return resposta(500, { ok: false }, "no-store");
  }
}
