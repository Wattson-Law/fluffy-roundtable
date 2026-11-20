"""Optional offline browser checks for the approved prototype; no service credentials used."""
import argparse
from pathlib import Path

from playwright.sync_api import sync_playwright

PAGE = Path(__file__).resolve().parents[2] / "public/previews/roundtable-v6.1/index.html"


def step(page, ms):
    page.evaluate("ms => RT.step(ms)", ms)


def state(page):
    return page.evaluate("RT.state()")


def portrait(page):
    return page.evaluate("""() => {
        const art = document.querySelector('#speakerArt');
        return {
          ids: [...art.querySelectorAll('img,canvas')].map(el => el.dataset.art || el.id),
          opacity: Number(getComputedStyle(art).opacity),
          bubble: Number(getComputedStyle(document.querySelector('#bubble')).opacity),
          pose: getComputedStyle(art).transform
        };
    }""")


def open_page(ctx, errors, requests, fragment=""):
    page = ctx.new_page()
    page.on("pageerror", lambda exc: errors.append(str(exc)))
    page.on("request", lambda req: requests.append(req.url) if req.url.startswith(("http:", "https:")) else None)
    page.goto(PAGE.as_uri() + fragment)
    page.evaluate("() => RT.ready.then(() => RT.manual())")
    return page


def walk_desktop(ctx, errors, requests):
    page = open_page(ctx, errors, requests)
    click = page.click
    click("#pet")
    step(page, 350)
    assert state(page)["phase"] == "opening"
    page.keyboard.press("Escape")
    step(page, 6800)
    assert state(page)["phase"] == "idle", "Cancelled opening resumed on its own"
    click("#pet")
    step(page, 2800)
    assert state(page)["phase"] == "gather"
    click("#start")
    step(page, 3700)
    assert portrait(page)["ids"] == ["cat1"]
    still = page.locator("#speakerArt").screenshot()
    step(page, 7500)
    assert page.locator("#speakerArt").screenshot() == still, "Portrait did not settle while reading"
    click("#next")
    step(page, 215)
    old = portrait(page)
    assert old["ids"] == ["cat1"] and 0 < old["opacity"] < 1 and old["bubble"] == 1
    step(page, 430)
    new = portrait(page)
    assert new["ids"] == ["owl1"] and 0 < new["opacity"] < 1 and new["bubble"] == 1
    step(page, 3000)
    click("#next")
    assert state(page)["phase"] == "choice" and portrait(page)["opacity"] == 1
    page.fill("#say", "我想找回上周的那条笔记")
    page.press("#say", "Enter")
    step(page, 1500)
    assert state(page)["branch"] == "note" and portrait(page)["ids"] == ["dog1"]
    click("#next")
    step(page, 1500)
    assert portrait(page)["ids"] == ["fox1"]
    click("#next")
    click("#makeCard")
    step(page, 800)
    assert state(page)["phase"] == "card" and state(page)["saved"] == 0
    click("#save")
    step(page, 900)
    assert state(page)["phase"] == "journal" and state(page)["saved"] == 1
    click("#backCard")
    step(page, 500)
    click("#save")
    step(page, 900)
    assert state(page)["saved"] == 1, "Duplicate journal entry"
    page.reload()
    page.evaluate("() => RT.ready.then(() => RT.manual())")
    click("#navJournal")
    step(page, 700)
    assert state(page)["saved"] == 1, "Journal entry did not survive reload"


def walk_mobile(ctx, errors, requests):
    page = open_page(ctx, errors, requests, "#portraits")
    assert state(page)["phase"] == "chat" and portrait(page)["ids"] == ["cat1"]
    page.click("#next")
    assert portrait(page) == {"ids": ["owl1"], "opacity": 1, "bubble": 1, "pose": "none"}
    page.click("#next")
    assert state(page)["phase"] == "choice"
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
    page.keyboard.press("Escape")
    assert page.locator("#pet").is_visible()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--channel", help="Chromium browser channel, e.g. msedge or chrome")
    args = parser.parse_args()
    errors, requests = [], []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel=args.channel, headless=True)
        desktop = browser.new_context(viewport={"width": 1320, "height": 820}, offline=True, locale="zh-CN")
        walk_desktop(desktop, errors, requests)
        desktop.close()
        mobile = browser.new_context(viewport={"width": 390, "height": 844}, offline=True, locale="zh-CN",
                                     is_mobile=True, has_touch=True, reduced_motion="reduce")
        walk_mobile(mobile, errors, requests)
        browser.close()
    assert not errors, errors
    assert not requests, "Unexpected network request in the offline prototype"
    print("PASS: desktop flow, portrait handoff, local journal, mobile/reduced motion; no external requests or page errors.")


if __name__ == "__main__":
    main()
