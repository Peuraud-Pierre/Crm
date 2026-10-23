import { afterEach, beforeEach, expect, rstest, test } from "@rstest/core";

const mocks = rstest.hoisted(() => ({ signOutAction: rstest.fn() }));

rstest.mock("./auth.actions", () => ({ signOutAction: mocks.signOutAction }));

import { setupInactivityLogout } from "./auth.inactivity";

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const ONE_MINUTE = 60_000;

let stop: (() => void) | undefined;

beforeEach(() => {
    rstest.useFakeTimers();
    localStorage.clear();
    mocks.signOutAction.mockClear();
});

afterEach(() => {
    stop?.();
    stop = undefined;
    rstest.useRealTimers();
});

test("ne déconnecte pas avant le seuil", () => {
    stop = setupInactivityLogout();
    rstest.advanceTimersByTime(FOUR_HOURS - ONE_MINUTE);
    expect(mocks.signOutAction).not.toHaveBeenCalled();
});

test("déconnecte après 4 h sans activité", () => {
    stop = setupInactivityLogout();
    rstest.advanceTimersByTime(FOUR_HOURS + ONE_MINUTE);
    expect(mocks.signOutAction).toHaveBeenCalledTimes(1);
});

test("une interaction repousse le seuil", () => {
    stop = setupInactivityLogout();
    rstest.advanceTimersByTime(FOUR_HOURS - ONE_MINUTE);
    document.dispatchEvent(new Event("keydown"));
    rstest.advanceTimersByTime(FOUR_HOURS - ONE_MINUTE);
    expect(mocks.signOutAction).not.toHaveBeenCalled();
});
