import { describe, it, expect, rstest } from "@rstest/core"

const channelSpy = rstest.fn<(topic: string) => void>()

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        channel: (topic: string) => {
            channelSpy(topic)
            return {
                on: rstest.fn().mockReturnThis(),
                subscribe: rstest.fn().mockReturnThis(),
            }
        },
        removeChannel: rstest.fn(),
    },
}))

const { subscribeToGroupMembers } = await import("./groupsService")

describe("subscribeToGroupMembers", () => {
    const groupId = "group-1"

    it("nomme des canaux distincts pour deux consommateurs du même groupe", () => {
        channelSpy.mockClear()

        // `useCryptedGroupChat` (clés publiques) puis `useGroupMembers`
        // (profils) s'abonnent tous deux à ce groupe.
        const stopKeys = subscribeToGroupMembers(groupId, () => {})
        const stopProfiles = subscribeToGroupMembers(groupId, () => {})

        const topics = channelSpy.mock.calls.map((call: unknown[]) => call[0])
        expect(topics).toHaveLength(2)
        // Le vrai invariant : deux noms identiques feraient renvoyer par
        // `supabase.channel()` le canal DÉJÀ souscrit du premier appelant, et
        // le `.on()` du second lèverait « cannot add postgres_changes
        // callbacks after subscribe() ».
        expect(new Set(topics).size).toBe(2)

        stopKeys()
        stopProfiles()
    })

    it("garde le nom de base lisible pour le débogage", () => {
        channelSpy.mockClear()
        subscribeToGroupMembers(groupId, () => {})()
        expect(String(channelSpy.mock.calls[0][0])).toContain(
            `cryptedmessage-group-members-${groupId}`
        )
    })
})
