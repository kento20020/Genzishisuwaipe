(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const screens = {
    title: $("screen-title"),
    game: $("screen-game"),
    result: $("screen-result"),
  };
  const stack = $("stack");
  const bubble = $("bubble");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FLY_MS = reduceMotion ? 0 : 320;

  let deck = [];
  let index = 0;
  let escaped = [];
  let faced = [];
  let busy = false;

  // ---------- 小物 ----------
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function reiwaDate(d = new Date()) {
    return `令和${d.getFullYear() - 2018}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function show(name) {
    for (const [key, screen] of Object.entries(screens)) screen.hidden = key !== name;
    window.scrollTo(0, 0);
  }

  function setFog(ratio) {
    document.documentElement.style.setProperty("--fog", String(ratio));
  }

  let toastTimer = 0;
  function toast(message) {
    const node = $("toast");
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 2200);
  }

  function say(text, mood) {
    bubble.textContent = text;
    bubble.classList.remove("pop", "mood-escape", "mood-face");
    if (mood) bubble.classList.add(`mood-${mood}`);
    void bubble.offsetWidth; // アニメーションを毎回やり直すため
    bubble.classList.add("pop");
  }

  // ---------- 封筒カード ----------
  function createCard(item, depth, number) {
    const card = el("article", "card");
    card.dataset.depth = String(depth);
    card.setAttribute("aria-label", `${item.from}から：${item.subject}`);

    const top = el("div", "card-top");
    const zip = el("div", "zip");
    zip.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 7; i++) {
      if (i === 3) zip.append(el("span", "zip-dash"));
      zip.append(el("i"));
    }
    const postage = el("div", "postage");
    postage.append("料金後納", document.createElement("br"), "郵便");
    top.append(zip, postage);

    const win = el("div", "window");
    win.append(
      el("p", "window-label", "件名"),
      el("h2", "subject", item.subject),
      el("p", "window-body", item.body),
      el("p", "serial", `整理番号 第${String(number).padStart(4, "0")}号`)
    );

    const from = el("p", "from");
    from.append(el("small", null, "差出人"), item.from);

    const stamp = el("span", "card-stamp", item.stamp);
    if (STRONG_STAMPS.includes(item.stamp)) stamp.classList.add("is-strong");
    stamp.style.setProperty("--r", `${randomInt(-10, 6)}deg`);

    const vEscape = el("span", "verdict verdict-escape", "スワイプ");
    const vFace = el("span", "verdict verdict-face", "向き合う");
    vEscape.setAttribute("aria-hidden", "true");
    vFace.setAttribute("aria-hidden", "true");

    card.append(top, win, from, stamp, vEscape, vFace);
    attachSwipe(card);
    return card;
  }

  const serialFor = (i) => 60 + i; // 整理番号は0060番台から

  function topCard() {
    return stack.querySelector('.card[data-depth="0"]:not(.leaving)');
  }

  function swipeThreshold(card) {
    return Math.min(110, card.offsetWidth * 0.3);
  }

  function attachSwipe(card) {
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let dx = 0;
    let dy = 0;

    card.addEventListener("pointerdown", (e) => {
      if (busy || card.dataset.depth !== "0" || pointerId !== null) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startTime = performance.now();
      dx = 0;
      dy = 0;
      card.setPointerCapture(pointerId);
      card.classList.add("dragging");
    });

    card.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pointerId) return;
      dx = e.clientX - startX;
      dy = e.clientY - startY;
      const t = swipeThreshold(card);
      card.style.transform = `translate(${dx}px, ${dy * 0.25}px) rotate(${dx * 0.05}deg)`;
      card.style.setProperty("--escape", String(clamp(-dx / t, 0, 1)));
      card.style.setProperty("--face", String(clamp(dx / t, 0, 1)));
    });

    const release = (e) => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      card.classList.remove("dragging");
      const elapsed = Math.max(1, performance.now() - startTime);
      const fast = Math.abs(dx) / elapsed > 0.6 && Math.abs(dx) > 40;
      if (Math.abs(dx) > swipeThreshold(card) || fast) {
        decide(dx < 0 ? "escape" : "face", dy);
      } else {
        card.style.transform = "";
        card.style.setProperty("--escape", "0");
        card.style.setProperty("--face", "0");
      }
    };
    card.addEventListener("pointerup", release);
    card.addEventListener("pointercancel", release);
  }

  // ---------- 進行 ----------
  function updateCounter() {
    $("remain").textContent = String(deck.length - index);
  }

  function start() {
    deck = shuffle(CARDS).slice(0, DECK_SIZE);
    index = 0;
    escaped = [];
    faced = [];
    busy = false;
    setFog(0);
    stack.replaceChildren();
    for (let k = 0; k < Math.min(3, deck.length); k++) {
      stack.append(createCard(deck[k], k, serialFor(k)));
    }
    updateCounter();
    show("game");
    say(GURU_LINES.start);
  }

  function decide(dir, dy = 0) {
    const card = topCard();
    if (busy || !card) return;
    busy = true;

    const item = deck[index];
    (dir === "escape" ? escaped : faced).push(item);
    say(pick(GURU_LINES[dir]), dir);
    setFog(escaped.length / deck.length);

    const sign = dir === "escape" ? -1 : 1;
    const distance = window.innerWidth + card.offsetWidth;
    card.classList.remove("dragging");
    card.classList.add("leaving", dir === "escape" ? "is-escape" : "is-face");
    card.style.transform = `translate(${sign * distance}px, ${dy * 0.25}px) rotate(${sign * 24}deg)`;

    index++;
    for (const c of stack.querySelectorAll(".card:not(.leaving)")) {
      c.dataset.depth = String(Number(c.dataset.depth) - 1);
    }
    const next = index + 2;
    if (next < deck.length) {
      const back = createCard(deck[next], 2, serialFor(next));
      back.classList.add("entering");
      stack.append(back);
    }
    updateCounter();

    setTimeout(() => {
      card.remove();
      busy = false;
      if (index >= deck.length) finish();
    }, FLY_MS);
  }

  // ---------- 判定 ----------
  function shareUrl() {
    // window.GENJITSU_SHARE_URL を文字列で指定すると、そのURLをシェアに使う（"" ならURLなし）
    if (typeof window.GENJITSU_SHARE_URL === "string") return window.GENJITSU_SHARE_URL;
    if (!/^https?:$/.test(location.protocol)) return "";
    return location.origin + location.pathname;
  }

  function finish() {
    const total = deck.length;
    const pct = Math.round((escaped.length / total) * 100);
    const rank = RANKS.find((r) => pct >= r.min) || RANKS[RANKS.length - 1];

    $("noticeNo").textContent = `霧現第${randomInt(1000, 9999)}号`;
    $("noticeDate").textContent = reiwaDate();
    $("totalCount").textContent = String(total);
    $("escapedCount").textContent = String(escaped.length);
    $("facedCount").textContent = String(faced.length);
    $("fogPct").textContent = String(pct);
    $("rankTitle").textContent = rank.title;
    $("rankRemark").textContent = rank.remark;

    const list = $("escapedList");
    list.replaceChildren();
    if (escaped.length === 0) {
      list.append(el("li", "is-empty", "ありません（すべて向き合いました）"));
    } else {
      for (const item of escaped) list.append(el("li", null, item.subject));
    }

    const text = SHARE.text(pct, rank.title);
    const url = shareUrl();
    const tag = `#${SHARE.hashtag}`;
    const enc = encodeURIComponent;
    $("shareX").href =
      `https://twitter.com/intent/tweet?text=${enc(text)}&hashtags=${enc(SHARE.hashtag)}` +
      (url ? `&url=${enc(url)}` : "");
    $("shareLine").href = `https://line.me/R/share?text=${enc([text, tag, url].filter(Boolean).join("\n"))}`;
    $("shareCopy").onclick = () => copyText([text, tag, url].filter(Boolean).join("\n"));

    const native = $("shareNative");
    native.hidden = typeof navigator.share !== "function";
    native.onclick = () => {
      navigator.share({ title: "現実をスワイプ", text: `${text}\n${tag}`, url: url || undefined }).catch((err) => {
        if (err && err.name !== "AbortError") toast("この画面では使えません。文章をコピーしてください");
      });
    };

    show("result");

    const fill = $("meterFill");
    fill.style.width = "0";
    const stamp = document.querySelector(".hanko-result");
    stamp.classList.remove("slam");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fill.style.width = `${pct}%`;
        stamp.classList.add("slam");
      });
    });
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
    try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
    area.remove();
    toast(ok ? "コピーしました" : "コピーできませんでした");
  }

  // ---------- 起動 ----------
  $("ticketNo").textContent = String(randomInt(1, 999)).padStart(3, "0");
  $("deckSizeLabel").textContent = String(DECK_SIZE);
  $("btnStart").addEventListener("click", start);
  $("btnRetry").addEventListener("click", start);
  $("btnEscape").addEventListener("click", () => decide("escape"));
  $("btnFace").addEventListener("click", () => decide("face"));

  document.addEventListener("keydown", (e) => {
    if (screens.game.hidden) return;
    if (e.key === "ArrowLeft") decide("escape");
    if (e.key === "ArrowRight") decide("face");
  });
})();
