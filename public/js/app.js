(() => {
  "use strict";

  // ---------- 設定 ----------
  const DURATION = 5000; // 1ゲームの制限時間（ミリ秒）。時間内にやりとげるタイプのゲーム
  const SURVIVE_MS = 5000; // 「耐えれば勝ち」タイプ（timeout: "win"）のゲームの耐える時間。別の長さにもできる
  const READY_MS = 2000; // 「READY?」とお題を大きく見せる時間（ミリ秒）
  const GO_MS = 350; // 「GO!」を見せる時間
  const AUTO_NEXT_MS = 1500; // 結果のあと自動で次へ進むまで（0で自動送りなし）
  const LEVEL_EVERY = 4; // 何COMBOごとに難しくなるか
  const SHOW_HOWTO = true; // 初めて出るゲームに、操作の見本を見せるか
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
  const state = { combo: 0, best: loadBest(), active: null, locked: false, gameCount: 0, noAds: false };

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

  // 「上にスワイプ」の見本：指が触れて、上へなぞって、離れる動き＋上向きの矢印
  function makeSwipeCue() {
    const NS = "http://www.w3.org/2000/svg";
    const cue = el("span", "swipe-cue");
    cue.setAttribute("aria-hidden", "true");
    const chevs = el("span", "swipe-cue-chevs");
    for (let i = 0; i < 3; i++) {
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 44 24");
      svg.setAttribute("class", "swipe-cue-chev");
      for (const cls of ["edge", "fill"]) {
        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", "M5 19 L22 5 L39 19");
        path.setAttribute("class", cls);
        svg.append(path);
      }
      chevs.append(svg);
    }
    cue.append(chevs, el("span", "swipe-cue-trail"), el("span", "swipe-cue-finger"));
    return cue;
  }

  // ---------- 初めてのゲームの操作見本 ----------
  const HOWTO_KEY = "gobyo-howto";
  function seenHowto() {
    try {
      return JSON.parse(localStorage.getItem(HOWTO_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }
  function markHowto(id) {
    const list = seenHowto();
    if (list.includes(id)) return;
    list.push(id);
    try {
      localStorage.setItem(HOWTO_KEY, JSON.stringify(list));
    } catch (_) {
      // 保存できなくても、そのときだけ見られなくなるだけ
    }
  }
  const needsHowto = (game) =>
    SHOW_HOWTO && typeof HOWTO === "object" && HOWTO[game.id] && !seenHowto().includes(game.id);

  // 指のマークが、その操作をやってみせる
  function makeDemo(kind) {
    const demo = el("div", `howto-demo is-${kind}`);
    demo.setAttribute("aria-hidden", "true");
    if (kind === "drag") demo.append(el("span", "hd-slot"), el("span", "hd-piece"));
    if (kind === "pull") demo.append(el("span", "hd-ball"), el("span", "hd-band"));
    if (kind === "choose") for (let i = 0; i < 3; i++) demo.append(el("span", "hd-choice"));
    if (kind === "flick") for (const d of ["up", "right", "down", "left"]) demo.append(el("span", `hd-arrow hd-${d}`));
    if (kind === "swipe") demo.append(el("span", "hd-arrow hd-left"), el("span", "hd-arrow hd-right"));
    if (kind === "nothing") demo.append(el("span", "hd-stop", "✋"));
    if (["swipe", "drag", "rub", "pull", "flick", "circle"].includes(kind)) demo.append(el("span", "hd-trail"));
    if (kind !== "nothing") demo.append(el("span", "hd-finger"));
    return demo;
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
    const ovHint = el("p", "ov-hint"); // 失敗の理由の下の、はげまし
    // クリア・失敗のあと：「上にスワイプ」の見本と、同じ大きさの2つのボタン
    const ovNext = el("div", "ov-next");
    ovNext.hidden = true;
    const actions = el("div", "ov-actions");
    const retry = el("button", "btn btn-act btn-retry", "もう一回");
    retry.type = "button";
    const next = el("button", "btn btn-act btn-next", "次のゲーム ↑");
    next.type = "button";
    actions.append(retry, next);
    ovNext.append(makeSwipeCue(), actions);
    // 初めてのゲームの操作見本（指の動き）と「やってみる」ボタン
    const howto = el("div", "ov-howto");
    howto.hidden = true;
    const howtoDemo = el("div", "ov-howto-demo");
    const go = el("button", "btn btn-act btn-go", "やってみる");
    go.type = "button";
    howto.append(howtoDemo, go);
    overlay.append(ovMain, ovSub, ovHint, howto, ovNext);
    screen.append(stage, overlay);

    card.append(head, inst, fuse, screen);
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
      ovHint,
      ovNext,
      howto,
      howtoDemo,
      status: "idle",
      run: 0,
      timers: [],
      cleanups: [],
      keyHandler: null,
      activate() {
        if (ctl.status === "idle") ready(ctl);
      },
      deactivate() {
        if (ctl.status === "ready" || ctl.status === "howto") toIdle(ctl);
        // 終わった画面の中のゲームの部品は、離れたら片付ける（動き続ける部品が残らないように）
        if (ctl.status === "done") ctl.stage.replaceChildren();
      },
    };
    retry.addEventListener("click", () => {
      if (ctl.status === "done" && ctl.missed && state.active === ctl) ready(ctl);
    });
    next.addEventListener("click", () => {
      if (ctl.status === "done" && state.active === ctl) goNext();
    });
    go.addEventListener("click", () => {
      if (ctl.status !== "howto" || state.active !== ctl) return;
      markHowto(ctl.game.id);
      startReady(ctl);
    });
    ctl.retryBtn = retry;
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

  function showOverlay(ctl, mode, main, sub, hint) {
    ctl.overlay.className = `overlay is-${mode}`;
    ctl.ovMain.textContent = main;
    ctl.ovSub.textContent = sub || "";
    ctl.ovHint.textContent = hint || "";
    ctl.retryBtn.hidden = mode !== "miss"; // 「もう一回」は失敗のときだけ（クリアをやり直してCOMBOを稼げないように）
    ctl.ovNext.hidden = mode !== "clear" && mode !== "miss";
    if (mode !== "howto") ctl.howto.hidden = true;
    ctl.overlay.hidden = false;
    restartAnimation(ctl.ovMain, "pop");
  }

  function resetFuse(ctl) {
    ctl.fuseBar.style.transition = "none";
    ctl.fuseBar.style.transform = "scaleX(1)";
  }

  const limitOf = (game) => (game.timeout === "win" ? SURVIVE_MS : DURATION);

  function startFuse(ctl, ms) {
    void ctl.fuseBar.offsetWidth;
    ctl.fuseBar.style.transition = `transform ${ms}ms linear`;
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
    ctl.howto.hidden = true;
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
    if (needsHowto(ctl.game)) {
      showHowto(ctl);
      return;
    }
    startReady(ctl);
  }

  function startReady(ctl) {
    ctl.status = "ready";
    ctl.howto.hidden = true;
    showOverlay(ctl, "ready", "READY?", ctl.inst.textContent); // お題を大きく見せる
    later(ctl, READY_MS, () => showOverlay(ctl, "go", "GO!"));
    later(ctl, READY_MS + GO_MS, () => play(ctl));
  }

  // 初めて出るゲーム：ルールを読む時間と、腕前を試す時間を分ける
  function showHowto(ctl) {
    ctl.status = "howto";
    const kind = HOWTO[ctl.game.id];
    showOverlay(ctl, "howto", "はじめてのゲーム", ctl.inst.textContent, HOWTO_LABEL[kind] || "");
    const demo = makeDemo(kind);
    ctl.howtoDemo.replaceChildren(demo);
    ctl.howto.hidden = false;
    // 空いている高さに合わせて、見本の大きさを決める（ボタンが画面の外に出ないように）
    demo.style.setProperty("--fit", String(Math.max(0.45, Math.min(1, ctl.howtoDemo.clientHeight / 160))));
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
    const limit = limitOf(ctl.game);
    startFuse(ctl, limit);
    const g = makeApi(ctl, ctl.run);
    try {
      ctl.game.setup(g);
    } catch (err) {
      console.error(err);
    }
    later(ctl, limit, () => g.end(ctl.game.timeout === "win", "時間切れ！"));
  }

  function finish(ctl, won, reason) {
    stopAll(ctl);
    ctl.status = "done";
    ctl.missed = !won;
    freezeFuse(ctl);
    ctl.section.classList.remove("is-playing");
    ctl.section.classList.add("is-done", won ? "is-clear" : "is-miss");
    let sub;
    let hint = "";
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
      // 失敗の理由を主役にして、はげましはその下に小さく
      sub = reason || pick(MISS_LINES);
      hint = reason ? pick(MISS_LINES) : "";
    }
    updateHud(won);
    showOverlay(ctl, won ? "clear" : "miss", won ? "CLEAR!" : "MISS…", sub, hint);
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
      duration: limitOf(ctl.game) / 1000, // このゲームの制限時間（秒）
      level: levelNow(),
      config: ctl.config,
      el,
      win: () => api.end(true),
      lose: (reason) => api.end(false, reason), // reason：失敗の理由（短く。例「もう少し強く！」「正解は3:00」）
      end: (won, reason) => {
        if (alive()) finish(ctl, won, reason);
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

    const links = el("p", "cm-links");
    const privacy = el("a", "cm-link", "プライバシーポリシー");
    privacy.href = "privacy";
    links.append(privacy);

    // 広告なしパックの購入ボタン（js/config.js の shop.paymentLink を設定したときだけ）
    const shop = site.shop || {};
    let buy = null;
    if (shop.paymentLink) {
      buy = el("a", "btn btn-buy", `広告をなくす（${shop.price || "500円"}）`);
      buy.href = shop.paymentLink;
      buy.rel = "noopener";
      const law = el("a", "cm-link", "特定商取引法に基づく表記");
      law.href = "tokushoho";
      links.append(law);
    }

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

    // 共有のまえに、まず「つづきを遊ぶ」（上にスワイプでも進める）
    const go = el("button", "btn btn-go", "つづきを遊ぶ ↑");
    go.type = "button";
    go.addEventListener("click", goNext);

    card.append(el("p", "cm-label", "CM"), adBox || bars, title, best, go, el("p", "cm-lead", "友達に挑戦状をおくろう"), share.el);
    if (buy) card.append(buy);
    card.append(links);
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
      // 広告なしパックを買った人には、CM画面を出さない
      if (CM_EVERY > 0 && !state.noAds && state.gameCount % CM_EVERY === 0) feed.append(createCmSlot());
    }
  }

  // ---------- 広告なしパック（購入済みの確認） ----------
  const NOADS_KEY = "gobyo-noads";

  function setNoAds() {
    if (state.noAds) return;
    state.noAds = true;
    // すでに作ってあるCM画面をなくす（いま表示中のものは残す）
    for (const [section, ctl] of [...slots]) {
      if (section.classList.contains("slot-cm") && state.active !== ctl) {
        observer.unobserve(section);
        slots.delete(section);
        section.remove();
      }
    }
  }

  // 保存してある購入の印を、サーバーで確かめる。通信できないときは、印を信じる
  async function checkEntitlement() {
    let token = "";
    try {
      token = localStorage.getItem(NOADS_KEY) || "";
    } catch (_) {
      token = "";
    }
    if (!token) return;
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok === false) {
          try {
            localStorage.removeItem(NOADS_KEY); // にせの印は捨てる
          } catch (_) {
            // 消せなくても動作には影響しない
          }
          return;
        }
      }
    } catch (_) {
      // 通信できなかったとき
    }
    setNoAds();
  }

  // 遊ぶほど重くならないように、通り過ぎた画面を片付ける
  const KEEP_BEHIND = 8; // いまの画面から何画面前まで、中身を残すか
  function tidyBehind(current) {
    let n = current.section.previousElementSibling;
    for (let i = 0; n; i++, n = n.previousElementSibling) {
      const ctl = slots.get(n);
      if (!ctl) continue;
      if (i < KEEP_BEHIND) continue;
      if (n.classList.contains("is-pruned")) break; // これより前は、すでに片付いている
      observer.unobserve(n);
      slots.delete(n);
      n.classList.add("is-pruned");
      n.replaceChildren();
    }
  }

  function setActive(ctl) {
    if (!ctl || state.active === ctl) return;
    const prev = state.active;
    state.active = ctl;
    if (prev) {
      prev.deactivate();
      prev.section.classList.remove("is-current");
    }
    ctl.section.classList.add("is-current");
    ctl.activate();
    tidyBehind(ctl);
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
  document.getElementById("titleCue").append(makeSwipeCue());
  // マウスのある端末（パソコン）には、その操作を案内する
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) document.getElementById("titlePc").hidden = false;
  document.getElementById("btnStart").addEventListener("click", goNext);
  checkEntitlement();
  titleBest.textContent = String(state.best);
  updateHud();
  appendGames(6);
})();
