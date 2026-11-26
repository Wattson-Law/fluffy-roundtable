"""Actual cabin, with offline listings. Optional screenshots show the running UI, not mockups."""

from round_chat_locators import latest_pet
import argparse
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def button(p, name):
    return p.get_by_role("button", name=name, exact=True)


def send(p, words):
    p.get_by_role("textbox", name="我也说一句").fill(words)
    button(p, "发送消息").click()


def boot(browser, width, height):
    ctx = browser.new_context(
        viewport={"width": width, "height": height},
        reduced_motion="reduce",
        locale="zh-CN",
    )
    ctx.route(
        "**/api/zhihu/hot?*", lambda r: r.fulfill(json={"items": [], "degraded": True})
    )
    ctx.route(
        "**/api/zhihu/quota", lambda r: r.fulfill(json={"live": False, "items": []})
    )
    ctx.route(
        "**/api/roundtable/chat",
        lambda r: (
            r.fulfill(json={"enabled": False})
            if r.request.method == "GET"
            else r.abort()
        ),
    )
    p = ctx.new_page()
    errors, posts = [], []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("request", lambda r: posts.append(r.url) if r.method == "POST" else None)
    return ctx, p, errors, posts


def experience(browser, base, mobile, shots):
    ctx, p, errors, posts = boot(
        browser, 390 if mobile else 1280, 844 if mobile else 900
    )
    p.goto(base)
    button(p, "打开毛茸茸小屋").click()
    room = p.get_by_role("dialog", name="毛茸茸小屋")
    field = room.get_by_role("textbox", name="我也说一句")
    expect(field).to_be_visible(timeout=3500)
    speech = latest_pet(room)
    send(room, "从哪开始好，帮我分析一下。")
    expect(speech.locator(".message-byline strong")).to_have_text("考据猫头鹰")
    send(room, "我想去，就是有点怕。")
    expect(speech.locator(".message-bubble")).to_contain_text("？")
    expect(speech.locator(".message-byline strong")).to_have_text("呼噜猫")
    send(room, "我怕没听懂师傅教的，又不敢再问。")
    expect(speech).to_contain_text("练一句")
    send(room, "不用练了，我只想听你给我打打气。")
    expect(speech.locator(".message-byline strong")).to_have_text("护短柴犬")
    expect(speech).to_contain_text("我相信你")
    expect(speech.locator(".message-bubble")).not_to_contain_text("？")
    expect(room.locator(".source-list,.evidence-card,.decision-paper")).to_have_count(0)
    if shots:
        shots.mkdir(parents=True, exist_ok=True)
        p.evaluate("document.fonts.ready")
        room.screenshot(path=str(shots / ("mobile.png" if mobile else "desktop.png")))
    send(room, "我想去，给我打打气。就是十点下班，末班车九点半。")
    expect(speech).to_contain_text("回家")
    send(room, "别光鼓励我。那明天我能先做什么？")
    expect(speech.locator(".message-byline strong")).to_have_text("刘看山")
    expect(speech).to_contain_text("下班")
    expect(
        room.get_by_role("button", name=re.compile("听下一句|接过看山"))
    ).to_have_count(0)
    count = room.locator(".thread-count").inner_text()
    button(room, "关闭小屋").click()
    p.reload()
    button(p, "打开毛茸茸小屋").click()
    expect(room.locator(".thread-count")).to_have_text(count)
    expect(speech).to_contain_text("下班")
    assert not errors and not posts, (errors, posts)
    assert p.evaluate("document.documentElement.scrollWidth<=innerWidth")
    ctx.close()
    print(
        "PASS",
        "mobile" if mobile else "desktop",
        "empty-handed opening, sequential intention changes, no stale lines, resume, no chat POST",
    )


def race(browser, base, interrupt):
    # Old saved article card. Only its delayed HTTP response is a fixture.
    ctx, p, errors, posts = boot(browser, 1100, 820)
    row = {
        "url": "https://www.zhihu.com/question/11/answer/42",
        "id": "42",
        "title": "旧文",
        "author": "作者",
        "contentText": "夹着书签。",
        "comments": [],
        "readAt": 1,
    }
    room = {
        "key": row["url"],
        "title": "旧文",
        "context": [row],
        "cursor": 1,
        "turns": [
            {
                "id": "first",
                "speaker": "kanshan",
                "text": "原文卡在这里。",
                "kind": "script",
                "at": 1,
            }
        ],
        "touched": 1,
        "result": {
            "dialogues": [{"speaker": "kanshan", "text": "原文卡在这里。"}],
            "curatedSources": [],
            "radar": {},
            "meta": {},
            "followUpQuestion": {
                "prompt": "想看什么？",
                "choices": [{"id": "card", "label": "看一张卡"}],
            },
            "controlCard": {"oneLineTakeaway": "一篇文章", "microAction": "夹书签"},
        },
    }
    state = {
        "version": 1,
        "enabled": False,
        "lastNudgeAt": 0,
        "pending": None,
        "threads": [room],
    }
    p.add_init_script(
        'if(!localStorage.getItem("fr.companion.v1")){localStorage.setItem("fr.companion.v1",'
        + json.dumps(json.dumps(state))
        + ');localStorage.setItem("fr.readingHistory.v1",'
        + json.dumps(json.dumps([row]))
        + ");}"
    )
    pending = []
    p.route("**/api/roundtable/follow-up", lambda r: pending.append(r))
    p.goto(base)
    # Only the explicit chat entry restores the entire old guide/card.
    button(p, "阅读记录（1篇）").click()
    p.get_by_role("button", name=re.compile("^过去的聊天")).click()
    button(p, "继续这段聊天 →").click()
    button(p, "接过看山的掌控卡").click()
    with p.expect_request("**/api/roundtable/follow-up"):
        button(p, "看一张卡").click()
    if interrupt == "compose":
        field = p.get_by_role("textbox", name="我也说一句")
        field.fill("先等等")
        field.dispatch_event("compositionstart")
    else:
        button(p, "关闭小屋").click()
    pending[0].fulfill(
        json={
            "dialogue": {"text": "不应出现的旧回复"},
            "microAction": "不应出现的旧任务",
        }
    )
    if interrupt == "compose":
        field.dispatch_event("compositionend")
        send(p, "不用分析，给我一点鼓励。")
        expect(latest_pet(p)).to_contain_text("我相信你")
    else:
        button(p, "打开毛茸茸小屋").click()
    assert p.evaluate("!localStorage.getItem('fr.companion.v1').includes('不应出现')")
    assert len(posts) == 1 and not errors, (posts, errors)
    ctx.close()
    print("PASS delayed article-card response discarded on", interrupt)


def article_entry(browser, base):
    ctx, p, errors, posts = boot(browser, 1100, 820)
    row = {
        "url": "https://www.zhihu.com/question/11/answer/42",
        "id": "42",
        "title": "一篇文章",
        "author": "作者",
        "contentText": "原文说的是写字。",
        "comments": [],
        "readAt": 1,
    }
    p.add_init_script(
        'localStorage.setItem("fr.readingHistory.v1",'
        + json.dumps(json.dumps([row]))
        + ");"
    )
    pending = []
    p.route("**/api/roundtable/analyze", lambda r: pending.append(r))
    p.goto(base)
    button(p, "打开毛茸茸小屋").click()
    expect(p.locator(".room-context")).to_contain_text("不带文章")
    button(p, "关闭小屋").click()
    button(p, row["title"]).click()
    field = p.get_by_role("textbox", name="我也说一句")
    expect(field).to_be_visible()
    assert not posts, "opening the pet is not consent to submit the article"
    expect(button(p, "不带文章，去窗边坐坐 →")).to_be_visible()
    with p.expect_request("**/api/roundtable/analyze"):
        button(p, "开聊 · 听呼噜猫说").click()
    body = pending[0].request.post_data_json
    assert (
        "turns" not in body
        and len(body["trail"]) == 1
        and body["trail"][0]["id"] == "42"
    )
    field.fill("先等等")
    pending[0].fulfill(
        json={
            "dialogues": [{"speaker": "purr_cat", "text": "过时的开场"}],
            "meta": {},
            "radar": {},
            "curatedSources": [],
        }
    )
    send(p, "原文里「写字」指什么？")
    expect(latest_pet(p).locator(".message-byline strong")).to_have_text("考据猫头鹰")
    expect(p.locator(".evidence-card q")).to_contain_text("写字")
    send(p, "不看原文了，听我说。")
    expect(latest_pet(p).locator(".message-byline strong")).to_have_text("呼噜猫")
    expect(latest_pet(p).locator(".evidence-card")).to_have_count(0)
    expect(p.get_by_role("log").locator(".evidence-card q")).to_contain_text("写字")
    assert p.evaluate(
        "!JSON.parse(localStorage.getItem('fr.companion.v1')).threads.some(t=>t.turns.some(m=>m.text==='过时的开场'))"
    )
    p.locator(".context-details summary").click()
    button(p, "不带文章，去窗边坐坐 →").click()
    send(p, "给我点鼓励。")
    expect(latest_pet(p)).to_contain_text("我相信你")
    button(p, "关闭小屋").click()
    p.reload()
    button(p, "打开毛茸茸小屋").click()
    expect(p.locator(".room-context")).to_contain_text("窗边随聊")
    expect(latest_pet(p)).to_contain_text("我相信你")
    assert len(posts) == 1 and not errors, (posts, errors)
    ctx.close()
    print(
        "PASS choice before sending article, early input and interruption during article preparation"
    )


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:3100")
    ap.add_argument("--channel", default="msedge")
    ap.add_argument("--shots", type=Path)
    a = ap.parse_args()
    with sync_playwright() as pw:
        br = pw.chromium.launch(channel=a.channel, headless=True)
        for mobile in [False, True]:
            experience(br, a.base, mobile, a.shots)
        article_entry(br, a.base)
        for interruption in ["compose", "fold"]:
            race(br, a.base, interruption)
        br.close()
