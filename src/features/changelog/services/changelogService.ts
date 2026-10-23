// Couche service de la feature changelog — tables changelog_versions,
// changelog_items et changelog_categories (docs/Architecture_Feature.pdf §5).
// Seul endroit de la feature autorisé à importer le client Supabase.
//
// Différence avec le service qu'il remplace : les fonctions résolvent une
// valeur ou lèvent, au lieu de renvoyer le `{ data, error }` brut de
// supabase-js. C'est la convention des services récents (tickets,
// administration) et c'est ce qui a permis au hook appelant de perdre les
// messages d'erreur dans des `catch {}` vides.
import { supabase } from "@/integrations/supabase/client"
import type {
    ChangelogCategory,
    ChangelogCategoryInput,
    ChangelogItemInput,
    ChangelogVersionStatus,
    ChangelogVersionWithItems,
} from "../types/changelog.types"

const VERSION_SELECT = `
    *,
    items:changelog_items (
        *,
        category:changelog_categories (*)
    )
`

/* ============================
   Catégories
============================ */

export async function fetchCategories(): Promise<ChangelogCategory[]> {
    const { data, error } = await supabase
        .from("changelog_categories")
        .select("*")
        .order("position", { ascending: true })

    if (error) throw error
    return (data ?? []) as unknown as ChangelogCategory[]
}

export async function insertCategory(
    input: ChangelogCategoryInput
): Promise<void> {
    const { error } = await supabase.from("changelog_categories").insert({
        name: input.name,
        color: input.color,
        icon: input.icon ?? null,
        position: input.position,
    })
    if (error) throw error
}

export async function updateCategory(
    categoryId: string,
    input: Partial<ChangelogCategoryInput>
): Promise<void> {
    const { error } = await supabase
        .from("changelog_categories")
        .update(input)
        .eq("id", categoryId)
    if (error) throw error
}

export async function deleteCategory(categoryId: string): Promise<void> {
    const { error } = await supabase
        .from("changelog_categories")
        .delete()
        .eq("id", categoryId)
    if (error) throw error
}

/* ============================
   Versions
============================ */

export async function fetchVersionsWithItems(): Promise<
    ChangelogVersionWithItems[]
> {
    const { data, error } = await supabase
        .from("changelog_versions")
        .select(VERSION_SELECT)
        .order("deployment_date", { ascending: false, nullsFirst: false })

    if (error) throw error

    // Les éléments arrivent dans l'ordre d'insertion : on les remet dans
    // l'ordre d'affichage (position de la catégorie, puis de l'élément).
    return ((data ?? []) as unknown as ChangelogVersionWithItems[]).map(
        (v) => ({
            ...v,
            items: [...(v.items ?? [])].sort(
                (a, b) =>
                    (a.category?.position ?? 0) - (b.category?.position ?? 0) ||
                    (a.position ?? 0) - (b.position ?? 0)
            ),
        })
    )
}

/**
 * Dernière version publiée, en une seule ligne.
 *
 * Utilisée par la sidebar pour afficher le numéro de version de
 * l'application. Elle chargeait auparavant l'intégralité du changelog —
 * versions, éléments et catégories — pour n'en garder qu'un numéro, et ce
 * pour chaque utilisateur à chaque ouverture.
 *
 * Le tri est fait par `deployment_date` côté serveur : trier en SemVer
 * demanderait de tout rapatrier, ce qui est exactement ce qu'on évite ici.
 */
export async function fetchLatestPublishedVersion(): Promise<string | null> {
    const { data, error } = await supabase
        .from("changelog_versions")
        .select("version")
        .eq("status", "published")
        .order("deployment_date", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()

    if (error) throw error
    return data?.version ?? null
}

export async function insertVersion(input: {
    version: string
    deployment_date: string
    status: ChangelogVersionStatus
    summary: string | null
    created_by: string | null
}): Promise<string> {
    const { data, error } = await supabase
        .from("changelog_versions")
        .insert(input)
        .select("id")
        .single()

    if (error) throw error
    return (data as { id: string }).id
}

export async function updateVersion(
    versionId: string,
    updates: {
        version?: string
        deployment_date?: string
        status?: ChangelogVersionStatus
        summary?: string | null
    }
): Promise<void> {
    const { error } = await supabase
        .from("changelog_versions")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", versionId)
    if (error) throw error
}

export async function deleteVersion(versionId: string): Promise<void> {
    const { error } = await supabase
        .from("changelog_versions")
        .delete()
        .eq("id", versionId)
    if (error) throw error
}

/* ============================
   Éléments
============================ */

function toItemRows(versionId: string, items: ChangelogItemInput[]) {
    return items.map((item, index) => ({
        version_id: versionId,
        category_id: item.category_id,
        title: item.title,
        description: item.description || null,
        position: index,
    }))
}

export async function insertItems(
    versionId: string,
    items: ChangelogItemInput[]
): Promise<void> {
    if (items.length === 0) return

    const { error } = await supabase
        .from("changelog_items")
        .insert(toItemRows(versionId, items))
    if (error) throw error
}

/**
 * Remplace tous les éléments d'une version, en une seule transaction.
 *
 * L'ancien code faisait un DELETE puis un INSERT en deux requêtes
 * PostgREST, donc deux transactions : un échec entre les deux laissait la
 * version vide et le contenu perdu, sans que rien ne le signale. La
 * fonction Postgres `changelog_replace_items` (migration 20260824106000)
 * fait les deux ensemble, sous la RLS de l'appelant.
 */
export async function replaceItems(
    versionId: string,
    items: ChangelogItemInput[]
): Promise<void> {
    const { error } = await supabase.rpc("changelog_replace_items", {
        p_version_id: versionId,
        p_items: toItemRows(versionId, items),
    })
    if (error) throw error
}
