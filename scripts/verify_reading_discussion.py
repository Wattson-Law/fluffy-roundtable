"""Browser acceptance: dwell -> notebook -> article cabin -> discussion.
Default uses only the built-in local guide. --live also checks the product goal (no retelling).
With --live this sends four invented reader/handoff requests to the configured test model.
No browser profile, stored trail, transport stub or API credential is supplied by this script.
"""

from round_chat_locators import latest_pet
import argparse
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright

NOTEBOOK = "一页笔记，什么时候才算读完？"
READ = "两张书签，留下两种读法"
BLIND = "狗狗，刚读那篇用了哪两种颜色？分别拿来做什么？"
OUTSIDE = "看山，刚读那篇里，作者把蓝书签往前挪了几页？"
SOURCE = "猫头鹰，找一下带「我同意」的那句原文。"
DISCUSS = "狗狗，我想聊个问题：如果我只给赞同的段落夹绿书签，下次会不会又只读到我本来就相信的东西？"
API = "/api/roundtable/chat"


def button(scope, name):
    return scope.get_by_role("button", name=name, exact=True)


def has_bookmark_facts(text):
    # Conservative check for this sample only; paraphrases outside the vocabulary
    # need a human look rather than silently passing on two lucky color guesses.
    return all(
        re.search(pattern, text)
        for pattern in (
            r"绿[^绿蓝。！？]{0,24}(?:同意|赞同|认同|赞成|认可|相信)",
            r"蓝[^绿蓝。！？]{0,24}(?:再想|想再|再考虑|思考|琢磨|斟酌|存疑|保留|疑问|不确定)",
        )
    )


def run(p, base, shots, live):
    posts, errors = [], []
    p.on(
        "request",
        lambda r: posts.append(urlsplit(r.url).path) if r.method == "POST" else None,
    )
    p.on("pageerror", lambda e: errors.append(str(e)))
    # Observe the settled UI, not the first dev-mode GET (React may abort it after headers).
    p.goto(base, wait_until="domcontentloaded")
    feed = p.locator(".feed-heading small")
    expect(feed).to_have_text(re.compile("实时书单|暂未连上书单"), timeout=25000)
    sample_shelf = feed.inner_text() == "暂未连上书单"
    print(
        "Hot list:",
        (
            "degraded; local sample shelf"
            if sample_shelf
            else "available; using a sample permalink"
        ),
    )

    def open_sample(title, slug):
        # When the public feed is available the sample shelf isn't shown. The original
        # samples also have stable links, so this test never depends on a live ranking.
        if sample_shelf:
            button(p.locator(".sample-shelf"), title).click()
        else:
            p.goto(base + "/?sample=" + slug)
        article = p.locator("article[data-read-index]").filter(has_text=title)
        expect(article.locator("[data-passage-text]")).to_be_visible()
        return article

    def shot(locator, name):
        if shots:
            locator.screenshot(path=str(shots / (name + ".png")), animations="disabled")

    def say(text):
        room.get_by_role("textbox", name="我也说一句").fill(text)
        button(room, "发送消息").click()

    def saved_turns():
        return p.evaluate(
            "JSON.parse(localStorage.getItem('fr.companion.v1')).threads.reduce((n,t)=>n+t.turns.length,0)"
        )

    def online(action, *, allow_pass=False):
        with p.expect_response(
            lambda r: urlsplit(r.url).path == API and r.request.method == "POST",
            timeout=35000,
        ) as response:
            action()
        r = response.value
        obj = r.json()
        assert r.ok, (r.status, obj.get("error"))
        if obj.get("source") == "reader_floor":
            assert (
                allow_pass
                and r.request.post_data_json["mode"] == "handoff"
                and "reply" not in obj
            )
            expect(room.locator(".pet-test-floor")).to_contain_text("话头留给你")
            return r.request.post_data_json, None
        assert obj.get("source") == "model", obj
        reply = obj["reply"]
        expect(bubble.locator(".voice-source")).to_have_text("模型回复")
        expect(bubble).to_have_attribute("data-speaker", reply["speaker"])
        expect(bubble.locator(".message-bubble")).to_have_text(reply["text"])
        print(
            obj.get("model"),
            bubble.locator(".message-byline strong").inner_text() + "：" + reply["text"],
        )
        return r.request.post_data_json, reply

    expect(button(p, "阅读记录（0篇）")).to_be_visible()
    open_sample(NOTEBOOK, "weekend-notebook")
    button(p, "返回热榜").click()
    expect(button(p, "阅读记录（0篇）")).to_be_visible()
    article = open_sample(READ, "two-bookmarks")
    body = article.locator("[data-passage-text]").text_content()
    expect(article.get_by_text("看山已记下", exact=True)).to_be_visible(timeout=8000)
    button(p, "阅读记录（1篇）").click()
    shelf = p.get_by_role("dialog", name="阅读记录与聊天")
    rows = shelf.locator(".shelf-row")
    expect(rows).to_have_count(1)
    expect(rows.locator("h3")).to_have_text(READ)
    expect(rows.locator("small")).to_contain_text("读过 1 次")
    print("Reading: skim omitted; dwell saved once:", READ)
    shot(shelf, "01-notebook")
    button(shelf, "关闭记录").click()
    button(p, "打开毛茸茸小屋").click()
    room = p.get_by_role("dialog", name="毛茸茸小屋")
    bubble = latest_pet(room)
    expect(room.locator(".room-context b")).to_have_text(READ)
    expect(room.locator(".room-context")).to_contain_text("本地试读")
    sample_line = (
        room.locator(".table-reading q, .gather-note p").first.text_content().strip()
    )
    assert sample_line and sample_line in body, (sample_line, body[:100])
    assert API not in posts and "/api/roundtable/analyze" not in posts, posts
    print(
        "Pet opened the correct article; entry excerpt verified; no chat/analyze POST yet."
    )
    shot(room, "02-room")

    gap = None
    if live:
        expect(room.locator(".pet-test-floor")).to_contain_text(
            "在线联调", timeout=10000
        )
        # No implicit upload. Only after the reader pins the visible excerpt may the same
        # question and the next speaker receive it, without the reader typing a fact.
        say(BLIND)
        expect(bubble.locator(".voice-source")).to_have_text("本机回复")
        assert API not in posts
        button(room, "把这段放上桌").click()
        assert API not in posts
        print("Blind question (explicitly shared preview, no facts typed):", BLIND)
        packet, blind = online(lambda: say(BLIND))
        assert packet == {
            "mode": "reader",
            "turns": [{"speaker": "user", "text": BLIND}],
            "reading": {"title": READ, "excerpt": sample_line},
        }, packet
        print(
            "First model request contained only the visible excerpt, its title and the new question."
        )
        shot(room, "03-blind-question")
        if not has_bookmark_facts(sample_line) or not has_bookmark_facts(blind["text"]):
            gap = "桌上有直接依据，但回答没有把两种颜色与用途准确对应。"
        # The answer exists later in this very article, not on the table. A genuine but irrelevant
        # quote, or a lucky “two pages”, is a failure, not a grounded answer.
        assert "两页" in body and "页" not in sample_line
        pkt, outside = online(lambda: say(OUTSIDE))
        assert (
            pkt["reading"] == packet["reading"] and pkt["turns"][-1]["text"] == OUTSIDE
        )
        assert "两页" not in json.dumps(pkt, ensure_ascii=False)
        assert (
            outside["speaker"] == "kanshan"
            and re.search("没.{0,8}(写|说|提)|不能确定", outside["text"])
            and not re.search(
                r"[一二两三四五六七八九十0-9]+\s*页|「[^」]*书签[^」]*」",
                outside["text"],
            )
        ), outside
        shot(room, "03b-outside-excerpt")
    before = list(posts)
    say(SOURCE)
    if live:
        expect(bubble.locator(".voice-source")).to_have_text("本机回复")
    expect(bubble).to_have_attribute("data-speaker", "owl")
    card = bubble.locator(".evidence-card")
    quote = card.locator("q").inner_text()
    assert "我同意" in quote and quote in body, quote
    expect(card).to_contain_text(READ)
    assert urlsplit(card.get_attribute("href")).query == "sample=two-bookmarks"
    assert before == posts, posts
    print("Local owl quote (verbatim, no POST):", quote)
    shot(room, "04-evidence")

    last_text = bubble.locator(".message-bubble").inner_text()
    transcript = [SOURCE, last_text]
    if live:
        packet, first = online(lambda: say(DISCUSS))
        assert packet["turns"][-1] == {"speaker": "user", "text": DISCUSS}
        assert first["speaker"] == "shiba"
        before_handoff = saved_turns()
        handoff, second = online(
            lambda: button(room, "听另一位接话").click(), allow_pass=True
        )
        assert handoff["mode"] == "handoff" and handoff["turns"][-2:] == [
            packet["turns"][-1],
            first,
        ]
        if second:
            assert second["speaker"] != first["speaker"]
        else:
            expect(bubble.locator(".message-bubble")).to_have_text(first["text"])
        expect(button(room, "听另一位接话")).to_have_count(0)
        expect(room.locator(".room-error")).to_have_count(0)
        assert saved_turns() == before_handoff + int(second is not None)
        # The reader has already supplied their complete dilemma; no need to upload the page again.
        assert "reading" not in packet and "reading" not in handoff
        print(
            "Handoff input includes the actual reader question and full previous reply."
        )
        shot(room, "05-handoff")
        last_text = (second or first)["text"]
        transcript += [
            BLIND,
            blind["text"],
            OUTSIDE,
            outside["text"],
            DISCUSS,
            first["text"],
            *([second["text"]] if second else []),
        ]
    button(room, "关闭小屋").click()
    p.reload()
    button(p, "阅读记录（1篇）").click()
    button(shelf, re.compile("^过去的聊天")).click()
    row = rows.filter(has_text=READ)
    button(row, "继续这段聊天 →").click()
    expect(room.locator(".room-context b")).to_have_text(READ)
    expect(bubble.locator(".message-bubble")).to_have_text(last_text)
    log = room.get_by_role("log", name="聊天记录")
    for text in transcript:
        expect(log).to_contain_text(text)
    print("Reload: same article and saved turns restored.")

    # Read the previously skimmed article for real, in this same browser. Its new
    # table should not contain the old conversation. Explicit reopening still can.
    button(room, "关闭小屋").click()
    if button(p, "返回热榜").count():
        button(p, "返回热榜").click()
    other = open_sample(NOTEBOOK, "weekend-notebook")
    expect(other.get_by_text("看山已记下", exact=True)).to_be_visible(timeout=8000)
    other_body = other.locator("[data-passage-text]").text_content()
    expect(button(p, "阅读记录（2篇）")).to_be_visible()
    button(p, "打开毛茸茸小屋").click()
    expect(room.locator(".room-context b")).to_have_text(NOTEBOOK)
    expect(room.get_by_role("log").locator(".round-message")).to_have_count(0)
    button(room, "开聊 · 听呼噜猫说").click()
    expect(bubble).to_have_attribute("data-speaker", "purr_cat")
    button(room, re.compile("^听下一句")).click()
    expect(bubble).to_have_attribute("data-speaker", "owl")
    new_quote = room.locator(".evidence-card q").inner_text()
    assert new_quote and new_quote in other_body and new_quote not in body, new_quote
    print(
        "After a new read: switched articles; local guide: cat -> owl with new quote:",
        new_quote,
    )
    shot(room, "06-next-article")
    button(room, "关闭小屋").click()
    button(p, "阅读记录（2篇）").click()
    expect(rows).to_have_count(2)
    expect(rows.filter(has_text=READ).locator("small")).to_contain_text("读过 1 次")
    expect(rows.filter(has_text=NOTEBOOK).locator("small")).to_contain_text("读过 1 次")
    button(rows.filter(has_text=READ), "和它们聊这篇 →").click()
    expect(room.locator(".room-context b")).to_have_text(READ)
    expect(room.get_by_role("log").locator(".round-message")).to_have_count(0)
    button(room, "关闭小屋").click()
    button(p, "阅读记录（2篇）").click()
    button(shelf, re.compile("^过去的聊天")).click()
    button(rows.filter(has_text=READ), "继续这段聊天 →").click()
    expect(bubble.locator(".message-bubble")).to_have_text(last_text)
    assert (
        posts.count(API) == (4 if live else 0)
        and "/api/roundtable/analyze" not in posts
    ), posts
    assert not errors, errors
    print(
        "Selecting the article alone starts a single-source table; selecting its old chat restores the conversation without a new model call."
    )
    return gap


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base", default="http://127.0.0.1:3100")
    ap.add_argument("--live", action="store_true", help="allow real model calls")
    ap.add_argument("--shots", type=Path, help="optional evidence directory")
    args = ap.parse_args()
    if urlsplit(args.base).hostname not in ("127.0.0.1", "localhost", "::1"):
        ap.error("requires a local test server")
    if args.shots:
        args.shots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="msedge")
        ctx = browser.new_context(
            reduced_motion="reduce", viewport={"width": 1280, "height": 900}
        )
        if not args.live:
            ctx.route(
                "**/api/zhihu/**",
                lambda r: r.fulfill(
                    json={"degraded": True, "live": False, "items": []}
                ),
            )
            # Default runs may never reach a real pet provider; run() separately asserts 0 POSTs.
            ctx.route(
                "**/api/roundtable/chat",
                lambda r: (
                    r.fulfill(json={"enabled": False})
                    if r.request.method == "GET"
                    else r.fulfill(status=503, json={"error": "offline"})
                ),
            )
        try:
            gap = run(ctx.new_page(), args.base.rstrip("/"), args.shots, args.live)
        finally:
            ctx.close()
            browser.close()
    if gap:
        raise SystemExit("SCENARIO NOT MET: " + gap)
