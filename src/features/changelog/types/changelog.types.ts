export type ChangelogVersionStatus = "draft" | "published" | "archived"

export interface ChangelogCategory {
    id: string
    name: string
    color: string
    icon: string | null
    position: number
    created_at: string
}

export interface ChangelogVersion {
    id: string
    version: string
    deployment_date: string | null
    status: ChangelogVersionStatus
    summary: string | null
    created_by: string | null
    created_at: string
    updated_at: string
}

export interface ChangelogItem {
    id: string
    version_id: string
    category_id: string
    title: string
    description: string | null
    position: number
    created_at: string
}

export interface ChangelogItemWithCategory extends ChangelogItem {
    category: ChangelogCategory
}

export interface ChangelogVersionWithItems extends ChangelogVersion {
    items: ChangelogItemWithCategory[]
}

export interface ChangelogItemInput {
    id?: string
    category_id: string
    title: string
    description: string
    position: number
}

export interface ChangelogVersionInput {
    version: string
    deployment_date: string
    status: ChangelogVersionStatus
    summary?: string
    items: ChangelogItemInput[]
}

export interface ChangelogCategoryInput {
    name: string
    color: string
    icon?: string
    position: number
}
