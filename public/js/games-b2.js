/*
 * ミニゲーム追加分（バッチ2）：なんじ？ / ゴムとばし / まん中だけ / 10をつくれ / ついていけ
 *                          リズム / なくなった / キーパー / まっぷたつ / ピカピカ
 * games.js の後、app.js の前に読み込む。新しいグローバル名は作らない。
 */
(() => {
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffled = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // 子要素 el の、g.stage の外枠を基準にした位置（onTap などの座標と同じ基準）
  const offsetIn = (stage, el) => {
    const s = stage.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
  };

  // gOnChoice（games.js）は g.lose() を理由なしで呼ぶので、理由つきの g もどきを渡す
  const withReason = (g, reason) => ({
    onTap: (f) => g.onTap(f),
    win: () => g.win(),
    lose: () => g.lose(reason),
  });

  GAMES.push(
    // ------------------------------------------------------------------ 1
    {
      id: "clock",
      title: "なんじ？",
      theme: "orange",
      timeout: "lose",
      instruction: () => "なんじ？ 正しいのをタップ！",
      setup(g) {
        const lv = g.level;
        const h = rnd(1, 12);
        let m;
        if (lv < 2) m = 0;
        else if (lv < 4) m = pickOne([0, 30]);
        else m = Math.random() < 0.5 ? pickOne([35, 40, 45, 50, 55]) : rnd(0, 11) * 5;
        const wrapH = (v) => ((((v - 1) % 12) + 12) % 12) + 1;
        const wrapM = (v) => ((v % 60) + 60) % 60;
        const fmt = (hh, mm) => `${hh}:${String(mm).padStart(2, "0")}`;
        const answer = fmt(h, m);

        const wrongs = [];
        const add = (hh, mm) => {
          const v = fmt(wrapH(hh), wrapM(mm));
          if (v !== answer && !wrongs.includes(v)) wrongs.push(v);
        };
        if (lv >= 4) {
          // 短針が次の数字に近いときに時を1つ多く読む（近くないときは1つ少なく読む）誤り
          if (m >= 30) add(h + 1, m);
          else add(h - 1, m);
        }
        const cands = [];
        if (lv < 2) {
          cands.push([h + 1, 0], [h - 1, 0], [h + 2, 0], [h - 2, 0]);
        } else if (lv < 4) {
          cands.push([h + 1, m], [h - 1, m], [h, m === 0 ? 30 : 0], [h + 1, m === 0 ? 30 : 0]);
        } else {
          for (const d of [5, -5, 15, -15, 30]) cands.push([h, m + d]);
          cands.push([h + 1, m], [h - 1, m]);
        }
        for (const [hh, mm] of shuffled(cands)) {
          if (wrongs.length >= 2) break;
          add(hh, mm);
        }
        for (let i = 3; wrongs.length < 2; i++) add(h + i, m);

        const wrap = g.el("div", "g-clock");
        wrap.dataset.h = String(h);
        wrap.dataset.m = String(m);
        const svg = gSvg("svg", { class: "g-clock-svg", viewBox: "0 0 200 200", width: 200, height: 200 });
        svg.append(gSvg("circle", { class: "g-clock-face", cx: 100, cy: 100, r: 96 }));
        for (let i = 0; i < 12; i++) {
          const major = i % 3 === 0;
          const a = (i * 30 * Math.PI) / 180;
          const r1 = major ? 80 : 84;
          svg.append(
            gSvg("line", {
              class: major ? "g-clock-tick is-major" : "g-clock-tick",
              x1: 100 + Math.sin(a) * r1,
              y1: 100 - Math.cos(a) * r1,
              x2: 100 + Math.sin(a) * 91,
              y2: 100 - Math.cos(a) * 91,
            })
          );
        }
        if (lv < 3) {
          [[12, 0], [3, 90], [6, 180], [9, 270]].forEach(([n, deg]) => {
            const a = (deg * Math.PI) / 180;
            const t = gSvg("text", { class: "g-clock-num", x: 100 + Math.sin(a) * 64, y: 100 - Math.cos(a) * 64, "text-anchor": "middle", "dominant-baseline": "central" });
            t.textContent = String(n);
            svg.append(t);
          });
        }
        const hourDeg = h * 30 + m * 0.5;
        const minDeg = m * 6;
        const hand = (cls, len, deg) =>
          gSvg("line", { class: cls, x1: 100, y1: 100 + 10, x2: 100, y2: 100 - len, transform: `rotate(${deg} 100 100)` });
        svg.append(hand("g-clock-hand is-hour", 46, hourDeg), hand("g-clock-hand is-min", 72, minDeg), gSvg("circle", { class: "g-clock-cap", cx: 100, cy: 100, r: 7 }));
        wrap.append(svg);

        const row = gChoiceRow(g, answer, wrongs);
        g.stage.append(wrap, row);
        gOnChoice(withReason(g, `正解は${answer}！`), row, answer);
      },
    },

    // ------------------------------------------------------------------ 2
    {
      id: "sling",
      title: "ゴムとばし",
      theme: "lime",
      timeout: "lose",
      instruction: () => "引っぱって離し、輪に入れろ！",
      setup(g) {
        const lv = g.level;
        const field = g.el("div", "g-field g-sling-field");
        g.stage.append(field);
        const W = field.clientWidth || 320;
        const H = field.clientHeight || 440;
        const ballY0 = H * 0.65;
        const cx = W / 2;
        const PULL_MAX = Math.min(110, H - ballY0 - 26);
        const k = (H * 0.6) / PULL_MAX;
        field.dataset.k = k.toFixed(4);
        const tol = Math.max(14, 30 - 3 * lv);
        const baseY = H * (0.15 + Math.random() * 0.35);
        const sway = lv >= 3;

        const hoop = g.el("div", "g-sling-hoop");
        hoop.style.height = `${2 * tol}px`;
        const setHoop = (y) => {
          hoop.style.top = `${y}px`;
          hoop.dataset.y = y.toFixed(1);
        };
        setHoop(baseY);

        const band = gSvg("svg", { class: "g-sling-band", viewBox: `0 0 ${W} ${H}` });
        const postY = ballY0 - 18;
        const postL = cx - 52;
        const postR = cx + 52;
        const guide = gSvg("line", { class: "g-sling-guide", x1: cx, y1: ballY0, x2: cx, y2: ballY0 });
        const rubberBack = gSvg("polyline", { class: "g-sling-rubber is-back", fill: "none" });
        const rubberFront = gSvg("polyline", { class: "g-sling-rubber", fill: "none" });
        band.append(guide, rubberBack, rubberFront);
        const mkPost = (x) => {
          const p = g.el("div", "g-sling-post");
          p.style.left = `${x}px`;
          p.style.top = `${postY - 12}px`;
          return p;
        };
        const ball = g.el("div", "g-sling-ball");
        ball.style.left = `${cx}px`;
        ball.style.top = `${ballY0}px`;
        const hint = g.el("p", "g-note g-sling-hint", "↓ ひっぱって はなす");
        field.append(hoop, band, mkPost(postL), mkPost(postR), ball, hint);

        const draw = (pull) => {
          const by = ballY0 + pull;
          ball.style.top = `${by}px`;
          const pts = `${postL},${postY} ${cx},${pull > 0 ? by : postY} ${postR},${postY}`;
          rubberBack.setAttribute("points", pts);
          rubberFront.setAttribute("points", pts);
          guide.setAttribute("y1", String(by));
          guide.setAttribute("y2", String(by + 70));
          guide.style.opacity = pull > 0 ? "1" : "0";
        };
        draw(0);

        const o = offsetIn(g.stage, field);
        let grabY = null;
        let pull = 0;
        let launched = false;
        g.onTap((p) => {
          if (launched) return;
          const x = p.x - o.x;
          const y = p.y - o.y;
          if (Math.hypot(x - cx, y - ballY0) <= 60) {
            grabY = y;
            pull = 0;
          }
        });
        g.onDrag((p) => {
          if (grabY === null || launched) return;
          pull = clamp(p.y - o.y - grabY, 0, PULL_MAX);
          draw(pull);
        });
        g.onRelease(() => {
          if (grabY === null || launched) return;
          grabY = null;
          if (pull < 10) {
            pull = 0;
            draw(0);
            return;
          }
          launched = true;
          const apex = ballY0 - pull * k;
          const hy = Number(hoop.dataset.y);
          const ok = Math.abs(apex - hy) <= tol;
          rubberBack.setAttribute("points", `${postL},${postY} ${cx},${postY} ${postR},${postY}`);
          rubberFront.setAttribute("points", `${postL},${postY} ${cx},${postY} ${postR},${postY}`);
          guide.style.opacity = "0";
          ball.classList.add("is-shot");
          ball.style.top = `${apex}px`;
          g.after(460, () => {
            hoop.classList.add(ok ? "is-hit" : "is-miss");
            if (ok) g.win();
            else g.lose(apex < hy ? "強すぎた！" : "もう少し強く！");
          });
        });

        g.frame((dt, elapsed) => {
          if (launched || !sway) return;
          setHoop(baseY + 20 * Math.sin(2 * Math.PI * 0.8 * elapsed));
        });
      },
    },

    // ------------------------------------------------------------------ 3
    {
      id: "flanker",
      title: "まん中だけ",
      theme: "pink",
      timeout: "lose",
      instruction: () => "まん中の矢印の向きへスワイプ！",
      setup(g) {
        const lv = g.level;
        const total = 3 + Math.floor(lv / 2);
        const n = lv >= 3 ? 7 : 5;
        const mid = (n - 1) / 2;
        let left = total;
        const counter = g.el("p", "g-note g-top", `のこり ${left}`);
        const holder = g.el("div", "g-flanker-holder");
        const lanes = g.el("div", "g-lanes");
        lanes.append(g.el("span", "g-lane", "← 左"), g.el("span", "g-lane", "右 →"));
        g.stage.append(counter, holder, lanes);
        const MARK = { left: "←", right: "→" };
        const opp = (d) => (d === "left" ? "right" : "left");
        let row = null;
        let midEl = null;
        let dir = null;

        const makeRow = () => {
          dir = Math.random() < 0.5 ? "left" : "right";
          row = g.el("div", "g-arrows g-flanker-row pop");
          row.style.setProperty("--n", String(n));
          if (lv >= 4) row.classList.add("is-tight");
          row.dataset.dir = dir;
          const surroundOpp = Math.random() < 0.7;
          for (let i = 0; i < n; i++) {
            let d;
            if (i === mid) d = dir;
            else if (lv >= 4) d = Math.random() < 0.5 ? "left" : "right";
            else d = surroundOpp ? opp(dir) : dir;
            const a = g.el("span", "g-arrow", MARK[d]);
            if (i === mid) {
              midEl = a;
              if (lv < 2) a.classList.add("is-mid");
            }
            row.append(a);
          }
          holder.replaceChildren(row);
        };
        makeRow();

        g.onSwipe(
          (d) => {
            if (d !== dir) {
              midEl.classList.add("is-wrong");
              g.lose(`まん中は${dir === "left" ? "左" : "右"}むき！`);
              return;
            }
            left--;
            counter.textContent = `のこり ${left}`;
            if (left <= 0) {
              midEl.classList.add("is-right");
              g.win();
              return;
            }
            makeRow();
          },
          { tapSides: true }
        );
      },
    },

    // ------------------------------------------------------------------ 4
    {
      id: "make10",
      title: "10をつくれ",
      theme: "lilac",
      timeout: "lose",
      prepare(level) {
        let T;
        if (level < 2) T = 10;
        else if (level < 4) T = rnd(12, 15);
        else T = rnd(16, 20);
        return { T };
      },
      instruction: (lv, c) => `たして${c.T}になる2まいをタップ！`,
      setup(g) {
        const T = g.config.T;
        const cols = 3;
        const rows = g.level < 3 ? 2 : 3;
        const count = cols * rows;
        const pairsOf = (nums) => {
          const res = [];
          for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) if (nums[i] + nums[j] === T) res.push([i, j]);
          return res;
        };
        let nums = [];
        for (let tries = 0; tries < 5000; tries++) {
          const a = rnd(1, T - 1);
          const arr = [a, T - a];
          while (arr.length < count) arr.push(rnd(1, T - 1));
          const s = shuffled(arr);
          if (pairsOf(s).length === 1) {
            nums = s;
            break;
          }
        }
        if (!nums.length) {
          // まず起きないが、念のため：Tの半分より小さい数だけで埋めて1組にする
          nums = shuffled([1, T - 1, ...Array.from({ length: count - 2 }, () => 1)]);
          if (pairsOf(nums).length !== 1) nums = shuffled([T - 1, 1, ...Array.from({ length: count - 2 }, () => T - 1)]);
        }
        const answerPair = pairsOf(nums)[0];

        const grid = g.el("div", "g-grid g-make10-grid");
        grid.style.setProperty("--rows", String(rows));
        grid.dataset.target = String(T);
        const cards = nums.map((v, i) => {
          const c = g.el("div", "g-make10-card", String(v));
          c.dataset.n = String(v);
          c.dataset.i = String(i);
          grid.append(c);
          return c;
        });
        g.stage.append(grid);

        let first = null;
        g.onTap(({ target }) => {
          const c = target && target.closest && target.closest(".g-make10-card");
          if (!c || !grid.contains(c)) return;
          if (!first) {
            first = c;
            c.classList.add("is-picked");
            return;
          }
          if (c === first) {
            c.classList.remove("is-picked");
            first = null;
            return;
          }
          c.classList.remove("is-picked");
          first.classList.remove("is-picked");
          const sum = Number(c.dataset.n) + Number(first.dataset.n);
          if (sum === T) {
            c.classList.add("is-right");
            first.classList.add("is-right");
            g.win();
          } else {
            c.classList.add("is-wrong");
            first.classList.add("is-wrong");
            answerPair.forEach((i) => cards[i].classList.add("is-answer"));
            g.lose(`合計は${sum}だった！`);
          }
        });
      },
    },

    // ------------------------------------------------------------------ 5
    {
      id: "follow",
      title: "ついていけ",
      theme: "yellow",
      timeout: "lose",
      instruction: () => "指をはなさず○を追いかけろ！",
      setup(g) {
        const lv = g.level;
        const hold = 2.8 + 0.1 * lv;
        const R = Math.max(30, 48 - 3.5 * lv);
        const a = 1.6 + 0.25 * lv;
        const phi = Math.random() < 0.5 ? 0 : Math.PI;
        const field = g.el("div", "g-field g-follow-field");
        const prog = g.el("div", "g-follow-prog");
        prog.style.width = prog.style.height = `${2 * R + 30}px`;
        const ring = g.el("div", "g-follow-ring");
        ring.style.width = ring.style.height = `${2 * R}px`;
        const hintEl = g.el("p", "g-note g-follow-hint", "ここをおさえて");
        field.append(prog, ring, hintEl);
        g.stage.append(field);
        const W = field.clientWidth || 320;
        const H = field.clientHeight || 440;
        const o = offsetIn(g.stage, field);

        let cx = W / 2;
        let cy = H / 2;
        const place = () => {
          prog.style.left = ring.style.left = `${cx}px`;
          prog.style.top = ring.style.top = `${cy}px`;
          field.dataset.x = cx.toFixed(1);
          field.dataset.y = cy.toFixed(1);
          ring.dataset.x = cx.toFixed(1);
          ring.dataset.y = cy.toFixed(1);
          hintEl.style.left = `${W / 2}px`;
          hintEl.style.top = `${H / 2 - R - 44}px`;
        };
        place();

        let finger = null;
        let startAt = null;
        const upd = (p) => {
          finger = { x: p.x - o.x, y: p.y - o.y };
        };
        g.onTap((p) => {
          upd(p);
          if (startAt === null && Math.hypot(finger.x - cx, finger.y - cy) <= R) {
            startAt = -1; // 次のフレームで時刻を入れる
            ring.classList.add("is-moving");
            hintEl.hidden = true;
          }
        });
        g.onDrag(upd);
        g.onRelease(() => {
          finger = null;
          if (startAt !== null) {
            ring.classList.add("is-out");
            g.lose("指がはなれた！");
          }
        });
        g.frame((dt, elapsed) => {
          if (startAt === null) return;
          if (startAt < 0) startAt = elapsed;
          const t = elapsed - startAt;
          cx = W * (0.5 + 0.32 * Math.sin(a * t));
          cy = H * (0.5 + 0.3 * (Math.sin(1.3 * a * t + phi) - Math.sin(phi)));
          place();
          const p = clamp(t / hold, 0, 1);
          prog.style.setProperty("--deg", `${p * 360}deg`);
          if (!finger || Math.hypot(finger.x - cx, finger.y - cy) > R + 6) {
            ring.classList.add("is-out");
            g.lose("はみ出した！");
            return;
          }
          if (t >= hold) {
            ring.classList.add("is-done");
            g.win();
          }
        });
      },
    },

    // ------------------------------------------------------------------ 6
    {
      id: "beat",
      title: "リズム",
      theme: "mint",
      timeout: "lose",
      instruction: () => "4拍のリズムのまま4回タップ！",
      setup(g) {
        const lv = g.level;
        const I = lv === 0 ? 550 : rnd(450, 600);
        const tol = Math.max(0.07, 0.16 - 0.018 * lv) * 1000;
        const t0 = performance.now() + 400;
        const hideResults = lv >= 3;

        const box = g.el("div", "g-beat");
        box.dataset.t0 = t0.toFixed(2);
        box.dataset.interval = String(I);
        const pulse = g.el("div", "g-beat-pulse");
        const label = g.el("p", "g-note g-beat-label", "みほん");
        const dots = g.el("div", "g-beat-dots");
        const dotEls = [];
        for (let i = 0; i < 8; i++) {
          const d = g.el("span", "g-beat-dot");
          if (i === 4) d.classList.add("is-gap");
          d.append(g.el("i", "g-beat-diff"));
          dots.append(d);
          dotEls.push(d);
        }
        box.append(pulse, dots, label);
        g.stage.append(box);

        const flash = (cls) => {
          pulse.classList.remove("is-on", "is-me");
          void pulse.offsetWidth;
          pulse.classList.add(cls);
        };
        for (let i = 0; i < 4; i++) {
          g.after(t0 + i * I - performance.now(), () => {
            flash("is-on");
            dotEls[i].classList.add("is-lit");
          });
        }
        g.after(t0 + 3 * I + 220 - performance.now(), () => {
          label.textContent = "つづけて！";
        });

        const results = []; // {ok, err}
        const show = (k) => {
          const r = results[k];
          if (!r) return;
          const d = dotEls[4 + k];
          d.classList.add(r.ok ? "is-ok" : "is-ng");
          d.firstChild.textContent = (r.err >= 0 ? "+" : "") + (r.err / 1000).toFixed(2);
        };
        const reveal = () => results.forEach((_, k) => show(k));
        const end = (won, reason) => {
          reveal();
          if (won) g.win();
          else g.lose(reason);
        };
        const record = (ok, err) => {
          results.push({ ok, err });
          if (!hideResults) show(results.length - 1);
        };

        g.onTap(() => {
          const now = performance.now();
          flash("is-me");
          const k = results.length;
          if (now < t0 + 4 * I - tol) {
            label.textContent = "フライング！";
            end(false, "早すぎた！");
            return;
          }
          const err = now - (t0 + (4 + k) * I);
          const ok = Math.abs(err) <= tol;
          record(ok, err);
          if (!ok) {
            label.textContent = err < 0 ? "はやい！" : "おそい！";
            end(false, err < 0 ? "ちょっと早い！" : "ちょっと遅い！");
            return;
          }
          if (results.length >= 4) end(true);
        });
        for (let k = 0; k < 4; k++) {
          g.after(t0 + (4 + k) * I + tol - performance.now(), () => {
            if (results.length > k) return;
            label.textContent = "おそい！";
            end(false, "ちょっと遅い！");
          });
        }
      },
    },

    // ------------------------------------------------------------------ 7
    {
      id: "missing",
      title: "なくなった",
      theme: "sky",
      timeout: "lose",
      instruction: () => "消えたのはどれ？",
      setup(g) {
        const lv = g.level;
        const k = 4 + Math.floor(lv / 2);
        const showFor = 1.6 - 0.1 * lv;
        const SHAPES = ["circle", "tri", "square", "diamond", "star", "down"];
        const COLORS = ["pink", "sky", "mint", "yellow", "orange", "lilac", "lime"];
        const keyOf = (s, c) => `${s}${c}`;
        const info = {}; // key -> {shape,color}
        const mk = (s, c) => {
          const key = keyOf(s, c);
          info[key] = { shape: s, color: c };
          return key;
        };

        // 見せるマーク
        let shown = [];
        if (lv < 2) {
          shown = shuffled(SHAPES)
            .slice(0, k)
            .map((s) => mk(s, pickOne(COLORS)));
        } else {
          const pool = shuffled(SHAPES).slice(0, Math.max(2, k - 2));
          const used = new Set();
          for (let tries = 0; shown.length < k && tries < 500; tries++) {
            const s = pickOne(pool);
            const c = pickOne(COLORS);
            const key = keyOf(s, c);
            if (used.has(key)) continue;
            used.add(key);
            shown.push(mk(s, c));
          }
        }
        const answer = pickOne(shown);

        // まちがいの選択肢：見せていない組み合わせ
        const shownSet = new Set(shown);
        const shownShapes = [...new Set(shown.map((x) => info[x].shape))];
        const wrongs = [];
        const tryWrong = (s, c) => {
          const key = keyOf(s, c);
          if (shownSet.has(key) || wrongs.includes(key) || wrongs.length >= 2) return;
          wrongs.push(mk(s, c));
        };
        for (let tries = 0; wrongs.length < 2 && tries < 400; tries++) {
          if (lv >= 3) tryWrong(pickOne(shownShapes), pickOne(COLORS));
          else tryWrong(pickOne(SHAPES), pickOne(COLORS));
        }
        for (const s of SHAPES) for (const c of COLORS) tryWrong(s, c);

        const makeTile = (key) => {
          const t = g.el("div", `g-pair g-missing-tile c-${info[key].color}`);
          t.append(g.el("span", `g-shape s-${info[key].shape}`));
          t.dataset.key = key;
          return t;
        };
        const board = g.el("div", "g-missing-board");
        board.style.setProperty("--cols", String(k <= 4 ? 2 : 3));
        shown.forEach((key) => board.append(makeTile(key)));
        const note = g.el("p", "g-note", "よく見て…");
        const row = gChoiceRow(g, answer, wrongs);
        row.classList.add("g-bottom", "g-missing-choices");
        row.hidden = true;
        for (const c of row.children) {
          const key = c.dataset.v;
          c.classList.add("g-missing-choice");
          c.replaceChildren(g.el("span", `g-shape s-${info[key].shape} c-${info[key].color}`));
        }
        g.stage.append(note, board, row);

        let answering = false;
        g.after(showFor * 1000, () => {
          const rest = shuffled(shown.filter((x) => x !== answer));
          board.replaceChildren(...rest.map(makeTile));
          board.classList.add("is-shuffled");
          note.textContent = "消えたのはどれ？";
          row.hidden = false;
          answering = true;
        });
        const COLOR_JA = { pink: "ももいろ", sky: "みずいろ", mint: "みどり", yellow: "きいろ", orange: "だいだい", lilac: "むらさき", lime: "きみどり" };
        const SHAPE_JA = { circle: "まる", tri: "さんかく", square: "しかく", diamond: "ひしがた", star: "ほし", down: "ぎゃくさんかく" };
        const full = `消えたのは${COLOR_JA[info[answer].color]}${SHAPE_JA[info[answer].shape]}！`;
        const missReason = full.length <= 14 ? full : `消えたのは${SHAPE_JA[info[answer].shape]}！`;
        gOnChoice(withReason(g, missReason), row, answer, () => answering);
      },
    },

    // ------------------------------------------------------------------ 8
    {
      id: "keeper",
      title: "キーパー",
      theme: "lime",
      timeout: "lose",
      instruction: () => "シュートを止めろ！まん中は動くな",
      setup(g) {
        const lv = g.level;
        const n = lv < 2 ? 2 : 3;
        const F = Math.max(0.38, 0.75 - 0.07 * lv);
        const curve = lv >= 4;
        const X = { left: 0.22, center: 0.5, right: 0.78 };
        const GOAL_Y = 0.23;
        const BALL_Y = 0.78;

        // 目標：中央1/3、同じ向きは3回続けない
        const targets = [];
        for (let i = 0; i < n; i++) {
          let t;
          for (let tries = 0; tries < 50; tries++) {
            t = Math.random() < 1 / 3 ? "center" : pickOne(["left", "right"]);
            if (i >= 2 && targets[i - 1] === t && targets[i - 2] === t) continue;
            break;
          }
          targets.push(t);
        }
        const wob = Array.from({ length: n }, () => 0.3 + Math.random() * 0.3);
        const starts = [];
        let acc = 0.4;
        for (let i = 0; i < n; i++) {
          starts.push(acc);
          acc += wob[i] + F + 0.3;
        }

        const field = g.el("div", "g-field g-keeper-field");
        const goal = g.el("div", "g-keeper-goal");
        const keeper = g.el("div", "g-keeper-man");
        keeper.append(g.el("span", "g-keeper-glove is-l"), g.el("span", "g-keeper-glove is-r"));
        const ball = g.el("div", "g-keeper-ball");
        const spot = g.el("div", "g-keeper-spot");
        const counter = g.el("p", "g-note g-keeper-count", `セーブ 0/${n}`);
        field.append(goal, spot, keeper, ball);
        g.stage.append(field, counter);

        const put = (el, x, y) => {
          el.style.left = `${x * 100}%`;
          el.style.top = `${y * 100}%`;
        };
        let pos = "center";
        let swiped = false;
        const setKeeper = (p) => {
          pos = p;
          keeper.dataset.pos = p;
          put(keeper, X[p], GOAL_Y);
        };
        setKeeper("center");
        put(ball, 0.5, BALL_Y);
        put(spot, 0.5, BALL_Y);

        let cur = -1;
        const landed = [];
        let saves = 0;
        g.onSwipe((dir) => {
          if (cur < 0 || landed[cur] || swiped) return;
          swiped = true;
          setKeeper(dir);
          keeper.classList.add("is-dive");
        });

        g.frame((dt, el) => {
          let i = -1;
          for (let j = n - 1; j >= 0; j--) {
            if (el >= starts[j]) {
              i = j;
              break;
            }
          }
          if (i < 0) return;
          if (i !== cur) {
            cur = i;
            swiped = false;
            keeper.classList.remove("is-dive", "is-save");
            setKeeper("center");
            ball.classList.remove("is-flying");
            ball.style.scale = "1";
            ball.dataset.target = targets[i];
            ball.dataset.i = String(i);
            put(ball, 0.5, BALL_Y);
          }
          if (landed[i]) return;
          const fly = starts[i] + wob[i];
          if (el < fly) {
            put(ball, 0.5 + 0.05 * Math.sin(el * 26), BALL_Y - 0.012 * Math.abs(Math.sin(el * 13)));
            return;
          }
          ball.classList.add("is-flying");
          const u = Math.min(1, (el - fly) / F);
          const tx = X[targets[i]];
          let x;
          let y;
          if (curve && targets[i] !== "center") {
            const cxp = 0.5 - (tx - 0.5) / 3;
            const cyp = 0.55;
            x = (1 - u) * (1 - u) * 0.5 + 2 * (1 - u) * u * cxp + u * u * tx;
            y = (1 - u) * (1 - u) * BALL_Y + 2 * (1 - u) * u * cyp + u * u * GOAL_Y;
          } else {
            x = 0.5 + (tx - 0.5) * u;
            y = BALL_Y + (GOAL_Y - BALL_Y) * u;
          }
          put(ball, x, y);
          ball.style.scale = String(1 - 0.35 * u);
          if (u >= 1) {
            landed[i] = true;
            ball.classList.remove("is-flying");
            if (pos === targets[i]) {
              saves++;
              counter.textContent = `セーブ ${saves}/${n}`;
              keeper.classList.add("is-save");
              if (saves >= n) g.win();
            } else {
              ball.classList.add("is-goal");
              counter.textContent = "ゴール！";
              let why;
              if (targets[i] === "center") why = "まん中は動かない！";
              else if (pos === "center") why = "とびそこねた！";
              else why = "ぎゃくにとんだ！";
              g.lose(why);
            }
          }
        });
      },
    },

    // ------------------------------------------------------------------ 9
    {
      id: "half",
      title: "まっぷたつ",
      theme: "mint",
      timeout: "lose",
      prepare(level) {
        const pool = [{ frac: 1 / 2, label: "" }];
        if (level >= 2) pool.push({ frac: 1 / 3, label: "3分の1" }, { frac: 1 / 4, label: "4分の1" });
        if (level >= 4) pool.push({ frac: 2 / 3, label: "3分の2" });
        return pickOne(pool);
      },
      instruction: (lv, c) => (c.frac === 1 / 2 ? "ようかんを はんぶんに切れ！" : `左から${c.label}で切れ！`),
      setup(g) {
        const lv = g.level;
        const frac = g.config.frac;
        const tol = Math.max(0.025, 0.06 - 0.007 * lv);
        const W = g.stage.clientWidth || 320;
        const yw = W * (0.6 + Math.random() * 0.32);
        const yl = Math.random() * (W - yw);
        const yokan = g.el("div", "g-half-yokan");
        yokan.dataset.frac = frac.toFixed(4);
        yokan.style.width = `${yw}px`;
        yokan.style.left = `${yl}px`;
        if (lv >= 3) {
          const cnt = rnd(3, 5);
          for (let i = 0; i < cnt; i++) {
            const nut = g.el("span", "g-half-nut");
            nut.style.left = `${6 + Math.random() * 84}%`;
            nut.style.top = `${14 + Math.random() * 56}%`;
            nut.style.rotate = `${rnd(-30, 30)}deg`;
            yokan.append(nut);
          }
        }
        const result = g.el("p", "g-half-result");
        result.hidden = true;
        g.stage.append(yokan, result);

        let done = false;
        g.onTap((p) => {
          if (done) return;
          done = true;
          const sr = g.stage.getBoundingClientRect();
          const r = yokan.getBoundingClientRect();
          const px = sr.left + p.x;
          if (px < r.left || px > r.right) {
            yokan.classList.add("is-miss");
            result.textContent = "ようかんの外！";
            result.hidden = false;
            g.lose("ようかんの外！");
            return;
          }
          const rel = (px - r.left) / r.width;
          const a = Math.round(rel * 100);
          yokan.classList.add("is-cut");
          const l = g.el("div", "g-half-piece is-l");
          const rr = g.el("div", "g-half-piece is-r");
          l.style.width = `${rel * 100}%`;
          rr.style.width = `${(1 - rel) * 100}%`;
          yokan.replaceChildren(l, rr);
          result.textContent = `${a}%：${100 - a}%`;
          result.hidden = false;
          if (Math.abs(rel - frac) <= tol) {
            yokan.classList.add("is-ok");
            g.win();
          } else {
            yokan.classList.add("is-ng");
            g.lose(rel < frac ? "もう少し右！" : "もう少し左！");
          }
        });
      },
    },

    // ------------------------------------------------------------------ 10
    {
      id: "polish",
      title: "ピカピカ",
      theme: "yellow",
      timeout: "lose",
      instruction: () => "左右にこすってピカピカに！",
      setup(g) {
        const N = 10 + 2 * g.level;
        let left = N;
        const counter = g.el("p", "g-note g-top", `のこり ${left}`);
        const wrap = g.el("div", "g-polish-wrap");
        const prog = g.el("div", "g-polish-prog");
        const plate = g.el("div", "g-polish-plate");
        plate.append(g.el("span", "g-polish-rim"));
        wrap.append(prog, plate);
        const SPARKS = [[16, 24], [82, 18], [90, 62], [12, 70], [50, 6], [70, 90], [30, 88], [52, 48]];
        const sparks = SPARKS.map(([x, y]) => {
          const s = g.el("span", "g-polish-spark", "✦");
          s.style.left = `${x}%`;
          s.style.top = `${y}%`;
          wrap.append(s);
          return s;
        });
        g.stage.append(counter, wrap);

        const c = offsetIn(g.stage, plate);
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        const reach = c.w / 2 + 20;

        const paint = () => {
          const p = 1 - left / N;
          plate.style.setProperty("--p", p.toFixed(3));
          plate.style.filter = `brightness(${(0.55 + 0.65 * p).toFixed(3)}) saturate(${(0.15 + 0.95 * p).toFixed(3)})`;
          prog.style.setProperty("--deg", `${p * 360}deg`);
          sparks.forEach((s, i) => s.classList.toggle("is-on", p >= (i + 1) / (SPARKS.length + 1)));
          counter.textContent = `のこり ${left}`;
          plate.dataset.left = String(left);
        };
        paint();

        let dir = 0;
        let extreme = null; // いまの向きでいちばん進んだ x
        let anchor = null;
        const reset = () => {
          dir = 0;
          extreme = null;
          anchor = null;
        };
        const scrub = (p) => {
          if (left <= 0) return;
          if (Math.hypot(p.x - cx, p.y - cy) > reach) {
            reset();
            return;
          }
          if (anchor === null) {
            anchor = p.x;
            return;
          }
          if (dir === 0) {
            if (Math.abs(p.x - anchor) >= 30) {
              dir = p.x > anchor ? 1 : -1;
              extreme = p.x;
            }
            return;
          }
          if ((p.x - extreme) * dir > 0) {
            extreme = p.x;
          } else if (Math.abs(p.x - extreme) >= 30) {
            dir = -dir;
            extreme = p.x;
            left--;
            plate.classList.remove("rub");
            void plate.offsetWidth;
            plate.classList.add("rub");
            paint();
            if (left <= 0) g.win();
          }
        };
        g.onTap((p) => {
          reset();
          scrub(p);
        });
        g.onDrag(scrub);
        g.onRelease(reset);
      },
    }
  );
})();
