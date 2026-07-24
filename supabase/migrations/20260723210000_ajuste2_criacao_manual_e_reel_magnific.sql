-- Módulo Social — Ajuste 2 (aditivo aos handoffs anteriores).
-- Criação manual (upload direto) pra story/carrossel/feed, sem passar pelo pipeline
-- de IA. Reel sai do plano de ffmpeg.wasm no navegador: agora é SEMPRE gerado pela
-- ferramenta de vídeo da Magnific (Edge Function chama video_generate/video_concatenate).

alter table social_posts
  add column origem_criacao text not null default 'ia' check (origem_criacao in ('manual', 'ia'));

comment on column social_posts.origem_criacao is 'manual = upload direto (sem pauta/copy/revisora); ia = passou pelo Estúdio (produzir/ajustar).';

alter table social_geracoes drop constraint social_geracoes_acao_check;
alter table social_geracoes add constraint social_geracoes_acao_check
  check (acao in ('pauta', 'copy', 'revisao', 'ajuste', 'imagem', 'video'));

comment on column social_geracoes.acao is 'video = chamada à ferramenta de vídeo da Magnific pra gerar reel (custo rastreado igual às demais ações).';
