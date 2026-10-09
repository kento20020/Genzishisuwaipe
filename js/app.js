(() => {
  "use strict";

  // ---------- 設定 ----------
  const DURATION = 5000; // 1ゲームの制限時間（ミリ秒）
  const READY_MS = 900; // 「READY?」を見せる時間
  const GO_MS = 350; // 「GO!」を見せる時間
  const AUTO_NEXT_MS = 1500; // 結果のあと自動で次へ進むまで（0で自動送りなし）
  const CM_EVERY = 8; // 何ゲームごとにCM画面を挟むか（将来の広告枠）
  const BEST_KEY = "gobyo-best";
  const HASHTAG = "ゴビョー";
  const MISS_LINES = ["ざんねん！", "おしい！", "ドンマイ！", "つぎ、つぎ！"];

  const feed = document.getElementById("feed");
  const comboChip = document.getElementById("hudComboChip");
  const comboEl = document.getElementById("hudCombo");
  const bestEl = document.getElementById("hudBest");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const slots = new Map(); // 画面（section）→ 制御オブジェクト
  const state = { combo: 0, best: loadBest(), active: null, locked: false, gameCount: 0 };

  // ---------- 小物 ----------
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const levelNow = () => Math.min(5, Math.floor(state.combo / 4));

  function loadBest() {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch (_) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch (_) {
      // 保存できない環境では、その場かぎりの記録にする
    }
  }

  function restartAnimation(node, className) {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  }

  let toastTimer = 0;
  function toast(message) {
    const node = document.getElementById("toast");
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      node.hidden = true;
    }, 2200);
  }

  function updateHud(bump) {
    comboEl.textContent = String(state.combo);
    bestEl.textContent = String(state.best);
    if (bump) restartAnimation(comboChip, "bump");
  }

  // ---------- スクロール ----------
  function setLocked(on) {
    state.locked = on;
    feed.classList.toggle("locked", on);
  }

  function scrollToSection(section) {
    if (!section) return;
    feed.scrollTo({ top: section.offsetTop, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const goNext = () => state.active && scrollToSection(state.active.section.nextElementSibling);
  const goPrev = () => state.active && scrollToSection(state.active.section.previousElementSibling);

  // ---------- ゲームの出題順（同じゲームが続かないように） ----------
  let bag = [];
  let lastGameId = null;
  function drawGame() {
    if (bag.length === 0) {
      bag = shuffle(GAMES);
      const last = bag.length - 1;
      if (bag.length > 1 && bag[last].id === lastGameId) [bag[0], bag[last]] = [bag[last], bag[0]];
    }
    const game = bag.pop();
    lastGameId = game.id;
    return game;
  }

  // ---------- ゲーム画面 ----------
  function createGameSlot(game, no) {
    const section = el("section", `slot slot-game theme-${game.theme}`);
    section.setAttribute("aria-label", `No.${no} ${game.title}`);

    const card = el("div", "card");
    const head = el("div", "card-head");
    head.append(el("span", "card-no", `No.${String(no).padStart(3, "0")}`), el("span", "card-title", game.title));
    const inst = el("p", "inst", game.instruction(levelNow()));
    const fuse = el("div", "fuse");
    const fuseBar = el("span");
    fuse.append(fuseBar);

    const screen = el("div", "screen");
    const stage = el("div", "stage");
    const overlay = el("div", "overlay is-ready");
    const ovMain = el("p", "ov-main", "READY?");
    const ovSub = el("p", "ov-sub");
    overlay.append(ovMain, ovSub);
    screen.append(stage, overlay);

    const foot = el("div", "card-foot");
    const retry = el("button", "btn btn-small", "もう一回");
    retry.type = "button";
    foot.append(retry, el("span", "next-hint", "↑ スワイプで次へ"));

    card.append(head, inst, fuse, screen, foot);
    section.append(card);

    const ctl = {
      section,
      game,
      inst,
      fuseBar,
      stage,
      overlay,
      ovMain,
      ovSub,
      status: "idle",
      run: 0,
      timers: [],
      cleanups: [],
      keyHandler: null,
      activate() {
        if (ctl.status === "idle") ready(ctl);
      },
      deactivate() {
        if (ctl.status === "ready") toIdle(ctl);
      },
    };
    retry.addEventListener("click", () => {
      if (ctl.status === "done" && state.active === ctl) ready(ctl);
    });
    register(section, ctl);
    return section;
  }

  function later(ctl, ms, fn) {
    ctl.timers.push(setTimeout(fn, ms));
  }

  function stopAll(ctl) {
    ctl.timers.forEach(clearTimeout);
    ctl.timers = [];
    for (const fn of ctl.cleanups.splice(0)) {
      try {
        fn();
      } catch (_) {
        // 片付けの失敗は無視
      }
    }
    ctl.keyHandler = null;
  }

  function showOverlay(ctl, mode, main, sub) {
    ctl.overlay.className = `overlay is-${mode}`;
    ctl.ovMain.textContent = main;
    ctl.ovSub.textContent = sub || "";
    ctl.overlay.hidden = false;
    restartAnimation(ctl.ovMain, "pop");
  }

  function resetFuse(ctl) {
    ctl.fuseBar.style.transition = "none";
    ctl.fuseBar.style.transform = "scaleX(1)";
  }

  function startFuse(ctl) {
    void ctl.fuseBar.offsetWidth;
    ctl.fuseBar.style.transition = `transform ${DURATION}ms linear`;
    ctl.fuseBar.style.transform = "scaleX(0)";
  }

  function freezeFuse(ctl) {
    const now = getComputedStyle(ctl.fuseBar).transform;
    ctl.fuseBar.style.transition = "none";
    ctl.fuseBar.style.transform = now === "none" ? "scaleX(1)" : now;
  }

  function toIdle(ctl) {
    stopAll(ctl);
    ctl.run++;
    ctl.status = "idle";
    resetFuse(ctl);
    showOverlay(ctl, "ready", "READY?");
  }

  function ready(ctl) {
    stopAll(ctl);
    ctl.run++;
    ctl.status = "ready";
    ctl.section.classList.remove("is-done", "is-clear", "is-miss", "is-playing");
    ctl.stage.replaceChildren();
    ctl.inst.textContent = ctl.game.instruction(levelNow());
    resetFuse(ctl);
    showOverlay(ctl, "ready", "READY?");
    later(ctl, READY_MS, () => showOverlay(ctl, "go", "GO!"));
    later(ctl, READY_MS + GO_MS, () => play(ctl));
  }

  function play(ctl) {
    if (state.active !== ctl) {
      toIdle(ctl);
      return;
    }
    // スクロールの途中で止まっていたら、ぴったり合わせてから固定する
    if (Math.abs(feed.scrollTop - ctl.section.offsetTop) > 1) feed.scrollTop = ctl.section.offsetTop;
    setLocked(true);
    ctl.status = "play";
    ctl.section.classList.add("is-playing");
    ctl.overlay.hidden = true;
    startFuse(ctl);
    const g = makeApi(ctl, ctl.run);
    try {
      ctl.game.setup(g);
    } catch (err) {
      console.error(err);
    }
    later(ctl, DURATION, () => g.end(ctl.game.timeout === "win"));
  }

  function finish(ctl, won) {
    stopAll(ctl);
    ctl.status = "done";
    freezeFuse(ctl);
    ctl.section.classList.remove("is-playing");
    ctl.section.classList.add("is-done", won ? "is-clear" : "is-miss");

    let sub;
    if (won) {
      state.combo++;
      const newBest = state.combo > state.best;
      if (newBest) {
        state.best = state.combo;
        saveBest(state.best);
      }
      sub = `${state.combo} COMBO${newBest && state.combo > 1 ? "　NEW BEST!" : ""}`;
    } else {
      state.combo = 0;
      sub = pick(MISS_LINES);
    }
    updateHud(won);
    showOverlay(ctl, won ? "clear" : "miss", won ? "CLEAR!" : "MISS…", sub);
    setLocked(false);

    if (AUTO_NEXT_MS > 0) {
      const run = ctl.run;
      later(ctl, AUTO_NEXT_MS, () => {
        if (ctl.run === run && ctl.status === "done" && state.active === ctl) goNext();
      });
    }
  }

  // ゲームに渡す道具（games.js の説明を参照）
  function makeApi(ctl, run) {
    const stage = ctl.stage;
    const alive = () => ctl.run === run && ctl.status === "play";
    const tapFns = [];
    const swipeFns = [];
    let tapSides = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let swiped = false;

    const local = (e) => {
      const r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    };
    const emitSwipe = (dir) => swipeFns.forEach((fn) => alive() && fn(dir));

    const onDown = (e) => {
      if (!alive()) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      swiped = false;
      if (swipeFns.length) {
        try {
          stage.setPointerCapture(e.pointerId);
        } catch (_) {
          // 取れなくても動作には影響しない
        }
      }
      const p = local(e);
      tapFns.forEach((fn) => alive() && fn({ ...p, target: e.target }));
    };
    const onMove = (e) => {
      if (e.pointerId !== pointerId || swiped || !swipeFns.length || !alive()) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy)) {
        swiped = true;
        emitSwipe(dx < 0 ? "left" : "right");
      }
    };
    const onUp = (e) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      if (!swiped && tapSides && alive() && e.type === "pointerup") {
        const p = local(e);
        emitSwipe(p.x < p.w / 2 ? "left" : "right");
      }
    };

    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    ctl.cleanups.push(() => {
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
    });

    ctl.keyHandler = (key) => {
      if (key === "ArrowLeft" || key === "ArrowRight") {
        emitSwipe(key === "ArrowLeft" ? "left" : "right");
      } else {
        const r = stage.getBoundingClientRect();
        tapFns.forEach((fn) => alive() && fn({ x: r.width / 2, y: r.height / 2, w: r.width, h: r.height, target: null }));
      }
    };

    const api = {
      stage,
      level: levelNow(),
      el,
      win: () => api.end(true),
      lose: () => api.end(false),
      end: (won) => {
        if (alive()) finish(ctl, won);
      },
      after: (ms, fn) => later(ctl, ms, () => alive() && fn()),
      frame: (fn) => {
        const start = performance.now();
        let last = start;
        const loop = (now) => {
          if (!alive()) return;
          fn(Math.max(0, now - last) / 1000, Math.max(0, now - start) / 1000);
          last = now;
          if (alive()) requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      },
      onTap: (fn) => tapFns.push(fn),
      onSwipe: (fn, opts = {}) => {
        swipeFns.push(fn);
        if (opts.tapSides) tapSides = true;
      },
    };
    return api;
  }

  // ---------- CM画面（将来ここに広告を置く） ----------
  function shareUrl() {
    // window.GOBYO_SHARE_URL を文字列で指定すると、そのURLをシェアに使う（"" ならURLなし）
    if (typeof window.GOBYO_SHARE_URL === "string") return window.GOBYO_SHARE_URL;
    if (!/^https?:$/.test(location.protocol)) return "";
    return location.origin + location.pathname;
  }

  function shareText() {
    return state.best > 0
      ? `ゴビョー！で${state.best}連続クリア！\n5秒ミニゲーム、きみは何連続いける？`
      : "5秒ミニゲーム「ゴビョー！」\nきみは何連続クリアできる？";
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("コピーしました");
      return;
    } catch (_) {
      // 下の方法で再挑戦
    }
    const area = el("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (_) {
      ok = false;
    }
    area.remove();
    toast(ok ? "コピーしました" : "コピーできませんでした");
  }

  function createCmSlot() {
    const section = el("section", "slot slot-cm");
    section.setAttribute("aria-label", "CM");
    const card = el("div", "card cm-card");

    const bars = el("div", "cm-bars");
    bars.setAttribute("aria-hidden", "true");
    const label = el("p", "cm-label", "CM");
    const title = el("h2", "cm-title");
    title.append("コマーシャルのあとも", document.createElement("br"), "ゴビョー！は つづく");
    const best = el("p", "cm-best");
    const bestNum = el("b", null, "0");
    best.append("いまのベスト ", bestNum, " COMBO");
    const lead = el("p", "cm-lead", "友達に挑戦状をおくろう");

    const share = el("div", "share");
    const x = el("a", "btn btn-ink", "Xでポスト");
    const line = el("a", "btn btn-mint", "LINEで送る");
    for (const a of [x, line]) {
      a.target = "_blank";
      a.rel = "noopener";
    }
    const copy = el("button", "btn", "文章をコピー");
    copy.type = "button";
    const native = el("button", "btn", "ほかのアプリ");
    native.type = "button";
    native.hidden = typeof navigator.share !== "function";
    share.append(x, line, copy, native);

    // 広告を載せるときは、このCM画面の中に広告タグを入れる
    card.append(bars, label, title, best, lead, share);
    section.append(card);

    const refresh = () => {
      bestNum.textContent = String(state.best);
      const text = shareText();
      const url = shareUrl();
      const enc = encodeURIComponent;
      x.href = `https://twitter.com/intent/tweet?text=${enc(text)}&hashtags=${enc(HASHTAG)}${url ? `&url=${enc(url)}` : ""}`;
      line.href = `https://line.me/R/share?text=${enc([text, `#${HASHTAG}`, url].filter(Boolean).join("\n"))}`;
    };
    copy.addEventListener("click", () => copyText([shareText(), `#${HASHTAG}`, shareUrl()].filter(Boolean).join("\n")));
    native.addEventListener("click", () => {
      const url = shareUrl();
      navigator.share({ title: "ゴビョー！", text: `${shareText()}\n#${HASHTAG}`, url: url || undefined }).catch((err) => {
        if (err && err.name !== "AbortError") toast("この画面では使えません。文章をコピーしてください");
      });
    });

    register(section, { section, activate: refresh, deactivate() {} });
    return section;
  }

  // ---------- フィード ----------
  function appendGames(count) {
    for (let i = 0; i < count; i++) {
      state.gameCount++;
      feed.append(createGameSlot(drawGame(), state.gameCount));
      if (CM_EVERY > 0 && state.gameCount % CM_EVERY === 0) feed.append(createCmSlot());
    }
  }

  function setActive(ctl) {
    if (!ctl || state.active === ctl) return;
    const prev = state.active;
    state.active = ctl;
    if (prev) prev.deactivate();
    ctl.activate();
    let ahead = 0;
    for (let n = ctl.section.nextElementSibling; n && ahead < 4; n = n.nextElementSibling) ahead++;
    if (ahead < 4) appendGames(6);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.65) setActive(slots.get(entry.target));
      }
    },
    { root: feed, threshold: [0.7] }
  );

  function register(section, ctl) {
    slots.set(section, ctl);
    observer.observe(section);
  }

  document.addEventListener("keydown", (e) => {
    const keys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "ArrowLeft", "ArrowRight", " ", "Enter"];
    if (state.locked) {
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      const ctl = state.active;
      if (ctl && ctl.keyHandler && ["ArrowLeft", "ArrowRight", " ", "Enter"].includes(e.key)) ctl.keyHandler(e.key);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      goNext();
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      goPrev();
    }
  });

  // ---------- 起動 ----------
  const titleSection = document.getElementById("slotTitle");
  const titleBest = document.getElementById("titleBest");
  register(titleSection, {
    section: titleSection,
    activate() {
      titleBest.textContent = String(state.best);
    },
    deactivate() {},
  });
  document.getElementById("btnStart").addEventListener("click", goNext);
  titleBest.textContent = String(state.best);
  updateHud(false);
  appendGames(6);
})();
