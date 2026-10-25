// 从玩家已经获得的笔记回看网页，不提前开放线索，也不改调查进度。
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const GAME = pathToFileURL(resolve(__dirname, '../index.html')).href;
const KEY = 'jingyuan-save-v2';

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const game = async (save,width=1280) => {
    const p=await browser.newPage({viewport:{width,height:844}});
    p.on('pageerror',e=>errors.push(e.message));
    await p.addInitScript(({key,save})=>{
      if(!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(save));
    },{key:KEY,save});
    await p.goto(GAME,{waitUntil:'domcontentloaded'});
    return p;
  };
  const state = p=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
  const nav = async (p,url)=>{await p.fill('#addr',url);await p.press('#addr','Enter');};
  const source = (p,id)=>p.locator(`[data-note-source="${id}"]`);
  try {
    const p=await game({notes:['start'],flags:{ph_blog1:true,ph_jy1:true},seenIntro:true,doorFails:0,last:'xundu.com'});
    assert.equal(await p.locator('.note-source').count(),0,'开场不列出未发现网页');
    await nav(p,'blog.xiaoman.me');
    assert.equal(await source(p,'blog').count(),1);
    assert.equal(await source(p,'su2').count(),0,'不提前列出第二章线索');
    await nav(p,'xundu.com');
    await source(p,'blog').focus();
    await p.keyboard.press('Enter');
    assert.match(await p.locator('#addr').inputValue(),/blog\.xiaoman\.me$/);
    assert.equal(await p.evaluate(()=>document.activeElement.id),'vp','键盘回看后焦点进入网页');
    await p.click('#bBack');
    assert.match(await p.locator('#addr').inputValue(),/xundu\.com$/);
    await nav(p,'blog.xiaoman.me/diary');
    await source(p,'diaryq').click();
    assert.equal(await p.locator('#dy-pw').count(),1,'回看密码提示不会解锁日记');
    assert.equal((await state(p)).flags.diary,undefined);
    await nav(p,'jingyuan-miaopu.com');
    await p.click('#bSrc');
    await nav(p,'xundu.com');
    const before=await state(p);
    await source(p,'srcjy').click();
    assert.match(await p.locator('#addr').inputValue(),/^view-source:/);
    assert.match(await p.locator('.note-target').innerText(),/TODO 上线前删掉/);
    assert.deepEqual((await state(p)).notes,before.notes,'反复回看不增加线索');
    assert.deepEqual((await state(p)).flags,before.flags,'回看不推进剧情');
    await p.click('#bBack');
    assert.match(await p.locator('#addr').inputValue(),/xundu\.com$/);
    await p.reload({waitUntil:'domcontentloaded'});
    assert.equal(await source(p,'srcjy').count(),1,'刷新后旧笔记仍能回看');
    p.once('dialog',d=>d.accept());await p.click('#bReset');
    assert.equal(await p.locator('.note-source').count(),0,'重新开始移除旧回看入口');
    await p.close();
    console.log('PASS: 已获得线索才有回看入口，键盘/后退/刷新正常，不解锁日记或改动进度');

    // 使用没有新增字段的旧存档，从后期笔记返回第一章的源代码。
    const legacy={notes:['start','bbs','no6','deleted','srcjy','ghost','gardener','doorq','names','he1'],flags:{ch2:true,gardener:true,ph_gd1:true,ph_jy1:true},seenIntro:true,doorFails:1,last:'xundu.com'};
    const m=await game(legacy,390);
    for(const [id,clue] of [['deleted','原回复：'],['names','何苑 许安安 苏禾 唐语 宋芷']]){
      await m.click('#fab');
      await source(m,id).click();
      assert.equal(await m.locator('#fab').getAttribute('aria-expanded'),'false');
      assert.equal(await m.locator('#side').evaluate(el=>el.classList.contains('open')),false);
      assert.match(await m.locator('.note-target').innerText(),new RegExp(clue));
      await m.waitForTimeout(350);
      const clueBox=await m.locator('.note-target').boundingBox();
      const buttonBox=await m.locator('#fab').boundingBox();
      assert.ok(clueBox.y>=0 && clueBox.y+clueBox.height<buttonBox.y,'注释完整显示在手机悬浮按钮上方');
      assert.equal(await m.evaluate(()=>document.activeElement.id),'vp');
      assert.equal(await m.locator('#stageLabel').innerText(),'第三排 0/5');
      assert.equal((await state(m)).doorFails,1,'回看不清空原有进度');
      assert.deepEqual((await state(m)).notes,legacy.notes);
    }
    await m.click('#fab');await source(m,'he1').click();
    assert.match(await m.locator('#addr').inputValue(),/qzone\.qiancheng\.net\/heyuan$/);
    assert.equal(await m.locator('.srcview').count(),0,'普通笔记返回正文');
    for(const width of [320,390]){
      await m.setViewportSize({width,height:844});
      assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('#vp').scrollWidth>document.querySelector('#vp').clientWidth),false);
    }
    await m.close();
    console.log('PASS: 旧存档、跨章节回看和源代码定位正常；手机自动收起笔记，320/390px 无横向溢出');
    assert.deepEqual(errors,[]);
    console.log('errors:',errors);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
