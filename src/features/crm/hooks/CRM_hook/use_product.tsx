import { subscribeToTable } from "@/features/crm/services/realtimeService"
import { useCallback, useEffect, useState } from "react"
import {
    createProduct,
    fetchProducts,
    updateProduct,
    deleteProduct,
} from "@/features/crm/services/productService"

// --- Types re-exportés depuis le fichier de types partagés ---
export type { Product } from "@/features/crm/types"
import type { Product } from "@/features/crm/types"

export function useProduct(enabled: boolean = true) {
    const [Produit, setProduit] = useState<Product[]>([])

    // 🔹 Déduplication des produits par id
    const deduplicateProducts = (products: Product[]) => {
        const map = new Map<number | string, Product>()
        products.forEach((p, index) => {
            const key = p.id ?? `tmp-${index}` // fallback si pas d'id
            map.set(key, p)
        })
        return Array.from(map.values())
    }

    // 🔹 Création d'un produit
    const create_product = async (product: Product) => {
        try {
            await createProduct(product)
        } catch (error) {
            console.error("❌ erreur lors de la création du produit", error)
        }
    }

    // 🔹 Récupération des produits
    const fetch_products = async (): Promise<Product[] | undefined> => {
        try {
            const data = await fetchProducts()
            setProduit(deduplicateProducts(data))
            return data
        } catch (error) {
            console.error(
                "❌ erreur lors de la récupération des produits",
                error
            )
            return undefined
        }
    }

    // 🔹 Mise à jour d'un produit
    const update_product = async (id: number, updates: Partial<Product>) => {
        if (id === 0) return
        try {
            await updateProduct(id, updates)
            setProduit((prev) =>
                prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
            )
        } catch (error) {
            console.error(
                "❌ erreur lors de la mise à jour du produit :",
                error
            )
        }
    }

    // 🔹 Suppression d'un produit
    const delete_product = async (id: number) => {
        try {
            await deleteProduct(id)
            setProduit((prev) => prev.filter((p) => p.id !== id))
        } catch (error) {
            console.error("❌ erreur lors de la suppression du produit", error)
        }
    }

    // 🔹 Rafraîchissement complet (useCallback → référence stable pour le useEffect Realtime)
    const refreshProducts = useCallback(async () => {
        const products = await fetch_products()
        if (products) setProduit(deduplicateProducts(products))
    // fetch_products et deduplicateProducts sont des fonctions sans dépendances
    // d'état — pas besoin de les lister ici.
    }, [])

    // 🔹 Realtime — uniquement quand le flux produits/devis est actif.
    // Sur l'onglet Clients, `enabled` est false : on ne charge pas toute la
    // table `product` et on ne monte aucun des 3 channels.
    useEffect(() => {
        if (!enabled) return
        refreshProducts()

        // Channel Product
        const unsubscribeProduct = subscribeToTable<Product>(
            "realtime:product",
            "product",
            undefined,
            ({ eventType, newRow, oldRow }) => {
                // Cast : la ligne Realtime est complète pour INSERT/UPDATE.
                const newProd = newRow as Product
                const oldProd = oldRow as Product

                setProduit((prev) => {
                    switch (eventType) {
                        case "INSERT":
                            return deduplicateProducts([...prev, newProd])
                        case "UPDATE":
                            return deduplicateProducts(
                                prev.map((p) =>
                                    p.id === newProd.id ? newProd : p
                                )
                            )
                        case "DELETE":
                            return prev.filter((p) => p.id !== oldProd.id)
                        default:
                            return prev
                    }
                })
            }
        )

        // Channel Fournisseur
        const unsubscribeFournisseur = subscribeToTable(
            "realtime:fournisseur",
            "fournisseur_crm",
            undefined,
            refreshProducts
        )

        // Plus de channel sur `Type_product_CRM` (config quasi statique, retirée
        // de la publication Realtime) : les changements de type sont rares et
        // repris au prochain refresh / montage.

        return () => {
            unsubscribeProduct()
            unsubscribeFournisseur()
        }
    }, [enabled, refreshProducts])

    return {
        Produit,
        create_product,
        fetch_products,
        delete_product,
        update_product,
        refreshProducts,
    }
}
