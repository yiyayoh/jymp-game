// 针对试玩发现的问题检查；运行方式与 playthrough.js 相同。
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');
const GAME = pathToFileURL(resolve(__dirname, '../index.html')).href;
const KEY = 'jingyuan-save-v2';

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const game = async (last, flags = {}, notes = ['start'], viewport = {width:1280,height:800}) => {
    const p = await b.newPage({viewport});
    p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(({key, save}) => {
      if(!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save));
    }, {key:KEY, save:{notes, flags, seenIntro:true, doorFails:0, last}});
    await p.goto(GAME,{waitUntil:'domcontentloaded'});
    return p;
  };
  const state = p => p.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
  const nav = async (p, url) => { await p.fill('#addr',url); await p.press('#addr','Enter'); };
  const submit = async (p, input, value) => { await p.fill(input,value); await p.press(input,'Enter'); };
  try {
    for(const input of ['０９２１','０９－２１',' 0 9 / 2 1 ']){
      const p = await game('jingyuan-miaopu.com/gardener',{gardener:true,ph_gd1:true});
      await submit(p,'#d-code',input);
      assert.match(await p.locator('.ending .tag').innerText(), /第一章/);
      assert.equal((await state(p)).doorFails,0);
      await p.close();
    }
    const cases = [
      ['blog.xiaoman.me/diary','#dy-pw','「ＹＵＡＮＷＥＩ　０６１３」','diary'],
      ['pan.qiancheng.net/s/xiaoman','#p-code','提取码：１１７','pan'],
      ['jingyuan-miaopu.com/gardener','#g-pw','“沈　念”','gardener'],
      ['mail.qiancheng.net','#ml-p','１５：１２','mailIn'],
      ['music.qiancheng.net/suhe','#su-id','学号：２０１６０３０８１７','suOpen'],
      ['bar.qiancheng.net','#dg','「未 完 成」','g_su'],
      ['hejizaodian.qiancheng.net','#hj-q','“韭菜 盒子”','g_he'],
    ];
    for(const [url, selector, input, flag] of cases){
      const p = await game(url);
      await submit(p,selector,input);
      assert.equal((await state(p)).flags[flag],true,`${url} 应接受 ${input}`);
      await p.close();
    }
    const member = await game('jingyuan-miaopu.com/member');
    await submit(member,'#m-id','ＪＹ－０６１３－０８');
    assert.ok((await state(member)).notes.includes('member'));
    await member.close();
    const wrong = await game('jingyuan-miaopu.com/gardener',{gardener:true,ph_gd1:true});
    for(let i=0;i<3;i++) await submit(wrong,'#d-code','0000');
    assert.match(await wrong.locator('.ending .tag').innerText(),/BAD END/);
    await wrong.click('#ovb0');
    assert.equal((await state(wrong)).doorFails,0);
    await submit(wrong,'#d-code','0921');
    assert.match(await wrong.locator('.ending .tag').innerText(),/第一章/);
    await wrong.close();
    console.log('PASS: 正确答案兼容全角、空格和标点；错误答案和坏结局仍正常');

    const closePhone = async p => {
      await p.locator('.toast').waitFor({timeout:8000});
      await p.click('.toast .x');
    };
    const queued = await game('jingyuan-miaopu.com');
    await nav(queued,'blog.xiaoman.me');
    assert.equal((await state(queued)).pendingPhones.length,2);
    assert.equal((await state(queued)).flags.ph_jy1,undefined);
    await queued.reload({waitUntil:'domcontentloaded'});
    assert.equal((await state(queued)).pendingPhones.length,2,'重访页面不应重复排队');
    await queued.locator('.toast').waitFor({timeout:8000});
    await queued.reload({waitUntil:'domcontentloaded'}); // 消息显示中刷新，也应重现。
    await closePhone(queued);
    assert.equal((await state(queued)).flags.ph_jy1,true);
    await closePhone(queued);
    assert.equal((await state(queued)).flags.ph_blog1,true);
    assert.deepEqual((await state(queued)).pendingPhones,[]);
    await queued.reload({waitUntil:'domcontentloaded'});
    await queued.waitForTimeout(6500);
    assert.equal(await queued.locator('.toast').count(),0,'已读消息不应重复出现');
    await queued.close();

    const gd = await game('jingyuan-miaopu.com/gardener',{gardener:true});
    await nav(gd,'xundu.com');
    await gd.reload({waitUntil:'domcontentloaded'});
    await closePhone(gd);
    assert.ok((await state(gd)).notes.includes('~2'));
    assert.ok((await state(gd)).notes.includes('~3'),'恢复消息后要保留关闭时的剧情后续');
    await gd.close();
    const diary = await game('blog.xiaoman.me/diary',{diary:true});
    await nav(diary,'xundu.com');
    await diary.reload({waitUntil:'domcontentloaded'});
    await closePhone(diary);
    assert.ok((await state(diary)).notes.includes('~1'));
    assert.equal((await state(diary)).pendingPhones[0].id,'diary2');
    await closePhone(diary);
    assert.equal((await state(diary)).flags.ph_diary2,true);
    await diary.close();
    const wishes = {ch2:true,g_he:true,g_xu:true,g_su:true,g_tang:true};
    const song = await game('space.qiancheng.net/songzhi',wishes);
    assert.ok(!(await state(song)).flags.g_song,'刚进入宋芷空间不代表完成心愿');
    await nav(song,'xundu.com');
    await song.reload({waitUntil:'domcontentloaded'});
    await closePhone(song);
    assert.match(await song.locator('.ending h1').innerText(),/第三章/);
    await song.close();
    console.log('PASS: 刷新恢复未读队列、正在显示的消息和三种剧情后续；已读消息不重复');

    const restart = await game('jingyuan-miaopu.com',{},['start','letter']);
    await restart.locator('.toast').waitFor({timeout:8000});
    restart.once('dialog',d=>d.dismiss());
    await restart.click('#bReset');
    assert.ok((await state(restart)).notes.includes('letter'),'取消重开应保留笔记');
    assert.equal(await restart.locator('.toast').count(),1);
    restart.once('dialog',d=>d.accept());
    await restart.click('#bReset');
    assert.deepEqual((await state(restart)).pendingPhones,[]);
    assert.deepEqual((await state(restart)).notes,[]);
    await restart.click('.phone header'); await restart.click('#goStart');
    await restart.waitForTimeout(6500);
    assert.equal(await restart.locator('.toast').count(),0,'旧消息和计时器不能污染新游戏');
    assert.equal((await state(restart)).flags.ph_jy1,undefined);
    await restart.close();
    console.log('PASS: 取消重开保留存档，确认后清空，旧消息不再弹出');

    const liveReset = await game('live.qiancheng.net/xudong',wishes);
    // 使用未完成许冬心愿的存档，检查延时回复不会写入重开后的游戏。
    await liveReset.evaluate(key=>{ const s=JSON.parse(localStorage.getItem(key)); delete s.flags.g_xu; localStorage.setItem(key,JSON.stringify(s)); },KEY);
    await liveReset.reload({waitUntil:'domcontentloaded'});
    await submit(liveReset,'#dm-in','冬 瓜，去睡觉');
    assert.equal((await state(liveReset)).flags.xuMsg,'冬 瓜，去睡觉');
    liveReset.once('dialog',d=>d.accept()); await liveReset.click('#bReset');
    await liveReset.click('.phone header'); await liveReset.click('#goStart');
    await liveReset.waitForTimeout(11000);
    assert.equal((await state(liveReset)).flags.g_xu,undefined);
    assert.deepEqual((await state(liveReset)).pendingPhones,[]);
    await liveReset.close();
    console.log('PASS: 直播间回复期间重开不会把旧心愿写入新存档');

    const select = (p,selector) => p.evaluate(s=>window.getSelection().selectAllChildren(document.querySelector(s)),selector);
    const names = await game('news.qiancheng.net/missing',{gardener:true,ph_gd1:true},['start','blog']);
    await select(names,'#vp'); await names.waitForTimeout(100);
    assert.ok(!(await state(names)).notes.includes('names'),'公告上的姓名不能触发后台隐藏线索');
    await nav(names,'jingyuan-miaopu.com/gardener');
    await select(names,'#notes'); await names.waitForTimeout(100);
    assert.ok(!(await state(names)).notes.includes('names'),'选择笔记不能代替调查后台');
    await select(names,'.gd-ghost'); await names.waitForTimeout(100);
    assert.ok((await state(names)).notes.includes('names'));
    await names.close();
    const source = await game('jingyuan-miaopu.com/gardener',{gardener:true,ph_gd1:true});
    await source.click('#bSrc');
    assert.ok((await state(source)).notes.includes('names'),'手机仍可用查看源代码找到隐藏线索');
    await source.close();
    const legacy = await game('sanpai.net',{...wishes,ch3:true,g_song:true},['start','letter']);
    assert.equal((await state(legacy)).flags.g_song,false,'修正旧存档过早完成的宋芷状态');
    assert.ok((await state(legacy)).notes.includes('letter'));
    assert.equal((await state(legacy)).flags.ch3,true);
    assert.match(await legacy.locator('#vp').innerText(),/等待真话/);
    await legacy.close();
    console.log('PASS: 隐藏线索只在对应页面触发；旧存档保留章节并修正宋芷状态');

    for(const [draft,letter,missing] of [[true,false,'你没有把外婆的信一起发出去'],[false,true,'你没有把陈默的那封信一起发出去'],[false,false,'你没有把外婆的信和陈默的草稿一起发出去']]){
      const p = await game('mail.qiancheng.net/compose',{...wishes,ch3:true,mailIn:true,draft:true},['start','letter']);
      await p.locator('input[name=draft]').setChecked(draft);
      await p.locator('input[name=letter]').setChecked(letter);
      await p.click('button:has-text("发送")'); await p.click('#ovb0');
      assert.match(await p.locator('.ending .tag').innerText(),/NORMAL END/);
      assert.ok((await p.locator('.ending').innerText()).includes(missing));
      assert.equal((await state(p)).flags.g_song,true,'认罪以后才完成宋芷心愿');
      await p.click('#ovb0');
      assert.equal((await state(p)).flags.g_song,false);
      await p.click('button:has-text("发送")'); await p.click('#ovb0');
      assert.match(await p.locator('.ending .tag').innerText(),/TRUE END/);
      await p.close();
    }
    console.log('PASS: 三种缺附件情况的普通结局说明正确，回去重发仍可到真结局');

    assert.deepEqual(errors,[]);
    console.log('errors:',errors);
  } finally { await b.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
