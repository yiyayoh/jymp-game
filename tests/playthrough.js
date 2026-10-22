// 端到端通关测试：用无头浏览器从开场一路玩到真结局，顺带测普通结局和手机宽度。
// 运行：npm i -D playwright（或全局安装），然后 node tests/playthrough.js
// 全程约 4～5 分钟（手机消息有真实的打字等待）。流程、排版或脚本异常都会让测试失败。
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const GAME = pathToFileURL(require('path').resolve(__dirname, '../index.html')).href;
(async () => {
  const b = await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']});
  try {
  const p = await b.newPage({viewport:{width:1280,height:800}});
  const errs=[]; p.on('pageerror', e=>errs.push(e.message)); p.on('console', m=>{ if(m.type()==='error') errs.push(m.text()); });
  await p.goto(GAME);
  await p.waitForTimeout(300); await p.click('.phone header'); await p.click('#goStart');
  const toasts=[];
  const drain = async () => { await p.waitForTimeout(6300); for(let i=0;i<4;i++){ const x = await p.$('.toast .x'); if(!x) break; toasts.push((await p.textContent('.toast header span')).trim().slice(0,6)); await x.click(); await p.waitForTimeout(2700);} };
  const nav = async u => { await p.fill('#addr', u); await p.press('#addr','Enter'); await drain(); };
  const sub = async (sel,v) => { await p.fill(sel,v); await p.press(sel,'Enter'); await drain(); };
  // 第一章
  await nav('jingyuan-miaopu.com'); await p.click('#bSrc'); await p.click('#bSrc');
  await nav('blog.xiaoman.me'); await nav('blog.xiaoman.me/diary'); await sub('#dy-pw','yuanwei0613');
  await nav('pan.qiancheng.net/s/xiaoman'); await sub('#p-code','117'); await nav('pan.qiancheng.net/s/xiaoman/letter');
  await nav('news.qiancheng.net/2009/0921'); await nav('chenmo.blog');
  await nav('jingyuan-miaopu.com/gardener'); await sub('#g-pw','沈念');
  await p.fill('#d-code','0921'); await p.press('#d-code','Enter');
  console.log('ch1:', await p.textContent('.ending .tag'));
  assert.match(await p.textContent('.ending .tag'), /第一章/);
  await p.click('#ovb0'); await drain();
  console.log('stage:', await p.textContent('#stageLabel'));
  // 第二章
  await nav('qzone.qiancheng.net/heyuan'); await nav('何记早点'); await p.click('.res a:has-text("何记早点")'); await drain();
  await p.fill('#hj-q','韭菜盒子'); await p.fill('#hj-m','妈，那天我是去给你买花的'); await p.press('#hj-m','Enter'); await drain();
  await nav('weibo.qiancheng.net/anan'); await nav('许冬'); await p.click('.res a:has-text("冬子不熬夜")'); await drain();
  await p.fill('#dm-in','冬瓜，去睡觉'); await p.press('#dm-in','Enter'); await p.waitForTimeout(11500); await drain();
  await nav('music.qiancheng.net/suhe'); await nav('qcyy.edu.cn/news/2017'); await nav('music.qiancheng.net/suhe'); await sub('#su-id','2016030817');
  await p.click('[data-song="wei"]'); await p.waitForTimeout(300);
  await nav('林可'); await p.click('.res a:has-text("夜晚酒馆")'); await drain(); await sub('#dg','《未完成》');
  await nav('xiaozu.qiancheng.net/tangyu'); await nav('chongwu.qiancheng.net'); await p.click('text=No.2018-04'); await drain();
  await p.click('a:has-text("返回档案")'); await p.click('text=No.2020-06'); await drain();
  console.log('stage:', await p.textContent('#stageLabel'));
  await nav('sanpai.net'); await p.click('a[data-href="space.qiancheng.net/songzhi"]'); await drain();
  console.log('stage:', await p.textContent('#stageLabel'));
  // 第三章
  console.log('ch3 card:', await p.textContent('.ending h1')); await p.click('#ovb0'); await p.waitForTimeout(300);
  await p.click('.bm:has-text("陈默的邮箱")'); await sub('#ml-p','1512');
  await p.click('.mrow >> nth=0'); await drain(); await p.click('a:has-text("草稿箱")'); await p.click('.mrow'); await drain();
  await p.click('a:has-text("写信")');
  // 先试缺附件的普通结局
  await p.uncheck('input[name=letter]'); await p.click('button:has-text("发送")');
  await p.click('#ovb0'); console.log('end1:', await p.textContent('.ending .tag'));
  assert.match(await p.textContent('.ending .tag'), /NORMAL END/);
  assert.ok((await p.textContent('.ending')).includes('你没有把外婆的信一起发出去'));
  await p.click('#ovb0'); await p.click('button:has-text("发送")'); await p.click('#ovb0');
  console.log('end2:', await p.textContent('.ending h1'), '|', await p.textContent('#secretLine'), '|', await p.textContent('#noteCount'));
  assert.equal(await p.textContent('.ending h1'),'念念回家了');
  console.log('toasts:', toasts.length, toasts.join(','));
  console.log('audio ctx:', await p.evaluate(()=>typeof AudioContext));
  await p.setViewportSize({width:390,height:844}); await p.click('#ovb0');
  for(const u of ['live.qiancheng.net/xudong','mail.qiancheng.net','chongwu.qiancheng.net','sanpai.net']){ await nav(u); const o = await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth || document.querySelector('#vp').scrollWidth>document.querySelector('#vp').clientWidth); assert.equal(o,false,'手机页面横向溢出：'+u); }
  console.log('errors:', errs);
  assert.deepEqual(errs,[]);
  } finally { await b.close(); }
})().catch(e=>{ console.error(e); process.exitCode = 1; });
