import { expect, test } from "@rstest/core";
import { renderHook, act } from "@testing-library/react";
import { useSelection } from "./useSelection";

test("useSelection toggles and clears selected ids", () => {
    const { result } = renderHook(() => useSelection());

    expect(result.current.selectedIds).toEqual([]);

    act(() => {
        result.current.toggle("a");
    });
    expect(result.current.selectedIds).toEqual(["a"]);

    act(() => {
        result.current.toggle("a");
        result.current.toggle("b");
    });
    expect([...result.current.selectedIds].sort()).toEqual(["b"]);

    act(() => {
        result.current.clear();
    });
    expect(result.current.selectedIds).toEqual([]);
});
