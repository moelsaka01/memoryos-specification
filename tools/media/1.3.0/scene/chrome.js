// Shared on-screen furniture for the 1920x1080 walkthrough: a top bar (product, chapter, milestone progress) and a bottom caption bar.
// Loaded as a plain script by the terminal scene and injected into the real dashboard page; it only adds fixed-position elements.
(function () {
  const MILESTONES = ['1301', '1302', '1303', '1304', '1305', '1306', '1307', '1308', '1309'];
  const CSS = `
  :root{--bg:#070b13;--panel:#0d1420;--line:#1c2738;--fg:#e8eef8;--mute:#8d9bb2;--acc:#4da3ff;--acc2:#35d6c0;--warn:#f5b042;--bad:#ff7a7a;--good:#5be08a}
  #mos-top,#mos-bottom{position:fixed;left:0;width:1920px;z-index:2147483000;box-sizing:border-box;font-family:"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;color:var(--fg)}
  #mos-top{top:0;height:72px;background:#070b13;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 40px;gap:28px}
  #mos-top .brand{display:flex;align-items:center;gap:14px;font-weight:650;font-size:26px;letter-spacing:.2px}
  #mos-top .brand small{color:var(--mute);font-weight:500;font-size:22px}
  #mos-top .chapter{flex:1;text-align:center;font-size:25px;color:var(--fg);white-space:nowrap}
  #mos-top .chapter b{color:var(--acc);font-weight:650;margin-right:12px}
  #mos-top .dots{display:flex;gap:8px;align-items:center}
  #mos-top .dot{font:600 15px "Cascadia Mono",Consolas,monospace;color:#4b5a73;padding:5px 7px;border-radius:6px;border:1px solid transparent}
  #mos-top .dot.done{color:var(--mute)}
  #mos-top .dot.cur{color:#06101c;background:var(--acc);border-color:var(--acc)}
  #mos-bottom{bottom:0;height:144px;background:#070b13;border-top:1px solid var(--line);display:flex;flex-direction:column;justify-content:center;padding:0 90px}
  #mos-bottom .cap{font-size:40px;line-height:1.22;font-weight:600;letter-spacing:.1px;max-width:1740px;transition:none}
  #mos-bottom .note{position:absolute;right:40px;bottom:8px;font:500 17px "Segoe UI",system-ui,sans-serif;color:var(--mute)}
  #mos-bottom .bar{position:absolute;left:40px;top:34px;bottom:34px;width:6px;border-radius:3px;background:linear-gradient(var(--acc),var(--acc2))}`;
  const HEX = '<svg width="34" height="34" viewBox="0 0 34 34"><path d="M17 2.5 29.6 9.75v14.5L17 31.5 4.4 24.25V9.75Z" fill="none" stroke="#4da3ff" stroke-width="2.4"/><circle cx="17" cy="17" r="4.2" fill="#35d6c0"/></svg>';
  function install(doc) {
    const d = doc || document;
    if (d.getElementById('mos-top')) return;
    const style = d.createElement('style');
    style.id = 'mos-chrome-style';
    style.textContent = CSS;
    d.documentElement.appendChild(style);
    const top = d.createElement('div');
    top.id = 'mos-top';
    top.innerHTML = `<div class="brand">${HEX}<span>MemoryOS <small>1.3.0</small></span></div><div class="chapter"></div><div class="dots">${MILESTONES.map((m) => `<span class="dot" data-m="${m}">${m.slice(2)}</span>`).join('')}</div>`;
    const bottom = d.createElement('div');
    bottom.id = 'mos-bottom';
    bottom.innerHTML = '<div class="bar"></div><div class="cap"></div><div class="note"></div>';
    d.documentElement.appendChild(top);
    d.documentElement.appendChild(bottom);
  }
  // state: { chapterCode: 'MO-1308' | null, chapterTitle, current: ['1308'], caption, captionAlpha, captionShift, note }
  function set(state, doc) {
    const d = doc || document;
    const top = d.getElementById('mos-top');
    const bottom = d.getElementById('mos-bottom');
    top.querySelector('.chapter').innerHTML = state.chapterTitle ? `<b>${state.chapterCode || ''}</b>${state.chapterTitle}` : '';
    const idx = state.current && state.current.length ? MILESTONES.indexOf(state.current[0]) : -1;
    top.querySelectorAll('.dot').forEach((el, i) => {
      el.className = 'dot' + (state.current && state.current.includes(el.dataset.m) ? ' cur' : (idx > -1 && i < idx ? ' done' : ''));
    });
    const cap = bottom.querySelector('.cap');
    cap.textContent = state.caption || '';
    cap.style.opacity = state.captionAlpha === undefined ? 1 : state.captionAlpha;
    cap.style.transform = `translateY(${state.captionShift || 0}px)`;
    bottom.querySelector('.note').textContent = state.note || '';
  }
  window.MosChrome = { install, set };
})();
