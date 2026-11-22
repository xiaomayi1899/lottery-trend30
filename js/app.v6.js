/* app.v6.js — 30期走势规律实验室 页面逻辑（纯数字彩四版：双色球/大乐透/快乐8/福彩3D）
   推荐：近 30 期走势形态系统（engine.v6.js）；数据：官方接口/静态数据/快照三层降级 */
(() => {
  "use strict";

  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const Engine = window.Engine;
  const GAMES = Engine.GAMES;
  const KEYS = ["ssq", "dlt", "kl8", "fc3d"];

  /* 期号 +1：同年内直接递增；跨年边界无法确定真实期号时返回 null（显示“下一期”） */
  function nextIssue(issue) {
    const s0 = String(issue || "");
    if (!/^\d+$/.test(s0)) return null;
    const s1 = String(parseInt(s0, 10) + 1);
    if (s1.length !== s0.length) return null;
    const yearLen = s0.length >= 7 ? 4 : (s0.length === 5 ? 2 : 0);
    if (yearLen && s1.slice(0, yearLen) !== s0.slice(0, yearLen)) return null;
    return s1;
  }

  /* ============ 数据层 ============ */
  const LS_KEY = "lt30_data_v1";
  const SNAP = window.__SNAPSHOT__ || { builtAt: "", ssq: [], dlt: [], kl8: [], fc3d: [] };
  window.DATA = { ssq: [], dlt: [], kl8: [], fc3d: [] };

  const store = {};
  const state = {};
  for (const k of KEYS) {
    store[k] = { list: [], ts: 0, src: "" };
    state[k] = { result: null, running: false, metric: "freq", open: new Set(), rendered: false };
  }

  function loadLocal() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) {}
    for (const g of KEYS) {
      const snap = Array.isArray(SNAP[g]) ? SNAP[g] : [];
      const s = saved && saved[g];
      if (s && Array.isArray(s.list) && s.list.length >= snap.length && s.list.length > 0) {
        store[g] = { list: s.list, ts: s.ts || 0, src: "缓存" };
      } else if (snap.length) {
        store[g] = { list: snap.slice(), ts: SNAP.builtAt ? (Date.parse(SNAP.builtAt) || 0) : 0, src: "快照" };
      } else {
        store[g] = { list: [], ts: 0, src: "" };
      }
      window.DATA[g] = store[g].list;
    }
  }

  function persist() {
    try {
      const o = { builtAt: SNAP.builtAt || "" };
      for (const g of KEYS) o[g] = { list: store[g].list, ts: store[g].ts };
      localStorage.setItem(LS_KEY, JSON.stringify(o));
    } catch (e) {}
  }

  /* ============ 推荐存档与开奖核对（只存本机浏览器） ============ */
  const RECO_KEY = "lt30_reco_v1";
  let reco = loadReco();
  function loadReco() {
    try { const o = JSON.parse(localStorage.getItem(RECO_KEY) || "null"); if (o && typeof o === "object") return o; } catch (e) {}
    return {};
  }
  function saveRecoStore() { try { localStorage.setItem(RECO_KEY, JSON.stringify(reco)); } catch (e) {} }
  function recoList(g) { if (!Array.isArray(reco[g])) reco[g] = []; return reco[g]; }

  function saveReco(g, res) {
    const isD = GAMES[g].type === "digits";
    const list = recoList(g);
    const basedOn = String(store[g].list[store[g].list.length - 1].issue);
    const sets = res.sets.map((s) => ({ tag: s.tag,
      f: isD ? s.f.slice() : s.f.slice().sort((a, b) => a - b),
      b: s.b ? s.b.slice().sort((a, b) => a - b) : null }));
    const last = list[0];
    if (last && !last.gr && last.basedOn === basedOn) { last.sets = sets; last.t = Date.now(); }
    else list.unshift({ t: Date.now(), basedOn: basedOn, sets: sets, gr: null });
    if (list.length > 12) list.length = 12;
    saveRecoStore();
  }

  function gradeRecords(g) {
    const cfg = GAMES[g];
    const list = recoList(g);
    const draws = store[g].list;
    if (!draws.length) return 0;
    let graded = 0;
    for (const r of list) {
      if (r.gr) continue;
      const bo = Number(r.basedOn);
      let act = null;
      for (const d of draws) { if (Number(d.issue) > bo) { act = d; break; } }
      if (!act) continue;
      const front = act.nums.slice(0, cfg.draw);
      const back = cfg.bk ? act.nums.slice(cfg.draw) : null;
      const rows = r.sets.map((s) => {
        if (cfg.type === "digits") {
          let pos = 0;
          for (let p = 0; p < cfg.pos; p++) if (s.f[p] === act.nums[p]) pos++;
          return { tag: s.tag, pos: pos };
        }
        const hits = s.f.filter((x) => front.indexOf(x) >= 0).length;
        const bh = s.b ? s.b.filter((x) => back.indexOf(x) >= 0).length : null;
        return { tag: s.tag, hits: hits, bh: bh };
      });
      r.gr = { issue: String(act.issue), date: String(act.date).slice(0, 10), rows: rows };
      graded++;
    }
    if (graded) saveRecoStore();
    return graded;
  }

  /* ============ 复盘修正：维度权重与走前校准 ============ */
  const W_KEY = "lt30_w_v1";
  const CAL_KEY = "lt30_cal_v1";
  function loadW() { try { return JSON.parse(localStorage.getItem(W_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function saveW(g, w) { const all = loadW(); all[g] = w; try { localStorage.setItem(W_KEY, JSON.stringify(all)); } catch (e) {} }
  function applyW() { const all = loadW(); for (const g of KEYS) if (all[g]) Engine.setWeights(g, all[g]); }
  function recordCal(g, r) {
    const log = loadLog();
    (log[g] = log[g] || []).unshift({ t: Date.now(), n: r.raw.n, auto: !!r.auto, old: r.old, w: r.w });
    if (log[g].length > 8) log[g].length = 8;
    try { localStorage.setItem(CAL_KEY, JSON.stringify(log)); } catch (e) {}
  }
  function loadLog() { try { return JSON.parse(localStorage.getItem(CAL_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function runCal(g) {
    const r = Engine.calibrate(g);
    if (!r) return null;
    r.old = Engine.weights(g);
    Engine.setWeights(g, r.w);
    saveW(g, r.w);
    recordCal(g, r);
    return r;
  }
  function autoCalTick(g) {
    let o = {};
    try { o = JSON.parse(localStorage.getItem("lt30_ac_v1") || "{}") || {}; } catch (e) {}
    o[g] = (o[g] || 0) + 1;
    let fire = false;
    if (o[g] >= 5) { o[g] = 0; fire = true; }
    try { localStorage.setItem("lt30_ac_v1", JSON.stringify(o)); } catch (e) {}
    if (!fire) return false;
    return !!runCal(g);
  }

  function setNet(cls, label) {
    const dot = $("#netdot"), lab = $("#netlabel");
    if (dot) dot.className = "netdot" + (cls ? " " + cls : "");
    if (lab) lab.textContent = label;
  }

  async function fetchJSON(url, timeout) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout || 30000);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error("HTTP " + r.status + ((j && j.error) ? " · " + j.error : ""));
      return j;
    } finally {
      clearTimeout(t);
    }
  }

  async function fetchNorm(u) {
    const j = await fetchJSON(u, 30000);
    if (j && Array.isArray(j.list) && j.list.length) return j.list;
    throw new Error((j && j.error) || "数据格式异常");
  }

  async function fetchDltLive() {
    const out = [], seen = new Set();
    for (let page = 1; page <= 10; page++) {
      const j = await fetchJSON("https://webapi.sporttery.cn/gateway/lottery/getHistoryPageListV1.qry?gameNo=85&provinceId=0&pageSize=100&isVerify=1&pageNo=" + page, 15000);
      const lst = (j.value && j.value.list) || [];
      for (const it of lst) {
        const code = String(it.lotteryDrawNum || "").trim();
        const nums = String(it.lotteryDrawResult || "").split(/\s+/).map(Number).filter((x) => x > 0);
        if (!code || seen.has(code) || nums.length !== 7) continue;
        seen.add(code);
        out.push({ issue: code, date: String(it.lotteryDrawTime || "").slice(0, 10),
          nums: nums.slice(0, 5).sort((a, b) => a - b).concat(nums.slice(5).sort((a, b) => a - b)) });
      }
      if (lst.length < 100) break;
    }
    if (!out.length) throw new Error("体彩接口无数据");
    out.sort((a, b) => a.issue.localeCompare(b.issue));
    return out.slice(-1000);
  }

  const SOURCES = {
    ssq: [() => fetchNorm("/api/ssq?n=1000"), () => fetchNorm("./data/ssq.json")],
    dlt: [fetchDltLive, () => fetchNorm("/api/dlt?n=1000"), () => fetchNorm("./data/dlt.json")],
    kl8: [() => fetchNorm("/api/kl8?n=1000"), () => fetchNorm("./data/kl8.json")],
    fc3d: [() => fetchNorm("/api/fc3d?n=1000"), () => fetchNorm("./data/fc3d.json")],
  };

  async function refreshGame(g, silent) {
    let list = null;
    for (const src of SOURCES[g]) {
      try { const got = await src(); if (got && got.length) { list = got; break; } }
      catch (e) { /* 试下一个来源 */ }
    }
    if (!list) {
      if (store[g].list.length) setNet("ok", "官方接口未响应 · 使用本地数据");
      else setNet("err", GAMES[g].name + " 数据源暂不可用");
      if (!silent) toast(GAMES[g].name + "更新失败：所有数据来源均不可达");
      return false;
    }
    const cur = store[g].list;
    const lastOld = cur.length ? String(cur[cur.length - 1].issue) : "";
    const lastNew = String(list[list.length - 1].issue);
    store[g] = { list, ts: Date.now(), src: "已更新" };
    window.DATA[g] = list;
    persist();
    setNet("ok", "官方数据已连接");
    const graded = gradeRecords(g);
    let recal = false;
    if (graded) recal = autoCalTick(g);
    if (state[g].rendered) {
      if (lastNew !== lastOld || graded || recal) renderGame(g);
      else updateFreshBadge(g);
    }
    if (!silent) toast(GAMES[g].name + "已更新至第 " + lastNew + " 期");
    return true;
  }

  /* ============ 通用渲染 ============ */
  function gameBalls(g, nums, size) {
    const cfg = GAMES[g];
    const auto = cfg.fk >= 8 ? "sm" : "";
    const cls = size || auto;
    const cut = cfg.draw || (nums || []).length; // pick 型：前 draw 个为前区（红），其余后区（蓝）
    let h = "";
    (nums || []).forEach((n, i) => {
      if (cfg.draw && i === cut) h += '<span class="vs">+</span>';
      h += '<span class="ball ' + (i >= cut ? "b" : "r") + (cls ? " " + cls : "") + '">' + Engine.pad2(n) + "</span>";
    });
    return h;
  }

  function freshHTML(g) {
    const s = store[g];
    if (!s.list.length) return "";
    const last = s.list[s.list.length - 1];
    const stale = s.src === "缓存" && Date.now() - s.ts > 36 * 3600e3;
    const cls = s.src === "已更新" ? "live" : stale ? "stale" : "";
    return '<span class="fresh ' + cls + '" id="' + g + '-fresh"><span class="dot"></span>' +
      esc(s.src) + " · 第" + esc(last.issue) + "期 · " + esc(String(last.date).slice(0, 10)) + "</span>";
  }

  function updateFreshBadge(g) {
    const old = $("#" + g + "-fresh");
    const next = freshHTML(g);
    if (old && next) {
      const tpl = document.createElement("div");
      tpl.innerHTML = next;
      old.replaceWith(tpl.firstElementChild);
    }
  }

  function statsFor(g) {
    const cfg = GAMES[g];
    const draws = store[g].list.slice(-30);
    const D = draws.length;
    if (cfg.type === "digits") {
      const freq = [], fom = [];
      for (let p = 0; p < cfg.pos; p++) {
        const f = new Array(10).fill(0), m = new Array(10).fill(D);
        for (let t = D - 1; t >= 0; t--) { const d2 = draws[t].nums[p]; f[d2]++; if (m[d2] === D) m[d2] = D - 1 - t; }
        freq.push(f); fom.push(m);
      }
      return { type: "digits", freq, fom, D };
    }
    const fc = new Array(cfg.fn + 1).fill(0);
    const fom = new Array(cfg.fn + 1).fill(D);
    for (let t = D - 1; t >= 0; t--) {
      for (let i = 0; i < cfg.draw && i < draws[t].nums.length; i++) {
        const n = draws[t].nums[i];
        if (n >= 1 && n <= cfg.fn) { fc[n]++; if (fom[n] === D) fom[n] = D - 1 - t; }
      }
    }
    return { type: "pick", fc, fom, D };
  }

  function numgridHTML(g, freq, fom, D, maxN, rgb, startAt) {
    const metric = state[g].metric;
    const start = startAt || 1;
    const max = Math.max.apply(null, freq.slice(start).concat([1]));
    let h = '<div class="numgrid">';
    for (let i = start; i <= maxN; i++) {
      const f = freq[i], m = fom[i];
      const a = 0.10 + 0.32 * (f / max);
      const border = f === max ? "1px solid rgba(" + rgb + ",.6)" : "1px solid transparent";
      h += '<div class="nchip" style="background:rgba(' + rgb + "," + a.toFixed(2) + ');border:' + border + '">' +
        Engine.pad2(i) + "<small>" + (metric === "freq" ? f + "次" : "遗漏" + m) + "</small></div>";
    }
    return h + "</div>";
  }

  function statsCardHTML(g) {
    const cfg = GAMES[g];
    const st = statsFor(g);
    const m = state[g].metric;
    let body = "";
    if (st.type === "digits") {
      for (let p = 0; p < cfg.pos; p++) {
        const freq = [0].concat(st.freq[p]);
        const fom = [0].concat(st.fom[p]);
        body += '<div class="hint" style="margin-bottom:6px">' + esc(cfg.posNames[p]) + "（0–9）</div>" +
          numgridHTML(g, freq, fom, st.D, 9, "228,87,74", 0);
      }
    } else {
      body += '<div class="hint" style="margin-bottom:6px">号码（1–' + cfg.fn + "）</div>" +
        numgridHTML(g, st.fc, st.fom, st.D, cfg.fn, "228,87,74", 1);
    }
    return '<div class="card">' +
      '<div class="eyebrow">近 30 期统计 · ' + (m === "freq" ? "按出现次数着色" : "按当前遗漏着色") + "</div>" +
      '<div class="seg"><button class="' + (m === "freq" ? "on" : "") + '" data-act="metric" data-m="freq">出现次数</button>' +
      '<button class="' + (m === "miss" ? "on" : "") + '" data-act="metric" data-m="miss">遗漏期数</button></div>' +
      body +
      '<div class="hint" style="margin-top:10px">统计只描述历史；冷热与遗漏对下期开奖没有预测力。</div>' +
      "</div>";
  }

  function bannerHTML(g) {
    const r = state[g].result;
    const cfg = GAMES[g];
    let formLine;
    if (cfg.type === "digits") {
      formLine = "预测形态：和值 " + r.form.sum[0] + "–" + r.form.sum[1] + " · " + r.form.odd + " 奇" + (cfg.pos - r.form.odd) + "偶 · " +
        r.form.big + " 大" + (cfg.pos - r.form.big) + "小 · 跨度 " + r.form.span;
    } else {
      formLine = "预测形态：奇偶 " + r.form.odd + " · 质合 " + r.form.prime + " · 大小 " + r.form.low +
        " · 区间 " + r.form.zone + " · 和值 " + r.form.sum[0] + "–" + r.form.sum[1] +
        (cfg.fk <= 6 ? " · 含重号 " + r.form.repeat + " / 邻号 " + r.form.neighbor : "") +
        (r.form.back ? " · 后区奇偶 " + r.form.back : "");
    }
    return '<div class="banner">' +
      '<div class="tag">形态合成推荐 · ' + esc(r.name) + "</div>" +
      '<div class="pick">' + gameBalls(g, r.final.f.concat(r.final.b || [])) + "</div>" +
      '<div class="votes num">' + esc(formLine) + "</div>" +
      '<div class="upto">截至第 ' + esc(r.upto.issue) + " 期（" + esc(r.upto.date) + " 开奖）· 分析最近 " + r.upto.count +
      " 期走势 · 计算 " + r.ms + "ms<br>" +
      (nextIssue(r.upto.issue) ? "本页推荐为 <strong class=\"num\">第 " + esc(nextIssue(r.upto.issue)) + " 期</strong> 的预测（用≤" + esc(r.upto.issue) + "数据 · 开奖后自动存档核对）<br>" : "本页推荐为下一期的预测（开奖后自动存档核对）<br>") +
      "再次强调：推荐是统计整理输出，与随机对照的中奖概率完全相同。</div></div>";
  }

  function setsCardHTML(g) {
    const st = state[g];
    if (!st.result || !st.result.sets) return "";
    let h = '<div class="card"><div class="eyebrow">策略五注 · 同一预测形态的不同评分视角</div>';
    st.result.sets.forEach((s, i) => {
      h += '<div class="pr-row"><div class="pr-l"><span>' + (i + 1) + ". " + esc(s.tag) + "</span></div>" +
        '<div class="balls" style="margin:4px 0 2px">' + gameBalls(g, s.f.concat(s.b || []), "xs") + "</div></div>";
    });
    h += '<div class="hint" style="margin-top:8px">五注都满足同一预测形态，只是选号评分视角不同；随机对照与其他四注的中奖概率完全相同。</div></div>';
    return h;
  }

  function histCardHTML(g) {
    const cfg = GAMES[g];
    let cached = null;
    try { const all = JSON.parse(localStorage.getItem("lt30_hist_v1") || "{}"); if (all[g]) cached = all[g]; } catch (e) {}
    const lastIssue = store[g].list.length ? String(store[g].list[store[g].list.length - 1].issue) : "";
    const fresh = cached && cached.upto === lastIssue;
    const exF = cfg.type === "digits" ? cfg.pos / 10 : cfg.fk * cfg.draw / cfg.fn;
    let h = '<div class="card"><div class="eyebrow">历史复盘 · 走前模拟（每期只用其之前 30 期）</div>';
    if (fresh) {
      const r = cached.r;
      h += '<div class="hint mono">' + r.sets.map((s) => esc(s.tag) + " 场均命中 " + s.avg.toFixed(2)).join(" · ") + "</div>";
      h += '<div class="hint">最佳注（四注里最好的一注）场均命中 <strong>' + (r.best === undefined ? "-" : r.best.toFixed(2)) + "</strong> 个 · 主推显著性 z=" + (r.mainZ === undefined ? "-" : r.mainZ.toFixed(2)) + "（p=" + (r.mainP === undefined ? "-" : (r.mainP || 0).toFixed(3)) + "，p>0.05 = 与随机无显著差异）</div>";
      h += '<div class="hint">随机期望命中 ' + exF.toFixed(2) + " 个 · 奇偶/奇数个数精确命中 " + Math.round(r.formHit * 100) + "%（±1 容差 " + Math.round(r.formTol * 100) + "%）· 共 " + r.rows.length + " 期走前模拟。每一行的含义：用<strong>该期之前</strong>的开奖数据为该期做预测，再对照该期实开——绝不用开奖后的数据装预测。</div>";
      const rev = (nums, marks, blue) => {
        let s2 = "";
        (nums || []).forEach((n, i) => {
          const hit = marks && marks[i];
          s2 += '<span class="ball ' + (blue ? "b" : "r") + ' xs' + (hit ? " hit" : "") + '">' + Engine.pad2(n) + "</span>";
        });
        return s2;
      };
      const revRow = (row) => {
        const cfg2 = GAMES[g];
        const front = row.actual.slice(0, cfg2.draw);
        const back = cfg2.bk ? row.actual.slice(cfg2.draw) : [];
        let body = '<div class="hint mono">预测依据：截至第 ' + esc(row.basedOn) + " 期开奖（不含其后数据）→ 对照第 " + esc(row.issue) + " 期实开：" + rev(front, null) + (back.length ? '<span class="vs">+</span>' + rev(back, null, true) : "") + "</div>";
        row.sets.forEach((s, idx) => {
          if (cfg2.type === "digits") {
            const marks = s.f.map((v, p) => v === row.actual[p]);
            body += '<div class="hint mono">' + esc(s.tag) + "：" + rev(s.f, marks) + "（中 " + row.cells[idx] + "/" + cfg2.pos + " 位）</div>";
          } else {
            const mf = s.f.map((x) => front.indexOf(x) >= 0);
            const mb = s.b ? s.b.map((x) => back.indexOf(x) >= 0) : null;
            body += '<div class="hint mono">' + esc(s.tag) + "：" + rev(s.f, mf) + (s.b && back.length ? '<span class="vs">+</span>' + rev(s.b, mb, true) : "") + "（红 " + row.cells[idx] + (mb ? "，后区命中 " + mb.filter(Boolean).length + " 个" : "") + "）</div>";
          }
        });
        return '<details class="step"><summary>预测第' + esc(row.issue) + "期（用≤" + esc(row.basedOn) + "数据） · " + row.cells.join("/") + "</summary><div class=\"body\">" + body + "</div></details>";
      };
      h += '<div style="margin-top:8px">' + r.rows.slice().reverse().map(revRow).join("") + "</div>";
      h += '<div class="hint mono"><strong>预测第' + esc(nextIssue(lastIssue) || "下一期") + '期（用≤' + esc(lastIssue) + '数据）</strong> · 预测号码见页顶「形态合成推荐」，开奖后自动核对（见存档核对卡）</div>';
      h += '<div class="hint" style="margin-top:8px">复盘命中贴近随机期望 = 正常且符合「开奖独立随机」；此表长期记录策略真实水位。</div>';
    } else if (cached) {
      h += '<div class="hint">上次复盘基于第 ' + esc(cached.upto) + ' 期数据，数据已更新，请重新运行。</div>';
    }
    h += '<div class="hint" id="' + g + '-hist-prog" style="min-height:14px"></div>' +
      '<div class="btn-row"><button class="btn ghost" data-act="hist">运行历史复盘（最多 300 期走前模拟）</button></div></div>';
    return h;
  }

  function calCardHTML(g) {
    const cfg = GAMES[g];
    if (cfg.type !== "pick") return '<div class="card"><div class="eyebrow">复盘修正 · 维度校准</div><div class="hint">数字型暂不支持维度校准，仅做存档核对。</div></div>';
    const w = Engine.weights(g);
    let log = loadLog()[g] || [];
    let h = '<div class="card"><div class="eyebrow">复盘修正 · 维度校准（走前归因）</div>' +
      '<div class="hint">当前维度权重：冷热 ' + w.hot.toFixed(2) + " · 遗漏回补 " + w.due.toFixed(2) + " · 共现 " + w.co.toFixed(2) + "（1.00 = 随机基线水平）</div>";
    if (log.length) {
      h += '<div class="hint mono">' + log.slice(0, 5).map((l) => {
        const d = new Date(l.t);
        return (l.auto ? "[自动]" : "[手动]") + " " + (d.getMonth() + 1) + "-" + d.getDate() + " 样本" + l.n + "期：冷热 " + l.old.hot.toFixed(2) + "→" + l.w.hot.toFixed(2) + " · 遗漏 " + l.old.due.toFixed(2) + "→" + l.w.due.toFixed(2) + " · 共现 " + l.old.co.toFixed(2) + "→" + l.w.co.toFixed(2);
      }).join("</div><div class=\"hint mono\">") + "</div>";
    }
    h += '<div class="hint" style="margin-top:8px">校准 = 用全部已载入历史（每期只用其之前 30 期）分别测试三个维度单独选号的场均命中，相对随机基线调整权重（夹在 0.6–1.4）。单维度命中与基线的差异通常在噪声范围内，权重变化不改变中奖概率。</div>' +
      '<div class="btn-row"><button class="btn ghost" data-act="cal">运行校准</button></div></div>';
    return h;
  }

  function recoCardHTML(g) {
    const cfg = GAMES[g];
    const list = recoList(g);
    if (!list.length) return "";
    const expF = (cfg.type === "digits" ? cfg.pos / 10 : cfg.fk * cfg.draw / cfg.fn).toFixed(1);
    const expB = cfg.bk ? (cfg.bk * cfg.bk / cfg.bn).toFixed(1) : null;
    let h = '<div class="card"><div class="eyebrow">推荐存档核对（开奖后自动回填）</div>';
    for (const r of list.slice(0, 8)) {
      if (r.gr) {
        const parts = r.gr.rows.map((row) => {
          if (row.pos != null) return esc(row.tag) + " 命中 " + row.pos + "/" + cfg.pos + " 位";
          return esc(row.tag) + " 命中 " + row.hits + " 个" + (row.bh == null ? "" : (row.bh > 0 ? "＋后区" : ""));
        });
        h += '<div class="hint mono">基于第' + esc(r.basedOn) + "期 → 实开第" + esc(r.gr.issue) + "期（" + esc(r.gr.date) + "）：" + parts.join(" · ") + "</div>";
      } else {
        h += '<div class="hint mono">基于第' + esc(r.basedOn) + "期分析 · 预测第" + esc(nextIssue(r.basedOn) || "下一期") + "期 · 待其开奖后核对（" + r.sets.length + " 注已存档）</div>";
      }
    }
    h += '<div class="hint" style="margin-top:8px">随机期望命中：' + (cfg.type === "digits" ? "各位直选 " : "号码 ") + expF +
      (expB ? " · 后区 " + expB : "") + " 个——长期看，存档命中率会贴近这个期望，这正是「开奖随机」的直观验证。存档只存在本机浏览器。</div>" +
      '<div class="btn-row"><button class="btn ghost" data-act="clearreco">清空本彩种存档</button></div></div>';
    return h;
  }

  function stepsHTML(g) {
    const r = state[g].result;
    let h = '<div style="margin-top:14px"><div class="eyebrow">走势明细（点开查看）</div></div>';
    r.sections.forEach((sec, i) => {
      const open = state[g].open.has(i) ? " open" : "";
      let body = "";
      for (const l of sec.lines) {
        const e2 = esc(l);
        if (/^(近 |预测|质数口径|三区|热号|冷号|超期|上期开|重号|邻号|⚠|合成方法|走势结构|所有推荐|0路|奇数|大数|跨度|组选|各位)/.test(l)) body += '<div class="mono">' + e2 + "</div>";
        else body += "<div>" + e2 + "</div>";
      }
      body += sec.cand ? ('<div class="cand">[形态合成推荐] ' + esc(Engine.fmtS(sec.cand.f)) + "</div>") : "";
      body += '<div class="why">(' + esc(sec.why) + ")</div>";
      h += '<details class="step"' + open + '><summary>' + esc(sec.title) + '<span class="arrow">›</span></summary><div class="body">' + body + "</div></details>";
    });
    return h;
  }

  function histHTML(g) {
    const list = store[g].list.slice(-10).reverse();
    let h = '<div class="card"><div class="eyebrow">最近 10 期开奖</div>';
    for (const d of list) {
      h += '<div class="hist-row"><span class="hissue num">第' + esc(d.issue) + "期</span>" +
        '<span class="hdate">' + esc(String(d.date).slice(0, 10)) + "</span>" +
        '<span class="balls">' + gameBalls(g, d.nums, "xs") + "</span></div>";
    }
    return h + "</div>";
  }

  function renderGame(g) {
    const cfg = GAMES[g];
    const st = state[g];
    const s = store[g];
    const el = $("#page-" + g);
    let h = "";
    if (!s.list.length) {
      h += '<div class="state-box"><strong>' + esc(cfg.name) + ' 数据未就绪</strong>从官方接口获取历史开奖后即可开始分析' +
        '<div><button class="btn primary" data-act="refresh">获取数据</button></div></div>';
      el.innerHTML = h;
      st.rendered = true;
      return;
    }
    const last = s.list[s.list.length - 1];
    h += '<div class="card"><div class="draw-hero"><div>' +
      '<div class="eyebrow">' + esc(cfg.full) + " · 最新开奖</div>" +
      '<div class="issue num">第 ' + esc(last.issue) + " 期</div>" +
      '<div class="meta">' + esc(String(last.date).slice(0, 10)) + " 开奖</div></div>" +
      freshHTML(g) + "</div>" +
      '<div class="balls" style="margin-top:12px">' + gameBalls(g, last.nums) + "</div></div>";
    h += '<div class="card"><div class="eyebrow">近 30 期走势形态 · 推荐合成</div>' +
      '<div class="hint">' + (cfg.type === "digits"
        ? "只用最近 30 期：各位走势 / 一阶马尔可夫转移 / 和值条件区间 / 奇偶大小 / 012路 / 跨度" + (g === "fc3d" ? " / 组选形态" : "") + " → 形态约束下按四种平滑评分合成直选，另附纯随机对照。"
        : "只用最近 30 期：和值（条件化）/ 奇偶 / 质合 / 大小 / 区间 / 012路 / 重号邻号斜跳 / 冷热遗漏 → 一阶马尔可夫转移预测下期形态 → 形态约束下按四种平滑评分合成，另附纯随机对照。") + "</div>" +
      '<div class="btn-row"><button class="btn ghost" data-act="refresh">更新数据</button>' +
      '<button class="btn primary" data-act="go" id="' + g + '-go">' + (st.result ? "重新分析" : "开始分析") + "</button></div>" +
      '<div class="hint" id="' + g + '-prog" style="margin-top:8px;min-height:16px">' + (st.running ? "近 30 期走势形态分析中…" : "") + "</div></div>";
    if (st.result) {
      h += bannerHTML(g);
      h += setsCardHTML(g);
    }
    h += statsCardHTML(g);
    if (st.result) h += stepsHTML(g);
    h += calCardHTML(g);
    h += histCardHTML(g);
    h += recoCardHTML(g);
    h += histHTML(g);
    el.innerHTML = h;
    st.rendered = true;
  }

  async function runAnalysis(g) {
    const st = state[g];
    if (st.running) return;
    if (store[g].list.length < 30) { toast(GAMES[g].name + " 历史数据不足 30 期，请先更新数据"); return; }
    st.running = true;
    const btn = $("#" + g + "-go"), prog = $("#" + g + "-prog");
    if (btn) btn.disabled = true;
    if (prog) prog.textContent = "近 30 期走势形态分析中，请稍候…";
    await new Promise((r) => setTimeout(r, 50));
    try {
      const t0 = performance.now();
      const res = Engine.analyzeGame(g);
      res.ms = Math.round(performance.now() - t0);
      st.result = res;
      saveReco(g, res);
      st.running = false;
      renderGame(g);
      toast(GAMES[g].name + "走势分析完成，用时 " + res.ms + "ms");
    } catch (e) {
      toast("分析出错：" + e.message);
      if (prog) prog.textContent = "";
    } finally {
      st.running = false;
    }
  }

  function bindGamePage(g) {
    const el = $("#page-" + g);
    el.addEventListener("click", (ev) => {
      const t = ev.target.closest("[data-act]");
      if (t) {
        const act = t.dataset.act;
        if (act === "refresh") refreshGame(g, false);
        else if (act === "go") runAnalysis(g);
        else if (act === "metric") { state[g].metric = t.dataset.m; renderGame(g); }
        else if (act === "clearreco") { reco[g] = []; saveRecoStore(); renderGame(g); toast(GAMES[g].name + " 存档已清空"); }
        else if (act === "cal") {
          const r = runCal(g);
          if (r) { renderGame(g); toast(GAMES[g].name + " 校准完成：样本 " + r.raw.n + " 期"); }
          else toast(GAMES[g].name + " 历史数据不足，无法校准");
        }
        else if (act === "hist") {
          const b2 = t;
          b2.disabled = true;
          const prog = $("#" + g + "-hist-prog");
          const nRev = g === "kl8" ? 100 : 300;
          if (prog) prog.textContent = "历史复盘计算中：0%（走前模拟 " + nRev + " 期）";
          Engine.historicalReview(g, nRev, function(pct) { if (prog) prog.textContent = "历史复盘计算中：" + pct + "%（走前模拟 " + nRev + " 期）"; }, function(r) {
            b2.disabled = false;
            if (!r) { if (prog) prog.textContent = "历史数据不足，无法复盘"; return; }
            const all = JSON.parse(localStorage.getItem("lt30_hist_v1") || "{}");
            all[g] = { upto: String(store[g].list[store[g].list.length - 1].issue), r: r };
            localStorage.setItem("lt30_hist_v1", JSON.stringify(all));
            renderGame(g);
            toast(GAMES[g].name + " 历史复盘完成：" + r.n + " 期走前模拟");
          });
        }
        return;
      }
      if (ev.target.closest("summary")) {
        setTimeout(() => {
          const opens = new Set();
          $$("#page-" + g + " details.step").forEach((d, i) => { if (d.open) opens.add(i); });
          state[g].open = opens;
        }, 0);
      }
    });
  }

  /* ============ 全局 ============ */
  let toastTimer = null;
  function toast(msg) {
    const t = $("#toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("on"), 2800);
  }

  function switchPage(id) {
    $$(".page").forEach((p) => p.classList.toggle("on", p.id === id));
    $$(".tab-btn").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.page === id)));
    window.scrollTo(0, 0);
  }

  function boot() {
    loadLocal();
    applyW();
    KEYS.forEach((g) => gradeRecords(g));
    for (const g of KEYS) bindGamePage(g);
    for (const g of KEYS) renderGame(g);
    $$(".tab-btn").forEach((b) => b.addEventListener("click", () => switchPage(b.dataset.page)));
    if (SNAP.builtAt) { const el2 = $("#snap-built"); if (el2) el2.textContent = String(SNAP.builtAt).slice(0, 10); }
    switchPage("page-ssq");
    const ready = KEYS.filter((g) => store[g].list.length).length;
    if (ready === KEYS.length) setNet("ok", "本地数据就绪 · 正在核对官方");
    else setNet("", "正在获取数据…");
    const AUTO_AGE = 6 * 3600e3;
    KEYS.forEach((g, i) => {
      if (!store[g].ts || Date.now() - store[g].ts >= AUTO_AGE) {
        setTimeout(() => refreshGame(g, true), 600 + i * 1200);
      }
    });
    if ("serviceWorker" in navigator &&
        (location.protocol === "https:" || ["localhost", "127.0.0.1"].includes(location.hostname))) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  boot();
})();
