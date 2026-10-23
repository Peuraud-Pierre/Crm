import { expect, rstest, test } from "@rstest/core";
import { act, renderHook } from "@testing-library/react";

const mocks = rstest.hoisted(() => {
    let handler: ((payload: { new: Record<string, unknown> }) => void) | null = null;
    const channel = {
        on: rstest.fn((_event: string, _filter: Record<string, unknown>, cb: (payload: { new: Record<string, unknown> }) => void) => {
            handler = cb;
            return channel;
        }),
        subscribe: rstest.fn(() => channel),
        unsubscribe: rstest.fn(),
        __getHandler: () => handler,
    };
    const supabase = {
        channel: rstest.fn(() => channel),
    };
    return { channel, supabase };
});

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: mocks.supabase,
}));

import { useWaitForContentGeneration } from "./useWaitForContentGeneration";

test("useWaitForContentGeneration triggers onDone for completed rows", async () => {
    const onDone = rstest.fn();
    const onError = rstest.fn();

    renderHook(() =>
        useWaitForContentGeneration({
            userId: "user-1",
            onDone,
            onError,
        })
    );

    const handler = mocks.channel.__getHandler();
    if (!handler) {
        throw new Error("Missing realtime handler");
    }

    act(() => {
        handler({
            new: { status: "done", video_url: "https://x/video.mp4" },
        });
    });

    expect(onDone).toHaveBeenCalledWith("https://x/video.mp4", true);
    expect(onError).not.toHaveBeenCalled();
});

test("useWaitForContentGeneration reports errors", async () => {
    const onDone = rstest.fn();
    const onError = rstest.fn();
    const consoleError = console.error;
    console.error = () => {};

    renderHook(() =>
        useWaitForContentGeneration({
            userId: "user-1",
            onDone,
            onError,
        })
    );

    const handler = mocks.channel.__getHandler();
    if (!handler) {
        throw new Error("Missing realtime handler");
    }

    act(() => {
        handler({
            new: { status: "done", get video_url() { throw new Error("boom"); } },
        });
    });

    expect(onError).toHaveBeenCalled();
    console.error = consoleError;
});
