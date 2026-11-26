"""Article-only vs personal job news, month-later invite, user control and cross-room recall.
Uses the real homepage, two clean readers, Playwright's clock and local fixture responses only.
"""

from round_chat_locators import latest_pet
import argparse, re
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

JOB = "我最近找工作，投简历的时候很焦虑。"
LABEL = "找工作时有些焦虑"
DAY = 86400000


def btn(s, name):
    return s.get_by_role("button", name=name, exact=True)


def book(p):
    return p.evaluate("JSON.parse(localStorage.getItem('fr.companion.v1')||'{}')")


def run(browser, base, spoken):
    with browser.new_context(
        viewport={"width": 390, "height": 844},
        reduced_motion="reduce",
        timezone_id="Asia/Hong_Kong",
    ) as ctx:
        posts = []
        errors = []

        def chat(route):
            if route.request.method == "GET":
                return route.fulfill(json={"enabled": True, "model": "fixture"})
            pkt = route.request.post_data_json
            posts.append(pkt)
            return route.fulfill(
                json={
                    "source": "model",
                    "model": "fixture",
                    "reply": {"speaker": "purr_cat", "text": "我听着呢。"},
                }
            )

        ctx.route(
            "**/api/zhihu/**",
            lambda r: r.fulfill(json={"degraded": True, "items": [], "live": False}),
        )
        ctx.route("**/api/roundtable/chat", chat)

        def tab():
            p = ctx.new_page()
            p.on("pageerror", lambda e: errors.append(str(e)))
            p.clock.install(time="2026-10-22T09:00:00+08:00")
            return p

        p = tab()
        p.goto(base + "/?sample=weekend-notebook", wait_until="domcontentloaded")
        expect(p.get_by_text("看山已记下", exact=True)).to_be_visible(timeout=14000)

        def open_room():
            btn(p, "打开毛茸茸小屋").click()
            return p.get_by_role("dialog", name="毛茸茸小屋")

        def send(room, s):
            e = room.get_by_role("textbox", name="我也说一句")
            e.fill(s)
            btn(room, "发送消息").click()

        if spoken:
            r = open_room()
            send(r, JOB)
            expect(r.locator(".memory-slip")).to_contain_text(LABEL)
            expect(latest_pet(r).locator(".message-bubble")).to_have_text("我听着呢。")
            btn(r, "关闭小屋").click()
        p.close()
        p = tab()
        p.clock.set_system_time("2026-11-23T12:00:00+08:00")
        p.goto(base, wait_until="domcontentloaded")
        expect(p.get_by_role("button", name="阅读记录（1篇）")).to_be_visible()
        p.clock.fast_forward(40_000)
        assert not book(p).get(
            "pending"
        ), "reader has been back for less than five idle minutes"
        p.clock.fast_forward(310_000)
        if not spoken:
            assert (
                not book(p).get("memories") and not book(p).get("pending") and not posts
            )
            print(
                "PASS reading only: no personal memory, no month-later invite",
                flush=True,
            )
            return
        expect(p.locator(".cat-note p")).to_have_text("有空聊两句吗？")
        assert LABEL not in p.locator("body").inner_text()
        btn(p, "回猫猫一句").click()
        r = p.get_by_role("dialog", name="毛茸茸小屋")
        expect(latest_pet(r).locator(".message-bubble")).to_contain_text("上个月")
        expect(latest_pet(r).locator(".message-bubble")).to_contain_text("最近好一点了吗")
        expect(r.locator(".room-context")).to_contain_text("不带文章")
        send(r, "我已经入职了。")
        expect(r.locator(".memory-slip")).to_contain_text("已经入职")
        expect(latest_pet(r).locator(".message-bubble")).to_have_text("我听着呢。")
        for n in ["猫猫", "猫头鹰", "狗狗", "看山"]:
            send(r, n + "，还记得我上次找工作的事吗？")
            expect(latest_pet(r).locator(".message-bubble")).to_contain_text("入职")
            expect(latest_pet(r).locator(".voice-source")).to_have_text("本机回复")
        btn(r, "关闭小屋").click()
        p.get_by_role("button", name="阅读记录（1篇）").click()
        s = p.get_by_role("dialog", name="阅读记录与聊天")
        btn(s, "伙伴记得").click()
        row = s.locator(".memory-row")
        expect(row).to_have_count(1)
        btn(row, "更正").click()
        row.get_by_role("textbox").fill("已经开始试用期")
        btn(row, "保存更正").click()
        expect(row).to_contain_text("已经开始试用期")
        btn(row, "不再主动问").click()
        expect(row).to_contain_text("不会主动问")
        btn(row, "忘了这件事").click()
        expect(row).to_have_count(0)
        btn(s, "关闭记录").click()
        r = open_room()
        send(r, "狗狗，还记得我上回在忙什么吗？")
        expect(latest_pet(r).locator(".message-bubble")).to_contain_text("没有记下")
        btn(r, "关闭小屋").click()
        p.clock.set_system_time("2026-12-26T12:00:00+08:00")
        p.clock.fast_forward(320000)
        assert not book(p).get("pending")
        assert len(posts) == 2 and all(
            "memories" not in x and "reading" not in x for x in posts
        ), posts
        assert not errors, errors
        print(
            "PASS month-later private invite; four pets follow a correction; edit/mute/forget; no private summary sent.",
            flush=True,
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:3100")
    a = parser.parse_args()
    assert urlsplit(a.base).hostname in ("localhost", "127.0.0.1", "::1")
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel="msedge")
        try:
            for spoken in [False, True]:
                run(b, a.base.rstrip("/"), spoken)
        finally:
            b.close()
