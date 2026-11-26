"""Verify the fifth-seat composition and the real dock wake sequence on a production build."""

import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def exercise(browser, base, width, height, reduced, shots):
    ctx = browser.new_context(
        viewport=dict(width=width, height=height),
        device_scale_factor=2,
        locale="zh-CN",
        reduced_motion="reduce" if reduced else "no-preference",
    )
    ctx.route(
        "**/api/zhihu/**", lambda r: r.fulfill(json={"items": [], "degraded": True})
    )
    ctx.route("**/api/roundtable/chat", lambda r: r.fulfill(json={"enabled": False}))
    try:
        page = ctx.new_page()
        page.goto(base, wait_until="networkidle")
        if shots and width == 1280:
            page.screenshot(path=shots / "after-home-desktop.png")
        dock = page.get_by_role("button", name="打开毛茸茸小屋")
        # Observe DOM commits, rather than sampling seven short frames via protocol polling.
        page.evaluate(
            """() => {
          window.wakeFrames = [];
          const ink = document.querySelector('.pet-ink');
          new MutationObserver(() => {
            const frame = ink.src.match(/wake(\\d)/);
            if (frame) wakeFrames.push(Number(frame[1]));
          }).observe(ink, {attributes:true, attributeFilter:['src']});
        }"""
        )
        # With the browser clock stopped, a reduced-motion open cannot depend on a timer.
        if reduced:
            page.clock.install(time="2026-01-01T10:00:00Z")
            page.clock.pause_at("2026-01-01T10:00:01Z")
        dock.evaluate(
            "el => { el.click(); if (!matchMedia('(prefers-reduced-motion: reduce)').matches) el.click(); }"
        )
        room = page.get_by_role("dialog", name="毛茸茸小屋")
        expect(room).to_be_visible()
        frames = page.evaluate("window.wakeFrames")
        assert frames == ([] if reduced else list(range(7))), (reduced, frames)
        if reduced:
            page.clock.resume()
        entry = room.get_by_role("textbox", name="我也说一句")
        entry.fill("读了好几篇，我现在只想说说。")
        room.get_by_role("button", name="发送消息").click()
        expect(room.locator('.bench-seat[data-active="true"]')).to_have_count(1)
        page.wait_for_timeout(900)  # measure after the gather-to-table handoff
        result = room.evaluate(
            """el => {
          const seats = [...el.querySelectorAll('.bench-seat')].map(b => {
            const r = b.getBoundingClientRect();
            return [b.dataset.speaker,r.top,b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))];
          });
          const bounds=el.getBoundingClientRect(), composer=el.querySelector('.chat-compose').getBoundingClientRect();
          return {seats,flow:el.querySelector('.room-flow').clientHeight, fits:bounds.top>=0 && bounds.left>=0 &&
            bounds.right<=innerWidth && bounds.bottom<=innerHeight && composer.bottom<=innerHeight && composer.top>=0,
            overflow:document.documentElement.scrollWidth-innerWidth};
        }"""
        )
        owl, cat, fox, dog = result["seats"]
        depth = min(cat[1], dog[1]) - max(owl[1], fox[1])
        assert depth >= 8, result
        assert (
            all(s[2] for s in result["seats"])
            and result["fits"]
            and result["overflow"] <= 0
            and result["flow"] >= 70
        ), result
        if shots:
            view = {880: "desktop", 844: "phone", 640: "compact", 435: "keyboard"}[
                height
            ]
            room.screenshot(path=shots / f"after-cabin-{view}.png")
        original = room.locator('.bench-seat[data-active="true"]').get_attribute(
            "data-speaker"
        )
        seat = room.locator('.bench-seat[data-speaker="owl"]')
        entry.fill("我想问个问题。")
        seat.click()
        expect(seat).to_have_attribute("data-nudged", "true")
        expect(room.locator(".chat-compose")).to_have_attribute(
            "data-addressed", "true"
        )
        expect(entry).to_have_value("考据猫头鹰，我想问个问题。")
        expect(room.locator('.bench-seat[data-active="true"]')).to_have_attribute(
            "data-speaker", original
        )
        expect(seat).to_have_attribute("data-nudged", "false")
        expect(room.locator(".chat-compose")).to_have_attribute(
            "data-addressed", "false"
        )
        print(
            f'PASS {width}x{height}, depth={depth:.1f}px, flow={result["flow"]}px, hits=4, overflow=0, wake={frames}'
        )
    finally:
        ctx.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--shots", type=Path)
    ap.add_argument("--channel", default="msedge")
    args = ap.parse_args()
    if args.shots:
        args.shots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel=args.channel)
        for w, h, reduced in [
            (1280, 880, False),
            (390, 844, True),
            (360, 640, False),
            (390, 435, True),
        ]:
            exercise(browser, args.base, w, h, reduced, args.shots)
        browser.close()
