import { describe, it, expect, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { useDocumentTitle } from "./useDocumentTitle";

describe("useDocumentTitle", () => {
  afterEach(() => {
    cleanup();
    document.title = "";
  });

  it("aplica o título recebido seguido de '· Pólia'", () => {
    renderHook(() => useDocumentTitle("Planner"));
    expect(document.title).toBe("Planner · Pólia");
  });

  it("não duplica '· Pólia' quando o título já o contém", () => {
    renderHook(() => useDocumentTitle("Pólia"));
    expect(document.title).toBe("Pólia");
  });

  it("atualiza document.title quando o título muda entre renders", () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: "Financeiro" },
    });
    expect(document.title).toBe("Financeiro · Pólia");

    rerender({ title: "Metas" });
    expect(document.title).toBe("Metas · Pólia");
  });

  it("restaura o título anterior ao desmontar (cleanup do efeito)", () => {
    document.title = "Título original";
    const { unmount } = renderHook(() => useDocumentTitle("Planner"));
    expect(document.title).toBe("Planner · Pólia");

    unmount();
    expect(document.title).toBe("Título original");
  });
});
