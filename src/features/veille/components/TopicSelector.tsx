import React, { useState } from "react"
import { useTopics, type WatchConfig } from "../hooks/useTopics"
import { Button } from "@/shared/ui/atoms/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Plus, Loader2, AlertCircle, Info, Edit2, X, Check } from "lucide-react"

interface TopicSelectorProps {
    selectedConfig?: WatchConfig
    onConfigSelect: (config: WatchConfig) => void
}

export const TopicSelector: React.FC<TopicSelectorProps> = ({
    selectedConfig,
    onConfigSelect,
}) => {
    const { configs, loading, error, createConfig, updateConfig } = useTopics()
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [editingConfig, setEditingConfig] = useState<WatchConfig | null>(null)
    const [newConfig, setNewConfig] = useState({
        name: "",
        topic: "",
        language: "français",
        horizon: "7 derniers jours",
        persona: "",
        active: true,
    })
    const [creating, setCreating] = useState(false)
    const [updating, setUpdating] = useState(false)

    const handleCreateConfig = async () => {
        if (!newConfig.name.trim() || !newConfig.topic.trim() || !newConfig.persona.trim())
            return

        try {
            setCreating(true)
            const config = await createConfig(newConfig)
            if (config) {
                onConfigSelect(config)
                setNewConfig({
                    name: "",
                    topic: "",
                    language: "français",
                    horizon: "7 derniers jours",
                    persona: "",
                    active: true,
                })
                setShowCreateForm(false)
            }
        } finally {
            setCreating(false)
        }
    }

    const handleUpdateConfig = async () => {
        if (!editingConfig || !editingConfig.name.trim() || !editingConfig.topic.trim() || !editingConfig.persona.trim())
            return

        try {
            setUpdating(true)
            const updated = await updateConfig(editingConfig.id, {
                name: editingConfig.name,
                topic: editingConfig.topic,
                language: editingConfig.language,
                horizon: editingConfig.horizon,
                persona: editingConfig.persona,
                active: editingConfig.active,
            })
            if (updated) {
                onConfigSelect(updated)
                setEditingConfig(null)
            }
        } finally {
            setUpdating(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-dashed">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Chargement des configurations...</span>
            </div>
        )
    }

    if (showCreateForm) {
        return (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/50">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Nom *</label>
                        <input
                            type="text"
                            placeholder="ex: Veille Techno"
                            value={newConfig.name}
                            onChange={(e) =>
                                setNewConfig((p) => ({ ...p, name: e.target.value }))
                            }
                            className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Topic *</label>
                        <input
                            type="text"
                            placeholder="ex: intelligence artificielle, LLMs"
                            value={newConfig.topic}
                            onChange={(e) =>
                                setNewConfig((p) => ({ ...p, topic: e.target.value }))
                            }
                            className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-sm font-medium mb-1 block">Langue</label>
                        <select
                            value={newConfig.language}
                            onChange={(e) =>
                                setNewConfig((p) => ({ ...p, language: e.target.value }))
                            }
                            className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                        >
                            <option>français</option>
                            <option>anglais</option>
                            <option>tous</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-medium mb-1 block">Horizon</label>
                        <select
                            value={newConfig.horizon}
                            onChange={(e) =>
                                setNewConfig((p) => ({ ...p, horizon: e.target.value }))
                            }
                            className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                        >
                            <option>7 derniers jours</option>
                            <option>15 derniers jours</option>
                            <option>30 derniers jours</option>
                            <option>3 derniers mois</option>
                            <option>6 derniers mois</option>
                            <option>1 an</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium mb-1 block">Persona *</label>
                    <textarea
                        placeholder="ex: expert en IA et transformation digitale"
                        value={newConfig.persona}
                        onChange={(e) =>
                            setNewConfig((p) => ({ ...p, persona: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none"
                        rows={2}
                    />
                </div>

                <div className="flex gap-2">
                    <Button
                        size="sm"
                        onClick={handleCreateConfig}
                        disabled={
                            !newConfig.name.trim() ||
                            !newConfig.topic.trim() ||
                            !newConfig.persona.trim()
                        }
                        loading={creating}
                        className="gap-2"
                    >
                        {creating ? (
                            "Création…"
                        ) : (
                            <>
                                <Plus className="h-4 w-4" />
                                Créer
                            </>
                        )}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setShowCreateForm(false)
                            setNewConfig({
                                name: "",
                                topic: "",
                                language: "français",
                                horizon: "7 derniers jours",
                                persona: "",
                                active: true,
                            })
                        }}
                    >
                        Annuler
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div className="flex items-end gap-3">
                {configs.length > 0 ? (
                    <>
                        <div className="flex-1">
                            <label className="text-sm font-medium mb-2 block">
                                Configuration de veille
                            </label>
                            <Select
                                value={selectedConfig?.id.toString() || ""}
                                onValueChange={(id) => {
                                    const config = configs.find((c) => c.id === parseInt(id))
                                    if (config) onConfigSelect(config)
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Sélectionner une configuration..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {configs.map((config) => (
                                        <SelectItem key={config.id} value={config.id.toString()}>
                                            <div className="flex items-center gap-2">
                                                <span>{config.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    ({config.topic})
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowCreateForm(true)}
                            className="gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            Nouvelle
                        </Button>
                    </>
                ) : (
                    <Button
                        size="sm"
                        onClick={() => setShowCreateForm(true)}
                        className="w-full gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Créer une première configuration
                    </Button>
                )}
            </div>

            {selectedConfig && !editingConfig && (
                <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 text-xs text-blue-700 space-y-1">
                        <p>
                            <strong>Topic:</strong> {selectedConfig.topic}
                        </p>
                        <p>
                            <strong>Langue:</strong> {selectedConfig.language} • <strong>Horizon:</strong>{" "}
                            {selectedConfig.horizon}
                        </p>
                        <p>
                            <strong>Persona:</strong> {selectedConfig.persona}
                        </p>
                    </div>
                    <button
                        onClick={() => setEditingConfig(selectedConfig)}
                        className="text-blue-600 hover:text-blue-700 flex-shrink-0"
                        title="Modifier cette configuration"
                    >
                        <Edit2 className="h-4 w-4" />
                    </button>
                </div>
            )}

            {editingConfig && (
                <div className="space-y-3 p-4 rounded-lg border bg-muted/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Nom *</label>
                            <input
                                type="text"
                                placeholder="ex: Veille Techno"
                                value={editingConfig.name}
                                onChange={(e) =>
                                    setEditingConfig((p) => (p ? { ...p, name: e.target.value } : p))
                                }
                                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Topic *</label>
                            <input
                                type="text"
                                placeholder="ex: intelligence artificielle, LLMs"
                                value={editingConfig.topic}
                                onChange={(e) =>
                                    setEditingConfig((p) => (p ? { ...p, topic: e.target.value } : p))
                                }
                                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Langue</label>
                            <select
                                value={editingConfig.language}
                                onChange={(e) =>
                                    setEditingConfig((p) => (p ? { ...p, language: e.target.value } : p))
                                }
                                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                            >
                                <option>français</option>
                                <option>anglais</option>
                                <option>tous</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Horizon</label>
                            <select
                                value={editingConfig.horizon}
                                onChange={(e) =>
                                    setEditingConfig((p) => (p ? { ...p, horizon: e.target.value } : p))
                                }
                                className="w-full px-3 py-2 rounded-lg border bg-background text-sm"
                            >
                                <option>7 derniers jours</option>
                                <option>15 derniers jours</option>
                                <option>30 derniers jours</option>
                                <option>3 derniers mois</option>
                                <option>6 derniers mois</option>
                                <option>1 an</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium mb-1 block">Persona *</label>
                        <textarea
                            placeholder="ex: expert en IA et transformation digitale"
                            value={editingConfig.persona}
                            onChange={(e) =>
                                setEditingConfig((p) => (p ? { ...p, persona: e.target.value } : p))
                            }
                            className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none"
                            rows={2}
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={handleUpdateConfig}
                            disabled={
                                !editingConfig.name.trim() ||
                                !editingConfig.topic.trim() ||
                                !editingConfig.persona.trim()
                            }
                            loading={updating}
                            className="gap-2"
                        >
                            {updating ? (
                                "Sauvegarde…"
                            ) : (
                                <>
                                    <Check className="h-4 w-4" />
                                    Sauvegarder
                                </>
                            )}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingConfig(null)}
                            disabled={updating}
                            className="gap-2"
                        >
                            <X className="h-4 w-4" />
                            Annuler
                        </Button>
                    </div>
                </div>
            )}

            {error && (
                <div className="p-3 rounded-lg border border-destructive bg-destructive/10 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-destructive">{error.message}</p>
                </div>
            )}
        </div>
    )
}
