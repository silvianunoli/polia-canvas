// Banco fixo de ideias de post do Plano de conteúdo (05/10/2026, decisão da
// Sil): no lugar da IA, ideias escritas e revisadas por nicho. Sai mais barato,
// não depende do Planejamento estar completo e o texto é previsível.

export type TipoPost = "feed" | "stories" | "reels" | "carrossel";

export type CategoriaIdeia =
  | "bastidor"
  | "produto"
  | "prova_social"
  | "dica"
  | "oferta"
  | "pessoal";

export interface IdeiaPost {
  tipo: TipoPost;
  categoria: CategoriaIdeia;
  titulo: string;
  ideia: string;
}
