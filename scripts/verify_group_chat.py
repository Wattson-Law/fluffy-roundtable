"""Roundtable choreography in the real reading app, with synthetic, held model replies only."""

import argparse
import asyncio
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright, expect

NAMES = {"purr_cat": "呼噜猫", "owl": "考据猫头鹰", "shiba": "护短柴犬", "kanshan": "刘看山"}


async def exercise(browser, base, narrow, shots):
    ctx = await browser.new_context(
        viewport={"width": 360 if narrow else 1280, "height": 700 if narrow else 880},
        reduced_motion="reduce" if narrow else "no-preference",
        locale="zh-CN",
    )
    await ctx.route(
        "**/api/zhihu/**", lambda r: r.fulfill(json={"items": [], "degraded": True, "live": False})
    )
    p = await ctx.new_page()
    errors, sent = [], []
    p.on("pageerror", lambda e: errors.append(str(e)))
    release, waiting = asyncio.Event(), asyncio.Event()
    reader = "看到第三篇了，还是有点乱。"
    cat = "不急着把三篇都弄明白。你可以先在这儿坐坐。"
    question = "柴犬，明天我可以从哪一步开始？"
    dog = "先留下你最想再看的一句就好。等你想接着读，我陪你。"

    async def chat(route):
        if route.request.method == "GET":
            return await route.fulfill(json={"enabled": True, "model": "fixture"})
        words = route.request.post_data_json["turns"][-1]["text"]
        sent.append(words)
        if words == question:
            waiting.set()
            await release.wait()
        who, text = ("purr_cat", cat) if words == reader else ("shiba", dog)
        await route.fulfill(
            json={"source": "model", "model": "fixture", "reply": {"speaker": who, "text": text}}
        )

    await ctx.route("**/api/roundtable/chat", chat)
    try:
        await p.goto(base)
        await p.get_by_role("button", name="打开毛茸茸小屋").click()
        room = p.get_by_role("dialog", name="毛茸茸小屋")
        log = room.get_by_role("log", name="聊天记录")
        field = room.get_by_role("textbox", name="我也说一句")

        async def say(text):
            await field.fill(text)
            await room.get_by_role("button", name="发送消息").click()

        await expect(field).to_be_visible(timeout=8000)
        await say(reader)
        rows = log.locator(".round-message")
        await expect(rows).to_have_count(2)
        stage = room.locator(".room-scene")
        seats = stage.locator(".bench-seat")
        active = seats.locator('xpath=self::*[@data-active="true"]')
        await expect(seats).to_have_count(4)
        await expect(active).to_have_attribute("data-speaker", "purr_cat")
        await seats.first.evaluate("el => window.originalSeat = el")
        await say(question)
        await asyncio.wait_for(waiting.wait(), 5)
        await expect(rows).to_have_count(3)
        await expect(active).to_have_count(0)  # no animal is speaking on the reader's behalf
        await expect(stage).to_contain_text("听你说")
        release.set()
        await expect(rows).to_have_count(4)
        await expect(active).to_have_attribute("data-speaker", "shiba")
        assert await seats.first.evaluate("el => el === window.originalSeat")
        await expect(active.locator(".seat-voice")).to_have_css("opacity", "1")
        await expect(
            stage.locator('.bench-seat[data-active="false"] .seat-voice').first
        ).to_have_css("opacity", "0")
        await expect(room.get_by_text("点头像递话", exact=True)).to_be_visible()
        mine = await rows.nth(2).locator(".message-face").bounding_box()
        theirs = await rows.nth(3).locator(".message-face").bounding_box()
        assert mine["x"] - theirs["x"] > 200
        assert (
            len(set(await seats.locator(".pose-rest").evaluate_all("imgs => imgs.map(i=>i.src)")))
            == 4
        )
        assert await rows.evaluate_all("els => els.map(e=>e.dataset.speaker)") == [
            "user",
            "purr_cat",
            "user",
            "shiba",
        ]
        assert await log.locator(".message-bubble").all_text_contents() == [
            reader,
            cat,
            question,
            dog,
        ]
        for i, who in [(1, "purr_cat"), (3, "shiba")]:
            row = rows.nth(i)
            await expect(row.locator("strong")).to_have_text(NAMES[who])
            face = row.locator(".message-face img")
            await face.evaluate("img=>img.decode()")
            assert await face.get_attribute("src") == await seats.locator(
                f'xpath=self::*[@data-speaker="{who}"]'
            ).locator(".pose-rest").get_attribute("src")
            await expect(row.locator(".voice-source")).to_have_text("模型回复")
        await expect(stage).not_to_contain_text(dog)
        await expect(room.get_by_text(dog, exact=True)).to_have_count(1)
        for seat in await seats.all():
            await expect(seat).to_be_visible()
            await seat.locator("img").evaluate_all("els=>Promise.all(els.map(e=>e.decode()))")
        flow = room.locator(".room-flow")
        gap = "el=>el.scrollHeight-el.scrollTop-el.clientHeight"
        await p.wait_for_function(
            """()=>{const e=document.querySelector('.room-flow');return e.scrollHeight-e.scrollTop-e.clientHeight<3}"""
        )
        assert (await field.bounding_box())["y"] < (700 if narrow else 880)
        assert await p.evaluate("document.documentElement.scrollWidth<=innerWidth")
        pose = seats.first.locator(".pose-talk")
        if narrow:
            assert await pose.evaluate("el=>getComputedStyle(el).transitionProperty") == "none"
        else:
            assert (
                await pose.evaluate("el=>parseFloat(getComputedStyle(el).transitionDuration)")
                >= 0.6
            )
        if shots:
            shots.mkdir(parents=True, exist_ok=True)
            await p.evaluate("document.fonts.ready")
            await room.screenshot(
                path=shots / ("group-phone.png" if narrow else "group-desktop.png"),
                animations="disabled",
            )
        # An avatar can address a partner, but cannot replace the draft, post it or change the stage.
        await field.fill("我想到一件事。")
        await rows.nth(1).get_by_role("button", name="和呼噜猫说句话").click()
        await expect(field).to_have_value("呼噜猫，我想到一件事。")
        await expect(field).to_be_focused()
        name_seat = stage.get_by_role("button", name="和刘看山说句话")
        await name_seat.focus()
        await name_seat.press("Enter")
        await expect(field).to_have_value("刘看山，我想到一件事。")
        await expect(active).to_have_attribute("data-speaker", "shiba")
        await expect(rows).to_have_count(4)
        assert len(sent) == 2
        await field.fill("字" * 400)
        await stage.get_by_role("button", name="和刘看山说句话").click()
        await expect(field).to_have_value("字" * 400)
        await expect(room.get_by_text("草稿已满，原话已保留。", exact=True)).to_be_visible()
        for i in range(4):
            await say(f"狗狗，再聊聊第{i+1}页的想法吧。")
            await expect(rows).to_have_count(6 + i * 2)
        # Read back without a new reply stealing the scroll position; explicitly catch up once.
        await flow.evaluate("el=>{el.scrollTop-=Math.min(200,el.clientHeight*.7)}")
        back = room.get_by_role("button", name="回到最新")
        await expect(back).to_be_visible()
        top = await flow.evaluate("el=>el.scrollTop")
        await say("狗狗，我们先从这一页说起。")
        await expect(rows).to_have_count(14)
        assert abs(await flow.evaluate("el=>el.scrollTop") - top) <= 3
        await room.get_by_role("button", name="2 条新消息").click()
        assert await flow.evaluate(gap) < 3
        await expect(back).to_have_count(0)
        await room.get_by_role("button", name="关闭小屋").click()
        await p.get_by_role("button", name="打开毛茸茸小屋").click()
        await expect(rows).to_have_count(14)
        await expect(room.get_by_role("button", name="跳过入场")).to_have_count(0)
        assert len(sent) == 7 and not errors, (sent, errors)
        print(
            "PASS",
            "360px / reduced motion" if narrow else "desktop / normal motion",
            "ordered group thread, fixed seats, reader interruption, scroll and restore",
            flush=True,
        )
    finally:
        release.set()
        await ctx.close()


async def main(args):
    assert urlparse(args.base).hostname in ("localhost", "127.0.0.1", "::1")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(channel=args.channel)
        for mobile in (False, True):
            await exercise(browser, args.base, mobile, args.shots)
        await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:3100")
    parser.add_argument("--channel", default="msedge")
    parser.add_argument("--shots", type=Path)
    asyncio.run(main(parser.parse_args()))
