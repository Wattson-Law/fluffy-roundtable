"""Full homepage acceptance: public listening, source boundaries, deliberate note keeping.
All readers, sources and model replies below are fixtures. Does not contact Zhihu or a model.
"""

import argparse
import asyncio
import re
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from playwright.async_api import async_playwright, expect, Error

POSTS = [
    dict(
        id=str(i),
        title=t,
        summary=s,
        url=f"https://www.zhihu.com/question/{i}",
        hotValue=100 - i,
    )
    for i, t, s in [
        (11, "市图书馆能否延长开放时间？", "讨论的是场馆的开放时段。"),
        (12, "火星探测器怎样采样？", "题目提到地表取样。"),
    ]
]
SCI = dict(
    id="25",
    title="芯片如何降低能耗？",
    url="https://www.zhihu.com/question/25",
    contentText="受访者介绍了芯片的待机功耗。",
)
SAVED = "读书会不必讲得完整，也可以留下我的问题。"


def btn(where, label):
    return where.get_by_role("button", name=label, exact=True)


async def scenario(browser, base, live, shots=None):
    ctx = await browser.new_context(
        viewport={"width": 390, "height": 844}, reduced_motion="reduce"
    )
    packets = []
    scopes = []
    errors = []
    waiting = asyncio.Event()
    release = asyncio.Event()
    done = asyncio.Event()

    async def api(r):
        u = urlsplit(r.request.url)
        path = u.path
        if path.endswith("/chat"):
            if r.request.method == "GET":
                return await r.fulfill(json={"enabled": True, "model": "fixture"})
            pkt = r.request.post_data_json
            packets.append(pkt)
            return await r.fulfill(
                json={
                    "source": "model",
                    "reply": {"speaker": "purr_cat", "text": "我先听你讲。"},
                }
            )
        if path.endswith("/hot"):
            return await r.fulfill(json={"degraded": not live, "items": POSTS})
        if path.endswith("/search"):
            query = parse_qs(u.query)["q"][0]
            scopes.append(query)
            if query == "天文":
                waiting.set()
                await release.wait()
                try:
                    await r.fulfill(
                        json={
                            "degraded": False,
                            "items": [
                                {
                                    "title": "星系的晚到消息",
                                    "contentText": "天文",
                                    "url": "https://www.zhihu.com/question/99",
                                }
                            ],
                        }
                    )
                except Error:
                    pass  # reader already closed the cabin
                finally:
                    done.set()
                return
            return await r.fulfill(json={"degraded": False, "items": [SCI, *POSTS]})
        if path.endswith("/quota"):
            return await r.fulfill(json={"live": False})
        errors.append("unexpected API: " + path)
        await r.abort()

    await ctx.route("**/api/**", api)

    async def tab():
        p = await ctx.new_page()
        p.on("pageerror", lambda e: errors.append(str(e)))
        await p.clock.install()
        return p

    p = await tab()
    await p.goto(base + "/?sample=weekend-notebook")
    await expect(p.get_by_text("看山已记下", exact=True)).to_be_visible(timeout=15000)

    async def enter():
        await btn(p, "打开毛茸茸小屋").click()
        return p.get_by_role("dialog", name="毛茸茸小屋")

    async def send(r, text):
        await r.get_by_role("textbox", name="我也说一句").fill(text)
        await btn(r, "发送消息").click()

    async def number_of_lines():
        return await p.evaluate(
            "JSON.parse(localStorage.getItem('fr.companion.v1')).threads.flatMap(r=>r.turns).filter(t=>t.kind==='listening').length"
        )

    async def shelf():
        await p.get_by_role("button", name=re.compile("^阅读记录（")).click()
        s = p.get_by_role("dialog", name="阅读记录与聊天")
        await btn(s, "我的念头").click()
        return s

    try:
        r = await enter()
        speech = r.locator(".speech-paper p")
        d = r.get_by_role("region", name="旁听话题")
        entry = r.get_by_role("textbox", name="我也说一句")
        if not live:
            await btn(d, "让伙伴挑新闻").click()
            await expect(d).to_contain_text("没取到可用的知乎热榜")
            await expect(d.get_by_role("link")).to_have_count(0)
            await send(r, "我来出题：公共图书馆该不该延长开放时间？")
            await expect(speech).to_contain_text("你出的这题")
            assert not packets and not scopes and not errors
            print(
                "PASS degraded list: no pretend headline; reader can still bring a public topic.",
                flush=True,
            )
            return
        await btn(r, "把这段放上桌").click()
        await send(r, "刚才我心里有点乱，只是想说说。")
        await expect(speech).to_have_text("我先听你讲。")
        await send(r, "你们挑一条新闻聊聊，我听着。")
        await expect(speech).to_contain_text(POSTS[0]["title"])
        await expect(d.get_by_role("link")).to_have_attribute("href", POSTS[0]["url"])
        await expect(r.locator(".room-context")).to_contain_text(POSTS[0]["title"])
        await expect(btn(r, "把这段放上桌")).to_have_count(0)
        await btn(r, "记个念头").click()
        await expect(r.get_by_role("checkbox")).to_have_accessible_name(
            re.compile(POSTS[0]["title"][:5])
        )
        await btn(r, "取消，不保存").click()
        count = await number_of_lines()
        await p.clock.fast_forward(60_000)
        assert await number_of_lines() == count
        await send(r, "没兴趣")
        await expect(speech).to_contain_text(POSTS[1]["title"])
        await btn(d, "接回上一题").click()
        await expect(d).to_contain_text(POSTS[0]["title"])
        await send(r, "聊点科技的")
        await expect(d.get_by_role("link")).to_have_attribute("href", SCI["url"])
        assert scopes == ["科技"]
        await send(r, "你们接着聊，我听着。")
        count = await number_of_lines()
        await p.clock.fast_forward(25000)
        assert await number_of_lines() > count
        await entry.dispatch_event("compositionstart", {"data": "我"})
        count = await number_of_lines()
        await p.clock.fast_forward(45_000)
        assert await number_of_lines() == count
        await entry.dispatch_event("compositionend")
        await send(r, "我听说市图书馆要延长开放时间")
        await expect(speech).to_contain_text("未经证实")
        if shots:
            await r.locator(".room-flow").evaluate("e=>{e.scrollTop=0}")
            await r.screenshot(path=shots / "listening-rumor.png")
        await send(r, "这件事已经证实了吗？")
        await expect(speech).to_contain_text("没有核实")
        assert len(packets) == 1
        await send(r, "其实我现在只想说说。")
        await expect(speech).to_have_text("我先听你讲。")
        assert (
            len(packets) == 2
            and packets[-1]["turns"]
            == [{"speaker": "user", "text": "其实我现在只想说说。"}]
            and "reading" not in packets[-1]
        ), packets
        await send(r, "聊点天文的")
        await asyncio.wait_for(waiting.wait(), 5)
        await btn(r, "关闭小屋").click()
        count = await number_of_lines()
        release.set()
        await asyncio.wait_for(done.wait(), 5)
        await p.clock.fast_forward(40000)
        assert await number_of_lines() == count
        r = await enter()
        await expect(r.get_by_text("星系的晚到消息", exact=True)).to_have_count(0)
        await send(r, "我最近找工作，投简历时很焦虑。")
        await expect(r.locator(".memory-slip")).to_be_visible()
        await btn(r, "记个念头").click()
        editor = r.get_by_role("textbox", name="念头或短标题")
        await editor.fill(SAVED)
        await r.get_by_role("checkbox", name=re.compile("附上这篇")).check()
        await editor.evaluate("(e)=>e.blur()")
        await p.clock.fast_forward(330000)
        assert not await p.evaluate(
            "JSON.parse(localStorage.getItem('fr.companion.v1')).threads.flatMap(t=>t.turns).some(t=>t.kind==='note')"
        )
        await btn(r, "保存念头").click()
        await expect(r.get_by_text("念头已放进书架。", exact=True)).to_be_visible()
        n = len(packets)
        await btn(r, "关闭小屋").click()
        await p.close()
        p = await tab()
        await p.goto(base)
        s = await shelf()
        await expect(s.get_by_role("link", name=re.compile("回看"))).to_have_count(0)
        await btn(s, SAVED).click()
        link = s.get_by_role("link", name=re.compile("回看本地试读"))
        await expect(link).to_have_attribute("href", "/?sample=weekend-notebook")
        assert len(packets) == n
        if shots:
            await s.screenshot(path=shots / "reader-thought.png")
        await btn(s, "继续聊这个念头").click()
        r = p.get_by_role("dialog", name="毛茸茸小屋")
        await expect(r.get_by_role("textbox", name="我也说一句")).to_have_value(SAVED)
        await expect(r.locator(".room-context")).to_contain_text("不带文章")
        assert len(packets) == n
        await btn(r, "关闭小屋").click()
        s = await shelf()
        await btn(s, SAVED).click()
        await btn(s, "删除这个念头").click()
        await btn(s, "确认删除").click()
        await expect(btn(s, SAVED)).to_have_count(0)
        assert not errors and len(packets) == n and scopes == ["科技", "天文"], (
            errors,
            scopes,
        )
        assert await p.evaluate("document.documentElement.scrollWidth<=innerWidth")
        print(
            "PASS ranked/scoped/rumor/IME/fold/late reply/private switch; opt-in thought, idle editor, reopen, draft only and delete on mobile.",
            flush=True,
        )
    finally:
        release.set()
        await ctx.close()


async def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:3100")
    parser.add_argument("--shots", type=Path)
    a = parser.parse_args()
    if a.shots:
        a.shots.mkdir(parents=True, exist_ok=True)
    assert urlsplit(a.base).hostname in ("127.0.0.1", "::1", "localhost")
    async with async_playwright() as pw:
        b = await pw.chromium.launch(channel="msedge")
        try:
            for live in [False, True]:
                await scenario(b, a.base.rstrip("/"), live, a.shots)
        finally:
            await b.close()


if __name__ == "__main__":
    asyncio.run(main())
