export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    graphql_public: {
        Tables: {
            [_ in never]: never
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            graphql: {
                Args: {
                    extensions?: Json
                    operationName?: string
                    query?: string
                    variables?: Json
                }
                Returns: Json
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
    public: {
        Tables: {
            Changelog: {
                Row: {
                    id: string
                    created_at: string
                    version: string | null
                    content: Json | null
                    deployement_date: string | null
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    version?: string | null
                    content?: Json | null
                    deployement_date?: string | null
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    version?: string | null
                    content?: Json | null
                    deployement_date?: string | null
                }
                Relationships: []
            }
            Client_activite: {
                Row: {
                    id: string
                    client: string
                    date: string | null
                    title: string | null
                    content: string | null
                    owner: string | null
                }
                Insert: {
                    id?: string | null
                    client?: string | null
                    date?: string | null
                    title?: string | null
                    content?: string | null
                    owner?: string | null
                }
                Update: {
                    id?: string | null
                    client?: string | null
                    date?: string | null
                    title?: string | null
                    content?: string | null
                    owner?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "Client_activite_client_fkey"
                        columns: ["client"]
                        isOneToOne: false
                        referencedRelation: "client_crm"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "Client_activite_owner_fkey"
                        columns: ["owner"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            Devis: {
                Row: {
                    id: string
                    by: string
                    client: string | null
                    Tableau_id: string | null
                    poid: number | null
                    totalHT: number | null
                    totalTVA: number | null
                    totalTTC: number | null
                    termes: string | null
                    status: string | null
                    paiement: string | null
                    service: string | null
                    Date_crea: string | null
                    Date_end: string | null
                    name: string | null
                    TVA: number | null
                    Livraison: string | null
                    Archive: boolean | null
                    Avoir: number | null
                    Remise: string | null
                    poid_balance: number | null
                    urgence: string | null
                }
                Insert: {
                    id?: string | null
                    by?: string | null
                    client?: string | null
                    Tableau_id?: string | null
                    poid?: number | null
                    totalHT?: number | null
                    totalTVA?: number | null
                    totalTTC?: number | null
                    termes?: string | null
                    status?: string | null
                    paiement?: string | null
                    service?: string | null
                    Date_crea?: string | null
                    Date_end?: string | null
                    name?: string | null
                    TVA?: number | null
                    Livraison?: string | null
                    Archive?: boolean | null
                    Avoir?: number | null
                    Remise?: string | null
                    poid_balance?: number | null
                    urgence?: string | null
                }
                Update: {
                    id?: string | null
                    by?: string | null
                    client?: string | null
                    Tableau_id?: string | null
                    poid?: number | null
                    totalHT?: number | null
                    totalTVA?: number | null
                    totalTTC?: number | null
                    termes?: string | null
                    status?: string | null
                    paiement?: string | null
                    service?: string | null
                    Date_crea?: string | null
                    Date_end?: string | null
                    name?: string | null
                    TVA?: number | null
                    Livraison?: string | null
                    Archive?: boolean | null
                    Avoir?: number | null
                    Remise?: string | null
                    poid_balance?: number | null
                    urgence?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "devis_by_fkey"
                        columns: ["by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "devis_client_fkey"
                        columns: ["client"]
                        isOneToOne: false
                        referencedRelation: "client_crm"
                        referencedColumns: ["id"]
                    },
                ]
            }
            Event_calendar: {
                Row: {
                    id: string
                    customer: string | null
                    nom: string | null
                    debut: string | null
                    fin: string | null
                    client: string | null
                    lieu: string | null
                    description: string | null
                    id_client: string | null
                    updated_at: string | null
                    creator_id: string | null
                    show: boolean | null
                    created_at: string | null
                    why: string | null
                    source: string
                    external_id: string | null
                    "a confirmer": boolean | null
                    reminder_3j_sent_at: string | null
                    confirmed: boolean
                }
                Insert: {
                    id?: string | null
                    customer?: string | null
                    nom?: string | null
                    debut?: string | null
                    fin?: string | null
                    client?: string | null
                    lieu?: string | null
                    description?: string | null
                    id_client?: string | null
                    updated_at?: string | null
                    creator_id?: string | null
                    show?: boolean | null
                    created_at?: string | null
                    why?: string | null
                    source?: string | null
                    external_id?: string | null
                    "a confirmer"?: boolean | null
                    reminder_3j_sent_at?: string | null
                    confirmed?: boolean | null
                }
                Update: {
                    id?: string | null
                    customer?: string | null
                    nom?: string | null
                    debut?: string | null
                    fin?: string | null
                    client?: string | null
                    lieu?: string | null
                    description?: string | null
                    id_client?: string | null
                    updated_at?: string | null
                    creator_id?: string | null
                    show?: boolean | null
                    created_at?: string | null
                    why?: string | null
                    source?: string | null
                    external_id?: string | null
                    "a confirmer"?: boolean | null
                    reminder_3j_sent_at?: string | null
                    confirmed?: boolean | null
                }
                Relationships: [
                    {
                        foreignKeyName: "Event_calendar_id_client_fkey"
                        columns: ["id_client"]
                        isOneToOne: false
                        referencedRelation: "client_crm"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "event_calendar_customer_fkey"
                        columns: ["customer"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            Event_calendar_Comm: {
                Row: {
                    id: string
                    nom: string | null
                    debut: string | null
                    fin: string | null
                    updated_at: string | null
                    creator_id: string | null
                    customer: string | null
                    description: string | null
                    valide: boolean | null
                }
                Insert: {
                    id?: string | null
                    nom?: string | null
                    debut?: string | null
                    fin?: string | null
                    updated_at?: string | null
                    creator_id?: string | null
                    customer?: string | null
                    description?: string | null
                    valide?: boolean | null
                }
                Update: {
                    id?: string | null
                    nom?: string | null
                    debut?: string | null
                    fin?: string | null
                    updated_at?: string | null
                    creator_id?: string | null
                    customer?: string | null
                    description?: string | null
                    valide?: boolean | null
                }
                Relationships: [
                    {
                        foreignKeyName: "Event_calendar_Comm_customer_fkey"
                        columns: ["customer"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            Fournisseur_crm: {
                Row: {
                    id: string
                    name: string
                }
                Insert: {
                    id?: string | null
                    name: string
                }
                Update: {
                    id?: string | null
                    name?: string | null
                }
                Relationships: []
            }
            Kanban_comm: {
                Row: {
                    id: number
                    created_at: string
                    column: number | null
                    created_by: string | null
                    assigned: string | null
                    description: string | null
                }
                Insert: {
                    id?: number | null
                    created_at?: string | null
                    column?: number | null
                    created_by?: string | null
                    assigned?: string | null
                    description?: string | null
                }
                Update: {
                    id?: number | null
                    created_at?: string | null
                    column?: number | null
                    created_by?: string | null
                    assigned?: string | null
                    description?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "Kanban_comm_assigned_fkey"
                        columns: ["assigned"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "Kanban_comm_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            Maintenance: {
                Row: {
                    id: string
                    created_at: string
                    deployement_date: string
                    message: string | null
                    Active: boolean | null
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    deployement_date: string
                    message?: string | null
                    Active?: boolean | null
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    deployement_date?: string | null
                    message?: string | null
                    Active?: boolean | null
                }
                Relationships: []
            }
            News: {
                Row: {
                    id: string
                    created_at: string
                    title: string
                    content: string | null
                    start_date: string
                    end_date: string
                    image: Json | null
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    title: string
                    content?: string | null
                    start_date: string
                    end_date: string
                    image?: Json | null
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    title?: string | null
                    content?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    image?: Json | null
                }
                Relationships: []
            }
            Tache_crm: {
                Row: {
                    id: string
                    type: string
                    client: string | null
                    content: string | null
                    valide: boolean | null
                    owner: string | null
                    date: string | null
                    placement: string | null
                    overdue_notified_at: string | null
                    categorie: string | null
                    creator_id: string | null
                    event_id: string | null
                }
                Insert: {
                    id?: string | null
                    type: string
                    client?: string | null
                    content?: string | null
                    valide?: boolean | null
                    owner?: string | null
                    date?: string | null
                    placement?: string | null
                    overdue_notified_at?: string | null
                    categorie?: string | null
                    creator_id?: string | null
                    event_id?: string | null
                }
                Update: {
                    id?: string | null
                    type?: string | null
                    client?: string | null
                    content?: string | null
                    valide?: boolean | null
                    owner?: string | null
                    date?: string | null
                    placement?: string | null
                    overdue_notified_at?: string | null
                    categorie?: string | null
                    creator_id?: string | null
                    event_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "Tache_crm_client_fkey"
                        columns: ["client"]
                        isOneToOne: false
                        referencedRelation: "client_crm"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "Tache_crm_creator_id_fkey"
                        columns: ["creator_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "Tache_crm_event_id_fkey"
                        columns: ["event_id"]
                        isOneToOne: false
                        referencedRelation: "Event_calendar"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "Tache_crm_owner_fkey"
                        columns: ["owner"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            Type_product_CRM: {
                Row: {
                    id: string
                    name: string
                }
                Insert: {
                    id?: string | null
                    name: string
                }
                Update: {
                    id?: string | null
                    name?: string | null
                }
                Relationships: []
            }
            activity_log: {
                Row: {
                    id: string
                    created_at: string
                    user_id: string | null
                    entity_type: string
                    entity_id: string | null
                    entity_label: string | null
                    action: string
                    description: string | null
                    changes: Json | null
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    user_id?: string | null
                    entity_type: string
                    entity_id?: string | null
                    entity_label?: string | null
                    action: string
                    description?: string | null
                    changes?: Json | null
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    user_id?: string | null
                    entity_type?: string | null
                    entity_id?: string | null
                    entity_label?: string | null
                    action?: string | null
                    description?: string | null
                    changes?: Json | null
                }
                Relationships: []
            }
            ai_watch_reports: {
                Row: {
                    id: string
                    created_at: string | null
                    period_start: string | null
                    period_end: string | null
                    topic: string
                    frequency: string | null
                    source_model: string | null
                    analysis_model: string | null
                    raw_research: string | null
                    executive_summary: string | null
                    risks: string | null
                    opportunities: string | null
                    recommended_actions: string | null
                    importance_score: number | null
                    tags: string[] | null
                    metadata: Json | null
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    period_start?: string | null
                    period_end?: string | null
                    topic: string
                    frequency?: string | null
                    source_model?: string | null
                    analysis_model?: string | null
                    raw_research?: string | null
                    executive_summary?: string | null
                    risks?: string | null
                    opportunities?: string | null
                    recommended_actions?: string | null
                    importance_score?: number | null
                    tags?: string[] | null
                    metadata?: Json | null
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    period_start?: string | null
                    period_end?: string | null
                    topic?: string | null
                    frequency?: string | null
                    source_model?: string | null
                    analysis_model?: string | null
                    raw_research?: string | null
                    executive_summary?: string | null
                    risks?: string | null
                    opportunities?: string | null
                    recommended_actions?: string | null
                    importance_score?: number | null
                    tags?: string[] | null
                    metadata?: Json | null
                }
                Relationships: []
            }
            amelia_availability_closures: {
                Row: {
                    id: string
                    supabase_user_id: string
                    start_date: string
                    end_date: string
                    name: string | null
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    supabase_user_id: string
                    start_date: string
                    end_date: string
                    name?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    supabase_user_id?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    name?: string | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "amelia_availability_closures_supabase_user_id_fkey"
                        columns: ["supabase_user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            amelia_availability_days_off: {
                Row: {
                    id: string
                    supabase_user_id: string
                    day: string
                    name: string | null
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    supabase_user_id: string
                    day: string
                    name?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    supabase_user_id?: string | null
                    day?: string | null
                    name?: string | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "amelia_availability_days_off_supabase_user_id_fkey"
                        columns: ["supabase_user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            amelia_availability_special: {
                Row: {
                    id: string
                    supabase_user_id: string
                    day: string
                    start_time: string
                    end_time: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    supabase_user_id: string
                    day: string
                    start_time: string
                    end_time: string
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    supabase_user_id?: string | null
                    day?: string | null
                    start_time?: string | null
                    end_time?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "amelia_availability_special_supabase_user_id_fkey"
                        columns: ["supabase_user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            amelia_availability_weekly: {
                Row: {
                    id: string
                    supabase_user_id: string
                    day_of_week: number
                    start_time: string
                    end_time: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    supabase_user_id: string
                    day_of_week: number
                    start_time: string
                    end_time: string
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    supabase_user_id?: string | null
                    day_of_week?: number | null
                    start_time?: string | null
                    end_time?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "amelia_availability_weekly_supabase_user_id_fkey"
                        columns: ["supabase_user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            amelia_company_closures: {
                Row: {
                    id: string
                    start_date: string
                    end_date: string
                    name: string | null
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    start_date: string
                    end_date: string
                    name?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    name?: string | null
                    created_at?: string | null
                }
                Relationships: []
            }
            amelia_company_days_off: {
                Row: {
                    id: string
                    day: string
                    name: string | null
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    day: string
                    name?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    day?: string | null
                    name?: string | null
                    created_at?: string | null
                }
                Relationships: []
            }
            amelia_company_special: {
                Row: {
                    id: string
                    day: string
                    start_time: string
                    end_time: string
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    day: string
                    start_time: string
                    end_time: string
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    day?: string | null
                    start_time?: string | null
                    end_time?: string | null
                    created_at?: string | null
                }
                Relationships: []
            }
            amelia_company_weekly: {
                Row: {
                    id: string
                    day_of_week: number
                    start_time: string
                    end_time: string
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    day_of_week: number
                    start_time: string
                    end_time: string
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    day_of_week?: number | null
                    start_time?: string | null
                    end_time?: string | null
                    created_at?: string | null
                }
                Relationships: []
            }
            amelia_provider_mapping: {
                Row: {
                    amelia_provider_id: number
                    supabase_user_id: string | null
                    email: string
                    first_name: string | null
                    last_name: string | null
                    phone: string | null
                    status: string | null
                    last_synced_at: string
                    created_at: string
                    updated_at: string
                    managed_by_bridge: boolean
                }
                Insert: {
                    amelia_provider_id: number
                    supabase_user_id?: string | null
                    email: string
                    first_name?: string | null
                    last_name?: string | null
                    phone?: string | null
                    status?: string | null
                    last_synced_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    managed_by_bridge?: boolean | null
                }
                Update: {
                    amelia_provider_id?: number | null
                    supabase_user_id?: string | null
                    email?: string | null
                    first_name?: string | null
                    last_name?: string | null
                    phone?: string | null
                    status?: string | null
                    last_synced_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    managed_by_bridge?: boolean | null
                }
                Relationships: [
                    {
                        foreignKeyName: "amelia_provider_mapping_supabase_user_id_fkey"
                        columns: ["supabase_user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            analytics_export_collaborators: {
                Row: {
                    id: string
                    user_id: string
                    fallback_name: string | null
                    group_index: number
                    member_index: number
                    sep_after: string | null
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    user_id: string
                    fallback_name?: string | null
                    group_index: number
                    member_index: number
                    sep_after?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    user_id?: string | null
                    fallback_name?: string | null
                    group_index?: number | null
                    member_index?: number | null
                    sep_after?: string | null
                    created_at?: string | null
                }
                Relationships: []
            }
            analyze_content_generation: {
                Row: {
                    id: string
                    created_at: string
                    category: string | null
                    color: string | null
                    brand: string | null
                    summary: string | null
                    brand_history: string | null
                    specs: Json | null
                    auth_notes: string | null
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    category?: string | null
                    color?: string | null
                    brand?: string | null
                    summary?: string | null
                    brand_history?: string | null
                    specs?: Json | null
                    auth_notes?: string | null
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    category?: string | null
                    color?: string | null
                    brand?: string | null
                    summary?: string | null
                    brand_history?: string | null
                    specs?: Json | null
                    auth_notes?: string | null
                }
                Relationships: []
            }
            annonce: {
                Row: {
                    id: string
                    created_at: string
                    titre: string
                    type: string
                    image: Json | null
                    description: string | null
                    link: string | null
                    start_date: string
                    end_date: string | null
                    archived_at: string | null
                    target_role_ids: string[]
                    target_service_ids: string[]
                    pinned: boolean
                    author_id: string | null
                    excerpt: string | null
                    body_markdown: string | null
                    event_date: string | null
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    titre: string
                    type: string
                    image?: Json | null
                    description?: string | null
                    link?: string | null
                    start_date: string
                    end_date?: string | null
                    archived_at?: string | null
                    target_role_ids?: string[] | null
                    target_service_ids?: string[] | null
                    pinned?: boolean | null
                    author_id?: string | null
                    excerpt?: string | null
                    body_markdown?: string | null
                    event_date?: string | null
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    titre?: string | null
                    type?: string | null
                    image?: Json | null
                    description?: string | null
                    link?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    archived_at?: string | null
                    target_role_ids?: string[] | null
                    target_service_ids?: string[] | null
                    pinned?: boolean | null
                    author_id?: string | null
                    excerpt?: string | null
                    body_markdown?: string | null
                    event_date?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "annonce_author_id_fkey"
                        columns: ["author_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            app_logs: {
                Row: {
                    id: number
                    created_at: string
                    user_id: string
                    level: string | null
                    message: string | null
                    context: Json | null
                    url: string | null
                    stack: string | null
                    session_id: string | null
                    browser: string | null
                    user_email: string | null
                }
                Insert: {
                    id?: number | null
                    created_at?: string | null
                    user_id: string
                    level?: string | null
                    message?: string | null
                    context?: Json | null
                    url?: string | null
                    stack?: string | null
                    session_id?: string | null
                    browser?: string | null
                    user_email?: string | null
                }
                Update: {
                    id?: number | null
                    created_at?: string | null
                    user_id?: string | null
                    level?: string | null
                    message?: string | null
                    context?: Json | null
                    url?: string | null
                    stack?: string | null
                    session_id?: string | null
                    browser?: string | null
                    user_email?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "app_logs_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            app_logs_retention_audit: {
                Row: {
                    id: number
                    executed_at: string
                    table_name: string
                    cutoff_at: string
                    deleted_count: number
                    oldest_deleted_at: string | null
                    newest_deleted_at: string | null
                    mode: string
                    triggered_by: string | null
                }
                Insert: {
                    id?: number | null
                    executed_at?: string | null
                    table_name?: string | null
                    cutoff_at: string
                    deleted_count: number
                    oldest_deleted_at?: string | null
                    newest_deleted_at?: string | null
                    mode?: string | null
                    triggered_by?: string | null
                }
                Update: {
                    id?: number | null
                    executed_at?: string | null
                    table_name?: string | null
                    cutoff_at?: string | null
                    deleted_count?: number | null
                    oldest_deleted_at?: string | null
                    newest_deleted_at?: string | null
                    mode?: string | null
                    triggered_by?: string | null
                }
                Relationships: []
            }
            app_logs_retention_config: {
                Row: {
                    table_name: string
                    date_column: string
                    retention_months: number
                    enabled: boolean
                    extra_filter: string | null
                }
                Insert: {
                    table_name: string
                    date_column: string
                    retention_months?: number | null
                    enabled?: boolean | null
                    extra_filter?: string | null
                }
                Update: {
                    table_name?: string | null
                    date_column?: string | null
                    retention_months?: number | null
                    enabled?: boolean | null
                    extra_filter?: string | null
                }
                Relationships: []
            }
            app_maintenance: {
                Row: {
                    id: string
                    scope: string
                    feature_key: string | null
                    active: boolean
                    starts_at: string
                    ends_at: string | null
                    message: string | null
                    created_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    scope: string
                    feature_key?: string | null
                    active?: boolean | null
                    starts_at: string
                    ends_at?: string | null
                    message?: string | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    scope?: string | null
                    feature_key?: string | null
                    active?: boolean | null
                    starts_at?: string | null
                    ends_at?: string | null
                    message?: string | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "app_maintenance_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            apple_calendar_connections: {
                Row: {
                    id: string
                    user_id: string
                    icloud_email: string
                    icloud_app_password_encrypted: string
                    is_active: boolean
                    last_sync_at: string | null
                    created_at: string
                    updated_at: string
                    auth_failure_count: number
                    last_auth_failure_at: string | null
                }
                Insert: {
                    id?: string | null
                    user_id: string
                    icloud_email: string
                    icloud_app_password_encrypted: string
                    is_active?: boolean | null
                    last_sync_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    auth_failure_count?: number | null
                    last_auth_failure_at?: string | null
                }
                Update: {
                    id?: string | null
                    user_id?: string | null
                    icloud_email?: string | null
                    icloud_app_password_encrypted?: string | null
                    is_active?: boolean | null
                    last_sync_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    auth_failure_count?: number | null
                    last_auth_failure_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "apple_calendar_connections_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            arrivage_manuel: {
                Row: {
                    id: string
                    container_no: string
                    conteneur_no_raw: string | null
                    fournisseur_id: string | null
                    status: string
                    transport_mode: string | null
                    departure_date: string | null
                    port_arrival_date: string | null
                    total_weight_kg: number | null
                    total_qty: number | null
                    docked_at: string | null
                    received_date: string | null
                    notes: string | null
                    invoice_no: string | null
                    invoice_date: string | null
                    created_at: string
                    updated_at: string
                    prev_dechargement_at: string | null
                    status_auto: boolean
                }
                Insert: {
                    id?: string | null
                    container_no: string
                    conteneur_no_raw?: string | null
                    fournisseur_id?: string | null
                    status?: string | null
                    transport_mode?: string | null
                    departure_date?: string | null
                    port_arrival_date?: string | null
                    total_weight_kg?: number | null
                    total_qty?: number | null
                    docked_at?: string | null
                    received_date?: string | null
                    notes?: string | null
                    invoice_no?: string | null
                    invoice_date?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    prev_dechargement_at?: string | null
                    status_auto?: boolean | null
                }
                Update: {
                    id?: string | null
                    container_no?: string | null
                    conteneur_no_raw?: string | null
                    fournisseur_id?: string | null
                    status?: string | null
                    transport_mode?: string | null
                    departure_date?: string | null
                    port_arrival_date?: string | null
                    total_weight_kg?: number | null
                    total_qty?: number | null
                    docked_at?: string | null
                    received_date?: string | null
                    notes?: string | null
                    invoice_no?: string | null
                    invoice_date?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    prev_dechargement_at?: string | null
                    status_auto?: boolean | null
                }
                Relationships: []
            }
            arrivage_state: {
                Row: {
                    container_no: string
                    status: string
                    fournisseur_id: string | null
                    docked_at: string | null
                    received_date: string | null
                    notes: string | null
                    livraison_id: string | null
                    created_at: string
                    updated_at: string
                    kind: string
                }
                Insert: {
                    container_no: string
                    status?: string | null
                    fournisseur_id?: string | null
                    docked_at?: string | null
                    received_date?: string | null
                    notes?: string | null
                    livraison_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    kind?: string | null
                }
                Update: {
                    container_no?: string | null
                    status?: string | null
                    fournisseur_id?: string | null
                    docked_at?: string | null
                    received_date?: string | null
                    notes?: string | null
                    livraison_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    kind?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "arrivage_state_livraison_id_fkey"
                        columns: ["livraison_id"]
                        isOneToOne: false
                        referencedRelation: "deliveries_gestion"
                        referencedColumns: ["id"]
                    },
                ]
            }
            arrivees_departs: {
                Row: {
                    id: number
                    pays: string | null
                    provenance: string | null
                    date_facture: string | null
                    date_depart: string | null
                    date_arrivee_le_havre: string | null
                    mode_raw: string | null
                    conteneur_no_raw: string | null
                    prev_dechargement_jour: string | null
                    prev_dechargement_date: string | null
                    prev_dechargement_heure: string | null
                    poids: number | null
                    quantite: number | null
                    conteneur_no: string | null
                    created_at: string | null
                    updated_at: string | null
                    reference_interne: string | null
                    mode_normalized: string | null
                    prev_dechargement_libre: string | null
                }
                Insert: {
                    id?: number | null
                    pays?: string | null
                    provenance?: string | null
                    date_facture?: string | null
                    date_depart?: string | null
                    date_arrivee_le_havre?: string | null
                    mode_raw?: string | null
                    conteneur_no_raw?: string | null
                    prev_dechargement_jour?: string | null
                    prev_dechargement_date?: string | null
                    prev_dechargement_heure?: string | null
                    poids?: number | null
                    quantite?: number | null
                    conteneur_no?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    reference_interne?: string | null
                    mode_normalized?: string | null
                    prev_dechargement_libre?: string | null
                }
                Update: {
                    id?: number | null
                    pays?: string | null
                    provenance?: string | null
                    date_facture?: string | null
                    date_depart?: string | null
                    date_arrivee_le_havre?: string | null
                    mode_raw?: string | null
                    conteneur_no_raw?: string | null
                    prev_dechargement_jour?: string | null
                    prev_dechargement_date?: string | null
                    prev_dechargement_heure?: string | null
                    poids?: number | null
                    quantite?: number | null
                    conteneur_no?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    reference_interne?: string | null
                    mode_normalized?: string | null
                    prev_dechargement_libre?: string | null
                }
                Relationships: []
            }
            balles: {
                Row: {
                    id: string
                    fournisseur_uid: string | null
                    category: string | null
                    weight: number | null
                    country: string | null
                    comments: string | null
                    treatment_data: string | null
                    unit: string | null
                    owner: string | null
                    assigned_to: string | null
                    piece: number | null
                    receiption_date: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string | null
                    fournisseur_uid?: string | null
                    category?: string | null
                    weight?: number | null
                    country?: string | null
                    comments?: string | null
                    treatment_data?: string | null
                    unit?: string | null
                    owner?: string | null
                    assigned_to?: string | null
                    piece?: number | null
                    receiption_date?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    fournisseur_uid?: string | null
                    category?: string | null
                    weight?: number | null
                    country?: string | null
                    comments?: string | null
                    treatment_data?: string | null
                    unit?: string | null
                    owner?: string | null
                    assigned_to?: string | null
                    piece?: number | null
                    receiption_date?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "balles_assigned_to_fkey"
                        columns: ["assigned_to"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "balles_fournisseur_uid_fkey"
                        columns: ["fournisseur_uid"]
                        isOneToOne: false
                        referencedRelation: "fournisseur"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "balles_owner_fkey"
                        columns: ["owner"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            balles_gestion: {
                Row: {
                    id: string
                    created_at: string
                    created_by: string | null
                    packing: number | null
                    provenance: string | null
                    import_date: string | null
                    fournisseur_id: string | null
                    category_id: string | null
                    status: string | null
                    bin: string
                    updated_at: string | null
                    location: string | null
                    type: string | null
                    is_original: boolean | null
                    parent_balle_id: string | null
                    delivery_id: string | null
                    purchase_price: number | null
                    treatment_cost: number | null
                    raw_name: string | null
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    packing?: number | null
                    provenance?: string | null
                    import_date?: string | null
                    fournisseur_id?: string | null
                    category_id?: string | null
                    status?: string | null
                    bin: string
                    updated_at?: string | null
                    location?: string | null
                    type?: string | null
                    is_original?: boolean | null
                    parent_balle_id?: string | null
                    delivery_id?: string | null
                    purchase_price?: number | null
                    treatment_cost?: number | null
                    raw_name?: string | null
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    created_by?: string | null
                    packing?: number | null
                    provenance?: string | null
                    import_date?: string | null
                    fournisseur_id?: string | null
                    category_id?: string | null
                    status?: string | null
                    bin?: string | null
                    updated_at?: string | null
                    location?: string | null
                    type?: string | null
                    is_original?: boolean | null
                    parent_balle_id?: string | null
                    delivery_id?: string | null
                    purchase_price?: number | null
                    treatment_cost?: number | null
                    raw_name?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "balles_gestion_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories_gestion"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "balles_gestion_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "balles_gestion_delivery_id_fkey"
                        columns: ["delivery_id"]
                        isOneToOne: false
                        referencedRelation: "deliveries_gestion"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "balles_gestion_fournisseur_id_fkey"
                        columns: ["fournisseur_id"]
                        isOneToOne: false
                        referencedRelation: "fournisseur_gestion"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "balles_gestion_parent_balle_id_fkey"
                        columns: ["parent_balle_id"]
                        isOneToOne: false
                        referencedRelation: "balles_gestion"
                        referencedColumns: ["id"]
                    },
                ]
            }
            fournisseurs_handpick: {
                Row: {
                    id: string
                    name: string
                    siege_localisation: string | null
                    tag: string | null
                    notes: string | null
                    is_active: boolean
                    created_at: string
                    updated_at: string
                    created_by: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    siege_localisation?: string | null
                    tag?: string | null
                    notes?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Update: {
                    id?: string
                    name?: string
                    siege_localisation?: string | null
                    tag?: string | null
                    notes?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "fournisseurs_handpick_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            zones_handpick: {
                Row: {
                    id: string
                    parent_id: string | null
                    kind: string
                    code: string
                    label: string | null
                    pos_x: number | null
                    pos_y: number | null
                    width: number | null
                    height: number | null
                    rotation: number
                    color: string | null
                    sort_order: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                    created_by: string | null
                }
                Insert: {
                    id?: string
                    parent_id?: string | null
                    kind: string
                    code: string
                    label?: string | null
                    pos_x?: number | null
                    pos_y?: number | null
                    width?: number | null
                    height?: number | null
                    rotation?: number
                    color?: string | null
                    sort_order?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Update: {
                    id?: string
                    parent_id?: string | null
                    kind?: string
                    code?: string
                    label?: string | null
                    pos_x?: number | null
                    pos_y?: number | null
                    width?: number | null
                    height?: number | null
                    rotation?: number
                    color?: string | null
                    sort_order?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "zones_handpick_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "zones_handpick_parent_id_fkey"
                        columns: ["parent_id"]
                        isOneToOne: false
                        referencedRelation: "zones_handpick"
                        referencedColumns: ["id"]
                    },
                ]
            }
            balles_emplacements_handpick: {
                Row: {
                    id: string
                    balle_id: string
                    event: string
                    emplacement_from_id: string | null
                    emplacement_to_id: string | null
                    from_path: string | null
                    to_path: string | null
                    user_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    balle_id: string
                    event: string
                    emplacement_from_id?: string | null
                    emplacement_to_id?: string | null
                    from_path?: string | null
                    to_path?: string | null
                    user_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    balle_id?: string
                    event?: string
                    emplacement_from_id?: string | null
                    emplacement_to_id?: string | null
                    from_path?: string | null
                    to_path?: string | null
                    user_id?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "balles_emplacements_handpick_balle_id_fkey"
                        columns: ["balle_id"]
                        isOneToOne: false
                        referencedRelation: "balles_handpick"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "balles_emplacements_handpick_emplacement_from_id_fkey"
                        columns: ["emplacement_from_id"]
                        isOneToOne: false
                        referencedRelation: "emplacements_handpick"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "balles_emplacements_handpick_emplacement_to_id_fkey"
                        columns: ["emplacement_to_id"]
                        isOneToOne: false
                        referencedRelation: "emplacements_handpick"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "balles_emplacements_handpick_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            plan_layout_handpick: {
                Row: {
                    id: string
                    layout: Json
                    updated_at: string
                    updated_by: string | null
                }
                Insert: {
                    id?: string
                    layout: Json
                    updated_at?: string
                    updated_by?: string | null
                }
                Update: {
                    id?: string
                    layout?: Json
                    updated_at?: string
                    updated_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "plan_layout_handpick_updated_by_fkey"
                        columns: ["updated_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            magasins: {
                Row: {
                    id: string
                    code: string
                    nom: string
                    adresse: string | null
                    ville: string | null
                    largeur: number
                    profondeur: number
                    notes: string | null
                    is_active: boolean
                    created_at: string
                    updated_at: string
                    created_by: string | null
                    retail_shop_id: string | null
                    retail_published_at: string | null
                }
                Insert: {
                    id?: string
                    code: string
                    nom: string
                    adresse?: string | null
                    ville?: string | null
                    largeur?: number
                    profondeur?: number
                    notes?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                    retail_shop_id?: string | null
                    retail_published_at?: string | null
                }
                Update: {
                    id?: string
                    code?: string
                    nom?: string
                    adresse?: string | null
                    ville?: string | null
                    largeur?: number
                    profondeur?: number
                    notes?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                    retail_shop_id?: string | null
                    retail_published_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "magasins_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            zones_magasin: {
                Row: {
                    forme: Json | null
                    etage_id: string
                    id: string
                    magasin_id: string
                    parent_id: string | null
                    kind: string
                    code: string
                    label: string | null
                    pos_x: number | null
                    pos_y: number | null
                    width: number | null
                    height: number | null
                    rotation: number
                    color: string | null
                    sort_order: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                    created_by: string | null
                }
                Insert: {
                    forme?: Json | null
                    etage_id: string
                    id?: string
                    magasin_id: string
                    parent_id?: string | null
                    kind: string
                    code: string
                    label?: string | null
                    pos_x?: number | null
                    pos_y?: number | null
                    width?: number | null
                    height?: number | null
                    rotation?: number
                    color?: string | null
                    sort_order?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Update: {
                    forme?: Json | null
                    etage_id?: string
                    id?: string
                    magasin_id?: string
                    parent_id?: string | null
                    kind?: string
                    code?: string
                    label?: string | null
                    pos_x?: number | null
                    pos_y?: number | null
                    width?: number | null
                    height?: number | null
                    rotation?: number
                    color?: string | null
                    sort_order?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "zones_magasin_magasin_id_fkey"
                        columns: ["magasin_id"]
                        isOneToOne: false
                        referencedRelation: "magasins"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "zones_magasin_parent_id_fkey"
                        columns: ["parent_id"]
                        isOneToOne: false
                        referencedRelation: "zones_magasin"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "zones_magasin_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            emplacements_magasin: {
                Row: {
                    id: string
                    magasin_id: string
                    zone_id: string
                    code: string
                    label: string | null
                    pos_x: number | null
                    pos_y: number | null
                    width: number | null
                    height: number | null
                    rotation: number
                    notes: string | null
                    is_active: boolean
                    created_at: string
                    updated_at: string
                    created_by: string | null
                }
                Insert: {
                    id?: string
                    magasin_id: string
                    zone_id: string
                    code: string
                    label?: string | null
                    pos_x?: number | null
                    pos_y?: number | null
                    width?: number | null
                    height?: number | null
                    rotation?: number
                    notes?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Update: {
                    id?: string
                    magasin_id?: string
                    zone_id?: string
                    code?: string
                    label?: string | null
                    pos_x?: number | null
                    pos_y?: number | null
                    width?: number | null
                    height?: number | null
                    rotation?: number
                    notes?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "emplacements_magasin_magasin_id_fkey"
                        columns: ["magasin_id"]
                        isOneToOne: false
                        referencedRelation: "magasins"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "emplacements_magasin_zone_id_fkey"
                        columns: ["zone_id"]
                        isOneToOne: false
                        referencedRelation: "zones_magasin"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "emplacements_magasin_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            equipements_magasin: {
                Row: {
                    groupe: string | null
                    descend: boolean
                    zone_id: string | null
                    forme: Json | null
                    etage_id: string
                    id: string
                    magasin_id: string
                    kind: string
                    code: string
                    label: string | null
                    pos_x: number | null
                    pos_y: number | null
                    width: number | null
                    height: number | null
                    rotation: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                    created_by: string | null
                }
                Insert: {
                    groupe?: string | null
                    descend?: boolean
                    zone_id?: string | null
                    forme?: Json | null
                    etage_id: string
                    id?: string
                    magasin_id: string
                    kind: string
                    code: string
                    label?: string | null
                    pos_x?: number | null
                    pos_y?: number | null
                    width?: number | null
                    height?: number | null
                    rotation?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Update: {
                    groupe?: string | null
                    descend?: boolean
                    zone_id?: string | null
                    forme?: Json | null
                    etage_id?: string
                    id?: string
                    magasin_id?: string
                    kind?: string
                    code?: string
                    label?: string | null
                    pos_x?: number | null
                    pos_y?: number | null
                    width?: number | null
                    height?: number | null
                    rotation?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "equipements_magasin_magasin_id_fkey"
                        columns: ["magasin_id"]
                        isOneToOne: false
                        referencedRelation: "magasins"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "equipements_magasin_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            etages_magasin: {
                Row: {
                    id: string
                    magasin_id: string
                    nom: string
                    niveau: number
                    contour: Json | null
                    fond_path: string | null
                    fond_x: number | null
                    fond_y: number | null
                    fond_largeur: number | null
                    fond_profondeur: number | null
                    fond_opacite: number
                    created_at: string
                    updated_at: string
                    created_by: string | null
                }
                Insert: {
                    id?: string
                    magasin_id: string
                    nom: string
                    niveau?: number
                    contour?: Json | null
                    fond_path?: string | null
                    fond_x?: number | null
                    fond_y?: number | null
                    fond_largeur?: number | null
                    fond_profondeur?: number | null
                    fond_opacite?: number
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Update: {
                    id?: string
                    magasin_id?: string
                    nom?: string
                    niveau?: number
                    contour?: Json | null
                    fond_path?: string | null
                    fond_x?: number | null
                    fond_y?: number | null
                    fond_largeur?: number | null
                    fond_profondeur?: number | null
                    fond_opacite?: number
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "etages_magasin_magasin_id_fkey"
                        columns: ["magasin_id"]
                        isOneToOne: false
                        referencedRelation: "magasins"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "etages_magasin_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            murs_magasin: {
                Row: {
                    id: string
                    magasin_id: string
                    etage_id: string
                    points: Json
                    epaisseur: number
                    hauteur: number
                    created_at: string
                    updated_at: string
                    created_by: string | null
                }
                Insert: {
                    id?: string
                    magasin_id: string
                    etage_id: string
                    points: Json
                    epaisseur?: number
                    hauteur?: number
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Update: {
                    id?: string
                    magasin_id?: string
                    etage_id?: string
                    points?: Json
                    epaisseur?: number
                    hauteur?: number
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "murs_magasin_magasin_id_fkey"
                        columns: ["magasin_id"]
                        isOneToOne: false
                        referencedRelation: "magasins"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "murs_magasin_etage_id_fkey"
                        columns: ["etage_id"]
                        isOneToOne: false
                        referencedRelation: "etages_magasin"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "murs_magasin_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            balles_handpick: {
                Row: {
                    id: string
                    packing: number | null
                    packing_mode: string
                    import_date: string | null
                    fournisseur_id: string | null
                    category_id: string | null
                    raw_name: string | null
                    provenance: string | null
                    is_original: boolean
                    parent_balle_id: string | null
                    status: string
                    location: string | null
                    type: string | null
                    emplacement_id: string | null
                    placed_at: string | null
                    purchase_price: number | null
                    treatment_cost: number | null
                    notes: string | null
                    created_at: string
                    updated_at: string
                    created_by: string | null
                    is_eclatee: boolean
                    eclatee_at: string | null
                    eclatee_by: string | null
                    borrowed_by: string | null
                    borrowed_at: string | null
                    fournisseur_label: string | null
                }
                Insert: {
                    id?: string
                    packing?: number | null
                    packing_mode?: string
                    import_date?: string | null
                    fournisseur_id?: string | null
                    category_id?: string | null
                    raw_name?: string | null
                    provenance?: string | null
                    is_original?: boolean
                    parent_balle_id?: string | null
                    status?: string
                    location?: string | null
                    type?: string | null
                    emplacement_id?: string | null
                    placed_at?: string | null
                    purchase_price?: number | null
                    treatment_cost?: number | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                    is_eclatee?: boolean
                    eclatee_at?: string | null
                    eclatee_by?: string | null
                    borrowed_by?: string | null
                    borrowed_at?: string | null
                    fournisseur_label?: string | null
                }
                Update: {
                    id?: string
                    packing?: number | null
                    packing_mode?: string
                    import_date?: string | null
                    fournisseur_id?: string | null
                    category_id?: string | null
                    raw_name?: string | null
                    provenance?: string | null
                    is_original?: boolean
                    parent_balle_id?: string | null
                    status?: string
                    location?: string | null
                    type?: string | null
                    emplacement_id?: string | null
                    placed_at?: string | null
                    purchase_price?: number | null
                    treatment_cost?: number | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                    is_eclatee?: boolean
                    eclatee_at?: string | null
                    eclatee_by?: string | null
                    borrowed_by?: string | null
                    borrowed_at?: string | null
                    fournisseur_label?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "balles_handpick_borrowed_by_fkey"
                        columns: ["borrowed_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "balles_handpick_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories_handpick"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "balles_handpick_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "balles_handpick_eclatee_by_fkey"
                        columns: ["eclatee_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "balles_handpick_emplacement_id_fkey"
                        columns: ["emplacement_id"]
                        isOneToOne: false
                        referencedRelation: "emplacements_handpick"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "balles_handpick_fournisseur_id_fkey"
                        columns: ["fournisseur_id"]
                        isOneToOne: false
                        referencedRelation: "fournisseurs_handpick"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "balles_handpick_parent_balle_id_fkey"
                        columns: ["parent_balle_id"]
                        isOneToOne: false
                        referencedRelation: "balles_handpick"
                        referencedColumns: ["id"]
                    },
                ]
            }
            activity_log_handpick: {
                Row: {
                    id: string
                    created_at: string
                    user_id: string | null
                    entity_type: string
                    entity_id: string | null
                    entity_label: string | null
                    action: string
                    description: string | null
                    changes: Json | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    user_id?: string | null
                    entity_type: string
                    entity_id?: string | null
                    entity_label?: string | null
                    action: string
                    description?: string | null
                    changes?: Json | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    user_id?: string | null
                    entity_type?: string
                    entity_id?: string | null
                    entity_label?: string | null
                    action?: string
                    description?: string | null
                    changes?: Json | null
                }
                Relationships: [
                    {
                        foreignKeyName: "activity_log_handpick_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            emplacements_handpick: {
                Row: {
                    id: string
                    zone_id: string
                    code: string
                    label: string | null
                    pos_x: number | null
                    pos_y: number | null
                    width: number | null
                    height: number | null
                    capacity: number | null
                    is_active: boolean
                    notes: string | null
                    created_at: string
                    updated_at: string
                    created_by: string | null
                }
                Insert: {
                    id?: string
                    zone_id: string
                    code: string
                    label?: string | null
                    pos_x?: number | null
                    pos_y?: number | null
                    width?: number | null
                    height?: number | null
                    capacity?: number | null
                    is_active?: boolean
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Update: {
                    id?: string
                    zone_id?: string
                    code?: string
                    label?: string | null
                    pos_x?: number | null
                    pos_y?: number | null
                    width?: number | null
                    height?: number | null
                    capacity?: number | null
                    is_active?: boolean
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "emplacements_handpick_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "emplacements_handpick_zone_id_fkey"
                        columns: ["zone_id"]
                        isOneToOne: false
                        referencedRelation: "zones_handpick"
                        referencedColumns: ["id"]
                    },
                ]
            }
            categories_handpick: {
                Row: {
                    id: string
                    name: string
                    tag: string | null
                    unit_price: number | null
                    unit_weight: number | null
                    is_active: boolean
                    created_at: string
                    updated_at: string
                    created_by: string | null
                }
                Insert: {
                    id?: string
                    name: string
                    tag?: string | null
                    unit_price?: number | null
                    unit_weight?: number | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Update: {
                    id?: string
                    name?: string
                    tag?: string | null
                    unit_price?: number | null
                    unit_weight?: number | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "categories_handpick_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            flux_handpick: {
                Row: {
                    id: string
                    direction: string
                    status: string
                    fournisseur_id: string | null
                    type: string | null
                    poids_kg: number | null
                    departure_date: string | null
                    prev_dechargement_at: string | null
                    notes: string | null
                    created_at: string
                    updated_at: string
                    created_by: string | null
                }
                Insert: {
                    id?: string
                    direction: string
                    status?: string
                    fournisseur_id?: string | null
                    type?: string | null
                    poids_kg?: number | null
                    departure_date?: string | null
                    prev_dechargement_at?: string | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Update: {
                    id?: string
                    direction?: string
                    status?: string
                    fournisseur_id?: string | null
                    type?: string | null
                    poids_kg?: number | null
                    departure_date?: string | null
                    prev_dechargement_at?: string | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "flux_handpick_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "flux_handpick_fournisseur_id_fkey"
                        columns: ["fournisseur_id"]
                        isOneToOne: false
                        referencedRelation: "fournisseurs_handpick"
                        referencedColumns: ["id"]
                    },
                ]
            }
            fournisseurs_categories_handpick: {
                Row: {
                    fournisseur_id: string
                    category_id: string
                    created_at: string
                    created_by: string | null
                }
                Insert: {
                    fournisseur_id: string
                    category_id: string
                    created_at?: string
                    created_by?: string | null
                }
                Update: {
                    fournisseur_id?: string
                    category_id?: string
                    created_at?: string
                    created_by?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "fournisseurs_categories_handpick_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories_handpick"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "fournisseurs_categories_handpick_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "fournisseurs_categories_handpick_fournisseur_id_fkey"
                        columns: ["fournisseur_id"]
                        isOneToOne: false
                        referencedRelation: "fournisseurs_handpick"
                        referencedColumns: ["id"]
                    },
                ]
            }
            mouvements_handpick: {
                Row: {
                    id: string
                    balle_id: string | null
                    balle_label: string | null
                    category_id: string | null
                    quantity: number
                    quantity_unit: string
                    emplacement_from_id: string | null
                    emplacement_to_id: string | null
                    unit_price: number | null
                    total_value: number | null
                    notes: string | null
                    created_at: string
                    updated_at: string
                    created_by: string | null
                    flux_id: string
                }
                Insert: {
                    id?: string
                    balle_id?: string | null
                    balle_label?: string | null
                    category_id?: string | null
                    quantity?: number
                    quantity_unit?: string
                    emplacement_from_id?: string | null
                    emplacement_to_id?: string | null
                    unit_price?: number | null
                    total_value?: never
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                    flux_id: string
                }
                Update: {
                    id?: string
                    balle_id?: string | null
                    balle_label?: string | null
                    category_id?: string | null
                    quantity?: number
                    quantity_unit?: string
                    emplacement_from_id?: string | null
                    emplacement_to_id?: string | null
                    unit_price?: number | null
                    total_value?: never
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                    created_by?: string | null
                    flux_id?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "mouvements_handpick_balle_id_fkey"
                        columns: ["balle_id"]
                        isOneToOne: false
                        referencedRelation: "balles_handpick"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "mouvements_handpick_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories_handpick"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "mouvements_handpick_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "mouvements_handpick_emplacement_from_id_fkey"
                        columns: ["emplacement_from_id"]
                        isOneToOne: false
                        referencedRelation: "emplacements_handpick"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "mouvements_handpick_emplacement_to_id_fkey"
                        columns: ["emplacement_to_id"]
                        isOneToOne: false
                        referencedRelation: "emplacements_handpick"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "mouvements_handpick_flux_fk"
                        columns: ["flux_id"]
                        isOneToOne: false
                        referencedRelation: "flux_handpick"
                        referencedColumns: ["id"]
                    },
                ]
            }
            bibliotheque_brief: {
                Row: {
                    id: number
                    brief: string
                    brief_en: string
                    updated_at: string
                    chiffres: string
                    chiffres_en: string
                }
                Insert: {
                    id?: number | null
                    brief?: string | null
                    brief_en?: string | null
                    updated_at?: string | null
                    chiffres?: string | null
                    chiffres_en?: string | null
                }
                Update: {
                    id?: number | null
                    brief?: string | null
                    brief_en?: string | null
                    updated_at?: string | null
                    chiffres?: string | null
                    chiffres_en?: string | null
                }
                Relationships: []
            }
            bibliotheque_format_reponses: {
                Row: {
                    id: string
                    quest_rep_id: string
                    email: string
                    instagram: string
                    whatsapp: string
                    created_at: string
                    updated_at: string
                    email_en: string
                    instagram_en: string
                    whatsapp_en: string
                }
                Insert: {
                    id?: string | null
                    quest_rep_id: string
                    email?: string | null
                    instagram?: string | null
                    whatsapp?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    email_en?: string | null
                    instagram_en?: string | null
                    whatsapp_en?: string | null
                }
                Update: {
                    id?: string | null
                    quest_rep_id?: string | null
                    email?: string | null
                    instagram?: string | null
                    whatsapp?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    email_en?: string | null
                    instagram_en?: string | null
                    whatsapp_en?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "bibliotheque_format_reponses_quest_rep_id_fkey"
                        columns: ["quest_rep_id"]
                        isOneToOne: true
                        referencedRelation: "bibliotheque_questions_reponses"
                        referencedColumns: ["id"]
                    },
                ]
            }
            bibliotheque_questions_reponses: {
                Row: {
                    id: string
                    thematique_id: string
                    question: string
                    question_en: string
                    brief_qr: string
                    brief_qr_en: string
                    position: number
                    created_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    thematique_id: string
                    question: string
                    question_en?: string | null
                    brief_qr: string
                    brief_qr_en?: string | null
                    position?: number | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    thematique_id?: string | null
                    question?: string | null
                    question_en?: string | null
                    brief_qr?: string | null
                    brief_qr_en?: string | null
                    position?: number | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "bibliotheque_questions_reponses_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "bibliotheque_questions_reponses_thematique_id_fkey"
                        columns: ["thematique_id"]
                        isOneToOne: false
                        referencedRelation: "bibliotheque_thematiques"
                        referencedColumns: ["id"]
                    },
                ]
            }
            bibliotheque_thematiques: {
                Row: {
                    id: string
                    label: string
                    label_en: string
                    position: number
                    created_by: string | null
                    created_at: string
                    updated_at: string
                    image_url: string
                    icon_url: string
                }
                Insert: {
                    id?: string | null
                    label: string
                    label_en?: string | null
                    position?: number | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    image_url?: string | null
                    icon_url?: string | null
                }
                Update: {
                    id?: string | null
                    label?: string | null
                    label_en?: string | null
                    position?: number | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    image_url?: string | null
                    icon_url?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "bibliotheque_thematiques_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            "brief.crm": {
                Row: {
                    id: number
                    customer: string
                    activite: string | null
                    canal_vente: string | null
                    surface: number | null
                    villle: string | null
                    pays: string | null
                    vintage: boolean | null
                    depuis: number | null
                    budget: number | null
                    source: string | null
                    format: string | null
                    hiver_vent: string | null
                    ete_vent: string | null
                    hiver_search: string | null
                    ete_search: string | null
                    style_homme: string | null
                    style_femme: string | null
                    note: string | null
                }
                Insert: {
                    id?: number | null
                    customer: string
                    activite?: string | null
                    canal_vente?: string | null
                    surface?: number | null
                    villle?: string | null
                    pays?: string | null
                    vintage?: boolean | null
                    depuis?: number | null
                    budget?: number | null
                    source?: string | null
                    format?: string | null
                    hiver_vent?: string | null
                    ete_vent?: string | null
                    hiver_search?: string | null
                    ete_search?: string | null
                    style_homme?: string | null
                    style_femme?: string | null
                    note?: string | null
                }
                Update: {
                    id?: number | null
                    customer?: string | null
                    activite?: string | null
                    canal_vente?: string | null
                    surface?: number | null
                    villle?: string | null
                    pays?: string | null
                    vintage?: boolean | null
                    depuis?: number | null
                    budget?: number | null
                    source?: string | null
                    format?: string | null
                    hiver_vent?: string | null
                    ete_vent?: string | null
                    hiver_search?: string | null
                    ete_search?: string | null
                    style_homme?: string | null
                    style_femme?: string | null
                    note?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "brief.crm_customer_fkey"
                        columns: ["customer"]
                        isOneToOne: false
                        referencedRelation: "client_crm"
                        referencedColumns: ["id"]
                    },
                ]
            }
            brief_cat: {
                Row: {
                    id: number
                    type: string
                    categorie: string | null
                    available: boolean | null
                }
                Insert: {
                    id?: number | null
                    type: string
                    categorie?: string | null
                    available?: boolean | null
                }
                Update: {
                    id?: number | null
                    type?: string | null
                    categorie?: string | null
                    available?: boolean | null
                }
                Relationships: []
            }
            calendar_sync_mappings: {
                Row: {
                    id: string
                    nokk_project_event_id: string
                    outlook_event_id: string | null
                    outlook_change_key: string | null
                    outlook_updated_at: string | null
                    connection_id: string | null
                    apple_event_uid: string | null
                    apple_last_modified: string | null
                    apple_connection_id: string | null
                    created_at: string
                    updated_at: string
                    apple_event_path: string | null
                    local_last_modified: string | null
                }
                Insert: {
                    id?: string | null
                    nokk_project_event_id: string
                    outlook_event_id?: string | null
                    outlook_change_key?: string | null
                    outlook_updated_at?: string | null
                    connection_id?: string | null
                    apple_event_uid?: string | null
                    apple_last_modified?: string | null
                    apple_connection_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    apple_event_path?: string | null
                    local_last_modified?: string | null
                }
                Update: {
                    id?: string | null
                    nokk_project_event_id?: string | null
                    outlook_event_id?: string | null
                    outlook_change_key?: string | null
                    outlook_updated_at?: string | null
                    connection_id?: string | null
                    apple_event_uid?: string | null
                    apple_last_modified?: string | null
                    apple_connection_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    apple_event_path?: string | null
                    local_last_modified?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "calendar_sync_mappings_apple_connection_id_fkey"
                        columns: ["apple_connection_id"]
                        isOneToOne: false
                        referencedRelation: "apple_calendar_connections"
                        referencedColumns: ["id"]
                    },
                ]
            }
            categories_gestion: {
                Row: {
                    id: string
                    name: string | null
                    created_at: string
                    tag: string | null
                    unit_price: number | null
                    unit_weight: number | null
                }
                Insert: {
                    id?: string | null
                    name?: string | null
                    created_at?: string | null
                    tag?: string | null
                    unit_price?: number | null
                    unit_weight?: number | null
                }
                Update: {
                    id?: string | null
                    name?: string | null
                    created_at?: string | null
                    tag?: string | null
                    unit_price?: number | null
                    unit_weight?: number | null
                }
                Relationships: []
            }
            category_price_history: {
                Row: {
                    id: string
                    created_at: string
                    category_id: string | null
                    category_name: string | null
                    user_id: string | null
                    old_price: number | null
                    new_price: number
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    category_id?: string | null
                    category_name?: string | null
                    user_id?: string | null
                    old_price?: number | null
                    new_price: number
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    category_id?: string | null
                    category_name?: string | null
                    user_id?: string | null
                    old_price?: number | null
                    new_price?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "category_price_history_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories_gestion"
                        referencedColumns: ["id"]
                    },
                ]
            }
            changelog_categories: {
                Row: {
                    id: string
                    name: string
                    color: string
                    icon: string | null
                    position: number
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    name: string
                    color?: string | null
                    icon?: string | null
                    position?: number | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    name?: string | null
                    color?: string | null
                    icon?: string | null
                    position?: number | null
                    created_at?: string | null
                }
                Relationships: []
            }
            changelog_items: {
                Row: {
                    id: string
                    version_id: string
                    category_id: string
                    title: string
                    description: string | null
                    position: number
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    version_id: string
                    category_id: string
                    title: string
                    description?: string | null
                    position?: number | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    version_id?: string | null
                    category_id?: string | null
                    title?: string | null
                    description?: string | null
                    position?: number | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "changelog_items_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "changelog_categories"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "changelog_items_version_id_fkey"
                        columns: ["version_id"]
                        isOneToOne: false
                        referencedRelation: "changelog_versions"
                        referencedColumns: ["id"]
                    },
                ]
            }
            changelog_versions: {
                Row: {
                    id: string
                    version: string
                    deployment_date: string | null
                    status: Database["public"]["Enums"]["changelog_version_status"]
                    summary: string | null
                    created_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    version: string
                    deployment_date?: string | null
                    status?:
                        | Database["public"]["Enums"]["changelog_version_status"]
                        | null
                    summary?: string | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    version?: string | null
                    deployment_date?: string | null
                    status?:
                        | Database["public"]["Enums"]["changelog_version_status"]
                        | null
                    summary?: string | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "changelog_versions_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            client_amelia_submissions: {
                Row: {
                    id: string
                    client_id: string
                    event_id: string | null
                    submitted_at: string
                    full_name: string | null
                    societe: string | null
                    telephone: string | null
                    mail: string | null
                    brief: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    client_id: string
                    event_id?: string | null
                    submitted_at?: string | null
                    full_name?: string | null
                    societe?: string | null
                    telephone?: string | null
                    mail?: string | null
                    brief?: Json | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    client_id?: string | null
                    event_id?: string | null
                    submitted_at?: string | null
                    full_name?: string | null
                    societe?: string | null
                    telephone?: string | null
                    mail?: string | null
                    brief?: Json | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "client_amelia_submissions_client_id_fkey"
                        columns: ["client_id"]
                        isOneToOne: false
                        referencedRelation: "client_crm"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "client_amelia_submissions_event_id_fkey"
                        columns: ["event_id"]
                        isOneToOne: false
                        referencedRelation: "Event_calendar"
                        referencedColumns: ["id"]
                    },
                ]
            }
            client_crm: {
                Row: {
                    id: string
                    customer: string | null
                    nom: string | null
                    societe: string | null
                    mail: string | null
                    telephone: string | null
                    localisation: string | null
                    commandes: string | null
                    depense: number | null
                    siret: string | null
                    collum: number | null
                    brief: Json | null
                    insta: string | null
                    updated_at: string | null
                    message: string | null
                    prise_en_charge: string | null
                    created_at: string | null
                    closers: string | null
                    adresse_facturation: string | null
                    adresse_livraison: Json | null
                    numero_TVA: string | null
                    mail_2: string | null
                    telephone_2: string | null
                    urgency: string | null
                }
                Insert: {
                    id?: string | null
                    customer?: string | null
                    nom?: string | null
                    societe?: string | null
                    mail?: string | null
                    telephone?: string | null
                    localisation?: string | null
                    commandes?: string | null
                    depense?: number | null
                    siret?: string | null
                    collum?: number | null
                    brief?: Json | null
                    insta?: string | null
                    updated_at?: string | null
                    message?: string | null
                    prise_en_charge?: string | null
                    created_at?: string | null
                    closers?: string | null
                    adresse_facturation?: string | null
                    adresse_livraison?: Json | null
                    numero_TVA?: string | null
                    mail_2?: string | null
                    telephone_2?: string | null
                    urgency?: string | null
                }
                Update: {
                    id?: string | null
                    customer?: string | null
                    nom?: string | null
                    societe?: string | null
                    mail?: string | null
                    telephone?: string | null
                    localisation?: string | null
                    commandes?: string | null
                    depense?: number | null
                    siret?: string | null
                    collum?: number | null
                    brief?: Json | null
                    insta?: string | null
                    updated_at?: string | null
                    message?: string | null
                    prise_en_charge?: string | null
                    created_at?: string | null
                    closers?: string | null
                    adresse_facturation?: string | null
                    adresse_livraison?: Json | null
                    numero_TVA?: string | null
                    mail_2?: string | null
                    telephone_2?: string | null
                    urgency?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "client_crm_closers_fkey"
                        columns: ["closers"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "client_crm_customer_fkey"
                        columns: ["customer"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            content_generation: {
                Row: {
                    id: string
                    user_id: string | null
                    image_url: string | null
                    status: string | null
                    video_url: string | null
                    created_at: string | null
                    analyze: string | null
                }
                Insert: {
                    id?: string | null
                    user_id?: string | null
                    image_url?: string | null
                    status?: string | null
                    video_url?: string | null
                    created_at?: string | null
                    analyze?: string | null
                }
                Update: {
                    id?: string | null
                    user_id?: string | null
                    image_url?: string | null
                    status?: string | null
                    video_url?: string | null
                    created_at?: string | null
                    analyze?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "content_generation_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            created_chat: {
                Row: {
                    id_chat: string
                    created_by: string
                    with_id: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id_chat?: string | null
                    created_by: string
                    with_id: string
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id_chat?: string | null
                    created_by?: string | null
                    with_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "created_chat_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "created_chat_with_id_fkey"
                        columns: ["with_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            crm_produit_recherche_monthly_stats: {
                Row: {
                    id: number
                    snapshot_month: string
                    product_name: string
                    total_entries: number
                    created_at: string
                }
                Insert: {
                    id?: number | null
                    snapshot_month: string
                    product_name: string
                    total_entries: number
                    created_at?: string | null
                }
                Update: {
                    id?: number | null
                    snapshot_month?: string | null
                    product_name?: string | null
                    total_entries?: number | null
                    created_at?: string | null
                }
                Relationships: []
            }
            cryptedmessage: {
                Row: {
                    id: number
                    chat_id: string
                    sender_id: string
                    recipient_id: string | null
                    ciphertext_b64: string | null
                    iv_b64: string | null
                    content_encrypted: string | null
                    meta: Json | null
                    created_at: string
                    read: boolean | null
                    deleted_at: string | null
                    reply_to_id: number | null
                }
                Insert: {
                    id?: number | null
                    chat_id: string
                    sender_id: string
                    recipient_id?: string | null
                    ciphertext_b64?: string | null
                    iv_b64?: string | null
                    content_encrypted?: string | null
                    meta?: Json | null
                    created_at?: string | null
                    read?: boolean | null
                    deleted_at?: string | null
                    reply_to_id?: number | null
                }
                Update: {
                    id?: number | null
                    chat_id?: string | null
                    sender_id?: string | null
                    recipient_id?: string | null
                    ciphertext_b64?: string | null
                    iv_b64?: string | null
                    content_encrypted?: string | null
                    meta?: Json | null
                    created_at?: string | null
                    read?: boolean | null
                    deleted_at?: string | null
                    reply_to_id?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "cryptedmessage_recipient_id_fkey"
                        columns: ["recipient_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "cryptedmessage_reply_to_id_fkey"
                        columns: ["reply_to_id"]
                        isOneToOne: false
                        referencedRelation: "cryptedmessage"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "cryptedmessage_sender_id_fkey"
                        columns: ["sender_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            cryptedmessage_autopassphrase: {
                Row: {
                    user_id: string
                    passphrase: string
                    updated_at: string
                }
                Insert: {
                    user_id: string
                    passphrase: string
                    updated_at?: string | null
                }
                Update: {
                    user_id?: string | null
                    passphrase?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "cryptedmessage_autopassphrase_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            cryptedmessage_group_members: {
                Row: {
                    group_id: string
                    user_id: string
                    role: string
                    joined_at: string | null
                    last_read_at: string | null
                }
                Insert: {
                    group_id: string
                    user_id: string
                    role?: string | null
                    joined_at?: string | null
                    last_read_at?: string | null
                }
                Update: {
                    group_id?: string | null
                    user_id?: string | null
                    role?: string | null
                    joined_at?: string | null
                    last_read_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "cryptedmessage_group_members_group_id_fkey"
                        columns: ["group_id"]
                        isOneToOne: false
                        referencedRelation: "cryptedmessage_groups"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "cryptedmessage_group_members_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            cryptedmessage_groups: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    avatar_url: string | null
                    created_by: string
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string | null
                    name: string
                    description?: string | null
                    avatar_url?: string | null
                    created_by: string
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    name?: string | null
                    description?: string | null
                    avatar_url?: string | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "cryptedmessage_groups_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            cryptedmessage_keybundles: {
                Row: {
                    user_id: string
                    bundle: Json
                    updated_at: string
                }
                Insert: {
                    user_id: string
                    bundle?: Json | null
                    updated_at?: string | null
                }
                Update: {
                    user_id?: string | null
                    bundle?: Json | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "cryptedmessage_keybundles_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            cryptedmessage_shared_exportkeys: {
                Row: {
                    user_id: string
                    encrypted_export_key: Json
                    updated_at: string
                }
                Insert: {
                    user_id: string
                    encrypted_export_key: Json
                    updated_at?: string | null
                }
                Update: {
                    user_id?: string | null
                    encrypted_export_key?: Json | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "cryptedmessage_shared_exportkeys_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            cryptedmessage_userkeys: {
                Row: {
                    user_id: string
                    pubkey: Json
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    user_id: string
                    pubkey?: Json | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    user_id?: string | null
                    pubkey?: Json | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "cryptedmessage_userkeys_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            dashboard_layout_templates: {
                Row: {
                    id: string
                    role_id: string | null
                    service_id: string | null
                    layout: Json
                    updated_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    role_id?: string | null
                    service_id?: string | null
                    layout: Json
                    updated_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    role_id?: string | null
                    service_id?: string | null
                    layout?: Json | null
                    updated_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "dashboard_layout_templates_role_id_fkey"
                        columns: ["role_id"]
                        isOneToOne: true
                        referencedRelation: "roles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "dashboard_layout_templates_service_id_fkey"
                        columns: ["service_id"]
                        isOneToOne: true
                        referencedRelation: "services"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "dashboard_layout_templates_updated_by_fkey"
                        columns: ["updated_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            deliveries_gestion: {
                Row: {
                    id: string
                    din: string
                    fournisseur_id: string | null
                    delivery_date: string | null
                    delivery_type: string | null
                    balles_count: number | null
                    poids_moyen: number | null
                    packing: string | null
                    created_by: string | null
                    created_at: string
                    updated_at: string | null
                }
                Insert: {
                    id?: string | null
                    din: string
                    fournisseur_id?: string | null
                    delivery_date?: string | null
                    delivery_type?: string | null
                    balles_count?: number | null
                    poids_moyen?: number | null
                    packing?: string | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    din?: string | null
                    fournisseur_id?: string | null
                    delivery_date?: string | null
                    delivery_type?: string | null
                    balles_count?: number | null
                    poids_moyen?: number | null
                    packing?: string | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "deliveries_gestion_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "deliveries_gestion_fournisseur_id_fkey"
                        columns: ["fournisseur_id"]
                        isOneToOne: false
                        referencedRelation: "fournisseur_gestion"
                        referencedColumns: ["id"]
                    },
                ]
            }
            description_corrections: {
                Row: {
                    id: number
                    description_origine: string
                    description_corrigee: string
                    origine_key: string | null
                    created_at: string | null
                }
                Insert: {
                    id?: number | null
                    description_origine: string
                    description_corrigee: string
                    origine_key?: never
                    created_at?: string | null
                }
                Update: {
                    id?: number | null
                    description_origine?: string | null
                    description_corrigee?: string | null
                    origine_key?: never
                    created_at?: string | null
                }
                Relationships: []
            }
            direct_conversations: {
                Row: {
                    id: string
                    user_a: string
                    user_b: string
                    user_low: string | null
                    user_high: string | null
                    matrix_room_id: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    user_a: string
                    user_b: string
                    user_low?: never
                    user_high?: never
                    matrix_room_id: string
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    user_a?: string | null
                    user_b?: string | null
                    user_low?: never
                    user_high?: never
                    matrix_room_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "direct_conversations_user_a_fkey"
                        columns: ["user_a"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "direct_conversations_user_b_fkey"
                        columns: ["user_b"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            factures: {
                Row: {
                    id: number
                    date: string | null
                    invoice_no: string | null
                    container_no: string | null
                    location: string | null
                    invoice_total: number | null
                    shipping_charges: number | null
                    total_invoice_value: number | null
                    total_invoice_usd: number | null
                    convert_rate_thb_usd: number | null
                    created_at: string | null
                }
                Insert: {
                    id?: number | null
                    date?: string | null
                    invoice_no?: string | null
                    container_no?: string | null
                    location?: string | null
                    invoice_total?: number | null
                    shipping_charges?: number | null
                    total_invoice_value?: number | null
                    total_invoice_usd?: number | null
                    convert_rate_thb_usd?: number | null
                    created_at?: string | null
                }
                Update: {
                    id?: number | null
                    date?: string | null
                    invoice_no?: string | null
                    container_no?: string | null
                    location?: string | null
                    invoice_total?: number | null
                    shipping_charges?: number | null
                    total_invoice_value?: number | null
                    total_invoice_usd?: number | null
                    convert_rate_thb_usd?: number | null
                    created_at?: string | null
                }
                Relationships: []
            }
            fournisseur: {
                Row: {
                    id: string
                    id_livraison: string | null
                    name: string | null
                    quality: number | null
                }
                Insert: {
                    id?: string | null
                    id_livraison?: string | null
                    name?: string | null
                    quality?: number | null
                }
                Update: {
                    id?: string | null
                    id_livraison?: string | null
                    name?: string | null
                    quality?: number | null
                }
                Relationships: []
            }
            fournisseur_gestion: {
                Row: {
                    id: string
                    name: string | null
                    siege_localisation: string | null
                    created_at: string
                    tag: string | null
                }
                Insert: {
                    id?: string | null
                    name?: string | null
                    siege_localisation?: string | null
                    created_at?: string | null
                    tag?: string | null
                }
                Update: {
                    id?: string | null
                    name?: string | null
                    siege_localisation?: string | null
                    created_at?: string | null
                    tag?: string | null
                }
                Relationships: []
            }
            gallery_permissions: {
                Row: {
                    picture_id: string
                    user_id: string
                    can_view: boolean | null
                    created_at: string
                }
                Insert: {
                    picture_id: string
                    user_id: string
                    can_view?: boolean | null
                    created_at?: string | null
                }
                Update: {
                    picture_id?: string | null
                    user_id?: string | null
                    can_view?: boolean | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "gallery_permissions_picture_id_fkey"
                        columns: ["picture_id"]
                        isOneToOne: true
                        referencedRelation: "gallery_pictures"
                        referencedColumns: ["id"]
                    },
                ]
            }
            gallery_pictures: {
                Row: {
                    id: string
                    owner_id: string
                    filename: string | null
                    url: string | null
                    title: string
                    created_at: string
                    mime_type: string
                    size_bytes: number
                    is_folder: boolean
                    parent_id: string | null
                    deleted_at: string | null
                }
                Insert: {
                    id?: string | null
                    owner_id: string
                    filename?: string | null
                    url?: string | null
                    title: string
                    created_at?: string | null
                    mime_type?: string | null
                    size_bytes?: number | null
                    is_folder?: boolean | null
                    parent_id?: string | null
                    deleted_at?: string | null
                }
                Update: {
                    id?: string | null
                    owner_id?: string | null
                    filename?: string | null
                    url?: string | null
                    title?: string | null
                    created_at?: string | null
                    mime_type?: string | null
                    size_bytes?: number | null
                    is_folder?: boolean | null
                    parent_id?: string | null
                    deleted_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "gallery_pictures_parent_id_fkey"
                        columns: ["parent_id"]
                        isOneToOne: false
                        referencedRelation: "gallery_pictures"
                        referencedColumns: ["id"]
                    },
                ]
            }
            gestion_arrivage_packing: {
                Row: {
                    id: string
                    arrivage_id: string
                    reference: string
                    description: string
                    quantity: number
                    weight_kg: number | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    arrivage_id: string
                    reference: string
                    description: string
                    quantity?: number | null
                    weight_kg?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    arrivage_id?: string | null
                    reference?: string | null
                    description?: string | null
                    quantity?: number | null
                    weight_kg?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "gestion_arrivage_packing_arrivage_id_fkey"
                        columns: ["arrivage_id"]
                        isOneToOne: false
                        referencedRelation: "gestion_arrivage_row"
                        referencedColumns: ["id"]
                    },
                ]
            }
            gestion_arrivage_row: {
                Row: {
                    id: string
                    din: string
                    fournisseur_id: string
                    category_id: string | null
                    delivery_type: Database["public"]["Enums"]["arrivage_type"]
                    status: Database["public"]["Enums"]["arrivage_status"]
                    expected_date: string
                    received_date: string | null
                    balles_count: number
                    palettes_count: number
                    livraison_id: string | null
                    notes: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    din: string
                    fournisseur_id: string
                    category_id?: string | null
                    delivery_type?:
                        | Database["public"]["Enums"]["arrivage_type"]
                        | null
                    status?:
                        | Database["public"]["Enums"]["arrivage_status"]
                        | null
                    expected_date: string
                    received_date?: string | null
                    balles_count?: number | null
                    palettes_count?: number | null
                    livraison_id?: string | null
                    notes?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    din?: string | null
                    fournisseur_id?: string | null
                    category_id?: string | null
                    delivery_type?:
                        | Database["public"]["Enums"]["arrivage_type"]
                        | null
                    status?:
                        | Database["public"]["Enums"]["arrivage_status"]
                        | null
                    expected_date?: string | null
                    received_date?: string | null
                    balles_count?: number | null
                    palettes_count?: number | null
                    livraison_id?: string | null
                    notes?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "gestion_arrivage_row_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "categories_gestion"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "gestion_arrivage_row_fournisseur_id_fkey"
                        columns: ["fournisseur_id"]
                        isOneToOne: false
                        referencedRelation: "fournisseur_gestion"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "gestion_arrivage_row_livraison_id_fkey"
                        columns: ["livraison_id"]
                        isOneToOne: false
                        referencedRelation: "deliveries_gestion"
                        referencedColumns: ["id"]
                    },
                ]
            }
            group_read_receipts: {
                Row: {
                    id: string
                    group_id: string
                    user_id: string
                    last_read_at: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    group_id: string
                    user_id: string
                    last_read_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    group_id?: string | null
                    user_id?: string | null
                    last_read_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "group_read_receipts_group_id_fkey"
                        columns: ["group_id"]
                        isOneToOne: true
                        referencedRelation: "groups"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "group_read_receipts_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            groupe_participant: {
                Row: {
                    id: number
                    group_id: string
                    participant: string | null
                }
                Insert: {
                    id?: number | null
                    group_id?: string | null
                    participant?: string | null
                }
                Update: {
                    id?: number | null
                    group_id?: string | null
                    participant?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "groupe_participant_group_id_fkey"
                        columns: ["group_id"]
                        isOneToOne: false
                        referencedRelation: "groups"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "groupe_participant_participant_fkey"
                        columns: ["participant"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            groups: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    created_by: string
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    name: string
                    description?: string | null
                    created_by: string
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    name?: string | null
                    description?: string | null
                    created_by?: string | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "groups_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            items: {
                Row: {
                    id: number
                    facture_id: number
                    item_no: number | null
                    description: string | null
                    unite: string | null
                }
                Insert: {
                    id?: number | null
                    facture_id: number
                    item_no?: number | null
                    description?: string | null
                    unite?: string | null
                }
                Update: {
                    id?: number | null
                    facture_id?: number | null
                    item_no?: number | null
                    description?: string | null
                    unite?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "items_facture_id_fkey"
                        columns: ["facture_id"]
                        isOneToOne: false
                        referencedRelation: "factures"
                        referencedColumns: ["id"]
                    },
                ]
            }
            journal_entry: {
                Row: {
                    id: string
                    sell_at: string
                    service: string | null
                    commercial: string
                    sales: string
                    created_by: string
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    sell_at: string
                    service?: string | null
                    commercial: string
                    sales?: string | null
                    created_by: string
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    sell_at?: string | null
                    service?: string | null
                    commercial?: string | null
                    sales?: string | null
                    created_by?: string | null
                    created_at?: string | null
                }
                Relationships: []
            }
            kpis: {
                Row: {
                    id: string
                    name: string
                    value: number
                    previous_value: number
                    change_percentage: number
                    period: string
                    category: string
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    name: string
                    value: number
                    previous_value?: number | null
                    change_percentage?: number | null
                    period: string
                    category: string
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    name?: string | null
                    value?: number | null
                    previous_value?: number | null
                    change_percentage?: number | null
                    period?: string | null
                    category?: string | null
                    created_at?: string | null
                }
                Relationships: []
            }
            leads: {
                Row: {
                    id: number
                    name: string
                    email: string
                    phone: string
                    message: string
                    location: string | null
                    activity: string
                    experience: string | null
                    arrivance: string | null
                    created_at: string
                    budget: string | null
                    distance_km: number
                    city_found: string
                    urgency: string | null
                }
                Insert: {
                    id?: number | null
                    name: string
                    email: string
                    phone: string
                    message: string
                    location?: string | null
                    activity: string
                    experience?: string | null
                    arrivance?: string | null
                    created_at?: string | null
                    budget?: string | null
                    distance_km?: number | null
                    city_found?: string | null
                    urgency?: string | null
                }
                Update: {
                    id?: number | null
                    name?: string | null
                    email?: string | null
                    phone?: string | null
                    message?: string | null
                    location?: string | null
                    activity?: string | null
                    experience?: string | null
                    arrivance?: string | null
                    created_at?: string | null
                    budget?: string | null
                    distance_km?: number | null
                    city_found?: string | null
                    urgency?: string | null
                }
                Relationships: []
            }
            logs_crm: {
                Row: {
                    id: number
                    change_at: string
                    changed_by: string | null
                    row_id: string | null
                    table_name: string | null
                    operation: string | null
                    old_data: string | null
                    new_data: string | null
                }
                Insert: {
                    id?: number | null
                    change_at?: string | null
                    changed_by?: string | null
                    row_id?: string | null
                    table_name?: string | null
                    operation?: string | null
                    old_data?: string | null
                    new_data?: string | null
                }
                Update: {
                    id?: number | null
                    change_at?: string | null
                    changed_by?: string | null
                    row_id?: string | null
                    table_name?: string | null
                    operation?: string | null
                    old_data?: string | null
                    new_data?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "logs_crm_changed_by_fkey"
                        columns: ["changed_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            matches: {
                Row: {
                    id: string
                    tournament_id: string | null
                    player1_id: string | null
                    player2_id: string | null
                    player1_score: number | null
                    player2_score: number | null
                    winner_id: string | null
                    status: string
                    played_at: string | null
                    created_at: string
                    updated_at: string
                    elo_applied: boolean
                    round_number: number
                    match_index: number
                    player1_source_match_id: string | null
                    player2_source_match_id: string | null
                    score_details: Json | null
                }
                Insert: {
                    id?: string | null
                    tournament_id?: string | null
                    player1_id?: string | null
                    player2_id?: string | null
                    player1_score?: number | null
                    player2_score?: number | null
                    winner_id?: string | null
                    status?: string | null
                    played_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    elo_applied?: boolean | null
                    round_number?: number | null
                    match_index?: number | null
                    player1_source_match_id?: string | null
                    player2_source_match_id?: string | null
                    score_details?: Json | null
                }
                Update: {
                    id?: string | null
                    tournament_id?: string | null
                    player1_id?: string | null
                    player2_id?: string | null
                    player1_score?: number | null
                    player2_score?: number | null
                    winner_id?: string | null
                    status?: string | null
                    played_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    elo_applied?: boolean | null
                    round_number?: number | null
                    match_index?: number | null
                    player1_source_match_id?: string | null
                    player2_source_match_id?: string | null
                    score_details?: Json | null
                }
                Relationships: [
                    {
                        foreignKeyName: "matches_player1_source_match_id_fkey"
                        columns: ["player1_source_match_id"]
                        isOneToOne: false
                        referencedRelation: "matches"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "matches_player2_source_match_id_fkey"
                        columns: ["player2_source_match_id"]
                        isOneToOne: false
                        referencedRelation: "matches"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "matches_tournament_id_fkey"
                        columns: ["tournament_id"]
                        isOneToOne: false
                        referencedRelation: "tournaments"
                        referencedColumns: ["id"]
                    },
                ]
            }
            messages: {
                Row: {
                    id: number
                    sender_id: string
                    recipient_id: string | null
                    group_id: string | null
                    ciphertext_b64: string | null
                    encrypted_key_b64: string | null
                    iv_b64: string | null
                    meta: Json | null
                    created_at: string
                    files: string | null
                    read: boolean | null
                    chat_id: string | null
                    content: string | null
                    groupe_id: string | null
                    content_encrypted: string | null
                }
                Insert: {
                    id?: number | null
                    sender_id: string
                    recipient_id?: string | null
                    group_id?: string | null
                    ciphertext_b64?: string | null
                    encrypted_key_b64?: string | null
                    iv_b64?: string | null
                    meta?: Json | null
                    created_at?: string | null
                    files?: string | null
                    read?: boolean | null
                    chat_id?: string | null
                    content?: string | null
                    groupe_id?: string | null
                    content_encrypted?: string | null
                }
                Update: {
                    id?: number | null
                    sender_id?: string | null
                    recipient_id?: string | null
                    group_id?: string | null
                    ciphertext_b64?: string | null
                    encrypted_key_b64?: string | null
                    iv_b64?: string | null
                    meta?: Json | null
                    created_at?: string | null
                    files?: string | null
                    read?: boolean | null
                    chat_id?: string | null
                    content?: string | null
                    groupe_id?: string | null
                    content_encrypted?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "fk_messages_chat"
                        columns: ["chat_id"]
                        isOneToOne: false
                        referencedRelation: "created_chat"
                        referencedColumns: ["id_chat"]
                    },
                    {
                        foreignKeyName: "messages_group_id_fkey"
                        columns: ["group_id"]
                        isOneToOne: false
                        referencedRelation: "groups"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "messages_groupe_id_fkey"
                        columns: ["groupe_id"]
                        isOneToOne: false
                        referencedRelation: "groups"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "messages_recipient_id_fkey"
                        columns: ["recipient_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "messages_sender_id_fkey"
                        columns: ["sender_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            messaging_favorites: {
                Row: {
                    user_id: string
                    target_user_id: string
                    created_at: string
                }
                Insert: {
                    user_id: string
                    target_user_id: string
                    created_at?: string | null
                }
                Update: {
                    user_id?: string | null
                    target_user_id?: string | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "messaging_favorites_target_user_id_fkey"
                        columns: ["target_user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "messaging_favorites_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            new_ticket: {
                Row: {
                    id: number
                    created_at: string
                    title: string
                    description: string
                    status: string
                    created_by: string
                    assigned_to: string | null
                    priority: string
                    last_updated: string | null
                    from: string
                    category: string
                }
                Insert: {
                    id?: number | null
                    created_at?: string | null
                    title: string
                    description: string
                    status: string
                    created_by: string
                    assigned_to?: string | null
                    priority: string
                    last_updated?: string | null
                    from: string
                    category: string
                }
                Update: {
                    id?: number | null
                    created_at?: string | null
                    title?: string | null
                    description?: string | null
                    status?: string | null
                    created_by?: string | null
                    assigned_to?: string | null
                    priority?: string | null
                    last_updated?: string | null
                    from?: string | null
                    category?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "new_ticket_assigned_to_fkey"
                        columns: ["assigned_to"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "new_ticket_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            newsletter_api_logs: {
                Row: {
                    id: number
                    ts: string
                    level: string
                    msg: string
                    req_id: string | null
                    method: string | null
                    path: string | null
                    status: number | null
                    duration_ms: number | null
                    attrs: Json | null
                }
                Insert: {
                    id?: number | null
                    ts?: string | null
                    level: string
                    msg: string
                    req_id?: string | null
                    method?: string | null
                    path?: string | null
                    status?: number | null
                    duration_ms?: number | null
                    attrs?: Json | null
                }
                Update: {
                    id?: number | null
                    ts?: string | null
                    level?: string | null
                    msg?: string | null
                    req_id?: string | null
                    method?: string | null
                    path?: string | null
                    status?: number | null
                    duration_ms?: number | null
                    attrs?: Json | null
                }
                Relationships: []
            }
            newsletter_invitation_codes: {
                Row: {
                    id: string
                    code: string
                    label: string | null
                    created_by: string
                    used_by: string | null
                    used_at: string | null
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    code: string
                    label?: string | null
                    created_by: string
                    used_by?: string | null
                    used_at?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    code?: string | null
                    label?: string | null
                    created_by?: string | null
                    used_by?: string | null
                    used_at?: string | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "newsletter_invitation_codes_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "newsletter_invitation_codes_used_by_fkey"
                        columns: ["used_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            newsletter_send_events: {
                Row: {
                    id: string
                    run_id: string
                    user_id: string
                    email: string
                    status: string
                    error: string | null
                    xlsx_size_bytes: number | null
                    excel_ms: number | null
                    smtp_ms: number | null
                    changed_cells: number | null
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    run_id: string
                    user_id: string
                    email: string
                    status: string
                    error?: string | null
                    xlsx_size_bytes?: number | null
                    excel_ms?: number | null
                    smtp_ms?: number | null
                    changed_cells?: number | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    run_id?: string | null
                    user_id?: string | null
                    email?: string | null
                    status?: string | null
                    error?: string | null
                    xlsx_size_bytes?: number | null
                    excel_ms?: number | null
                    smtp_ms?: number | null
                    changed_cells?: number | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "newsletter_send_events_run_id_fkey"
                        columns: ["run_id"]
                        isOneToOne: false
                        referencedRelation: "newsletter_send_runs"
                        referencedColumns: ["id"]
                    },
                ]
            }
            newsletter_send_runs: {
                Row: {
                    id: string
                    trigger: string
                    triggered_by: string | null
                    started_at: string
                    finished_at: string | null
                    status: string
                    rows_count: number
                    subscribers_total: number
                    sent_count: number
                    failed_count: number
                    duration_ms: number | null
                    error: string | null
                }
                Insert: {
                    id?: string | null
                    trigger: string
                    triggered_by?: string | null
                    started_at?: string | null
                    finished_at?: string | null
                    status?: string | null
                    rows_count?: number | null
                    subscribers_total?: number | null
                    sent_count?: number | null
                    failed_count?: number | null
                    duration_ms?: number | null
                    error?: string | null
                }
                Update: {
                    id?: string | null
                    trigger?: string | null
                    triggered_by?: string | null
                    started_at?: string | null
                    finished_at?: string | null
                    status?: string | null
                    rows_count?: number | null
                    subscribers_total?: number | null
                    sent_count?: number | null
                    failed_count?: number | null
                    duration_ms?: number | null
                    error?: string | null
                }
                Relationships: []
            }
            newsletter_subscriptions: {
                Row: {
                    user_id: string
                    email: string
                    full_name: string | null
                    visible_columns: Json
                    active: boolean
                    created_at: string
                    arrivage: boolean | null
                    crm_stat: boolean | null
                }
                Insert: {
                    user_id: string
                    email: string
                    full_name?: string | null
                    visible_columns?: Json | null
                    active?: boolean | null
                    created_at?: string | null
                    arrivage?: boolean | null
                    crm_stat?: boolean | null
                }
                Update: {
                    user_id?: string | null
                    email?: string | null
                    full_name?: string | null
                    visible_columns?: Json | null
                    active?: boolean | null
                    created_at?: string | null
                    arrivage?: boolean | null
                    crm_stat?: boolean | null
                }
                Relationships: [
                    {
                        foreignKeyName: "newsletter_subscriptions_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            notification: {
                Row: {
                    id: string
                    user_id: string
                    type: string | null
                    title: string | null
                    read: boolean | null
                    url: string | null
                    created_at: string
                    icon: string | null
                }
                Insert: {
                    id?: string | null
                    user_id?: string | null
                    type?: string | null
                    title?: string | null
                    read?: boolean | null
                    url?: string | null
                    created_at?: string | null
                    icon?: string | null
                }
                Update: {
                    id?: string | null
                    user_id?: string | null
                    type?: string | null
                    title?: string | null
                    read?: boolean | null
                    url?: string | null
                    created_at?: string | null
                    icon?: string | null
                }
                Relationships: []
            }
            outlook_connections: {
                Row: {
                    id: string
                    user_id: string
                    is_active: boolean | null
                    created_at: string | null
                    updated_at: string | null
                    ews_email: string
                    ews_url: string
                    last_sync_at: string | null
                    ews_password_encrypted: string
                }
                Insert: {
                    id?: string | null
                    user_id: string
                    is_active?: boolean | null
                    created_at?: string | null
                    updated_at?: string | null
                    ews_email: string
                    ews_url?: string | null
                    last_sync_at?: string | null
                    ews_password_encrypted: string
                }
                Update: {
                    id?: string | null
                    user_id?: string | null
                    is_active?: boolean | null
                    created_at?: string | null
                    updated_at?: string | null
                    ews_email?: string | null
                    ews_url?: string | null
                    last_sync_at?: string | null
                    ews_password_encrypted?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "outlook_connections_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            packages: {
                Row: {
                    id: number
                    item_id: number
                    kgs: number | null
                    pcs: number | null
                    qty: number | null
                    total_pcs_kg: number | null
                    unit_price: number | null
                    total: number | null
                    total_avec_livraison: number | null
                }
                Insert: {
                    id?: number | null
                    item_id: number
                    kgs?: number | null
                    pcs?: number | null
                    qty?: number | null
                    total_pcs_kg?: number | null
                    unit_price?: number | null
                    total?: number | null
                    total_avec_livraison?: number | null
                }
                Update: {
                    id?: number | null
                    item_id?: number | null
                    kgs?: number | null
                    pcs?: number | null
                    qty?: number | null
                    total_pcs_kg?: number | null
                    unit_price?: number | null
                    total?: number | null
                    total_avec_livraison?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "packages_item_id_fkey"
                        columns: ["item_id"]
                        isOneToOne: false
                        referencedRelation: "items"
                        referencedColumns: ["id"]
                    },
                ]
            }
            pake_credentials: {
                Row: {
                    user_id: string
                    cred_id: string
                    client_id: string
                    record: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    user_id: string
                    cred_id: string
                    client_id: string
                    record: string
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    user_id?: string | null
                    cred_id?: string | null
                    client_id?: string | null
                    record?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            pake_server_params: {
                Row: {
                    id: number
                    config: string
                    server_id: string
                    server_public_key: string
                    server_private_key: string
                    oprf_seed: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number | null
                    config: string
                    server_id: string
                    server_public_key: string
                    server_private_key: string
                    oprf_seed: string
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: number | null
                    config?: string | null
                    server_id?: string | null
                    server_public_key?: string | null
                    server_private_key?: string | null
                    oprf_seed?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            permissions: {
                Row: {
                    id: string
                    code: string
                    label: string
                    category: string | null
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    code: string
                    label?: string | null
                    category?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    code?: string | null
                    label?: string | null
                    category?: string | null
                    created_at?: string | null
                }
                Relationships: []
            }
            ping_pong_players: {
                Row: {
                    id: string
                    user_id: string
                    elo_rating: number
                    wins: number
                    losses: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    user_id: string
                    elo_rating?: number | null
                    wins?: number | null
                    losses?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    user_id?: string | null
                    elo_rating?: number | null
                    wins?: number | null
                    losses?: number | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            product: {
                Row: {
                    id: number
                    type: string
                    stock: number | null
                    price: number | null
                    name: string | null
                    categorie: string | null
                    sales: number | null
                    description: string | null
                    fournisseur: string | null
                    facturation: string | null
                }
                Insert: {
                    id?: number | null
                    type: string
                    stock?: number | null
                    price?: number | null
                    name?: string | null
                    categorie?: string | null
                    sales?: number | null
                    description?: string | null
                    fournisseur?: string | null
                    facturation?: string | null
                }
                Update: {
                    id?: number | null
                    type?: string | null
                    stock?: number | null
                    price?: number | null
                    name?: string | null
                    categorie?: string | null
                    sales?: number | null
                    description?: string | null
                    fournisseur?: string | null
                    facturation?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "product_fournisseur_fkey"
                        columns: ["fournisseur"]
                        isOneToOne: false
                        referencedRelation: "Fournisseur_crm"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "product_type_fkey"
                        columns: ["type"]
                        isOneToOne: false
                        referencedRelation: "Type_product_CRM"
                        referencedColumns: ["id"]
                    },
                ]
            }
            product_image: {
                Row: {
                    id: number
                    created_at: string
                    data: string | null
                }
                Insert: {
                    id?: number | null
                    created_at?: string | null
                    data?: string | null
                }
                Update: {
                    id?: number | null
                    created_at?: string | null
                    data?: string | null
                }
                Relationships: []
            }
            profiles: {
                Row: {
                    id: string
                    user_id: string
                    email: string
                    full_name: string
                    status: string
                    avatar_url: string | null
                    last_login: string | null
                    created_at: string
                    updated_at: string
                    role_id: string | null
                    service_id: string | null
                    role: string | null
                    phone: string | null
                    privacy_accepted_at: string | null
                    privacy_accepted_version: string | null
                    archived_at: string | null
                }
                Insert: {
                    id?: string | null
                    user_id: string
                    email: string
                    full_name: string
                    status?: string | null
                    avatar_url?: string | null
                    last_login?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    role_id?: string | null
                    service_id?: string | null
                    role?: string | null
                    phone?: string | null
                    privacy_accepted_at?: string | null
                    privacy_accepted_version?: string | null
                    archived_at?: string | null
                }
                Update: {
                    id?: string | null
                    user_id?: string | null
                    email?: string | null
                    full_name?: string | null
                    status?: string | null
                    avatar_url?: string | null
                    last_login?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    role_id?: string | null
                    service_id?: string | null
                    role?: string | null
                    phone?: string | null
                    privacy_accepted_at?: string | null
                    privacy_accepted_version?: string | null
                    archived_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "profiles_role_id_fkey"
                        columns: ["role_id"]
                        isOneToOne: false
                        referencedRelation: "roles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "profiles_service_id_fkey"
                        columns: ["service_id"]
                        isOneToOne: false
                        referencedRelation: "services"
                        referencedColumns: ["id"]
                    },
                ]
            }
            project_sprints: {
                Row: {
                    id: string
                    team_id: string
                    name: string
                    goal: string | null
                    status: Database["public"]["Enums"]["project_sprint_status"]
                    start_date: string | null
                    end_date: string | null
                    created_by: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    team_id: string
                    name: string
                    goal?: string | null
                    status?:
                        | Database["public"]["Enums"]["project_sprint_status"]
                        | null
                    start_date?: string | null
                    end_date?: string | null
                    created_by: string
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    team_id?: string | null
                    name?: string | null
                    goal?: string | null
                    status?:
                        | Database["public"]["Enums"]["project_sprint_status"]
                        | null
                    start_date?: string | null
                    end_date?: string | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "project_sprints_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "project_sprints_team_id_fkey"
                        columns: ["team_id"]
                        isOneToOne: false
                        referencedRelation: "project_teams"
                        referencedColumns: ["id"]
                    },
                ]
            }
            project_task_attachments: {
                Row: {
                    id: string
                    task_id: string
                    storage_path: string
                    file_name: string
                    mime_type: string | null
                    size_bytes: number
                    uploaded_by: string | null
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    task_id: string
                    storage_path: string
                    file_name: string
                    mime_type?: string | null
                    size_bytes?: number | null
                    uploaded_by?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    task_id?: string | null
                    storage_path?: string | null
                    file_name?: string | null
                    mime_type?: string | null
                    size_bytes?: number | null
                    uploaded_by?: string | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "project_task_attachments_task_id_fkey"
                        columns: ["task_id"]
                        isOneToOne: false
                        referencedRelation: "project_tasks"
                        referencedColumns: ["id"]
                    },
                ]
            }
            project_tasks: {
                Row: {
                    id: string
                    sprint_id: string
                    title: string
                    description: string | null
                    status: Database["public"]["Enums"]["project_task_status"]
                    assignee_id: string | null
                    created_by: string
                    position: number
                    due_date: string | null
                    created_at: string
                    updated_at: string
                    priority: Database["public"]["Enums"]["Priorities"]
                    last_moved_by: string | null
                    last_moved_at: string | null
                }
                Insert: {
                    id?: string | null
                    sprint_id: string
                    title: string
                    description?: string | null
                    status?:
                        | Database["public"]["Enums"]["project_task_status"]
                        | null
                    assignee_id?: string | null
                    created_by: string
                    position?: number | null
                    due_date?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    priority?: Database["public"]["Enums"]["Priorities"] | null
                    last_moved_by?: string | null
                    last_moved_at?: string | null
                }
                Update: {
                    id?: string | null
                    sprint_id?: string | null
                    title?: string | null
                    description?: string | null
                    status?:
                        | Database["public"]["Enums"]["project_task_status"]
                        | null
                    assignee_id?: string | null
                    created_by?: string | null
                    position?: number | null
                    due_date?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    priority?: Database["public"]["Enums"]["Priorities"] | null
                    last_moved_by?: string | null
                    last_moved_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "project_tasks_assignee_id_fkey"
                        columns: ["assignee_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "project_tasks_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "project_tasks_last_moved_by_fkey"
                        columns: ["last_moved_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "project_tasks_sprint_id_fkey"
                        columns: ["sprint_id"]
                        isOneToOne: false
                        referencedRelation: "project_sprints"
                        referencedColumns: ["id"]
                    },
                ]
            }
            project_team_members: {
                Row: {
                    id: string
                    team_id: string
                    user_id: string
                    role: string
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    team_id: string
                    user_id: string
                    role?: string | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    team_id?: string | null
                    user_id?: string | null
                    role?: string | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "project_team_members_team_id_fkey"
                        columns: ["team_id"]
                        isOneToOne: false
                        referencedRelation: "project_teams"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "project_team_members_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            project_teams: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    owner_id: string
                    created_at: string
                    updated_at: string
                    status: Database["public"]["Enums"]["project_team_status"]
                }
                Insert: {
                    id?: string | null
                    name: string
                    description?: string | null
                    owner_id: string
                    created_at?: string | null
                    updated_at?: string | null
                    status?:
                        | Database["public"]["Enums"]["project_team_status"]
                        | null
                }
                Update: {
                    id?: string | null
                    name?: string | null
                    description?: string | null
                    owner_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    status?:
                        | Database["public"]["Enums"]["project_team_status"]
                        | null
                }
                Relationships: [
                    {
                        foreignKeyName: "project_teams_owner_id_fkey"
                        columns: ["owner_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            push_subscriptions: {
                Row: {
                    id: string
                    user_id: string
                    endpoint: string
                    subscription: Json
                    created_at: string | null
                    updated_at: string | null
                    device_id: string | null
                    device_secret: string | null
                }
                Insert: {
                    id?: string | null
                    user_id: string
                    endpoint: string
                    subscription: Json
                    created_at?: string | null
                    updated_at?: string | null
                    device_id?: string | null
                    device_secret?: string | null
                }
                Update: {
                    id?: string | null
                    user_id?: string | null
                    endpoint?: string | null
                    subscription?: Json | null
                    created_at?: string | null
                    updated_at?: string | null
                    device_id?: string | null
                    device_secret?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "push_subscriptions_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            rdv_reschedule_mail_queue: {
                Row: {
                    event_id: string
                    send_after: string
                    queued_at: string
                }
                Insert: {
                    event_id: string
                    send_after: string
                    queued_at?: string | null
                }
                Update: {
                    event_id?: string | null
                    send_after?: string | null
                    queued_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "rdv_reschedule_mail_queue_event_id_fkey"
                        columns: ["event_id"]
                        isOneToOne: true
                        referencedRelation: "Event_calendar"
                        referencedColumns: ["id"]
                    },
                ]
            }
            results: {
                Row: {
                    key: string
                    html: string
                    created_at: string
                }
                Insert: {
                    key: string
                    html: string
                    created_at?: string | null
                }
                Update: {
                    key?: string | null
                    html?: string | null
                    created_at?: string | null
                }
                Relationships: []
            }
            roles: {
                Row: {
                    id: string
                    nom: string
                    permissions: Json
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    nom: string
                    permissions?: Json | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    nom?: string | null
                    permissions?: Json | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            roles_permissions: {
                Row: {
                    role_id: string
                    permission_id: string
                }
                Insert: {
                    role_id: string
                    permission_id: string
                }
                Update: {
                    role_id?: string | null
                    permission_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "roles_permissions_permission_id_fkey"
                        columns: ["permission_id"]
                        isOneToOne: false
                        referencedRelation: "permissions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "roles_permissions_role_id_fkey"
                        columns: ["role_id"]
                        isOneToOne: false
                        referencedRelation: "roles"
                        referencedColumns: ["id"]
                    },
                ]
            }
            services: {
                Row: {
                    id: string
                    nom: string
                    permissions: Json
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    nom: string
                    permissions?: Json | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    nom?: string | null
                    permissions?: Json | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            services_permissions: {
                Row: {
                    service_id: string
                    permission_id: string
                }
                Insert: {
                    service_id: string
                    permission_id: string
                }
                Update: {
                    service_id?: string | null
                    permission_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "services_permissions_permission_id_fkey"
                        columns: ["permission_id"]
                        isOneToOne: false
                        referencedRelation: "permissions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "services_permissions_service_id_fkey"
                        columns: ["service_id"]
                        isOneToOne: false
                        referencedRelation: "services"
                        referencedColumns: ["id"]
                    },
                ]
            }
            sorting_reports: {
                Row: {
                    id: string
                    created_at: string
                    user_id: string
                    fournisseur_uid: string
                    time: string | null
                    quantity: number | null
                    comments: string | null
                    quality: number | null
                    uid_balle: string | null
                    category: string | null
                    mag_piece: number | null
                    export_piece: number | null
                    client_piece: number | null
                    so3_piece: number | null
                    kssummer_piece: number | null
                    kswinter_piece: number | null
                    mag_kg: number | null
                    export_kg: number | null
                    client_kg: number | null
                    so3_kg: number | null
                    kssummer_kg: number | null
                    kswinter_kg: number | null
                    updated_at: string | null
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    user_id?: string | null
                    fournisseur_uid: string
                    time?: string | null
                    quantity?: number | null
                    comments?: string | null
                    quality?: number | null
                    uid_balle?: string | null
                    category?: string | null
                    mag_piece?: number | null
                    export_piece?: number | null
                    client_piece?: number | null
                    so3_piece?: number | null
                    kssummer_piece?: number | null
                    kswinter_piece?: number | null
                    mag_kg?: number | null
                    export_kg?: number | null
                    client_kg?: number | null
                    so3_kg?: number | null
                    kssummer_kg?: number | null
                    kswinter_kg?: number | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    user_id?: string | null
                    fournisseur_uid?: string | null
                    time?: string | null
                    quantity?: number | null
                    comments?: string | null
                    quality?: number | null
                    uid_balle?: string | null
                    category?: string | null
                    mag_piece?: number | null
                    export_piece?: number | null
                    client_piece?: number | null
                    so3_piece?: number | null
                    kssummer_piece?: number | null
                    kswinter_piece?: number | null
                    mag_kg?: number | null
                    export_kg?: number | null
                    client_kg?: number | null
                    so3_kg?: number | null
                    kssummer_kg?: number | null
                    kswinter_kg?: number | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "sorting_reports_fournisseur_uid_fkey"
                        columns: ["fournisseur_uid"]
                        isOneToOne: false
                        referencedRelation: "fournisseur"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "sorting_reports_uid_balle_fkey"
                        columns: ["uid_balle"]
                        isOneToOne: true
                        referencedRelation: "balles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "sorting_reports_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            sync_history: {
                Row: {
                    id: string
                    crm_event_id: string
                    wp_block_id: number
                    item_type: string
                    synced_at: string
                }
                Insert: {
                    id?: string | null
                    crm_event_id: string
                    wp_block_id: number
                    item_type: string
                    synced_at?: string | null
                }
                Update: {
                    id?: string | null
                    crm_event_id?: string | null
                    wp_block_id?: number | null
                    item_type?: string | null
                    synced_at?: string | null
                }
                Relationships: []
            }
            tableau_devis: {
                Row: {
                    id_tab: number
                    id: string
                    number: number | null
                    produit: string | null
                    description: string | null
                    qty: number | null
                    poid: number | null
                    prix: number | null
                    totalHT: number | null
                    TVA: number | null
                    mode: string | null
                }
                Insert: {
                    id_tab?: number | null
                    id?: string | null
                    number?: number | null
                    produit?: string | null
                    description?: string | null
                    qty?: number | null
                    poid?: number | null
                    prix?: number | null
                    totalHT?: number | null
                    TVA?: number | null
                    mode?: string | null
                }
                Update: {
                    id_tab?: number | null
                    id?: string | null
                    number?: number | null
                    produit?: string | null
                    description?: string | null
                    qty?: number | null
                    poid?: number | null
                    prix?: number | null
                    totalHT?: number | null
                    TVA?: number | null
                    mode?: string | null
                }
                Relationships: []
            }
            ticket_chat_table: {
                Row: {
                    id: string
                    ticket_id: string
                    assigned_user: string
                    owner_user: string
                    created_at: string
                    closed_at: string | null
                }
                Insert: {
                    id?: string | null
                    ticket_id?: string | null
                    assigned_user?: string | null
                    owner_user?: string | null
                    created_at?: string | null
                    closed_at?: string | null
                }
                Update: {
                    id?: string | null
                    ticket_id?: string | null
                    assigned_user?: string | null
                    owner_user?: string | null
                    created_at?: string | null
                    closed_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "ticket_chat_table_assigned_user_fkey"
                        columns: ["assigned_user"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "ticket_chat_table_owner_user_fkey"
                        columns: ["owner_user"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "ticket_chat_table_ticket_id_fkey"
                        columns: ["ticket_id"]
                        isOneToOne: false
                        referencedRelation: "ticket_table"
                        referencedColumns: ["id"]
                    },
                ]
            }
            ticket_message: {
                Row: {
                    id: string
                    created_at: string
                    send_by: string
                    chat_id: string
                    text: string | null
                    joint: Json | null
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    send_by?: string | null
                    chat_id?: string | null
                    text?: string | null
                    joint?: Json | null
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    send_by?: string | null
                    chat_id?: string | null
                    text?: string | null
                    joint?: Json | null
                }
                Relationships: [
                    {
                        foreignKeyName: "ticket_message_chat_id_fkey"
                        columns: ["chat_id"]
                        isOneToOne: false
                        referencedRelation: "ticket_chat_table"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "ticket_message_send_by_fkey"
                        columns: ["send_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            ticket_table: {
                Row: {
                    id: string
                    created_at: string
                    title: string
                    description: string
                    status: string
                    created_by: string
                    assigned_to: string | null
                    priority: string
                    updated_at: string | null
                    from: string
                    category: string
                    type: string | null
                }
                Insert: {
                    id?: string | null
                    created_at?: string | null
                    title: string
                    description: string
                    status: string
                    created_by: string
                    assigned_to?: string | null
                    priority: string
                    updated_at?: string | null
                    from: string
                    category: string
                    type?: string | null
                }
                Update: {
                    id?: string | null
                    created_at?: string | null
                    title?: string | null
                    description?: string | null
                    status?: string | null
                    created_by?: string | null
                    assigned_to?: string | null
                    priority?: string | null
                    updated_at?: string | null
                    from?: string | null
                    category?: string | null
                    type?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "ticket_table_assigned_to_fkey"
                        columns: ["assigned_to"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "ticket_table_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            tournament_participants: {
                Row: {
                    id: string
                    tournament_id: string
                    player_id: string
                    seed: number
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    tournament_id: string
                    player_id: string
                    seed: number
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    tournament_id?: string | null
                    player_id?: string | null
                    seed?: number | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "tournament_participants_player_id_fkey"
                        columns: ["player_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                    {
                        foreignKeyName: "tournament_participants_tournament_id_fkey"
                        columns: ["tournament_id"]
                        isOneToOne: false
                        referencedRelation: "tournaments"
                        referencedColumns: ["id"]
                    },
                ]
            }
            tournaments: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    start_date: string
                    end_date: string | null
                    status: string
                    created_by: string
                    created_at: string
                    updated_at: string
                    points_per_game: number
                    games_per_set: number
                    sets_to_win: number
                }
                Insert: {
                    id?: string | null
                    name: string
                    description?: string | null
                    start_date: string
                    end_date?: string | null
                    status?: string | null
                    created_by: string
                    created_at?: string | null
                    updated_at?: string | null
                    points_per_game?: number | null
                    games_per_set?: number | null
                    sets_to_win?: number | null
                }
                Update: {
                    id?: string | null
                    name?: string | null
                    description?: string | null
                    start_date?: string | null
                    end_date?: string | null
                    status?: string | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    points_per_game?: number | null
                    games_per_set?: number | null
                    sets_to_win?: number | null
                }
                Relationships: []
            }
            user_crm_analytics_layout: {
                Row: {
                    user_id: string
                    section_order: Json
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    user_id: string
                    section_order?: Json | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    user_id?: string | null
                    section_order?: Json | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "user_crm_analytics_layout_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            user_dashboard_layout: {
                Row: {
                    user_id: string
                    layout: Json
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    user_id: string
                    layout: Json
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    user_id?: string | null
                    layout?: Json | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "user_dashboard_layout_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            user_keys: {
                Row: {
                    user_id: string
                    device_id: string
                    pubkey: Json
                    encrypted_privkey: string
                    iv: string
                    kdf: Json
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    user_id: string
                    device_id: string
                    pubkey: Json
                    encrypted_privkey: string
                    iv: string
                    kdf: Json
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    user_id?: string | null
                    device_id?: string | null
                    pubkey?: Json | null
                    encrypted_privkey?: string | null
                    iv?: string | null
                    kdf?: Json | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            user_preferences: {
                Row: {
                    user_id: string
                    theme: string
                    push_enabled: boolean
                    notify_ticket: boolean
                    notify_message: boolean
                    notify_system: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    user_id: string
                    theme?: string | null
                    push_enabled?: boolean | null
                    notify_ticket?: boolean | null
                    notify_message?: boolean | null
                    notify_system?: boolean | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    user_id?: string | null
                    theme?: string | null
                    push_enabled?: boolean | null
                    notify_ticket?: boolean | null
                    notify_message?: boolean | null
                    notify_system?: boolean | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "user_preferences_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: true
                        referencedRelation: "users"
                        referencedColumns: ["id"]
                    },
                ]
            }
            users_permissions: {
                Row: {
                    id: string
                    user_id: string
                    permission_id: string
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    user_id: string
                    permission_id: string
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    user_id?: string | null
                    permission_id?: string | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "users_permissions_permission_id_fkey"
                        columns: ["permission_id"]
                        isOneToOne: true
                        referencedRelation: "permissions"
                        referencedColumns: ["id"]
                    },
                ]
            }
            watch_config: {
                Row: {
                    id: number
                    name: string
                    topic: string
                    language: string
                    horizon: string
                    persona: string
                    active: boolean
                    created_at: string
                    service_ids: string[] | null
                }
                Insert: {
                    id?: number | null
                    name: string
                    topic: string
                    language?: string | null
                    horizon?: string | null
                    persona?: string | null
                    active?: boolean | null
                    created_at?: string | null
                    service_ids?: string[] | null
                }
                Update: {
                    id?: number | null
                    name?: string | null
                    topic?: string | null
                    language?: string | null
                    horizon?: string | null
                    persona?: string | null
                    active?: boolean | null
                    created_at?: string | null
                    service_ids?: string[] | null
                }
                Relationships: []
            }
            wiki_article_views: {
                Row: {
                    id: string
                    article_id: string
                    user_id: string
                    viewed_at: string
                    dwell_ms: number | null
                    completed: boolean
                    source: string
                }
                Insert: {
                    id?: string | null
                    article_id: string
                    user_id?: string | null
                    viewed_at?: string | null
                    dwell_ms?: number | null
                    completed?: boolean | null
                    source?: string | null
                }
                Update: {
                    id?: string | null
                    article_id?: string | null
                    user_id?: string | null
                    viewed_at?: string | null
                    dwell_ms?: number | null
                    completed?: boolean | null
                    source?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "wiki_article_views_article_id_fkey"
                        columns: ["article_id"]
                        isOneToOne: false
                        referencedRelation: "wiki_articles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "wiki_article_views_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["user_id"]
                    },
                ]
            }
            wiki_articles: {
                Row: {
                    id: string
                    category_id: string | null
                    title: string
                    slug: string | null
                    body: string
                    sections: Json
                    status: string
                    position: number
                    created_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string | null
                    category_id?: string | null
                    title: string
                    slug?: string | null
                    body?: string | null
                    sections?: Json | null
                    status?: string | null
                    position?: number | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    id?: string | null
                    category_id?: string | null
                    title?: string | null
                    slug?: string | null
                    body?: string | null
                    sections?: Json | null
                    status?: string | null
                    position?: number | null
                    created_by?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "wiki_articles_category_id_fkey"
                        columns: ["category_id"]
                        isOneToOne: false
                        referencedRelation: "wiki_categories"
                        referencedColumns: ["id"]
                    },
                ]
            }
            wiki_categories: {
                Row: {
                    id: string
                    parent_id: string | null
                    name: string
                    position: number
                    created_at: string
                }
                Insert: {
                    id?: string | null
                    parent_id?: string | null
                    name: string
                    position?: number | null
                    created_at?: string | null
                }
                Update: {
                    id?: string | null
                    parent_id?: string | null
                    name?: string | null
                    position?: number | null
                    created_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "wiki_categories_parent_id_fkey"
                        columns: ["parent_id"]
                        isOneToOne: false
                        referencedRelation: "wiki_categories"
                        referencedColumns: ["id"]
                    },
                ]
            }
        }
        Views: {
            user_calendar_connections: {
                Row: {
                    source_type: string | null
                    connection_id: string | null
                    user_id: string | null
                    email: string | null
                    is_active: boolean | null
                    last_sync_at: string | null
                    created_at: string | null
                    updated_at: string | null
                }
                Insert: {
                    source_type?: string | null
                    connection_id?: string | null
                    user_id?: string | null
                    email?: string | null
                    is_active?: boolean | null
                    last_sync_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Update: {
                    source_type?: string | null
                    connection_id?: string | null
                    user_id?: string | null
                    email?: string | null
                    is_active?: boolean | null
                    last_sync_at?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            v_arrivages: {
                Row: {
                    container_no: string | null
                    facture_id: number | null
                    arrivee_depart_id: number | null
                    invoice_no: string | null
                    invoice_date: string | null
                    invoice_total: number | null
                    shipping_charges: number | null
                    total_invoice_value: number | null
                    total_invoice_usd: number | null
                    convert_rate_thb_usd: number | null
                    location: string | null
                    origin_country: string | null
                    origin_location: string | null
                    transport_mode: string | null
                    departure_date: string | null
                    port_arrival_date: string | null
                    prev_dechargement_jour: string | null
                    prev_dechargement_date: string | null
                    prev_dechargement_heure: string | null
                    total_weight_kg: number | null
                    total_qty: number | null
                    status: string | null
                    fournisseur_id: string | null
                    docked_at: string | null
                    received_date: string | null
                    notes: string | null
                    livraison_id: string | null
                    created_at: string | null
                    updated_at: string | null
                    prev_dechargement_libre: string | null
                    reference_interne: string | null
                    kind: string | null
                    conteneur_no_raw: string | null
                    mode_raw: string | null
                    invoice_items_count: number | null
                    invoice_total_qty: number | null
                }
                Insert: {
                    container_no?: string | null
                    facture_id?: number | null
                    arrivee_depart_id?: number | null
                    invoice_no?: string | null
                    invoice_date?: string | null
                    invoice_total?: number | null
                    shipping_charges?: number | null
                    total_invoice_value?: number | null
                    total_invoice_usd?: number | null
                    convert_rate_thb_usd?: number | null
                    location?: string | null
                    origin_country?: string | null
                    origin_location?: string | null
                    transport_mode?: string | null
                    departure_date?: string | null
                    port_arrival_date?: string | null
                    prev_dechargement_jour?: string | null
                    prev_dechargement_date?: string | null
                    prev_dechargement_heure?: string | null
                    total_weight_kg?: number | null
                    total_qty?: number | null
                    status?: string | null
                    fournisseur_id?: string | null
                    docked_at?: string | null
                    received_date?: string | null
                    notes?: string | null
                    livraison_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    prev_dechargement_libre?: string | null
                    reference_interne?: string | null
                    kind?: string | null
                    conteneur_no_raw?: string | null
                    mode_raw?: string | null
                    invoice_items_count?: number | null
                    invoice_total_qty?: number | null
                }
                Update: {
                    container_no?: string | null
                    facture_id?: number | null
                    arrivee_depart_id?: number | null
                    invoice_no?: string | null
                    invoice_date?: string | null
                    invoice_total?: number | null
                    shipping_charges?: number | null
                    total_invoice_value?: number | null
                    total_invoice_usd?: number | null
                    convert_rate_thb_usd?: number | null
                    location?: string | null
                    origin_country?: string | null
                    origin_location?: string | null
                    transport_mode?: string | null
                    departure_date?: string | null
                    port_arrival_date?: string | null
                    prev_dechargement_jour?: string | null
                    prev_dechargement_date?: string | null
                    prev_dechargement_heure?: string | null
                    total_weight_kg?: number | null
                    total_qty?: number | null
                    status?: string | null
                    fournisseur_id?: string | null
                    docked_at?: string | null
                    received_date?: string | null
                    notes?: string | null
                    livraison_id?: string | null
                    created_at?: string | null
                    updated_at?: string | null
                    prev_dechargement_libre?: string | null
                    reference_interne?: string | null
                    kind?: string | null
                    conteneur_no_raw?: string | null
                    mode_raw?: string | null
                    invoice_items_count?: number | null
                    invoice_total_qty?: number | null
                }
                Relationships: []
            }
            v_users_mfa_status: {
                Row: {
                    id: string | null
                    email: string | null
                    created_at: string | null
                    last_sign_in_at: string | null
                    has_mfa_enrolled: boolean | null
                    verified_factor_count: number | null
                    verified_factor_types: string[] | null
                }
                Insert: {
                    id?: string | null
                    email?: string | null
                    created_at?: string | null
                    last_sign_in_at?: string | null
                    has_mfa_enrolled?: boolean | null
                    verified_factor_count?: number | null
                    verified_factor_types?: string[] | null
                }
                Update: {
                    id?: string | null
                    email?: string | null
                    created_at?: string | null
                    last_sign_in_at?: string | null
                    has_mfa_enrolled?: boolean | null
                    verified_factor_count?: number | null
                    verified_factor_types?: string[] | null
                }
                Relationships: []
            }
            wiki_article_views_measured: {
                Row: {
                    id: string | null
                    article_id: string | null
                    user_id: string | null
                    viewed_at: string | null
                    dwell_ms: number | null
                    completed: boolean | null
                    source: string | null
                    article_title: string | null
                    article_status: string | null
                    article_category_id: string | null
                }
                Insert: {
                    id?: string | null
                    article_id?: string | null
                    user_id?: string | null
                    viewed_at?: string | null
                    dwell_ms?: number | null
                    completed?: boolean | null
                    source?: string | null
                    article_title?: string | null
                    article_status?: string | null
                    article_category_id?: string | null
                }
                Update: {
                    id?: string | null
                    article_id?: string | null
                    user_id?: string | null
                    viewed_at?: string | null
                    dwell_ms?: number | null
                    completed?: boolean | null
                    source?: string | null
                    article_title?: string | null
                    article_status?: string | null
                    article_category_id?: string | null
                }
                Relationships: []
            }
        }
        Functions: {
            Chronos_trg: {
                Args: never
                Returns: string
            }
            add_apple_calendar_connection: {
                Args: {
                    p_user_id: string
                    p_icloud_email: string
                    p_icloud_password: string
                    p_secret_key: string
                }
                Returns: string
            }
            amelia_provider_auto_match: {
                Args: never
                Returns: string
            }
            annonce_targets_viewer: {
                Args: {
                    p_role_ids: string
                    p_service_ids: string
                }
                Returns: boolean
            }
            app_maintenance_set_updated_at: {
                Args: never
                Returns: string
            }
            apply_arrivage_status_transitions: {
                Args: never
                Returns: undefined
            }
            apply_elo_on_match: {
                Args: never
                Returns: string
            }
            armor: {
                Args: never
                Returns: string
            }
            array_to_halfvec: {
                Args: never
                Returns: string
            }
            array_to_sparsevec: {
                Args: never
                Returns: string
            }
            array_to_vector: {
                Args: never
                Returns: string
            }
            auth_session_is_aal2: {
                Args: never
                Returns: boolean
            }
            auto_set_arrivage_status: {
                Args: never
                Returns: string
            }
            binary_quantize: {
                Args: never
                Returns: string
            }
            block_profile_sensitive_updates: {
                Args: never
                Returns: string
            }
            build_client_crm_document: {
                Args: {
                    c: string
                }
                Returns: string
            }
            changelog_replace_items: {
                Args: {
                    p_version_id: string
                    p_items: Json
                }
                Returns: undefined
            }
            check_arrivage_invoice_reminder: {
                Args: never
                Returns: string
            }
            check_is_service_admin: {
                Args: {
                    target_service_id: string
                }
                Returns: boolean
            }
            check_is_super_admin_global: {
                Args: never
                Returns: boolean
            }
            check_newsletter_webhook_ping: {
                Args: {
                    p_request_id: number
                }
                Returns: Json
            }
            cmg_is_admin: {
                Args: {
                    p_group_id: string
                    p_user_id: string
                }
                Returns: boolean
            }
            cmg_is_member: {
                Args: {
                    p_group_id: string
                    p_user_id: string
                }
                Returns: boolean
            }
            confirm_events_on_client_column_change: {
                Args: never
                Returns: string
            }
            correct_description: {
                Args: {
                    p_description: string
                    p_min_similarity: number
                }
                Returns: string
            }
            cosine_distance: {
                Args: never
                Returns: number
            }
            count_clients_filtered: {
                // Les 3 paramètres sont `DEFAULT NULL` côté SQL et NULL est une
                // valeur gérée explicitement (20260601000000_count_clients_filtered.sql,
                // "NULL = pas de filtre") — le générateur ne reflète pas cette
                // nullabilité runtime, corrigé à la main.
                Args: {
                    p_user_id: string | null
                    p_start: string | null
                    p_end: string | null
                }
                Returns: number
            }
            create_client_from_lead: {
                Args: never
                Returns: string
            }
            create_relance_tasks_on_rdv_achat: {
                Args: never
                Returns: string
            }
            crm_analytics_layout_set_updated_at: {
                Args: never
                Returns: string
            }
            crm_monthly_report: {
                Args: never
                Returns: Json
            }
            crypt: {
                Args: never
                Returns: string
            }
            current_user_has_mfa_enrolled: {
                Args: never
                Returns: boolean
            }
            current_user_has_mfa_session: {
                Args: never
                Returns: boolean
            }
            dashboard_layout_set_updated_at: {
                Args: never
                Returns: string
            }
            dearmor: {
                Args: never
                Returns: string
            }
            debug_auth_claims: {
                Args: never
                Returns: Json
            }
            decrypt: {
                Args: never
                Returns: string
            }
            decrypt_apple_password: {
                Args: {
                    encrypted_password: string
                    secret_key: string
                }
                Returns: string
            }
            decrypt_iv: {
                Args: never
                Returns: string
            }
            decrypt_message: {
                Args: {
                    p_encrypted: string
                }
                Returns: string
            }
            delete_user_cascade: {
                Args: {
                    user_uuid: string
                }
                Returns: undefined
            }
            digest: {
                Args: never
                Returns: string
            }
            encrypt: {
                Args: never
                Returns: string
            }
            encrypt_apple_password: {
                Args: {
                    password: string
                    secret_key: string
                }
                Returns: string
            }
            encrypt_iv: {
                Args: never
                Returns: string
            }
            encrypt_message: {
                Args: {
                    p_content: string
                }
                Returns: string
            }
            extract_bic: {
                Args: {
                    v: string
                }
                Returns: string
            }
            flush_rdv_reschedule_mails: {
                Args: never
                Returns: number
            }
            format_brief: {
                Args: {
                    raw_brief: string
                }
                Returns: string
            }
            function_call_go_api_on_new_event: {
                Args: never
                Returns: string
            }
            gen_random_bytes: {
                Args: never
                Returns: string
            }
            gen_random_uuid: {
                Args: never
                Returns: string
            }
            gen_salt: {
                Args: never
                Returns: string
            }
            get_app_logs_retention_audit: {
                Args: {
                    p_limit: number
                }
                // `RETURNS SETOF public.app_logs_retention_audit` — même limitation
                // de génération que get_crm_event_stats ci-dessus, corrigé à la main.
                Returns: Database["public"]["Tables"]["app_logs_retention_audit"]["Row"][]
            }
            get_client_column_counts: {
                // p_user_id est `DEFAULT NULL` côté SQL, NULL = total global
                // (20260831140000_client_crm_column_counts_v4_rdv_confirmer.sql) —
                // corrigé à la main, voir count_clients_filtered ci-dessus.
                Args: {
                    p_user_id: string | null
                }
                Returns: {
                    collum: number
                    count: number
                }[]
            }
            get_crm_event_stats: {
                Args: {
                    p_range_start: string
                    p_range_end: string
                }
                // La fonction SQL déclare `RETURNS SETOF "Event_calendar"`
                // (20260604000000_event_stats_rpc.sql) : le générateur ne résout pas
                // ce type composite (nom de table entre guillemets) et retombe sur
                // `string[]` — corrigé à la main vers la vraie forme de ligne.
                Returns: Database["public"]["Tables"]["Event_calendar"]["Row"][]
            }
            get_or_create_fournisseur: {
                Args: {
                    p_name: string
                    p_pays: string
                }
                Returns: string
            }
            get_sensitive_data: {
                Args: never
                Returns: {
                    id: string
                    payload: Json
                }[]
            }
            get_user_permissions: {
                Args: {
                    uid: string
                }
                Returns: {
                    code: string
                }[]
            }
            get_user_service_id: {
                Args: {
                    p_user_id: string
                }
                Returns: string
            }
            get_visible_watch_configs: {
                Args: {
                    p_user_id: string
                    p_service_id: string
                }
                Returns: {
                    config_id: number
                    config_name: string
                    config_topic: string
                }[]
            }
            get_visible_watch_reports: {
                Args: {
                    p_service_id: string
                }
                Returns: {
                    id: string
                    created_at: string
                    period_start: string
                    period_end: string
                    topic: string
                    frequency: string
                    source_model: string
                    analysis_model: string
                    raw_research: string
                    executive_summary: string
                    risks: string
                    opportunities: string
                    recommended_actions: string
                    importance_score: number
                    tags: string
                    metadata: Json
                }[]
            }
            gin_extract_query_trgm: {
                Args: never
                Returns: string
            }
            gin_extract_value_trgm: {
                Args: never
                Returns: string
            }
            gin_trgm_consistent: {
                Args: never
                Returns: boolean
            }
            gin_trgm_triconsistent: {
                Args: never
                Returns: string
            }
            gtrgm_compress: {
                Args: never
                Returns: string
            }
            gtrgm_consistent: {
                Args: never
                Returns: boolean
            }
            gtrgm_decompress: {
                Args: never
                Returns: string
            }
            gtrgm_distance: {
                Args: never
                Returns: number
            }
            gtrgm_in: {
                Args: never
                Returns: string
            }
            gtrgm_options: {
                Args: never
                Returns: undefined
            }
            gtrgm_out: {
                Args: never
                Returns: string
            }
            gtrgm_penalty: {
                Args: never
                Returns: string
            }
            gtrgm_picksplit: {
                Args: never
                Returns: string
            }
            gtrgm_same: {
                Args: never
                Returns: string
            }
            gtrgm_union: {
                Args: never
                Returns: string
            }
            halfvec: {
                Args: never
                Returns: string
            }
            halfvec_accum: {
                Args: never
                Returns: string
            }
            halfvec_add: {
                Args: never
                Returns: string
            }
            halfvec_avg: {
                Args: never
                Returns: string
            }
            halfvec_cmp: {
                Args: never
                Returns: number
            }
            halfvec_combine: {
                Args: never
                Returns: string
            }
            halfvec_concat: {
                Args: never
                Returns: string
            }
            halfvec_eq: {
                Args: never
                Returns: boolean
            }
            halfvec_ge: {
                Args: never
                Returns: boolean
            }
            halfvec_gt: {
                Args: never
                Returns: boolean
            }
            halfvec_in: {
                Args: never
                Returns: string
            }
            halfvec_l2_squared_distance: {
                Args: never
                Returns: number
            }
            halfvec_le: {
                Args: never
                Returns: boolean
            }
            halfvec_lt: {
                Args: never
                Returns: boolean
            }
            halfvec_mul: {
                Args: never
                Returns: string
            }
            halfvec_ne: {
                Args: never
                Returns: boolean
            }
            halfvec_negative_inner_product: {
                Args: never
                Returns: number
            }
            halfvec_out: {
                Args: never
                Returns: string
            }
            halfvec_recv: {
                Args: never
                Returns: string
            }
            halfvec_send: {
                Args: never
                Returns: string
            }
            halfvec_spherical_distance: {
                Args: never
                Returns: number
            }
            halfvec_sub: {
                Args: never
                Returns: string
            }
            halfvec_to_float4: {
                Args: never
                Returns: string
            }
            halfvec_to_sparsevec: {
                Args: never
                Returns: string
            }
            halfvec_to_vector: {
                Args: never
                Returns: string
            }
            halfvec_typmod_in: {
                Args: never
                Returns: number
            }
            hamming_distance: {
                Args: never
                Returns: number
            }
            handle_message_encryption: {
                Args: never
                Returns: string
            }
            handle_new_user: {
                Args: never
                Returns: string
            }
            has_permission: {
                Args: {
                    permission_code: string
                }
                Returns: boolean
            }
            hmac: {
                Args: never
                Returns: string
            }
            hnsw_bit_support: {
                Args: never
                Returns: string
            }
            hnsw_halfvec_support: {
                Args: never
                Returns: string
            }
            hnsw_sparsevec_support: {
                Args: never
                Returns: string
            }
            hnswhandler: {
                Args: never
                Returns: string
            }
            immutable_unaccent: {
                Args: never
                Returns: string
            }
            index_advisor: {
                Args: never
                Returns: string[]
            }
            index_advisor_duplicates: {
                Args: never
                Returns: string[]
            }
            index_advisor_fk: {
                Args: never
                Returns: string[]
            }
            index_advisor_unused: {
                Args: never
                Returns: string[]
            }
            inner_product: {
                Args: never
                Returns: number
            }
            is_admin: {
                Args: never
                Returns: boolean
            }
            is_service_admin: {
                Args: {
                    check_service_id: string
                }
                Returns: boolean
            }
            is_super_admin: {
                Args: never
                Returns: boolean
            }
            ivfflat_bit_support: {
                Args: never
                Returns: string
            }
            ivfflat_halfvec_support: {
                Args: never
                Returns: string
            }
            ivfflathandler: {
                Args: never
                Returns: string
            }
            jaccard_distance: {
                Args: never
                Returns: number
            }
            jsonb_diff: {
                Args: {
                    old_row: Json
                    new_row: Json
                    exclude_keys: string
                }
                Returns: Json
            }
            l1_distance: {
                Args: never
                Returns: number
            }
            l2_distance: {
                Args: never
                Returns: number
            }
            l2_norm: {
                Args: never
                Returns: number
            }
            l2_normalize: {
                Args: never
                Returns: string
            }
            leads_client_crm_sync: {
                Args: never
                Returns: string
            }
            log_arrivage_activity: {
                Args: never
                Returns: string
            }
            log_balle_activity: {
                Args: never
                Returns: string
            }
            log_category_activity: {
                Args: never
                Returns: string
            }
            log_changes: {
                Args: never
                Returns: string
            }
            log_delivery_activity: {
                Args: never
                Returns: string
            }
            log_fournisseur_activity: {
                Args: never
                Returns: string
            }
            notify_arrivage_invoice_reminders: {
                Args: never
                Returns: undefined
            }
            notify_crm_new_lead: {
                Args: never
                Returns: string
            }
            notify_crm_rdv_reminders: {
                Args: never
                Returns: undefined
            }
            notify_crm_task_assigned: {
                Args: never
                Returns: string
            }
            notify_crm_task_reminders: {
                Args: never
                Returns: undefined
            }
            notify_cryptedmessage: {
                Args: never
                Returns: string
            }
            notify_newsletter_api_error: {
                Args: never
                Returns: string
            }
            notify_newsletter_webhook_silence: {
                Args: never
                Returns: undefined
            }
            notify_on_delete_arrivage: {
                Args: never
                Returns: string
            }
            notify_on_new_arrivage: {
                Args: never
                Returns: string
            }
            notify_on_update_arrivage: {
                Args: never
                Returns: string
            }
            notify_users_by_service: {
                Args: {
                    p_service_id: string
                    p_type: string
                    p_title: string
                    p_url: string
                }
                Returns: number
            }
            notify_users_with_permission: {
                Args: {
                    p_permission_code: string
                    p_type: string
                    p_title: string
                    p_url: string
                }
                Returns: undefined
            }
            pgp_armor_headers: {
                Args: never
                Returns: {
                    key: string
                    value: string
                }[]
            }
            pgp_key_id: {
                Args: never
                Returns: string
            }
            pgp_pub_decrypt: {
                Args: never
                Returns: string
            }
            pgp_pub_decrypt_bytea: {
                Args: never
                Returns: string
            }
            pgp_pub_encrypt: {
                Args: never
                Returns: string
            }
            pgp_pub_encrypt_bytea: {
                Args: never
                Returns: string
            }
            pgp_sym_decrypt: {
                Args: never
                Returns: string
            }
            pgp_sym_decrypt_bytea: {
                Args: never
                Returns: string
            }
            pgp_sym_encrypt: {
                Args: never
                Returns: string
            }
            pgp_sym_encrypt_bytea: {
                Args: never
                Returns: string
            }
            ping_newsletter_webhook: {
                Args: never
                Returns: Json
            }
            post_rdv_mail: {
                Args: {
                    p_event_id: string
                    p_motif: string
                }
                Returns: boolean
            }
            project_owner_service_slug: {
                Args: {
                    team_id: string
                }
                Returns: string
            }
            purge_old_app_logs: {
                // Signature réelle (20260610120000_app_logs_retention.sql) :
                // p_months/p_tables sont `DEFAULT NULL`, p_tables est TEXT[] — le
                // générateur les rend non-null et scalaires ; Returns a la même
                // limitation SETOF-table que get_app_logs_retention_audit ci-dessus.
                Args: {
                    p_mode: string
                    p_months: number | null
                    p_tables: string[] | null
                }
                Returns: Database["public"]["Tables"]["app_logs_retention_audit"]["Row"][]
            }
            queue_client_embedding: {
                Args: never
                Returns: string
            }
            queue_rdv_reschedule_mail: {
                Args: never
                Returns: string
            }
            role_slug: {
                Args: {
                    role_name: string
                }
                Returns: string
            }
            rpc_test_insert_favorite: {
                Args: {
                    target: string
                }
                Returns: undefined
            }
            save_push_subscription: {
                Args: {
                    p_endpoint: string
                    p_subscription: Json
                }
                Returns: undefined
            }
            search_client_crm_embeddings: {
                Args: {
                    query_embedding: string
                    match_count: number
                }
                Returns: {
                    client_id: string
                    content: string
                    similarity: number
                }[]
            }
            send_crm_reminders_3_days_before: {
                Args: never
                Returns: undefined
            }
            send_rdv_reminders: {
                Args: never
                Returns: undefined
            }
            service_slug: {
                Args: {
                    service_name: string
                }
                Returns: string
            }
            set_arrivage_state_updated_at: {
                Args: never
                Returns: string
            }
            set_confirmation_amelia: {
                Args: never
                Returns: string
            }
            set_container_no: {
                Args: {
                    ad_id: number
                    new_no: string
                }
                Returns: string
            }
            set_container_no_from_facture: {
                Args: {
                    facture_id: number
                    new_no: string
                }
                Returns: string
            }
            set_event_customer_from_closer: {
                Args: never
                Returns: string
            }
            set_limit: {
                Args: never
                Returns: number
            }
            set_updated_at: {
                Args: never
                Returns: string
            }
            show_limit: {
                Args: never
                Returns: number
            }
            show_trgm: {
                Args: never
                Returns: string
            }
            similarity: {
                Args: never
                Returns: number
            }
            similarity_dist: {
                Args: never
                Returns: number
            }
            similarity_op: {
                Args: never
                Returns: boolean
            }
            snapshot_produit_recherche_monthly_stats: {
                Args: never
                Returns: undefined
            }
            sparsevec: {
                Args: never
                Returns: string
            }
            sparsevec_cmp: {
                Args: never
                Returns: number
            }
            sparsevec_eq: {
                Args: never
                Returns: boolean
            }
            sparsevec_ge: {
                Args: never
                Returns: boolean
            }
            sparsevec_gt: {
                Args: never
                Returns: boolean
            }
            sparsevec_in: {
                Args: never
                Returns: string
            }
            sparsevec_l2_squared_distance: {
                Args: never
                Returns: number
            }
            sparsevec_le: {
                Args: never
                Returns: boolean
            }
            sparsevec_lt: {
                Args: never
                Returns: boolean
            }
            sparsevec_ne: {
                Args: never
                Returns: boolean
            }
            sparsevec_negative_inner_product: {
                Args: never
                Returns: number
            }
            sparsevec_out: {
                Args: never
                Returns: string
            }
            sparsevec_recv: {
                Args: never
                Returns: string
            }
            sparsevec_send: {
                Args: never
                Returns: string
            }
            sparsevec_to_halfvec: {
                Args: never
                Returns: string
            }
            sparsevec_to_vector: {
                Args: never
                Returns: string
            }
            sparsevec_typmod_in: {
                Args: never
                Returns: number
            }
            strict_word_similarity: {
                Args: never
                Returns: number
            }
            strict_word_similarity_commutator_op: {
                Args: never
                Returns: boolean
            }
            strict_word_similarity_dist_commutator_op: {
                Args: never
                Returns: number
            }
            strict_word_similarity_dist_op: {
                Args: never
                Returns: number
            }
            strict_word_similarity_op: {
                Args: never
                Returns: boolean
            }
            subvector: {
                Args: never
                Returns: string
            }
            sync_closer_to_events: {
                Args: never
                Returns: string
            }
            sync_customer_to_closer: {
                Args: never
                Returns: string
            }
            sync_last_login: {
                Args: never
                Returns: string
            }
            sync_relance_tasks_on_rdv_update: {
                Args: never
                Returns: string
            }
            ticket_creation_trigger_notification: {
                Args: never
                Returns: string
            }
            touch_updated_at: {
                Args: never
                Returns: string
            }
            trg_customer_null: {
                Args: never
                Returns: string
            }
            trigger_notify_service_users: {
                Args: never
                Returns: string
            }
            unaccent: {
                Args: never
                Returns: string
            }
            unaccent_init: {
                Args: never
                Returns: string
            }
            unaccent_lexize: {
                Args: never
                Returns: string
            }
            update_cryptedmessage_groups_updated_at: {
                Args: never
                Returns: string
            }
            update_event_calendar_updated_at: {
                Args: never
                Returns: string
            }
            update_outlook_connection_updated_at: {
                Args: never
                Returns: string
            }
            update_project_status_as_admin: {
                Args: {
                    p_team_id: string
                    p_status: Database["public"]["Enums"]["project_team_status"]
                }
                Returns: undefined
            }
            update_updated_at_column: {
                Args: never
                Returns: string
            }
            user_can_access_project: {
                Args: {
                    team_id: string
                    target_user: string
                }
                Returns: boolean
            }
            user_can_create_projects: {
                Args: {
                    target_user: string
                }
                Returns: boolean
            }
            user_can_manage_projects: {
                Args: {
                    target_user: string
                }
                Returns: boolean
            }
            user_can_view_projects: {
                Args: {
                    target_user: string
                }
                Returns: boolean
            }
            user_has_it_project_creation_rights: {
                Args: {
                    user_id: string
                }
                Returns: boolean
            }
            user_has_permission: {
                Args: {
                    p_uid: string
                    p_code: string
                }
                Returns: boolean
            }
            user_has_project_service: {
                Args: {
                    target_user: string
                }
                Returns: boolean
            }
            user_is_global_admin: {
                Args: {
                    target_user: string
                }
                Returns: boolean
            }
            user_is_project_team_member: {
                Args: {
                    target_team: string
                    target_user: string
                }
                Returns: boolean
            }
            user_is_service_manager: {
                Args: {
                    target_user: string
                }
                Returns: boolean
            }
            user_is_team_owner: {
                Args: {
                    target_team: string
                    target_user: string
                }
                Returns: boolean
            }
            user_preferences_set_updated_at: {
                Args: never
                Returns: string
            }
            user_role_and_service: {
                Args: {
                    target_user: string
                }
                Returns: {
                    role_slug: string
                    service_slug: string
                }[]
            }
            user_service_slug: {
                Args: {
                    target_user: string
                }
                Returns: string
            }
            users_with_permission: {
                Args: {
                    p_code: string
                }
                Returns: {
                    user_id: string
                }[]
            }
            vector: {
                Args: never
                Returns: string
            }
            vector_accum: {
                Args: never
                Returns: string
            }
            vector_add: {
                Args: never
                Returns: string
            }
            vector_avg: {
                Args: never
                Returns: string
            }
            vector_cmp: {
                Args: never
                Returns: number
            }
            vector_combine: {
                Args: never
                Returns: string
            }
            vector_concat: {
                Args: never
                Returns: string
            }
            vector_dims: {
                Args: never
                Returns: number
            }
            vector_eq: {
                Args: never
                Returns: boolean
            }
            vector_ge: {
                Args: never
                Returns: boolean
            }
            vector_gt: {
                Args: never
                Returns: boolean
            }
            vector_in: {
                Args: never
                Returns: string
            }
            vector_l2_squared_distance: {
                Args: never
                Returns: number
            }
            vector_le: {
                Args: never
                Returns: boolean
            }
            vector_lt: {
                Args: never
                Returns: boolean
            }
            vector_mul: {
                Args: never
                Returns: string
            }
            vector_ne: {
                Args: never
                Returns: boolean
            }
            vector_negative_inner_product: {
                Args: never
                Returns: number
            }
            vector_norm: {
                Args: never
                Returns: number
            }
            vector_out: {
                Args: never
                Returns: string
            }
            vector_recv: {
                Args: never
                Returns: string
            }
            vector_send: {
                Args: never
                Returns: string
            }
            vector_spherical_distance: {
                Args: never
                Returns: number
            }
            vector_sub: {
                Args: never
                Returns: string
            }
            vector_to_float4: {
                Args: never
                Returns: string
            }
            vector_to_halfvec: {
                Args: never
                Returns: string
            }
            vector_to_sparsevec: {
                Args: never
                Returns: string
            }
            vector_typmod_in: {
                Args: never
                Returns: number
            }
            watch_config_visible_to_service: {
                Args: {
                    p_config_id: number
                    p_service_id: string
                }
                Returns: boolean
            }
            wiki_articles_set_updated_at: {
                Args: never
                Returns: string
            }
            wiki_reorder_categories: {
                Args: {
                    p_updates: Json
                }
                Returns: undefined
            }
            wiki_stats_cold_articles: {
                Args: {
                    p_from: string
                    p_to: string
                }
                Returns: {
                    article_id: string
                    title: string
                    category_id: string
                    updated_at: string
                }[]
            }
            wiki_stats_guard: {
                Args: never
                Returns: undefined
            }
            wiki_stats_overview: {
                Args: {
                    p_from: string
                    p_to: string
                }
                Returns: Json
            }
            wiki_stats_readers: {
                Args: {
                    p_from: string
                    p_to: string
                    p_limit: number
                }
                Returns: {
                    user_id: string
                    full_name: string
                    avatar_url: string
                    views: number
                    articles_read: number
                    last_seen: string
                }[]
            }
            wiki_stats_retention: {
                Args: {
                    p_from: string
                    p_to: string
                }
                Returns: {
                    cohort_week: string
                    week_offset: number
                    readers: number
                }[]
            }
            wiki_stats_timeseries: {
                Args: {
                    p_from: string
                    p_to: string
                }
                Returns: {
                    day: string
                    views: number
                    unique_readers: number
                }[]
            }
            wiki_stats_top_articles: {
                Args: {
                    p_from: string
                    p_to: string
                    p_limit: number
                }
                Returns: {
                    article_id: string
                    title: string
                    category_id: string
                    status: string
                    views: number
                    unique_readers: number
                    avg_dwell_seconds: number
                    completion_rate: number
                    last_viewed_at: string
                }[]
            }
            word_similarity: {
                Args: never
                Returns: number
            }
            word_similarity_commutator_op: {
                Args: never
                Returns: boolean
            }
            word_similarity_dist_commutator_op: {
                Args: never
                Returns: number
            }
            word_similarity_dist_op: {
                Args: never
                Returns: number
            }
            word_similarity_op: {
                Args: never
                Returns: boolean
            }
        }
        Enums: {
            Priorities: "Urgent" | "Haute" | "Normal" | "Basse" | "Nouveau"
            arrivage_status: "planifié" | "en_transit" | "reçu" | "annulé"
            arrivage_type: "Standard" | "Express" | "Groupé"
            changelog_version_status: "draft" | "published" | "archived"
            project_sprint_status:
                | "planned"
                | "active"
                | "completed"
                | "archived"
            project_task_status: "todo" | "in_progress" | "review" | "done"
            project_team_status: "active" | "archived"
        }
        CompositeTypes: {
            index_recommendation: {
                priority: string | null
                action: string | null
                table_name: string | null
                index_name: string | null
                detail: string | null
                sql_command: string | null
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

export type Functions<
    PublicFunctionNameOrOptions extends
        | keyof DefaultSchema["Functions"]
        | { schema: keyof DatabaseWithoutInternals },
    FunctionName extends PublicFunctionNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals
    }
        ? keyof DatabaseWithoutInternals[PublicFunctionNameOrOptions["schema"]]["Functions"]
        : never = never,
> = PublicFunctionNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
}
    ? DatabaseWithoutInternals[PublicFunctionNameOrOptions["schema"]]["Functions"][FunctionName]
    : PublicFunctionNameOrOptions extends keyof DefaultSchema["Functions"]
      ? DefaultSchema["Functions"][PublicFunctionNameOrOptions]
      : never

export const Constants = {
    graphql_public: {
        Enums: {},
    },
    public: {
        Enums: {
            Priorities: ["Urgent", "Haute", "Normal", "Basse", "Nouveau"],
            arrivage_status: ["planifié", "en_transit", "reçu", "annulé"],
            arrivage_type: ["Standard", "Express", "Groupé"],
            changelog_version_status: ["draft", "published", "archived"],
            project_sprint_status: [
                "planned",
                "active",
                "completed",
                "archived",
            ],
            project_task_status: ["todo", "in_progress", "review", "done"],
            project_team_status: ["active", "archived"],
        },
    },
} as const
