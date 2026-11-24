"""Exercise the real trial twice: with synthetic words/feedback, never research participants."""
import argparse
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import unquote, urlsplit
from zipfile import ZipFile
from playwright.sync_api import expect, sync_playwright

PRIVATE = "TRIAL_PRIVATE_WORDS_042"
HOST = "HOST_HISTORY_NOT_FOR_TRIAL"
ANSWERS = ["是", "没有", "没试到／说不清"]
# Same origin as the real shelf. No access to real browser profiles.
SEED = """(() => {
 if (!['http:', 'https:', 'file:'].includes(location.protocol)) return;
 window.addEventListener('pageshow', e => { window.trialRestored = e.persisted; });
 const sample = 'HOST_HISTORY_NOT_FOR_TRIAL';
 const keys = ['fr.companion.v1', 'fr.readingHistory.v1', 'fr.readingTrail', 'fr.journalCats'];
 const p = Storage.prototype, get = p.getItem, set = p.setItem, keyAt = p.key;
 if (!get.call(localStorage, keys[0])) for (const k of keys) set.call(localStorage, k, sample);
 window.trialCheckStorage = () => [localStorage, sessionStorage].map(s =>
   Object.fromEntries(Array.from({length:s.length}, (_, i) => {
     const k = keyAt.call(s, i); return [k, get.call(s, k)];
   })));
 for (const method of ['getItem','setItem','removeItem','clear','key']) {
   const real = p[method];
   p[method] = function(...args) {
     if (method==='clear' || method==='key' || String(args[0]).startsWith('fr.') ||
         args.some(v=>String(v).includes('TRIAL_PRIVATE_WORDS_042'))) console.error('TRIAL_STORAGE_ACCESS');
     return real.apply(this, args);
   };
 }
})()"""


def btn(root, name):
    return root.get_by_role("button", name=name, exact=True)


def home_entry(browser, base):
    ctx = browser.new_context(viewport={"width": 360, "height": 800})
    ctx.route("**/api/zhihu/**", lambda route: route.fulfill(json={"items": [], "live": False, "degraded": True}))
    p = ctx.new_page()
    p.goto(base)
    invite = p.locator('a[href="/trial"]')
    expect(invite).to_be_visible()
    invite.click()
    expect(p.get_by_role('heading', name='窗边试聊', exact=True)).to_be_visible()
    ctx.close()


def exercise(browser, url, narrow=False, screenshot=None):
    ctx = browser.new_context(viewport={"width": 360 if narrow else 1280, "height": 800},
                              locale="zh-CN", reduced_motion="reduce" if narrow else "no-preference",
                              service_workers="block")
    origin = urlsplit(url)
    forbidden, problems, writes = [], [], []

    def guard(route):
        r, dest = route.request, urlsplit(route.request.url)
        static = (dest.netloc == origin.netloc and (dest.path == origin.path or
                  dest.path.startswith('/_next/static/') or dest.path == '/favicon.ico'))
        if (dest.scheme in ('http', 'https') and (origin.scheme == 'file' or not static)) or (
                r.method not in ('GET', 'HEAD') or PRIVATE in unquote(r.url) or r.post_data):
            forbidden.append(dest.path)
            route.abort()
        else:
            route.continue_()

    ctx.route('**/*', guard)
    ctx.add_init_script(SEED)
    p = ctx.new_page()
    p.on('pageerror', lambda err: problems.append(str(err)))
    p.on('websocket', lambda _: forbidden.append('websocket'))
    p.on('console', lambda m: writes.append(m.text) if m.text == 'TRIAL_STORAGE_ACCESS' else None)
    resp = p.goto(url)
    assert resp is None or resp.ok, f'trial entry unavailable: {resp and resp.status}'
    welcome = p.get_by_role('heading', name='窗边试聊', exact=True)
    expect(welcome).to_be_visible()
    snapshot = p.evaluate('trialCheckStorage()')
    if screenshot:
        screenshot.parent.mkdir(parents=True, exist_ok=True)
        p.screenshot(path=str(screenshot), full_page=True, animations='disabled')
    assert p.evaluate('document.documentElement.scrollWidth <= innerWidth')
    room = p.get_by_role('dialog', name='毛茸茸小屋')
    field = room.get_by_role('textbox', name='我也说一句')

    def open_seat(label='打开小屋'):
        btn(p, label).click()
        expect(field).to_be_visible(timeout=7000)

    def end_table():
        btn(room, '关闭小屋').click()
        btn(p, '填这桌反馈').click()
        expect(p.get_by_role('heading', name='这桌，聊得怎么样？')).to_be_visible()
        expect(p.locator('body')).not_to_contain_text(PRIVATE)
        assert not p.get_by_role('radio', checked=True).count()

    def mark(choices, label):
        for group, choice in zip(p.locator('fieldset').all(), choices, strict=True):
            if choice is not None:
                group.get_by_role('radio', name=choice, exact=True).check()
        btn(p, label).click()

    btn(p, '开始试聊').click()
    open_seat()
    announce = room.locator('.room-scene [role=status]')
    expect(announce).to_have_text('')
    field.fill('帮我分析一下，' + PRIVATE)
    btn(room, '发送消息').click()
    expect(room.locator('.speech-paper strong')).to_have_text('考据猫头鹰')
    expect(announce).to_contain_text('考据猫头鹰')
    field.fill('不用分析了，给我打打气吧。')
    btn(room, '发送消息').click()
    expect(room.locator('.speech-paper strong')).to_have_text('护短柴犬')
    field.fill(PRIVATE + '_draft')
    before = room.locator('.transcript-head button').inner_text()
    btn(room, '关闭小屋').click()
    expect(p.locator('body')).not_to_contain_text(PRIVATE)
    open_seat('回到这桌')
    expect(field).to_have_value(PRIVATE + '_draft')
    expect(room.locator('.transcript-head button')).to_have_text(before)
    end_table()
    expect(btn(p, '去第二桌')).to_be_enabled()
    mark(ANSWERS, '去第二桌')
    open_seat()
    expect(field).to_have_value('')
    expect(room.locator('.transcript')).to_have_count(0)
    field.fill('我想去，给我打打气，就是十点下班，末班车九点半。' + PRIVATE)
    btn(room, '发送消息').click()
    expect(room.locator('.speech-paper')).to_contain_text('回家')
    expect(room.locator('.speech-paper p')).not_to_contain_text('利弊')
    end_table()
    mark(list(reversed(ANSWERS)), '查看反馈卡')
    with p.expect_download() as d:
        btn(p, '下载匿名反馈卡').click()
    card = json.loads(Path(d.value.path()).read_text(encoding='utf-8'))
    assert card == {'format': 'window-seat/v1', 'change': {'fit':'yes','pushed':'no','repeated':'unsure'},
                    'support': {'fit':'unsure','pushed':'no','repeated':'yes'}}
    btn(p, '交给下一位读者').click()
    expect(welcome).to_be_visible()
    assert not p.locator('input:checked').count()
    cards = [card]
    if narrow:
        # Four further handoffs through the actual UI; partial and empty ballots are intentional.
        cases = [([0, None, 1], [1, None, 0]), ([1, 1, 0], [0, 2, 1]),
                 ([2, 0, None], [None, 0, None]), ([None] * 3, [None] * 3)]
        keys = ('fit', 'pushed', 'repeated')
        for who, pair in enumerate(cases, 2):
            expected = {'format': 'window-seat/v1'}
            btn(p, '开始试聊').click()
            for scene, codes in zip(('change', 'support'), pair, strict=True):
                open_seat()
                expect(field).to_have_value('')
                expect(room.locator('.transcript')).to_have_count(0)
                field.fill(f'给我打打气吧。{PRIVATE}{who}')
                btn(room, '发送消息').click()
                expect(room.locator('.speech-paper')).to_contain_text('相信')
                end_table()
                mark([ANSWERS[c] if c is not None else None for c in codes],
                     '去第二桌' if scene == 'change' else '查看反馈卡')
                expected[scene] = dict(zip(keys, [('yes', 'no', 'unsure')[c] if c is not None else 'unsure' for c in codes], strict=True))
            with p.expect_download() as d:
                btn(p, '下载匿名反馈卡').click()
            actual = json.loads(Path(d.value.path()).read_text(encoding='utf-8'))
            assert actual == expected
            cards.append(actual)
            btn(p, '交给下一位读者').click()
            expect(welcome).to_be_visible()
    p.get_by_text('主持人：汇总反馈卡', exact=True).click()
    details = p.locator('details')
    picker = p.get_by_label('选择反馈卡')
    files = [{'name': 'feedback.json', 'mimeType':'application/json', 'buffer':json.dumps(c).encode()} for c in cards]
    # A host can add individually, including cards from different directories with the same name.
    for i, file in enumerate(files, 1):
        picker.set_input_files([file])
        expect(details.get_by_role('status')).to_contain_text(f'{i} 份')
    table = p.get_by_role('table')
    expect(table).to_contain_text(f'{len(cards)} 份')
    for row, (scene, key) in zip(table.locator('tbody tr').all(),
            [(s,k) for s in ('change','support') for k in ('fit','pushed','repeated')], strict=True):
        assert row.locator('td').all_text_contents() == [str(sum(c[scene][key] == m for c in cards)) for m in ('yes','no','unsure')]
    btn(p, '清空汇总').click()
    expect(table).to_have_count(0)
    bad = {**files[0], 'buffer': json.dumps({**card, 'private': PRIVATE}).encode()}
    picker.set_input_files([files[0], bad])
    expect(details.get_by_role('alert')).to_be_visible()
    expect(table).to_have_count(0)
    picker.set_input_files(files)
    expect(details.get_by_role('status')).to_contain_text(f'{len(cards)} 份')
    if len(cards) == 5:
        picker.set_input_files([files[0]])
        expect(details.get_by_role('alert')).to_be_visible()
        expect(table).to_contain_text('5 份')
    expect(p.locator('body')).not_to_contain_text(PRIVATE)
    btn(p, '开始试聊').click()
    open_seat()
    expect(field).to_have_value('')
    expect(room.locator('.transcript')).to_have_count(0)
    field.fill(PRIVATE)
    btn(room, '关闭小屋').click()
    btn(p, '丢弃本次试聊').click()
    expect(welcome).to_be_visible()
    btn(p, '开始试聊').click()
    open_seat()
    expect(field).to_have_value('')
    field.fill(PRIVATE)
    p.reload()
    expect(welcome).to_be_visible()
    expect(room).to_have_count(0)
    assert p.evaluate('trialCheckStorage()') == snapshot
    assert HOST not in p.locator('body').inner_text()
    assert not (problems or forbidden or writes), (problems, forbidden, writes)
    # Skipping is not a positive observation; it can't produce a yes by accident.
    btn(p, '开始试聊').click()
    btn(p, '略过这桌').click()
    btn(p, '略过这桌').click()
    expect(p.get_by_role('heading', name='这是你的反馈卡')).to_be_visible()
    assert p.locator('.trial-receipt dd').all_text_contents() == [ANSWERS[2]] * 6
    btn(p, '交给下一位读者').click()
    btn(p, '开始试聊').click()
    open_seat()
    field.fill(PRIVATE)
    p.goto('about:blank')
    # A restored BFCache page doesn't fire a second load event.
    p.go_back(wait_until='commit')
    expect(welcome).to_be_visible()
    expect(room).to_have_count(0)
    assert p.evaluate('trialCheckStorage()') == snapshot
    assert not (problems or forbidden or writes), (problems, forbidden, writes)
    p.wait_for_function('window.trialRestored !== undefined')
    restored = p.evaluate('trialRestored')
    ctx.close()
    print(f"PASS {origin.scheme}: {'360px' if narrow else 'desktop'}; {len(cards)} synthetic handoff(s); Back via {'BFCache' if restored else 'fresh load'}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://127.0.0.1:3100')
    parser.add_argument('--zip', type=Path)
    parser.add_argument('--channel')
    parser.add_argument('--screenshot', type=Path)
    args = parser.parse_args()
    with sync_playwright() as pw, TemporaryDirectory() as directory:
        browser = pw.chromium.launch(channel=args.channel, ignore_default_args=['--disable-back-forward-cache'])
        home_entry(browser, args.base)
        urls = [args.base.rstrip('/') + '/trial']
        if args.zip:
            with ZipFile(args.zip) as z:
                assert z.namelist() == ['window-seat.html']
                urls.append(Path(z.extract('window-seat.html', directory)).as_uri())
        for url in urls:
            for narrow in (False, True):
                exercise(browser, url, narrow, args.screenshot if url == urls[0] and not narrow else None)
        browser.close()


if __name__ == '__main__':
    main()
