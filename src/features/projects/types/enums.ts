import type { Database } from "@/integrations/supabase/types"

export type SprintStatus = Database["public"]["Enums"]["project_sprint_status"]
export type TaskStatus = Database["public"]["Enums"]["project_task_status"]
export type TaskPriority = Database["public"]["Enums"]["Priorities"]
export type ProjectStatus = Database["public"]["Enums"]["project_team_status"]

export const TECH_SERVICE_ID = "6d68bcce-fa82-4020-9e16-714f9a64e5f4"
