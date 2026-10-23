export interface Visit {
	idVisit: string;
	visitorId: string;
	country: string;
	countryFlag?: string;
	city?: string;
	deviceType?: string;
	browser?: string;
	operatingSystem?: string;
	referrerType?: string;
	referrerName?: string;
	visitLocalTime?: string;
	/** Début de la visite, horodatage Unix en secondes (Live.getLastVisitsDetails). */
	firstActionTimestamp?: number;
	visitIp?: string;
	actions?: number;
}

// Affiche une valeur Matomo de forme variable (texte, nombre ou objet daté)
export function safeDisplay(value: unknown): string {
	if (value == null) return "—";
	if (typeof value === "string" || typeof value === "number")
		return String(value);

	if (typeof value === "object") {
		const obj = value as Record<string, unknown>;
		return (
			(obj.prettyDate as string) ||
			(obj.referralSummary as string) ||
			(obj.date as string) ||
			JSON.stringify(obj)
		);
	}
	return "—";
}
