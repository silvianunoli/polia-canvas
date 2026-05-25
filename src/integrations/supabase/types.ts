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
      profiles: {
        Row: {
          brand_feeling: string | null
          brand_visual_style: string | null
          brand_voice: string | null
          business_name: string | null
          business_stage: string | null
          business_type: string | null
          business_why: string | null
          competitors: string | null
          created_at: string
          differentiators: string | null
          display_name: string | null
          etapa_atual: number
          full_name: string | null
          id: string
          mini_pitch: string | null
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          orbit_brand_alive_unlocked: boolean
          orbit_marca_viva_unlocked: boolean
          positioning_statement: string | null
          problem_solved: string | null
          problem_urgency: string | null
          profile_story: string | null
          star_1_completed_at: string | null
          star_2_completed_at: string | null
          star_3_completed_at: string | null
          streak: number
          target_customer: string | null
          updated_at: string
        }
        Insert: {
          brand_feeling?: string | null
          brand_visual_style?: string | null
          brand_voice?: string | null
          business_name?: string | null
          business_stage?: string | null
          business_type?: string | null
          business_why?: string | null
          competitors?: string | null
          created_at?: string
          differentiators?: string | null
          display_name?: string | null
          etapa_atual?: number
          full_name?: string | null
          id: string
          mini_pitch?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          orbit_brand_alive_unlocked?: boolean
          orbit_marca_viva_unlocked?: boolean
          positioning_statement?: string | null
          problem_solved?: string | null
          problem_urgency?: string | null
          profile_story?: string | null
          star_1_completed_at?: string | null
          star_2_completed_at?: string | null
          star_3_completed_at?: string | null
          streak?: number
          target_customer?: string | null
          updated_at?: string
        }
        Update: {
          brand_feeling?: string | null
          brand_visual_style?: string | null
          brand_voice?: string | null
          business_name?: string | null
          business_stage?: string | null
          business_type?: string | null
          business_why?: string | null
          competitors?: string | null
          created_at?: string
          differentiators?: string | null
          display_name?: string | null
          etapa_atual?: number
          full_name?: string | null
          id?: string
          mini_pitch?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          orbit_brand_alive_unlocked?: boolean
          orbit_marca_viva_unlocked?: boolean
          positioning_statement?: string | null
          problem_solved?: string | null
          problem_urgency?: string | null
          profile_story?: string | null
          star_1_completed_at?: string | null
          star_2_completed_at?: string | null
          star_3_completed_at?: string | null
          streak?: number
          target_customer?: string | null
          updated_at?: string
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
