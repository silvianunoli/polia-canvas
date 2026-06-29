export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      blog_posts: {
        Row: {
          categoria: string | null;
          conteudo_md: string | null;
          created_at: string;
          id: string;
          publicado: boolean;
          publicado_em: string | null;
          resumo: string | null;
          slug: string;
          titulo: string;
          updated_at: string;
        };
        Insert: {
          categoria?: string | null;
          conteudo_md?: string | null;
          created_at?: string;
          id?: string;
          publicado?: boolean;
          publicado_em?: string | null;
          resumo?: string | null;
          slug: string;
          titulo: string;
          updated_at?: string;
        };
        Update: {
          categoria?: string | null;
          conteudo_md?: string | null;
          created_at?: string;
          id?: string;
          publicado?: boolean;
          publicado_em?: string | null;
          resumo?: string | null;
          slug?: string;
          titulo?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      checkins: {
        Row: {
          agua_litros: number | null;
          alimentacao: number | null;
          created_at: string;
          data: string;
          energia: number | null;
          estresse: number | null;
          exercicio: boolean | null;
          humor: number | null;
          id: string;
          intencao: string | null;
          nota: string | null;
          sono_horas: number | null;
          updated_at: string;
          user_id: string;
          vitoria: string | null;
        };
        Insert: {
          agua_litros?: number | null;
          alimentacao?: number | null;
          created_at?: string;
          data?: string;
          energia?: number | null;
          estresse?: number | null;
          exercicio?: boolean | null;
          humor?: number | null;
          id?: string;
          intencao?: string | null;
          nota?: string | null;
          sono_horas?: number | null;
          updated_at?: string;
          user_id: string;
          vitoria?: string | null;
        };
        Update: {
          agua_litros?: number | null;
          alimentacao?: number | null;
          created_at?: string;
          data?: string;
          energia?: number | null;
          estresse?: number | null;
          exercicio?: boolean | null;
          humor?: number | null;
          id?: string;
          intencao?: string | null;
          nota?: string | null;
          sono_horas?: number | null;
          updated_at?: string;
          user_id?: string;
          vitoria?: string | null;
        };
        Relationships: [];
      };
      clientes: {
        Row: {
          contato: string | null;
          created_at: string;
          id: string;
          nome: string;
          notas: string | null;
          status_pedido: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          contato?: string | null;
          created_at?: string;
          id?: string;
          nome: string;
          notas?: string | null;
          status_pedido?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          contato?: string | null;
          created_at?: string;
          id?: string;
          nome?: string;
          notas?: string | null;
          status_pedido?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      coach_insights: {
        Row: {
          conteudo: string;
          contexto: string;
          created_at: string;
          expires_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          conteudo: string;
          contexto: string;
          created_at?: string;
          expires_at: string;
          id?: string;
          user_id: string;
        };
        Update: {
          conteudo?: string;
          contexto?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      coach_mensagens: {
        Row: {
          conteudo: string;
          created_at: string;
          id: string;
          papel: string;
          user_id: string;
        };
        Insert: {
          conteudo: string;
          created_at?: string;
          id?: string;
          papel: string;
          user_id: string;
        };
        Update: {
          conteudo?: string;
          created_at?: string;
          id?: string;
          papel?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      conquistas: {
        Row: {
          created_at: string;
          descricao: string | null;
          id: string;
          tipo: string | null;
          titulo: string;
          user_id: string;
          xp: number;
        };
        Insert: {
          created_at?: string;
          descricao?: string | null;
          id?: string;
          tipo?: string | null;
          titulo: string;
          user_id: string;
          xp?: number;
        };
        Update: {
          created_at?: string;
          descricao?: string | null;
          id?: string;
          tipo?: string | null;
          titulo?: string;
          user_id?: string;
          xp?: number;
        };
        Relationships: [];
      };
      contatos: {
        Row: {
          assunto: string;
          created_at: string;
          email: string;
          id: string;
          mensagem: string;
          nome: string;
        };
        Insert: {
          assunto: string;
          created_at?: string;
          email: string;
          id?: string;
          mensagem: string;
          nome: string;
        };
        Update: {
          assunto?: string;
          created_at?: string;
          email?: string;
          id?: string;
          mensagem?: string;
          nome?: string;
        };
        Relationships: [];
      };
      edge_function_logs: {
        Row: {
          created_at: string;
          error_message: string | null;
          function_name: string;
          id: string;
          latency_ms: number | null;
          status: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          function_name: string;
          id?: string;
          latency_ms?: number | null;
          status: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          function_name?: string;
          id?: string;
          latency_ms?: number | null;
          status?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      equipe_membros: {
        Row: {
          created_at: string;
          email: string | null;
          id: string;
          nome: string;
          papel: string;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          id?: string;
          nome: string;
          papel?: string;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          id?: string;
          nome?: string;
          papel?: string;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      entregaveis: {
        Row: {
          conteudo: Json | null;
          created_at: string;
          etapa: number;
          fase: string;
          id: string;
          status: string;
          tipo: string;
          titulo: string;
          user_id: string;
        };
        Insert: {
          conteudo?: Json | null;
          created_at?: string;
          etapa: number;
          fase: string;
          id?: string;
          status?: string;
          tipo: string;
          titulo: string;
          user_id: string;
        };
        Update: {
          conteudo?: Json | null;
          created_at?: string;
          etapa?: number;
          fase?: string;
          id?: string;
          status?: string;
          tipo?: string;
          titulo?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      etapa1_entregavel: {
        Row: {
          bio_curta: string | null;
          created_at: string;
          gerado_em: string;
          id: string;
          publico_alvo: string | null;
          transformacao: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bio_curta?: string | null;
          created_at?: string;
          gerado_em?: string;
          id?: string;
          publico_alvo?: string | null;
          transformacao?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bio_curta?: string | null;
          created_at?: string;
          gerado_em?: string;
          id?: string;
          publico_alvo?: string | null;
          transformacao?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      etapa1_respostas: {
        Row: {
          completed_at: string | null;
          created_at: string;
          id: string;
          pergunta_1: string | null;
          pergunta_2: string | null;
          pergunta_3: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          pergunta_1?: string | null;
          pergunta_2?: string | null;
          pergunta_3?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          pergunta_1?: string | null;
          pergunta_2?: string | null;
          pergunta_3?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      feature_flags: {
        Row: {
          description: string | null;
          enabled: boolean;
          id: string;
          key: string;
          updated_at: string;
        };
        Insert: {
          description?: string | null;
          enabled?: boolean;
          id?: string;
          key: string;
          updated_at?: string;
        };
        Update: {
          description?: string | null;
          enabled?: boolean;
          id?: string;
          key?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      feedback_responses: {
        Row: {
          comment: string | null;
          context_ref: string;
          created_at: string;
          id: string;
          score: number;
          trigger_type: string;
          user_id: string;
        };
        Insert: {
          comment?: string | null;
          context_ref: string;
          created_at?: string;
          id?: string;
          score: number;
          trigger_type: string;
          user_id: string;
        };
        Update: {
          comment?: string | null;
          context_ref?: string;
          created_at?: string;
          id?: string;
          score?: number;
          trigger_type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      financeiro_mensal: {
        Row: {
          ano: number;
          created_at: string;
          id: string;
          mes: number;
          meta: number;
          receita: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ano: number;
          created_at?: string;
          id?: string;
          mes: number;
          meta?: number;
          receita?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ano?: number;
          created_at?: string;
          id?: string;
          mes?: number;
          meta?: number;
          receita?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      foco_sessoes: {
        Row: {
          concluida: boolean;
          created_at: string;
          duracao_min: number;
          id: string;
          meta_id: string | null;
          modo: string | null;
          nota: string | null;
          rotulo: string | null;
          tipo: string;
          user_id: string;
        };
        Insert: {
          concluida?: boolean;
          created_at?: string;
          duracao_min: number;
          id?: string;
          meta_id?: string | null;
          modo?: string | null;
          nota?: string | null;
          rotulo?: string | null;
          tipo?: string;
          user_id: string;
        };
        Update: {
          concluida?: boolean;
          created_at?: string;
          duracao_min?: number;
          id?: string;
          meta_id?: string | null;
          modo?: string | null;
          nota?: string | null;
          rotulo?: string | null;
          tipo?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "foco_sessoes_meta_id_fkey";
            columns: ["meta_id"];
            isOneToOne: false;
            referencedRelation: "metas";
            referencedColumns: ["id"];
          },
        ];
      };
      habito_logs: {
        Row: {
          created_at: string;
          data: string;
          habito_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          data?: string;
          habito_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          data?: string;
          habito_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habito_logs_habito_id_fkey";
            columns: ["habito_id"];
            isOneToOne: false;
            referencedRelation: "habitos";
            referencedColumns: ["id"];
          },
        ];
      };
      habitos: {
        Row: {
          ativo: boolean;
          categoria: string | null;
          cor: string | null;
          created_at: string;
          emoji: string | null;
          id: string;
          nome: string;
          ordem: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ativo?: boolean;
          categoria?: string | null;
          cor?: string | null;
          created_at?: string;
          emoji?: string | null;
          id?: string;
          nome: string;
          ordem?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ativo?: boolean;
          categoria?: string | null;
          cor?: string | null;
          created_at?: string;
          emoji?: string | null;
          id?: string;
          nome?: string;
          ordem?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lista_espera: {
        Row: {
          criado_em: string;
          email: string;
          id: string;
          nome: string;
          tipo_negocio: string | null;
        };
        Insert: {
          criado_em?: string;
          email: string;
          id?: string;
          nome: string;
          tipo_negocio?: string | null;
        };
        Update: {
          criado_em?: string;
          email?: string;
          id?: string;
          nome?: string;
          tipo_negocio?: string | null;
        };
        Relationships: [];
      };
      metas: {
        Row: {
          concluida_em: string | null;
          created_at: string;
          descricao: string | null;
          id: string;
          prazo: string | null;
          progresso: number;
          status: string;
          titulo: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          concluida_em?: string | null;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          prazo?: string | null;
          progresso?: number;
          status?: string;
          titulo: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          concluida_em?: string | null;
          created_at?: string;
          descricao?: string | null;
          id?: string;
          prazo?: string | null;
          progresso?: number;
          status?: string;
          titulo?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      notas: {
        Row: {
          arquivada: boolean;
          conteudo: string;
          created_at: string;
          deleted_at: string | null;
          fixada: boolean;
          id: string;
          titulo: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          arquivada?: boolean;
          conteudo?: string;
          created_at?: string;
          deleted_at?: string | null;
          fixada?: boolean;
          id?: string;
          titulo?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          arquivada?: boolean;
          conteudo?: string;
          created_at?: string;
          deleted_at?: string | null;
          fixada?: boolean;
          id?: string;
          titulo?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          action_triggers: string | null;
          audience_content_types: string | null;
          awareness_source: string | null;
          brand_feeling: string | null;
          brand_visual_style: string | null;
          brand_voice: string | null;
          brand_voice_finalized_at: string | null;
          brand_voice_yes: string | null;
          business_name: string | null;
          business_stage: string | null;
          business_type: string | null;
          business_why: string | null;
          care_finalized_at: string | null;
          closing_method: string | null;
          competitors: string | null;
          content_finalized_at: string | null;
          created_at: string;
          decision_trigger: string | null;
          delivery_method: string | null;
          differentiators: string | null;
          display_name: string | null;
          etapa_atual: number;
          full_name: string | null;
          growth_finalized_at: string | null;
          growth_vision: string | null;
          id: string;
          is_admin: boolean;
          issue_handling: string | null;
          jornada_completed_at: string | null;
          key_number_1: string | null;
          key_partners: string | null;
          loyalty_strategy: string | null;
          main_channel: string | null;
          mini_pitch: string | null;
          network_finalized_at: string | null;
          notif_dicas: boolean;
          notif_novidades: boolean;
          notif_resumo_semanal: boolean;
          onboarding_completed: boolean;
          onboarding_completed_at: string | null;
          orbit_brand_alive_unlocked: boolean;
          orbit_financial_active: boolean;
          orbit_financial_unlocked: boolean;
          orbit_marca_viva_unlocked: boolean;
          orbit_sales_active: boolean;
          orbit_sales_unlocked: boolean;
          orbit_vitrine_active: boolean;
          orbit_vitrine_unlocked: boolean;
          plano: string;
          positioning_finalized_at: string | null;
          positioning_statement: string | null;
          presence_finalized_at: string | null;
          price_range: string | null;
          problem_solved: string | null;
          problem_urgency: string | null;
          product_description: string | null;
          product_finalized_at: string | null;
          production_capacity: string | null;
          profile_story: string | null;
          publishing_rhythm: string | null;
          purchase_path: string | null;
          restock_triggers: string | null;
          review_rhythm: string | null;
          routine_finalized_at: string | null;
          sales_finalized_at: string | null;
          scroll_stoppers: string | null;
          star_1_completed_at: string | null;
          star_10_completed_at: string | null;
          star_11_completed_at: string | null;
          star_2_completed_at: string | null;
          star_3_completed_at: string | null;
          star_4_completed_at: string | null;
          star_5_completed_at: string | null;
          star_6_completed_at: string | null;
          star_7_completed_at: string | null;
          star_8_completed_at: string | null;
          star_9_completed_at: string | null;
          streak: number;
          target_customer: string | null;
          timeline_goal: string | null;
          tracking_system: string | null;
          updated_at: string;
          visual_presence: string | null;
          welcome_protocol: string | null;
        };
        Insert: {
          action_triggers?: string | null;
          audience_content_types?: string | null;
          awareness_source?: string | null;
          brand_feeling?: string | null;
          brand_visual_style?: string | null;
          brand_voice?: string | null;
          brand_voice_finalized_at?: string | null;
          brand_voice_yes?: string | null;
          business_name?: string | null;
          business_stage?: string | null;
          business_type?: string | null;
          business_why?: string | null;
          care_finalized_at?: string | null;
          closing_method?: string | null;
          competitors?: string | null;
          content_finalized_at?: string | null;
          created_at?: string;
          decision_trigger?: string | null;
          delivery_method?: string | null;
          differentiators?: string | null;
          display_name?: string | null;
          etapa_atual?: number;
          full_name?: string | null;
          growth_finalized_at?: string | null;
          growth_vision?: string | null;
          id: string;
          is_admin?: boolean;
          issue_handling?: string | null;
          jornada_completed_at?: string | null;
          key_number_1?: string | null;
          key_partners?: string | null;
          loyalty_strategy?: string | null;
          main_channel?: string | null;
          mini_pitch?: string | null;
          network_finalized_at?: string | null;
          notif_dicas?: boolean;
          notif_novidades?: boolean;
          notif_resumo_semanal?: boolean;
          onboarding_completed?: boolean;
          onboarding_completed_at?: string | null;
          orbit_brand_alive_unlocked?: boolean;
          orbit_financial_active?: boolean;
          orbit_financial_unlocked?: boolean;
          orbit_marca_viva_unlocked?: boolean;
          orbit_sales_active?: boolean;
          orbit_sales_unlocked?: boolean;
          orbit_vitrine_active?: boolean;
          orbit_vitrine_unlocked?: boolean;
          plano?: string;
          positioning_finalized_at?: string | null;
          positioning_statement?: string | null;
          presence_finalized_at?: string | null;
          price_range?: string | null;
          problem_solved?: string | null;
          problem_urgency?: string | null;
          product_description?: string | null;
          product_finalized_at?: string | null;
          production_capacity?: string | null;
          profile_story?: string | null;
          publishing_rhythm?: string | null;
          purchase_path?: string | null;
          restock_triggers?: string | null;
          review_rhythm?: string | null;
          routine_finalized_at?: string | null;
          sales_finalized_at?: string | null;
          scroll_stoppers?: string | null;
          star_1_completed_at?: string | null;
          star_10_completed_at?: string | null;
          star_11_completed_at?: string | null;
          star_2_completed_at?: string | null;
          star_3_completed_at?: string | null;
          star_4_completed_at?: string | null;
          star_5_completed_at?: string | null;
          star_6_completed_at?: string | null;
          star_7_completed_at?: string | null;
          star_8_completed_at?: string | null;
          star_9_completed_at?: string | null;
          streak?: number;
          target_customer?: string | null;
          timeline_goal?: string | null;
          tracking_system?: string | null;
          updated_at?: string;
          visual_presence?: string | null;
          welcome_protocol?: string | null;
        };
        Update: {
          action_triggers?: string | null;
          audience_content_types?: string | null;
          awareness_source?: string | null;
          brand_feeling?: string | null;
          brand_visual_style?: string | null;
          brand_voice?: string | null;
          brand_voice_finalized_at?: string | null;
          brand_voice_yes?: string | null;
          business_name?: string | null;
          business_stage?: string | null;
          business_type?: string | null;
          business_why?: string | null;
          care_finalized_at?: string | null;
          closing_method?: string | null;
          competitors?: string | null;
          content_finalized_at?: string | null;
          created_at?: string;
          decision_trigger?: string | null;
          delivery_method?: string | null;
          differentiators?: string | null;
          display_name?: string | null;
          etapa_atual?: number;
          full_name?: string | null;
          growth_finalized_at?: string | null;
          growth_vision?: string | null;
          id?: string;
          is_admin?: boolean;
          issue_handling?: string | null;
          jornada_completed_at?: string | null;
          key_number_1?: string | null;
          key_partners?: string | null;
          loyalty_strategy?: string | null;
          main_channel?: string | null;
          mini_pitch?: string | null;
          network_finalized_at?: string | null;
          notif_dicas?: boolean;
          notif_novidades?: boolean;
          notif_resumo_semanal?: boolean;
          onboarding_completed?: boolean;
          onboarding_completed_at?: string | null;
          orbit_brand_alive_unlocked?: boolean;
          orbit_financial_active?: boolean;
          orbit_financial_unlocked?: boolean;
          orbit_marca_viva_unlocked?: boolean;
          orbit_sales_active?: boolean;
          orbit_sales_unlocked?: boolean;
          orbit_vitrine_active?: boolean;
          orbit_vitrine_unlocked?: boolean;
          plano?: string;
          positioning_finalized_at?: string | null;
          positioning_statement?: string | null;
          presence_finalized_at?: string | null;
          price_range?: string | null;
          problem_solved?: string | null;
          problem_urgency?: string | null;
          product_description?: string | null;
          product_finalized_at?: string | null;
          production_capacity?: string | null;
          profile_story?: string | null;
          publishing_rhythm?: string | null;
          purchase_path?: string | null;
          restock_triggers?: string | null;
          review_rhythm?: string | null;
          routine_finalized_at?: string | null;
          sales_finalized_at?: string | null;
          scroll_stoppers?: string | null;
          star_1_completed_at?: string | null;
          star_10_completed_at?: string | null;
          star_11_completed_at?: string | null;
          star_2_completed_at?: string | null;
          star_3_completed_at?: string | null;
          star_4_completed_at?: string | null;
          star_5_completed_at?: string | null;
          star_6_completed_at?: string | null;
          star_7_completed_at?: string | null;
          star_8_completed_at?: string | null;
          star_9_completed_at?: string | null;
          streak?: number;
          target_customer?: string | null;
          timeline_goal?: string | null;
          tracking_system?: string | null;
          updated_at?: string;
          visual_presence?: string | null;
          welcome_protocol?: string | null;
        };
        Relationships: [];
      };
      quadros: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          ordem: number;
          slug: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          ordem?: number;
          slug: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          slug?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tarefas: {
        Row: {
          created_at: string;
          descricao: string | null;
          etapa: number | null;
          assigned_to: string | null;
          fonte: string;
          id: string;
          prazo: string | null;
          prioridade: string | null;
          quadro_id: string | null;
          status: string;
          titulo: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          descricao?: string | null;
          etapa?: number | null;
          assigned_to?: string | null;
          fonte?: string;
          id?: string;
          prazo?: string | null;
          prioridade?: string | null;
          quadro_id?: string | null;
          status?: string;
          titulo: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          descricao?: string | null;
          etapa?: number | null;
          assigned_to?: string | null;
          fonte?: string;
          id?: string;
          prazo?: string | null;
          prioridade?: string | null;
          quadro_id?: string | null;
          status?: string;
          titulo?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tarefas_quadro_id_fkey";
            columns: ["quadro_id"];
            isOneToOne: false;
            referencedRelation: "quadros";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_messages: {
        Row: {
          author_id: string;
          author_role: string;
          body: string;
          created_at: string;
          id: string;
          ticket_id: string;
        };
        Insert: {
          author_id: string;
          author_role: string;
          body: string;
          created_at?: string;
          id?: string;
          ticket_id: string;
        };
        Update: {
          author_id?: string;
          author_role?: string;
          body?: string;
          created_at?: string;
          id?: string;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          module_ref: string | null;
          priority: string;
          resolved_at: string | null;
          status: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          module_ref?: string | null;
          priority?: string;
          resolved_at?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          module_ref?: string | null;
          priority?: string;
          resolved_at?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_profile: {
        Row: {
          created_at: string;
          id: string;
          nome_negocio: string | null;
          segmento: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome_negocio?: string | null;
          segmento?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome_negocio?: string | null;
          segmento?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_progress: {
        Row: {
          created_at: string;
          etapa_atual: number;
          etapa_status: Json;
          id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          etapa_atual?: number;
          etapa_status?: Json;
          id?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          etapa_atual?: number;
          etapa_status?: Json;
          id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: { _uid: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
