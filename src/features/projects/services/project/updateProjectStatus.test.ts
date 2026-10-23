import { beforeEach, expect, rstest, test } from "@rstest/core";

import type { ProjectStatus } from "@/features/projects/types";

const mocks = rstest.hoisted(() => {
    const update = rstest.fn();
    const eq = rstest.fn();
    const select = rstest.fn();
    const maybeSingle = rstest.fn();
    const from = rstest.fn(() => ({ update }));
    const rpc = rstest.fn();
    const toast = { error: rstest.fn(), success: rstest.fn() };

    update.mockReturnValue({ eq });
    eq.mockReturnValue({ select });
    select.mockReturnValue({ maybeSingle });

    return { update, eq, maybeSingle, from, rpc, toast };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: {
        from: mocks.from,
        rpc: mocks.rpc,
    },
}));

rstest.mock("sonner", () => ({
    toast: mocks.toast,
}));

import { updateProjectStatus } from "./updateProjectStatus";

beforeEach(() => {
    rstest.clearAllMocks();
});

test("updateProjectStatus updates team and notifies", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: "team-1" }, error: null });

    const sendProjectNotifications = rstest.fn();
    const fetchBoards = rstest.fn();
    const broadcastRefresh = rstest.fn();

    const result = await updateProjectStatus({
        teamId: "team-1",
        status: "archived" as ProjectStatus,
        memberIds: ["user-1", "user-2"],
        projectName: "Projet A",
        actorName: "Alice",
        sendProjectNotifications,
        fetchBoards,
        broadcastRefresh,
    });

    expect(result).toEqual({ success: true });
    expect(sendProjectNotifications).toHaveBeenCalledWith(
        expect.objectContaining({
            userIds: ["user-1", "user-2"],
            title: "Projet terminé",
        })
    );
    expect(mocks.toast.success).toHaveBeenCalledWith("Projet archivé");
    expect(fetchBoards).toHaveBeenCalled();
    expect(broadcastRefresh).toHaveBeenCalled();
});
