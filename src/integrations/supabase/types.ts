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
      checkins: {
        Row: {
          agua_litros: number | null
          alimentacao: number | null
          created_at: string
          data: string
          energia: number | null
          estresse: number | null
          exercicio: boolean | null
          humor: number | null
          id: string
          intencao: string | null
          nota: string | null
          sono_horas: number | null
          updated_at: string
          user_id: string
          vitoria: string | null
        }
        Insert: {
          agua_litros?: number | null
          alimentacao?: number | null
          created_at?: string
          data?: string
          energia?: number | null
          estresse?: number | null
          exercicio?: boolean | null
          humor?: number | null
          id?: string
          intencao?: string | null
          nota?: string | null
          sono_horas?: number | null
          updated_at?: string
          user_id: string
          vitoria?: string | null
        }
        Update: {
          agua_litros?: number | null
          alimentacao?: number | null
          created_at?: string
          data?: string
          energia?: number | null
          estresse?: number | null
          exercicio?: boolean | null
          humor?: number | null
          id?: string
          intencao?: string | null
          nota?: string | null
          sono_horas?: number | null
          updated_at?: string
          user_id?: string
          vitoria?: string | null
        }
        Relationships: []
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
      coach_insights: {
        Row: {
          conteudo: string
          contexto: string
          created_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          conteudo: string
          contexto: string
          created_at?: string
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          conteudo?: string
          contexto?: string
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_mensagens: {
        Row: {
          conteudo: string
          created_at: string
          id: string
          papel: string
          user_id: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          id?: string
          papel: string
          user_id: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          id?: string
          papel?: string
          user_id?: string
        }
        Relationships: []
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
      equipe_membros: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          papel: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          papel?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          papel?: string
          status?: string
          updated_at?: string
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
      foco_sessoes: {
        Row: {
          concluida: boolean
          created_at: string
          duracao_min: number
          id: string
          meta_id: string | null
          modo: string | null
          nota: string | null
          rotulo: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          concluida?: boolean
          created_at?: string
          duracao_min: number
          id?: string
          meta_id?: string | null
          modo?: string | null
          nota?: string | null
          rotulo?: string | null
          tipo?: string
          user_id: string
        }
        Update: {
          concluida?: boolean
          created_at?: string
          duracao_min?: number
          id?: string
          meta_id?: string | null
          modo?: string | null
          nota?: string | null
          rotulo?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "foco_sessoes_meta_id_fkey"
            columns: ["meta_id"]
            isOneToOne: false
            referencedRelation: "metas"
            referencedColumns: ["id"]
          },
        ]
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
      habito_logs: {
        Row: {
          created_at: string
          data: string
          habito_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: string
          habito_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: string
          habito_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habito_logs_habito_id_fkey"
            columns: ["habito_id"]
            isOneToOne: false
            referencedRelation: "habitos"
            referencedColumns: ["id"]
          },
        ]
      }
      habitos: {
        Row: {
          ativo: boolean
          categoria: string | null
          cor: string | null
          created_at: string
          emoji: string | null
          id: string
          nome: string
          ordem: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          cor?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          cor?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
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
          problem_solved: string | null
          problem_urgency: string | null
          product_description: string | null
          product_finalized_at: string | null
          production_capacity: string | null
          profile_story: string | null
          publishing_rhythm: string | null
          purchase_path: string | null
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
          problem_solved?: string | null
          problem_urgency?: string | null
          product_description?: string | null
          product_finalized_at?: string | null
          production_capacity?: string | null
          profile_story?: string | null
          publishing_rhythm?: string | null
          purchase_path?: string | null
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
          problem_solved?: string | null
          problem_urgency?: string | null
          product_description?: string | null
          product_finalized_at?: string | null
          production_capacity?: string | null
          profile_story?: string | null
          publishing_rhythm?: string | null
          purchase_path?: string | null
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
          assigned_to: string | null
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
          assigned_to?: string | null
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
          assigned_to?: string | null
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
            foreignKeyName: "tarefas_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "equipe_membros"
            referencedColumns: ["id"]
          },
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
      bytea_to_text: { Args: { data: string }; Returns: string }
      checar_taxa_erro_e_alertar: { Args: never; Returns: undefined }
      checar_uptimerobot_e_alertar: { Args: never; Returns: undefined }
      compor_nota_presenca: { Args: { p_uid: string }; Returns: undefined }
      excluir_dados_do_usuario: { Args: never; Returns: undefined }
      hook_checar_convite_cadastro: { Args: { event: Json }; Returns: Json }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      parse_primeiro_numero: { Args: { p: string }; Returns: number }
      publish_due_posts: { Args: never; Returns: undefined }
      registrar_venda_cliente: {
        Args: { p_cliente_id: string }
        Returns: string
      }
      text_to_bytea: { Args: { data: string }; Returns: string }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
    Enums: {},
  },
} as const
