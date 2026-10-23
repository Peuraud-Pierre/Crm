/*
 * Module push notifications pour Nokk_project
 * Fusionné automatiquement dans sw.js au build
 */

self.addEventListener("push", (event) => {
    if (!event.data) return

    let payload

    try {
        payload = event.data.json()
    } catch {
        payload = {
            title: "Nokk_project",
            body: event.data.text(),
        }
    }

    const {
        title = "Nokk_project",
        body = "Nouvelle notification",
        icon = "/nokk_project_logo.svg",
        badge = "/nokk_project_logo.svg",
        url,
        actions,
        tag,
        data,
    } = payload || {}

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon,
            badge,
            tag,
            actions,
            data: {
                url,
                ...(data ?? {}),
            },
        })
    )
})

self.addEventListener("notificationclick", (event) => {
    event.notification.close()

    const targetUrl = event.notification.data?.url
    if (!targetUrl) return

    const absoluteUrl = new URL(targetUrl, self.location.origin).href

    event.waitUntil(
        (async () => {
            const clientsList = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            })

            // Onglet de l'app déjà ouvert : on le focus PUIS on le navigue vers
            // l'URL cible (le query ?user= change → l'app ouvre la bonne conv).
            for (const client of clientsList) {
                if (client.url.startsWith(self.location.origin)) {
                    await client.focus()
                    if ("navigate" in client) {
                        try {
                            await client.navigate(absoluteUrl)
                        } catch {
                            /* navigation cross-doc refusée : on garde le focus */
                        }
                    }
                    return
                }
            }

            // Sinon : nouvelle fenêtre sur l'URL cible.
            if (self.clients.openWindow) {
                return self.clients.openWindow(absoluteUrl)
            }
        })()
    )
})
