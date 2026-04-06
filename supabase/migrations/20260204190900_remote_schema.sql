drop trigger if exists "trigger_update_blueprint_feedback_count" on "public"."blueprint_feedback";

drop trigger if exists "trigger_update_journey_feedback_count" on "public"."complete_journey_feedback";

drop trigger if exists "trigger_update_declaration_feedback_count" on "public"."declaration_feedback";

drop trigger if exists "trigger_update_beta_progress" on "public"."product_access";

drop trigger if exists "trigger_sync_product_access_completion" on "public"."product_sessions";

drop trigger if exists "trigger_update_rite_one_consolidation_count" on "public"."rite_one_consolidation";

drop trigger if exists "trigger_update_rite_two_consolidation_count" on "public"."rite_two_consolidation";

drop trigger if exists "trigger_update_scan_feedback_count" on "public"."scan_feedback";

drop policy "Service role full access conversion results" on "public"."beta_conversion_results";

drop policy "Users view own conversion results" on "public"."beta_conversion_results";

drop policy "Service role full access beta participants" on "public"."beta_participants";

drop policy "Users view own beta participation" on "public"."beta_participants";

drop policy "Service role full access blueprint feedback" on "public"."blueprint_feedback";

drop policy "Users view own blueprint feedback" on "public"."blueprint_feedback";

drop policy "Service role full access journey feedback" on "public"."complete_journey_feedback";

drop policy "Users view own journey feedback" on "public"."complete_journey_feedback";

drop policy "Service role full access declaration feedback" on "public"."declaration_feedback";

drop policy "Users view own declaration feedback" on "public"."declaration_feedback";

drop policy "Service role full access rite one consolidation" on "public"."rite_one_consolidation";

drop policy "Users view own rite one consolidation" on "public"."rite_one_consolidation";

drop policy "Service role full access rite two consolidation" on "public"."rite_two_consolidation";

drop policy "Users view own rite two consolidation" on "public"."rite_two_consolidation";

drop policy "Service role full access scan feedback" on "public"."scan_feedback";

drop policy "Users view own scan feedback" on "public"."scan_feedback";

alter table "public"."admin_audit_logs" drop constraint "valid_action_type";

alter table "public"."beta_participants" drop constraint "valid_conversion";

alter table "public"."beta_participants" drop constraint "valid_rite";

alter table "public"."beta_participants" drop constraint "valid_status";

alter table "public"."blueprint_feedback" drop constraint "blueprint_feedback_beta_participant_id_product_slug_key";

alter table "public"."complete_journey_feedback" drop constraint "complete_journey_feedback_beta_participant_id_key";

alter table "public"."conversations" drop constraint "conversations_session_id_step_number_key";

alter table "public"."course_enrollments" drop constraint "course_enrollments_user_id_course_slug_key";

alter table "public"."course_progress" drop constraint "course_progress_user_id_course_slug_module_id_submodule_id_key";

alter table "public"."course_slide_events" drop constraint "course_slide_events_user_id_course_slug_module_id_submodule_key";

alter table "public"."course_submodules" drop constraint "course_submodules_course_slug_fkey";

alter table "public"."course_submodules" drop constraint "course_submodules_module_fk";

alter table "public"."declaration_feedback" drop constraint "declaration_feedback_beta_participant_id_product_slug_key";

alter table "public"."email_sequences" drop constraint "unique_user_sequence";

alter table "public"."email_sequences" drop constraint "valid_delay";

alter table "public"."email_sequences" drop constraint "valid_email_status";

alter table "public"."email_sequences" drop constraint "valid_sequence_type";

alter table "public"."rite_one_consolidation" drop constraint "rite_one_consolidation_beta_participant_id_key";

alter table "public"."rite_two_consolidation" drop constraint "rite_two_consolidation_beta_participant_id_key";

alter table "public"."scan_feedback" drop constraint "scan_feedback_beta_participant_id_product_slug_key";

alter table "public"."email_sequences" drop constraint "email_sequences_user_id_fkey";

drop function if exists "public"."sync_product_access_completion"();

drop function if exists "public"."update_beta_feedback_counts"();

drop function if exists "public"."update_beta_participant_progress"();

drop materialized view if exists "public"."audit_error_summary";

drop view if exists "public"."error_logs";

drop view if exists "public"."recent_user_activity";

alter table "public"."content_index" drop constraint "content_index_pkey";

drop index if exists "public"."blueprint_feedback_beta_participant_id_product_slug_key";

drop index if exists "public"."complete_journey_feedback_beta_participant_id_key";

drop index if exists "public"."content_index_path_idx";

drop index if exists "public"."conversations_session_id_step_number_key";

drop index if exists "public"."course_enrollments_user_id_course_slug_key";

drop index if exists "public"."course_progress_user_id_course_slug_module_id_submodule_id_key";

drop index if exists "public"."course_slide_events_user_id_course_slug_module_id_submodule_key";

drop index if exists "public"."declaration_feedback_beta_participant_id_product_slug_key";

drop index if exists "public"."idx_beta_conversion_date";

drop index if exists "public"."idx_beta_conversion_decision";

drop index if exists "public"."idx_beta_conversion_participant";

drop index if exists "public"."idx_beta_conversion_stage";

drop index if exists "public"."idx_beta_participants_cohort";

drop index if exists "public"."idx_beta_participants_current_rite";

drop index if exists "public"."idx_beta_participants_enrollment_date";

drop index if exists "public"."idx_beta_participants_status";

drop index if exists "public"."idx_blueprint_feedback_participant";

drop index if exists "public"."idx_blueprint_feedback_product";

drop index if exists "public"."idx_complete_journey_founding";

drop index if exists "public"."idx_complete_journey_nps";

drop index if exists "public"."idx_complete_journey_participant";

drop index if exists "public"."idx_complete_journey_timeline";

drop index if exists "public"."idx_declaration_feedback_participant";

drop index if exists "public"."idx_declaration_feedback_product";

drop index if exists "public"."idx_rite_one_consolidation_nps";

drop index if exists "public"."idx_rite_one_consolidation_participant";

drop index if exists "public"."idx_rite_two_consolidation_nps";

drop index if exists "public"."idx_rite_two_consolidation_participant";

drop index if exists "public"."idx_scan_feedback_participant";

drop index if exists "public"."idx_scan_feedback_product";

drop index if exists "public"."idx_scan_feedback_submitted";

drop index if exists "public"."rite_one_consolidation_beta_participant_id_key";

drop index if exists "public"."rite_two_consolidation_beta_participant_id_key";

drop index if exists "public"."scan_feedback_beta_participant_id_product_slug_key";

drop index if exists "public"."unique_user_sequence";

drop index if exists "public"."content_index_pkey";

alter table "public"."affiliate_transactions" alter column "id" set default public.uuid_generate_v4();

alter table "public"."audit_logs" drop column "duration_ms";

alter table "public"."audit_logs" drop column "request_body";

alter table "public"."audit_logs" drop column "request_method";

alter table "public"."audit_logs" drop column "response_body";

alter table "public"."audit_logs" drop column "response_status";

alter table "public"."audit_logs" add column "entity_id" uuid;

alter table "public"."audit_logs" add column "entity_type" text;

alter table "public"."audit_logs" alter column "event_status" set default 'success'::text;

alter table "public"."audit_logs" alter column "event_status" drop not null;

alter table "public"."audit_logs" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."audit_logs" alter column "metadata" set default '{}'::jsonb;

alter table "public"."beta_conversion_results" disable row level security;

alter table "public"."beta_participants" drop column "complete_journey_submitted";

alter table "public"."beta_participants" drop column "completion_email_sent_at";

alter table "public"."beta_participants" drop column "consolidation_feedback_count";

alter table "public"."beta_participants" drop column "conversion_amount";

alter table "public"."beta_participants" drop column "conversion_decision";

alter table "public"."beta_participants" drop column "conversion_decision_at";

alter table "public"."beta_participants" drop column "conversion_offer_presented_at";

alter table "public"."beta_participants" drop column "conversion_stripe_session_id";

alter table "public"."beta_participants" drop column "current_rite";

alter table "public"."beta_participants" drop column "declaration_completed_count";

alter table "public"."beta_participants" drop column "discount_code_generated";

alter table "public"."beta_participants" drop column "enrollment_date";

alter table "public"."beta_participants" drop column "feedback_completion_rate";

alter table "public"."beta_participants" drop column "micro_feedback_count";

alter table "public"."beta_participants" drop column "notes";

alter table "public"."beta_participants" drop column "orientation_completed_count";

alter table "public"."beta_participants" drop column "perception_completed_count";

alter table "public"."beta_participants" drop column "remaining_balance_offered";

alter table "public"."beta_participants" drop column "rite_one_celebration_sent_at";

alter table "public"."beta_participants" drop column "rite_three_celebration_sent_at";

alter table "public"."beta_participants" drop column "rite_two_celebration_sent_at";

alter table "public"."beta_participants" drop column "summary_pdf_generated";

alter table "public"."beta_participants" drop column "summary_pdf_url";

alter table "public"."beta_participants" drop column "total_amount_paid_before_offer";

alter table "public"."beta_participants" drop column "total_completion_percentage";

alter table "public"."beta_participants" drop column "week_1_checkin_sent_at";

alter table "public"."beta_participants" drop column "week_2_checkin_sent_at";

alter table "public"."beta_participants" drop column "week_4_checkin_sent_at";

alter table "public"."beta_participants" drop column "welcome_email_sent_at";

alter table "public"."beta_participants" alter column "cohort_name" drop default;

alter table "public"."beta_participants" alter column "cohort_name" drop not null;

alter table "public"."beta_participants" alter column "created_at" drop not null;

alter table "public"."beta_participants" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."beta_participants" alter column "program_end_date" drop default;

alter table "public"."beta_participants" alter column "program_end_date" drop not null;

alter table "public"."beta_participants" alter column "program_start_date" drop default;

alter table "public"."beta_participants" alter column "program_start_date" drop not null;

alter table "public"."beta_participants" alter column "status" drop not null;

alter table "public"."beta_participants" alter column "updated_at" drop not null;

alter table "public"."blueprint_feedback" disable row level security;

alter table "public"."complete_journey_feedback" disable row level security;

alter table "public"."content_index" drop column "depth";

alter table "public"."content_index" drop column "doc_id";

alter table "public"."content_index" drop column "is_folder";

alter table "public"."content_index" drop column "last_synced_at";

alter table "public"."content_index" drop column "mime_type";

alter table "public"."content_index" drop column "modified_time";

alter table "public"."content_index" drop column "name";

alter table "public"."content_index" drop column "parent_id";

alter table "public"."content_index" drop column "path";

alter table "public"."content_index" add column "content_key" text not null;

alter table "public"."content_index" add column "content_type" text not null;

alter table "public"."content_index" add column "content_value" text;

alter table "public"."content_index" add column "created_at" timestamp with time zone default now();

alter table "public"."content_index" add column "id" uuid not null default extensions.uuid_generate_v4();

alter table "public"."content_index" add column "metadata" jsonb default '{}'::jsonb;

alter table "public"."content_index" add column "updated_at" timestamp with time zone default now();

alter table "public"."conversations" add column "content" text;

alter table "public"."conversations" enable row level security;

alter table "public"."declaration_feedback" disable row level security;

alter table "public"."dinner_party_contributions" alter column "id" set default public.uuid_generate_v4();

alter table "public"."dinner_party_pools" alter column "id" set default public.uuid_generate_v4();

alter table "public"."email_sequences" drop column "failed_at";

alter table "public"."email_sequences" drop column "trigger_event";

alter table "public"."email_sequences" drop column "trigger_timestamp";

alter table "public"."email_sequences" add column "scheduled_for" timestamp with time zone;

alter table "public"."email_sequences" alter column "created_at" drop not null;

alter table "public"."email_sequences" alter column "delay_minutes" set default 0;

alter table "public"."email_sequences" alter column "delay_minutes" drop not null;

alter table "public"."email_sequences" alter column "email_content" drop not null;

alter table "public"."email_sequences" alter column "email_status" drop not null;

alter table "public"."email_sequences" alter column "id" set default extensions.uuid_generate_v4();

alter table "public"."email_sequences" alter column "retry_count" drop not null;

alter table "public"."email_sequences" alter column "scheduled_send_at" drop not null;

alter table "public"."email_sequences" alter column "updated_at" drop not null;

alter table "public"."product_access" enable row level security;

alter table "public"."product_definitions" enable row level security;

alter table "public"."product_sessions" add column "deliverable" text;

alter table "public"."product_sessions" add column "is_active" boolean default true;

alter table "public"."product_sessions" add column "session_data" jsonb default '{}'::jsonb;

alter table "public"."product_sessions" add column "status" text default 'in_progress'::text;

alter table "public"."product_sessions" alter column "current_section" drop not null;

alter table "public"."product_sessions" alter column "followup_counts" drop not null;

alter table "public"."product_sessions" alter column "placements_confirmed" drop not null;

alter table "public"."product_sessions" alter column "total_steps" drop not null;

alter table "public"."product_sessions" enable row level security;

alter table "public"."referral_hierarchy" alter column "id" set default public.uuid_generate_v4();

alter table "public"."rite_one_consolidation" disable row level security;

alter table "public"."rite_two_consolidation" disable row level security;

alter table "public"."scan_feedback" disable row level security;

alter table "public"."stripe_connect_onboarding" alter column "id" set default public.uuid_generate_v4();

alter table "public"."track_changes" alter column "id" set default public.uuid_generate_v4();

alter table "public"."uploaded_documents" enable row level security;

alter table "public"."users" alter column "role" drop not null;

alter table "public"."users" enable row level security;

CREATE UNIQUE INDEX content_index_content_type_content_key_key ON public.content_index USING btree (content_type, content_key);

CREATE UNIQUE INDEX course_enrollments_user_course_unique ON public.course_enrollments USING btree (user_id, course_slug);

CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);

CREATE INDEX idx_conversations_session ON public.conversations USING btree (session_id);

CREATE INDEX idx_course_enrollments_course ON public.course_enrollments USING btree (course_slug);

CREATE INDEX idx_course_enrollments_user ON public.course_enrollments USING btree (user_id);

CREATE INDEX idx_product_access_slug ON public.product_access USING btree (product_slug);

CREATE INDEX idx_product_access_user ON public.product_access USING btree (user_id);

CREATE INDEX idx_product_sessions_slug ON public.product_sessions USING btree (product_slug);

CREATE INDEX idx_product_sessions_user ON public.product_sessions USING btree (user_id);

CREATE INDEX idx_users_stripe ON public.users USING btree (stripe_customer_id);

CREATE UNIQUE INDEX content_index_pkey ON public.content_index USING btree (id);

alter table "public"."content_index" add constraint "content_index_pkey" PRIMARY KEY using index "content_index_pkey";

alter table "public"."admin_audit_logs" add constraint "admin_audit_logs_action_type_check" CHECK ((action_type = ANY (ARRAY['product_create'::text, 'product_update'::text, 'product_delete'::text, 'step_create'::text, 'step_update'::text, 'step_delete'::text, 'step_reorder'::text, 'prompt_create'::text, 'prompt_update'::text, 'prompt_delete'::text, 'prompt_rollback'::text, 'user_role_change'::text, 'admin_login'::text, 'admin_logout'::text, 'test_simulate'::text]))) not valid;

alter table "public"."admin_audit_logs" validate constraint "admin_audit_logs_action_type_check";

alter table "public"."content_index" add constraint "content_index_content_type_content_key_key" UNIQUE using index "content_index_content_type_content_key_key";

alter table "public"."course_enrollments" add constraint "course_enrollments_user_course_unique" UNIQUE using index "course_enrollments_user_course_unique";

alter table "public"."email_sequences" add constraint "email_sequences_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) not valid;

alter table "public"."email_sequences" validate constraint "email_sequences_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enroll_beta_participant(p_user_email text, p_why_participate text DEFAULT NULL::text, p_cohort_name text DEFAULT 'Beta Cohort'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$                                                                         
  DECLARE                                                                       
    v_user_id UUID;                                                             
    v_participant_id UUID;                                                      
    product_record RECORD;                                                      
  BEGIN                                                                         
    SELECT id INTO v_user_id FROM users WHERE email = p_user_email;             
    IF v_user_id IS NULL THEN                                                   
      INSERT INTO users (email, name) VALUES (p_user_email,                     
  split_part(p_user_email, '@', 1))                                             
      RETURNING id INTO v_user_id;                                              
    END IF;                                                                     
                                                                                
    SELECT id INTO v_participant_id FROM beta_participants WHERE user_id =      
  v_user_id;                                                                    
    IF v_participant_id IS NOT NULL THEN RETURN v_participant_id; END IF;       
                                                                                
    INSERT INTO beta_participants (user_id, cohort_name,                        
  application_why_participate)                                                  
    VALUES (v_user_id, p_cohort_name, p_why_participate)                        
    RETURNING id INTO v_participant_id;                                         
                                                                                
    FOR product_record IN                                                       
      SELECT product_slug FROM product_definitions                              
      WHERE product_slug IN (                                                   
                                                                                
  'perception-rite-scan-1','perception-rite-scan-2','perception-rite-scan-3',   
        'perception-rite-scan-4','perception-rite-scan-5',                      
        'personal-alignment','business-alignment','brand-alignment',            
        'declaration-rite-life-vision','declaration-rite-business-model','declar
  ation-rite-strategic-path'                                                    
      )                                                                         
    LOOP                                                                        
      INSERT INTO product_access (user_id, product_slug, access_granted,        
  purchase_source)                                                              
      VALUES (v_user_id, product_record.product_slug, true, 'beta_enrollment')  
      ON CONFLICT (user_id, product_slug) DO UPDATE SET access_granted = true,  
  purchase_source = 'beta_enrollment';                                          
    END LOOP;                                                                   
                                                                                
    RETURN v_participant_id;                                                    
  END;                                                                          
  $function$
;

CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
 RETURNS uuid
 LANGUAGE sql
AS $function$
  SELECT extensions.uuid_generate_v4();
$function$
;

create materialized view "public"."audit_error_summary" as  SELECT event_type,
    event_action,
    error_code,
    count(*) AS error_count,
    count(DISTINCT user_id) AS affected_users,
    max(created_at) AS last_occurrence
   FROM public.audit_logs
  WHERE ((event_status = 'error'::text) AND (created_at > (now() - '24:00:00'::interval)))
  GROUP BY event_type, event_action, error_code
  ORDER BY (count(*)) DESC;


CREATE OR REPLACE FUNCTION public.auto_copy_placements_to_new_session()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$                       
  DECLARE                                                                       
    user_placements jsonb;                                                      
    previous_session_placements jsonb;                                          
  BEGIN                                                                         
    IF NEW.placements IS NOT NULL OR NEW.placements_confirmed = true THEN       
      RETURN NEW;                                                               
    END IF;                                                                     
    SELECT placements INTO user_placements FROM users                           
    WHERE id = NEW.user_id AND placements_confirmed = TRUE AND placements IS NOT
   NULL;                                                                        
    IF user_placements IS NOT NULL THEN                                         
      NEW.placements := user_placements;                                        
      NEW.placements_confirmed := false;                                        
      RETURN NEW;                                                               
    END IF;                                                                     
    SELECT placements INTO previous_session_placements FROM product_sessions    
    WHERE user_id = NEW.user_id AND placements_confirmed = TRUE AND placements  
  IS NOT NULL AND id != NEW.id                                                  
    ORDER BY created_at DESC LIMIT 1;                                           
    IF previous_session_placements IS NOT NULL THEN                             
      NEW.placements := previous_session_placements;                            
      NEW.placements_confirmed := false;                                        
    END IF;                                                                     
    RETURN NEW;                                                                 
  END;                                                                          
  $function$
;

CREATE OR REPLACE FUNCTION public.copy_placements_between_sessions(source_session_id uuid, target_session_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$                       
  DECLARE                                                                       
    source_placements jsonb;                                                    
    source_user_id uuid;                                                        
    target_user_id uuid;                                                        
  BEGIN                                                                         
    SELECT placements, user_id INTO source_placements, source_user_id FROM      
  product_sessions WHERE id = source_session_id;                                
    SELECT user_id INTO target_user_id FROM product_sessions WHERE id =         
  target_session_id;                                                            
    IF source_user_id != target_user_id THEN RAISE EXCEPTION 'Cannot copy       
  placements between different users'; END IF;                                  
    IF source_placements IS NULL THEN RAISE EXCEPTION 'Source session has no    
  placements'; END IF;                                                          
    UPDATE product_sessions SET placements = source_placements,                 
  placements_confirmed = true WHERE id = target_session_id;                     
    RETURN true;                                                                
  END;                                                                          
  $function$
;

create or replace view "public"."error_logs" as  SELECT al.user_id,
    u.email,
    al.event_type,
    al.event_action,
    al.error_message,
    al.error_stack,
    al.error_code,
    al.request_path,
    al.metadata,
    al.created_at
   FROM (public.audit_logs al
     LEFT JOIN public.users u ON ((al.user_id = u.id)))
  WHERE (al.event_status = 'error'::text)
  ORDER BY al.created_at DESC;


CREATE OR REPLACE FUNCTION public.grant_product_access(p_email text, p_product_slug text, p_stripe_session_id text, p_amount_paid numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$                                                            
  DECLARE                                                                       
    v_user_id UUID;                                                             
    v_access_id UUID;                                                           
  BEGIN                                                                         
    SELECT id INTO v_user_id FROM users WHERE email = p_email;                  
                                                                                
    IF v_user_id IS NULL THEN                                                   
      INSERT INTO users (email) VALUES (p_email) RETURNING id INTO v_user_id;   
    END IF;                                                                     
                                                                                
    INSERT INTO product_access (                                                
      user_id, product_slug, stripe_session_id, amount_paid                     
    ) VALUES (                                                                  
      v_user_id, p_product_slug, p_stripe_session_id, p_amount_paid             
    )                                                                           
    ON CONFLICT (user_id, product_slug) DO UPDATE                               
      SET access_granted = TRUE,                                                
          stripe_session_id = p_stripe_session_id,                              
          amount_paid = p_amount_paid                                           
    RETURNING id INTO v_access_id;                                              
                                                                                
    RETURN v_access_id;                                                         
  END;                                                                          
  $function$
;

create or replace view "public"."recent_user_activity" as  SELECT al.user_id,
    u.email,
    NULL::text AS full_name,
    al.event_type,
    al.event_action,
    al.event_status,
    al.error_message,
    al.metadata,
    al.created_at
   FROM (public.audit_logs al
     LEFT JOIN public.users u ON ((al.user_id = u.id)))
  WHERE (al.created_at > (now() - '7 days'::interval))
  ORDER BY al.created_at DESC;


CREATE OR REPLACE FUNCTION public.update_session_progress(p_session_id uuid, p_current_step integer, p_total_steps integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$                                                            
  BEGIN                                                                         
    UPDATE product_sessions                                                     
    SET                                                                         
      current_step = p_current_step,                                            
      last_activity_at = NOW()                                                  
    WHERE id = p_session_id;                                                    
                                                                                
    UPDATE product_access                                                       
    SET completion_percentage = ROUND((p_current_step::DECIMAL / p_total_steps) 
  * 100)                                                                        
    WHERE user_id = (SELECT user_id FROM product_sessions WHERE id =            
  p_session_id)                                                                 
      AND product_slug = (SELECT product_slug FROM product_sessions WHERE id =  
  p_session_id);                                                                
  END;
    $function$
;


  create policy "Service role full access beta"
  on "public"."beta_participants"
  as permissive
  for all
  to service_role
using (true)
with check (true);



  create policy "Users view own beta"
  on "public"."beta_participants"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users access own conversations"
  on "public"."conversations"
  as permissive
  for all
  to authenticated
using ((session_id IN ( SELECT product_sessions.id
   FROM public.product_sessions
  WHERE (product_sessions.user_id = auth.uid()))));



  create policy "conv_insert"
  on "public"."conversations"
  as permissive
  for insert
  to public
with check ((EXISTS ( SELECT 1
   FROM public.product_sessions
  WHERE ((product_sessions.id = conversations.session_id) AND (product_sessions.user_id = auth.uid())))));



  create policy "conv_select"
  on "public"."conversations"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.product_sessions
  WHERE ((product_sessions.id = conversations.session_id) AND (product_sessions.user_id = auth.uid())))));



  create policy "conv_service"
  on "public"."conversations"
  as permissive
  for all
  to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));



  create policy "conv_update"
  on "public"."conversations"
  as permissive
  for update
  to public
using ((EXISTS ( SELECT 1
   FROM public.product_sessions
  WHERE ((product_sessions.id = conversations.session_id) AND (product_sessions.user_id = auth.uid())))));



  create policy "Users insert own enrollments"
  on "public"."course_enrollments"
  as permissive
  for insert
  to authenticated
with check ((auth.uid() = user_id));



  create policy "Users read own enrollments"
  on "public"."course_enrollments"
  as permissive
  for select
  to authenticated
using ((auth.uid() = user_id));



  create policy "Users update own enrollments"
  on "public"."course_enrollments"
  as permissive
  for update
  to authenticated
using ((auth.uid() = user_id));



  create policy "pa_select_own"
  on "public"."product_access"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "pa_service"
  on "public"."product_access"
  as permissive
  for all
  to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));



  create policy "pd_select"
  on "public"."product_definitions"
  as permissive
  for select
  to public
using ((is_active = true));



  create policy "pd_service"
  on "public"."product_definitions"
  as permissive
  for all
  to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));



  create policy "ps_insert_own"
  on "public"."product_sessions"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "ps_select_own"
  on "public"."product_sessions"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "ps_service"
  on "public"."product_sessions"
  as permissive
  for all
  to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));



  create policy "ps_update_own"
  on "public"."product_sessions"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can delete own documents"
  on "public"."uploaded_documents"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert own documents"
  on "public"."uploaded_documents"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view own documents"
  on "public"."uploaded_documents"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Service role has full access to users"
  on "public"."users"
  as permissive
  for all
  to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));



  create policy "Users can update own profile"
  on "public"."users"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Users can view own profile"
  on "public"."users"
  as permissive
  for select
  to public
using ((auth.uid() = id));



  create policy "users_select_own"
  on "public"."users"
  as permissive
  for select
  to public
using ((auth.uid() = id));



  create policy "users_service"
  on "public"."users"
  as permissive
  for all
  to public
using (((auth.jwt() ->> 'role'::text) = 'service_role'::text));



  create policy "users_update_own"
  on "public"."users"
  as permissive
  for update
  to public
using ((auth.uid() = id));



