"""Seed an old two-article table; verify a fresh single-article request never submits its neighbour."""

from round_chat_locators import latest_pet
import argparse, json, re
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect


def run(browser, base):
    ctx = browser.new_context(reduced_motion="reduce")
    ctx.route(
        "**/api/zhihu/**", lambda r: r.fulfill(json={"degraded": True, "items": []})
    )
    ctx.route("**/api/roundtable/chat", lambda r: r.fulfill(json={"enabled": False}))
    payloads = []

    def analyze(r):
        payloads.append(r.request.post_data_json)
        r.fulfill(status=503, json={})

    ctx.route("**/api/roundtable/analyze", analyze)
    rows = [
        dict(
            id=str(i),
            title=t,
            readAt=i,
            url=f"https://www.zhihu.com/question/42/answer/{i}",
            contentText=body,
            author="试验",
            comments=[],
        )
        for i, t, body in [
            (81, "甲页", "只属于旧桌的甲句。"),
            (82, "乙页", "阅读记录中单选的乙句。"),
        ]
    ]
    old = dict(
        key="old-two",
        title="乙页",
        context=rows,
        cursor=0,
        turns=[
            dict(id="old", speaker="user", kind="typed", text="以前的双篇聊天", at=4)
        ],
        touched=4,
        conversation={"need": "ack"},
    )
    p = ctx.new_page()
    p.add_init_script(
        'localStorage.setItem("fr.readingHistory.v1",'
        + json.dumps(json.dumps(rows))
        + ');localStorage.setItem("fr.companion.v1",'
        + json.dumps(
            json.dumps(
                dict(
                    version=1, enabled=False, threads=[old], pending=None, lastNudgeAt=0
                )
            )
        )
        + ");"
    )
    p.goto(base)
    p.get_by_role("button", name="阅读记录（2篇）").click()
    s = p.get_by_role("dialog", name="阅读记录与聊天")
    s.locator("article").filter(has_text="乙页").get_by_role(
        "button", name="和它们聊这篇 →"
    ).click()
    r = p.get_by_role("dialog", name="毛茸茸小屋")
    expect(r.locator(".room-context")).to_contain_text("乙页")
    go = r.get_by_role("button", name="开聊 · 听呼噜猫说")
    if not go.count():
        r.locator(".context-details summary").click()
        go = r.get_by_role("button", name="单独整理这篇的资料 →")
    with p.expect_response("**/api/roundtable/analyze"):
        go.click()
    assert [a["id"] for a in payloads[0]["trail"]] == ["82"], [
        a["id"] for a in payloads[0]["trail"]
    ]
    assert "只属于旧桌" not in json.dumps(payloads, ensure_ascii=False)
    r.get_by_role("button", name="关闭小屋").click()
    p.get_by_role("button", name="阅读记录（2篇）").click()
    s.get_by_role("button", name=re.compile("^过去的聊天")).click()
    s.locator("article").filter(has_text="乙页").get_by_role(
        "button", name="继续这段聊天 →"
    ).click()
    expect(r.get_by_role("log")).to_contain_text("以前的双篇聊天")
    assert len(payloads) == 1
    ctx.close()
    print(
        "PASS single article submits B only; choosing the old conversation explicitly still restores it without a second request."
    )


def private_scope(browser, base):
    # No real provider, no prior browsing data or model credentials in this context.
    ctx = browser.new_context(reduced_motion="reduce")
    posts = []
    ctx.route(
        "**/api/zhihu/**", lambda r: r.fulfill(json={"items": [], "degraded": True})
    )

    def chat(r):
        if r.request.method == "GET":
            return r.fulfill(json={"enabled": True, "model": "fixture"})
        packet = r.request.post_data_json
        posts.append(packet)
        reading = packet.get("reading")
        r.fulfill(
            json={
                "source": "model",
                "reply": {
                    "speaker": "owl" if reading else "purr_cat",
                    "text": reading["excerpt"] if reading else "我在听。",
                },
            }
        )

    ctx.route("**/api/roundtable/chat", chat)
    p = ctx.new_page()
    p.goto(base + "/?sample=weekend-notebook")
    expect(p.get_by_text("看山已记下", exact=True)).to_be_visible(timeout=12000)
    p.get_by_role("button", name="打开毛茸茸小屋").click()
    r = p.get_by_role("dialog", name="毛茸茸小屋")
    bubble = latest_pet(r).locator(".message-bubble")

    def send(t):
        r.get_by_role("textbox", name="我也说一句").fill(t)
        r.get_by_role("button", name="发送消息").click()

    r.get_by_role("button", name="把这段放上桌").click()
    send("这篇里有几张便签？")
    expect(bubble).to_contain_text("三张便签")
    assert posts[0].get("reading")
    errand = "帮我列一份明天买菜的清单。"
    send(errand)
    expect(bubble).to_have_text("我在听。")
    assert posts[-1] == {
        "mode": "reader",
        "turns": [{"speaker": "user", "text": errand}],
    }
    sent = len(posts)
    send("今晚想睡了。")
    expect(bubble).to_contain_text("晚安")
    assert len(posts) == sent
    send("帮我记住，我家有一只猫。")
    expect(r.locator(".memory-slip")).to_contain_text("家里养猫")
    send("我最近在找工作，有点焦虑。")
    expect(r.locator(".memory-slip")).to_contain_text("找工作")
    expect(bubble).to_have_text("我在听。")
    send("忘了这件事。")
    expect(bubble).to_contain_text("不再作为伙伴的记忆")
    assert p.evaluate(
        "JSON.parse(localStorage.getItem('fr.companion.v1')).memories.map(m=>m.id)"
    ) == ["pet"]
    assert len(posts) == sent + 1
    ctx.close()
    print(
        "PASS actual model packets omit pinned B and earlier quotes for errands; bedtime stays local; forgetting the latest work slip keeps the earlier pet memory."
    )


if __name__ == "__main__":
    a = argparse.ArgumentParser()
    a.add_argument("--base", default="http://127.0.0.1:3100")
    args = a.parse_args()
    assert urlsplit(args.base).hostname in ("localhost", "127.0.0.1", "::1")
    with sync_playwright() as pw:
        b = pw.chromium.launch(channel="msedge")
        run(b, args.base)
        private_scope(b, args.base)
        b.close()
