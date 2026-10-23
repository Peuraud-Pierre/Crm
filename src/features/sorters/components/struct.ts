export interface SortingReport {
    id?: string | ""
    created_at?: string
    uid_balle: string
    user_id: string
    fournisseur_uid: string
    category: string
    mag_piece?: number | null
    mag_kg?: number | null
    export_piece?: number | null
    export_kg?: number | null
    so3_piece?: number | null
    so3_kg?: number | null
    kssummer_piece?: number | null
    kssummer_kg?: number | null
    kswinter_piece?: number | null
    kswinter_kg?: number | null
    client_piece?: number | null
    client_kg?: number | null
    time: string | null
    quantity: number
    comments: string | null
    quality: number
    profiles?: {
        full_name: string
        email: string
        avatar_url: string
    } | null
    updated_at: string | "00:00:00 - 00/00/0000"
}

export interface FormStruct {
    category: string
    fournisseur_uid: string
    mag: number
    kssummer: number
    kswinter: number
    so3: number
    export: number
    client: number
    quantity: number
    quality: number
    comments: string
}

export interface SortersProps {
    userId: string
    adminView: boolean
}

export interface TableProps {
    filteredReports: SortingReport[]
    setEditing: React.Dispatch<React.SetStateAction<SortingReport>>
    setForm: React.Dispatch<React.SetStateAction<FormStruct>>
    setOpenForm: React.Dispatch<React.SetStateAction<boolean>>
}

export interface openEditFormProps {
    setEditing: React.Dispatch<React.SetStateAction<SortingReport>>
    setForm: React.Dispatch<React.SetStateAction<FormStruct>>
    setOpenForm: React.Dispatch<React.SetStateAction<boolean>>
    report: SortingReport
}

export interface ModalsProps {
    openForm: boolean
    setOpenForm: React.Dispatch<React.SetStateAction<boolean>>
    editing: SortingReport
    setForm: React.Dispatch<
        React.SetStateAction<{
            category: string
            fournisseur_uid: string
            mag: number
            ks: number
            so3: number
            export: number
            client: number
            quantity: number
            quality: number
            comments: string
        }>
    >
    form: FormStruct
    saving: boolean
    setSaving: React.Dispatch<React.SetStateAction<boolean>>
    userId: string
}

export interface handleSaveProps {
    setSaving: React.Dispatch<React.SetStateAction<boolean>>
    editing: SortingReport
    setOpenForm: React.Dispatch<React.SetStateAction<boolean>>
    userId: string
    form: FormStruct
}

export interface fetchReportsProps {
    setLoading: React.Dispatch<React.SetStateAction<boolean>>
    adminView: boolean
    userId: string
    setReports: React.Dispatch<React.SetStateAction<SortingReport[]>>
}
