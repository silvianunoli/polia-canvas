export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          acao: string
          admin_id: string | null
          alvo: string | null
          criado_em: string
          detalhes: Json
          id: string
        }
        Insert: {
          acao: string
          admin_id?: string | null
          alvo?: string | null
          criado_em?: string
          detalhes?: Json
          id?: string
        }
        Update: {
          acao?: string
          admin_id?: string | null
          alvo?: string | null
          criado_em?: string
          detalhes?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      alerta_regras: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          limite: number
          nome: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          limite: number
          nome: string
          tipo: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          limite?: number
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      alertas_abertos: {
        Row: {
          criado_em: string
          detalhes: Json
          id: string
          regra_id: string | null
          resolvido_em: string | null
          status: string
          titulo: string
        }
        Insert: {
          criado_em?: string
          detalhes?: Json
          id?: string
          regra_id?: string | null
          resolvido_em?: string | null
          status?: string
          titulo: string
        }
        Update: {
          criado_em?: string
          detalhes?: Json
          id?: string
          regra_id?: string | null
          resolvido_em?: string | null
          status?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_abertos_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "alerta_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_enviados: {
        Row: {
          atualizado_em: string
          criado_em: string
          detalhes: Json
          enviado: boolean
          id: string
          janela_fim: string
          link: string | null
          ocorrencias: number
          resposta_provedor: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          detalhes?: Json
          enviado?: boolean
          id?: string
          janela_fim: string
          link?: string | null
          ocorrencias?: number
          resposta_provedor?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          detalhes?: Json
          enviado?: boolean
          id?: string
          janela_fim?: string
          link?: string | null
          ocorrencias?: number
          resposta_provedor?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      assinaturas: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          price_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          price_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          price_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          agendado_para: string | null
          autor_id: string | null
          capa_url: string | null
          categoria: string | null
          conteudo_md: string | null
          created_at: string
          id: string
          publicado: boolean
          publicado_em: string | null
          resumo: string | null
          slug: string
          tempo_leitura: number | null
          titulo: string
          updated_at: string
        }
        Insert: {
          agendado_para?: string | null
          autor_id?: string | null
          capa_url?: string | null
          categoria?: string | null
          conteudo_md?: string | null
          created_at?: string
          id?: string
          publicado?: boolean
          publicado_em?: string | null
          resumo?: string | null
          slug: string
          tempo_leitura?: number | null
          titulo: string
          updated_at?: string
        }
        Update: {
          agendado_para?: string | null
          autor_id?: string | null
          capa_url?: string | null
          categoria?: string | null
          conteudo_md?: string | null
          created_at?: string
          id?: string
          publicado?: boolean
          publicado_em?: string | null
          resumo?: string | null
          slug?: string
          tempo_leitura?: number | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          contato: string | null
          created_at: string
          id: string
          nome: string
          notas: string | null
          produto_id: string | null
          status_pedido: string | null
          updated_at: string
          user_id: string
          valor: number | null
          venda_registrada: boolean
        }
        Insert: {
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
          notas?: string | null
          produto_id?: string | null
          status_pedido?: string | null
          updated_at?: string
          user_id: string
          valor?: number | null
          venda_registrada?: boolean
        }
        Update: {
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
          notas?: string | null
          produto_id?: string | null
          status_pedido?: string | null
          updated_at?: string
          user_id?: string
          valor?: number | null
          venda_registrada?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clientes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      comunidade_artigos: {
        Row: {
          agendado_para: string | null
          autor_id: string | null
          capa_url: string | null
          categoria: string | null
          conteudo_md: string | null
          created_at: string
          id: string
          publicado: boolean
          publicado_em: string | null
          resumo: string | null
          slug: string
          tempo_leitura: number | null
          titulo: string
          updated_at: string
        }
        Insert: {
          agendado_para?: string | null
          autor_id?: string | null
          capa_url?: string | null
          categoria?: string | null
          conteudo_md?: string | null
          created_at?: string
          id?: string
          publicado?: boolean
          publicado_em?: string | null
          resumo?: string | null
          slug: string
          tempo_leitura?: number | null
          titulo: string
          updated_at?: string
        }
        Update: {
          agendado_para?: string | null
          autor_id?: string | null
          capa_url?: string | null
          categoria?: string | null
          conteudo_md?: string | null
          created_at?: string
          id?: string
          publicado?: boolean
          publicado_em?: string | null
          resumo?: string | null
          slug?: string
          tempo_leitura?: number | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunidade_artigos_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comunidade_comentarios: {
        Row: {
          artigo_id: string
          autor_id: string
          corpo: string
          created_at: string
          id: string
        }
        Insert: {
          artigo_id: string
          autor_id: string
          corpo: string
          created_at?: string
          id?: string
        }
        Update: {
          artigo_id?: string
          autor_id?: string
          corpo?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comunidade_comentarios_artigo_id_fkey"
            columns: ["artigo_id"]
            isOneToOne: false
            referencedRelation: "comunidade_artigos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comunidade_comentarios_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contatos: {
        Row: {
          assunto: string
          created_at: string
          email: string
          id: string
          mensagem: string
          nome: string
        }
        Insert: {
          assunto: string
          created_at?: string
          email: string
          id?: string
          mensagem: string
          nome: string
        }
        Update: {
          assunto?: string
          created_at?: string
          email?: string
          id?: string
          mensagem?: string
          nome?: string
        }
        Relationships: []
      }
      convites_cadastro: {
        Row: {
          criado_em: string
          email: string
          enviado_em: string | null
          usado_em: string | null
        }
        Insert: {
          criado_em?: string
          email: string
          enviado_em?: string | null
          usado_em?: string | null
        }
        Update: {
          criado_em?: string
          email?: string
          enviado_em?: string | null
          usado_em?: string | null
        }
        Relationships: []
      }
      edge_function_logs: {
        Row: {
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          latency_ms: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          function_name: string
          id?: string
          latency_ms?: number | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          function_name?: string
          id?: string
          latency_ms?: number | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      entregaveis: {
        Row: {
          conteudo: Json | null
          created_at: string
          etapa: number
          fase: string
          id: string
          status: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          conteudo?: Json | null
          created_at?: string
          etapa: number
          fase: string
          id?: string
          status?: string
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          conteudo?: Json | null
          created_at?: string
          etapa?: number
          fase?: string
          id?: string
          status?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      erros_app: {
        Row: {
          contexto: Json
          criado_em: string
          id: string
          mensagem: string
          origem: string
          pagina: string | null
          stack: string | null
          user_id: string | null
        }
        Insert: {
          contexto?: Json
          criado_em?: string
          id?: string
          mensagem: string
          origem: string
          pagina?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Update: {
          contexto?: Json
          criado_em?: string
          id?: string
          mensagem?: string
          origem?: string
          pagina?: string | null
          stack?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erros_app_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_analytics: {
        Row: {
          criado_em: string
          evento: string
          id: string
          pagina: string
          propriedades: Json
          sessao_id: string
          user_id: string | null
        }
        Insert: {
          criado_em?: string
          evento: string
          id?: string
          pagina: string
          propriedades?: Json
          sessao_id: string
          user_id?: string | null
        }
        Update: {
          criado_em?: string
          evento?: string
          id?: string
          pagina?: string
          propriedades?: Json
          sessao_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_responses: {
        Row: {
          comment: string | null
          context_ref: string
          created_at: string
          id: string
          score: number
          trigger_type: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          context_ref: string
          created_at?: string
          id?: string
          score: number
          trigger_type: string
          user_id: string
        }
        Update: {
          comment?: string | null
          context_ref?: string
          created_at?: string
          id?: string
          score?: number
          trigger_type?: string
          user_id?: string
        }
        Relationships: []
      }
      financeiro_mensal: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          meta: number
          receita: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          meta?: number
          receita?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          meta?: number
          receita?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      founder_alertas: {
        Row: {
          chave_dedup: string | null
          criado_em: string
          detalhes: Json
          id: string
          link: string | null
          mensagem: string | null
          origem: string
          resolvido_em: string | null
          resolvido_por: string | null
          severidade: string
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          chave_dedup?: string | null
          criado_em?: string
          detalhes?: Json
          id?: string
          link?: string | null
          mensagem?: string | null
          origem?: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade: string
          status?: string
          tipo: string
          titulo: string
        }
        Update: {
          chave_dedup?: string | null
          criado_em?: string
          detalhes?: Json
          id?: string
          link?: string | null
          mensagem?: string | null
          origem?: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      founder_api_chamadas: {
        Row: {
          criado_em: string
          fn: string
          id: number
          latencia_ms: number
          metodo: string | null
          ok: boolean
          status: number | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          criado_em?: string
          fn: string
          id?: never
          latencia_ms: number
          metodo?: string | null
          ok: boolean
          status?: number | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          criado_em?: string
          fn?: string
          id?: never
          latencia_ms?: number
          metodo?: string | null
          ok?: boolean
          status?: number | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: []
      }
      founder_eventos: {
        Row: {
          ambiente: string
          criado_em: string
          evento: string
          feature: string | null
          id: string
          origem: string
          pagina: string | null
          propriedades: Json
          sessao_id: string
          user_id: string | null
        }
        Insert: {
          ambiente?: string
          criado_em?: string
          evento: string
          feature?: string | null
          id?: string
          origem?: string
          pagina?: string | null
          propriedades?: Json
          sessao_id: string
          user_id?: string | null
        }
        Update: {
          ambiente?: string
          criado_em?: string
          evento?: string
          feature?: string | null
          id?: string
          origem?: string
          pagina?: string | null
          propriedades?: Json
          sessao_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "founder_eventos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      founder_eventos_sistema: {
        Row: {
          criado_em: string
          detalhes: Json
          id: string
          latencia_ms: number | null
          origem: string
          servico: string | null
          tipo: string
        }
        Insert: {
          criado_em?: string
          detalhes?: Json
          id?: string
          latencia_ms?: number | null
          origem: string
          servico?: string | null
          tipo: string
        }
        Update: {
          criado_em?: string
          detalhes?: Json
          id?: string
          latencia_ms?: number | null
          origem?: string
          servico?: string | null
          tipo?: string
        }
        Relationships: []
      }
      founder_experimentos: {
        Row: {
          criado_em: string
          criado_por: string | null
          fim: string | null
          flag_key: string
          hipotese: string | null
          id: string
          inicio: string
          metrica_evento: string
          metrica_feature: string | null
          nome: string
          resultado: string | null
          status: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          fim?: string | null
          flag_key: string
          hipotese?: string | null
          id?: string
          inicio?: string
          metrica_evento: string
          metrica_feature?: string | null
          nome: string
          resultado?: string | null
          status?: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          fim?: string | null
          flag_key?: string
          hipotese?: string | null
          id?: string
          inicio?: string
          metrica_evento?: string
          metrica_feature?: string | null
          nome?: string
          resultado?: string | null
          status?: string
        }
        Relationships: []
      }
      founder_features: {
        Row: {
          ativa: boolean
          grupo: string
          key: string
          nome: string
          rota_prefixo: string
        }
        Insert: {
          ativa?: boolean
          grupo: string
          key: string
          nome: string
          rota_prefixo: string
        }
        Update: {
          ativa?: boolean
          grupo?: string
          key?: string
          nome?: string
          rota_prefixo?: string
        }
        Relationships: []
      }
      founder_flags: {
        Row: {
          ambiente: string
          atualizado_em: string
          atualizado_por: string | null
          beta_user_ids: string[]
          descricao: string | null
          estado: string
          key: string
          nome: string
          rollout_pct: number
        }
        Insert: {
          ambiente?: string
          atualizado_em?: string
          atualizado_por?: string | null
          beta_user_ids?: string[]
          descricao?: string | null
          estado?: string
          key: string
          nome: string
          rollout_pct?: number
        }
        Update: {
          ambiente?: string
          atualizado_em?: string
          atualizado_por?: string | null
          beta_user_ids?: string[]
          descricao?: string | null
          estado?: string
          key?: string
          nome?: string
          rollout_pct?: number
        }
        Relationships: []
      }
      founder_flags_historico: {
        Row: {
          alterado_em: string
          alterado_por: string | null
          ambiente: string
          estado_anterior: Json | null
          estado_novo: Json
          flag_key: string
          id: string
          motivo: string | null
        }
        Insert: {
          alterado_em?: string
          alterado_por?: string | null
          ambiente: string
          estado_anterior?: Json | null
          estado_novo: Json
          flag_key: string
          id?: string
          motivo?: string | null
        }
        Update: {
          alterado_em?: string
          alterado_por?: string | null
          ambiente?: string
          estado_anterior?: Json | null
          estado_novo?: Json
          flag_key?: string
          id?: string
          motivo?: string | null
        }
        Relationships: []
      }
      founder_funil_config: {
        Row: {
          ativo: boolean
          atualizado_em: string
          id: string
          nome: string
          passos: Json
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          id?: string
          nome: string
          passos: Json
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          id?: string
          nome?: string
          passos?: Json
        }
        Relationships: []
      }
      founder_metricas_diarias: {
        Row: {
          api_erros: number
          api_p95_ms: number | null
          api_requests: number
          assinantes: number
          calculado_em: string
          churn_pct: number | null
          dau: number
          dia: string
          erros_dia: number
          ia_chamadas: number
          ia_falhas: number
          jobs_falhos: number
          mau: number
          mrr_centavos: number
          novas_contas: number
          pagamentos_falhos: number
          receita_centavos: number
          sessoes: number
          usuarias_ativas: number
          usuarias_total: number
          wau: number
        }
        Insert: {
          api_erros?: number
          api_p95_ms?: number | null
          api_requests?: number
          assinantes: number
          calculado_em?: string
          churn_pct?: number | null
          dau?: number
          dia: string
          erros_dia: number
          ia_chamadas?: number
          ia_falhas?: number
          jobs_falhos?: number
          mau?: number
          mrr_centavos: number
          novas_contas: number
          pagamentos_falhos?: number
          receita_centavos?: number
          sessoes?: number
          usuarias_ativas: number
          usuarias_total: number
          wau?: number
        }
        Update: {
          api_erros?: number
          api_p95_ms?: number | null
          api_requests?: number
          assinantes?: number
          calculado_em?: string
          churn_pct?: number | null
          dau?: number
          dia?: string
          erros_dia?: number
          ia_chamadas?: number
          ia_falhas?: number
          jobs_falhos?: number
          mau?: number
          mrr_centavos?: number
          novas_contas?: number
          pagamentos_falhos?: number
          receita_centavos?: number
          sessoes?: number
          usuarias_ativas?: number
          usuarias_total?: number
          wau?: number
        }
        Relationships: []
      }
      founder_releases: {
        Row: {
          commit_sha: string | null
          criado_por: string | null
          deployado_em: string
          descricao: string | null
          flags: Json
          id: string
          repositorio: string
          titulo: string
          versao: string | null
        }
        Insert: {
          commit_sha?: string | null
          criado_por?: string | null
          deployado_em?: string
          descricao?: string | null
          flags?: Json
          id?: string
          repositorio: string
          titulo: string
          versao?: string | null
        }
        Update: {
          commit_sha?: string | null
          criado_por?: string | null
          deployado_em?: string
          descricao?: string | null
          flags?: Json
          id?: string
          repositorio?: string
          titulo?: string
          versao?: string | null
        }
        Relationships: []
      }
      founder_service_checks: {
        Row: {
          checado_em: string
          detalhe: string | null
          id: string
          latencia_ms: number | null
          service: string
          status: string
        }
        Insert: {
          checado_em?: string
          detalhe?: string | null
          id?: string
          latencia_ms?: number | null
          service: string
          status: string
        }
        Update: {
          checado_em?: string
          detalhe?: string | null
          id?: string
          latencia_ms?: number | null
          service?: string
          status?: string
        }
        Relationships: []
      }
      google_calendar_conexoes: {
        Row: {
          access_token: string | null
          created_at: string
          email_conectado: string | null
          expires_at: string | null
          refresh_token: string | null
          state_pendente: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          email_conectado?: string | null
          expires_at?: string | null
          refresh_token?: string | null
          state_pendente?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          email_conectado?: string | null
          expires_at?: string | null
          refresh_token?: string | null
          state_pendente?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ia_geracoes: {
        Row: {
          criado_em: string
          erro: string | null
          feature: string
          id: string
          modelo: string
          pergunta: string | null
          resposta: string | null
          sucesso: boolean
          tokens_in: number | null
          tokens_out: number | null
          user_id: string
        }
        Insert: {
          criado_em?: string
          erro?: string | null
          feature: string
          id?: string
          modelo: string
          pergunta?: string | null
          resposta?: string | null
          sucesso: boolean
          tokens_in?: number | null
          tokens_out?: number | null
          user_id: string
        }
        Update: {
          criado_em?: string
          erro?: string | null
          feature?: string
          id?: string
          modelo?: string
          pergunta?: string | null
          resposta?: string | null
          sucesso?: boolean
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string
        }
        Relationships: []
      }
      ia_plano_conteudo: {
        Row: {
          ano: number
          criado_em: string
          data: string
          id: string
          ideia: string
          postado: boolean
          postado_em: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          ano: number
          criado_em?: string
          data: string
          id?: string
          ideia: string
          postado?: boolean
          postado_em?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          ano?: number
          criado_em?: string
          data?: string
          id?: string
          ideia?: string
          postado?: boolean
          postado_em?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      ia_raiox: {
        Row: {
          causas: string
          criado_em: string
          dado_ralo: boolean
          email_enviado_em: string | null
          id: string
          mes: string
          placar: string
          sugestoes: Json
          user_id: string
        }
        Insert: {
          causas: string
          criado_em?: string
          dado_ralo?: boolean
          email_enviado_em?: string | null
          id?: string
          mes: string
          placar: string
          sugestoes: Json
          user_id: string
        }
        Update: {
          causas?: string
          criado_em?: string
          dado_ralo?: boolean
          email_enviado_em?: string | null
          id?: string
          mes?: string
          placar?: string
          sugestoes?: Json
          user_id?: string
        }
        Relationships: []
      }
      ia_uso: {
        Row: {
          atualizado_em: string
          contagem: number
          feature: string
          periodo: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          contagem?: number
          feature: string
          periodo: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          contagem?: number
          feature?: string
          periodo?: string
          user_id?: string
        }
        Relationships: []
      }
      intencoes_dia: {
        Row: {
          created_at: string
          data: string
          id: string
          texto: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          texto: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          texto?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lancamentos: {
        Row: {
          categoria: string | null
          created_at: string
          data: string
          descricao: string | null
          id: string
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      lista_espera: {
        Row: {
          criado_em: string
          email: string
          id: string
          nome: string
          novidades: boolean
          tipo_negocio: string | null
        }
        Insert: {
          criado_em?: string
          email: string
          id?: string
          nome: string
          novidades?: boolean
          tipo_negocio?: string | null
        }
        Update: {
          criado_em?: string
          email?: string
          id?: string
          nome?: string
          novidades?: boolean
          tipo_negocio?: string | null
        }
        Relationships: []
      }
      manual_leads: {
        Row: {
          baixado_em: string | null
          consent_texto: string | null
          consentimento: boolean
          created_at: string
          descadastrado_em: string | null
          descadastro_token: string
          download_token: string
          downloads: number
          email: string
          id: string
          origem: string
          updated_at: string | null
        }
        Insert: {
          baixado_em?: string | null
          consent_texto?: string | null
          consentimento: boolean
          created_at?: string
          descadastrado_em?: string | null
          descadastro_token?: string
          download_token?: string
          downloads?: number
          email: string
          id?: string
          origem?: string
          updated_at?: string | null
        }
        Update: {
          baixado_em?: string | null
          consent_texto?: string | null
          consentimento?: boolean
          created_at?: string
          descadastrado_em?: string | null
          descadastro_token?: string
          download_token?: string
          downloads?: number
          email?: string
          id?: string
          origem?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      metas: {
        Row: {
          concluida_em: string | null
          created_at: string
          da_jornada: boolean
          descricao: string | null
          formato: string
          id: string
          prazo: string | null
          progresso: number
          status: string
          titulo: string
          unidade: string | null
          updated_at: string
          user_id: string
          valor_alvo: number | null
          valor_atual: number
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          da_jornada?: boolean
          descricao?: string | null
          formato?: string
          id?: string
          prazo?: string | null
          progresso?: number
          status?: string
          titulo: string
          unidade?: string | null
          updated_at?: string
          user_id: string
          valor_alvo?: number | null
          valor_atual?: number
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          da_jornada?: boolean
          descricao?: string | null
          formato?: string
          id?: string
          prazo?: string | null
          progresso?: number
          status?: string
          titulo?: string
          unidade?: string | null
          updated_at?: string
          user_id?: string
          valor_alvo?: number | null
          valor_atual?: number
        }
        Relationships: []
      }
      notas: {
        Row: {
          arquivada: boolean
          conteudo: string
          created_at: string
          deleted_at: string | null
          fixada: boolean
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arquivada?: boolean
          conteudo?: string
          created_at?: string
          deleted_at?: string | null
          fixada?: boolean
          id?: string
          titulo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arquivada?: boolean
          conteudo?: string
          created_at?: string
          deleted_at?: string | null
          fixada?: boolean
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      office_concluidos_locais: {
        Row: {
          marcado_em: string
          tarefa_id: string
        }
        Insert: {
          marcado_em?: string
          tarefa_id: string
        }
        Update: {
          marcado_em?: string
          tarefa_id?: string
        }
        Relationships: []
      }
      office_conteudo_catalogo: {
        Row: {
          atualizado_em: string
          canal: string
          criado_em: string
          data_planejada: string | null
          etapa: string
          formato: string | null
          id: string
          nota: string | null
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          canal?: string
          criado_em?: string
          data_planejada?: string | null
          etapa?: string
          formato?: string | null
          id?: string
          nota?: string | null
          titulo: string
        }
        Update: {
          atualizado_em?: string
          canal?: string
          criado_em?: string
          data_planejada?: string | null
          etapa?: string
          formato?: string | null
          id?: string
          nota?: string | null
          titulo?: string
        }
        Relationships: []
      }
      office_conteudo_colunas: {
        Row: {
          atualizado_em: string
          etapa: string
          nome: string
        }
        Insert: {
          atualizado_em?: string
          etapa: string
          nome: string
        }
        Update: {
          atualizado_em?: string
          etapa?: string
          nome?: string
        }
        Relationships: []
      }
      office_tarefas_catalogo: {
        Row: {
          area: string
          atualizado_em: string
          concluido_em: string | null
          id: string
          nota: string | null
          pessoa: string
          prioridade: string
          sprint: string | null
          status: string
          titulo: string
        }
        Insert: {
          area: string
          atualizado_em?: string
          concluido_em?: string | null
          id: string
          nota?: string | null
          pessoa: string
          prioridade?: string
          sprint?: string | null
          status?: string
          titulo: string
        }
        Update: {
          area?: string
          atualizado_em?: string
          concluido_em?: string | null
          id?: string
          nota?: string | null
          pessoa?: string
          prioridade?: string
          sprint?: string | null
          status?: string
          titulo?: string
        }
        Relationships: []
      }
      office_tarefas_locais: {
        Row: {
          area: string
          criado_em: string
          id: string
          nota: string | null
          pessoa: string
          prioridade: string
          sprint: string | null
          status: string
          titulo: string
        }
        Insert: {
          area: string
          criado_em?: string
          id?: string
          nota?: string | null
          pessoa: string
          prioridade?: string
          sprint?: string | null
          status?: string
          titulo: string
        }
        Update: {
          area?: string
          criado_em?: string
          id?: string
          nota?: string | null
          pessoa?: string
          prioridade?: string
          sprint?: string | null
          status?: string
          titulo?: string
        }
        Relationships: []
      }
      pesquisa_respostas: {
        Row: {
          atualizado_em: string
          concluida: boolean
          criado_em: string
          id: string
          pesquisa_id: string
          progresso: number
          respostas: Json
          sessao_id: string
        }
        Insert: {
          atualizado_em?: string
          concluida?: boolean
          criado_em?: string
          id?: string
          pesquisa_id: string
          progresso?: number
          respostas?: Json
          sessao_id: string
        }
        Update: {
          atualizado_em?: string
          concluida?: boolean
          criado_em?: string
          id?: string
          pesquisa_id?: string
          progresso?: number
          respostas?: Json
          sessao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesquisa_respostas_pesquisa_id_fkey"
            columns: ["pesquisa_id"]
            isOneToOne: false
            referencedRelation: "pesquisas"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisas: {
        Row: {
          abre_em: string | null
          ativa: boolean
          criado_em: string
          fecha_em: string | null
          id: string
          slug: string
          subtitulo: string | null
          titulo: string
        }
        Insert: {
          abre_em?: string | null
          ativa?: boolean
          criado_em?: string
          fecha_em?: string | null
          id?: string
          slug: string
          subtitulo?: string | null
          titulo: string
        }
        Update: {
          abre_em?: string | null
          ativa?: boolean
          criado_em?: string
          fecha_em?: string | null
          id?: string
          slug?: string
          subtitulo?: string | null
          titulo?: string
        }
        Relationships: []
      }
      planejamento_campos: {
        Row: {
          campo: string
          updated_at: string
          user_id: string
          valor: string | null
        }
        Insert: {
          campo: string
          updated_at?: string
          user_id: string
          valor?: string | null
        }
        Update: {
          campo?: string
          updated_at?: string
          user_id?: string
          valor?: string | null
        }
        Relationships: []
      }
      planejamento_respostas: {
        Row: {
          campo: string
          modulo: number
          pergunta_idx: number
          resposta: string | null
          secao: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campo: string
          modulo: number
          pergunta_idx: number
          resposta?: string | null
          secao: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campo?: string
          modulo?: number
          pergunta_idx?: number
          resposta?: string | null
          secao?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planejamento_secoes: {
        Row: {
          concluido: boolean
          concluido_em: string
          modulo: number
          secao: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string
          modulo: number
          secao: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string
          modulo?: number
          secao?: string
          user_id?: string
        }
        Relationships: []
      }
      presencas: {
        Row: {
          created_at: string
          data: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          arquivado: boolean
          calculadora_breakdown: Json | null
          canal: string | null
          created_at: string
          da_jornada: boolean
          descricao: string | null
          foto_url: string | null
          historico_precos: Json
          id: string
          nome: string
          preco_atualizado_em: string | null
          preco_custo: number | null
          preco_venda: number
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          arquivado?: boolean
          calculadora_breakdown?: Json | null
          canal?: string | null
          created_at?: string
          da_jornada?: boolean
          descricao?: string | null
          foto_url?: string | null
          historico_precos?: Json
          id?: string
          nome: string
          preco_atualizado_em?: string | null
          preco_custo?: number | null
          preco_venda?: number
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          arquivado?: boolean
          calculadora_breakdown?: Json | null
          canal?: string | null
          created_at?: string
          da_jornada?: boolean
          descricao?: string | null
          foto_url?: string | null
          historico_precos?: Json
          id?: string
          nome?: string
          preco_atualizado_em?: string | null
          preco_custo?: number | null
          preco_venda?: number
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          action_triggers: string | null
          audience_content_types: string | null
          awareness_source: string | null
          boas_vindas_enviado_em: string | null
          brand_feeling: string | null
          brand_visual_style: string | null
          brand_voice: string | null
          brand_voice_finalized_at: string | null
          brand_voice_yes: string | null
          business_name: string | null
          business_stage: string | null
          business_type: string | null
          business_why: string | null
          care_finalized_at: string | null
          closing_method: string | null
          cnpj: string | null
          competitors: string | null
          content_finalized_at: string | null
          created_at: string
          decision_trigger: string | null
          delivery_method: string | null
          descricao_produto: Json | null
          differentiators: string | null
          display_name: string | null
          etapa_atual: number
          fluxo_entrega: string | null
          fluxo_pedido: string | null
          fluxo_pos_venda: string | null
          full_name: string | null
          growth_finalized_at: string | null
          growth_vision: string | null
          id: string
          is_admin: boolean
          issue_handling: string | null
          jornada_completed_at: string | null
          key_number_1: string | null
          key_partners: string | null
          loyalty_strategy: string | null
          main_channel: string | null
          mini_pitch: string | null
          network_finalized_at: string | null
          notif_dicas: boolean
          notif_novidades: boolean
          notif_resumo_semanal: boolean
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          orbit_brand_alive_unlocked: boolean
          orbit_financial_active: boolean
          orbit_financial_unlocked: boolean
          orbit_marca_viva_unlocked: boolean
          orbit_produtos_active: boolean
          orbit_produtos_unlocked: boolean
          orbit_sales_active: boolean
          orbit_sales_unlocked: boolean
          plano: string
          positioning_finalized_at: string | null
          positioning_statement: string | null
          presence_finalized_at: string | null
          price_range: string | null
          pro_labore_desejado: number | null
          problem_solved: string | null
          problem_urgency: string | null
          product_description: string | null
          product_finalized_at: string | null
          production_capacity: string | null
          profile_story: string | null
          publishing_rhythm: string | null
          purchase_path: string | null
          razao_social: string | null
          restock_triggers: string | null
          review_rhythm: string | null
          routine_finalized_at: string | null
          sales_finalized_at: string | null
          scroll_stoppers: string | null
          star_1_completed_at: string | null
          star_10_completed_at: string | null
          star_11_completed_at: string | null
          star_2_completed_at: string | null
          star_3_completed_at: string | null
          star_4_completed_at: string | null
          star_5_completed_at: string | null
          star_6_completed_at: string | null
          star_7_completed_at: string | null
          star_8_completed_at: string | null
          star_9_completed_at: string | null
          streak: number
          target_customer: string | null
          timeline_goal: string | null
          tracking_system: string | null
          updated_at: string
          valor_hora_padrao: number | null
          visual_presence: string | null
          welcome_protocol: string | null
        }
        Insert: {
          action_triggers?: string | null
          audience_content_types?: string | null
          awareness_source?: string | null
          boas_vindas_enviado_em?: string | null
          brand_feeling?: string | null
          brand_visual_style?: string | null
          brand_voice?: string | null
          brand_voice_finalized_at?: string | null
          brand_voice_yes?: string | null
          business_name?: string | null
          business_stage?: string | null
          business_type?: string | null
          business_why?: string | null
          care_finalized_at?: string | null
          closing_method?: string | null
          cnpj?: string | null
          competitors?: string | null
          content_finalized_at?: string | null
          created_at?: string
          decision_trigger?: string | null
          delivery_method?: string | null
          descricao_produto?: Json | null
          differentiators?: string | null
          display_name?: string | null
          etapa_atual?: number
          fluxo_entrega?: string | null
          fluxo_pedido?: string | null
          fluxo_pos_venda?: string | null
          full_name?: string | null
          growth_finalized_at?: string | null
          growth_vision?: string | null
          id: string
          is_admin?: boolean
          issue_handling?: string | null
          jornada_completed_at?: string | null
          key_number_1?: string | null
          key_partners?: string | null
          loyalty_strategy?: string | null
          main_channel?: string | null
          mini_pitch?: string | null
          network_finalized_at?: string | null
          notif_dicas?: boolean
          notif_novidades?: boolean
          notif_resumo_semanal?: boolean
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          orbit_brand_alive_unlocked?: boolean
          orbit_financial_active?: boolean
          orbit_financial_unlocked?: boolean
          orbit_marca_viva_unlocked?: boolean
          orbit_produtos_active?: boolean
          orbit_produtos_unlocked?: boolean
          orbit_sales_active?: boolean
          orbit_sales_unlocked?: boolean
          plano?: string
          positioning_finalized_at?: string | null
          positioning_statement?: string | null
          presence_finalized_at?: string | null
          price_range?: string | null
          pro_labore_desejado?: number | null
          problem_solved?: string | null
          problem_urgency?: string | null
          product_description?: string | null
          product_finalized_at?: string | null
          production_capacity?: string | null
          profile_story?: string | null
          publishing_rhythm?: string | null
          purchase_path?: string | null
          razao_social?: string | null
          restock_triggers?: string | null
          review_rhythm?: string | null
          routine_finalized_at?: string | null
          sales_finalized_at?: string | null
          scroll_stoppers?: string | null
          star_1_completed_at?: string | null
          star_10_completed_at?: string | null
          star_11_completed_at?: string | null
          star_2_completed_at?: string | null
          star_3_completed_at?: string | null
          star_4_completed_at?: string | null
          star_5_completed_at?: string | null
          star_6_completed_at?: string | null
          star_7_completed_at?: string | null
          star_8_completed_at?: string | null
          star_9_completed_at?: string | null
          streak?: number
          target_customer?: string | null
          timeline_goal?: string | null
          tracking_system?: string | null
          updated_at?: string
          valor_hora_padrao?: number | null
          visual_presence?: string | null
          welcome_protocol?: string | null
        }
        Update: {
          action_triggers?: string | null
          audience_content_types?: string | null
          awareness_source?: string | null
          boas_vindas_enviado_em?: string | null
          brand_feeling?: string | null
          brand_visual_style?: string | null
          brand_voice?: string | null
          brand_voice_finalized_at?: string | null
          brand_voice_yes?: string | null
          business_name?: string | null
          business_stage?: string | null
          business_type?: string | null
          business_why?: string | null
          care_finalized_at?: string | null
          closing_method?: string | null
          cnpj?: string | null
          competitors?: string | null
          content_finalized_at?: string | null
          created_at?: string
          decision_trigger?: string | null
          delivery_method?: string | null
          descricao_produto?: Json | null
          differentiators?: string | null
          display_name?: string | null
          etapa_atual?: number
          fluxo_entrega?: string | null
          fluxo_pedido?: string | null
          fluxo_pos_venda?: string | null
          full_name?: string | null
          growth_finalized_at?: string | null
          growth_vision?: string | null
          id?: string
          is_admin?: boolean
          issue_handling?: string | null
          jornada_completed_at?: string | null
          key_number_1?: string | null
          key_partners?: string | null
          loyalty_strategy?: string | null
          main_channel?: string | null
          mini_pitch?: string | null
          network_finalized_at?: string | null
          notif_dicas?: boolean
          notif_novidades?: boolean
          notif_resumo_semanal?: boolean
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          orbit_brand_alive_unlocked?: boolean
          orbit_financial_active?: boolean
          orbit_financial_unlocked?: boolean
          orbit_marca_viva_unlocked?: boolean
          orbit_produtos_active?: boolean
          orbit_produtos_unlocked?: boolean
          orbit_sales_active?: boolean
          orbit_sales_unlocked?: boolean
          plano?: string
          positioning_finalized_at?: string | null
          positioning_statement?: string | null
          presence_finalized_at?: string | null
          price_range?: string | null
          pro_labore_desejado?: number | null
          problem_solved?: string | null
          problem_urgency?: string | null
          product_description?: string | null
          product_finalized_at?: string | null
          production_capacity?: string | null
          profile_story?: string | null
          publishing_rhythm?: string | null
          purchase_path?: string | null
          razao_social?: string | null
          restock_triggers?: string | null
          review_rhythm?: string | null
          routine_finalized_at?: string | null
          sales_finalized_at?: string | null
          scroll_stoppers?: string | null
          star_1_completed_at?: string | null
          star_10_completed_at?: string | null
          star_11_completed_at?: string | null
          star_2_completed_at?: string | null
          star_3_completed_at?: string | null
          star_4_completed_at?: string | null
          star_5_completed_at?: string | null
          star_6_completed_at?: string | null
          star_7_completed_at?: string | null
          star_8_completed_at?: string | null
          star_9_completed_at?: string | null
          streak?: number
          target_customer?: string | null
          timeline_goal?: string | null
          tracking_system?: string | null
          updated_at?: string
          valor_hora_padrao?: number | null
          visual_presence?: string | null
          welcome_protocol?: string | null
        }
        Relationships: []
      }
      quadro_colunas: {
        Row: {
          coluna_id: string
          created_at: string
          id: string
          nome: string
          quadro_id: string
          updated_at: string
        }
        Insert: {
          coluna_id: string
          created_at?: string
          id?: string
          nome: string
          quadro_id: string
          updated_at?: string
        }
        Update: {
          coluna_id?: string
          created_at?: string
          id?: string
          nome?: string
          quadro_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quadro_colunas_quadro_id_fkey"
            columns: ["quadro_id"]
            isOneToOne: false
            referencedRelation: "quadros"
            referencedColumns: ["id"]
          },
        ]
      }
      quadros: {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_leads: {
        Row: {
          consent_texto: string | null
          consentimento: boolean
          created_at: string
          descadastrado_em: string | null
          descadastro_token: string
          email: string
          faixa: string | null
          id: string
          origem: string
          pontos: number | null
          respostas: Json | null
          territorio_fraco: string | null
          updated_at: string | null
        }
        Insert: {
          consent_texto?: string | null
          consentimento: boolean
          created_at?: string
          descadastrado_em?: string | null
          descadastro_token?: string
          email: string
          faixa?: string | null
          id?: string
          origem?: string
          pontos?: number | null
          respostas?: Json | null
          territorio_fraco?: string | null
          updated_at?: string | null
        }
        Update: {
          consent_texto?: string | null
          consentimento?: boolean
          created_at?: string
          descadastrado_em?: string | null
          descadastro_token?: string
          email?: string
          faixa?: string | null
          id?: string
          origem?: string
          pontos?: number | null
          respostas?: Json | null
          territorio_fraco?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          id: string
          processed_at: string
          type: string | null
        }
        Insert: {
          id: string
          processed_at?: string
          type?: string | null
        }
        Update: {
          id?: string
          processed_at?: string
          type?: string | null
        }
        Relationships: []
      }
      tarefas: {
        Row: {
          categoria: string | null
          created_at: string
          data_inicio: string | null
          descricao: string | null
          etapa: number | null
          fonte: string
          horario: string | null
          horas_por_dia: number | null
          id: string
          meta_id: string | null
          notas_execucao: string | null
          prazo: string | null
          prioridade: string | null
          quadro_id: string | null
          resposta: string | null
          saves_to: string | null
          status: string
          tags: string[]
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data_inicio?: string | null
          descricao?: string | null
          etapa?: number | null
          fonte?: string
          horario?: string | null
          horas_por_dia?: number | null
          id?: string
          meta_id?: string | null
          notas_execucao?: string | null
          prazo?: string | null
          prioridade?: string | null
          quadro_id?: string | null
          resposta?: string | null
          saves_to?: string | null
          status?: string
          tags?: string[]
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data_inicio?: string | null
          descricao?: string | null
          etapa?: number | null
          fonte?: string
          horario?: string | null
          horas_por_dia?: number | null
          id?: string
          meta_id?: string | null
          notas_execucao?: string | null
          prazo?: string | null
          prioridade?: string | null
          quadro_id?: string | null
          resposta?: string | null
          saves_to?: string | null
          status?: string
          tags?: string[]
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_quadro_id_fkey"
            columns: ["quadro_id"]
            isOneToOne: false
            referencedRelation: "quadros"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          author_id: string
          author_role: string
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          author_role: string
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          author_role?: string
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          body: string
          created_at: string
          id: string
          module_ref: string | null
          priority: string
          resolved_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          module_ref?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          module_ref?: string | null
          priority?: string
          resolved_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_limpar_logs_antigos: {
        Args: never
        Returns: {
          linhas_removidas: number
          tabela: string
        }[]
      }
      admin_tamanhos_tabelas: {
        Args: never
        Returns: {
          tabela: string
          tamanho_bytes: number
          tamanho_legivel: string
        }[]
      }
      checar_taxa_erro_e_alertar: { Args: never; Returns: undefined }
      checar_uptimerobot_e_alertar: { Args: never; Returns: undefined }
      compor_nota_presenca: { Args: { p_uid: string }; Returns: undefined }
      disparar_founder_monitor: { Args: never; Returns: undefined }
      disparar_raiox_mensal: { Args: never; Returns: undefined }
      estornar_ia_uso: {
        Args: { p_feature: string; p_periodo: string; p_user_id: string }
        Returns: undefined
      }
      excluir_dados_do_usuario: { Args: never; Returns: undefined }
      founder_banco_status: { Args: never; Returns: Json }
      founder_heatmap: {
        Args: { p_fim: string; p_ini: string }
        Returns: {
          dow: number
          eventos: number
          hora: number
          usuarias: number
        }[]
      }
      founder_jobs_falhos: { Args: { p_horas?: number }; Returns: number }
      founder_jobs_status: {
        Args: { p_horas?: number }
        Returns: {
          active: boolean
          duracao_max_s: number
          duracao_media_s: number
          executados: number
          falhos: number
          jobid: number
          jobname: string
          pendentes: number
          schedule: string
          ultima_execucao: string
          ultimo_erro: string
          ultimo_status: string
        }[]
      }
      founder_retencao_coortes: {
        Args: { p_semanas?: number }
        Returns: {
          ate_d7: number
          coorte: string
          d1: number
          d30: number
          d7: number
          tamanho: number
        }[]
      }
      founder_sessoes_calc: {
        Args: { p_fim: string; p_ini: string }
        Returns: {
          duracao_s: number
          eventos_ativos: number
          fim: string
          inicio: string
          sessao_id: string
          telas: number
          user_id: string
        }[]
      }
      founder_storage_status: {
        Args: { p_dias?: number }
        Returns: {
          bucket: string
          bytes: number
          novos_no_periodo: number
          objetos: number
          publico: boolean
        }[]
      }
      founder_tempo_por_feature: {
        Args: { p_fim: string; p_ini: string }
        Returns: {
          acessos: number
          concluidos: number
          feature: string
          tempo_s: number
          usuarias: number
        }[]
      }
      hook_checar_convite_cadastro: { Args: { event: Json }; Returns: Json }
      incrementar_ia_uso: {
        Args: {
          p_feature: string
          p_limite: number
          p_periodo: string
          p_user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      parse_primeiro_numero: { Args: { p: string }; Returns: number }
      publicar_artigos_comunidade_agendados: { Args: never; Returns: undefined }
      publish_due_posts: { Args: never; Returns: undefined }
      registrar_venda_cliente: {
        Args: { p_cliente_id: string }
        Returns: string
      }
    }
    Enums: {
      social_status:
        | "rascunho"
        | "revisado"
        | "aprovado"
        | "agendado"
        | "publicando"
        | "publicado"
        | "falhou"
        | "cancelado"
      social_tipo: "feed" | "carrossel" | "reel" | "story"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      social_status: [
        "rascunho",
        "revisado",
        "aprovado",
        "agendado",
        "publicando",
        "publicado",
        "falhou",
        "cancelado",
      ],
      social_tipo: ["feed", "carrossel", "reel", "story"],
    },
  },
} as const
