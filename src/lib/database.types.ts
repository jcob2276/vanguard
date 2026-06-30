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
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string | null
          metadata: Json
          related_id: string | null
          related_table: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          metadata?: Json
          related_id?: string | null
          related_table?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          metadata?: Json
          related_id?: string | null
          related_table?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      aw_daily_summary: {
        Row: {
          categories: Json | null
          created_at: string | null
          date: string
          id: string
          phone_active_seconds: number | null
          phone_top_apps: Json | null
          productivity_ratio: number | null
          time_of_day: Json | null
          top_apps: Json | null
          total_active_seconds: number | null
          total_afk_seconds: number | null
          user_id: string
          web_domains: Json | null
        }
        Insert: {
          categories?: Json | null
          created_at?: string | null
          date: string
          id?: string
          phone_active_seconds?: number | null
          phone_top_apps?: Json | null
          productivity_ratio?: number | null
          time_of_day?: Json | null
          top_apps?: Json | null
          total_active_seconds?: number | null
          total_afk_seconds?: number | null
          user_id: string
          web_domains?: Json | null
        }
        Update: {
          categories?: Json | null
          created_at?: string | null
          date?: string
          id?: string
          phone_active_seconds?: number | null
          phone_top_apps?: Json | null
          productivity_ratio?: number | null
          time_of_day?: Json | null
          top_apps?: Json | null
          total_active_seconds?: number | null
          total_afk_seconds?: number | null
          user_id?: string
          web_domains?: Json | null
        }
        Relationships: []
      }
      behavior_log: {
        Row: {
          behavior_key: string
          created_at: string
          date: string
          id: string
          note: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          behavior_key: string
          created_at?: string
          date: string
          id?: string
          note?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          behavior_key?: string
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: []
      }
      body_composition_measurements: {
        Row: {
          bmi: number | null
          bmr_kcal: number | null
          body_fat_pct: number | null
          bone_mass_kg: number | null
          created_at: string
          extracellular_water_kg: number | null
          fat_free_mass_kg: number | null
          fat_mass_kg: number | null
          id: string
          intracellular_water_kg: number | null
          measured_at: string
          metabolic_age: number | null
          method: string
          muscle_mass_kg: number | null
          notes: string | null
          protein_kg: number | null
          raw: Json
          reliability: string
          source: string
          total_body_water_kg: number | null
          total_body_water_pct: number | null
          updated_at: string
          user_id: string
          visceral_fat_rating: number | null
          weight_kg: number | null
        }
        Insert: {
          bmi?: number | null
          bmr_kcal?: number | null
          body_fat_pct?: number | null
          bone_mass_kg?: number | null
          created_at?: string
          extracellular_water_kg?: number | null
          fat_free_mass_kg?: number | null
          fat_mass_kg?: number | null
          id?: string
          intracellular_water_kg?: number | null
          measured_at: string
          metabolic_age?: number | null
          method?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          protein_kg?: number | null
          raw?: Json
          reliability?: string
          source: string
          total_body_water_kg?: number | null
          total_body_water_pct?: number | null
          updated_at?: string
          user_id: string
          visceral_fat_rating?: number | null
          weight_kg?: number | null
        }
        Update: {
          bmi?: number | null
          bmr_kcal?: number | null
          body_fat_pct?: number | null
          bone_mass_kg?: number | null
          created_at?: string
          extracellular_water_kg?: number | null
          fat_free_mass_kg?: number | null
          fat_mass_kg?: number | null
          id?: string
          intracellular_water_kg?: number | null
          measured_at?: string
          metabolic_age?: number | null
          method?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          protein_kg?: number | null
          raw?: Json
          reliability?: string
          source?: string
          total_body_water_kg?: number | null
          total_body_water_pct?: number | null
          updated_at?: string
          user_id?: string
          visceral_fat_rating?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      body_metrics: {
        Row: {
          belly: number | null
          biceps_l: number | null
          biceps_r: number | null
          body_fat: number | null
          body_water: number | null
          bone_mass: number | null
          calf: number | null
          chest: number | null
          created_at: string | null
          date: string | null
          forearm: number | null
          hips: number | null
          id: string
          muscle_mass: number | null
          neck: number | null
          thigh: number | null
          user_id: string | null
          waist: number | null
          weight: number | null
          weight_italia: number | null
        }
        Insert: {
          belly?: number | null
          biceps_l?: number | null
          biceps_r?: number | null
          body_fat?: number | null
          body_water?: number | null
          bone_mass?: number | null
          calf?: number | null
          chest?: number | null
          created_at?: string | null
          date?: string | null
          forearm?: number | null
          hips?: number | null
          id?: string
          muscle_mass?: number | null
          neck?: number | null
          thigh?: number | null
          user_id?: string | null
          waist?: number | null
          weight?: number | null
          weight_italia?: number | null
        }
        Update: {
          belly?: number | null
          biceps_l?: number | null
          biceps_r?: number | null
          body_fat?: number | null
          body_water?: number | null
          bone_mass?: number | null
          calf?: number | null
          chest?: number | null
          created_at?: string | null
          date?: string | null
          forearm?: number | null
          hips?: number | null
          id?: string
          muscle_mass?: number | null
          neck?: number | null
          thigh?: number | null
          user_id?: string | null
          waist?: number | null
          weight?: number | null
          weight_italia?: number | null
        }
        Relationships: []
      }
      career_decisions: {
        Row: {
          area: string
          context: string | null
          created_at: string
          decided_at: string
          decision: string | null
          decision_type: string | null
          evidence_id: string | null
          expected_effect: string | null
          fear_or_risk: string | null
          id: string
          project_id: string | null
          result_summary: string | null
          review_date: string | null
          title: string
          tradeoff: string | null
          updated_at: string
          user_id: string
          verdict: string | null
        }
        Insert: {
          area?: string
          context?: string | null
          created_at?: string
          decided_at?: string
          decision?: string | null
          decision_type?: string | null
          evidence_id?: string | null
          expected_effect?: string | null
          fear_or_risk?: string | null
          id?: string
          project_id?: string | null
          result_summary?: string | null
          review_date?: string | null
          title: string
          tradeoff?: string | null
          updated_at?: string
          user_id: string
          verdict?: string | null
        }
        Update: {
          area?: string
          context?: string | null
          created_at?: string
          decided_at?: string
          decision?: string | null
          decision_type?: string | null
          evidence_id?: string | null
          expected_effect?: string | null
          fear_or_risk?: string | null
          id?: string
          project_id?: string | null
          result_summary?: string | null
          review_date?: string | null
          title?: string
          tradeoff?: string | null
          updated_at?: string
          user_id?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_decisions_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "career_evidence"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_decisions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "career_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      career_evidence: {
        Row: {
          created_at: string
          description: string | null
          external_ref: string | null
          id: string
          move_id: string | null
          occurred_at: string
          project_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_ref?: string | null
          id?: string
          move_id?: string | null
          occurred_at?: string
          project_id?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_ref?: string | null
          id?: string
          move_id?: string | null
          occurred_at?: string
          project_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "career_evidence_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "career_moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "career_evidence_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "career_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      career_moves: {
        Row: {
          area: string
          completed_at: string | null
          created_at: string
          energy_cost: string | null
          id: string
          notes: string | null
          planned_for: string | null
          project_id: string | null
          source: string
          status: string
          title: string
          updated_at: string
          user_id: string
          value_type: string | null
          work_mode: string | null
        }
        Insert: {
          area?: string
          completed_at?: string | null
          created_at?: string
          energy_cost?: string | null
          id?: string
          notes?: string | null
          planned_for?: string | null
          project_id?: string | null
          source?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
          value_type?: string | null
          work_mode?: string | null
        }
        Update: {
          area?: string
          completed_at?: string | null
          created_at?: string
          energy_cost?: string | null
          id?: string
          notes?: string | null
          planned_for?: string | null
          project_id?: string | null
          source?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          value_type?: string | null
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "career_moves_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "career_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      career_projects: {
        Row: {
          area: string
          cost_level: string | null
          created_at: string
          id: string
          last_reviewed_at: string | null
          leverage_level: number | null
          name: string
          review_cadence: string | null
          risk_level: string | null
          sense_status: string
          status: string
          thesis: string | null
          updated_at: string
          user_id: string
          why: string | null
        }
        Insert: {
          area?: string
          cost_level?: string | null
          created_at?: string
          id?: string
          last_reviewed_at?: string | null
          leverage_level?: number | null
          name: string
          review_cadence?: string | null
          risk_level?: string | null
          sense_status?: string
          status?: string
          thesis?: string | null
          updated_at?: string
          user_id: string
          why?: string | null
        }
        Update: {
          area?: string
          cost_level?: string | null
          created_at?: string
          id?: string
          last_reviewed_at?: string | null
          leverage_level?: number | null
          name?: string
          review_cadence?: string | null
          risk_level?: string | null
          sense_status?: string
          status?: string
          thesis?: string | null
          updated_at?: string
          user_id?: string
          why?: string | null
        }
        Relationships: []
      }
      daily_food_entries: {
        Row: {
          amount: string | null
          brand: string | null
          calories: number | null
          carbs: number | null
          created_at: string | null
          date: string
          fat: number | null
          fiber: number | null
          food_quality_score: number | null
          id: string
          insulin_load: number | null
          logged_at: string | null
          meal_group_id: string | null
          meal_type: string | null
          name: string
          parse_meta: Json | null
          protein: number | null
          quality_reason: string | null
          salt: number | null
          saturated_fat: number | null
          sugar: number | null
          user_id: string | null
        }
        Insert: {
          amount?: string | null
          brand?: string | null
          calories?: number | null
          carbs?: number | null
          created_at?: string | null
          date: string
          fat?: number | null
          fiber?: number | null
          food_quality_score?: number | null
          id?: string
          insulin_load?: number | null
          logged_at?: string | null
          meal_group_id?: string | null
          meal_type?: string | null
          name: string
          parse_meta?: Json | null
          protein?: number | null
          quality_reason?: string | null
          salt?: number | null
          saturated_fat?: number | null
          sugar?: number | null
          user_id?: string | null
        }
        Update: {
          amount?: string | null
          brand?: string | null
          calories?: number | null
          carbs?: number | null
          created_at?: string | null
          date?: string
          fat?: number | null
          fiber?: number | null
          food_quality_score?: number | null
          id?: string
          insulin_load?: number | null
          logged_at?: string | null
          meal_group_id?: string | null
          meal_type?: string | null
          name?: string
          parse_meta?: Json | null
          protein?: number | null
          quality_reason?: string | null
          salt?: number | null
          saturated_fat?: number | null
          sugar?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      daily_habits: {
        Row: {
          bar_hang: boolean | null
          child_pose: boolean | null
          chin_tucks: boolean | null
          couch_stretch: boolean | null
          created_at: string | null
          date: string | null
          glute_bridge: boolean | null
          id: string
          protein_170g: boolean | null
          user_id: string | null
        }
        Insert: {
          bar_hang?: boolean | null
          child_pose?: boolean | null
          chin_tucks?: boolean | null
          couch_stretch?: boolean | null
          created_at?: string | null
          date?: string | null
          glute_bridge?: boolean | null
          id?: string
          protein_170g?: boolean | null
          user_id?: string | null
        }
        Update: {
          bar_hang?: boolean | null
          child_pose?: boolean | null
          chin_tucks?: boolean | null
          couch_stretch?: boolean | null
          created_at?: string | null
          date?: string | null
          glute_bridge?: boolean | null
          id?: string
          protein_170g?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      daily_nutrition: {
        Row: {
          avg_food_quality: number | null
          calories: number | null
          carbs: number | null
          created_at: string | null
          date: string
          fat: number | null
          fiber: number | null
          food_quality_analysis: string | null
          id: string
          insulin_load: number | null
          protein: number | null
          sugar: number | null
          user_id: string | null
        }
        Insert: {
          avg_food_quality?: number | null
          calories?: number | null
          carbs?: number | null
          created_at?: string | null
          date: string
          fat?: number | null
          fiber?: number | null
          food_quality_analysis?: string | null
          id?: string
          insulin_load?: number | null
          protein?: number | null
          sugar?: number | null
          user_id?: string | null
        }
        Update: {
          avg_food_quality?: number | null
          calories?: number | null
          carbs?: number | null
          created_at?: string | null
          date?: string
          fat?: number | null
          fiber?: number | null
          food_quality_analysis?: string | null
          id?: string
          insulin_load?: number | null
          protein?: number | null
          sugar?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      daily_plan: {
        Row: {
          avoided_task: string | null
          created_at: string | null
          energy_level: number | null
          id: string
          midday_checked: boolean | null
          mit_confidence: number | null
          mit_custom: string | null
          mit_task_id: string | null
          plan_date: string
          re_entry_mode: boolean | null
          shutdown_at: string | null
          shutdown_note: string | null
          supporting: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avoided_task?: string | null
          created_at?: string | null
          energy_level?: number | null
          id?: string
          midday_checked?: boolean | null
          mit_confidence?: number | null
          mit_custom?: string | null
          mit_task_id?: string | null
          plan_date: string
          re_entry_mode?: boolean | null
          shutdown_at?: string | null
          shutdown_note?: string | null
          supporting?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avoided_task?: string | null
          created_at?: string | null
          energy_level?: number | null
          id?: string
          midday_checked?: boolean | null
          mit_confidence?: number | null
          mit_custom?: string | null
          mit_task_id?: string | null
          plan_date?: string
          re_entry_mode?: boolean | null
          shutdown_at?: string | null
          shutdown_note?: string | null
          supporting?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_plan_mit_task_id_fkey"
            columns: ["mit_task_id"]
            isOneToOne: false
            referencedRelation: "todo_items"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reconciliations: {
        Row: {
          analysis_without_deployment: boolean | null
          answered_at: string | null
          compression_mode_used: boolean | null
          created_at: string | null
          date: string
          day_score: number | null
          evening_extraction: Json | null
          evening_extraction_version: string | null
          events_count: number | null
          events_summary: Json | null
          first_90_protected: boolean | null
          first_90_started_at: string | null
          first_move_started: boolean | null
          id: string
          midday_blocker: string | null
          midday_sent_at: string | null
          midday_status: string | null
          mode: string
          morning_action: string | null
          morning_clicked_at: string | null
          morning_ping_sent_at: string | null
          morning_sent_at: string | null
          p2_parsed: Json | null
          p2_parser_version: string | null
          parsed_response: Json | null
          phone_drift_morning: boolean | null
          plan_failure_reason: string | null
          plan_quality: string | null
          planning_history: Json | null
          planning_status: string | null
          planning_summary: Json | null
          status: string
          telegram_message_id: number | null
          user_id: string
          user_response: string | null
        }
        Insert: {
          analysis_without_deployment?: boolean | null
          answered_at?: string | null
          compression_mode_used?: boolean | null
          created_at?: string | null
          date: string
          day_score?: number | null
          evening_extraction?: Json | null
          evening_extraction_version?: string | null
          events_count?: number | null
          events_summary?: Json | null
          first_90_protected?: boolean | null
          first_90_started_at?: string | null
          first_move_started?: boolean | null
          id?: string
          midday_blocker?: string | null
          midday_sent_at?: string | null
          midday_status?: string | null
          mode?: string
          morning_action?: string | null
          morning_clicked_at?: string | null
          morning_ping_sent_at?: string | null
          morning_sent_at?: string | null
          p2_parsed?: Json | null
          p2_parser_version?: string | null
          parsed_response?: Json | null
          phone_drift_morning?: boolean | null
          plan_failure_reason?: string | null
          plan_quality?: string | null
          planning_history?: Json | null
          planning_status?: string | null
          planning_summary?: Json | null
          status?: string
          telegram_message_id?: number | null
          user_id: string
          user_response?: string | null
        }
        Update: {
          analysis_without_deployment?: boolean | null
          answered_at?: string | null
          compression_mode_used?: boolean | null
          created_at?: string | null
          date?: string
          day_score?: number | null
          evening_extraction?: Json | null
          evening_extraction_version?: string | null
          events_count?: number | null
          events_summary?: Json | null
          first_90_protected?: boolean | null
          first_90_started_at?: string | null
          first_move_started?: boolean | null
          id?: string
          midday_blocker?: string | null
          midday_sent_at?: string | null
          midday_status?: string | null
          mode?: string
          morning_action?: string | null
          morning_clicked_at?: string | null
          morning_ping_sent_at?: string | null
          morning_sent_at?: string | null
          p2_parsed?: Json | null
          p2_parser_version?: string | null
          parsed_response?: Json | null
          phone_drift_morning?: boolean | null
          plan_failure_reason?: string | null
          plan_quality?: string | null
          planning_history?: Json | null
          planning_status?: string | null
          planning_summary?: Json | null
          status?: string
          telegram_message_id?: number | null
          user_id?: string
          user_response?: string | null
        }
        Relationships: []
      }
      daily_strain: {
        Row: {
          cardio_load: number | null
          cns_load: number | null
          components: Json | null
          created_at: string
          daily_status: string | null
          date: string
          explanation: string | null
          fueling_penalty: number | null
          fueling_provisional: boolean
          fueling_score: number | null
          id: string
          illness_level: string | null
          illness_score: number | null
          leg_load: number | null
          main_limiter: string | null
          mental_load_score: number | null
          readiness_level: string | null
          recovery_score: number | null
          steps_load: number | null
          strain_score: number | null
          strength_load: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cardio_load?: number | null
          cns_load?: number | null
          components?: Json | null
          created_at?: string
          daily_status?: string | null
          date: string
          explanation?: string | null
          fueling_penalty?: number | null
          fueling_provisional?: boolean
          fueling_score?: number | null
          id?: string
          illness_level?: string | null
          illness_score?: number | null
          leg_load?: number | null
          main_limiter?: string | null
          mental_load_score?: number | null
          readiness_level?: string | null
          recovery_score?: number | null
          steps_load?: number | null
          strain_score?: number | null
          strength_load?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cardio_load?: number | null
          cns_load?: number | null
          components?: Json | null
          created_at?: string
          daily_status?: string | null
          date?: string
          explanation?: string | null
          fueling_penalty?: number | null
          fueling_provisional?: boolean
          fueling_score?: number | null
          id?: string
          illness_level?: string | null
          illness_score?: number | null
          leg_load?: number | null
          main_limiter?: string | null
          mental_load_score?: number | null
          readiness_level?: string | null
          recovery_score?: number | null
          steps_load?: number | null
          strain_score?: number | null
          strength_load?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_wins: {
        Row: {
          category_1: string | null
          category_2: string | null
          category_3: string | null
          category_4: string | null
          category_5: string | null
          completed_at_1: string | null
          completed_at_2: string | null
          completed_at_3: string | null
          completed_at_4: string | null
          completed_at_5: string | null
          created_at: string | null
          daily_rpe: number | null
          date: string | null
          day_note: string | null
          done_1: boolean | null
          done_2: boolean | null
          done_3: boolean | null
          done_4: boolean | null
          done_5: boolean | null
          embedding: string | null
          gratitude_entry: string | null
          id: string
          importance_score: number | null
          is_intervention: boolean | null
          journal_entry: string | null
          mood_score: number | null
          result: string | null
          tags: string[] | null
          task_1: string | null
          task_1_checkpoint_id: string | null
          task_1_pin_id: string | null
          task_1_project_id: string | null
          task_1_target_value: string | null
          task_1_time_slot: string | null
          task_1_todo_id: string | null
          task_2: string | null
          task_2_checkpoint_id: string | null
          task_2_pin_id: string | null
          task_2_project_id: string | null
          task_2_target_value: string | null
          task_2_time_slot: string | null
          task_2_todo_id: string | null
          task_3: string | null
          task_3_checkpoint_id: string | null
          task_3_pin_id: string | null
          task_3_project_id: string | null
          task_3_target_value: string | null
          task_3_time_slot: string | null
          task_3_todo_id: string | null
          task_4: string | null
          task_4_checkpoint_id: string | null
          task_4_pin_id: string | null
          task_4_project_id: string | null
          task_4_target_value: string | null
          task_4_time_slot: string | null
          task_4_todo_id: string | null
          task_5: string | null
          task_5_checkpoint_id: string | null
          task_5_pin_id: string | null
          task_5_project_id: string | null
          task_5_target_value: string | null
          task_5_time_slot: string | null
          task_5_todo_id: string | null
          user_id: string | null
        }
        Insert: {
          category_1?: string | null
          category_2?: string | null
          category_3?: string | null
          category_4?: string | null
          category_5?: string | null
          completed_at_1?: string | null
          completed_at_2?: string | null
          completed_at_3?: string | null
          completed_at_4?: string | null
          completed_at_5?: string | null
          created_at?: string | null
          daily_rpe?: number | null
          date?: string | null
          day_note?: string | null
          done_1?: boolean | null
          done_2?: boolean | null
          done_3?: boolean | null
          done_4?: boolean | null
          done_5?: boolean | null
          embedding?: string | null
          gratitude_entry?: string | null
          id?: string
          importance_score?: number | null
          is_intervention?: boolean | null
          journal_entry?: string | null
          mood_score?: number | null
          result?: string | null
          tags?: string[] | null
          task_1?: string | null
          task_1_checkpoint_id?: string | null
          task_1_pin_id?: string | null
          task_1_project_id?: string | null
          task_1_target_value?: string | null
          task_1_time_slot?: string | null
          task_1_todo_id?: string | null
          task_2?: string | null
          task_2_checkpoint_id?: string | null
          task_2_pin_id?: string | null
          task_2_project_id?: string | null
          task_2_target_value?: string | null
          task_2_time_slot?: string | null
          task_2_todo_id?: string | null
          task_3?: string | null
          task_3_checkpoint_id?: string | null
          task_3_pin_id?: string | null
          task_3_project_id?: string | null
          task_3_target_value?: string | null
          task_3_time_slot?: string | null
          task_3_todo_id?: string | null
          task_4?: string | null
          task_4_checkpoint_id?: string | null
          task_4_pin_id?: string | null
          task_4_project_id?: string | null
          task_4_target_value?: string | null
          task_4_time_slot?: string | null
          task_4_todo_id?: string | null
          task_5?: string | null
          task_5_checkpoint_id?: string | null
          task_5_pin_id?: string | null
          task_5_project_id?: string | null
          task_5_target_value?: string | null
          task_5_time_slot?: string | null
          task_5_todo_id?: string | null
          user_id?: string | null
        }
        Update: {
          category_1?: string | null
          category_2?: string | null
          category_3?: string | null
          category_4?: string | null
          category_5?: string | null
          completed_at_1?: string | null
          completed_at_2?: string | null
          completed_at_3?: string | null
          completed_at_4?: string | null
          completed_at_5?: string | null
          created_at?: string | null
          daily_rpe?: number | null
          date?: string | null
          day_note?: string | null
          done_1?: boolean | null
          done_2?: boolean | null
          done_3?: boolean | null
          done_4?: boolean | null
          done_5?: boolean | null
          embedding?: string | null
          gratitude_entry?: string | null
          id?: string
          importance_score?: number | null
          is_intervention?: boolean | null
          journal_entry?: string | null
          mood_score?: number | null
          result?: string | null
          tags?: string[] | null
          task_1?: string | null
          task_1_checkpoint_id?: string | null
          task_1_pin_id?: string | null
          task_1_project_id?: string | null
          task_1_target_value?: string | null
          task_1_time_slot?: string | null
          task_1_todo_id?: string | null
          task_2?: string | null
          task_2_checkpoint_id?: string | null
          task_2_pin_id?: string | null
          task_2_project_id?: string | null
          task_2_target_value?: string | null
          task_2_time_slot?: string | null
          task_2_todo_id?: string | null
          task_3?: string | null
          task_3_checkpoint_id?: string | null
          task_3_pin_id?: string | null
          task_3_project_id?: string | null
          task_3_target_value?: string | null
          task_3_time_slot?: string | null
          task_3_todo_id?: string | null
          task_4?: string | null
          task_4_checkpoint_id?: string | null
          task_4_pin_id?: string | null
          task_4_project_id?: string | null
          task_4_target_value?: string | null
          task_4_time_slot?: string | null
          task_4_todo_id?: string | null
          task_5?: string | null
          task_5_checkpoint_id?: string | null
          task_5_pin_id?: string | null
          task_5_project_id?: string | null
          task_5_target_value?: string | null
          task_5_time_slot?: string | null
          task_5_todo_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_wins_task_1_checkpoint_id_fkey"
            columns: ["task_1_checkpoint_id"]
            isOneToOne: false
            referencedRelation: "project_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_1_pin_id_fkey"
            columns: ["task_1_pin_id"]
            isOneToOne: false
            referencedRelation: "learning_week_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_1_project_id_fkey"
            columns: ["task_1_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_1_todo_id_fkey"
            columns: ["task_1_todo_id"]
            isOneToOne: false
            referencedRelation: "todo_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_2_checkpoint_id_fkey"
            columns: ["task_2_checkpoint_id"]
            isOneToOne: false
            referencedRelation: "project_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_2_pin_id_fkey"
            columns: ["task_2_pin_id"]
            isOneToOne: false
            referencedRelation: "learning_week_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_2_project_id_fkey"
            columns: ["task_2_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_2_todo_id_fkey"
            columns: ["task_2_todo_id"]
            isOneToOne: false
            referencedRelation: "todo_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_3_checkpoint_id_fkey"
            columns: ["task_3_checkpoint_id"]
            isOneToOne: false
            referencedRelation: "project_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_3_pin_id_fkey"
            columns: ["task_3_pin_id"]
            isOneToOne: false
            referencedRelation: "learning_week_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_3_project_id_fkey"
            columns: ["task_3_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_3_todo_id_fkey"
            columns: ["task_3_todo_id"]
            isOneToOne: false
            referencedRelation: "todo_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_4_checkpoint_id_fkey"
            columns: ["task_4_checkpoint_id"]
            isOneToOne: false
            referencedRelation: "project_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_4_pin_id_fkey"
            columns: ["task_4_pin_id"]
            isOneToOne: false
            referencedRelation: "learning_week_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_4_project_id_fkey"
            columns: ["task_4_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_4_todo_id_fkey"
            columns: ["task_4_todo_id"]
            isOneToOne: false
            referencedRelation: "todo_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_5_checkpoint_id_fkey"
            columns: ["task_5_checkpoint_id"]
            isOneToOne: false
            referencedRelation: "project_checkpoints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_5_pin_id_fkey"
            columns: ["task_5_pin_id"]
            isOneToOne: false
            referencedRelation: "learning_week_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_5_project_id_fkey"
            columns: ["task_5_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_wins_task_5_todo_id_fkey"
            columns: ["task_5_todo_id"]
            isOneToOne: false
            referencedRelation: "todo_items"
            referencedColumns: ["id"]
          },
        ]
      }
      dreams: {
        Row: {
          category: string
          created_at: string
          description: string | null
          done_at: string | null
          id: string
          is_done: boolean
          is_top5: boolean
          life_goal: string | null
          sort_order: number
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          id?: string
          is_done?: boolean
          is_top5?: boolean
          life_goal?: string | null
          sort_order?: number
          title: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          done_at?: string | null
          id?: string
          is_done?: boolean
          is_top5?: boolean
          life_goal?: string | null
          sort_order?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      exercise_logs: {
        Row: {
          created_at: string | null
          exercise_name: string
          id: string
          is_pws_or_msp: boolean | null
          muscle_tags: string[]
          notes: string | null
          reps: number
          rir: number | null
          rpe: number | null
          session_id: string | null
          set_number: number
          user_id: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          exercise_name: string
          id?: string
          is_pws_or_msp?: boolean | null
          muscle_tags?: string[]
          notes?: string | null
          reps: number
          rir?: number | null
          rpe?: number | null
          session_id?: string | null
          set_number: number
          user_id?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          exercise_name?: string
          id?: string
          is_pws_or_msp?: boolean | null
          muscle_tags?: string[]
          notes?: string | null
          reps?: number
          rir?: number | null
          rpe?: number | null
          session_id?: string | null
          set_number?: number
          user_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      fasting_logs: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          created_at: string | null
          duration_seconds: number
          enjoyment_score: number | null
          id: string
          task_subject: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_seconds: number
          enjoyment_score?: number | null
          id?: string
          task_subject: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number
          enjoyment_score?: number | null
          id?: string
          task_subject?: string
          user_id?: string
        }
        Relationships: []
      }
      food_corrections: {
        Row: {
          corrected_grams: number
          corrected_name: string | null
          created_at: string
          id: string
          query_name: string
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          corrected_grams: number
          corrected_name?: string | null
          created_at?: string
          id?: string
          query_name: string
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          corrected_grams?: number
          corrected_name?: string | null
          created_at?: string
          id?: string
          query_name?: string
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      food_favorites: {
        Row: {
          barcode: string | null
          brand: string | null
          calories: number | null
          carbs: number | null
          created_at: string
          default_grams: number
          fat: number | null
          fiber: number | null
          id: string
          is_pinned: boolean
          last_used: string
          name: string
          protein: number | null
          sugar: number | null
          use_count: number
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          calories?: number | null
          carbs?: number | null
          created_at?: string
          default_grams?: number
          fat?: number | null
          fiber?: number | null
          id?: string
          is_pinned?: boolean
          last_used?: string
          name: string
          protein?: number | null
          sugar?: number | null
          use_count?: number
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          calories?: number | null
          carbs?: number | null
          created_at?: string
          default_grams?: number
          fat?: number | null
          fiber?: number | null
          id?: string
          is_pinned?: boolean
          last_used?: string
          name?: string
          protein?: number | null
          sugar?: number | null
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      food_library: {
        Row: {
          barcode: string | null
          brand: string | null
          calories: number | null
          carbs: number | null
          created_at: string
          default_grams: number
          fat: number | null
          fiber: number | null
          id: string
          name: string
          protein: number | null
          source: string
          sugar: number | null
          user_id: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          calories?: number | null
          carbs?: number | null
          created_at?: string
          default_grams?: number
          fat?: number | null
          fiber?: number | null
          id?: string
          name: string
          protein?: number | null
          source?: string
          sugar?: number | null
          user_id: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          calories?: number | null
          carbs?: number | null
          created_at?: string
          default_grams?: number
          fat?: number | null
          fiber?: number | null
          id?: string
          name?: string
          protein?: number | null
          source?: string
          sugar?: number | null
          user_id?: string
        }
        Relationships: []
      }
      food_parse_pending: {
        Row: {
          created_at: string
          id: string
          items: Json
          log_date: string
          meal_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items: Json
          log_date: string
          meal_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          log_date?: string
          meal_type?: string
          user_id?: string
        }
        Relationships: []
      }
      food_reference_pl: {
        Row: {
          calories: number
          carbs: number
          fat: number
          fiber: number | null
          id: string
          name: string
          protein: number
          source_label: string
          sugar: number | null
        }
        Insert: {
          calories: number
          carbs: number
          fat: number
          fiber?: number | null
          id?: string
          name: string
          protein: number
          source_label?: string
          sugar?: number | null
        }
        Update: {
          calories?: number
          carbs?: number
          fat?: number
          fiber?: number | null
          id?: string
          name?: string
          protein?: number
          source_label?: string
          sugar?: number | null
        }
        Relationships: []
      }
      friction_events: {
        Row: {
          actual_behavior: string | null
          confidence: number | null
          confidence_source: string | null
          context: Json | null
          cost_estimate: string | null
          created_at: string | null
          declared_intention: string | null
          deviation: string | null
          emotional_state: string | null
          event_kind: string | null
          extraction_quality: number | null
          extraction_quality_score: number | null
          friction_type: string | null
          id: string
          immediate_cost: string | null
          last_reviewed_at: string | null
          later_cost: string | null
          location_context: string | null
          occurred_at: string
          parser_version: string | null
          people_involved: string[] | null
          raw_text: string | null
          review_notes: string | null
          review_status: string | null
          status: string | null
          stream_record_id: string | null
          user_id: string
        }
        Insert: {
          actual_behavior?: string | null
          confidence?: number | null
          confidence_source?: string | null
          context?: Json | null
          cost_estimate?: string | null
          created_at?: string | null
          declared_intention?: string | null
          deviation?: string | null
          emotional_state?: string | null
          event_kind?: string | null
          extraction_quality?: number | null
          extraction_quality_score?: number | null
          friction_type?: string | null
          id?: string
          immediate_cost?: string | null
          last_reviewed_at?: string | null
          later_cost?: string | null
          location_context?: string | null
          occurred_at?: string
          parser_version?: string | null
          people_involved?: string[] | null
          raw_text?: string | null
          review_notes?: string | null
          review_status?: string | null
          status?: string | null
          stream_record_id?: string | null
          user_id: string
        }
        Update: {
          actual_behavior?: string | null
          confidence?: number | null
          confidence_source?: string | null
          context?: Json | null
          cost_estimate?: string | null
          created_at?: string | null
          declared_intention?: string | null
          deviation?: string | null
          emotional_state?: string | null
          event_kind?: string | null
          extraction_quality?: number | null
          extraction_quality_score?: number | null
          friction_type?: string | null
          id?: string
          immediate_cost?: string | null
          last_reviewed_at?: string | null
          later_cost?: string | null
          location_context?: string | null
          occurred_at?: string
          parser_version?: string | null
          people_involved?: string[] | null
          raw_text?: string | null
          review_notes?: string | null
          review_status?: string | null
          status?: string | null
          stream_record_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friction_events_stream_record_id_fkey"
            columns: ["stream_record_id"]
            isOneToOne: false
            referencedRelation: "v_friction_pipeline_status"
            referencedColumns: ["stream_id"]
          },
          {
            foreignKeyName: "friction_events_stream_record_id_fkey"
            columns: ["stream_record_id"]
            isOneToOne: false
            referencedRelation: "vanguard_stream"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_kpi_snapshots: {
        Row: {
          id: string
          kpi_id: string
          note: string | null
          recorded_at: string
          user_id: string
          value: number
        }
        Insert: {
          id?: string
          kpi_id: string
          note?: string | null
          recorded_at?: string
          user_id: string
          value: number
        }
        Update: {
          id?: string
          kpi_id?: string
          note?: string | null
          recorded_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_kpi_snapshots_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "goal_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_kpis: {
        Row: {
          created_at: string | null
          current_value: number | null
          goal_id: string | null
          higher_is_better: boolean
          id: string
          name: string
          pillar: string
          project_id: string | null
          sort_order: number
          target: number | null
          unit: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          goal_id?: string | null
          higher_is_better?: boolean
          id?: string
          name: string
          pillar: string
          project_id?: string | null
          sort_order?: number
          target?: number | null
          unit?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          goal_id?: string | null
          higher_is_better?: boolean
          id?: string
          name?: string
          pillar?: string
          project_id?: string | null
          sort_order?: number
          target?: number | null
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_kpis_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_kpis_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          description: string | null
          dream_id: string | null
          id: string
          pillar: string | null
          sort_order: number
          status: string
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          dream_id?: string | null
          id?: string
          pillar?: string | null
          sort_order?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          dream_id?: string | null
          id?: string
          pillar?: string | null
          sort_order?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_dream_id_fkey"
            columns: ["dream_id"]
            isOneToOne: false
            referencedRelation: "dreams"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          completed: boolean | null
          context_note: string | null
          date: string | null
          final_stimulus: string | null
          habit_id: string | null
          id: string
          logged_at: string | null
          user_id: string | null
        }
        Insert: {
          completed?: boolean | null
          context_note?: string | null
          date?: string | null
          final_stimulus?: string | null
          habit_id?: string | null
          id?: string
          logged_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed?: boolean | null
          context_note?: string | null
          date?: string | null
          final_stimulus?: string | null
          habit_id?: string | null
          id?: string
          logged_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_positive: boolean | null
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_positive?: boolean | null
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_positive?: boolean | null
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      knowledge_insight_cards: {
        Row: {
          created_at: string | null
          id: string
          insight: string | null
          is_pinned: boolean | null
          related_fact_ids: string[] | null
          sort_order: number | null
          tags: string[] | null
          template_id: string
          title: string
          user_id: string
          widget_data: Json | null
          widget_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          insight?: string | null
          is_pinned?: boolean | null
          related_fact_ids?: string[] | null
          sort_order?: number | null
          tags?: string[] | null
          template_id: string
          title: string
          user_id: string
          widget_data?: Json | null
          widget_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          insight?: string | null
          is_pinned?: boolean | null
          related_fact_ids?: string[] | null
          sort_order?: number | null
          tags?: string[] | null
          template_id?: string
          title?: string
          user_id?: string
          widget_data?: Json | null
          widget_type?: string | null
        }
        Relationships: []
      }
      kpi_entries: {
        Row: {
          created_at: string | null
          id: string
          kpi_id: string
          user_id: string
          value: number | null
          week_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          kpi_id: string
          user_id: string
          value?: number | null
          week_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          kpi_id?: string
          user_id?: string
          value?: number | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "goal_kpis"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_skill_snapshots: {
        Row: {
          created_at: string
          id: string
          scores: Json
          snapshot_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scores?: Json
          snapshot_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scores?: Json
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_skills: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          label: string
          parent_id: string | null
          sort_order: number
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          label: string
          parent_id?: string | null
          sort_order?: number
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          label?: string
          parent_id?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_skills_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "learning_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_week_focus: {
        Row: {
          drill_text: string
          lateral_challenge: string
          rep_done: number
          rep_target: number | null
          skill_id: string | null
          subskill_id: string | null
          target_level: number | null
          user_id: string
          vertical_challenge: string
          week_start: string
          why_text: string
        }
        Insert: {
          drill_text?: string
          lateral_challenge?: string
          rep_done?: number
          rep_target?: number | null
          skill_id?: string | null
          subskill_id?: string | null
          target_level?: number | null
          user_id: string
          vertical_challenge?: string
          week_start: string
          why_text?: string
        }
        Update: {
          drill_text?: string
          lateral_challenge?: string
          rep_done?: number
          rep_target?: number | null
          skill_id?: string | null
          subskill_id?: string | null
          target_level?: number | null
          user_id?: string
          vertical_challenge?: string
          week_start?: string
          why_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_week_focus_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "learning_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_week_focus_subskill_id_fkey"
            columns: ["subskill_id"]
            isOneToOne: false
            referencedRelation: "learning_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_week_pins: {
        Row: {
          created_at: string
          done: boolean
          done_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          manual_resource_type: string | null
          manual_title: string | null
          project_id: string | null
          skill_id: string | null
          slot: string
          sort_order: number
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          manual_resource_type?: string | null
          manual_title?: string | null
          project_id?: string | null
          skill_id?: string | null
          slot: string
          sort_order?: number
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          done?: boolean
          done_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          manual_resource_type?: string | null
          manual_title?: string | null
          project_id?: string | null
          skill_id?: string | null
          slot?: string
          sort_order?: number
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_week_pins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_week_pins_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "learning_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      life_goals: {
        Row: {
          about_me: string | null
          bhag_pillar: string | null
          created_at: string | null
          date_cialo: string | null
          date_duch: string | null
          date_konto: string | null
          goal_cialo: string | null
          goal_duch: string | null
          goal_konto: string | null
          id: string
          user_id: string | null
          vault_content: string | null
        }
        Insert: {
          about_me?: string | null
          bhag_pillar?: string | null
          created_at?: string | null
          date_cialo?: string | null
          date_duch?: string | null
          date_konto?: string | null
          goal_cialo?: string | null
          goal_duch?: string | null
          goal_konto?: string | null
          id?: string
          user_id?: string | null
          vault_content?: string | null
        }
        Update: {
          about_me?: string | null
          bhag_pillar?: string | null
          created_at?: string | null
          date_cialo?: string | null
          date_duch?: string | null
          date_konto?: string | null
          goal_cialo?: string | null
          goal_duch?: string | null
          goal_konto?: string | null
          id?: string
          user_id?: string | null
          vault_content?: string | null
        }
        Relationships: []
      }
      location_history: {
        Row: {
          accuracy: number | null
          created_at: string | null
          id: string
          is_manual: boolean | null
          latitude: number
          longitude: number
          place_name: string | null
          user_id: string | null
        }
        Insert: {
          accuracy?: number | null
          created_at?: string | null
          id?: string
          is_manual?: boolean | null
          latitude: number
          longitude: number
          place_name?: string | null
          user_id?: string | null
        }
        Update: {
          accuracy?: number | null
          created_at?: string | null
          id?: string
          is_manual?: boolean | null
          latitude?: number
          longitude?: number
          place_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      medical_documents: {
        Row: {
          clinical_validity: string
          created_at: string
          document_date: string
          document_type: string
          id: string
          notes: string | null
          provider: string | null
          source_name: string
          source_path: string | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clinical_validity?: string
          created_at?: string
          document_date: string
          document_type: string
          id?: string
          notes?: string | null
          provider?: string | null
          source_name: string
          source_path?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clinical_validity?: string
          created_at?: string
          document_date?: string
          document_type?: string
          id?: string
          notes?: string | null
          provider?: string | null
          source_name?: string
          source_path?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medical_lab_results: {
        Row: {
          category: string | null
          created_at: string
          flag: string | null
          id: string
          marker_key: string
          marker_name: string
          notes: string | null
          provider: string | null
          ref_high: number | null
          ref_low: number | null
          ref_text: string | null
          result_date: string
          source_name: string
          unit: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          flag?: string | null
          id?: string
          marker_key: string
          marker_name: string
          notes?: string | null
          provider?: string | null
          ref_high?: number | null
          ref_low?: number | null
          ref_text?: string | null
          result_date: string
          source_name: string
          unit?: string | null
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          category?: string | null
          created_at?: string
          flag?: string | null
          id?: string
          marker_key?: string
          marker_name?: string
          notes?: string | null
          provider?: string | null
          ref_high?: number | null
          ref_low?: number | null
          ref_text?: string | null
          result_date?: string
          source_name?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      morning_briefs: {
        Row: {
          content: string
          date: string
          generated_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          date: string
          generated_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          date?: string
          generated_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_profile: {
        Row: {
          birth_date: string | null
          current_body_fat_est: number | null
          event_date: string | null
          event_name: string | null
          goal_body_fat: number | null
          goal_target_date: string | null
          height_cm: number | null
          philosophy_note: string | null
          protein_g_per_kg: number
          sex: string | null
          updated_at: string
          user_id: string
          weekly_loss_kg: number
        }
        Insert: {
          birth_date?: string | null
          current_body_fat_est?: number | null
          event_date?: string | null
          event_name?: string | null
          goal_body_fat?: number | null
          goal_target_date?: string | null
          height_cm?: number | null
          philosophy_note?: string | null
          protein_g_per_kg?: number
          sex?: string | null
          updated_at?: string
          user_id: string
          weekly_loss_kg?: number
        }
        Update: {
          birth_date?: string | null
          current_body_fat_est?: number | null
          event_date?: string | null
          event_name?: string | null
          goal_body_fat?: number | null
          goal_target_date?: string | null
          height_cm?: number | null
          philosophy_note?: string | null
          protein_g_per_kg?: number
          sex?: string | null
          updated_at?: string
          user_id?: string
          weekly_loss_kg?: number
        }
        Relationships: []
      }
      nutrition_targets: {
        Row: {
          adaptive_correction_kcal: number | null
          avg_intake_logged: number | null
          avg_tdee_oura: number | null
          created_at: string
          date: string
          days_to_goal_est: number | null
          deficit_kcal: number | null
          est_maintenance_kcal: number | null
          forecast_30d_bf_pct: number | null
          forecast_30d_weight_kg: number | null
          forecast_60d_bf_pct: number | null
          forecast_60d_weight_kg: number | null
          forecast_90d_bf_pct: number | null
          forecast_90d_weight_kg: number | null
          id: string
          inputs: Json | null
          protein_floor_g: number | null
          target_kcal: number | null
          underlog_gap_kcal: number | null
          updated_at: string
          user_id: string
          verdict: Json | null
          weight_trend_kg_per_week: number | null
        }
        Insert: {
          adaptive_correction_kcal?: number | null
          avg_intake_logged?: number | null
          avg_tdee_oura?: number | null
          created_at?: string
          date: string
          days_to_goal_est?: number | null
          deficit_kcal?: number | null
          est_maintenance_kcal?: number | null
          forecast_30d_bf_pct?: number | null
          forecast_30d_weight_kg?: number | null
          forecast_60d_bf_pct?: number | null
          forecast_60d_weight_kg?: number | null
          forecast_90d_bf_pct?: number | null
          forecast_90d_weight_kg?: number | null
          id?: string
          inputs?: Json | null
          protein_floor_g?: number | null
          target_kcal?: number | null
          underlog_gap_kcal?: number | null
          updated_at?: string
          user_id: string
          verdict?: Json | null
          weight_trend_kg_per_week?: number | null
        }
        Update: {
          adaptive_correction_kcal?: number | null
          avg_intake_logged?: number | null
          avg_tdee_oura?: number | null
          created_at?: string
          date?: string
          days_to_goal_est?: number | null
          deficit_kcal?: number | null
          est_maintenance_kcal?: number | null
          forecast_30d_bf_pct?: number | null
          forecast_30d_weight_kg?: number | null
          forecast_60d_bf_pct?: number | null
          forecast_60d_weight_kg?: number | null
          forecast_90d_bf_pct?: number | null
          forecast_90d_weight_kg?: number | null
          id?: string
          inputs?: Json | null
          protein_floor_g?: number | null
          target_kcal?: number | null
          underlog_gap_kcal?: number | null
          updated_at?: string
          user_id?: string
          verdict?: Json | null
          weight_trend_kg_per_week?: number | null
        }
        Relationships: []
      }
      oracle_clarification_requests: {
        Row: {
          answer: Json | null
          answered_at: string | null
          confidence: number | null
          created_at: string | null
          dedupe_key: string
          evidence_fact_ids: string[] | null
          id: string
          options: Json | null
          proposed_memory: string | null
          question: string
          response_type: string
          status: string
          user_id: string
        }
        Insert: {
          answer?: Json | null
          answered_at?: string | null
          confidence?: number | null
          created_at?: string | null
          dedupe_key: string
          evidence_fact_ids?: string[] | null
          id?: string
          options?: Json | null
          proposed_memory?: string | null
          question: string
          response_type: string
          status?: string
          user_id: string
        }
        Update: {
          answer?: Json | null
          answered_at?: string | null
          confidence?: number | null
          created_at?: string | null
          dedupe_key?: string
          evidence_fact_ids?: string[] | null
          id?: string
          options?: Json | null
          proposed_memory?: string | null
          question?: string
          response_type?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      oracle_pending_actions: {
        Row: {
          action_type: string
          created_at: string | null
          id: string
          payload: Json
          processed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      system_proposals: {
        Row: {
          id: string
          user_id: string
          proposal_type: string
          status: string
          dedupe_key: string
          title: string
          body: string
          payload: Json
          created_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          proposal_type: string
          status?: string
          dedupe_key: string
          title: string
          body: string
          payload?: Json
          created_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          proposal_type?: string
          status?: string
          dedupe_key?: string
          title?: string
          body?: string
          payload?: Json
          created_at?: string
          resolved_at?: string | null
        }
        Relationships: []
      }
      oura_daily_summary: {
        Row: {
          active_calories: number | null
          bedtime_timestamp: string | null
          created_at: string | null
          date: string
          deep_sleep_hours: number | null
          hrv_avg: number | null
          id: string
          is_disciplined: boolean | null
          latency_minutes: number | null
          readiness_score: number | null
          rem_sleep_hours: number | null
          rhr_avg: number | null
          sleep_efficiency: number | null
          sleep_score: number | null
          steps: number | null
          stress_score: number | null
          temp_deviation: number | null
          total_calories: number | null
          total_sleep_hours: number | null
          user_id: string | null
        }
        Insert: {
          active_calories?: number | null
          bedtime_timestamp?: string | null
          created_at?: string | null
          date: string
          deep_sleep_hours?: number | null
          hrv_avg?: number | null
          id?: string
          is_disciplined?: boolean | null
          latency_minutes?: number | null
          readiness_score?: number | null
          rem_sleep_hours?: number | null
          rhr_avg?: number | null
          sleep_efficiency?: number | null
          sleep_score?: number | null
          steps?: number | null
          stress_score?: number | null
          temp_deviation?: number | null
          total_calories?: number | null
          total_sleep_hours?: number | null
          user_id?: string | null
        }
        Update: {
          active_calories?: number | null
          bedtime_timestamp?: string | null
          created_at?: string | null
          date?: string
          deep_sleep_hours?: number | null
          hrv_avg?: number | null
          id?: string
          is_disciplined?: boolean | null
          latency_minutes?: number | null
          readiness_score?: number | null
          rem_sleep_hours?: number | null
          rhr_avg?: number | null
          sleep_efficiency?: number | null
          sleep_score?: number | null
          steps?: number | null
          stress_score?: number | null
          temp_deviation?: number | null
          total_calories?: number | null
          total_sleep_hours?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      oura_enhanced: {
        Row: {
          active_calories: number | null
          activity_contributors: Json | null
          activity_score: number | null
          average_met_minutes: number | null
          awake_time_minutes: number | null
          bedtime_end: string | null
          bedtime_start: string | null
          breathing_disturbance_index: number | null
          created_at: string
          date: string
          deep_sleep_hours: number | null
          equivalent_walking_distance: number | null
          high_activity_minutes: number | null
          id: string
          inactivity_alerts: number | null
          light_sleep_hours: number | null
          low_activity_minutes: number | null
          medium_activity_minutes: number | null
          non_wear_minutes: number | null
          raw: Json | null
          readiness_contributors: Json | null
          readiness_score: number | null
          recovery_high_minutes: number | null
          rem_sleep_hours: number | null
          resilience_contributors: Json | null
          resilience_level: string | null
          resting_minutes: number | null
          restless_periods: number | null
          sedentary_minutes: number | null
          sleep_average_breath: number | null
          sleep_average_heart_rate: number | null
          sleep_average_hrv: number | null
          sleep_contributors: Json | null
          sleep_efficiency: number | null
          sleep_latency_minutes: number | null
          sleep_lowest_heart_rate: number | null
          sleep_score: number | null
          spo2_percentage: number | null
          steps: number | null
          stress_day_summary: string | null
          stress_high_minutes: number | null
          target_calories: number | null
          temperature_deviation: number | null
          temperature_trend_deviation: number | null
          time_in_bed_hours: number | null
          total_calories: number | null
          total_sleep_hours: number | null
          updated_at: string
          user_id: string
          vascular_age: number | null
          vo2_max: number | null
          wake_up_timestamp: string | null
        }
        Insert: {
          active_calories?: number | null
          activity_contributors?: Json | null
          activity_score?: number | null
          average_met_minutes?: number | null
          awake_time_minutes?: number | null
          bedtime_end?: string | null
          bedtime_start?: string | null
          breathing_disturbance_index?: number | null
          created_at?: string
          date: string
          deep_sleep_hours?: number | null
          equivalent_walking_distance?: number | null
          high_activity_minutes?: number | null
          id?: string
          inactivity_alerts?: number | null
          light_sleep_hours?: number | null
          low_activity_minutes?: number | null
          medium_activity_minutes?: number | null
          non_wear_minutes?: number | null
          raw?: Json | null
          readiness_contributors?: Json | null
          readiness_score?: number | null
          recovery_high_minutes?: number | null
          rem_sleep_hours?: number | null
          resilience_contributors?: Json | null
          resilience_level?: string | null
          resting_minutes?: number | null
          restless_periods?: number | null
          sedentary_minutes?: number | null
          sleep_average_breath?: number | null
          sleep_average_heart_rate?: number | null
          sleep_average_hrv?: number | null
          sleep_contributors?: Json | null
          sleep_efficiency?: number | null
          sleep_latency_minutes?: number | null
          sleep_lowest_heart_rate?: number | null
          sleep_score?: number | null
          spo2_percentage?: number | null
          steps?: number | null
          stress_day_summary?: string | null
          stress_high_minutes?: number | null
          target_calories?: number | null
          temperature_deviation?: number | null
          temperature_trend_deviation?: number | null
          time_in_bed_hours?: number | null
          total_calories?: number | null
          total_sleep_hours?: number | null
          updated_at?: string
          user_id: string
          vascular_age?: number | null
          vo2_max?: number | null
          wake_up_timestamp?: string | null
        }
        Update: {
          active_calories?: number | null
          activity_contributors?: Json | null
          activity_score?: number | null
          average_met_minutes?: number | null
          awake_time_minutes?: number | null
          bedtime_end?: string | null
          bedtime_start?: string | null
          breathing_disturbance_index?: number | null
          created_at?: string
          date?: string
          deep_sleep_hours?: number | null
          equivalent_walking_distance?: number | null
          high_activity_minutes?: number | null
          id?: string
          inactivity_alerts?: number | null
          light_sleep_hours?: number | null
          low_activity_minutes?: number | null
          medium_activity_minutes?: number | null
          non_wear_minutes?: number | null
          raw?: Json | null
          readiness_contributors?: Json | null
          readiness_score?: number | null
          recovery_high_minutes?: number | null
          rem_sleep_hours?: number | null
          resilience_contributors?: Json | null
          resilience_level?: string | null
          resting_minutes?: number | null
          restless_periods?: number | null
          sedentary_minutes?: number | null
          sleep_average_breath?: number | null
          sleep_average_heart_rate?: number | null
          sleep_average_hrv?: number | null
          sleep_contributors?: Json | null
          sleep_efficiency?: number | null
          sleep_latency_minutes?: number | null
          sleep_lowest_heart_rate?: number | null
          sleep_score?: number | null
          spo2_percentage?: number | null
          steps?: number | null
          stress_day_summary?: string | null
          stress_high_minutes?: number | null
          target_calories?: number | null
          temperature_deviation?: number | null
          temperature_trend_deviation?: number | null
          time_in_bed_hours?: number | null
          total_calories?: number | null
          total_sleep_hours?: number | null
          updated_at?: string
          user_id?: string
          vascular_age?: number | null
          vo2_max?: number | null
          wake_up_timestamp?: string | null
        }
        Relationships: []
      }
      oura_heartrate: {
        Row: {
          bpm: number | null
          created_at: string
          id: string
          source: string | null
          ts: string
          user_id: string
        }
        Insert: {
          bpm?: number | null
          created_at?: string
          id?: string
          source?: string | null
          ts: string
          user_id: string
        }
        Update: {
          bpm?: number | null
          created_at?: string
          id?: string
          source?: string | null
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      oura_sleep_hr_timeline: {
        Row: {
          bpm: number | null
          created_at: string
          day: string | null
          id: string
          sleep_id: string
          ts: string
          user_id: string
        }
        Insert: {
          bpm?: number | null
          created_at?: string
          day?: string | null
          id?: string
          sleep_id: string
          ts: string
          user_id: string
        }
        Update: {
          bpm?: number | null
          created_at?: string
          day?: string | null
          id?: string
          sleep_id?: string
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      oura_sleep_hrv_timeline: {
        Row: {
          created_at: string
          day: string | null
          hrv: number | null
          id: string
          sleep_id: string
          ts: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string | null
          hrv?: number | null
          id?: string
          sleep_id: string
          ts: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string | null
          hrv?: number | null
          id?: string
          sleep_id?: string
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      oura_sleep_phase_timeline: {
        Row: {
          created_at: string
          day: string | null
          id: string
          phase: string | null
          phase_code: number | null
          sleep_id: string
          ts: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: string | null
          id?: string
          phase?: string | null
          phase_code?: number | null
          sleep_id: string
          ts: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string | null
          id?: string
          phase?: string | null
          phase_code?: number | null
          sleep_id?: string
          ts?: string
          user_id?: string
        }
        Relationships: []
      }
      phone_usage_daily: {
        Row: {
          ai_minutes: number | null
          browser_minutes: number | null
          created_at: string | null
          date: string
          entertainment_minutes: number | null
          id: string
          late_night_minutes: number | null
          messaging_minutes: number | null
          social_minutes: number | null
          top_apps: Json | null
          total_minutes: number | null
          unlocks: number | null
          user_id: string | null
        }
        Insert: {
          ai_minutes?: number | null
          browser_minutes?: number | null
          created_at?: string | null
          date: string
          entertainment_minutes?: number | null
          id?: string
          late_night_minutes?: number | null
          messaging_minutes?: number | null
          social_minutes?: number | null
          top_apps?: Json | null
          total_minutes?: number | null
          unlocks?: number | null
          user_id?: string | null
        }
        Update: {
          ai_minutes?: number | null
          browser_minutes?: number | null
          created_at?: string | null
          date?: string
          entertainment_minutes?: number | null
          id?: string
          late_night_minutes?: number | null
          messaging_minutes?: number | null
          social_minutes?: number | null
          top_apps?: Json | null
          total_minutes?: number | null
          unlocks?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          created_at: string | null
          date: string | null
          id: string
          image_url: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          id?: string
          image_url: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          id?: string
          image_url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      project_checkpoints: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          project_id: string
          sort_order: number
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          project_id: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          project_id?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_checkpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string
          created_at: string | null
          deadline: string | null
          dream_id: string | null
          goal: string | null
          goal_id: string | null
          id: string
          name: string
          primary_skill_id: string | null
          retrospective_good: string | null
          retrospective_improve: string | null
          retrospective_rating: number | null
          status: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          deadline?: string | null
          dream_id?: string | null
          goal?: string | null
          goal_id?: string | null
          id?: string
          name: string
          primary_skill_id?: string | null
          retrospective_good?: string | null
          retrospective_improve?: string | null
          retrospective_rating?: number | null
          status?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          deadline?: string | null
          dream_id?: string | null
          goal?: string | null
          goal_id?: string | null
          id?: string
          name?: string
          primary_skill_id?: string | null
          retrospective_good?: string | null
          retrospective_improve?: string | null
          retrospective_rating?: number | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_dream_id_fkey"
            columns: ["dream_id"]
            isOneToOne: false
            referencedRelation: "dreams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_primary_skill_id_fkey"
            columns: ["primary_skill_id"]
            isOneToOne: false
            referencedRelation: "learning_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys_auth: string
          keys_p256dh: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys_auth: string
          keys_p256dh: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys_auth?: string
          keys_p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      sprint_goals: {
        Row: {
          created_at: string | null
          goal_text: string | null
          id: string
          personal_year: number
          sprint_number: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          goal_text?: string | null
          id?: string
          personal_year: number
          sprint_number: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          goal_text?: string | null
          id?: string
          personal_year?: number
          sprint_number?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sprint_reviews: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          personal_year: number
          reflection: string | null
          sprint_number: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          personal_year: number
          reflection?: string | null
          sprint_number: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          personal_year?: number
          reflection?: string | null
          sprint_number?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      strava_activities: {
        Row: {
          average_heartrate: number | null
          average_speed: number | null
          calories: number | null
          distance: number | null
          elapsed_time: number | null
          gc_activity_id: number | null
          gc_enriched_at: string | null
          gc_hr_zones: Json | null
          gc_laps: Json | null
          gc_training_effect_aerobic: number | null
          gc_training_effect_anaerobic: number | null
          gc_vo2max: number | null
          gc_weather: Json | null
          gear_distance_km: number | null
          gear_name: string | null
          hr_avg: number | null
          hr_frozen: boolean | null
          hr_max: number | null
          hr_source: string | null
          is_oura_duplicate: boolean | null
          manual: boolean | null
          max_heartrate: number | null
          max_speed: number | null
          moving_time: number | null
          name: string | null
          perceived_exertion: number | null
          raw_data: Json | null
          splits_with_hr: Json | null
          sport_type: string | null
          start_date: string | null
          strava_id: number
          suffer_score: number | null
          synced_at: string | null
          total_elevation_gain: number | null
          user_id: string
        }
        Insert: {
          average_heartrate?: number | null
          average_speed?: number | null
          calories?: number | null
          distance?: number | null
          elapsed_time?: number | null
          gc_activity_id?: number | null
          gc_enriched_at?: string | null
          gc_hr_zones?: Json | null
          gc_laps?: Json | null
          gc_training_effect_aerobic?: number | null
          gc_training_effect_anaerobic?: number | null
          gc_vo2max?: number | null
          gc_weather?: Json | null
          gear_distance_km?: number | null
          gear_name?: string | null
          hr_avg?: number | null
          hr_frozen?: boolean | null
          hr_max?: number | null
          hr_source?: string | null
          is_oura_duplicate?: boolean | null
          manual?: boolean | null
          max_heartrate?: number | null
          max_speed?: number | null
          moving_time?: number | null
          name?: string | null
          perceived_exertion?: number | null
          raw_data?: Json | null
          splits_with_hr?: Json | null
          sport_type?: string | null
          start_date?: string | null
          strava_id: number
          suffer_score?: number | null
          synced_at?: string | null
          total_elevation_gain?: number | null
          user_id: string
        }
        Update: {
          average_heartrate?: number | null
          average_speed?: number | null
          calories?: number | null
          distance?: number | null
          elapsed_time?: number | null
          gc_activity_id?: number | null
          gc_enriched_at?: string | null
          gc_hr_zones?: Json | null
          gc_laps?: Json | null
          gc_training_effect_aerobic?: number | null
          gc_training_effect_anaerobic?: number | null
          gc_vo2max?: number | null
          gc_weather?: Json | null
          gear_distance_km?: number | null
          gear_name?: string | null
          hr_avg?: number | null
          hr_frozen?: boolean | null
          hr_max?: number | null
          hr_source?: string | null
          is_oura_duplicate?: boolean | null
          manual?: boolean | null
          max_heartrate?: number | null
          max_speed?: number | null
          moving_time?: number | null
          name?: string | null
          perceived_exertion?: number | null
          raw_data?: Json | null
          splits_with_hr?: Json | null
          sport_type?: string | null
          start_date?: string | null
          strava_id?: number
          suffer_score?: number | null
          synced_at?: string | null
          total_elevation_gain?: number | null
          user_id?: string
        }
        Relationships: []
      }
      strava_tokens: {
        Row: {
          access_token: string | null
          expires_at: number | null
          refresh_token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          expires_at?: number | null
          refresh_token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          expires_at?: number | null
          refresh_token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      supplement_logs: {
        Row: {
          date: string
          id: string
          logged_at: string
          note: string | null
          quantity: number
          supplement_id: string
          user_id: string
        }
        Insert: {
          date: string
          id?: string
          logged_at?: string
          note?: string | null
          quantity?: number
          supplement_id: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          logged_at?: string
          note?: string | null
          quantity?: number
          supplement_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplement_logs_supplement_id_fkey"
            columns: ["supplement_id"]
            isOneToOne: false
            referencedRelation: "supplements"
            referencedColumns: ["id"]
          },
        ]
      }
      supplements: {
        Row: {
          active: boolean
          created_at: string | null
          dose_per_unit: Json
          emoji: string
          id: string
          name: string
          slug: string
          sort_order: number
          unit: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          dose_per_unit?: Json
          emoji?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          unit?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          dose_per_unit?: Json
          emoji?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      todo_items: {
        Row: {
          ai_bucket: string | null
          ai_classified_at: string | null
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          is_milestone: boolean
          notes: string | null
          priority: string
          project_id: string | null
          recurrence: string | null
          reminder_at: string | null
          reminder_sent: boolean
          section_id: string | null
          sort_order: number
          status: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_bucket?: string | null
          ai_classified_at?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_milestone?: boolean
          notes?: string | null
          priority?: string
          project_id?: string | null
          recurrence?: string | null
          reminder_at?: string | null
          reminder_sent?: boolean
          section_id?: string | null
          sort_order?: number
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_bucket?: string | null
          ai_classified_at?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_milestone?: boolean
          notes?: string | null
          priority?: string
          project_id?: string | null
          recurrence?: string | null
          reminder_at?: string | null
          reminder_sent?: boolean
          section_id?: string | null
          sort_order?: number
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "todo_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todo_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_sections: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          name: string
          project_id: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          project_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          project_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plan_workouts: {
        Row: {
          completed: boolean | null
          completion_notes: string | null
          created_at: string | null
          day_of_week: string
          description: string | null
          goal: string | null
          id: string
          planned_date: string | null
          strava_activity_id: number | null
          target_distance_km: number | null
          target_duration_min: number | null
          target_hr_max: number | null
          target_pace_max_km: string | null
          target_pace_min_km: string | null
          user_id: string
          week_number: number
          workout_name: string
          workout_type: string
        }
        Insert: {
          completed?: boolean | null
          completion_notes?: string | null
          created_at?: string | null
          day_of_week: string
          description?: string | null
          goal?: string | null
          id?: string
          planned_date?: string | null
          strava_activity_id?: number | null
          target_distance_km?: number | null
          target_duration_min?: number | null
          target_hr_max?: number | null
          target_pace_max_km?: string | null
          target_pace_min_km?: string | null
          user_id: string
          week_number: number
          workout_name: string
          workout_type: string
        }
        Update: {
          completed?: boolean | null
          completion_notes?: string | null
          created_at?: string | null
          day_of_week?: string
          description?: string | null
          goal?: string | null
          id?: string
          planned_date?: string | null
          strava_activity_id?: number | null
          target_distance_km?: number | null
          target_duration_min?: number | null
          target_hr_max?: number | null
          target_pace_max_km?: string | null
          target_pace_min_km?: string | null
          user_id?: string
          week_number?: number
          workout_name?: string
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plan_workouts_strava_activity_id_fkey"
            columns: ["strava_activity_id"]
            isOneToOne: false
            referencedRelation: "strava_activities"
            referencedColumns: ["strava_id"]
          },
          {
            foreignKeyName: "training_plan_workouts_strava_activity_id_fkey"
            columns: ["strava_activity_id"]
            isOneToOne: false
            referencedRelation: "strava_activities_clean"
            referencedColumns: ["strava_id"]
          },
        ]
      }
      user_fundament: {
        Row: {
          embedding: string | null
          finances: string | null
          identity: string | null
          importance_score: number | null
          knowledge: string | null
          philosophy: string | null
          relationships: string | null
          updated_at: string | null
          user_id: string
          vision: string | null
          work_edu: string | null
        }
        Insert: {
          embedding?: string | null
          finances?: string | null
          identity?: string | null
          importance_score?: number | null
          knowledge?: string | null
          philosophy?: string | null
          relationships?: string | null
          updated_at?: string | null
          user_id: string
          vision?: string | null
          work_edu?: string | null
        }
        Update: {
          embedding?: string | null
          finances?: string | null
          identity?: string | null
          importance_score?: number | null
          knowledge?: string | null
          philosophy?: string | null
          relationships?: string | null
          updated_at?: string | null
          user_id?: string
          vision?: string | null
          work_edu?: string | null
        }
        Relationships: []
      }
      user_portions: {
        Row: {
          created_at: string | null
          grams: number
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          grams: number
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          grams?: number
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          disciplined_streak: number | null
          home_lat: number | null
          home_lng: number | null
          oura_token: string | null
          todoist_project_id: string | null
          total_disciplined_days: number | null
          updated_at: string | null
          user_id: string
          yazio_password: string | null
          yazio_token: string | null
          yazio_username: string | null
        }
        Insert: {
          disciplined_streak?: number | null
          home_lat?: number | null
          home_lng?: number | null
          oura_token?: string | null
          todoist_project_id?: string | null
          total_disciplined_days?: number | null
          updated_at?: string | null
          user_id: string
          yazio_password?: string | null
          yazio_token?: string | null
          yazio_username?: string | null
        }
        Update: {
          disciplined_streak?: number | null
          home_lat?: number | null
          home_lng?: number | null
          oura_token?: string | null
          todoist_project_id?: string | null
          total_disciplined_days?: number | null
          updated_at?: string | null
          user_id?: string
          yazio_password?: string | null
          yazio_token?: string | null
          yazio_username?: string | null
        }
        Relationships: []
      }
      vanguard_behavioral_patterns: {
        Row: {
          confidence: number | null
          created_at: string
          evidence_text: string
          first_seen: string | null
          id: string
          last_seen: string | null
          metadata: Json | null
          occurrence_count: number | null
          pattern_type: string
          signature: string
          status: string | null
          title: string | null
          updated_at: string
          user_id: string
          user_notes: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          evidence_text: string
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          metadata?: Json | null
          occurrence_count?: number | null
          pattern_type: string
          signature: string
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          user_notes?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          evidence_text?: string
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          metadata?: Json | null
          occurrence_count?: number | null
          pattern_type?: string
          signature?: string
          status?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          user_notes?: string | null
        }
        Relationships: []
      }
      vanguard_calendar: {
        Row: {
          category: string | null
          created_at: string | null
          end_time: string | null
          event_id: string | null
          id: string
          start_time: string | null
          summary: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          end_time?: string | null
          event_id?: string | null
          id?: string
          start_time?: string | null
          summary?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          end_time?: string | null
          event_id?: string | null
          id?: string
          start_time?: string | null
          summary?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      vanguard_curiosity_queue: {
        Row: {
          category: string | null
          confidence_score: number | null
          created_at: string | null
          evidence_count: number | null
          hypothesis: string
          id: string
          provocation: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          evidence_count?: number | null
          hypothesis: string
          id?: string
          provocation: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string | null
          confidence_score?: number | null
          created_at?: string | null
          evidence_count?: number | null
          hypothesis?: string
          id?: string
          provocation?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      vanguard_daily_aggregates: {
        Row: {
          date: string
          dopamine_load_index: number | null
          execution_score: number | null
          final_state: string | null
          fragmentation_index: number | null
          hrv_avg: number | null
          id: string
          identity_score: number | null
          power_list_result: string | null
          readiness_score: number | null
          rhr_avg: number | null
          screen_time_min: number | null
          sleep_hours: number | null
          state_confidence: number | null
          strava_activities_json: Json | null
          temp_deviation: number | null
          user_id: string | null
        }
        Insert: {
          date: string
          dopamine_load_index?: number | null
          execution_score?: number | null
          final_state?: string | null
          fragmentation_index?: number | null
          hrv_avg?: number | null
          id?: string
          identity_score?: number | null
          power_list_result?: string | null
          readiness_score?: number | null
          rhr_avg?: number | null
          screen_time_min?: number | null
          sleep_hours?: number | null
          state_confidence?: number | null
          strava_activities_json?: Json | null
          temp_deviation?: number | null
          user_id?: string | null
        }
        Update: {
          date?: string
          dopamine_load_index?: number | null
          execution_score?: number | null
          final_state?: string | null
          fragmentation_index?: number | null
          hrv_avg?: number | null
          id?: string
          identity_score?: number | null
          power_list_result?: string | null
          readiness_score?: number | null
          rhr_avg?: number | null
          screen_time_min?: number | null
          sleep_hours?: number | null
          state_confidence?: number | null
          strava_activities_json?: Json | null
          temp_deviation?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      vanguard_entity_aliases: {
        Row: {
          alias: string
          canonical: string
          created_at: string | null
          id: string
          reason: string | null
          user_id: string | null
        }
        Insert: {
          alias: string
          canonical: string
          created_at?: string | null
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Update: {
          alias?: string
          canonical?: string
          created_at?: string | null
          id?: string
          reason?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      vanguard_entity_links: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          embedding: string | null
          evidence_count: number | null
          fact_text: string | null
          first_seen: string | null
          id: string
          last_seen: string | null
          layer: string | null
          memory_type: string | null
          metadata: Json | null
          observed_at: string | null
          relation: string
          source_entity: string
          source_episode_id: string | null
          source_type: string
          status: string | null
          superseded_by: string | null
          target_entity: string
          target_type: string
          temporal_status: string | null
          user_id: string | null
          valid_from: string | null
          valid_until: string | null
          weight: number | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          embedding?: string | null
          evidence_count?: number | null
          fact_text?: string | null
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          layer?: string | null
          memory_type?: string | null
          metadata?: Json | null
          observed_at?: string | null
          relation: string
          source_entity: string
          source_episode_id?: string | null
          source_type: string
          status?: string | null
          superseded_by?: string | null
          target_entity: string
          target_type: string
          temporal_status?: string | null
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          weight?: number | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          embedding?: string | null
          evidence_count?: number | null
          fact_text?: string | null
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          layer?: string | null
          memory_type?: string | null
          metadata?: Json | null
          observed_at?: string | null
          relation?: string
          source_entity?: string
          source_episode_id?: string | null
          source_type?: string
          status?: string | null
          superseded_by?: string | null
          target_entity?: string
          target_type?: string
          temporal_status?: string | null
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vanguard_entity_links_relation_fkey"
            columns: ["relation"]
            isOneToOne: false
            referencedRelation: "vanguard_relation_ontology"
            referencedColumns: ["relation"]
          },
          {
            foreignKeyName: "vanguard_entity_links_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "vanguard_entity_links"
            referencedColumns: ["id"]
          },
        ]
      }
      vanguard_eval_questions: {
        Row: {
          category: string | null
          created_at: string
          difficulty: string
          expected_answer: string | null
          expected_claims: Json
          expected_sources: Json
          id: string
          is_active: boolean
          metadata: Json
          question: string
          suite: string
          tags: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          difficulty?: string
          expected_answer?: string | null
          expected_claims?: Json
          expected_sources?: Json
          id?: string
          is_active?: boolean
          metadata?: Json
          question: string
          suite?: string
          tags?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          difficulty?: string
          expected_answer?: string | null
          expected_claims?: Json
          expected_sources?: Json
          id?: string
          is_active?: boolean
          metadata?: Json
          question?: string
          suite?: string
          tags?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vanguard_eval_results: {
        Row: {
          answer: string | null
          category: string | null
          claims: Json
          created_at: string
          difficulty: string | null
          id: string
          judge_notes: string | null
          passed: boolean | null
          question: string
          question_id: string | null
          raw_response: Json
          run_id: string
          score: number | null
          sources: Json
          user_id: string
        }
        Insert: {
          answer?: string | null
          category?: string | null
          claims?: Json
          created_at?: string
          difficulty?: string | null
          id?: string
          judge_notes?: string | null
          passed?: boolean | null
          question: string
          question_id?: string | null
          raw_response?: Json
          run_id: string
          score?: number | null
          sources?: Json
          user_id: string
        }
        Update: {
          answer?: string | null
          category?: string | null
          claims?: Json
          created_at?: string
          difficulty?: string | null
          id?: string
          judge_notes?: string | null
          passed?: boolean | null
          question?: string
          question_id?: string | null
          raw_response?: Json
          run_id?: string
          score?: number | null
          sources?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vanguard_eval_results_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "vanguard_eval_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vanguard_eval_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "vanguard_eval_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      vanguard_eval_runs: {
        Row: {
          completed_at: string | null
          id: string
          model: string | null
          oracle_version: string | null
          started_at: string
          status: string
          suite: string
          summary: Json
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          model?: string | null
          oracle_version?: string | null
          started_at?: string
          status?: string
          suite?: string
          summary?: Json
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          model?: string | null
          oracle_version?: string | null
          started_at?: string
          status?: string
          suite?: string
          summary?: Json
          user_id?: string
        }
        Relationships: []
      }
      vanguard_feedback: {
        Row: {
          correction: string | null
          created_at: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          query: string | null
          reply: string | null
          score: number | null
          user_id: string | null
        }
        Insert: {
          correction?: string | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          query?: string | null
          reply?: string | null
          score?: number | null
          user_id?: string | null
        }
        Update: {
          correction?: string | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          query?: string | null
          reply?: string | null
          score?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      vanguard_footprint: {
        Row: {
          category: string
          id: string
          payload: Json
          timestamp: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          id?: string
          payload: Json
          timestamp?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          id?: string
          payload?: Json
          timestamp?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      vanguard_identity: {
        Row: {
          avoidance_triggers: Json | null
          behavioral_baseline: Json | null
          long_term_mission: string | null
          pillars: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avoidance_triggers?: Json | null
          behavioral_baseline?: Json | null
          long_term_mission?: string | null
          pillars?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avoidance_triggers?: Json | null
          behavioral_baseline?: Json | null
          long_term_mission?: string | null
          pillars?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vanguard_iron_rules: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          rule_key: string
          rule_text: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          rule_key: string
          rule_text: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          rule_key?: string
          rule_text?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: []
      }
      vanguard_knowledge: {
        Row: {
          category: string | null
          content: string | null
          created_at: string | null
          embedding: string | null
          id: string
          importance_score: number | null
          is_verified: boolean | null
          metadata: Json | null
          source_type: string | null
          tags: string[] | null
          title: string | null
          user_id: string | null
          valid_until: string | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          importance_score?: number | null
          is_verified?: boolean | null
          metadata?: Json | null
          source_type?: string | null
          tags?: string[] | null
          title?: string | null
          user_id?: string | null
          valid_until?: string | null
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          importance_score?: number | null
          is_verified?: boolean | null
          metadata?: Json | null
          source_type?: string | null
          tags?: string[] | null
          title?: string | null
          user_id?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      vanguard_links: {
        Row: {
          category: string
          channel_name: string | null
          created_at: string
          description: string
          domain: string
          id: string
          notes: string
          pillar: string | null
          resource_type: string | null
          status: string
          takeaways: string[]
          thumbnail_url: string | null
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          category?: string
          channel_name?: string | null
          created_at?: string
          description?: string
          domain?: string
          id?: string
          notes?: string
          pillar?: string | null
          resource_type?: string | null
          status?: string
          takeaways?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          category?: string
          channel_name?: string | null
          created_at?: string
          description?: string
          domain?: string
          id?: string
          notes?: string
          pillar?: string | null
          resource_type?: string | null
          status?: string
          takeaways?: string[]
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      vanguard_notes: {
        Row: {
          color: string
          content: string
          created_at: string
          id: string
          is_archived: boolean
          is_pinned: boolean
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          content?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          tags?: string[]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          content?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vanguard_oracle_runs: {
        Row: {
          answer: string | null
          claims: Json | null
          confidence: string | null
          created_at: string | null
          id: string
          intent: string | null
          query: string
          retrieved_context: Json | null
          sources: Json | null
          state_vector: Json | null
          user_id: string | null
        }
        Insert: {
          answer?: string | null
          claims?: Json | null
          confidence?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          query: string
          retrieved_context?: Json | null
          sources?: Json | null
          state_vector?: Json | null
          user_id?: string | null
        }
        Update: {
          answer?: string | null
          claims?: Json | null
          confidence?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          query?: string
          retrieved_context?: Json | null
          sources?: Json | null
          state_vector?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      vanguard_pattern_feedback: {
        Row: {
          created_at: string | null
          feedback: string
          id: string
          pattern_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feedback: string
          id?: string
          pattern_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          feedback?: string
          id?: string
          pattern_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vanguard_pattern_feedback_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "vanguard_behavioral_patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      vanguard_preferences: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          key: string
          updated_at: string | null
          user_id: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key: string
          updated_at?: string | null
          user_id?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key?: string
          updated_at?: string | null
          user_id?: string | null
          value?: string
        }
        Relationships: []
      }
      vanguard_raw_events: {
        Row: {
          event_type: string
          id: string
          ingested_at: string
          language: string
          metadata: Json
          occurred_at: string | null
          payload: Json
          processing_status: string
          raw_hash: string | null
          raw_text: string | null
          schema_version: number
          source: string
          source_ref: string | null
          user_id: string
        }
        Insert: {
          event_type?: string
          id?: string
          ingested_at?: string
          language?: string
          metadata?: Json
          occurred_at?: string | null
          payload?: Json
          processing_status?: string
          raw_hash?: string | null
          raw_text?: string | null
          schema_version?: number
          source: string
          source_ref?: string | null
          user_id: string
        }
        Update: {
          event_type?: string
          id?: string
          ingested_at?: string
          language?: string
          metadata?: Json
          occurred_at?: string | null
          payload?: Json
          processing_status?: string
          raw_hash?: string | null
          raw_text?: string | null
          schema_version?: number
          source?: string
          source_ref?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vanguard_relation_ontology: {
        Row: {
          created_at: string | null
          description: string | null
          relation: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          relation: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          relation?: string
        }
        Relationships: []
      }
      vanguard_singleton_relations: {
        Row: {
          description: string | null
          relation: string
        }
        Insert: {
          description?: string | null
          relation: string
        }
        Update: {
          description?: string | null
          relation?: string
        }
        Relationships: []
      }
      vanguard_stream: {
        Row: {
          category: string | null
          classification: string | null
          content: string | null
          created_at: string | null
          embedding: string | null
          id: string
          importance_score: number | null
          metadata: Json | null
          situation_fingerprint: string | null
          source: string | null
          tags: string[] | null
          timestamp: string | null
          user_id: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          category?: string | null
          classification?: string | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          importance_score?: number | null
          metadata?: Json | null
          situation_fingerprint?: string | null
          source?: string | null
          tags?: string[] | null
          timestamp?: string | null
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          category?: string | null
          classification?: string | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          importance_score?: number | null
          metadata?: Json | null
          situation_fingerprint?: string | null
          source?: string | null
          tags?: string[] | null
          timestamp?: string | null
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      vanguard_stream_closure_proposals: {
        Row: {
          closed_topic_description: string
          created_at: string
          id: string
          proposed_by_record_id: string | null
          resolved_at: string | null
          similarity_threshold: number
          status: string
          target_record_ids: string[]
          user_id: string
        }
        Insert: {
          closed_topic_description: string
          created_at?: string
          id?: string
          proposed_by_record_id?: string | null
          resolved_at?: string | null
          similarity_threshold?: number
          status?: string
          target_record_ids: string[]
          user_id: string
        }
        Update: {
          closed_topic_description?: string
          created_at?: string
          id?: string
          proposed_by_record_id?: string | null
          resolved_at?: string | null
          similarity_threshold?: number
          status?: string
          target_record_ids?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vanguard_stream_closure_proposals_proposed_by_record_id_fkey"
            columns: ["proposed_by_record_id"]
            isOneToOne: false
            referencedRelation: "v_friction_pipeline_status"
            referencedColumns: ["stream_id"]
          },
          {
            foreignKeyName: "vanguard_stream_closure_proposals_proposed_by_record_id_fkey"
            columns: ["proposed_by_record_id"]
            isOneToOne: false
            referencedRelation: "vanguard_stream"
            referencedColumns: ["id"]
          },
        ]
      }
      vanguard_tokens: {
        Row: {
          provider: string
          refresh_token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          provider: string
          refresh_token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          provider?: string
          refresh_token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vanguard_wiki_pages: {
        Row: {
          confidence: number
          content_md: string
          created_at: string
          first_seen_at: string | null
          id: string
          last_compiled_at: string
          last_seen_at: string | null
          metadata: Json
          page_type: string
          slug: string
          source_refs: Json
          status: string
          summary: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          content_md?: string
          created_at?: string
          first_seen_at?: string | null
          id?: string
          last_compiled_at?: string
          last_seen_at?: string | null
          metadata?: Json
          page_type?: string
          slug: string
          source_refs?: Json
          status?: string
          summary?: string
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          content_md?: string
          created_at?: string
          first_seen_at?: string | null
          id?: string
          last_compiled_at?: string
          last_seen_at?: string | null
          metadata?: Json
          page_type?: string
          slug?: string
          source_refs?: Json
          status?: string
          summary?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vanguard_wiki_review_items: {
        Row: {
          action: string | null
          created_at: string
          detail: string
          id: string
          item_type: string
          metadata: Json
          page_id: string | null
          severity: string
          source_refs: Json
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action?: string | null
          created_at?: string
          detail: string
          id?: string
          item_type: string
          metadata?: Json
          page_id?: string | null
          severity?: string
          source_refs?: Json
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string | null
          created_at?: string
          detail?: string
          id?: string
          item_type?: string
          metadata?: Json
          page_id?: string | null
          severity?: string
          source_refs?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vanguard_wiki_review_items_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "vanguard_wiki_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      vanguard_wiki_runs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          metadata: Json
          mode: string
          pages_upserted: number
          review_created: number
          source_window: Json
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          mode?: string
          pages_upserted?: number
          review_created?: number
          source_window?: Json
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          mode?: string
          pages_upserted?: number
          review_created?: number
          source_window?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      vanguard_wiki_sources: {
        Row: {
          created_at: string
          id: string
          page_id: string
          quote: string | null
          relevance: number
          source_date: string | null
          source_id: string
          source_table: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_id: string
          quote?: string | null
          relevance?: number
          source_date?: string | null
          source_id: string
          source_table: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_id?: string
          quote?: string | null
          relevance?: number
          source_date?: string | null
          source_id?: string
          source_table?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vanguard_wiki_sources_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "vanguard_wiki_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      vision_board_items: {
        Row: {
          color: string
          content: string
          created_at: string
          id: string
          sort_order: number
          type: string
          user_id: string
        }
        Insert: {
          color?: string
          content: string
          created_at?: string
          id?: string
          sort_order?: number
          type?: string
          user_id: string
        }
        Update: {
          color?: string
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_kpi_reviews: {
        Row: {
          ai_brief: Json | null
          created_at: string | null
          id: string
          user_id: string
          week_start: string
          what_didnt_work: string | null
          what_worked: string | null
        }
        Insert: {
          ai_brief?: Json | null
          created_at?: string | null
          id?: string
          user_id: string
          week_start: string
          what_didnt_work?: string | null
          what_worked?: string | null
        }
        Update: {
          ai_brief?: Json | null
          created_at?: string | null
          id?: string
          user_id?: string
          week_start?: string
          what_didnt_work?: string | null
          what_worked?: string | null
        }
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          ai_recap: Json | null
          bottleneck: string | null
          created_at: string | null
          deepening_answers: Json | null
          do_differently: string | null
          embedding: string | null
          focus_goal_mappings: Json | null
          focus_task_ids: string[] | null
          id: string
          importance_score: number | null
          new_belief: string | null
          obligation: string | null
          pillar_scores: Json | null
          proud_of: string | null
          review_completed_at: string | null
          sabotage: string | null
          user_id: string | null
          week_commitment: string | null
          week_focus: string | null
          week_goal_cialo: string | null
          week_goal_duch: string | null
          week_goal_konto: string | null
          week_highlight: string | null
          week_intention: string | null
          week_regret: string | null
          week_sentiment: string | null
          week_start: string
        }
        Insert: {
          ai_recap?: Json | null
          bottleneck?: string | null
          created_at?: string | null
          deepening_answers?: Json | null
          do_differently?: string | null
          embedding?: string | null
          focus_goal_mappings?: Json | null
          focus_task_ids?: string[] | null
          id?: string
          importance_score?: number | null
          new_belief?: string | null
          obligation?: string | null
          pillar_scores?: Json | null
          proud_of?: string | null
          review_completed_at?: string | null
          sabotage?: string | null
          user_id?: string | null
          week_commitment?: string | null
          week_focus?: string | null
          week_goal_cialo?: string | null
          week_goal_duch?: string | null
          week_goal_konto?: string | null
          week_highlight?: string | null
          week_intention?: string | null
          week_regret?: string | null
          week_sentiment?: string | null
          week_start: string
        }
        Update: {
          ai_recap?: Json | null
          bottleneck?: string | null
          created_at?: string | null
          deepening_answers?: Json | null
          do_differently?: string | null
          embedding?: string | null
          focus_goal_mappings?: Json | null
          focus_task_ids?: string[] | null
          id?: string
          importance_score?: number | null
          new_belief?: string | null
          obligation?: string | null
          pillar_scores?: Json | null
          proud_of?: string | null
          review_completed_at?: string | null
          sabotage?: string | null
          user_id?: string | null
          week_commitment?: string | null
          week_focus?: string | null
          week_goal_cialo?: string | null
          week_goal_duch?: string | null
          week_goal_konto?: string | null
          week_highlight?: string | null
          week_intention?: string | null
          week_regret?: string | null
          week_sentiment?: string | null
          week_start?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          created_at: string | null
          date: string | null
          duration_minutes: number | null
          embedding: string | null
          end_time: string | null
          hr_avg_bpm: number | null
          hr_kcal_est: number | null
          hr_peak_bpm: number | null
          hr_rescored_at: string | null
          hr_strain_score: number | null
          id: string
          importance_score: number | null
          msp_passed: boolean | null
          session_notes: string | null
          session_rpe: number | null
          start_time: string | null
          user_id: string | null
          workout_day: string
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          duration_minutes?: number | null
          embedding?: string | null
          end_time?: string | null
          hr_avg_bpm?: number | null
          hr_kcal_est?: number | null
          hr_peak_bpm?: number | null
          hr_rescored_at?: string | null
          hr_strain_score?: number | null
          id?: string
          importance_score?: number | null
          msp_passed?: boolean | null
          session_notes?: string | null
          session_rpe?: number | null
          start_time?: string | null
          user_id?: string | null
          workout_day: string
        }
        Update: {
          created_at?: string | null
          date?: string | null
          duration_minutes?: number | null
          embedding?: string | null
          end_time?: string | null
          hr_avg_bpm?: number | null
          hr_kcal_est?: number | null
          hr_peak_bpm?: number | null
          hr_rescored_at?: string | null
          hr_strain_score?: number | null
          id?: string
          importance_score?: number | null
          msp_passed?: boolean | null
          session_notes?: string | null
          session_rpe?: number | null
          start_time?: string | null
          user_id?: string | null
          workout_day?: string
        }
        Relationships: []
      }
    }
    Views: {
      confirmed_friction_events: {
        Row: {
          actual_behavior: string | null
          confidence: number | null
          confidence_source: string | null
          context: Json | null
          cost_estimate: string | null
          created_at: string | null
          declared_intention: string | null
          deviation: string | null
          emotional_state: string | null
          event_kind: string | null
          extraction_quality: number | null
          extraction_quality_score: number | null
          friction_type: string | null
          id: string | null
          immediate_cost: string | null
          last_reviewed_at: string | null
          later_cost: string | null
          location_context: string | null
          occurred_at: string | null
          parser_version: string | null
          people_involved: string[] | null
          raw_text: string | null
          review_notes: string | null
          review_status: string | null
          status: string | null
          stream_record_id: string | null
          user_id: string | null
        }
        Insert: {
          actual_behavior?: string | null
          confidence?: number | null
          confidence_source?: string | null
          context?: Json | null
          cost_estimate?: string | null
          created_at?: string | null
          declared_intention?: string | null
          deviation?: string | null
          emotional_state?: string | null
          event_kind?: string | null
          extraction_quality?: number | null
          extraction_quality_score?: number | null
          friction_type?: string | null
          id?: string | null
          immediate_cost?: string | null
          last_reviewed_at?: string | null
          later_cost?: string | null
          location_context?: string | null
          occurred_at?: string | null
          parser_version?: string | null
          people_involved?: string[] | null
          raw_text?: string | null
          review_notes?: string | null
          review_status?: string | null
          status?: string | null
          stream_record_id?: string | null
          user_id?: string | null
        }
        Update: {
          actual_behavior?: string | null
          confidence?: number | null
          confidence_source?: string | null
          context?: Json | null
          cost_estimate?: string | null
          created_at?: string | null
          declared_intention?: string | null
          deviation?: string | null
          emotional_state?: string | null
          event_kind?: string | null
          extraction_quality?: number | null
          extraction_quality_score?: number | null
          friction_type?: string | null
          id?: string | null
          immediate_cost?: string | null
          last_reviewed_at?: string | null
          later_cost?: string | null
          location_context?: string | null
          occurred_at?: string | null
          parser_version?: string | null
          people_involved?: string[] | null
          raw_text?: string | null
          review_notes?: string | null
          review_status?: string | null
          status?: string | null
          stream_record_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friction_events_stream_record_id_fkey"
            columns: ["stream_record_id"]
            isOneToOne: false
            referencedRelation: "v_friction_pipeline_status"
            referencedColumns: ["stream_id"]
          },
          {
            foreignKeyName: "friction_events_stream_record_id_fkey"
            columns: ["stream_record_id"]
            isOneToOne: false
            referencedRelation: "vanguard_stream"
            referencedColumns: ["id"]
          },
        ]
      }
      oura_hr_zones_daily: {
        Row: {
          day: string | null
          hr_max: number | null
          hr_min: number | null
          odczytow: number | null
          spoczynek_min: number | null
          user_id: string | null
          z1_regen_min: number | null
          z2_tlenowa_min: number | null
          z3_tempo_min: number | null
          z4_prog_min: number | null
          z5_max_min: number | null
        }
        Relationships: []
      }
      strain_correlations: {
        Row: {
          fueling_to_hr_biegu: number | null
          kcal_to_rpe: number | null
          n_dni: number | null
          nogi_to_jutro_hr_biegu: number | null
          nogi_to_jutro_kadencja: number | null
          sen_to_readiness: number | null
          strain_to_jutro_hrv: number | null
          strain_to_jutro_readiness: number | null
          user_id: string | null
          wegle_to_rpe: number | null
        }
        Relationships: []
      }
      strava_activities_clean: {
        Row: {
          achievement_count: number | null
          average_speed: number | null
          best_efforts: Json | null
          cadence_spm: number | null
          distance: number | null
          elapsed_time: number | null
          gc_activity_id: number | null
          gc_enriched_at: string | null
          gc_hr_zones: Json | null
          gc_laps: Json | null
          gc_training_effect_aerobic: number | null
          gc_training_effect_anaerobic: number | null
          gc_vo2max: number | null
          gc_weather: Json | null
          gear_distance_km: number | null
          gear_name: string | null
          has_pr: boolean | null
          hr_avg: number | null
          hr_frozen: boolean | null
          hr_max: number | null
          hr_source: string | null
          is_oura: boolean | null
          manual: boolean | null
          max_speed: number | null
          moving_time: number | null
          name: string | null
          pace_sec_per_km: number | null
          pause_seconds: number | null
          perceived_exertion: number | null
          splits_with_hr: Json | null
          sport_type: string | null
          start_date: string | null
          strava_id: number | null
          suffer_score: number | null
          synced_at: string | null
          total_elevation_gain: number | null
          user_id: string | null
          workout_type: number | null
        }
        Relationships: []
      }
      v_friction_daily_qa: {
        Row: {
          avg_confidence: number | null
          extraction_rate_pct: number | null
          friction_created: number | null
          no_friction_count: number | null
          report_date: string | null
          status_dismissed: number | null
          status_raw: number | null
          stream_total: number | null
          t_avoidance: number | null
          t_other: number | null
          t_positive: number | null
          t_procrastination: number | null
          t_sleep: number | null
          t_social_hesitation: number | null
          t_training: number | null
          with_cost: number | null
          without_cost: number | null
        }
        Relationships: []
      }
      v_friction_debug: {
        Row: {
          actual_behavior: string | null
          confidence: number | null
          confidence_source: string | null
          declared_intention: string | null
          deviation: string | null
          emotional_state: string | null
          friction_created_at: string | null
          friction_type: string | null
          id: string | null
          immediate_cost: string | null
          later_cost: string | null
          location_context: string | null
          occurred_at: string | null
          people_involved: string[] | null
          raw_text: string | null
          status: string | null
          stream_category: string | null
          stream_content: string | null
          stream_created_at: string | null
          stream_record_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friction_events_stream_record_id_fkey"
            columns: ["stream_record_id"]
            isOneToOne: false
            referencedRelation: "v_friction_pipeline_status"
            referencedColumns: ["stream_id"]
          },
          {
            foreignKeyName: "friction_events_stream_record_id_fkey"
            columns: ["stream_record_id"]
            isOneToOne: false
            referencedRelation: "vanguard_stream"
            referencedColumns: ["id"]
          },
        ]
      }
      v_friction_pipeline_status: {
        Row: {
          actual_behavior: string | null
          category: string | null
          confidence: number | null
          confidence_source: string | null
          content_preview: string | null
          declared_intention: string | null
          deviation: string | null
          friction_status: string | null
          friction_type: string | null
          has_friction_event: boolean | null
          immediate_cost: string | null
          potential_hallucinated_cost: boolean | null
          review_status: string | null
          stream_at: string | null
          stream_id: string | null
        }
        Relationships: []
      }
      v_friction_review: {
        Row: {
          actual_behavior: string | null
          confidence: number | null
          confidence_source: string | null
          declared_intention: string | null
          deviation: string | null
          emotional_state: string | null
          friction_type: string | null
          id: string | null
          immediate_cost: string | null
          later_cost: string | null
          occurred_at: string | null
          people_involved: string[] | null
          pipeline_status: string | null
          raw_text: string | null
          review_status: string | null
          stream_category: string | null
          stream_content: string | null
          stream_created_at: string | null
        }
        Relationships: []
      }
      v_graph_temporal_guard: {
        Row: {
          edge_count: number | null
          retrieval_status: string | null
          status: string | null
          temporal_status: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _recompute_daily_nutrition: {
        Args: { p_date: string; p_user_id: string }
        Returns: undefined
      }
      add_food_entry: {
        Args: {
          p_date: string
          p_entry: Json
          p_grams: number
          p_user_id: string
        }
        Returns: string
      }
      cache_food_to_library: {
        Args: {
          p_barcode: string
          p_brand: string
          p_calories: number
          p_carbs: number
          p_default_grams: number
          p_fat: number
          p_fiber: number
          p_name: string
          p_protein: number
          p_sugar: number
          p_user_id: string
        }
        Returns: undefined
      }
      deprecate_superseded_facts: {
        Args: {
          p_new_confidence: number
          p_new_episode_id?: string
          p_new_target: string
          p_relation: string
          p_source: string
          p_user_id: string
        }
        Returns: number
      }
      find_entity_seeds_by_embedding: {
        Args: {
          match_count?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          best_similarity: number
          entity_name: string
        }[]
      }
      find_mentioned_entities: {
        Args: { query_text: string; user_id_param: string }
        Returns: {
          entity_name: string
        }[]
      }
      get_brain_health_report: {
        Args: { user_id_param: string }
        Returns: {
          coverage_percent: number
          embedded_records: number
          table_name: string
          total_records: number
        }[]
      }
      get_desktop_dashboard_data: { Args: { p_user_id: string }; Returns: Json }
      get_vanguard_graph_context: {
        Args: {
          max_depth?: number
          p_as_of?: string
          p_include_historical?: boolean
          p_layer?: string
          p_min_confidence?: number
          start_entities: string[]
          user_id_param?: string
        }
        Returns: {
          confidence_score: number
          depth: number
          evidence_count: number
          fact_text: string
          layer: string
          path: string[]
          relation: string
          source_entity: string
          status: string
          target_entity: string
        }[]
      }
      increment_kpi_entry_for_week: {
        Args: { p_delta: number; p_kpi_id: string; p_week_start: string }
        Returns: undefined
      }
      match_vanguard_content: {
        Args: {
          match_count: number
          match_threshold: number
          max_age_days?: number
          query_embedding: string
          user_id_param: string
        }
        Returns: {
          content: string
          hybrid_score: number
          id: string
          importance_score: number
          similarity: number
          source_date: string
          table_name: string
        }[]
      }
      remove_food_entry: {
        Args: { p_entry_id: string; p_user_id: string }
        Returns: undefined
      }
      repeat_food_entry: {
        Args: { p_date: string; p_source_entry_id: string; p_user_id: string }
        Returns: string
      }
      replace_calendar_window: {
        Args: {
          p_category: string
          p_end: string
          p_events: Json
          p_start: string
          p_user_id: string
        }
        Returns: undefined
      }
      save_food_correction: {
        Args: {
          p_corrected_grams: number
          p_corrected_name?: string
          p_query_name: string
          p_user_id: string
        }
        Returns: undefined
      }
      save_workout_atomic: {
        Args: {
          p_day_key: string
          p_end_time: string
          p_logs: Json
          p_msp_passed: boolean
          p_notes: string
          p_session_rpe?: number
          p_start_time: string
          p_user_id: string
        }
        Returns: string
      }
      sync_friction_proposals: {
        Args: { p_user_id: string }
        Returns: number
      }
      search_entity_links: {
        Args: {
          match_count?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          confidence_score: number
          evidence_count: number
          fact_text: string
          memory_type: string
          relation: string
          similarity: number
          source_entity: string
          source_type: string
          target_entity: string
          target_type: string
        }[]
      }
      search_entity_links_fulltext: {
        Args: {
          match_count?: number
          match_user_id: string
          query_text: string
        }
        Returns: {
          evidence_count: number
          fact_text: string
          rank: number
          relation: string
          source_entity: string
          source_type: string
          target_entity: string
          target_type: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      update_food_entry: {
        Args: { p_entry: Json; p_entry_id: string; p_user_id: string }
        Returns: undefined
      }
      upsert_vanguard_entity_link: {
        Args: {
          p_confidence_score?: number
          p_layer?: string
          p_memory_type?: string
          p_metadata?: Json
          p_observed_at?: string
          p_relation?: string
          p_source: string
          p_source_episode_id?: string
          p_source_type?: string
          p_target?: string
          p_target_type?: string
          p_user_id: string
        }
        Returns: undefined
      }
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
