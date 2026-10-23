import { supabase } from "@/integrations/supabase/client"
import type { Json } from "@/integrations/supabase/types"

export async function fetchRemoteBundle(userId: string): Promise<Json | null> {
    const { data, error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("cryptedmessage_keybundles") as any)
            .select("bundle")
            .eq("user_id", userId as string)
            .maybeSingle()
    if (error) {
        console.error("Erreur chargement bundle:", error)
        return null
    }
    return data?.bundle ?? null
}

/** Retourne `false` si l'écriture a échoué. */
export async function saveRemoteBundle(
    userId: string,
    bundle: Json
): Promise<boolean> {
    const { error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("cryptedmessage_keybundles") as any).upsert(
            [
                {
                    user_id: userId,
                    bundle,
                    updated_at: new Date().toISOString(),
                },
            ],
            { onConflict: "user_id" as const }
        )
    if (error) {
        console.error("Erreur sauvegarde bundle:", error)
    }
    return !error
}

export async function fetchAutoPassphrase(
    userId: string
): Promise<string | null> {
    const { data, error } =
        await // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase.from("cryptedmessage_autopassphrase") as any)
            .select("passphrase")
            .eq("user_id", userId as string)
            .maybeSingle()
    if (error) {
        console.error("Erreur chargement auto passphrase:", error)
        return null
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.passphrase ?? null
}

export async function deleteAutoPassphrase(userId: string): Promise<void> {
    await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("cryptedmessage_autopassphrase") as any)
        .delete()
        .eq("user_id", userId as string)
}

export async function deleteRemoteBundle(userId: string): Promise<void> {
    await // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from("cryptedmessage_keybundles") as any)
        .delete()
        .eq("user_id", userId as string)
}
