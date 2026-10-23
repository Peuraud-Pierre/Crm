import type { NotificationPayload } from "@/features/projects/types"
import type { Database } from "@/integrations/supabase/types"
import { supabase } from "@/integrations/supabase/client"

export const sendProjectNotifications = async ({
    userIds,
    title,
    url = "/projects",
}: NotificationPayload) => {
    try {
        const targets = Array.from(new Set((userIds || []).filter(Boolean)))
        if (targets.length === 0) return

        const rows: Database["public"]["Tables"]["notification"]["Insert"][] =
            targets.map((userId) => ({
                user_id: userId,
                title,
                type: "system",
                url,
                read: false,
            }))

        const { error } = await supabase
            .from("notification")
            .insert(rows)
        if (error) {
            console.error("sendProjectNotifications", error)
        }
    } catch (error) {
        console.error("sendProjectNotifications", error)
    }
}
