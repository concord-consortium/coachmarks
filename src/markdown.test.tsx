import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

afterEach(() => {
  document.body.innerHTML = "";
});

function renderInto(node: ReturnType<typeof renderMarkdown>) {
  const { container } = render(<div data-testid="md">{node}</div>);
  return container.querySelector('[data-testid="md"]') as HTMLElement;
}

describe("renderMarkdown", () => {
  it("returns plain text unchanged when there is no markup", () => {
    expect(renderMarkdown("just text")).toBe("just text");
  });

  it("wraps **bold** spans in <strong>", () => {
    const el = renderInto(renderMarkdown("run the **model** first"));
    const strong = el.querySelector("strong");
    expect(strong?.textContent).toBe("model");
    expect(el.textContent).toBe("run the model first");
  });

  it("supports __bold__ as an alternate delimiter", () => {
    const el = renderInto(renderMarkdown("__Scroll up!__"));
    expect(el.querySelector("strong")?.textContent).toBe("Scroll up!");
  });

  it("handles multiple bold spans in one string", () => {
    const el = renderInto(renderMarkdown("**a** and **b**"));
    expect(el.querySelectorAll("strong").length).toBe(2);
    expect(el.textContent).toBe("a and b");
  });

  it("escapes HTML — markup in the source renders as literal text, not DOM", () => {
    const el = renderInto(
      renderMarkdown('hi <img src=x onerror="1"> **bold**'),
    );
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector("strong")?.textContent).toBe("bold");
    expect(el.textContent).toBe('hi <img src=x onerror="1"> bold');
  });

  it("leaves an unmatched delimiter as literal text", () => {
    const el = renderInto(renderMarkdown("a ** b"));
    expect(el.querySelector("strong")).toBeNull();
    expect(el.textContent).toBe("a ** b");
  });

  it("does not treat empty delimiters (****) as bold", () => {
    const el = renderInto(renderMarkdown("****"));
    expect(el.querySelector("strong")).toBeNull();
    expect(el.textContent).toBe("****");
  });
});
