"""Round 2 acceptance: capture both viewport journeys using the local reading edition."""
import argparse
import re
from pathlib import Path
from playwright.sync_api import expect, sync_playwright
from verify_companion import boot, btn, shot

TITLE = "一页笔记，什么时候才算读完？"

def journey(browser, base, folder, width, height):
    ctx, page, errors, posts = boot(browser, base, width, height)
    def capture(name):
        page.locator('img:visible').evaluate_all('imgs => Promise.all(imgs.map(i => i.decode()))')
        shot(page, folder, name)
    try:
        expect(page.locator('.hero-voices li')).to_have_count(4)
        expect(btn(page, "两张书签，留下两种读法")).to_have_count(1)
        capture('01-home')
        btn(page, "认识四位伙伴").click()
        expect(page.locator('.guide-motto')).to_have_text('椅子给你暖好了，慢慢说。')
        capture('08-guide')
        btn(page, "关闭名册").click()
        btn(page, TITLE).click()
        expect(page.locator('.answer-paper h3')).to_have_count(0)
        expect(page.locator('.author-seal')).to_have_text('伴')
        whisper = page.locator('.dock-whisper')
        expect(whisper).to_have_text('刚记下 1 篇，想聊点我', timeout=8000)
        expect(whisper).to_have_attribute('aria-hidden','true')
        capture('02-reading')
        whisper.click()
        start = btn(page, '开聊 · 听呼噜猫说')
        expect(start).to_be_visible()
        expect(page.locator('.gather-note p')).to_have_text('周六收拾桌子，我从书里抖出来三张便签。')
        assert page.locator('.room-table').get_attribute('src') == page.locator('.bench-table').get_attribute('src')
        flow = page.locator('.room-flow').bounding_box()
        for label in ['让伙伴挑新闻', '听点科技的', '记个念头']:
            action = btn(page, label).bounding_box()
            assert flow['y'] <= action['y'] and action['y'] + action['height'] <= flow['y'] + flow['height'], label
        capture('03-gathered')
        start.click()
        advance = page.get_by_role('button', name=re.compile('^听下一句'))
        advance.click()
        expect(page.locator('.bench-seat[data-active=true]')).to_have_attribute('data-speaker', 'owl')
        page.locator('.evidence-card').first.scroll_into_view_if_needed()
        capture('04-owl-evidence')
        advance.click()
        advance.click()
        btn(page, '接过看山的掌控卡').click()
        paper = page.get_by_role('region', name='掌控卡', exact=True)
        expect(paper.locator('.letter-meta')).to_have_text('3 MIN CARD')
        paper.locator('h3').scroll_into_view_if_needed()
        capture('05-control-card')
        btn(page, '我拍板，收进手账').click()
        expect(btn(page, '已收进猫咖手账')).to_be_disabled()
        expect(paper.locator('.committed-stamp')).to_have_text('已落章')
        paper.locator('.committed-stamp').scroll_into_view_if_needed()
        capture('06-committed')
        btn(page, '翻开猫咖手账 →').click()
        expect(page.get_by_role('dialog',name='毛茸茸小屋')).to_have_count(0)
        expect(page.locator('.journal-entry .journal-cat')).to_have_count(1)
        expect(page.get_by_text('已收录 1 张', exact=False)).to_be_visible()
        capture('07-journal')
        assert not errors and not posts, (errors, posts)
        print(f'PASS {width}x{height}: {folder}', flush=True)
    finally:
        ctx.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://127.0.0.1:3123')
    parser.add_argument('--shots', type=Path, default=Path('tmp/review-v2'))
    args = parser.parse_args()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel='msedge')
        for label, w, h in [('desktop', 1280, 880), ('phone', 390, 844), ('compact', 360, 640)]:
            journey(browser, args.base, args.shots/label, w, h)
        browser.close()
