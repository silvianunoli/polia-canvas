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
          admin_id: string
          alvo: string | null
          criado_em: string
          detalhes: Json
          id: string
        }
        Insert: {
          acao: string
          admin_id: string
          alvo?: string | null
          criado_em?: string
          detalhes?: Json
          id?: string
        }
        Update: {
          acao?: string
          admin_id?: string
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
      conquistas: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          tipo: string | null
          titulo: string
          user_id: string
          xp: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string | null
          titulo: string
          user_id: string
          xp?: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string | null
          titulo?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
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
      dm_conversas: {
        Row: {
          comment_id: string | null
          criado_em: string
          erro: string | null
          estado: string
          gatilho_id: string | null
          id: string
          ig_user_id: string
          log: Json
          ultima_msg_em: string | null
        }
        Insert: {
          comment_id?: string | null
          criado_em?: string
          erro?: string | null
          estado?: string
          gatilho_id?: string | null
          id?: string
          ig_user_id: string
          log?: Json
          ultima_msg_em?: string | null
        }
        Update: {
          comment_id?: string | null
          criado_em?: string
          erro?: string | null
          estado?: string
          gatilho_id?: string | null
          id?: string
          ig_user_id?: string
          log?: Json
          ultima_msg_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_conversas_gatilho_id_fkey"
            columns: ["gatilho_id"]
            isOneToOne: false
            referencedRelation: "dm_gatilhos"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_gatilhos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          max_por_dia: number
          palavra: string
          post_ig_id: string | null
          resposta: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          max_por_dia?: number
          palavra: string
          post_ig_id?: string | null
          resposta: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          max_por_dia?: number
          palavra?: string
          post_ig_id?: string | null
          resposta?: string
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
      etapa1_entregavel: {
        Row: {
          bio_curta: string | null
          created_at: string
          gerado_em: string
          id: string
          publico_alvo: string | null
          transformacao: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio_curta?: string | null
          created_at?: string
          gerado_em?: string
          id?: string
          publico_alvo?: string | null
          transformacao?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio_curta?: string | null
          created_at?: string
          gerado_em?: string
          id?: string
          publico_alvo?: string | null
          transformacao?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      etapa1_respostas: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          pergunta_1: string | null
          pergunta_2: string | null
          pergunta_3: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          pergunta_1?: string | null
          pergunta_2?: string | null
          pergunta_3?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          pergunta_1?: string | null
          pergunta_2?: string | null
          pergunta_3?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
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
      integracao_instagram: {
        Row: {
          access_token: string | null
          atualizado_em: string
          expira_em: string | null
          id: number
          ig_user_id: string | null
        }
        Insert: {
          access_token?: string | null
          atualizado_em?: string
          expira_em?: string | null
          id?: number
          ig_user_id?: string | null
        }
        Update: {
          access_token?: string | null
          atualizado_em?: string
          expira_em?: string | null
          id?: number
          ig_user_id?: string | null
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
      social_geracoes: {
        Row: {
          acao: string | null
          criado_em: string
          id: string
          modelo: string | null
          post_id: string | null
          tokens_in: number | null
          tokens_out: number | null
          veredito_revisora: string | null
        }
        Insert: {
          acao?: string | null
          criado_em?: string
          id?: string
          modelo?: string | null
          post_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          veredito_revisora?: string | null
        }
        Update: {
          acao?: string | null
          criado_em?: string
          id?: string
          modelo?: string | null
          post_id?: string | null
          tokens_in?: number | null
          tokens_out?: number | null
          veredito_revisora?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_geracoes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_lotes: {
        Row: {
          criado_em: string
          custo_estimado_tokens: number | null
          id: string
          modo: string
          origem: string
          quantidade: number
          status: string
          tema: string | null
          tipo: Database["public"]["Enums"]["social_tipo"]
        }
        Insert: {
          criado_em?: string
          custo_estimado_tokens?: number | null
          id?: string
          modo: string
          origem: string
          quantidade: number
          status?: string
          tema?: string | null
          tipo: Database["public"]["Enums"]["social_tipo"]
        }
        Update: {
          criado_em?: string
          custo_estimado_tokens?: number | null
          id?: string
          modo?: string
          origem?: string
          quantidade?: number
          status?: string
          tema?: string | null
          tipo?: Database["public"]["Enums"]["social_tipo"]
        }
        Relationships: []
      }
      social_metricas: {
        Row: {
          comments: number | null
          dia: string
          follows: number | null
          likes: number | null
          post_id: string
          reach: number | null
          saves: number | null
          shares: number | null
        }
        Insert: {
          comments?: number | null
          dia: string
          follows?: number | null
          likes?: number | null
          post_id: string
          reach?: number | null
          saves?: number | null
          shares?: number | null
        }
        Update: {
          comments?: number | null
          dia?: string
          follows?: number | null
          likes?: number | null
          post_id?: string
          reach?: number | null
          saves?: number | null
          shares?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_metricas_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_pauta: {
        Row: {
          cta: string
          dia: string
          estrutura: string | null
          formato: Database["public"]["Enums"]["social_tipo"]
          gancho: string
          id: string
          pilar: string | null
          post_id: string | null
          semana: string
          status: string
        }
        Insert: {
          cta: string
          dia: string
          estrutura?: string | null
          formato: Database["public"]["Enums"]["social_tipo"]
          gancho: string
          id?: string
          pilar?: string | null
          post_id?: string | null
          semana: string
          status?: string
        }
        Update: {
          cta?: string
          dia?: string
          estrutura?: string | null
          formato?: Database["public"]["Enums"]["social_tipo"]
          gancho?: string
          id?: string
          pilar?: string | null
          post_id?: string | null
          semana?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_pauta_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          alt_text: string[] | null
          aprovado_em: string | null
          aprovado_por: string | null
          caption: string
          created_at: string
          erro: string | null
          gancho: string
          id: string
          ig_media_id: string | null
          legenda_por_ia: boolean
          lote_id: string | null
          midias: string[]
          origem_criacao: string
          permalink: string | null
          pilar: string | null
          scheduled_at: string | null
          slides: Json | null
          status: Database["public"]["Enums"]["social_status"]
          tipo: Database["public"]["Enums"]["social_tipo"]
          versoes: Json
        }
        Insert: {
          alt_text?: string[] | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          caption: string
          created_at?: string
          erro?: string | null
          gancho: string
          id?: string
          ig_media_id?: string | null
          legenda_por_ia?: boolean
          lote_id?: string | null
          midias: string[]
          origem_criacao?: string
          permalink?: string | null
          pilar?: string | null
          scheduled_at?: string | null
          slides?: Json | null
          status?: Database["public"]["Enums"]["social_status"]
          tipo: Database["public"]["Enums"]["social_tipo"]
          versoes?: Json
        }
        Update: {
          alt_text?: string[] | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          caption?: string
          created_at?: string
          erro?: string | null
          gancho?: string
          id?: string
          ig_media_id?: string | null
          legenda_por_ia?: boolean
          lote_id?: string | null
          midias?: string[]
          origem_criacao?: string
          permalink?: string | null
          pilar?: string | null
          scheduled_at?: string | null
          slides?: Json | null
          status?: Database["public"]["Enums"]["social_status"]
          tipo?: Database["public"]["Enums"]["social_tipo"]
          versoes?: Json
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "social_lotes"
            referencedColumns: ["id"]
          },
        ]
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
      user_profile: {
        Row: {
          created_at: string
          id: string
          nome_negocio: string | null
          segmento: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome_negocio?: string | null
          segmento?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nome_negocio?: string | null
          segmento?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          created_at: string
          etapa_atual: number
          etapa_status: Json
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          etapa_atual?: number
          etapa_status?: Json
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          etapa_atual?: number
          etapa_status?: Json
          id?: string
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
      disparar_raiox_mensal: { Args: never; Returns: undefined }
      disparar_social_metricas: { Args: never; Returns: undefined }
      disparar_social_publisher: { Args: never; Returns: undefined }
      disparar_social_token_renovar: { Args: never; Returns: undefined }
      estornar_ia_uso: {
        Args: { p_feature: string; p_periodo: string; p_user_id: string }
        Returns: undefined
      }
      excluir_dados_do_usuario: { Args: never; Returns: undefined }
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
      pegar_e_travar_posts_agendados: {
        Args: never
        Returns: {
          alt_text: string[] | null
          aprovado_em: string | null
          aprovado_por: string | null
          caption: string
          created_at: string
          erro: string | null
          gancho: string
          id: string
          ig_media_id: string | null
          legenda_por_ia: boolean
          lote_id: string | null
          midias: string[]
          origem_criacao: string
          permalink: string | null
          pilar: string | null
          scheduled_at: string | null
          slides: Json | null
          status: Database["public"]["Enums"]["social_status"]
          tipo: Database["public"]["Enums"]["social_tipo"]
          versoes: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "social_posts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
