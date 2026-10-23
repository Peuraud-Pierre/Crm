import { useState } from "react"
import { Smartphone, Calendar } from "lucide-react"
import {
    getDeviceInfo,
    setDeviceName,
    type DeviceInfo,
} from "../../core/deviceInfo"


export function DeviceInfoPanel() {
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() =>
        getDeviceInfo()
    )
    const [editing, setEditing] = useState(false)
    const [newName, setNewName] = useState(() => getDeviceInfo().name)

    const handleSave = () => {
        if (newName.trim()) {
            setDeviceName(newName.trim())
            setDeviceInfo({ ...deviceInfo, name: newName.trim() })
        }
        setEditing(false)
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-card p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-light">
                        <Smartphone className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Cet appareil
                        </div>
                        {editing ? (
                            <div className="mt-1 flex items-center gap-2">
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="rounded border border-slate-300 bg-card px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSave()
                                        if (e.key === "Escape") {
                                            setEditing(false)
                                            setNewName(deviceInfo.name)
                                        }
                                    }}
                                />
                                <button
                                    onClick={handleSave}
                                    className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
                                >
                                    ✓
                                </button>
                                <button
                                    onClick={() => {
                                        setEditing(false)
                                        setNewName(deviceInfo.name)
                                    }}
                                    className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                                {deviceInfo.name}
                                <button
                                    onClick={() => setEditing(true)}
                                    className="text-xs text-primary hover:text-primary-hover dark:text-primary-light"
                                >
                                    ✏️
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                        {deviceInfo.isNew
                            ? "Nouvel appareil (première utilisation)"
                            : deviceInfo.firstUse
                              ? `Utilisé depuis le ${deviceInfo.firstUse.toLocaleDateString("fr-FR")}`
                              : "Appareil connu"}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-slate-400">ID:</span>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        {deviceInfo.id.substring(0, 12)}...
                    </code>
                </div>
            </div>

            {deviceInfo.isNew && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 dark:border-primary/30 dark:bg-primary/10">
                    <p className="text-xs font-medium text-primary dark:text-primary-light">
                        💡 C&apos;est la première fois que tu utilises la
                        messagerie chiffrée sur cet appareil !
                    </p>
                    <p className="mt-1 text-xs text-primary/80 dark:text-primary-light/80">
                        Si tu as déjà des messages sur un autre appareil, entre
                        ton code PIN pour les récupérer.
                    </p>
                </div>
            )}
        </div>
    )
}
