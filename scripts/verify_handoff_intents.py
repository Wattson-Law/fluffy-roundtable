"""Same reading, three different requests. Default is an offline browser fixture; --live makes five sequential pet calls, never a load test."""

import argparse
import re
from urllib.parse import urlsplit
from playwright.sync_api import expect, sync_playwright

TITLE = "一页笔记，什么时候才算读完？"
VENT = "这篇里抖出来几张便签？算了，我现在只想吐槽。我对着同一页看了三遍，还是烦。"
FACT = "作者从书里抖出来几张便签？我只想核对这个数字。"
LOCATE = "只想核对带「满页箭头」的那句。"
FEAR = "我想去读书会分享这页笔记，就是有点不敢。"
CHEER = "狗狗，先别分析，也不用问为什么，给我打打气就好。"
CHAT = "/api/roundtable/chat"
FLOOR = "话头留给你，不急着回。"


def run(browser, base, live):
    with browser.new_context(
        viewport={"width": 390, "height": 844}, reduced_motion="reduce"
    ) as ctx:
        ctx.route(
            "**/api/zhihu/**",
            lambda r: r.fulfill(json={"degraded": True, "live": False, "items": []}),
        )

        def fixture(route):
            if route.request.method == "GET":
                return route.fulfill(json={"enabled": True, "model": "fixture"})
            pkt = route.request.post_data_json
            if pkt["mode"] == "handoff":
                return route.fulfill(json={"source": "reader_floor"})
            last = pkt["turns"][-1]["text"]
            answers = {
                VENT: ("purr_cat", "翻了三遍还是烦，嗯，我听着。"),
                FACT: (
                    "owl",
                    "能核对的是这一句：「周六收拾桌子，我从书里抖出来三张便签。」",
                ),
                FEAR: ("purr_cat", "你是想去的。哪一刻让你心里打鼓？"),
                CHEER: ("shiba", "想去读书会是你选的，我在你这边。"),
            }
            speaker, text = answers[last]
            return route.fulfill(
                json={
                    "source": "model",
                    "model": "fixture",
                    "reply": {"speaker": speaker, "text": text},
                }
            )

        if not live:
            ctx.route("**/api/roundtable/chat", fixture)
        p = ctx.new_page()
        posts = []
        errors = []
        p.on(
            "request",
            lambda r: (
                posts.append(urlsplit(r.url).path) if r.method == "POST" else None
            ),
        )
        p.on("pageerror", lambda e: errors.append(str(e)))
        p.goto(base + "/?sample=weekend-notebook", wait_until="domcontentloaded")
        expect(p.get_by_text("看山已记下", exact=True)).to_be_visible(timeout=14000)
        p.get_by_role("button", name="打开毛茸茸小屋").click()
        room = p.get_by_role("dialog", name="毛茸茸小屋")
        bubble = room.locator(".speech-paper")
        btn = lambda text: room.get_by_role("button", name=text, exact=True)
        expect(room.locator(".room-context b")).to_have_text(TITLE)
        pin = btn("把这段放上桌")
        expect(pin).to_be_visible(timeout=10000)
        excerpt = room.locator(".table-reading q").inner_text()
        pin.click()
        assert "三张便签" in excerpt and posts == []
        entry = room.get_by_role("textbox", name="我也说一句")
        more = btn("听另一位接话")

        def send(s):
            entry.fill(s)
            btn("发送消息").click()

        def online(action, *, with_passage=False):
            with p.expect_response(
                lambda r: urlsplit(r.url).path == CHAT and r.request.method == "POST",
                timeout=32000,
            ) as seen:
                action()
            r = seen.value
            obj = r.json()
            assert r.ok, (r.status, obj.get("error"))
            pkt = r.request.post_data_json
            if with_passage:
                assert pkt.get("reading") == {"title": TITLE, "excerpt": excerpt}
            else:
                assert "reading" not in pkt, pkt
                # Never reintroduce an earlier answer via conversation history instead.
                assert all(
                    t["text"] != FACT and "三张便签" not in t["text"]
                    for t in pkt["turns"]
                ), pkt
            if obj["source"] == "reader_floor":
                return None, pkt
            assert obj["source"] == "model"
            reply = obj["reply"]
            expect(bubble.locator("p")).to_have_text(reply["text"])
            expect(bubble.locator(".voice-source")).to_have_text("模型回复")
            print(reply["speaker"] + "：" + reply["text"], flush=True)
            return reply, pkt

        cat, _ = online(lambda: send(VENT))
        assert cat["speaker"] == "purr_cat" and not re.search(
            "三张便签|[？?]|你可以先", cat["text"]
        ), cat
        count_before = p.evaluate(
            "JSON.parse(localStorage.getItem('fr.companion.v1')).threads[0].turns.length"
        )
        second, pkt = online(more.click)
        assert pkt["turns"][-1] == cat
        if second is None:
            expect(room.locator(".pet-test-floor")).to_contain_text(FLOOR)
            expect(bubble.locator("p")).to_have_text(cat["text"])
            print("第二位留白，无新气泡。", flush=True)
        else:
            assert second["speaker"] != cat["speaker"] and not re.search(
                "三张便签|[？?]|你可以先", second["text"]
            )
        expect(more).to_have_count(0)
        expect(room.locator(".room-error")).to_have_count(0)
        assert p.evaluate(
            "JSON.parse(localStorage.getItem('fr.companion.v1')).threads[0].turns.length"
        ) == count_before + int(second is not None)
        fact, _ = online(lambda: send(FACT), with_passage=True)
        assert fact["speaker"] == "owl" and "三张便签" in fact["text"]
        expect(more).to_have_count(0)
        expect(room.locator(".pet-test-floor")).to_contain_text(FLOOR)
        before = len(posts)
        send(LOCATE)
        expect(bubble.locator(".voice-source")).to_have_text("本机回复")
        expect(room.locator(".evidence-card q")).to_contain_text("满页箭头")
        expect(more).to_have_count(0)
        assert len(posts) == before
        print(
            "本机逐句核对（没有联网）："
            + room.locator(".evidence-card q").inner_text(),
            flush=True,
        )
        expect(btn("撤下原句")).to_be_visible()  # The grant survives non-reading turns.
        first, _ = online(lambda: send(FEAR))
        assert first["speaker"] == "purr_cat" and not re.search(
            "利弊|你可以先|第一步", first["text"]
        )
        if re.search("[？?]|吗[。！!]?$", first["text"]):
            expect(more).to_have_count(0)
            expect(room.locator(".pet-test-floor")).to_contain_text(FLOOR)
        last, _ = online(lambda: send(CHEER))
        assert last["speaker"] == "shiba" and not re.search(
            "[？?]|你可以先|哥看好你", last["text"]
        )
        assert posts == [CHAT] * 5 and not errors, (posts, errors)
        print(
            "PASS same page: vent, optional second speaker, one verified fact, local quote, fear and reader correction. 5 chat requests; 0 analysis requests."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:3100")
    parser.add_argument("--live", action="store_true")
    a = parser.parse_args()
    assert urlsplit(a.base).hostname in ("localhost", "127.0.0.1", "::1")
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="msedge")
        try:
            run(browser, a.base.rstrip("/"), a.live)
        finally:
            browser.close()
