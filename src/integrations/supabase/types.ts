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
      profiles: {
        Row: {
          action_triggers: string | null
          audience_content_types: string | null
          awareness_source: string | null
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
          differentiators: string | null
          display_name: string | null
          etapa_atual: number
          full_name: string | null
          growth_finalized_at: string | null
          growth_vision: string | null
          id: string
          issue_handling: string | null
          jornada_completed_at: string | null
          key_number_1: string | null
          key_partners: string | null
          loyalty_strategy: string | null
          main_channel: string | null
          mini_pitch: string | null
          network_finalized_at: string | null
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          orbit_brand_alive_unlocked: boolean
          orbit_financial_active: boolean
          orbit_financial_unlocked: boolean
          orbit_marca_viva_unlocked: boolean
          orbit_sales_active: boolean
          orbit_sales_unlocked: boolean
          orbit_vitrine_active: boolean
          orbit_vitrine_unlocked: boolean
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
          differentiators?: string | null
          display_name?: string | null
          etapa_atual?: number
          full_name?: string | null
          growth_finalized_at?: string | null
          growth_vision?: string | null
          id: string
          issue_handling?: string | null
          jornada_completed_at?: string | null
          key_number_1?: string | null
          key_partners?: string | null
          loyalty_strategy?: string | null
          main_channel?: string | null
          mini_pitch?: string | null
          network_finalized_at?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          orbit_brand_alive_unlocked?: boolean
          orbit_financial_active?: boolean
          orbit_financial_unlocked?: boolean
          orbit_marca_viva_unlocked?: boolean
          orbit_sales_active?: boolean
          orbit_sales_unlocked?: boolean
          orbit_vitrine_active?: boolean
          orbit_vitrine_unlocked?: boolean
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
          differentiators?: string | null
          display_name?: string | null
          etapa_atual?: number
          full_name?: string | null
          growth_finalized_at?: string | null
          growth_vision?: string | null
          id?: string
          issue_handling?: string | null
          jornada_completed_at?: string | null
          key_number_1?: string | null
          key_partners?: string | null
          loyalty_strategy?: string | null
          main_channel?: string | null
          mini_pitch?: string | null
          network_finalized_at?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          orbit_brand_alive_unlocked?: boolean
          orbit_financial_active?: boolean
          orbit_financial_unlocked?: boolean
          orbit_marca_viva_unlocked?: boolean
          orbit_sales_active?: boolean
          orbit_sales_unlocked?: boolean
          orbit_vitrine_active?: boolean
          orbit_vitrine_unlocked?: boolean
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
      tarefas: {
        Row: {
          created_at: string
          descricao: string | null
          etapa: number | null
          fonte: string
          id: string
          status: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          etapa?: number | null
          fonte?: string
          id?: string
          status?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          etapa?: number | null
          fonte?: string
          id?: string
          status?: string
          titulo?: string
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
