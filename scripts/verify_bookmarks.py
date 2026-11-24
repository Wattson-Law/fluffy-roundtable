"""Sentence-to-cabin browser acceptance. Pass --public to also exercise two genuine answers
served by the configured app (see README; never coerces a trial into a Zhihu answer)."""

import argparse
import re
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect


def button(scope, label):
    return scope.get_by_role("button", name=label, exact=True)


def say(page, text):
    page.get_by_role("textbox", name="我也说一句").fill(text)
    button(page, "发送消息").click()


def mark_native(page, article, text):
    article.locator("[data-passage-text]").evaluate(
        """(el, text) => {
      const node=el.firstChild, start=node.textContent.indexOf(text);
      if(start<0) throw Error('passage not available');
      const r=new Range(); r.setStart(node,start); r.setEnd(node,start+text.length);
      const s=getSelection(); s.removeAllRanges(); s.addRange(r);
      document.dispatchEvent(new Event('selectionchange'));
    }""",
        text,
    )
    button(article, "拿这句去圆桌").click()


def open_owl(p):
    button(p, "开聊 · 听呼噜猫说").click()
    p.get_by_role("button", name=re.compile("^听下一句")).click()


def save_card(p):
    step = p.get_by_role("button", name=re.compile("^听下一句"))
    for _ in range(12):
        if not step.count():
            break
        step.click()
    if button(p, "接过看山的掌控卡").count():
        button(p, "接过看山的掌控卡").click()
    else:
        details = p.locator(".context-details")
        if details.get_attribute("open") is None:
            details.locator("summary").click()
        button(details, "查看这篇的掌控卡 →").click()
    button(p, "我拍板，收进手账").click()


def read_passage(p, text, opener, shot=None):
    opener.click()
    source = p.get_by_role("dialog", name="书签原段")
    expect(source.locator("mark")).to_have_text(text)
    expect(
        source.get_by_text("夹签时保存的摘录", exact=True).or_(
            source.get_by_text("已定位到正文", exact=True)
        )
    ).to_be_visible()
    if shot:
        source.screenshot(path=str(shot))
    p.keyboard.press("Escape")
    expect(source).to_have_count(0)


def trial(browser, base, mobile=False, shots=None):
    ctx = browser.new_context(
        viewport={"width": 360 if mobile else 1280, "height": 640 if mobile else 880},
        reduced_motion="reduce",
        has_touch=mobile,
    )
    p = ctx.new_page()
    errors = []
    posts = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.on("request", lambda r: posts.append(r.url) if r.method == "POST" else None)
    p.goto(base + "/?sample=weekend-notebook")
    row = p.locator("article[data-read-index]").first
    quote = "可是当我把书合上，能让我重新找到这一页的，反倒是那个没有写完的问题。"
    if mobile:
        button(row, "逐句挑选").focus()
        p.keyboard.press("Enter")
        pick = row.get_by_role("button", name=quote, exact=True)
        if not pick.count():
            button(row, "后几句").click()
        pick.click()
        button(row, "拿这句去圆桌").click()
    else:
        expect(button(row, "逐句挑选")).to_be_visible(timeout=3000)
        exp = button(row, "阅读全文")
        if exp.count():
            exp.click()
        p.get_by_role("button", name=re.compile("^阅读记录")).click()
        button(p, "清空记录").click()
        button(p, "确认清空阅读和聊天").click()
        button(p, "关闭记录").click()
        mark_native(p, row, quote)
    room = p.get_by_role("dialog", name="毛茸茸小屋")
    expect(room.locator(".bookmark-ticket q")).to_have_text(quote)
    open_owl(p)
    expect(room.locator(".evidence-card q").first).to_have_text(quote)
    expect(room.locator(".bookmark-ticket q, .evidence-card q")).to_have_count(1)
    if shots and not mobile:
        p.evaluate("document.fonts.ready")
        room.screenshot(path=str(shots / "desktop-cabin.png"))
    read_passage(
        p,
        quote,
        room.locator(".evidence-card").first,
        (shots / "mobile-source.png") if shots and mobile else None,
    )
    if not mobile:
        p.clock.install()
        p.clock.pause_at(p.evaluate("new Date(Date.now()+1500).toISOString()"))
        say(p, "两种方法里我还没选好")
        button(p, "关闭小屋").click()
        p.clock.fast_forward(310_000)
        expect(p.locator(".cat-note p")).to_have_text("有空聊两句吗？")
        expect(p.locator(".cat-note")).not_to_contain_text(quote)
        button(p, "回猫猫一句").click()
        expect(room.locator(".speech-paper")).to_contain_text("书签")
        room.locator(".context-details summary").click()
        expect(room.locator(".bookmark-ticket q")).to_have_text(quote)
        button(p, "关闭小屋").click()
        p.get_by_role("button", name=re.compile("^阅读记录")).click()
        p.get_by_role("button", name="继续这张书签：" + quote).click()
        room.locator(".context-details summary").click()
        expect(room.locator(".bookmark-ticket q")).to_have_text(quote)
    save_card(p)
    button(p, "关闭小屋").click()
    p.reload()
    p.get_by_role("button", name=re.compile("^猫咖手账")).click()
    read_passage(p, quote, button(p, "回到原段"))
    assert not posts and not errors, (posts, errors)
    assert p.evaluate("document.documentElement.scrollWidth <= innerWidth")
    ctx.close()
    print(
        "PASS",
        "mobile picker" if mobile else "desktop selection + local reminder",
        "→ exact owl → highlighted source → saved card after reload.",
    )


def public_answers(browser, base, query):
    """Use the real UI and production routes. Source selection is by actual comments, not commentCount."""
    ctx = browser.new_context(
        viewport={"width": 1080, "height": 820}, reduced_motion="reduce"
    )
    # Reading the text suffices; never send browser activity to avatar CDNs.
    ctx.route(re.compile(r"^https://"), lambda r: r.abort())
    p = ctx.new_page()
    errors = []
    p.on("pageerror", lambda e: errors.append(str(e)))
    p.goto(base)
    search = p.get_by_role("textbox", name="搜索知乎问题")
    search.fill(query)
    with p.expect_response(lambda r: "/api/zhihu/search?" in r.url) as found:
        search.press("Enter")
    results = found.value.json()
    assert not results.get("degraded"), "知乎搜索不可用，不能作为真实验收"
    rows = results["items"]
    cases = {}
    for i, r in enumerate(rows):
        if (
            r.get("contentType", "").lower() != "answer"
            or not r.get("contentText", "").strip()
            or "/answer/" not in r["url"]
        ):
            continue
        has = bool(r.get("comments"))
        cases.setdefault(has, (i, r))
    assert len(cases) == 2, "本次公开搜索未同时返回有/无精选评论的回答；不使用补造数据"
    for has in [True, False]:
        i, r = cases[has]
        row = p.locator("article[data-read-index]").nth(i)
        button(row, "逐句挑选").click()
        options = row.locator("[data-sentence]")
        iopt = 1 if options.count() > 1 else 0
        selected = options.nth(iopt).inner_text()
        assert selected in r["contentText"]
        options.nth(iopt).click()
        with p.expect_response(lambda x: "/api/roundtable/analyze" in x.url) as got:
            button(row, "拿这句去圆桌").click()
        report = got.value.json()
        request = got.value.request.post_data_json
        assert [t["id"] for t in request["trail"]] == [r["id"]] and request["focus"][
            "excerpt"
        ] == selected
        assert (
            "turns" not in request
            and "bookmark" not in request
            and "before" not in request["focus"]
        )
        room = p.get_by_role("dialog", name="毛茸茸小屋")
        button(room, "关闭小屋").click()
        p.get_by_role("button", name=re.compile("^阅读记录")).click()
        p.get_by_role("button", name="继续这张书签：" + selected).click()
        open_owl(p)
        read_passage(p, selected, room.locator(".evidence-card").first)
        say(p, "想看看读者评论")
        dogdata = report["dialogues"]
        dog = next(d for d in dogdata if d["speaker"] == "shiba")
        if has:
            comment = dog["quoteRef"]
            assert (
                any(comment["excerpt"] in c for c in r["comments"])
                and comment["sourceUrl"] == r["url"]
            )
            expect(room.locator(".evidence-card").first).to_contain_text("读者留言")
            expect(room.locator(".evidence-card q").first).to_have_text(
                comment["excerpt"]
            )
        else:
            assert not dog.get("quoteRef") and "没有" in dog["text"]
            expect(room.locator(".speech-paper")).to_contain_text(
                "没有这篇可核对的读者评论"
            )
        save_card(p)
        button(room, "关闭小屋").click()
        p.get_by_role("button", name=re.compile("^猫咖手账")).click()
        card = p.locator(".journal-entry").first
        expect(card.locator(".bookmark-ticket q")).to_have_text(selected)
        assert r["url"] in card.locator(".source-list a").evaluate_all(
            "(links)=>links.map(a=>a.href)"
        )
        button(p, "关闭手账").click()
        print(
            "PASS genuine answer:",
            "with sourced reader comment" if has else "no featured comment returned",
            "→ history → exact passage → saved card;",
            urlsplit(r["url"])._replace(query="", fragment="").geturl(),
        )
    p.reload()
    p.get_by_role("button", name=re.compile("^阅读记录")).click()
    button(p, "清空记录").click()
    # Confirm in the same shelf, then verify journals retain just the clipped context.
    button(p, "确认清空阅读和聊天").click()
    button(p, "关闭记录").click()
    p.get_by_role("button", name=re.compile("^猫咖手账")).click()
    card = p.locator(".journal-entry").first
    button(card, "回到原段").click()
    source = p.get_by_role("dialog", name="书签原段")
    expect(source.get_by_text("夹签时保存的摘录", exact=True)).to_be_visible()
    expect(source.locator("mark")).to_have_text(selected)
    assert not errors, errors
    ctx.close()


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--base", default="http://127.0.0.1:3100")
    a.add_argument("--channel", default="msedge")
    a.add_argument("--public", metavar="QUERY")
    a.add_argument("--shots", type=Path)
    args = a.parse_args()
    if args.shots:
        args.shots.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel=args.channel, headless=True)
        trial(browser, args.base, shots=args.shots)
        trial(browser, args.base, True, args.shots)
        if args.public:
            public_answers(browser, args.base, args.public)
        browser.close()
