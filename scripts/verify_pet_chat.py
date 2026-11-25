"""Fresh browser, invented messages only. Default: fixture, --live: a real, metered model turn and handoff."""

import argparse, asyncio
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect, Error


async def run(base, live):
    assert urlparse(base).hostname in ("localhost", "127.0.0.1", "::1")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel="msedge")
        ctx = await browser.new_context(
            reduced_motion="reduce", viewport={"width": 390, "height": 844}
        )
        p = await ctx.new_page()
        sent = []
        errors = []
        p.on("pageerror", lambda e: errors.append(str(e)))
        await ctx.route(
            "**/api/zhihu/**",
            lambda r: r.fulfill(json={"items": [], "degraded": True, "live": False}),
        )
        delayed = asyncio.Event()

        async def chat(r):
            if r.request.method == "GET":
                return await r.fulfill(json={"enabled": True, "model": "fixture"})
            pkt = r.request.post_data_json
            sent.append(pkt)
            last = pkt["turns"][-1]["text"]
            if "迟到" in last:
                await delayed.wait()
            try:
                if "掉线" in last:
                    return await r.fulfill(status=429, json={"error": "limited"})
                who = "owl" if pkt["mode"] == "handoff" else "shiba"
                await r.fulfill(
                    json={
                        "source": "model",
                        "model": "fixture",
                        "reply": {
                            "speaker": who,
                            "text": (
                                "我听见上一句了。"
                                if who == "owl"
                                else "留个晚间时段试试。"
                            ),
                        },
                    }
                )
            except Error:
                pass  # cancelled before the fixture released its synthetic response

        if not live:
            await ctx.route("**/api/roundtable/chat", chat)

        async def send(s):
            await p.get_by_role("textbox", name="我也说一句").fill(s)
            await p.get_by_role("button", name="发送消息").click()

        await p.goto(base)
        await p.get_by_role("button", name="打开毛茸茸小屋").click()
        await expect(p.get_by_text("在线联调", exact=False).first).to_be_visible(
            timeout=10000
        )
        await send("狗狗，小镇阅览室六点关门。晚班的人想借书，你有什么想法？")
        bubble = p.locator(".speech-paper")
        await expect(bubble.locator("strong")).to_have_text("护短柴犬", timeout=30000)
        assert await bubble.get_by_text("模型回复", exact=True).is_visible()
        first = await bubble.locator("p").inner_text()
        more = p.get_by_role("button", name="听另一位接话")
        count = "JSON.parse(localStorage.getItem('fr.companion.v1')).threads.reduce((n,t)=>n+t.turns.length,0)"
        before = await p.evaluate(count)
        async with p.expect_response(
            lambda r: urlparse(r.url).path == "/api/roundtable/chat"
            and r.request.method == "POST",
            timeout=35000,
        ) as seen:
            await more.click()
        response = await seen.value
        result = await response.json()
        assert response.ok and response.request.post_data_json["mode"] == "handoff"
        if result.get("source") == "reader_floor":
            assert "reply" not in result
            await expect(p.locator(".pet-test-floor")).to_contain_text("话头留给你")
            await expect(bubble.locator("p")).to_have_text(first)
            assert await p.evaluate(count) == before
            report = "第二位留白。"
        else:
            assert (
                result.get("source") == "model"
                and result["reply"]["speaker"] != "shiba"
            )
            await expect(bubble).to_have_attribute(
                "data-speaker", result["reply"]["speaker"]
            )
            await expect(bubble.locator("p")).to_have_text(result["reply"]["text"])
            await expect(bubble.get_by_text("模型回复", exact=True)).to_be_visible()
            assert await p.evaluate(count) == before + 1
            report = (
                await bubble.locator("strong").inner_text()
                + "："
                + result["reply"]["text"]
            )
        await expect(more).to_have_count(0)
        await expect(p.locator(".room-error")).to_have_count(0)
        if live:
            print("真实浏览器：柴犬：" + first + "\n" + report)
            for who, words in [
                ("呼噜猫", "猫猫，换个话题。不用教我，我想说说今天第一节课的事。"),
                ("考据猫头鹰", "猫头鹰，我担心再问一遍会显得慢，帮我分清事实和猜测。"),
                ("刘看山", "看山，把我们刚弄清的事留一句就好。"),
            ]:
                await send(words)
                await expect(bubble.locator("strong")).to_have_text(who, timeout=30000)
                await expect(bubble.get_by_text("模型回复", exact=True)).to_be_visible()
                print(who + "：" + await bubble.locator("p").inner_text())
        else:
            assert sent[-1]["turns"][-1]["text"] == first
            await send("狗狗，这句要迟到。")
            await expect(p.get_by_text("正在接话…", exact=False)).to_be_visible()
            await send("现在模拟掉线，给我打气。")
            await expect(bubble.get_by_text("本机兜底", exact=True)).to_be_visible()
            await expect(
                p.get_by_text("模型限流或额度不足", exact=False)
            ).to_be_visible()
            delayed.set()
            await p.wait_for_timeout(180)
            await expect(bubble.get_by_text("本机兜底", exact=True)).to_be_visible()
            delayed.clear()
            await send("狗狗，这句也要迟到。")
            await expect(p.get_by_text("正在接话…", exact=False)).to_be_visible()
            await p.get_by_role("button", name="关闭小屋").click()
            delayed.set()
            await p.get_by_role("button", name="打开毛茸茸小屋").click()
            await expect(bubble.get_by_text("本机兜底", exact=True)).to_be_visible()
            # The offline trial must never even check model availability.
            calls = []
            p.on(
                "request",
                lambda r: (
                    calls.append(r.url) if "/api/roundtable/chat" in r.url else None
                ),
            )
            await p.goto(base + "/trial")
            await p.wait_for_load_state("networkidle")
            assert not calls, calls
        assert not errors, errors
        assert await p.evaluate("document.documentElement.scrollWidth <= innerWidth")
        await browser.close()
        print(
            "PASS "
            + (
                "live model + optional second voice"
                if live
                else "fixture: handoff, superseded and folded requests, failure label, offline trial isolation"
            )
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:3100")
    parser.add_argument("--live", action="store_true")
    a = parser.parse_args()
    asyncio.run(run(a.base, a.live))
