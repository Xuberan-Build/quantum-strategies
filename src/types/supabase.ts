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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action_type: string
          admin_email: string
          admin_user_id: string
          created_at: string | null
          id: string
          ip_address: string | null
          new_value: Json | null
          previous_value: Json | null
          target_id: string | null
          target_name: string | null
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          admin_email: string
          admin_user_id: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          previous_value?: Json | null
          target_id?: string | null
          target_name?: string | null
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          admin_email?: string
          admin_user_id?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          new_value?: Json | null
          previous_value?: Json | null
          target_id?: string | null
          target_name?: string | null
          target_type?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_transactions: {
        Row: {
          amount_cents: number
          commission_status: string | null
          created_at: string | null
          dinner_party_contribution_cents: number | null
          direct_commission_cents: number | null
          direct_referrer_id: string | null
          direct_track: string | null
          direct_transfer_id: string | null
          id: string
          override_commission_cents: number | null
          override_referrer_id: string | null
          override_track: string | null
          override_transfer_id: string | null
          processed_at: string | null
          product_slug: string
          purchaser_id: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string
        }
        Insert: {
          amount_cents: number
          commission_status?: string | null
          created_at?: string | null
          dinner_party_contribution_cents?: number | null
          direct_commission_cents?: number | null
          direct_referrer_id?: string | null
          direct_track?: string | null
          direct_transfer_id?: string | null
          id?: string
          override_commission_cents?: number | null
          override_referrer_id?: string | null
          override_track?: string | null
          override_transfer_id?: string | null
          processed_at?: string | null
          product_slug: string
          purchaser_id: string
          stripe_payment_intent_id?: string | null
          stripe_session_id: string
        }
        Update: {
          amount_cents?: number
          commission_status?: string | null
          created_at?: string | null
          dinner_party_contribution_cents?: number | null
          direct_commission_cents?: number | null
          direct_referrer_id?: string | null
          direct_track?: string | null
          direct_transfer_id?: string | null
          id?: string
          override_commission_cents?: number | null
          override_referrer_id?: string | null
          override_track?: string | null
          override_transfer_id?: string | null
          processed_at?: string | null
          product_slug?: string
          purchaser_id?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_transactions_direct_referrer_id_fkey"
            columns: ["direct_referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_transactions_override_referrer_id_fkey"
            columns: ["override_referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_transactions_purchaser_id_fkey"
            columns: ["purchaser_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      alignment_ledger: {
        Row: {
          actions_shipped: string
          decisions_made: string
          drift_detected: string
          id: string
          signal_logged: string
          submitted_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          actions_shipped: string
          decisions_made: string
          drift_detected: string
          id?: string
          signal_logged: string
          submitted_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          actions_shipped?: string
          decisions_made?: string
          drift_detected?: string
          id?: string
          signal_logged?: string
          submitted_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          error_code: string | null
          error_message: string | null
          error_stack: string | null
          event_action: string
          event_status: string | null
          event_type: string
          id: string
          ip_address: string | null
          is_sampled: boolean | null
          log_level: string | null
          metadata: Json | null
          request_path: string | null
          session_id: string | null
          trace_id: string | null
          user_agent: string | null
          user_email: string | null
          user_email_hash: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_message?: string | null
          error_stack?: string | null
          event_action: string
          event_status?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          is_sampled?: boolean | null
          log_level?: string | null
          metadata?: Json | null
          request_path?: string | null
          session_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_email_hash?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_message?: string | null
          error_stack?: string | null
          event_action?: string
          event_status?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          is_sampled?: boolean | null
          log_level?: string | null
          metadata?: Json | null
          request_path?: string | null
          session_id?: string | null
          trace_id?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_email_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_conversion_results: {
        Row: {
          amount_paid: number | null
          beta_participant_id: string
          created_at: string
          decision: string
          decision_made_at: string | null
          decline_feedback: string | null
          decline_reason: string | null
          discount_amount: number | null
          discount_code_offered: string | null
          final_total_investment: number | null
          follow_up_date: string | null
          follow_up_scheduled: boolean | null
          future_interest: boolean | null
          id: string
          offer_amount: number
          offer_presented_at: string
          offer_type: string
          payment_plan: string | null
          purchased_at: string | null
          purchased_at_stage: string | null
          stripe_session_id: string | null
          total_paid_before_offer: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          beta_participant_id: string
          created_at?: string
          decision: string
          decision_made_at?: string | null
          decline_feedback?: string | null
          decline_reason?: string | null
          discount_amount?: number | null
          discount_code_offered?: string | null
          final_total_investment?: number | null
          follow_up_date?: string | null
          follow_up_scheduled?: boolean | null
          future_interest?: boolean | null
          id?: string
          offer_amount: number
          offer_presented_at: string
          offer_type?: string
          payment_plan?: string | null
          purchased_at?: string | null
          purchased_at_stage?: string | null
          stripe_session_id?: string | null
          total_paid_before_offer?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          beta_participant_id?: string
          created_at?: string
          decision?: string
          decision_made_at?: string | null
          decline_feedback?: string | null
          decline_reason?: string | null
          discount_amount?: number | null
          discount_code_offered?: string | null
          final_total_investment?: number | null
          follow_up_date?: string | null
          follow_up_scheduled?: boolean | null
          future_interest?: boolean | null
          id?: string
          offer_amount?: number
          offer_presented_at?: string
          offer_type?: string
          payment_plan?: string | null
          purchased_at?: string | null
          purchased_at_stage?: string | null
          stripe_session_id?: string | null
          total_paid_before_offer?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beta_conversion_results_beta_participant_id_fkey"
            columns: ["beta_participant_id"]
            isOneToOne: true
            referencedRelation: "beta_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beta_conversion_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_participants: {
        Row: {
          application_why_participate: string | null
          cohort_name: string
          complete_journey_submitted: boolean | null
          completion_email_sent_at: string | null
          consolidation_feedback_count: number | null
          conversion_amount: number | null
          conversion_decision: string | null
          conversion_decision_at: string | null
          conversion_offer_presented_at: string | null
          conversion_stripe_session_id: string | null
          created_at: string
          current_rite: string | null
          declaration_completed_count: number | null
          discount_code_generated: string | null
          enrollment_date: string | null
          feedback_completion_rate: number | null
          id: string
          micro_feedback_count: number | null
          notes: string | null
          orientation_completed_count: number | null
          perception_completed_count: number | null
          program_end_date: string
          program_start_date: string
          remaining_balance_offered: number | null
          rite_one_celebration_sent_at: string | null
          rite_three_celebration_sent_at: string | null
          rite_two_celebration_sent_at: string | null
          status: string
          summary_pdf_generated: boolean | null
          summary_pdf_url: string | null
          total_amount_paid_before_offer: number | null
          total_completion_percentage: number | null
          updated_at: string
          user_id: string
          week_1_checkin_sent_at: string | null
          week_2_checkin_sent_at: string | null
          week_4_checkin_sent_at: string | null
          welcome_email_sent_at: string | null
        }
        Insert: {
          application_why_participate?: string | null
          cohort_name?: string
          complete_journey_submitted?: boolean | null
          completion_email_sent_at?: string | null
          consolidation_feedback_count?: number | null
          conversion_amount?: number | null
          conversion_decision?: string | null
          conversion_decision_at?: string | null
          conversion_offer_presented_at?: string | null
          conversion_stripe_session_id?: string | null
          created_at?: string
          current_rite?: string | null
          declaration_completed_count?: number | null
          discount_code_generated?: string | null
          enrollment_date?: string | null
          feedback_completion_rate?: number | null
          id?: string
          micro_feedback_count?: number | null
          notes?: string | null
          orientation_completed_count?: number | null
          perception_completed_count?: number | null
          program_end_date?: string
          program_start_date?: string
          remaining_balance_offered?: number | null
          rite_one_celebration_sent_at?: string | null
          rite_three_celebration_sent_at?: string | null
          rite_two_celebration_sent_at?: string | null
          status?: string
          summary_pdf_generated?: boolean | null
          summary_pdf_url?: string | null
          total_amount_paid_before_offer?: number | null
          total_completion_percentage?: number | null
          updated_at?: string
          user_id: string
          week_1_checkin_sent_at?: string | null
          week_2_checkin_sent_at?: string | null
          week_4_checkin_sent_at?: string | null
          welcome_email_sent_at?: string | null
        }
        Update: {
          application_why_participate?: string | null
          cohort_name?: string
          complete_journey_submitted?: boolean | null
          completion_email_sent_at?: string | null
          consolidation_feedback_count?: number | null
          conversion_amount?: number | null
          conversion_decision?: string | null
          conversion_decision_at?: string | null
          conversion_offer_presented_at?: string | null
          conversion_stripe_session_id?: string | null
          created_at?: string
          current_rite?: string | null
          declaration_completed_count?: number | null
          discount_code_generated?: string | null
          enrollment_date?: string | null
          feedback_completion_rate?: number | null
          id?: string
          micro_feedback_count?: number | null
          notes?: string | null
          orientation_completed_count?: number | null
          perception_completed_count?: number | null
          program_end_date?: string
          program_start_date?: string
          remaining_balance_offered?: number | null
          rite_one_celebration_sent_at?: string | null
          rite_three_celebration_sent_at?: string | null
          rite_two_celebration_sent_at?: string | null
          status?: string
          summary_pdf_generated?: boolean | null
          summary_pdf_url?: string | null
          total_amount_paid_before_offer?: number | null
          total_completion_percentage?: number | null
          updated_at?: string
          user_id?: string
          week_1_checkin_sent_at?: string | null
          week_2_checkin_sent_at?: string | null
          week_4_checkin_sent_at?: string | null
          welcome_email_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      blueprint_feedback: {
        Row: {
          actionability_score: number | null
          beta_participant_id: string
          biggest_gap_revealed: string | null
          id: string
          immediate_action: string | null
          insight_depth_score: number | null
          integration_with_perception: string | null
          personalization_score: number | null
          product_slug: string
          session_id: string | null
          submitted_at: string
          survey_duration_seconds: number | null
          user_id: string
        }
        Insert: {
          actionability_score?: number | null
          beta_participant_id: string
          biggest_gap_revealed?: string | null
          id?: string
          immediate_action?: string | null
          insight_depth_score?: number | null
          integration_with_perception?: string | null
          personalization_score?: number | null
          product_slug: string
          session_id?: string | null
          submitted_at?: string
          survey_duration_seconds?: number | null
          user_id: string
        }
        Update: {
          actionability_score?: number | null
          beta_participant_id?: string
          biggest_gap_revealed?: string | null
          id?: string
          immediate_action?: string | null
          insight_depth_score?: number | null
          integration_with_perception?: string | null
          personalization_score?: number | null
          product_slug?: string
          session_id?: string | null
          submitted_at?: string
          survey_duration_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blueprint_feedback_beta_participant_id_fkey"
            columns: ["beta_participant_id"]
            isOneToOne: false
            referencedRelation: "beta_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blueprint_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      briefings: {
        Row: {
          extracted_at: string | null
          extraction_error: string | null
          extraction_status: string
          full_text: string
          generated_at: string
          id: string
          model_used: string | null
          product_session_id: string
          product_slug: string
          structured_extract: Json | null
          user_id: string
        }
        Insert: {
          extracted_at?: string | null
          extraction_error?: string | null
          extraction_status?: string
          full_text: string
          generated_at?: string
          id?: string
          model_used?: string | null
          product_session_id: string
          product_slug: string
          structured_extract?: Json | null
          user_id: string
        }
        Update: {
          extracted_at?: string | null
          extraction_error?: string | null
          extraction_status?: string
          full_text?: string
          generated_at?: string
          id?: string
          model_used?: string | null
          product_session_id?: string
          product_slug?: string
          structured_extract?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefings_product_session_id_fkey"
            columns: ["product_session_id"]
            isOneToOne: true
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_enrollments: {
        Row: {
          campaign_id: string
          completed_at: string | null
          current_step: number
          enrolled_at: string
          id: string
          next_send_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          current_step?: number
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          current_step?: number
          enrolled_at?: string
          id?: string
          next_send_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sends: {
        Row: {
          campaign_id: string
          enrollment_id: string
          error_message: string | null
          id: string
          personalization_model: string | null
          personalized_html: string | null
          personalized_text: string | null
          resend_id: string | null
          sent_at: string
          status: string
          step_number: number
          user_id: string
        }
        Insert: {
          campaign_id: string
          enrollment_id: string
          error_message?: string | null
          id?: string
          personalization_model?: string | null
          personalized_html?: string | null
          personalized_text?: string | null
          resend_id?: string | null
          sent_at?: string
          status?: string
          step_number: number
          user_id: string
        }
        Update: {
          campaign_id?: string
          enrollment_id?: string
          error_message?: string | null
          id?: string
          personalization_model?: string | null
          personalized_html?: string | null
          personalized_text?: string | null
          resend_id?: string | null
          sent_at?: string
          status?: string
          step_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "campaign_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_sends_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_steps: {
        Row: {
          campaign_id: string
          content_angle_id: string | null
          created_at: string
          delay_hours: number
          distribute_format: string | null
          html_body: string
          id: string
          step_number: number
          subject: string
          text_body: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          content_angle_id?: string | null
          created_at?: string
          delay_hours?: number
          distribute_format?: string | null
          html_body: string
          id?: string
          step_number: number
          subject: string
          text_body?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          content_angle_id?: string | null
          created_at?: string
          delay_hours?: number
          distribute_format?: string | null
          html_body?: string
          id?: string
          step_number?: number
          subject?: string
          text_body?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_steps_content_angle_id_fkey"
            columns: ["content_angle_id"]
            isOneToOne: false
            referencedRelation: "content_angles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          description: string | null
          from_email: string
          from_name: string
          id: string
          name: string
          status: string
          trigger_product_slug: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          from_email?: string
          from_name?: string
          id?: string
          name: string
          status?: string
          trigger_product_slug?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          from_email?: string
          from_name?: string
          id?: string
          name?: string
          status?: string
          trigger_product_slug?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      commitments: {
        Row: {
          breach_log: string | null
          declared_at: string
          declared_text: string
          delivered_at: string | null
          id: string
          replaced_by: string | null
          source_rite: Database["public"]["Enums"]["rite_source"]
          status: Database["public"]["Enums"]["commitment_status"]
          user_id: string
        }
        Insert: {
          breach_log?: string | null
          declared_at?: string
          declared_text: string
          delivered_at?: string | null
          id?: string
          replaced_by?: string | null
          source_rite: Database["public"]["Enums"]["rite_source"]
          status?: Database["public"]["Enums"]["commitment_status"]
          user_id: string
        }
        Update: {
          breach_log?: string | null
          declared_at?: string
          declared_text?: string
          delivered_at?: string | null
          id?: string
          replaced_by?: string | null
          source_rite?: Database["public"]["Enums"]["rite_source"]
          status?: Database["public"]["Enums"]["commitment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "commitments"
            referencedColumns: ["id"]
          },
        ]
      }
      complete_journey_feedback: {
        Row: {
          additional_support_needed: string | null
          after_journey_state: string | null
          before_journey_state: string | null
          beta_participant_id: string
          biggest_breakthrough: string | null
          clarity_gained: number | null
          confidence_gained: number | null
          direction_clarity: number | null
          founding_member_decision_factors: string | null
          founding_member_interest: string | null
          id: string
          journey_coherence_score: number | null
          least_valuable_product_overall: string | null
          missing_elements: string | null
          most_valuable_product_overall: string | null
          most_valuable_rite: string | null
          nps_score: number | null
          perceived_total_value_vs_60: string | null
          purchase_timeline: string | null
          referral_commitment_count: number | null
          rite_integration_score: number | null
          submitted_at: string
          survey_duration_seconds: number | null
          testimonial_consent: boolean | null
          testimonial_text: string | null
          transformation_score: number | null
          unexpected_insight: string | null
          user_id: string
          video_testimonial_interest: boolean | null
          what_needs_improvement: string | null
          what_worked_best: string | null
          what_would_make_you_say_yes: string | null
          willingness_to_pay_amount: number | null
          would_refer_others: boolean | null
        }
        Insert: {
          additional_support_needed?: string | null
          after_journey_state?: string | null
          before_journey_state?: string | null
          beta_participant_id: string
          biggest_breakthrough?: string | null
          clarity_gained?: number | null
          confidence_gained?: number | null
          direction_clarity?: number | null
          founding_member_decision_factors?: string | null
          founding_member_interest?: string | null
          id?: string
          journey_coherence_score?: number | null
          least_valuable_product_overall?: string | null
          missing_elements?: string | null
          most_valuable_product_overall?: string | null
          most_valuable_rite?: string | null
          nps_score?: number | null
          perceived_total_value_vs_60?: string | null
          purchase_timeline?: string | null
          referral_commitment_count?: number | null
          rite_integration_score?: number | null
          submitted_at?: string
          survey_duration_seconds?: number | null
          testimonial_consent?: boolean | null
          testimonial_text?: string | null
          transformation_score?: number | null
          unexpected_insight?: string | null
          user_id: string
          video_testimonial_interest?: boolean | null
          what_needs_improvement?: string | null
          what_worked_best?: string | null
          what_would_make_you_say_yes?: string | null
          willingness_to_pay_amount?: number | null
          would_refer_others?: boolean | null
        }
        Update: {
          additional_support_needed?: string | null
          after_journey_state?: string | null
          before_journey_state?: string | null
          beta_participant_id?: string
          biggest_breakthrough?: string | null
          clarity_gained?: number | null
          confidence_gained?: number | null
          direction_clarity?: number | null
          founding_member_decision_factors?: string | null
          founding_member_interest?: string | null
          id?: string
          journey_coherence_score?: number | null
          least_valuable_product_overall?: string | null
          missing_elements?: string | null
          most_valuable_product_overall?: string | null
          most_valuable_rite?: string | null
          nps_score?: number | null
          perceived_total_value_vs_60?: string | null
          purchase_timeline?: string | null
          referral_commitment_count?: number | null
          rite_integration_score?: number | null
          submitted_at?: string
          survey_duration_seconds?: number | null
          testimonial_consent?: boolean | null
          testimonial_text?: string | null
          transformation_score?: number | null
          unexpected_insight?: string | null
          user_id?: string
          video_testimonial_interest?: boolean | null
          what_needs_improvement?: string | null
          what_worked_best?: string | null
          what_would_make_you_say_yes?: string | null
          willingness_to_pay_amount?: number | null
          would_refer_others?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "complete_journey_feedback_beta_participant_id_fkey"
            columns: ["beta_participant_id"]
            isOneToOne: true
            referencedRelation: "beta_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complete_journey_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          filter_criteria: Json | null
          id: string
          list_type: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          list_type?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          list_type?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_agent_runs: {
        Row: {
          agent_type: string
          approved_by: string | null
          completed_at: string | null
          content_angle_id: string
          created_at: string | null
          feedback: string | null
          human_approved: boolean | null
          id: string
          input: Json | null
          output: Json | null
          run_at: string | null
          status: string
        }
        Insert: {
          agent_type: string
          approved_by?: string | null
          completed_at?: string | null
          content_angle_id: string
          created_at?: string | null
          feedback?: string | null
          human_approved?: boolean | null
          id?: string
          input?: Json | null
          output?: Json | null
          run_at?: string | null
          status?: string
        }
        Update: {
          agent_type?: string
          approved_by?: string | null
          completed_at?: string | null
          content_angle_id?: string
          created_at?: string | null
          feedback?: string | null
          human_approved?: boolean | null
          id?: string
          input?: Json | null
          output?: Json | null
          run_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_agent_runs_content_angle_id_fkey"
            columns: ["content_angle_id"]
            isOneToOne: false
            referencedRelation: "content_angles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_angles: {
        Row: {
          angle: string | null
          audience: string | null
          corpus_query: string | null
          created_at: string | null
          distribute_formats: string[] | null
          format: string | null
          goal: string | null
          id: string
          lead_magnet_type: string | null
          metadata: Json | null
          status: string
          title: string
          tone: string | null
          topic_id: string | null
          tradition_filter: string | null
          updated_at: string | null
        }
        Insert: {
          angle?: string | null
          audience?: string | null
          corpus_query?: string | null
          created_at?: string | null
          distribute_formats?: string[] | null
          format?: string | null
          goal?: string | null
          id?: string
          lead_magnet_type?: string | null
          metadata?: Json | null
          status?: string
          title: string
          tone?: string | null
          topic_id?: string | null
          tradition_filter?: string | null
          updated_at?: string | null
        }
        Update: {
          angle?: string | null
          audience?: string | null
          corpus_query?: string | null
          created_at?: string | null
          distribute_formats?: string[] | null
          format?: string | null
          goal?: string | null
          id?: string
          lead_magnet_type?: string | null
          metadata?: Json | null
          status?: string
          title?: string
          tone?: string | null
          topic_id?: string | null
          tradition_filter?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_angles_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      content_corpus_links: {
        Row: {
          angle_id: string
          chunk_id: string
          created_at: string | null
          curated: boolean | null
          id: string
          similarity: number | null
        }
        Insert: {
          angle_id: string
          chunk_id: string
          created_at?: string | null
          curated?: boolean | null
          id?: string
          similarity?: number | null
        }
        Update: {
          angle_id?: string
          chunk_id?: string
          created_at?: string | null
          curated?: boolean | null
          id?: string
          similarity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_corpus_links_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "knowledge_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_corpus_links_pillar_id_fkey"
            columns: ["angle_id"]
            isOneToOne: false
            referencedRelation: "content_angles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_index: {
        Row: {
          content_key: string
          content_type: string
          content_value: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          content_key: string
          content_type: string
          content_value?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          content_key?: string
          content_type?: string
          content_value?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      content_pieces: {
        Row: {
          angle_id: string
          body: string | null
          created_at: string | null
          id: string
          parent_section_id: string | null
          piece_type: string
          platform_meta: Json | null
          status: string
          title: string | null
          updated_at: string | null
          version_history: Json | null
        }
        Insert: {
          angle_id: string
          body?: string | null
          created_at?: string | null
          id?: string
          parent_section_id?: string | null
          piece_type: string
          platform_meta?: Json | null
          status?: string
          title?: string | null
          updated_at?: string | null
          version_history?: Json | null
        }
        Update: {
          angle_id?: string
          body?: string | null
          created_at?: string | null
          id?: string
          parent_section_id?: string | null
          piece_type?: string
          platform_meta?: Json | null
          status?: string
          title?: string | null
          updated_at?: string | null
          version_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "content_pieces_parent_section_id_fkey"
            columns: ["parent_section_id"]
            isOneToOne: false
            referencedRelation: "content_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_pieces_pillar_id_fkey"
            columns: ["angle_id"]
            isOneToOne: false
            referencedRelation: "content_angles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_pillars: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          slug: string
          title: string
          tradition_affinity: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          slug: string
          title: string
          tradition_affinity?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          slug?: string
          title?: string
          tradition_affinity?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      content_posts: {
        Row: {
          author: string | null
          body: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          is_published: boolean | null
          piece_id: string | null
          pillar_id: string | null
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          topic_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          author?: string | null
          body?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          piece_id?: string | null
          pillar_id?: string | null
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          topic_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          author?: string | null
          body?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_published?: boolean | null
          piece_id?: string | null
          pillar_id?: string | null
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          topic_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_posts_piece_id_fkey"
            columns: ["piece_id"]
            isOneToOne: false
            referencedRelation: "content_pieces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_posts_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_posts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      content_sections: {
        Row: {
          angle_id: string
          body: string | null
          created_at: string | null
          description: string | null
          id: string
          order_index: number
          status: string
          title: string
          updated_at: string | null
          version_history: Json | null
        }
        Insert: {
          angle_id: string
          body?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number
          status?: string
          title: string
          updated_at?: string | null
          version_history?: Json | null
        }
        Update: {
          angle_id?: string
          body?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number
          status?: string
          title?: string
          updated_at?: string | null
          version_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "content_sections_pillar_id_fkey"
            columns: ["angle_id"]
            isOneToOne: false
            referencedRelation: "content_angles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_topics: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          pillar_id: string | null
          theme_tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          pillar_id?: string | null
          theme_tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          pillar_id?: string | null
          theme_tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_topics_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          content: string | null
          created_at: string | null
          follow_up_count: number | null
          id: string
          max_follow_ups: number | null
          messages: Json
          model: string | null
          session_id: string
          step_number: number
          total_input_tokens: number | null
          total_output_tokens: number | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          follow_up_count?: number | null
          id?: string
          max_follow_ups?: number | null
          messages?: Json
          model?: string | null
          session_id: string
          step_number: number
          total_input_tokens?: number | null
          total_output_tokens?: number | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          follow_up_count?: number | null
          id?: string
          max_follow_ups?: number | null
          messages?: Json
          model?: string | null
          session_id?: string
          step_number?: number
          total_input_tokens?: number | null
          total_output_tokens?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      corpus_ingestion_queue: {
        Row: {
          approved_by: string | null
          evaluator_output: Json | null
          id: string
          ingested_at: string | null
          ingested_chunk_ids: string[] | null
          pillar_id: string | null
          quality_score: number | null
          raw_text: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          source_filename: string | null
          source_type: string
          source_url: string | null
          status: string
          submitted_at: string | null
          tradition_tags: string[] | null
        }
        Insert: {
          approved_by?: string | null
          evaluator_output?: Json | null
          id?: string
          ingested_at?: string | null
          ingested_chunk_ids?: string[] | null
          pillar_id?: string | null
          quality_score?: number | null
          raw_text?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          source_filename?: string | null
          source_type: string
          source_url?: string | null
          status?: string
          submitted_at?: string | null
          tradition_tags?: string[] | null
        }
        Update: {
          approved_by?: string | null
          evaluator_output?: Json | null
          id?: string
          ingested_at?: string | null
          ingested_chunk_ids?: string[] | null
          pillar_id?: string | null
          quality_score?: number | null
          raw_text?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          source_filename?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          submitted_at?: string | null
          tradition_tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "corpus_ingestion_queue_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      course_definitions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          slug: string
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          slug: string
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          slug?: string
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      course_enrollments: {
        Row: {
          course_slug: string
          enrolled_at: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          course_slug: string
          enrolled_at?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          course_slug?: string
          enrolled_at?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_slug_fkey"
            columns: ["course_slug"]
            isOneToOne: false
            referencedRelation: "course_definitions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "course_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_slug: string
          created_at: string | null
          id: string
          module_id: string
          order: number
          title: string
        }
        Insert: {
          course_slug: string
          created_at?: string | null
          id?: string
          module_id: string
          order?: number
          title: string
        }
        Update: {
          course_slug?: string
          created_at?: string | null
          id?: string
          module_id?: string
          order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_slug_fkey"
            columns: ["course_slug"]
            isOneToOne: false
            referencedRelation: "course_definitions"
            referencedColumns: ["slug"]
          },
        ]
      }
      course_progress: {
        Row: {
          completed_at: string | null
          course_slug: string
          current_coord: string | null
          id: string
          last_activity_at: string | null
          max_coord: string | null
          max_coord_x: number | null
          max_coord_y: number | null
          module_id: string
          started_at: string | null
          submodule_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_slug: string
          current_coord?: string | null
          id?: string
          last_activity_at?: string | null
          max_coord?: string | null
          max_coord_x?: number | null
          max_coord_y?: number | null
          module_id: string
          started_at?: string | null
          submodule_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_slug?: string
          current_coord?: string | null
          id?: string
          last_activity_at?: string | null
          max_coord?: string | null
          max_coord_x?: number | null
          max_coord_y?: number | null
          module_id?: string
          started_at?: string | null
          submodule_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_progress_course_slug_fkey"
            columns: ["course_slug"]
            isOneToOne: false
            referencedRelation: "course_definitions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "course_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      course_slide_events: {
        Row: {
          coord: string
          coord_x: number | null
          coord_y: number | null
          course_slug: string
          id: string
          module_id: string
          submodule_id: string | null
          user_id: string
          visited_at: string | null
        }
        Insert: {
          coord: string
          coord_x?: number | null
          coord_y?: number | null
          course_slug: string
          id?: string
          module_id: string
          submodule_id?: string | null
          user_id: string
          visited_at?: string | null
        }
        Update: {
          coord?: string
          coord_x?: number | null
          coord_y?: number | null
          course_slug?: string
          id?: string
          module_id?: string
          submodule_id?: string | null
          user_id?: string
          visited_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_slide_events_course_slug_fkey"
            columns: ["course_slug"]
            isOneToOne: false
            referencedRelation: "course_definitions"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "course_slide_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      course_submodules: {
        Row: {
          course_slug: string
          created_at: string | null
          end_coord: string
          id: string
          module_id: string
          order: number
          start_coord: string
          submodule_id: string
          title: string
        }
        Insert: {
          course_slug: string
          created_at?: string | null
          end_coord: string
          id?: string
          module_id: string
          order?: number
          start_coord: string
          submodule_id: string
          title: string
        }
        Update: {
          course_slug?: string
          created_at?: string | null
          end_coord?: string
          id?: string
          module_id?: string
          order?: number
          start_coord?: string
          submodule_id?: string
          title?: string
        }
        Relationships: []
      }
      declaration_feedback: {
        Row: {
          alignment_score: number | null
          beta_participant_id: string
          commitment_clarity_score: number | null
          commitment_level: number | null
          decision_made: string | null
          execution_confidence_score: number | null
          id: string
          product_slug: string
          session_id: string | null
          submitted_at: string
          support_needed: string | null
          survey_duration_seconds: number | null
          user_id: string
        }
        Insert: {
          alignment_score?: number | null
          beta_participant_id: string
          commitment_clarity_score?: number | null
          commitment_level?: number | null
          decision_made?: string | null
          execution_confidence_score?: number | null
          id?: string
          product_slug: string
          session_id?: string | null
          submitted_at?: string
          support_needed?: string | null
          survey_duration_seconds?: number | null
          user_id: string
        }
        Update: {
          alignment_score?: number | null
          beta_participant_id?: string
          commitment_clarity_score?: number | null
          commitment_level?: number | null
          decision_made?: string | null
          execution_confidence_score?: number | null
          id?: string
          product_slug?: string
          session_id?: string | null
          submitted_at?: string
          support_needed?: string | null
          survey_duration_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "declaration_feedback_beta_participant_id_fkey"
            columns: ["beta_participant_id"]
            isOneToOne: false
            referencedRelation: "beta_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declaration_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "declaration_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      dinner_party_contributions: {
        Row: {
          amount_cents: number
          contributor_id: string
          created_at: string | null
          id: string
          is_credit: boolean | null
          pool_id: string
          redeemed: boolean | null
          redeemed_at: string | null
          transaction_id: string | null
        }
        Insert: {
          amount_cents: number
          contributor_id: string
          created_at?: string | null
          id?: string
          is_credit?: boolean | null
          pool_id: string
          redeemed?: boolean | null
          redeemed_at?: string | null
          transaction_id?: string | null
        }
        Update: {
          amount_cents?: number
          contributor_id?: string
          created_at?: string | null
          id?: string
          is_credit?: boolean | null
          pool_id?: string
          redeemed?: boolean | null
          redeemed_at?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dinner_party_contributions_contributor_id_fkey"
            columns: ["contributor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dinner_party_contributions_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "dinner_party_pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dinner_party_contributions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "affiliate_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      dinner_party_pools: {
        Row: {
          created_at: string | null
          current_amount_cents: number | null
          description: string | null
          event_date: string | null
          id: string
          location: string | null
          pool_name: string
          status: string | null
          target_amount_cents: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_amount_cents?: number | null
          description?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          pool_name: string
          status?: string | null
          target_amount_cents?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_amount_cents?: number | null
          description?: string | null
          event_date?: string | null
          id?: string
          location?: string | null
          pool_name?: string
          status?: string | null
          target_amount_cents?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      discord_activity: {
        Row: {
          created_at: string
          discord_id: string
          event_data: Json | null
          event_type: string
          id: string
          sequence_stage: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          discord_id: string
          event_data?: Json | null
          event_type: string
          id?: string
          sequence_stage?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          discord_id?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          sequence_stage?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discord_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          created_at: string | null
          delay_minutes: number | null
          email_content: Json | null
          email_status: string | null
          failure_reason: string | null
          id: string
          retry_count: number | null
          scheduled_for: string | null
          scheduled_send_at: string | null
          sent_at: string | null
          sequence_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          delay_minutes?: number | null
          email_content?: Json | null
          email_status?: string | null
          failure_reason?: string | null
          id?: string
          retry_count?: number | null
          scheduled_for?: string | null
          scheduled_send_at?: string | null
          sent_at?: string | null
          sequence_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          delay_minutes?: number | null
          email_content?: Json | null
          email_status?: string | null
          failure_reason?: string | null
          id?: string
          retry_count?: number | null
          scheduled_for?: string | null
          scheduled_send_at?: string | null
          sent_at?: string | null
          sequence_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_log: {
        Row: {
          ai_output: string | null
          created_at: string
          event_type: string
          generation_ms: number | null
          id: string
          input_tokens: number | null
          model: string
          output_tokens: number | null
          product_slug: string
          session_id: string | null
          step_number: number | null
          user_id: string | null
          user_input: Json | null
        }
        Insert: {
          ai_output?: string | null
          created_at?: string
          event_type: string
          generation_ms?: number | null
          id?: string
          input_tokens?: number | null
          model: string
          output_tokens?: number | null
          product_slug: string
          session_id?: string | null
          step_number?: number | null
          user_id?: string | null
          user_input?: Json | null
        }
        Update: {
          ai_output?: string | null
          created_at?: string
          event_type?: string
          generation_ms?: number | null
          id?: string
          input_tokens?: number | null
          model?: string
          output_tokens?: number | null
          product_slug?: string
          session_id?: string | null
          step_number?: number | null
          user_id?: string | null
          user_input?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          author: string | null
          book: string | null
          chapter: string | null
          content: string
          content_type: string | null
          created_at: string | null
          cross_tradition_tags: string[] | null
          date_composed: string | null
          day: string | null
          embedding: string | null
          fts_content: unknown
          id: string
          language: string | null
          lines: string | null
          metadata: Json | null
          priority: number | null
          section: string | null
          source_url: string | null
          technique_number: number | null
          text_name: string
          themes: string[] | null
          tradition: string
          translator: string | null
          updated_at: string | null
          verse: string | null
        }
        Insert: {
          author?: string | null
          book?: string | null
          chapter?: string | null
          content: string
          content_type?: string | null
          created_at?: string | null
          cross_tradition_tags?: string[] | null
          date_composed?: string | null
          day?: string | null
          embedding?: string | null
          fts_content?: unknown
          id?: string
          language?: string | null
          lines?: string | null
          metadata?: Json | null
          priority?: number | null
          section?: string | null
          source_url?: string | null
          technique_number?: number | null
          text_name: string
          themes?: string[] | null
          tradition: string
          translator?: string | null
          updated_at?: string | null
          verse?: string | null
        }
        Update: {
          author?: string | null
          book?: string | null
          chapter?: string | null
          content?: string
          content_type?: string | null
          created_at?: string | null
          cross_tradition_tags?: string[] | null
          date_composed?: string | null
          day?: string | null
          embedding?: string | null
          fts_content?: unknown
          id?: string
          language?: string | null
          lines?: string | null
          metadata?: Json | null
          priority?: number | null
          section?: string | null
          source_url?: string | null
          technique_number?: number | null
          text_name?: string
          themes?: string[] | null
          tradition?: string
          translator?: string | null
          updated_at?: string | null
          verse?: string | null
        }
        Relationships: []
      }
      knowledge_queries: {
        Row: {
          chunks_retrieved: number | null
          created_at: string | null
          filter_themes: string[] | null
          filter_tradition: string | null
          id: string
          model_used: string | null
          product_slug: string | null
          query_text: string
          response_length: number | null
          session_id: string | null
          traditions_hit: string[] | null
          user_id: string | null
        }
        Insert: {
          chunks_retrieved?: number | null
          created_at?: string | null
          filter_themes?: string[] | null
          filter_tradition?: string | null
          id?: string
          model_used?: string | null
          product_slug?: string | null
          query_text: string
          response_length?: number | null
          session_id?: string | null
          traditions_hit?: string[] | null
          user_id?: string | null
        }
        Update: {
          chunks_retrieved?: number | null
          created_at?: string | null
          filter_themes?: string[] | null
          filter_tradition?: string | null
          id?: string
          model_used?: string | null
          product_slug?: string | null
          query_text?: string
          response_length?: number | null
          session_id?: string | null
          traditions_hit?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_queries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_queries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_query_log: {
        Row: {
          answer: string | null
          chunks_returned: number | null
          created_at: string
          id: string
          latency_ms: number | null
          match_count: number | null
          model: string | null
          query: string
          threshold: number | null
          top_sources: Json | null
          tradition_filter: string | null
        }
        Insert: {
          answer?: string | null
          chunks_returned?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          match_count?: number | null
          model?: string | null
          query: string
          threshold?: number | null
          top_sources?: Json | null
          tradition_filter?: string | null
        }
        Update: {
          answer?: string | null
          chunks_returned?: number | null
          created_at?: string
          id?: string
          latency_ms?: number | null
          match_count?: number | null
          model?: string | null
          query?: string
          threshold?: number | null
          top_sources?: Json | null
          tradition_filter?: string | null
        }
        Relationships: []
      }
      knowledge_sources: {
        Row: {
          author: string | null
          chunk_count: number | null
          created_at: string | null
          display_name: string
          format: string | null
          id: string
          ingested_at: string | null
          last_refreshed: string | null
          notes: string | null
          priority: number | null
          source_url: string | null
          status: string | null
          text_name: string
          tradition: string
        }
        Insert: {
          author?: string | null
          chunk_count?: number | null
          created_at?: string | null
          display_name: string
          format?: string | null
          id?: string
          ingested_at?: string | null
          last_refreshed?: string | null
          notes?: string | null
          priority?: number | null
          source_url?: string | null
          status?: string | null
          text_name: string
          tradition: string
        }
        Update: {
          author?: string | null
          chunk_count?: number | null
          created_at?: string | null
          display_name?: string
          format?: string | null
          id?: string
          ingested_at?: string | null
          last_refreshed?: string | null
          notes?: string | null
          priority?: number | null
          source_url?: string | null
          status?: string | null
          text_name?: string
          tradition?: string
        }
        Relationships: []
      }
      list_members: {
        Row: {
          added_at: string
          added_by: string | null
          id: string
          list_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          id?: string
          list_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          id?: string
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      member_deadlines: {
        Row: {
          completed_at: string | null
          confirmed_at: string | null
          deadline: string
          discord_id: string
          id: string
          missed_nudge_sent_at: string | null
          proposed_at: string
          reminder_sent_at: string | null
          rite_number: number
        }
        Insert: {
          completed_at?: string | null
          confirmed_at?: string | null
          deadline: string
          discord_id: string
          id?: string
          missed_nudge_sent_at?: string | null
          proposed_at?: string
          reminder_sent_at?: string | null
          rite_number: number
        }
        Update: {
          completed_at?: string | null
          confirmed_at?: string | null
          deadline?: string
          discord_id?: string
          id?: string
          missed_nudge_sent_at?: string | null
          proposed_at?: string
          reminder_sent_at?: string | null
          rite_number?: number
        }
        Relationships: []
      }
      member_sequences: {
        Row: {
          agreements_acknowledged: boolean | null
          agreements_timestamp: string | null
          atl_member: boolean | null
          created_at: string | null
          day10_replied: boolean | null
          day10_response: string | null
          day10_timestamp: string | null
          discord_id: string
          doctrine_engaged: boolean | null
          doctrine_response: string | null
          doctrine_timestamp: string | null
          engaged: boolean | null
          escalate_to_austin: boolean | null
          escalation_reason: string | null
          hesitation_type: string | null
          intro_content: string | null
          intro_timestamp: string | null
          introduced: boolean | null
          joined_at: string | null
          keywords_detected: string[] | null
          last_message_sent: string | null
          member_type: string | null
          name_detected: string | null
          rite_link_clicked: boolean | null
          rite_purchase_timestamp: string | null
          rite_purchased: boolean | null
          rite_purchased_product: string | null
          rite_results_posted: boolean | null
          role: string | null
          sequence_complete: boolean | null
          sequence_stage: number | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          agreements_acknowledged?: boolean | null
          agreements_timestamp?: string | null
          atl_member?: boolean | null
          created_at?: string | null
          day10_replied?: boolean | null
          day10_response?: string | null
          day10_timestamp?: string | null
          discord_id: string
          doctrine_engaged?: boolean | null
          doctrine_response?: string | null
          doctrine_timestamp?: string | null
          engaged?: boolean | null
          escalate_to_austin?: boolean | null
          escalation_reason?: string | null
          hesitation_type?: string | null
          intro_content?: string | null
          intro_timestamp?: string | null
          introduced?: boolean | null
          joined_at?: string | null
          keywords_detected?: string[] | null
          last_message_sent?: string | null
          member_type?: string | null
          name_detected?: string | null
          rite_link_clicked?: boolean | null
          rite_purchase_timestamp?: string | null
          rite_purchased?: boolean | null
          rite_purchased_product?: string | null
          rite_results_posted?: boolean | null
          role?: string | null
          sequence_complete?: boolean | null
          sequence_stage?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          agreements_acknowledged?: boolean | null
          agreements_timestamp?: string | null
          atl_member?: boolean | null
          created_at?: string | null
          day10_replied?: boolean | null
          day10_response?: string | null
          day10_timestamp?: string | null
          discord_id?: string
          doctrine_engaged?: boolean | null
          doctrine_response?: string | null
          doctrine_timestamp?: string | null
          engaged?: boolean | null
          escalate_to_austin?: boolean | null
          escalation_reason?: string | null
          hesitation_type?: string | null
          intro_content?: string | null
          intro_timestamp?: string | null
          introduced?: boolean | null
          joined_at?: string | null
          keywords_detected?: string[] | null
          last_message_sent?: string | null
          member_type?: string | null
          name_detected?: string | null
          rite_link_clicked?: boolean | null
          rite_purchase_timestamp?: string | null
          rite_purchased?: boolean | null
          rite_purchased_product?: string | null
          rite_results_posted?: boolean | null
          role?: string | null
          sequence_complete?: boolean | null
          sequence_stage?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      portrait_audit_log: {
        Row: {
          actor_id: string | null
          briefing_id: string | null
          created_at: string
          direction: string
          field_path: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          section: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          briefing_id?: string | null
          created_at?: string
          direction: string
          field_path?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          section: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          briefing_id?: string | null
          created_at?: string
          direction?: string
          field_path?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          section?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portrait_audit_log_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portrait_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      portrait_update_queue: {
        Row: {
          attempts: number
          briefing_id: string
          created_at: string
          error_message: string | null
          id: string
          max_attempts: number
          processed_at: string | null
          processing_started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          briefing_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          processed_at?: string | null
          processing_started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          briefing_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          max_attempts?: number
          processed_at?: string | null
          processing_started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portrait_update_queue_briefing_id_fkey"
            columns: ["briefing_id"]
            isOneToOne: false
            referencedRelation: "briefings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portrait_update_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_access: {
        Row: {
          access_granted: boolean | null
          amount_paid: number | null
          bundle_slug: string | null
          completed_at: string | null
          completion_percentage: number | null
          created_at: string | null
          expires_at: string | null
          free_attempts_limit: number | null
          free_attempts_used: number | null
          id: string
          product_slug: string
          purchase_date: string | null
          purchase_source: string | null
          started_at: string | null
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          access_granted?: boolean | null
          amount_paid?: number | null
          bundle_slug?: string | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          expires_at?: string | null
          free_attempts_limit?: number | null
          free_attempts_used?: number | null
          id?: string
          product_slug: string
          purchase_date?: string | null
          purchase_source?: string | null
          started_at?: string | null
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          access_granted?: boolean | null
          amount_paid?: number | null
          bundle_slug?: string | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          expires_at?: string | null
          free_attempts_limit?: number | null
          free_attempts_used?: number | null
          id?: string
          product_slug?: string
          purchase_date?: string | null
          purchase_source?: string | null
          started_at?: string | null
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_definitions: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          estimated_duration: string | null
          final_deliverable_prompt: string
          id: string
          instructions: Json | null
          is_active: boolean | null
          is_purchasable: boolean | null
          model: string | null
          name: string
          pillar_id: string | null
          plg_stage: string | null
          price: number | null
          product_group: string | null
          product_slug: string
          steps: Json
          stripe_price_id: string | null
          stripe_product_id: string | null
          system_prompt: string
          total_steps: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          estimated_duration?: string | null
          final_deliverable_prompt: string
          id?: string
          instructions?: Json | null
          is_active?: boolean | null
          is_purchasable?: boolean | null
          model?: string | null
          name: string
          pillar_id?: string | null
          plg_stage?: string | null
          price?: number | null
          product_group?: string | null
          product_slug: string
          steps: Json
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          system_prompt: string
          total_steps: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          estimated_duration?: string | null
          final_deliverable_prompt?: string
          id?: string
          instructions?: Json | null
          is_active?: boolean | null
          is_purchasable?: boolean | null
          model?: string | null
          name?: string
          pillar_id?: string | null
          plg_stage?: string | null
          price?: number | null
          product_group?: string | null
          product_slug?: string
          steps?: Json
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          system_prompt?: string
          total_steps?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_definitions_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      product_definitions_backup_20260101: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          estimated_duration: string | null
          final_deliverable_prompt: string | null
          id: string | null
          instructions: Json | null
          is_active: boolean | null
          is_purchasable: boolean | null
          model: string | null
          name: string | null
          price: number | null
          product_group: string | null
          product_slug: string | null
          steps: Json | null
          system_prompt: string | null
          total_steps: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          estimated_duration?: string | null
          final_deliverable_prompt?: string | null
          id?: string | null
          instructions?: Json | null
          is_active?: boolean | null
          is_purchasable?: boolean | null
          model?: string | null
          name?: string | null
          price?: number | null
          product_group?: string | null
          product_slug?: string | null
          steps?: Json | null
          system_prompt?: string | null
          total_steps?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          estimated_duration?: string | null
          final_deliverable_prompt?: string | null
          id?: string | null
          instructions?: Json | null
          is_active?: boolean | null
          is_purchasable?: boolean | null
          model?: string | null
          name?: string | null
          price?: number | null
          product_group?: string | null
          product_slug?: string | null
          steps?: Json | null
          system_prompt?: string | null
          total_steps?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_landing_pages: {
        Row: {
          created_at: string | null
          faq: Json | null
          features: Json | null
          hero_accent: string | null
          hero_cta_label: string | null
          hero_description: string | null
          hero_headline: string | null
          hero_microcopy: string | null
          id: string
          pricing_bullets: Json | null
          pricing_headline: string | null
          product_id: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          faq?: Json | null
          features?: Json | null
          hero_accent?: string | null
          hero_cta_label?: string | null
          hero_description?: string | null
          hero_headline?: string | null
          hero_microcopy?: string | null
          id?: string
          pricing_bullets?: Json | null
          pricing_headline?: string | null
          product_id: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          faq?: Json | null
          features?: Json | null
          hero_accent?: string | null
          hero_cta_label?: string | null
          hero_description?: string | null
          hero_headline?: string | null
          hero_microcopy?: string | null
          id?: string
          pricing_bullets?: Json | null
          pricing_headline?: string | null
          product_id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_landing_pages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "product_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sessions: {
        Row: {
          audience_track: string | null
          completed_at: string | null
          created_at: string | null
          current_section: number | null
          current_step: number | null
          deliverable: string | null
          deliverable_content: string | null
          deliverable_generated_at: string | null
          deliverable_generation_ms: number | null
          deliverable_input_tokens: number | null
          deliverable_model: string | null
          deliverable_output_tokens: number | null
          deliverable_regeneration_count: number
          deliverable_url: string | null
          followup_counts: Json | null
          id: string
          is_active: boolean | null
          is_complete: boolean | null
          is_latest_version: boolean | null
          last_activity_at: string | null
          parent_product_slug: string | null
          parent_session_id: string | null
          placements: Json | null
          placements_confirmed: boolean | null
          product_slug: string
          scan_number: number | null
          session_data: Json | null
          started_at: string | null
          status: string | null
          step_data: Json | null
          total_steps: number | null
          updated_at: string | null
          user_id: string
          version: number | null
        }
        Insert: {
          audience_track?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_section?: number | null
          current_step?: number | null
          deliverable?: string | null
          deliverable_content?: string | null
          deliverable_generated_at?: string | null
          deliverable_generation_ms?: number | null
          deliverable_input_tokens?: number | null
          deliverable_model?: string | null
          deliverable_output_tokens?: number | null
          deliverable_regeneration_count?: number
          deliverable_url?: string | null
          followup_counts?: Json | null
          id?: string
          is_active?: boolean | null
          is_complete?: boolean | null
          is_latest_version?: boolean | null
          last_activity_at?: string | null
          parent_product_slug?: string | null
          parent_session_id?: string | null
          placements?: Json | null
          placements_confirmed?: boolean | null
          product_slug: string
          scan_number?: number | null
          session_data?: Json | null
          started_at?: string | null
          status?: string | null
          step_data?: Json | null
          total_steps?: number | null
          updated_at?: string | null
          user_id: string
          version?: number | null
        }
        Update: {
          audience_track?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_section?: number | null
          current_step?: number | null
          deliverable?: string | null
          deliverable_content?: string | null
          deliverable_generated_at?: string | null
          deliverable_generation_ms?: number | null
          deliverable_input_tokens?: number | null
          deliverable_model?: string | null
          deliverable_output_tokens?: number | null
          deliverable_regeneration_count?: number
          deliverable_url?: string | null
          followup_counts?: Json | null
          id?: string
          is_active?: boolean | null
          is_complete?: boolean | null
          is_latest_version?: boolean | null
          last_activity_at?: string | null
          parent_product_slug?: string | null
          parent_session_id?: string | null
          placements?: Json | null
          placements_confirmed?: boolean | null
          product_slug?: string
          scan_number?: number | null
          session_data?: Json | null
          started_at?: string | null
          status?: string | null
          step_data?: Json | null
          total_steps?: number | null
          updated_at?: string | null
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_sessions_parent_session_id_fkey"
            columns: ["parent_session_id"]
            isOneToOne: false
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_steps: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          product_id: string
          step_number: number
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          product_id: string
          step_number: number
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          product_id?: string
          step_number?: number
          title?: string
        }
        Relationships: []
      }
      product_suggestions: {
        Row: {
          angle_ids: string[] | null
          corpus_themes: string[] | null
          created_at: string | null
          format: string | null
          funnel_stage: string
          generated_brief: Json | null
          id: string
          linked_product_id: string | null
          pillar_id: string | null
          rationale: string | null
          status: string
          tagline: string | null
          title: string
          topic_id: string | null
          updated_at: string | null
        }
        Insert: {
          angle_ids?: string[] | null
          corpus_themes?: string[] | null
          created_at?: string | null
          format?: string | null
          funnel_stage: string
          generated_brief?: Json | null
          id?: string
          linked_product_id?: string | null
          pillar_id?: string | null
          rationale?: string | null
          status?: string
          tagline?: string | null
          title: string
          topic_id?: string | null
          updated_at?: string | null
        }
        Update: {
          angle_ids?: string[] | null
          corpus_themes?: string[] | null
          created_at?: string | null
          format?: string | null
          funnel_stage?: string
          generated_brief?: Json | null
          id?: string
          linked_product_id?: string | null
          pillar_id?: string | null
          rationale?: string | null
          status?: string
          tagline?: string | null
          title?: string
          topic_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_suggestions_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "content_pillars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suggestions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "content_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          canonical_identity: string[]
          current_channel: string
          current_offer: string
          current_price: number
          current_target: string
          id: string
          last_updated: string
          locked_at: string
          reconfig_log: Json[]
          system_config: Json
          user_id: string
        }
        Insert: {
          canonical_identity?: string[]
          current_channel: string
          current_offer: string
          current_price: number
          current_target: string
          id?: string
          last_updated?: string
          locked_at?: string
          reconfig_log?: Json[]
          system_config?: Json
          user_id: string
        }
        Update: {
          canonical_identity?: string[]
          current_channel?: string
          current_offer?: string
          current_price?: number
          current_target?: string
          id?: string
          last_updated?: string
          locked_at?: string
          reconfig_log?: Json[]
          system_config?: Json
          user_id?: string
        }
        Relationships: []
      }
      prompts: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          product_slug: string
          scope: string
          step_number: number | null
          updated_at: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_slug: string
          scope: string
          step_number?: number | null
          updated_at?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          product_slug?: string
          scope?: string
          step_number?: number | null
          updated_at?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "prompts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      question_pool: {
        Row: {
          active: boolean
          audience_tracks: string[]
          blocks: string[] | null
          created_at: string
          domain: string
          experience_level: number
          followup_text: string | null
          id: string
          product_slug: string
          prompt_text: string
          prompt_variants: Json | null
          question_role: string
          rite: string
          signals_extracted: string[] | null
          step_index: number
          unlocks: string[] | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          audience_tracks?: string[]
          blocks?: string[] | null
          created_at?: string
          domain: string
          experience_level?: number
          followup_text?: string | null
          id: string
          product_slug: string
          prompt_text: string
          prompt_variants?: Json | null
          question_role?: string
          rite: string
          signals_extracted?: string[] | null
          step_index: number
          unlocks?: string[] | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          audience_tracks?: string[]
          blocks?: string[] | null
          created_at?: string
          domain?: string
          experience_level?: number
          followup_text?: string | null
          id?: string
          product_slug?: string
          prompt_text?: string
          prompt_variants?: Json | null
          question_role?: string
          rite?: string
          signals_extracted?: string[] | null
          step_index?: number
          unlocks?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_hierarchy: {
        Row: {
          active_referrals: number | null
          affiliate_id: string
          created_at: string | null
          current_track: string
          enrolled_at: string | null
          id: string
          referral_code: string
          referral_link: string
          referred_by_id: string | null
          stripe_connect_account_id: string | null
          stripe_connect_charges_enabled: boolean | null
          stripe_connect_onboarding_complete: boolean | null
          stripe_connect_payouts_enabled: boolean | null
          total_referrals: number | null
          updated_at: string | null
        }
        Insert: {
          active_referrals?: number | null
          affiliate_id: string
          created_at?: string | null
          current_track?: string
          enrolled_at?: string | null
          id?: string
          referral_code: string
          referral_link: string
          referred_by_id?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean | null
          stripe_connect_onboarding_complete?: boolean | null
          stripe_connect_payouts_enabled?: boolean | null
          total_referrals?: number | null
          updated_at?: string | null
        }
        Update: {
          active_referrals?: number | null
          affiliate_id?: string
          created_at?: string | null
          current_track?: string
          enrolled_at?: string | null
          id?: string
          referral_code?: string
          referral_link?: string
          referred_by_id?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean | null
          stripe_connect_onboarding_complete?: boolean | null
          stripe_connect_payouts_enabled?: boolean | null
          total_referrals?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_hierarchy_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_hierarchy_referred_by_id_fkey"
            columns: ["referred_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rite_one_consolidation: {
        Row: {
          beta_participant_id: string
          breakthrough_moment: string | null
          completion_time_weeks: number | null
          id: string
          integration_challenge: string | null
          key_transformation: string | null
          least_valuable_scan: string | null
          most_valuable_scan: string | null
          overall_value_score: number | null
          perceived_value_vs_price: string | null
          reminded_at: string | null
          rite_one_nps: number | null
          submitted_at: string
          survey_duration_seconds: number | null
          testimonial_consent: boolean | null
          testimonial_text: string | null
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          beta_participant_id: string
          breakthrough_moment?: string | null
          completion_time_weeks?: number | null
          id?: string
          integration_challenge?: string | null
          key_transformation?: string | null
          least_valuable_scan?: string | null
          most_valuable_scan?: string | null
          overall_value_score?: number | null
          perceived_value_vs_price?: string | null
          reminded_at?: string | null
          rite_one_nps?: number | null
          submitted_at?: string
          survey_duration_seconds?: number | null
          testimonial_consent?: boolean | null
          testimonial_text?: string | null
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          beta_participant_id?: string
          breakthrough_moment?: string | null
          completion_time_weeks?: number | null
          id?: string
          integration_challenge?: string | null
          key_transformation?: string | null
          least_valuable_scan?: string | null
          most_valuable_scan?: string | null
          overall_value_score?: number | null
          perceived_value_vs_price?: string | null
          reminded_at?: string | null
          rite_one_nps?: number | null
          submitted_at?: string
          survey_duration_seconds?: number | null
          testimonial_consent?: boolean | null
          testimonial_text?: string | null
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "rite_one_consolidation_beta_participant_id_fkey"
            columns: ["beta_participant_id"]
            isOneToOne: true
            referencedRelation: "beta_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rite_one_consolidation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rite_two_consolidation: {
        Row: {
          beta_participant_id: string
          business_model_confidence: string | null
          completion_time_weeks: number | null
          id: string
          least_valuable_blueprint: string | null
          most_valuable_blueprint: string | null
          overall_value_score: number | null
          perceived_value_vs_price: string | null
          reminded_at: string | null
          rite_two_nps: number | null
          strategic_clarity_after: number | null
          strategic_clarity_before: number | null
          submitted_at: string
          survey_duration_seconds: number | null
          testimonial_consent: boolean | null
          testimonial_text: string | null
          user_id: string
          would_recommend: boolean | null
        }
        Insert: {
          beta_participant_id: string
          business_model_confidence?: string | null
          completion_time_weeks?: number | null
          id?: string
          least_valuable_blueprint?: string | null
          most_valuable_blueprint?: string | null
          overall_value_score?: number | null
          perceived_value_vs_price?: string | null
          reminded_at?: string | null
          rite_two_nps?: number | null
          strategic_clarity_after?: number | null
          strategic_clarity_before?: number | null
          submitted_at?: string
          survey_duration_seconds?: number | null
          testimonial_consent?: boolean | null
          testimonial_text?: string | null
          user_id: string
          would_recommend?: boolean | null
        }
        Update: {
          beta_participant_id?: string
          business_model_confidence?: string | null
          completion_time_weeks?: number | null
          id?: string
          least_valuable_blueprint?: string | null
          most_valuable_blueprint?: string | null
          overall_value_score?: number | null
          perceived_value_vs_price?: string | null
          reminded_at?: string | null
          rite_two_nps?: number | null
          strategic_clarity_after?: number | null
          strategic_clarity_before?: number | null
          submitted_at?: string
          survey_duration_seconds?: number | null
          testimonial_consent?: boolean | null
          testimonial_text?: string | null
          user_id?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "rite_two_consolidation_beta_participant_id_fkey"
            columns: ["beta_participant_id"]
            isOneToOne: true
            referencedRelation: "beta_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rite_two_consolidation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_feedback: {
        Row: {
          actionability_score: number | null
          beta_participant_id: string
          biggest_aha: string | null
          clarity_score: number | null
          confusion_points: string | null
          id: string
          implementation_plan: string | null
          product_slug: string
          relevance_score: number | null
          session_id: string | null
          submitted_at: string
          surprise_level: number | null
          survey_duration_seconds: number | null
          user_id: string
        }
        Insert: {
          actionability_score?: number | null
          beta_participant_id: string
          biggest_aha?: string | null
          clarity_score?: number | null
          confusion_points?: string | null
          id?: string
          implementation_plan?: string | null
          product_slug: string
          relevance_score?: number | null
          session_id?: string | null
          submitted_at?: string
          surprise_level?: number | null
          survey_duration_seconds?: number | null
          user_id: string
        }
        Update: {
          actionability_score?: number | null
          beta_participant_id?: string
          biggest_aha?: string | null
          clarity_score?: number | null
          confusion_points?: string | null
          id?: string
          implementation_plan?: string | null
          product_slug?: string
          relevance_score?: number | null
          session_id?: string | null
          submitted_at?: string
          surprise_level?: number | null
          survey_duration_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_feedback_beta_participant_id_fkey"
            columns: ["beta_participant_id"]
            isOneToOne: false
            referencedRelation: "beta_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_insights: {
        Row: {
          business_model: string | null
          extracted_at: string
          extraction_model: string | null
          hd_authority: string | null
          hd_type: string | null
          id: string
          moon_sign: string | null
          pain_points: string[] | null
          product_slug: string
          revenue_goal: string | null
          session_id: string
          sun_sign: string | null
          themes: string[] | null
          user_id: string
        }
        Insert: {
          business_model?: string | null
          extracted_at?: string
          extraction_model?: string | null
          hd_authority?: string | null
          hd_type?: string | null
          id?: string
          moon_sign?: string | null
          pain_points?: string[] | null
          product_slug: string
          revenue_goal?: string | null
          session_id: string
          sun_sign?: string | null
          themes?: string[] | null
          user_id: string
        }
        Update: {
          business_model?: string | null
          extracted_at?: string
          extraction_model?: string | null
          hd_authority?: string | null
          hd_type?: string | null
          id?: string
          moon_sign?: string | null
          pain_points?: string[] | null
          product_slug?: string
          revenue_goal?: string | null
          session_id?: string
          sun_sign?: string | null
          themes?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_insights_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_insights_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      session_signals: {
        Row: {
          confidence: number | null
          created_at: string
          evidence: string | null
          id: string
          product_session_id: string
          signal: string
          source: string
          step_index: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          evidence?: string | null
          id?: string
          product_session_id: string
          signal: string
          source?: string
          step_index?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          evidence?: string | null
          id?: string
          product_session_id?: string
          signal?: string
          source?: string
          step_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_signals_product_session_id_fkey"
            columns: ["product_session_id"]
            isOneToOne: false
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      step_friction_log: {
        Row: {
          created_at: string
          id: string
          note: string | null
          product_session_id: string | null
          product_slug: string
          reason: string
          response_excerpt: string | null
          status: string
          step_index: number | null
          triage_note: string | null
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          product_session_id?: string | null
          product_slug: string
          reason: string
          response_excerpt?: string | null
          status?: string
          step_index?: number | null
          triage_note?: string | null
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          product_session_id?: string | null
          product_slug?: string
          reason?: string
          response_excerpt?: string | null
          status?: string
          step_index?: number | null
          triage_note?: string | null
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "step_friction_log_product_session_id_fkey"
            columns: ["product_session_id"]
            isOneToOne: false
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_friction_log_triaged_by_fkey"
            columns: ["triaged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "step_friction_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_connect_onboarding: {
        Row: {
          affiliate_id: string
          charges_enabled: boolean | null
          created_at: string | null
          details_submitted: boolean | null
          id: string
          onboarding_expires_at: string | null
          onboarding_url: string | null
          payouts_enabled: boolean | null
          requirements: Json | null
          stripe_account_id: string
          updated_at: string | null
        }
        Insert: {
          affiliate_id: string
          charges_enabled?: boolean | null
          created_at?: string | null
          details_submitted?: boolean | null
          id?: string
          onboarding_expires_at?: string | null
          onboarding_url?: string | null
          payouts_enabled?: boolean | null
          requirements?: Json | null
          stripe_account_id: string
          updated_at?: string | null
        }
        Update: {
          affiliate_id?: string
          charges_enabled?: boolean | null
          created_at?: string | null
          details_submitted?: boolean | null
          id?: string
          onboarding_expires_at?: string | null
          onboarding_url?: string | null
          payouts_enabled?: boolean | null
          requirements?: Json | null
          stripe_account_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_connect_onboarding_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          current_period_end: string | null
          id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tao_situations: {
        Row: {
          active: boolean
          being_name: string | null
          core_state: string | null
          created_at: string
          domain_id: string
          domain_name: string
          fate: string | null
          id: string
          layer_fate_bte: Json | null
          layer_identity: Json | null
          layer_language: Json | null
          layer_personalization: Json | null
          layer_protocol: Json | null
          layer_submodality: Json | null
          layer_variance: Json | null
          name: string
          re_entry_phrase: string | null
          research_finding: string | null
          research_source: string | null
          source_version: string | null
          tier: number
          updated_at: string
          variant_count: number | null
        }
        Insert: {
          active?: boolean
          being_name?: string | null
          core_state?: string | null
          created_at?: string
          domain_id: string
          domain_name: string
          fate?: string | null
          id: string
          layer_fate_bte?: Json | null
          layer_identity?: Json | null
          layer_language?: Json | null
          layer_personalization?: Json | null
          layer_protocol?: Json | null
          layer_submodality?: Json | null
          layer_variance?: Json | null
          name: string
          re_entry_phrase?: string | null
          research_finding?: string | null
          research_source?: string | null
          source_version?: string | null
          tier: number
          updated_at?: string
          variant_count?: number | null
        }
        Update: {
          active?: boolean
          being_name?: string | null
          core_state?: string | null
          created_at?: string
          domain_id?: string
          domain_name?: string
          fate?: string | null
          id?: string
          layer_fate_bte?: Json | null
          layer_identity?: Json | null
          layer_language?: Json | null
          layer_personalization?: Json | null
          layer_protocol?: Json | null
          layer_submodality?: Json | null
          layer_variance?: Json | null
          name?: string
          re_entry_phrase?: string | null
          research_finding?: string | null
          research_source?: string | null
          source_version?: string | null
          tier?: number
          updated_at?: string
          variant_count?: number | null
        }
        Relationships: []
      }
      track_changes: {
        Row: {
          affiliate_id: string
          change_type: string | null
          changed_by_user_id: string | null
          created_at: string | null
          id: string
          new_track: string
          previous_track: string
          reason: string | null
        }
        Insert: {
          affiliate_id: string
          change_type?: string | null
          changed_by_user_id?: string | null
          created_at?: string | null
          id?: string
          new_track: string
          previous_track: string
          reason?: string | null
        }
        Update: {
          affiliate_id?: string
          change_type?: string | null
          changed_by_user_id?: string | null
          created_at?: string | null
          id?: string
          new_track?: string
          previous_track?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "track_changes_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_changes_changed_by_user_id_fkey"
            columns: ["changed_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_documents: {
        Row: {
          created_at: string | null
          extracted_text: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          id: string
          processed: boolean | null
          session_id: string
          step_number: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          extracted_text?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          processed?: boolean | null
          session_id: string
          step_number?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          extracted_text?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          processed?: boolean | null
          session_id?: string
          step_number?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "product_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goals: {
        Row: {
          ai_insights: Json | null
          created_at: string | null
          description: string | null
          id: string
          rite_stage: string | null
          status: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_insights?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          rite_stage?: string | null
          status?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_insights?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          rite_stage?: string | null
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          author: string
          content: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          author: string
          content: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          author?: string
          content?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_portraits: {
        Row: {
          created_at: string
          last_extracted_at: string | null
          last_reviewed_at: string | null
          opt_out: boolean
          products_completed: string[]
          schema_version: number
          sections: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_extracted_at?: string | null
          last_reviewed_at?: string | null
          opt_out?: boolean
          products_completed?: string[]
          schema_version?: number
          sections?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_extracted_at?: string | null
          last_reviewed_at?: string | null
          opt_out?: boolean
          products_completed?: string[]
          schema_version?: number
          sections?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_portraits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          affiliate_enrolled_at: string | null
          affiliate_opted_out: boolean | null
          available_balance_cents: number | null
          birth_data: Json | null
          company_name: string | null
          created_at: string | null
          dinner_party_credits_cents: number | null
          discord_id: string | null
          discord_username: string | null
          email: string
          first_affiliate_visit: string | null
          id: string
          ig_handle: string | null
          is_affiliate: boolean | null
          name: string | null
          placements: Json | null
          placements_confirmed: boolean | null
          placements_updated_at: string | null
          portrait_opt_out: boolean
          role: string | null
          stripe_customer_id: string | null
          total_earnings_cents: number | null
          total_withdrawn_cents: number | null
          updated_at: string | null
        }
        Insert: {
          affiliate_enrolled_at?: string | null
          affiliate_opted_out?: boolean | null
          available_balance_cents?: number | null
          birth_data?: Json | null
          company_name?: string | null
          created_at?: string | null
          dinner_party_credits_cents?: number | null
          discord_id?: string | null
          discord_username?: string | null
          email: string
          first_affiliate_visit?: string | null
          id?: string
          ig_handle?: string | null
          is_affiliate?: boolean | null
          name?: string | null
          placements?: Json | null
          placements_confirmed?: boolean | null
          placements_updated_at?: string | null
          portrait_opt_out?: boolean
          role?: string | null
          stripe_customer_id?: string | null
          total_earnings_cents?: number | null
          total_withdrawn_cents?: number | null
          updated_at?: string | null
        }
        Update: {
          affiliate_enrolled_at?: string | null
          affiliate_opted_out?: boolean | null
          available_balance_cents?: number | null
          birth_data?: Json | null
          company_name?: string | null
          created_at?: string | null
          dinner_party_credits_cents?: number | null
          discord_id?: string | null
          discord_username?: string | null
          email?: string
          first_affiliate_visit?: string | null
          id?: string
          ig_handle?: string | null
          is_affiliate?: boolean | null
          name?: string | null
          placements?: Json | null
          placements_confirmed?: boolean | null
          placements_updated_at?: string | null
          portrait_opt_out?: boolean
          role?: string | null
          stripe_customer_id?: string | null
          total_earnings_cents?: number | null
          total_withdrawn_cents?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      workshop_modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          position: number
          title: string
          updated_at: string
          video_url: string | null
          workshop_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title: string
          updated_at?: string
          video_url?: string | null
          workshop_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          position?: number
          title?: string
          updated_at?: string
          video_url?: string | null
          workshop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_modules_workshop_id_fkey"
            columns: ["workshop_id"]
            isOneToOne: false
            referencedRelation: "workshops"
            referencedColumns: ["id"]
          },
        ]
      }
      workshop_slides: {
        Row: {
          content: Json
          created_at: string
          id: string
          module_id: string
          position: number
          slide_type: string
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          module_id: string
          position?: number
          slide_type?: string
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          module_id?: string
          position?: number
          slide_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workshop_slides_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "workshop_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      workshops: {
        Row: {
          created_at: string
          description: string | null
          id: string
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      audit_error_summary: {
        Row: {
          affected_users: number | null
          error_code: string | null
          error_count: number | null
          event_action: string | null
          event_type: string | null
          last_occurrence: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          created_at: string | null
          email: string | null
          error_code: string | null
          error_message: string | null
          error_stack: string | null
          event_action: string | null
          event_type: string | null
          metadata: Json | null
          request_path: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_analytics: {
        Row: {
          avg_generation_ms: number | null
          call_count: number | null
          email: string | null
          event_type: string | null
          first_call_at: string | null
          last_call_at: string | null
          max_generation_ms: number | null
          product_slug: string | null
          total_input_tokens: number | null
          total_output_tokens: number | null
          total_tokens: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_user_activity: {
        Row: {
          created_at: string | null
          email: string | null
          error_message: string | null
          event_action: string | null
          event_status: string | null
          event_type: string | null
          full_name: string | null
          metadata: Json | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_dinner_party_contribution: {
        Args: {
          p_amount_cents: number
          p_contributor_id: string
          p_transaction_id: string
        }
        Returns: undefined
      }
      archive_old_audit_logs: {
        Args: { days_old?: number }
        Returns: {
          archived_count: number
          archived_date: string
        }[]
      }
      calculate_commission: {
        Args: { p_amount_cents: number; p_is_direct: boolean; p_track: string }
        Returns: number
      }
      calculate_dinner_party_contribution: {
        Args: { p_amount_cents: number; p_track: string }
        Returns: number
      }
      can_create_new_version: {
        Args: { p_product_slug: string; p_user_id: string }
        Returns: Json
      }
      cancel_user_pending_emails: {
        Args: { p_user_id: string }
        Returns: number
      }
      cleanup_old_audit_logs: { Args: never; Returns: number }
      cleanup_old_email_sequences: {
        Args: { days_to_keep?: number }
        Returns: number
      }
      copy_placements_between_sessions: {
        Args: { source_session_id: string; target_session_id: string }
        Returns: boolean
      }
      create_session_version: {
        Args: {
          p_parent_session_id: string
          p_product_slug: string
          p_user_id: string
        }
        Returns: string
      }
      enroll_beta_participant: {
        Args: {
          p_cohort_name?: string
          p_user_email?: string
          p_user_id?: string
          p_why_participate?: string
        }
        Returns: string
      }
      generate_referral_code: { Args: never; Returns: string }
      get_affiliate_stats: {
        Args: { p_affiliate_id: string }
        Returns: {
          active_referrals: number
          available_balance_cents: number
          current_track: string
          dinner_party_credits_cents: number
          referral_code: string
          referral_link: string
          stripe_connect_onboarding_complete: boolean
          total_earnings_cents: number
          total_referrals: number
        }[]
      }
      get_iso_week_monday: { Args: { p_date?: string }; Returns: string }
      get_session_versions: {
        Args: { p_product_slug: string; p_user_id: string }
        Returns: {
          completed_at: string
          created_at: string
          has_deliverable: boolean
          is_complete: boolean
          is_latest: boolean
          session_id: string
          version: number
        }[]
      }
      get_user_activity_summary: {
        Args: { p_user_id: string }
        Returns: {
          error_count: number
          event_type: string
          last_activity: string
          success_count: number
          total_events: number
        }[]
      }
      get_user_prior_deliverables: {
        Args: { p_exclude_session?: string; p_user_id: string }
        Returns: {
          completed_at: string
          deliverable_content: string
          product_name: string
          product_slug: string
        }[]
      }
      grant_product_access: {
        Args: {
          p_amount_paid: number
          p_email: string
          p_product_slug: string
          p_stripe_session_id: string
        }
        Returns: string
      }
      grant_test_account_access: { Args: never; Returns: undefined }
      increment_affiliate_earnings: {
        Args: { p_affiliate_id: string; p_amount_cents: number }
        Returns: undefined
      }
      increment_referral_count: {
        Args: { p_referrer_id: string }
        Returns: undefined
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      log_admin_action: {
        Args: {
          p_action_type: string
          p_admin_user_id: string
          p_ip_address?: string
          p_new_value?: Json
          p_previous_value?: Json
          p_target_id?: string
          p_target_name?: string
          p_target_type: string
          p_user_agent?: string
        }
        Returns: string
      }
      log_audit_event: {
        Args: {
          p_error_message?: string
          p_event_action: string
          p_event_status: string
          p_event_type: string
          p_metadata?: Json
          p_user_id: string
        }
        Returns: string
      }
      match_knowledge: {
        Args: {
          filter_priority?: number
          filter_themes?: string[]
          filter_tradition?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          author: string
          chapter: string
          content: string
          content_type: string
          cross_tradition_tags: string[]
          id: string
          lines: string
          metadata: Json
          priority: number
          section: string
          similarity: number
          source_url: string
          technique_number: number
          text_name: string
          themes: string[]
          tradition: string
          verse: string
        }[]
      }
      reconfig_profile: {
        Args: { p_changes: Json; p_log_entry: Json; p_user_id: string }
        Returns: undefined
      }
      record_course_slide_event: {
        Args: {
          p_coord: string
          p_coord_x: number
          p_coord_y: number
          p_course_slug: string
          p_module_id: string
          p_submodule_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      redact_user_logs: { Args: { p_user_id: string }; Returns: number }
      refresh_audit_error_summary: { Args: never; Returns: undefined }
      search_knowledge_keyword: {
        Args: {
          filter_tradition?: string
          match_count?: number
          query_text: string
        }
        Returns: {
          author: string
          chapter: string
          content: string
          id: string
          lines: string
          priority: number
          rank: number
          section: string
          source_url: string
          text_name: string
          themes: string[]
          tradition: string
          verse: string
        }[]
      }
      update_session_progress: {
        Args: {
          p_current_step: number
          p_session_id: string
          p_total_steps: number
        }
        Returns: undefined
      }
      uuid_generate_v4: { Args: never; Returns: string }
    }
    Enums: {
      commitment_status: "OPEN" | "DELIVERED" | "BREACHED" | "REPLACED"
      rite_source: "RITE_I" | "RITE_II" | "RITE_III" | "ONGOING"
      subscription_status: "active" | "past_due" | "cancelled"
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
      commitment_status: ["OPEN", "DELIVERED", "BREACHED", "REPLACED"],
      rite_source: ["RITE_I", "RITE_II", "RITE_III", "ONGOING"],
      subscription_status: ["active", "past_due", "cancelled"],
    },
  },
} as const
