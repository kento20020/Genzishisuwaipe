(() => {
  "use strict";

  // ---------- 設定 ----------
  const DURATION = 5000; // 1ゲームの制限時間（ミリ秒）
  const READY_MS = 900; // 「READY?」を見せる時間
  const GO_MS = 350; // 「GO!」を見せる時間
  const AUTO_NEXT_MS = 1500; // 結果のあと自動で次へ進むまで（0で自動送りなし）
  const LEVEL_EVERY = 4; // 何COMBOごとに難しくなるか
  const CM_EVERY = 8; // 何ゲームごとにCM画面を挟むか（将来の広告枠）
  const BEST_KEY = "gobyo-best";
  const HASHTAG = "ゴビョー";
  const MISS_LINES = ["ざんねん！", "おしい！", "ドンマイ！", "つぎ、つぎ！"];
  const GAME_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"];
  const NAV_KEYS = ["ArrowUp", "ArrowDown", "PageUp", "PageDown"];

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
  const levelNow = () => Math.min(5, Math.floor(state.combo / LEVEL_EVERY));

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

  // ---------- 上のスコア表示 ----------
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
    const config = game.prepare ? game.prepare(levelNow()) : {};

    const card = el("div", "card");
    const head = el("div", "card-head");
    head.append(el("span", "card-no", `No.${String(no).padStart(3, "0")}`), el("span", "card-title", game.title));
    const inst = el("p", "inst", game.instruction(levelNow(), config));
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
    const retry = el("button", "btn btn-small btn-retry", "もう一回");
    retry.type = "button";
    foot.append(retry, el("span", "next-hint", "↑ スワイプで次へ"));

    card.append(head, inst, fuse, screen, foot);
    section.append(card);

    const ctl = {
      section,
      game,
      config,
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
    ctl.inst.textContent = ctl.game.instruction(levelNow(), ctl.config);
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
    const fns = { tap: [], release: [], drag: [], swipe: [], flick: [], key: [] };
    let tapSides = false;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let swiped = false;

    const emit = (list, arg, extra) => list.forEach((fn) => alive() && fn(arg, extra));
    const local = (e) => {
      const r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
    };
    const center = () => {
      const r = stage.getBoundingClientRect();
      return { x: r.width / 2, y: r.height / 2, w: r.width, h: r.height, target: null };
    };

    const onDown = (e) => {
      if (!alive()) return;
      // 連打できるよう、2本目の指でもタップとして数える。スワイプ・ドラッグは1本目の指だけ見る
      if (pointerId === null) {
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        swiped = false;
        try {
          stage.setPointerCapture(e.pointerId);
        } catch (_) {
          // 取れなくても動作には影響しない
        }
      }
      emit(fns.tap, { ...local(e), target: e.target });
    };
    const onMove = (e) => {
      if (e.pointerId !== pointerId || !alive()) return;
      emit(fns.drag, local(e));
      if (swiped) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if (Math.max(ax, ay) <= 26) return;
      if (fns.flick.length) {
        swiped = true;
        emit(fns.flick, ax > ay ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down");
      }
      if (fns.swipe.length && ax > ay) {
        swiped = true;
        emit(fns.swipe, dx < 0 ? "left" : "right");
      }
    };
    const onUp = (e) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      if (!alive()) return;
      const p = local(e);
      emit(fns.release, p);
      if (!swiped && tapSides && e.type === "pointerup") emit(fns.swipe, p.x < p.w / 2 ? "left" : "right");
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

    // キーボード：矢印キーはスワイプ・フリック、スペース・Enter はタップ（はなすと onRelease）
    ctl.keyHandler = (key, type) => {
      emit(fns.key, key, type);
      if (type === "down") {
        if (key === "ArrowLeft" || key === "ArrowRight") {
          const dir = key === "ArrowLeft" ? "left" : "right";
          emit(fns.swipe, dir);
          emit(fns.flick, dir);
        } else if (key === "ArrowUp" || key === "ArrowDown") {
          emit(fns.flick, key === "ArrowUp" ? "up" : "down");
        } else {
          emit(fns.tap, center());
        }
      } else if (key === " " || key === "Enter") {
        emit(fns.release, center());
      }
    };

    const api = {
      stage,
      level: levelNow(),
      config: ctl.config,
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
      onTap: (fn) => fns.tap.push(fn),
      onRelease: (fn) => fns.release.push(fn),
      onDrag: (fn) => fns.drag.push(fn),
      onKey: (fn) => fns.key.push(fn),
      onFlick: (fn) => fns.flick.push(fn),
      onSwipe: (fn, opts = {}) => {
        fns.swipe.push(fn);
        if (opts.tapSides) tapSides = true;
      },
    };
    return api;
  }

  // ---------- シェア ----------
  const site = typeof SITE === "object" && SITE ? SITE : {};

  function shareUrl() {
    // window.GOBYO_SHARE_URL を文字列で指定すると、そのURLをシェアに使う（"" ならURLなし）
    if (typeof window.GOBYO_SHARE_URL === "string") return window.GOBYO_SHARE_URL;
    if (site.url) return site.url;
    if (!/^https?:$/.test(location.protocol)) return "";
    return location.origin + location.pathname;
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

  // X・LINE・コピー・端末の共有ボタンの列。getText() でその時点の文章を作る
  function makeShareRow(getText) {
    const row = el("div", "share");
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
    row.append(x, line, copy, native);

    const fullText = () => [getText(), `#${HASHTAG}`, shareUrl()].filter(Boolean).join("\n");
    const refresh = () => {
      const url = shareUrl();
      const enc = encodeURIComponent;
      x.href = `https://twitter.com/intent/tweet?text=${enc(getText())}&hashtags=${enc(HASHTAG)}${url ? `&url=${enc(url)}` : ""}`;
      line.href = `https://line.me/R/share?text=${enc(fullText())}`;
    };
    copy.addEventListener("click", () => copyText(fullText()));
    native.addEventListener("click", () => {
      const url = shareUrl();
      navigator.share({ title: "ゴビョー！", text: `${getText()}\n#${HASHTAG}`, url: url || undefined }).catch((err) => {
        if (err && err.name !== "AbortError") toast("この画面では使えません。文章をコピーしてください");
      });
    });
    refresh();
    return { el: row, refresh };
  }

  // ---------- CM画面（将来ここに広告を置く） ----------
  function createCmSlot() {
    const section = el("section", "slot slot-cm");
    section.setAttribute("aria-label", "CM");
    const card = el("div", "card cm-card");

    const bars = el("div", "cm-bars");
    bars.setAttribute("aria-hidden", "true");
    const title = el("h2", "cm-title");
    title.append("コマーシャルのあとも", document.createElement("br"), "ゴビョー！は つづく");
    const best = el("p", "cm-best");
    const bestNum = el("b", null, "0");
    best.append("いまのベスト ", bestNum, " COMBO");
    const share = makeShareRow(() =>
      state.best > 0
        ? `ゴビョー！で${state.best}連続クリア！\n5秒ミニゲーム、きみは何連続いける？`
        : "5秒ミニゲーム「ゴビョー！」\nきみは何連続クリアできる？"
    );

    const privacy = el("a", "cm-link", "プライバシーポリシー");
    privacy.href = "privacy.html";

    // 広告（js/config.js の adFrame を設定したときだけ）。CM画面が表示されたときに読みこむ
    let adBox = null;
    if (site.adFrame) {
      const [w, h] = site.adSize || [300, 250];
      adBox = el("div", "cm-ad");
      adBox.style.setProperty("--ad-w", `${w}px`);
      adBox.style.setProperty("--ad-h", `${h}px`);
      adBox.append(el("span", "cm-ad-label", "広告"));
      section.classList.add("has-ad");
    }

    card.append(el("p", "cm-label", "CM"), adBox || bars, title, best, el("p", "cm-lead", "友達に挑戦状をおくろう"), share.el, privacy);
    section.append(card);

    register(section, {
      section,
      activate() {
        bestNum.textContent = String(state.best);
        share.refresh();
        if (adBox && !adBox.querySelector("iframe")) {
          const [w, h] = site.adSize || [300, 250];
          const frame = el("iframe");
          frame.src = site.adFrame;
          frame.width = String(w);
          frame.height = String(h);
          frame.title = "広告";
          frame.loading = "lazy";
          frame.setAttribute("scrolling", "no");
          adBox.append(frame);
        }
      },
      deactivate() {
        // 画面から外れた広告は外す（長く遊んでも重くならないように。戻ってきたら読みこみ直す）
        const frame = adBox && adBox.querySelector("iframe");
        if (frame) frame.remove();
      },
    });
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
    if (state.locked) {
      if (GAME_KEYS.includes(e.key) || NAV_KEYS.includes(e.key)) e.preventDefault();
      const ctl = state.active;
      if (!e.repeat && ctl && ctl.keyHandler && GAME_KEYS.includes(e.key)) ctl.keyHandler(e.key, "down");
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
  document.addEventListener("keyup", (e) => {
    const ctl = state.active;
    if (state.locked && ctl && ctl.keyHandler && GAME_KEYS.includes(e.key)) ctl.keyHandler(e.key, "up");
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
  updateHud();
  appendGames(6);
})();
