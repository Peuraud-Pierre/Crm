import { useState, useCallback, useEffect } from "react";
import type { Balle, BalleFormInput } from "@/features/stock/types/stock.types";
import * as balleService from "@/features/stock/services/balleService";
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider";
import { toast } from "sonner"

export function useBalle() {
    const [balles, setBalles] = useState<Balle[] | undefined>();

    const {user} = useAuth()

    // FETCH ALL
    const fetchBalles = useCallback(async () => {
        try {
            const data = await balleService.fetchBalles();
            setBalles(data);
        } catch (err) {
            toast.error("Erreur lors du chargement des balles")
            console.error("[useBalle] fetchBalles:", err)
        }
    }, []);

    // FETCH SINGLE
    const fetchSingleBalle = useCallback(async (id: string) => {
        return balleService.fetchSingleBalle(id);
    }, []);

    // FETCH BY BIN
    const fetchBalleByDIN = useCallback(async (bin: string) => {
        return balleService.fetchBalleByBIN(bin);
    }, []);

    // CREATE
    const createBalle = useCallback(async (balleData: BalleFormInput) => {
        if(!user?.user_id) return null

        return balleService.insertBalle(balleData, user.user_id);
    }, [user]);

    const createMultipleBalles = useCallback(async (ballesData: BalleFormInput[]) => {
        if (!user?.user_id) return null;

        return balleService.insertMultipleBalles(ballesData, user.user_id);
    }, [user]);

    // UPDATE
    const updateBalle = useCallback(async (id: string, balleData: Partial<Balle>) => {
        await balleService.patchBalle(id, balleData);
    }, []);

    // DELETE
    const deleteBalle = useCallback(async (id: string) => {
        await balleService.removeBalle(id);
    }, []);

    useEffect(() => {
    if (!user?.user_id) return;

    // Chargement initial
    fetchBalles();

    let timeoutId: NodeJS.Timeout;

    const unsubscribe = balleService.subscribeToBalles(user.user_id, () => {
        // On intercepte TOUS les événements (INSERT, UPDATE, DELETE)
        clearTimeout(timeoutId);

        // Peu importe l'action ou la quantité d'actions simultanées,
        // on recharge la liste proprement après 500ms de calme.
        timeoutId = setTimeout(() => {
            fetchBalles();
        }, 500);
    });

    return () => {
        unsubscribe();
        clearTimeout(timeoutId);
    };
}, [user?.user_id, fetchBalles]);

    return {
        balles,
        setBalles,
        fetchBalles,
        fetchSingleBalle,
        fetchBalleByDIN,
        createBalle,
        createMultipleBalles,
        updateBalle,
        deleteBalle
    };
}
