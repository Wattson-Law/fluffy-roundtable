"""Bounded interactive stress; every upstream is intercepted. No model quota or real reader history."""

from round_chat_locators import latest_pet
import argparse
import asyncio
import json
import time
from collections import Counter
from urllib.parse import urlsplit
from playwright.async_api import async_playwright, expect, Error

FACT = "狗狗，刚读那篇用了哪两种颜色？分别拿来做什么？"
TITLE = "两张书签，留下两种读法"


def btn(p, text):
    return p.get_by_role("button", name=text, exact=True)


async def reader(browser, base, i, burst):
    token = f"访客[{i}]"
    ctx = await browser.new_context(
        reduced_motion="reduce",
        viewport={"width": 390 if i % 2 else 1200, "height": 820},
    )
    p = await ctx.new_page()
    packets, errors, analyze = [], [], []
    events, releases = {}, {}

    def event(pool, k):
        return pool.setdefault(k, asyncio.Event())

    def msg(text):
        return token + text

    async def fixture(route):
        if route.request.method == "GET":
            return await route.fulfill(json={"enabled": True, "model": "压力替身"})
        packet = route.request.post_data_json
        packets.append(packet)
        s = packet["turns"][-1]["text"]
        event(events, s).set()
        if packet["mode"] == "reader" and "暂缓" in s:
            await event(releases, s).wait()
        try:
            if "拥挤" in s:
                return await route.fulfill(status=429, json={"error": "busy"})
            if "限流" in s:
                return await route.fulfill(status=429, json={"error": "limited"})
            if "超时" in s:
                return await route.fulfill(status=504, json={"error": "timeout"})
            if "坏格式" in s:
                return await route.fulfill(json={"source": "model", "reply": {}})
            await route.fulfill(
                json={
                    "source": "model",
                    "model": "压力替身",
                    "reply": {
                        "speaker": "owl" if packet["mode"] == "handoff" else "shiba",
                        "text": ("接：" if packet["mode"] == "handoff" else "答：") + s,
                    },
                }
            )
        except Error:
            pass  # browser has already aborted superseded work

    async def no_analyze(route):
        analyze.append(1)
        await route.fulfill(status=503, json={})

    await ctx.route(
        "**/api/zhihu/**",
        lambda r: r.fulfill(json={"live": False, "degraded": True, "items": []}),
    )
    await ctx.route("**/api/roundtable/analyze", no_analyze)
    await ctx.route("**/api/roundtable/chat", fixture)
    p.on("pageerror", lambda e: errors.append(str(e)))
    room = p.get_by_role("dialog", name="毛茸茸小屋")
    bubble = latest_pet(room)
    entry = room.get_by_role("textbox", name="我也说一句")

    async def send(s):
        await entry.fill(s)
        await btn(room, "发送消息").click()

    async def posted(s):
        await send(s)
        await asyncio.wait_for(event(events, s).wait(), 4)

    async def pin():
        await btn(room, "把这段放上桌").click()

    try:
        await p.goto(base + "/?sample=two-bookmarks")
        await expect(p.get_by_text("看山已记下", exact=True)).to_be_visible(
            timeout=10000
        )
        await btn(p, "打开毛茸茸小屋").click()
        await expect(btn(room, "把这段放上桌")).to_be_visible(timeout=4000)
        preview = await room.locator(".table-reading q").text_content()
        assert "我同意" in preview
        await send(FACT)
        await expect(bubble.locator(".voice-source")).to_have_text("本机回复")
        assert not packets
        await pin()
        assert not packets
        one = msg("暂缓草稿")
        await posted(one)
        await entry.fill(msg("尚未发送的第二句"))
        event(releases, one).set()
        await expect(bubble.locator(".message-bubble")).to_have_text("答：" + one)
        await expect(entry).to_have_value(msg("尚未发送的第二句"))
        await entry.fill("")
        await btn(room, "听另一位接话").click()
        await expect(bubble.locator(".message-bubble")).to_have_text("接：答：" + one)
        for packet in packets:
            assert (
                "reading" not in packet
            ), packet  # A neutral interruption/handoff needs no passage.
        delays = []
        for n in range(burst):
            s = msg(f"暂缓连发{n}")
            await posted(s)
            delays.append(s)
        end = msg("最新一句")
        await posted(end)
        await expect(bubble.locator(".message-bubble")).to_have_text("答：" + end)
        for s in reversed(delays):
            event(releases, s).set()
        # Withdrawing is a new sharing boundary, even during a pending answer.
        pending = msg("暂缓撤下")
        await posted(pending)
        await btn(room, "撤下原句").click()
        event(releases, pending).set()
        safe = msg("不带摘录聊")
        await posted(safe)
        await expect(bubble.locator(".message-bubble")).to_have_text("答：" + safe)
        assert packets[-1] == {
            "mode": "reader",
            "turns": [{"speaker": "user", "text": safe}],
        }, packets[-1]
        for label, notice in [
            ("拥挤", "没有排队"),
            ("限流", "额度"),
            ("超时", "超时"),
            ("坏格式", "格式"),
        ]:
            await posted(msg(label))
            await expect(bubble.locator(".voice-source")).to_have_text("本机兜底")
            await expect(room.locator(".room-error")).to_contain_text(notice)
        await pin()
        keep = msg("我不想换个话题，还想聊这段里的书签。")
        await posted(keep)
        await expect(bubble.locator(".message-bubble")).to_have_text("答：" + keep)
        assert packets[-1].get("reading") == {"title": TITLE, "excerpt": preview}
        count = len(packets)
        await send("原文别发给模型。")
        await expect(bubble.locator(".voice-source")).to_have_text("本机回复")
        await expect(bubble.locator(".message-bubble")).to_contain_text("不再带")
        await expect(btn(room, "把这段放上桌")).to_be_visible()
        assert len(packets) == count
        await pin()
        switch = msg(
            "咱们聊点别的吧，我想聊跑步" if i % 2 else "这篇先不聊了，我想聊聊面试。"
        )
        await posted(switch)
        await expect(bubble.locator(".message-bubble")).to_have_text("答：" + switch)
        assert packets[-1] == {
            "mode": "reader",
            "turns": [{"speaker": "user", "text": switch}],
        }
        await expect(btn(room, "把这段放上桌")).to_be_visible()
        await pin()
        folded = msg("暂缓收屋")
        await posted(folded)
        await btn(room, "关闭小屋").click()
        event(releases, folded).set()
        await btn(p, "打开毛茸茸小屋").click()
        await expect(btn(room, "把这段放上桌")).to_be_visible()
        log = room.get_by_role("log")
        for s in delays + [pending, folded]:
            await expect(log).not_to_contain_text("答：" + s)
        await btn(room, "关闭小屋").click()
        await btn(p, "返回热榜").click()
        await btn(p, "一页笔记，什么时候才算读完？").click()
        await expect(btn(p, "阅读记录（2篇）")).to_be_visible(timeout=10000)
        await btn(p, "打开毛茸茸小屋").click()
        await expect(room.locator(".room-context b")).to_have_text(
            "一页笔记，什么时候才算读完？"
        )
        await expect(btn(room, "把这段放上桌")).to_be_visible()
        await pin()
        after = msg("，聊聊这篇的写法。")
        await posted(after)
        await expect(bubble.locator(".message-bubble")).to_have_text("答：" + after)
        assert (
            packets[-1]["reading"]["title"] != TITLE and len(packets[-1]["turns"]) == 1
        )
        await p.reload()
        await btn(p, "打开毛茸茸小屋").click()
        await expect(btn(room, "把这段放上桌")).to_be_visible()
        assert not errors and not analyze, (errors, analyze)
        assert all(1 <= len(x["turns"]) <= 7 for x in packets)
        assert max(len(x["turns"]) for x in packets) == 7
        assert all(
            "访客[" not in t["text"].replace(token, "")
            for x in packets
            for t in x["turns"]
        )
        assert await p.evaluate("document.documentElement.scrollWidth <= innerWidth")
        return Counter(requests=len(packets), late=burst + 2, fallbacks=4, readers=1)
    except Exception:
        try:
            print(
                "Reader",
                i,
                "packets",
                len(packets),
                "page",
                await asyncio.wait_for(
                    p.evaluate(
                        """() => ({width:innerWidth, visibility:document.visibilityState, modal:document.querySelector('dialog[open]')?.getAttribute('aria-label'), input:document.querySelector('.chat-compose input')?.getBoundingClientRect().toJSON()})"""
                    ),
                    2,
                ),
                flush=True,
            )
        except (Error, asyncio.TimeoutError):
            pass
        raise
    finally:
        for s in events:
            event(releases, s).set()
        await ctx.close()


async def main(a):
    assert (
        urlsplit(a.base).hostname in ("127.0.0.1", "localhost", "::1")
        and 1 <= a.readers <= 8
        and 5 <= a.burst <= 16
        and 1 <= a.parallel <= 6
    )
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="msedge")
        start = time.perf_counter()
        try:
            slots = asyncio.Semaphore(a.parallel)

            async def limited(i):
                async with slots:
                    r = await asyncio.wait_for(
                        reader(browser, a.base.rstrip("/"), i, a.burst), 120
                    )
                    print("PASS browser reader", i, flush=True)
                    return r

            results = await asyncio.gather(
                *(limited(i) for i in range(a.readers)), return_exceptions=True
            )
            for r in results:
                if isinstance(r, BaseException):
                    raise r
            print(
                json.dumps(
                    dict(
                        sum(results, Counter()),
                        parallel=min(a.readers, a.parallel),
                        seconds=round(time.perf_counter() - start, 2),
                        transport="local browser fixture",
                    ),
                    ensure_ascii=False,
                )
            )
        finally:
            await browser.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base", default="http://127.0.0.1:3100")
    ap.add_argument("--readers", type=int, default=6)
    ap.add_argument("--burst", type=int, default=10)
    ap.add_argument("--parallel", type=int, default=1)
    asyncio.run(main(ap.parse_args()))
