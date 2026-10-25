// 氛围效果不应改变谜题、存档或其他页面；使用虚拟时间检查延迟。
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const GAME = pathToFileURL(resolve(__dirname, '../index.html')).href;
const KEY = 'jingyuan-save-v2';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const game = async (last, flags = {}, notes = ['start'], width = 390) => {
    const p = await browser.newPage({viewport:{width,height:844}});
    p.on('pageerror', e => errors.push(e.message));
    // 加载前暂停虚拟时钟，避免并行运行的真实耗时越过 7 秒边界。
    await p.clock.install({time:new Date('2026-10-19T23:46:00Z')});
    await p.clock.pauseAt(new Date('2026-10-19T23:47:00Z'));
    await p.addInitScript(({key,save}) => localStorage.setItem(key,JSON.stringify(save)), {
      key:KEY, save:{notes,flags:{ph_jy1:true,...flags},seenIntro:true,doorFails:0,last}
    });
    await p.goto(GAME,{waitUntil:'domcontentloaded'});
    return p;
  };
  const nav = async (p,url) => { await p.fill('#addr',url); await p.press('#addr','Enter'); };
  const text = p => p.locator('[data-atmosphere]').innerText();
  const layout = async p => {
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await p.locator('#vp').evaluate(el => el.scrollWidth>el.clientWidth),false);
  };
  const footerReadable = async (p,selector) => {
    await p.evaluate(() => window.scrollTo(0,document.documentElement.scrollHeight));
    const bottom = await p.locator(selector).evaluate(el => el.getBoundingClientRect().bottom);
    const buttonTop = await p.locator('#fab').evaluate(el => el.getBoundingClientRect().top);
    assert.ok(bottom<buttonTop-6,'新增内容滚动到底后应在手机笔记按钮上方');
  };
  try {
    const fresh = await game('jingyuan-miaopu.com');
    await fresh.clock.fastForward(12000);
    assert.equal(await fresh.locator('[data-atmosphere]').count(),0,'初次访问广告不提前出现异常');
    await fresh.close();

    const ad = await game('jingyuan-miaopu.com',{diary:true});
    const before = await ad.evaluate(key => localStorage.getItem(key),KEY);
    assert.match(await text(ad),/在线访客：1/);
    await ad.clock.fastForward(6500);
    assert.match(await text(ad),/在线访客：1/);
    await ad.clock.fastForward(600);
    assert.match(await text(ad),/在线访客：6/);
    assert.equal(await ad.locator('.glass-traces.revealed i').count(),5);
    assert.equal(await ad.evaluate(key => localStorage.getItem(key),KEY),before,'气氛变化不写入存档');
    await layout(ad);
    await ad.click('#bSrc');
    await ad.clock.fastForward(10000);
    assert.equal(await ad.locator('.srcview').count(),1,'查看源代码时不插入效果');
    await ad.click('#bSrc');
    assert.match(await text(ad),/在线访客：6/,'重访保留本次已经察觉的变化');
    await ad.locator('.jy-btn').click();
    await ad.clock.fastForward(10000);
    assert.equal(await ad.locator('#m-id').count(),1,'手印不挡住入园按钮');
    assert.equal(await ad.locator('.glass-traces').count(),0);
    await ad.close();

    const cancelled = await game('jingyuan-miaopu.com',{diary:true},['start'],1280);
    await nav(cancelled,'xundu.com');
    await cancelled.clock.fastForward(10000);
    assert.equal(await cancelled.locator('[data-atmosphere]').count(),0,'离开页面取消待出现效果');
    await nav(cancelled,'jingyuan-miaopu.com');
    assert.match(await text(cancelled),/在线访客：1/,'未出现的效果不提前记为已见');
    await cancelled.click('#bChat');
    await cancelled.clock.fastForward(10000);
    assert.match(await text(cancelled),/在线访客：1/,'开场聊天遮罩期间不变化');
    await cancelled.click('#goStart');
    await cancelled.clock.fastForward(7100);
    assert.match(await text(cancelled),/在线访客：6/);
    cancelled.once('dialog',d => d.accept());
    await cancelled.click('#bReset');
    await cancelled.locator('.phone').click();
    await cancelled.click('#goStart');
    await nav(cancelled,'blog.xiaoman.me/diary');
    await cancelled.fill('#dy-pw','yuanwei0613');
    await cancelled.press('#dy-pw','Enter');
    await nav(cancelled,'jingyuan-miaopu.com');
    assert.match(await text(cancelled),/在线访客：1/,'重新开始清除本次已见记录');
    await cancelled.close();

    const forum = await game('bbs.qiancheng.net/t/4471');
    await forum.clock.fastForward(10000);
    assert.equal(await forum.locator('[data-atmosphere]').isHidden(),true);
    await forum.click('#bSrc');
    assert.ok(await forum.evaluate(key => JSON.parse(localStorage.getItem(key)).notes.includes('deleted'),KEY));
    await forum.clock.fastForward(10000);
    await forum.click('#bSrc');
    assert.equal(await forum.locator('[data-atmosphere]').isHidden(),true);
    await forum.clock.fastForward(7100);
    assert.match(await text(forum),/账号已注销\n当前在线/);
    assert.match(await forum.locator('.bbs-thread').innerText(),/口令是那个孩子的名字/,'原线索仍在');
    await layout(forum);
    await footerReadable(forum,'.quiet-reply .meta');
    await forum.close();

    const draft = await game('mail.qiancheng.net/drafts/1',{ch2:true,ch3:true,mailIn:true});
    assert.match(await text(draft),/发送记录：0 封 · 已读回执：0/);
    await draft.clock.fastForward(7100);
    assert.match(await text(draft),/发送记录：0 封 · 已读回执：5/);
    assert.match(await text(draft),/03:12（服务器时间异常）/);
    assert.match(await draft.locator('.mread .h').innerText(),/草稿 · 未发送/);
    await layout(draft);
    await footerReadable(draft,'.quiet-receipt small');
    await nav(draft,'mail.qiancheng.net/compose');
    await draft.clock.fastForward(10000);
    assert.equal(await draft.locator('[data-atmosphere]').count(),0);
    assert.equal(await draft.locator('input[name="draft"]').isChecked(),true,'异常回执不影响实际附件');
    await draft.close();

    for(const [url,flags,notes] of [
      ['jingyuan-miaopu.com',{diary:true,ch2:true},['start']],
      ['bbs.qiancheng.net/t/4471',{ch2:true},['start','deleted']],
      ['mail.qiancheng.net/drafts/1',{ch3:true,mailIn:true,end:true},['start']],
    ]){
      const p=await game(url,flags,notes);
      await p.clock.fastForward(12000);
      assert.equal(await p.locator('[data-atmosphere]:visible').count(),0,'已结束章节和通关后停止新增异常');
      await p.close();
    }
    const reduced = await game('jingyuan-miaopu.com',{diary:true});
    await reduced.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await reduced.locator('.flicker').evaluate(el => getComputedStyle(el).animationName),'none');
    await reduced.close();
    assert.deepEqual(errors,[]);
    console.log('PASS: 三处灵异效果按剧情延迟出现，不影响线索、按钮和存档');
    console.log('PASS: 页面/源代码/聊天/重开隔离，章节与结局收束，减少动画偏好，390px 无横向溢出');
    console.log('errors:',errors);
  } finally {
    await browser.close();
  }
})().catch(e => {console.error(e);process.exitCode=1;});
