import type { BalleType, PackingMode } from "@/features/stock/types/stock.types";


/**
 * DIN FORMULA: Type(4) + Fournisseur(3) + Loc(3) + Date(DDMMYY)
 */
export function generateDIN(delivery: { poids_moyen: number; fournisseur: { tag: string; siege_localisation: string }; delivery_date: Date }): string {
    try {
        const typePart = getBalleTypeFromWeight(delivery.poids_moyen).substring(0, 4).toUpperCase();
        const vendorPart = delivery.fournisseur.tag
        const locPart = getLocationTag(delivery.fournisseur.siege_localisation);
        const datePart = formatDate(delivery.delivery_date);

        return `${typePart}-${vendorPart}-${locPart}-${datePart}`;
    } catch (err) {
        console.error("Erreur DIN:", err);
        return "ERROR-DIN";
    }
}


// BIN helper function (BIN FORUMULA: DIN + index of the balle between 0 and the number of balles in the delivery + balle Category (slice 4 chars))
export function generateBIN(din: string, index: string, categoryTag: string): string {
    const paddedIndex = index.padStart(3, '0'); // Ex: 001, 012

    return `${din}-${paddedIndex}-${categoryTag}`;
}


// Get the balle type from the weight
export function getBalleTypeFromWeight(weight: number): BalleType {
    if (weight >= 5 && weight <= 49) return 'bags';
    if (weight >= 50 && weight <= 300) return 'balle';
    if (weight > 300) return 'push';

    return 'other';
}


// get location tag based on the fournisseur localisation
export function getLocationTag(localisation: string): string {
    if (!localisation) return "UNK"; // Unknown
    // On prend les 3 premières lettres en majuscules
    return localisation.substring(0, 3).toUpperCase();
}

function formatDate(date: Date): string {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear().toString();
    return `${day}${month}${year}`;
}

export const calculateAverageWeight = (packing: number, count: number): number => {
    if (count === 0 || isNaN(packing)) return 0
    return Math.round((packing / count) * 100) / 100
}

export const calculateBalleWeight = (
    mode: PackingMode,
    averageValue: number,
    categoryUnitWeight: number
): number => {
    if (mode === "pieces") {
        return Math.round(averageValue * categoryUnitWeight)
    }
    return Math.round(averageValue)
}

export const calculateWeightedAverage = (
    existingPacking: number,
    existingCount: number,
    newPacking: number,
    newCount: number
): number => {
    const totalPacking = existingPacking + newPacking
    const totalCount = existingCount + newCount
    return totalCount > 0 ? Math.round((totalPacking / totalCount) * 100) / 100 : 0
}
