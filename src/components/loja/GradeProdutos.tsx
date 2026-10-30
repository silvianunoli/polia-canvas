import { Link } from "@tanstack/react-router";
import { reais, type ProdutoLoja } from "@/lib/loja";
import { SemFoto } from "./icones";

/** Cartões da vitrine: a segunda foto aparece no hover (modelo do Lab). */
export function GradeProdutos({ slug, produtos }: { slug: string; produtos: ProdutoLoja[] }) {
  return (
    <ul className="grade">
      {produtos.map((p) => (
        <li key={p.id}>
          <CartaoProduto slug={slug} produto={p} />
        </li>
      ))}
    </ul>
  );
}

function CartaoProduto({ slug, produto: p }: { slug: string; produto: ProdutoLoja }) {
  const [f1, f2] = p.fotos;
  const opcoes = p.variacoes.length;
  return (
    <Link to="/loja/$slug/$produto" params={{ slug, produto: p.id }} className="card">
      <div className="foto">
        {f1 ? <img src={f1} alt={p.nome} loading="lazy" decoding="async" /> : <SemFoto />}
        {f2 && <img className="f2" src={f2} alt="" loading="lazy" decoding="async" />}
        <span className="ver" aria-hidden="true">
          {opcoes > 1 ? "Ver as opções" : "Ver detalhes"}
        </span>
      </div>
      <div className="txt">
        <h3>{p.nome}</h3>
        <span className="vl">{reais(p.preco)}</span>
      </div>
      {opcoes > 1 && <p className="opcoes">{opcoes} opções</p>}
    </Link>
  );
}
