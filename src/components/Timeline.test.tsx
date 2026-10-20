import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Timeline, type TimelineSection } from "./Timeline";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const sections: TimelineSection[] = [
  {
    key: "common",
    title: "방 공통",
    tasks: [{ id: "t1", title: "주제 정하기", start_date: "2026-11-01", due_date: "2026-11-02", status: "done", assigneeName: "민준" }],
  },
  {
    key: "g1",
    title: "1모둠",
    tasks: [
      { id: "t2", title: "사진 찍기", start_date: "2026-11-03", due_date: "2026-11-04", status: "doing", assigneeName: "서연" },
      { id: "t3", title: "늦은 일", start_date: null, due_date: "2026-11-04", status: "todo", assigneeName: null },
      { id: "t4", title: "언젠가 할 일", start_date: null, due_date: null, status: "todo", assigneeName: null },
    ],
  },
];

describe("Timeline", () => {
  afterEach(cleanup);

  it("막대 위치·상태 색·기한 지남·오늘 선·구역을 그린다", () => {
    render(
      <Timeline rangeStart="2026-11-01" rangeEnd="2026-11-10" today="2026-11-06" sections={sections} taskHref={(id) => `/p/x/tasks/${id}`} />,
    );
    const bars = screen.getAllByTestId("timeline-bar");
    expect(bars).toHaveLength(3);
    expect(bars[0].style.left).toBe("0%");
    expect(bars[0].style.width).toBe("20%");
    expect(bars[0].dataset.status).toBe("done");
    expect(bars[0].className).toContain("bg-green-500");
    expect(bars[1].style.left).toBe("20%");
    expect(bars[1].className).toContain("bg-blue-500");
    expect(bars[2].dataset.overdue).toBe("true");
    expect(bars[2].textContent).toBe("미배정");
    expect(bars[1].getAttribute("href")).toBe("/p/x/tasks/t2");

    const today = screen.getByTestId("timeline-today");
    expect(today.style.left).toContain("0.55");

    expect(screen.getByTestId("timeline-section-common").textContent).toContain("방 공통");
    expect(screen.getByTestId("timeline-section-g1").textContent).toContain("1모둠");
    expect(within(screen.getByTestId("timeline-undated")).getByText("언젠가 할 일")).toBeTruthy();
  });

  it("기간 밖이면 오늘 선이 없다", () => {
    render(<Timeline rangeStart="2026-11-01" rangeEnd="2026-11-10" today="2026-12-01" sections={sections} taskHref={(id) => id} />);
    expect(screen.queryByTestId("timeline-today")).toBeNull();
  });
});
