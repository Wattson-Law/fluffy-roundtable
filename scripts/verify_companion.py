"""Browser regression of the actual app. Uses the explicit local reading edition, no live API quota.
Run the app first, then: python scripts/verify_companion.py --channel msedge [--shots DIR].
"""

import argparse
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def boot(browser, base, width, height, reduced=True):
    ctx = browser.new_context(
        viewport={"width": width, "height": height},
        reduced_motion="reduce" if reduced else "no-preference",
        locale="zh-CN",
        timezone_id="Asia/Hong_Kong",
    )
    # Simulate only unavailable upstream listings, not the feature under test.
    ctx.route("**/api/zhihu/hot?*", lambda r: r.fulfill(json={"items": [], "degraded": True}))
    ctx.route("**/api/zhihu/quota", lambda r: r.fulfill(json={"live": False, "items": []}))
    bad = []
    posts = []
    ctx.on("request", lambda r: posts.append(r.url) if r.method == "POST" else None)
    page = ctx.new_page()
    page.on("pageerror", lambda e: bad.append(str(e)))
    page.goto(base, wait_until="networkidle")
    expect(page.get_by_text("先翻一页伴读手记")).to_be_visible()
    return ctx, page, bad, posts


def shot(p, folder, name):
    if folder:
        folder.mkdir(parents=True, exist_ok=True)
        p.evaluate("document.fonts.ready")
        p.screenshot(path=str(folder / f"{name}.png"), animations="allow")


def btn(p, s):
    return p.get_by_role("button", name=s, exact=True)


def record_count(p):
    return p.evaluate("JSON.parse(localStorage.getItem('fr.readingHistory.v1') || '[]').length")


def memory(p):
    return p.evaluate("JSON.parse(localStorage.getItem('fr.companion.v1'))")


def notes(p):
    return [m for t in memory(p)["threads"] for m in t["turns"] if m["kind"] == "note"]


def open_notes(p):
    p.get_by_role("button", name=re.compile("^阅读记录（")).click()


def desktop(browser, base, shots):
    ctx, p, errors, posts = boot(browser, base, 1280, 880)
    btn(p, "认识四位伙伴").click()
    guide = p.get_by_role("dialog", name="四位伙伴的名册")
    seen = set()
    for animal, poses in [
        ("刘看山", ["伏案写字", "拿放大镜观察", "看书"]),
        ("呼噜猫", ["睡觉", "猫步", "追逐蝴蝶"]),
        ("考据猫头鹰", ["飞行", "低头沉思", "大笑"]),
        ("护短柴犬", ["大笑", "追逐皮球", "睡觉休息"]),
    ]:
        guide.get_by_role("button", name=animal, exact=True).click()
        for pose in poses:
            guide.get_by_role("button", name=pose, exact=True).click()
            image = guide.get_by_role("img", name=f"{animal}：{pose}")
            image.evaluate("img => img.decode()")
            seen.add(image.get_attribute("src"))
    assert len(seen) == 12
    btn(p, "关闭名册").click()
    shot(p, shots, "01-伴读书架")
    p.clock.install(time="2026-11-21T14:00:00+08:00")
    p.clock.pause_at("2026-11-21T14:00:01+08:00")
    btn(p, "一页笔记，什么时候才算读完？").click()
    expect(p.locator("article[data-read-index]")).to_have_count(1)
    open_notes(p)
    p.clock.fast_forward(8000)
    assert record_count(p) == 0, "reading through overlay"
    btn(p, "关闭记录").click()
    p.evaluate(
        "Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'))"
    )
    p.clock.fast_forward(8000)
    assert record_count(p) == 0, "hidden time counted"
    p.evaluate(
        "delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'))"
    )
    p.clock.run_for(2750)
    assert record_count(p) == 1, "visible dwell not recorded"
    p.clock.fast_forward(400000)
    assert not p.locator(".cat-note").count(), "reading alone triggered a note"
    btn(p, "打开毛茸茸小屋").click()
    expect(btn(p, "开聊 · 听呼噜猫说")).to_be_visible()
    shot(p, shots, "02-伙伴入座")
    btn(p, "开聊 · 听呼噜猫说").click()
    expect(p.locator(".speech-paper strong")).to_have_text("呼噜猫")
    p.clock.fast_forward(15000)
    assert memory(p)["threads"][0]["cursor"] == 1
    p.get_by_role("button", name=re.compile("听下一句")).click()
    expect(p.locator(".speech-paper strong")).to_have_text("考据猫头鹰")
    expect(p.locator(".evidence-card").first).to_contain_text("下次翻到这一页")
    shot(p, shots, "03-小屋原文对话")
    entry = p.get_by_role("textbox", name="我也说一句")
    entry.fill("我在两个选择之间，拿不定主意。")
    entry.dispatch_event("compositionstart")
    entry.press("Enter")
    assert not any(m["speaker"] == "user" for m in memory(p)["threads"][0]["turns"])
    entry.dispatch_event("compositionend")
    btn(p, "发送消息").click()
    expect(p.locator(".speech-paper strong")).to_have_text("呼噜猫")
    entry.fill("还没写完")
    p.clock.fast_forward(320000)
    assert not notes(p), "interrupted typing"
    entry.fill("")
    entry.press("Space")
    entry.fill("")
    btn(p, "关闭小屋").click()
    p.clock.fast_forward(20000)
    expect(p.locator(".cat-note")).to_contain_text("选择")
    assert len(notes(p)) == 1
    shot(p, shots, "04-猫猫主动便签")
    p.reload(wait_until="networkidle")
    expect(p.locator(".cat-note")).to_be_visible()
    btn(p, "回猫猫一句").click()
    expect(p.locator(".speech-paper strong")).to_have_text("呼噜猫")
    expect(p.get_by_role("log")).to_contain_text("主动便签")
    assert len(notes(p)) == 1
    p.get_by_role("button", name=re.compile("听下一句")).click()
    expect(p.locator(".speech-paper strong")).to_have_text("护短柴犬")
    expect(p.locator(".source-list").first.get_by_role("link")).to_have_attribute(
        "href", "/?sample=two-bookmarks"
    )
    p.get_by_role("button", name=re.compile("听下一句")).click()
    expect(p.locator(".speech-paper strong")).to_have_text("刘看山")
    btn(p, "接过看山的掌控卡").click()
    btn(p, "我拍板，收进手账").click()
    expect(btn(p, "已收进猫咖手账")).to_be_disabled()
    p.keyboard.press("Escape")
    expect(p.get_by_role("dialog")).to_have_count(0)
    open_notes(p)
    p.get_by_role("switch").click()
    expect(p.get_by_role("switch")).to_have_attribute("aria-checked", "false")
    btn(p, "关闭记录").click()
    p.clock.fast_forward(90000000)
    assert len(notes(p)) == 1 and not p.locator(".cat-note").count()
    p.reload(wait_until="networkidle")
    open_notes(p)
    expect(p.get_by_role("switch")).to_have_attribute("aria-checked", "false")
    p.get_by_role("button", name=re.compile("过去的聊天")).click()
    btn(p, "继续这段聊天 →").click()
    expect(p.get_by_role("log")).to_be_visible()
    assert memory(p)["threads"][0]["cursor"] == 4
    p.keyboard.press("Escape")
    open_notes(p)
    btn(p, "清空记录").click()
    btn(p, "确认清空阅读和聊天").click()
    assert record_count(p) == 0 and not memory(p)["threads"]
    btn(p, "关闭记录").click()
    p.get_by_role("button", name=re.compile("猫咖手账（")).click()
    expect(p.locator(".journal-entry")).to_have_count(1)
    assert not errors, errors
    assert not posts, "local reading or chat caused outgoing POSTs: " + str(posts)
    ctx.close()
    print(
        "PASS desktop: foreground-only reading, user-paced roles & citations, IME, local conversation history, draft guard, contextual note, reload/resume, mute, clear and journal."
    )


def mobile(browser, base, shots):
    for w, h in [(390, 844), (360, 640)]:
        ctx, p, errors, posts = boot(browser, base, w, h, reduced=False)
        btn(p, "两张书签，留下两种读法").click()
        p.locator("article[data-read-index]").scroll_into_view_if_needed()
        btn(p, "阅读全文").click()
        expect(p.get_by_text("看山已记下", exact=True)).to_be_visible()
        btn(p, "打开毛茸茸小屋").click()
        expect(p.get_by_role("dialog")).to_be_visible()
        expect(btn(p, "开聊 · 听呼噜猫说")).to_be_visible(timeout=7000)
        btn(p, "开聊 · 听呼噜猫说").click()
        p.get_by_role("button", name=re.compile("听下一句")).click()
        expect(p.locator(".portrait-slot img")).to_have_attribute(
            "alt", "考据猫头鹰的发言立绘", timeout=4000
        )
        p.wait_for_timeout(780)
        assert p.evaluate("document.documentElement.scrollWidth<=innerWidth")
        r = p.get_by_role("dialog").bounding_box()
        assert (
            r["x"] >= 0
            and r["x"] + r["width"] <= w + 1
            and r["y"] >= 0
            and r["y"] + r["height"] <= h + 1
        ), r
        field = p.get_by_role("textbox", name="我也说一句")
        assert field.bounding_box()["y"] + field.bounding_box()["height"] < h
        shot(p, shots, f"05-手机小屋-{w}")
        p.keyboard.press("Escape")
        expect(p.get_by_role("dialog")).to_have_count(0)
        assert not errors and not posts, (errors, posts)
        ctx.close()
    print(
        "PASS mobile: 390×844 and 360×640, paper cabin entrance, manual portrait handoff, source links, usable composer and close."
    )


def live_shape(browser, base):
    # Separate contract test: only test fixtures, never reported as a live Zhihu call.
    ctx = browser.new_context(viewport={"width": 1100, "height": 790}, reduced_motion="reduce")
    p = ctx.new_page()
    events = []
    errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    question = "联调：怎么给一本书写笔记？"
    rows = [
        dict(
            id=str(i),
            title=f"验收回答 {i}",
            url=f"https://www.zhihu.com/question/1/answer/{i}",
            author="测试作者",
            contentText="我留了三张书签，写下想核对的那句话。" * 18,
            comments=["不过我的方法不一样，只留下页码。"],
            authoritylevel=2,
            voteUpCount=8,
            commentCount=1,
        )
        for i in range(7)
    ]
    ctx.route(
        "**/api/zhihu/hot?*",
        lambda r: r.fulfill(
            json={
                "items": [
                    {
                        "id": "test",
                        "title": question,
                        "url": rows[0]["url"],
                        "summary": "测试用书单",
                    }
                ]
            }
        ),
    )
    ctx.route("**/api/zhihu/quota", lambda r: r.fulfill(json={"live": False}))
    ctx.route("**/api/zhihu/search?*", lambda r: r.fulfill(json={"items": rows}))

    def analyze(route):
        payload = route.request.post_data_json
        events.append(payload)
        last = payload["trail"][-1]
        s = {"speaker": "purr_cat", "mood": "warm", "text": "我听着。"}
        route.fulfill(
            json={
                "topicTitle": question,
                "mode": "decision_debate",
                "radar": {
                    "drynessScore": 50,
                    "anxietyScore": 10,
                    "adRiskScore": 2,
                    "summaryTag": "测试回合",
                },
                "dialogues": [
                    s,
                    {
                        "speaker": "owl",
                        "mood": "glasses",
                        "text": "我翻回了原文。",
                        "quoteRef": {
                            "sourceTag": "READ_4",
                            "reason": "验收",
                            "sourceUrl": last["url"],
                            "excerpt": "我留了三张书签",
                        },
                    },
                    {"speaker": "shiba", "mood": "happy", "text": "评论中有另一种声音。"},
                    {"speaker": "kanshan", "mood": "calm", "text": "决定权在你。"},
                ],
                "curatedSources": [],
                "followUpQuestion": {
                    "prompt": "这次在意哪一项？",
                    "choices": [{"id": "evidence", "label": "先看原文"}],
                },
                "controlCard": {
                    "oneLineTakeaway": "用自己的问题读。",
                    "microAction": "写下一个问题。",
                    "catBadgeTheme": "compass_orange",
                    "catBadgeName": "书签猫",
                },
                "meta": {"llmUsed": False, "degraded": False, "trailCount": 5},
            }
        )

    ctx.route("**/api/roundtable/analyze", analyze)
    p.goto(base, wait_until="networkidle")
    p.get_by_role("button", name=re.compile(question[:3])).click()
    for i in range(7):
        p.locator("article[data-read-index]").nth(i).get_by_role("button", name="阅读全文").click()
    assert record_count(p) == 7
    btn(p, "打开毛茸茸小屋").click()
    btn(p, "开聊 · 听呼噜猫说").click()
    assert [t["id"] for t in events[0]["trail"]] == ["2", "3", "4", "5", "6"]
    assert set(events[0]) == {"topicHint", "trail"} and "readAt" not in events[0]["trail"][0]
    entry = p.get_by_role("textbox", name="我也说一句")
    entry.fill("想看这篇的原文证据")
    btn(p, "发送消息").click()
    expect(p.locator(".speech-paper strong")).to_have_text("考据猫头鹰")
    p.locator(".evidence-card").first.wait_for()
    for _ in range(3):
        p.get_by_role("button", name=re.compile("听下一句")).click()
    btn(p, "接过看山的掌控卡").click()
    btn(p, "先看原文").click()
    expect(p.locator(".micro")).to_contain_text("先看原文")
    btn(p, "我拍板，收进手账").click()
    p.keyboard.press("Escape")
    p.get_by_role("button", name=re.compile("猫咖手账（")).click()
    expect(p.locator(".journal-entry .micro")).to_contain_text("先看原文")
    assert len(events) == 1 and not errors, (events, errors)
    ctx.close()
    print(
        "PASS live-shaped fixture: seven answer reads, last five only in the analysis request, private free text stays local, decision choice survives in the journal."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:3100")
    parser.add_argument("--channel", default=None)
    parser.add_argument("--shots", type=Path)
    a = parser.parse_args()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel=a.channel, headless=True)
        desktop(browser, a.base, a.shots)
        mobile(browser, a.base, a.shots)
        live_shape(browser, a.base)
        browser.close()
