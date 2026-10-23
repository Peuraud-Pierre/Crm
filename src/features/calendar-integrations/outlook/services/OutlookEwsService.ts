import { env } from "@/shared/lib/env"

export class OutlookEwsService {
    async connect(email: string, password: string) {
        const res = await fetch(
                            env.PUBLIC_API_BASE_URL
                        +"/api/outlook/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ email, password }),
        })

        if (!res.ok) {
            throw new Error("Connexion Outlook échouée")
        }

        return res.json()
    }

    async disconnect(connectionId: string) {
        await fetch(env.PUBLIC_API_BASE_URL
                        +`/api/outlook/disconnect/${connectionId}`, {
            method: "DELETE",
            credentials: "include",
        })
    }

    async status() {
        const res = await fetch(env.PUBLIC_API_BASE_URL
                        +"/api/outlook/status", {
            credentials: "include",
        })
        return res.json()
    }
}

export const outlookEwsService = new OutlookEwsService()
