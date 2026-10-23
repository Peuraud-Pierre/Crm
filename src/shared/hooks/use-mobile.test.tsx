import { expect, test } from "@rstest/core";
import { act, renderHook } from "@testing-library/react";
import { useIsMobile } from "./use-mobile";

type MatchMediaListener = () => void;

const setupMatchMedia = () => {
    const listeners = new Set<MatchMediaListener>();
    const matchMedia = (query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: (_: string, listener: MatchMediaListener) => {
            listeners.add(listener);
        },
        removeEventListener: (_: string, listener: MatchMediaListener) => {
            listeners.delete(listener);
        },
        dispatch: () => {
            listeners.forEach((listener) => listener());
        },
    });

    return { matchMedia, listeners };
};

test("useIsMobile reacts to window width changes", async () => {
    const originalMatchMedia = window.matchMedia;
    const originalInnerWidth = window.innerWidth;
    const { matchMedia, listeners } = setupMatchMedia();
    try {
        window.matchMedia = matchMedia as unknown as typeof window.matchMedia;
        window.innerWidth = 500;

        const { result } = renderHook(() => useIsMobile());

        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(result.current).toBe(true);

        act(() => {
            window.innerWidth = 1024;
            listeners.forEach((listener) => listener());
        });

        expect(result.current).toBe(false);
    } finally {
        window.matchMedia = originalMatchMedia;
        window.innerWidth = originalInnerWidth;
    }
});
