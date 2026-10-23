import { memo } from "react"
import { flagUrl } from "@/features/matomo/services/matomoService"
import { fmtReferrerType, fmtTimestamp } from "../../utils/format"
import { type Visit } from "./utils"

interface VisitItemProps {
    visit: Visit
    onSelect: (visitorId: string) => void
}

const VisitItem = memo(function VisitItem({
    visit,
    onSelect,
}: VisitItemProps) {
    const device = [
        visit.deviceType,
        [visit.browser, visit.operatingSystem && `(${visit.operatingSystem})`]
            .filter(Boolean)
            .join(" "),
    ]
        .filter(Boolean)
        .join(" • ")

    return (
        <li>
            {/* <button> et non un <li onClick> : la ligne ouvre le profil visiteur,
                elle doit donc être atteignable au clavier et montrer son focus. */}
            <button
                type="button"
                onClick={() => onSelect(visit.visitorId)}
                className="flex w-full cursor-pointer flex-col gap-1 rounded-md p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                        <span className="truncate">
                            {visit.city ? `${visit.city}, ` : ""}
                            {visit.country || "Inconnu"}
                        </span>
                        {visit.countryFlag && (
                            <img
                                src={flagUrl(visit.countryFlag)}
                                alt=""
                                className="h-4 w-5 shrink-0"
                            />
                        )}
                    </p>
                    {/* Champs facultatifs côté Matomo : on n'assemble que ceux
                        présents, sinon la ligne affichait « undefined • undefined () ». */}
                    {device && (
                        <p className="truncate text-xs text-muted-foreground">
                            {device}
                        </p>
                    )}
                </div>
                <div className="min-w-0 text-xs text-muted-foreground sm:text-right">
                    {/* Jour + heure : sur 30 jours, une heure seule ne situait pas
                        la visite. Repli sur l'heure locale du visiteur. */}
                    {(fmtTimestamp(visit.firstActionTimestamp) || visit.visitLocalTime) && (
                        <p className="tabular-nums">
                            {fmtTimestamp(visit.firstActionTimestamp) || visit.visitLocalTime}
                        </p>
                    )}
                    <p className="truncate">
                        {fmtReferrerType(visit.referrerType)}
                        {visit.referrerName && (
                            <>
                                {" via "}
                                <span className="font-medium text-foreground/80">
                                    {visit.referrerName}
                                </span>
                            </>
                        )}
                    </p>
                </div>
            </button>
        </li>
    )
})

export default VisitItem
