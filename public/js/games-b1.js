/*
 * ミニゲーム追加分（バッチ1）：どのカップ？・ダッシュ・だるまさん・いろ？もじ？・てんびん
 *                           ひかったマス・あみだくじ・ぐるぐる・船長の命令・おかいもの
 * games.js の後、app.js の前に読みこむ。見た目は css/games-b1.css。
 */
(() => {
  "use strict";

  const rnd = (n) => Math.floor(Math.random() * n); // 0〜n-1
  const ri = (lo, hi) => lo + rnd(hi - lo + 1); // lo〜hi
  const pick = (arr) => arr[rnd(arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const closest = (target, sel) => (target && target.closest ? target.closest(sel) : null);

  GAMES.push(
    // ---------------------------------------------------------------- 1
    {
      id: "shell",
      title: "どのカップ？",
      theme: "yellow",
      timeout: "lose",
      instruction: () => "ボールの入ったカップをタップ！",
      setup(g) {
        const n = g.level >= 4 ? 4 : 3;
        const k = 3 + g.level;
        const d = Math.max(0.22, 0.42 - 0.04 * g.level);
        const field = g.el("div", n === 4 ? "g-field g-shell-field is-four" : "g-field g-shell-field");
        const note = g.el("p", "g-note g-top", "よく見て…");
        g.stage.append(field, note);

        const posOf = (slot) => `${((slot + 0.5) / n) * 100}%`;
        const answer = rnd(n);
        const cups = [];
        const cupAt = []; // 場所 → カップの番号
        for (let i = 0; i < n; i++) {
          const cup = g.el("div", "g-shell-cup");
          cup.dataset.i = String(i);
          cup.style.left = posOf(i);
          cup.style.setProperty("--d", `${d}s`);
          if (i === answer) {
            cup.dataset.ball = "1";
            cup.append(g.el("span", "g-shell-ball"));
          }
          field.append(cup);
          cups.push(cup);
          cupAt.push(i);
        }

        // 最初にボールを見せる
        cups[answer].classList.add("is-up");
        g.after(700, () => cups[answer].classList.remove("is-up"));

        // 入れ替え
        let lastPair = "";
        const step = d + 0.06;
        for (let s = 0; s < k; s++) {
          g.after(900 + s * step * 1000, () => {
            let a = 0;
            let b = 1;
            const far = g.level >= 2 && Math.random() < 0.5;
            for (let t = 0; t < 60; t++) {
              a = rnd(n);
              b = rnd(n);
              if (a === b) continue;
              const adj = Math.abs(a - b) === 1;
              if (g.level < 2 && !adj) continue;
              if (far && adj) continue;
              if (`${Math.min(a, b)}${Math.max(a, b)}` === lastPair) continue;
              break;
            }
            lastPair = `${Math.min(a, b)}${Math.max(a, b)}`;
            const ca = cupAt[a];
            const cb = cupAt[b];
            cups[ca].style.left = posOf(b);
            cups[cb].style.left = posOf(a);
            cupAt[a] = cb;
            cupAt[b] = ca;
            cups[ca].classList.add("is-lift");
            g.after(d * 1000, () => cups[ca].classList.remove("is-lift"));
          });
        }

        let ready = false;
        g.after(900 + (k - 1) * step * 1000 + d * 1000 + 100, () => {
          ready = true;
          field.classList.add("is-ready");
          note.textContent = "どれ？";
        });

        g.onTap(({ target }) => {
          if (!ready) return;
          const cup = closest(target, ".g-shell-cup");
          if (!cup || !field.contains(cup)) return;
          ready = false;
          cup.classList.add("is-up");
          if (cup === cups[answer]) {
            note.textContent = "あたり！";
            g.win();
          } else {
            cups[answer].classList.add("is-up");
            cup.classList.add("is-wrong");
            note.textContent = "はずれ…";
            g.lose(`正解は左から${cupAt.indexOf(answer) + 1}番め！`);
          }
        });
      },
    },

    // ---------------------------------------------------------------- 2
    {
      id: "run",
      title: "ダッシュ",
      theme: "mint",
      timeout: "lose",
      instruction: (lv) => `左右交互に${12 + 2 * lv}回タップ！`,
      setup(g) {
        const goal = 12 + 2 * g.level;
        let count = 0;
        let last = null;
        const counter = g.el("p", "g-note g-top", `のこり ${goal}`);
        const track = g.el("div", "g-run-track");
        const flag = g.el("span", "g-run-flag", "GOAL");
        const runner = g.el("span", "g-run-runner", "走");
        track.append(flag, runner);
        const pads = g.el("div", "g-run-pads");
        const mk = (side, label) => {
          const p = g.el("div", "g-run-pad is-next", label);
          p.dataset.side = side;
          return p;
        };
        const padL = mk("left", "ひだり");
        const padR = mk("right", "みぎ");
        pads.append(padL, padR);
        g.stage.append(counter, track, pads);

        const retrigger = (node, cls) => {
          node.classList.remove(cls);
          void node.offsetWidth;
          node.classList.add(cls);
        };
        const draw = () => {
          runner.style.left = `calc((100% - 34px) * ${Math.min(1, count / goal)})`;
          counter.textContent = `のこり ${Math.max(0, goal - count)}`;
        };
        draw();

        g.onTap(({ x, w }) => {
          const side = x < w / 2 ? "left" : "right";
          const pad = side === "left" ? padL : padR;
          if (side === last) {
            retrigger(pad, "is-shake");
            return;
          }
          last = side;
          count++;
          retrigger(pad, "is-hit");
          padL.classList.toggle("is-next", side === "right");
          padR.classList.toggle("is-next", side === "left");
          draw();
          if (count >= goal) g.win();
        });
      },
    },

    // ---------------------------------------------------------------- 3
    {
      id: "daruma",
      title: "だるまさん",
      theme: "sky",
      timeout: "lose",
      instruction: () => "長押しで進め！ふりむいたら離せ",
      setup(g) {
        const TEXT = "だるまさんがころんだ";
        const LOOK = 0.7;
        const holdNeeded = 1.8 + 0.08 * g.level;
        const grace = Math.max(0.12, 0.3 - 0.03 * g.level);
        const lo = 1.0 - 0.06 * g.level;
        const hi = 1.5 - 0.02 * g.level;
        const rr = (a, b) => a + Math.random() * (b - a);

        // 後ろ向きの長さを先に決めておく（5秒以内に必ずゴールできる並びにする）
        let backs = [];
        for (let tries = 0; tries < 200; tries++) {
          backs = [];
          let sum = 0;
          let t = 0;
          while (sum < holdNeeded + 0.4 && backs.length < 8) {
            const b = rr(lo, hi);
            backs.push(b);
            sum += b;
            t += b + LOOK;
          }
          if (t - LOOK <= 4.3) break;
        }
        const nextBack = () => (backs.length ? backs.shift() : rr(lo, hi));

        const bubble = g.el("div", "g-daruma-bubble");
        const oni = g.el("div", "g-daruma-oni is-back");
        oni.append(g.el("span", "g-daruma-eye"), g.el("span", "g-daruma-eye"), g.el("span", "g-daruma-mouth"));
        const line = g.el("div", "g-daruma-line");
        line.append(g.el("span", "g-daruma-goal", "GOAL"));
        const me = g.el("div", "g-daruma-me", "ぼく");
        const note = g.el("p", "g-note g-daruma-note", "押してるあいだ進む");
        g.stage.append(bubble, oni, line, me, note);

        let progress = 0;
        let pressing = false;
        let phase = "back";
        let pt = 0;
        let shown = 0;
        let stamps = [];
        const startBack = () => {
          const dur = nextBack();
          const weights = Array.from({ length: 10 }, () => (g.level >= 3 ? 0.4 + Math.random() * 1.2 : 1));
          const total = weights.reduce((a, b) => a + b, 0);
          let c = 0;
          stamps = weights.map((w) => {
            c += w;
            return (c / total) * dur;
          });
          stamps[9] = dur;
          phase = "back";
          pt = 0;
          shown = 0;
          bubble.textContent = "";
          oni.className = "g-daruma-oni is-back";
        };
        startBack();

        const place = () => {
          me.style.top = `${84 - 48 * progress}%`;
        };
        place();
        const caught = (why) => {
          oni.classList.add("is-caught");
          note.textContent = "うごいた！";
          g.lose(why);
        };

        g.onTap(() => {
          if (phase === "look") {
            caught("ふりむいた時に押した！");
            return;
          }
          pressing = true;
          me.classList.add("is-go");
        });
        g.onRelease(() => {
          pressing = false;
          me.classList.remove("is-go");
        });
        g.frame((dt) => {
          pt += dt;
          if (pressing) {
            progress = Math.min(1, progress + dt / holdNeeded);
            place();
          }
          if (phase === "back") {
            while (shown < 10 && pt >= stamps[shown]) {
              shown++;
              bubble.textContent = TEXT.slice(0, shown);
            }
            if (shown >= 10) {
              phase = "look";
              pt = 0;
              oni.className = "g-daruma-oni is-look";
            }
          } else {
            if (pressing && pt > grace) {
              caught("離すのがおそい！");
              return;
            }
            if (pt >= LOOK) startBack();
          }
          if (progress >= 1) {
            note.textContent = "ゴール！";
            g.win();
          }
        });
      },
    },

    // ---------------------------------------------------------------- 4
    {
      id: "stroop",
      title: "いろ？もじ？",
      theme: "orange",
      timeout: "lose",
      instruction: () => "文字の『色』をタップ！",
      setup(g) {
        const COLORS = [
          ["red", "あか"],
          ["sky", "あお"],
          ["yellow", "きいろ"],
          ["mint", "みどり"],
        ];
        const nameOf = Object.fromEntries(COLORS);
        const rounds = 2 + Math.floor(g.level / 2);
        let done = 0;
        const counter = g.el("p", "g-note g-top", `のこり ${rounds}`);
        g.stage.append(counter);
        let q = null;
        let row = null;
        let ink = "";

        const next = () => {
          if (q) q.remove();
          if (row) row.remove();
          const wi = rnd(4);
          let ii;
          if (g.level === 0 && Math.random() < 0.5) ii = wi;
          else do ii = rnd(4);
          while (ii === wi);
          ink = COLORS[ii][0];
          const wordKey = COLORS[wi][0];
          const others = [0, 1, 2, 3].filter((i) => i !== ii && i !== wi);
          let wrongs;
          if (ii !== wi) wrongs = [wi, pick(others)];
          else wrongs = shuffle(others).slice(0, 2);
          const wrongKeys = wrongs.map((i) => COLORS[i][0]);

          q = g.el("p", "g-question g-stroop-word", nameOf[wordKey]);
          q.dataset.ink = ink;
          q.dataset.word = wordKey;
          q.style.color = `var(--${ink})`;
          row = gChoiceRow(g, ink, wrongKeys);
          row.classList.add("g-bottom", "g-stroop-row");
          for (const b of row.children) {
            const key = b.dataset.v;
            b.textContent = nameOf[key];
            if (g.level >= 4) {
              b.classList.add("is-colored");
              b.style.color = `var(--${pick(COLORS.filter((c) => c[0] !== key && c[0] !== ink).map((c) => c[0]))})`;
            }
          }
          g.stage.append(q, row);
        };
        next();

        g.onTap(({ target }) => {
          const b = closest(target, ".g-choice");
          if (!b || !row || !row.contains(b)) return;
          if (b.dataset.v === ink) {
            done++;
            counter.textContent = `のこり ${rounds - done}`;
            if (done >= rounds) {
              b.classList.add("is-right");
              g.win();
            } else next();
          } else {
            b.classList.add("is-wrong");
            const right = [...row.children].find((c) => c.dataset.v === ink);
            if (right) right.classList.add("is-right");
            g.lose(`正解は「${nameOf[ink]}」！`);
          }
        });
      },
    },

    // ---------------------------------------------------------------- 5
    {
      id: "scale",
      title: "てんびん",
      theme: "lime",
      timeout: "lose",
      instruction: () => "重いほうへスワイプ！",
      setup(g) {
        const total = 2 + Math.floor(g.level / 2);
        const sizes = [
          [1, 1],
          [1, 2],
          [2, 2],
          [2, 2],
          [2, 3],
          [2, 3],
        ][g.level];
        let done = 0;
        let lock = false;
        let cur = null;
        const counter = g.el("p", "g-note g-top", `のこり ${total}`);
        const post = g.el("div", "g-scale-post");
        const base = g.el("div", "g-scale-base");
        const beam = g.el("div", "g-scale-beam");
        const mkPan = (side) => {
          const pan = g.el("div", "g-scale-pan");
          pan.dataset.side = side;
          const dish = g.el("div", "g-scale-dish");
          pan.append(dish);
          return { pan, dish };
        };
        const L = mkPan("left");
        const R = mkPan("right");
        beam.append(L.pan, R.pan);
        const lanes = g.el("div", "g-lanes");
        lanes.append(g.el("span", "g-lane", "← 左"), g.el("span", "g-lane", "右 →"));
        g.stage.append(counter, post, base, beam, lanes);

        const gen = () => {
          for (let tries = 0; tries < 300; tries++) {
            let [a, b] = sizes;
            if (Math.random() < 0.5) [a, b] = [b, a];
            const l = Array.from({ length: a }, () => ri(1, 9));
            const r = Array.from({ length: b }, () => ri(1, 9));
            const diff = Math.abs(l.reduce((s, v) => s + v, 0) - r.reduce((s, v) => s + v, 0));
            if (diff < 1) continue;
            if (g.level >= 4 && diff > 3) continue;
            return { l, r };
          }
          return { l: [3], r: [5] };
        };
        const fill = (dish, arr) => {
          dish.replaceChildren();
          for (const w of arr) {
            const node = g.el("span", `g-scale-weight w-${w % 5}`, String(w));
            node.dataset.w = String(w);
            dish.append(node);
          }
        };
        const next = () => {
          const q = gen();
          const sl = q.l.reduce((s, v) => s + v, 0);
          const sr = q.r.reduce((s, v) => s + v, 0);
          cur = { heavy: sl > sr ? "left" : "right", big: Math.max(sl, sr), small: Math.min(sl, sr) };
          fill(L.dish, q.l);
          fill(R.dish, q.r);
          beam.style.setProperty("--a", "0deg");
          beam.dataset.q = String(done);
        };
        next();
        const tilt = (heavy) => beam.style.setProperty("--a", heavy === "right" ? "8deg" : "-8deg");

        g.onSwipe(
          (dir) => {
            if (lock || !cur) return;
            if (dir !== cur.heavy) {
              tilt(cur.heavy);
              g.lose(`${cur.heavy === "left" ? "左" : "右"}が重い！${cur.big}対${cur.small}`);
              return;
            }
            tilt(cur.heavy);
            done++;
            counter.textContent = `のこり ${total - done}`;
            if (done >= total) {
              g.win();
              return;
            }
            lock = true;
            g.after(320, () => {
              lock = false;
              next();
            });
          },
          { tapSides: true }
        );
      },
    },

    // ---------------------------------------------------------------- 6
    {
      id: "flash",
      title: "ひかったマス",
      theme: "pink",
      timeout: "lose",
      instruction: () => "光ったマスを全部タップ！",
      setup(g) {
        const n = g.level >= 3 ? 4 : 3;
        const k = 3 + Math.floor(g.level / 2);
        const showFor = 1.2 - 0.08 * g.level;
        const lit = new Set(shuffle([...Array(n * n).keys()]).slice(0, k));
        const note = g.el("p", "g-note g-top", "おぼえて…");
        const grid = g.el("div", "g-grid g-flash-grid");
        grid.style.setProperty("--n", String(n));
        const tiles = [];
        for (let i = 0; i < n * n; i++) {
          const t = g.el("div", "g-tile g-flash-tile");
          t.dataset.i = String(i);
          if (lit.has(i)) {
            t.dataset.lit = "1";
            t.classList.add("is-lit");
          }
          grid.append(t);
          tiles.push(t);
        }
        g.stage.append(note, grid);

        let input = false;
        let found = 0;
        g.after(showFor * 1000, () => {
          for (const t of tiles) t.classList.remove("is-lit");
          input = true;
          grid.classList.add("is-ready");
          note.textContent = "タップ！";
        });
        g.onTap(({ target }) => {
          if (!input) return;
          const t = closest(target, ".g-flash-tile");
          if (!t || !grid.contains(t) || t.classList.contains("is-right")) return;
          if (t.dataset.lit === "1") {
            t.classList.add("is-right");
            found++;
            if (found >= k) {
              input = false;
              g.win();
            }
          } else {
            input = false;
            t.classList.add("is-wrong");
            for (const o of tiles) if (o.dataset.lit === "1" && !o.classList.contains("is-right")) o.classList.add("is-reveal");
            note.textContent = "ざんねん…";
            g.lose("光ってないマス！");
          }
        });
      },
    },

    // ---------------------------------------------------------------- 7
    {
      id: "amida",
      title: "あみだくじ",
      theme: "yellow",
      timeout: "lose",
      instruction: () => "★につながるのはどれ？",
      setup(g) {
        const N = g.level < 2 ? 3 : g.level < 4 ? 4 : 5;
        const RUNGS = 3 + g.level;
        const H = 280;
        const wrap = g.el("div", "g-amida");
        const svg = gSvg("svg", { class: "g-amida-svg" });
        wrap.append(svg);
        g.stage.append(wrap);
        const W = wrap.clientWidth || 300;
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        const xOf = (i) => ((i + 0.5) * W) / N;

        const ys = [];
        for (let tries = 0; ys.length < RUNGS && tries < 500; tries++) {
          const y = ri(30, H - 30);
          if (ys.every((v) => Math.abs(v - y) >= 22)) ys.push(y);
        }
        const rungs = ys.map((y) => ({ a: rnd(N - 1), y })).sort((p, q) => p.y - q.y);
        const star = rnd(N);

        for (let i = 0; i < N; i++) svg.append(gSvg("line", { class: "g-amida-v", x1: xOf(i), y1: 0, x2: xOf(i), y2: H }));
        for (const r of rungs) {
          svg.append(gSvg("line", { class: "g-amida-h", x1: xOf(r.a), y1: r.y, x2: xOf(r.a + 1), y2: r.y, "data-a": r.a, "data-y": r.y }));
        }
        const starts = [];
        const goals = [];
        for (let i = 0; i < N; i++) {
          const s = g.el("div", "g-amida-start", String(i + 1));
          s.dataset.i = String(i);
          s.style.left = `${xOf(i)}px`;
          const goal = g.el("div", i === star ? "g-amida-goal is-star" : "g-amida-goal", i === star ? "★" : "○");
          goal.dataset.i = String(i);
          goal.style.left = `${xOf(i)}px`;
          wrap.append(s, goal);
          starts.push(s);
          goals.push(goal);
        }

        // 道すじをたどる（判定とアニメーションで共通）
        const trace = (start) => {
          let col = start;
          const pts = [[xOf(col), 0]];
          for (const r of rungs) {
            if (r.a === col) {
              pts.push([xOf(col), r.y], [xOf(col + 1), r.y]);
              col++;
            } else if (r.a === col - 1) {
              pts.push([xOf(col), r.y], [xOf(col - 1), r.y]);
              col--;
            }
          }
          pts.push([xOf(col), H]);
          return { pts, end: col };
        };

        let used = false;
        g.onTap(({ target }) => {
          const s = closest(target, ".g-amida-start");
          if (!s || used || !wrap.contains(s)) return;
          used = true;
          s.classList.add("is-picked");
          const { pts, end } = trace(Number(s.dataset.i));
          const path = gSvg("polyline", { class: "g-amida-path", fill: "none", points: pts.map((p) => `${p[0].toFixed(1)},${p[1]}`).join(" ") });
          svg.append(path);
          const len = path.getTotalLength ? path.getTotalLength() : 1000;
          path.style.strokeDasharray = String(len);
          path.style.strokeDashoffset = String(len);
          void path.getBoundingClientRect();
          path.style.transition = "stroke-dashoffset 0.6s linear";
          path.style.strokeDashoffset = "0";
          g.after(620, () => {
            goals[end].classList.add(end === star ? "is-right" : "is-wrong");
            goals[star].classList.add("is-right");
            if (end === star) g.win();
            else {
              const ok = [...Array(N).keys()].find((i) => trace(i).end === star);
              g.lose(`正解は${ok + 1}番！`);
            }
          });
        });
      },
    },

    // ---------------------------------------------------------------- 8
    {
      id: "crank",
      title: "ぐるぐる",
      theme: "mint",
      timeout: "lose",
      prepare: (lv) => ({ n: 3 + Math.floor(lv * 0.6) }),
      instruction: (lv, c) => (lv < 2 ? `ぐるぐる${c.n}回まわせ！` : `右回りに${c.n}回まわせ！`),
      setup(g) {
        const n = g.config.n;
        const cw = g.level >= 2;
        const dial = g.el("div", "g-crank-dial");
        for (let i = 0; i < 4; i++) dial.append(g.el("span", `g-crank-mark m${i}`, "↻"));
        const count = g.el("p", "g-crank-count", `のこり ${n}`);
        const handle = g.el("span", "g-crank-handle");
        dial.append(count, handle);
        g.stage.append(dial);

        const R = dial.clientWidth / 2;
        const rh = R - 28;
        const setHandle = (a) => {
          handle.style.left = `${R + rh * Math.cos(a)}px`;
          handle.style.top = `${R + rh * Math.sin(a)}px`;
        };
        setHandle(-Math.PI / 2);

        const sr = g.stage.getBoundingClientRect();
        const dr = dial.getBoundingClientRect();
        const cx = dr.left - sr.left + dr.width / 2;
        const cy = dr.top - sr.top + dr.height / 2;
        const angleOf = (p) => (Math.hypot(p.x - cx, p.y - cy) < 25 ? null : Math.atan2(p.y - cy, p.x - cx));

        let prev = null;
        let sum = 0;
        g.onTap((p) => {
          prev = angleOf(p);
          if (prev !== null) setHandle(prev);
        });
        g.onDrag((p) => {
          const a = angleOf(p);
          if (a === null) return;
          setHandle(a);
          if (prev !== null) {
            let d = a - prev;
            while (d > Math.PI) d -= 2 * Math.PI;
            while (d < -Math.PI) d += 2 * Math.PI;
            sum += d;
          }
          prev = a;
          const turns = (cw ? sum : Math.abs(sum)) / (2 * Math.PI);
          count.textContent = `のこり ${Math.max(1, Math.ceil(n - turns - 1e-9))}`;
          if (turns >= n) {
            count.textContent = "OK!";
            g.win();
          }
        });
      },
    },

    // ---------------------------------------------------------------- 9
    {
      id: "captain",
      title: "船長の命令",
      theme: "sky",
      timeout: "win",
      instruction: () => "『船長の命令』の時だけ従え！",
      setup(g) {
        const DIRS = { up: "上", down: "下", left: "左", right: "右" };
        const m = Math.min(5, 3 + Math.floor(g.level / 2));
        const interval = 4.4 / m;
        const T0 = 0.3;
        const real = Math.max(1, Math.min(m - 1, Math.floor(m / 2)));
        const kinds = shuffle([...Array(m).keys()].map((i) => i < real));
        const FAKE_PREFIX = ["船員の命令：", "船長の命れい：", "船長の指令："];
        const orders = kinds.map((isReal, i) => {
          const dir = pick(Object.keys(DIRS));
          let text;
          if (isReal) text = `船長の命令：${DIRS[dir]}！`;
          else if (g.level >= 4 && Math.random() < 0.6) text = `${pick(FAKE_PREFIX)}${DIRS[dir]}！`;
          else text = `${DIRS[dir]}！`;
          return { real: isReal, dir, text, id: i + 1, answered: false };
        });

        const cap = g.el("div", "g-captain");
        cap.append(g.el("span", "g-captain-hat"), g.el("span", "g-captain-face", "⚓"));
        const bubble = g.el("div", "g-captain-order", "…");
        bubble.dataset.id = "0";
        bubble.dataset.real = "";
        const hints = g.el("div", "g-captain-hints");
        for (const [k, v] of [["↑", "上"], ["↓", "下"], ["←", "左"], ["→", "右"]]) hints.append(g.el("span", "g-captain-hint", `${k}${v}`));
        g.stage.append(cap, bubble, hints);

        let cur = null;
        const fail = (msg, why) => {
          bubble.textContent = msg;
          bubble.classList.add("is-wrong");
          g.lose(why);
        };
        const checkDeadline = () => {
          if (cur && cur.real && !cur.answered) fail("おそい！", "命令におくれた！");
        };
        orders.forEach((o, i) => {
          g.after((T0 + i * interval) * 1000, () => {
            checkDeadline();
            cur = o;
            bubble.textContent = o.text;
            bubble.dataset.id = String(o.id);
            bubble.dataset.real = o.real ? "1" : "0";
            bubble.dataset.dir = o.dir;
            bubble.classList.remove("is-done");
            bubble.classList.remove("pop");
            void bubble.offsetWidth;
            bubble.classList.add("pop");
          });
        });
        g.after(4850, checkDeadline);

        g.onFlick((dir) => {
          if (!cur) return fail("まだ命令はないよ！", "命令の前に動いた！");
          if (!cur.real) return fail("命令じゃないよ！", "船長の命令じゃない！");
          if (cur.answered) return fail("命令じゃないよ！", "もう答えたよ！");
          if (dir !== cur.dir) return fail("向きがちがう！", `正解は「${DIRS[cur.dir]}」！`);
          cur.answered = true;
          bubble.classList.add("is-done");
        });
      },
    },

    // ---------------------------------------------------------------- 10
    {
      id: "coin",
      title: "おかいもの",
      theme: "pink",
      timeout: "lose",
      prepare: (lv) => {
        const [lo, hi] = [[11, 19], [15, 29], [21, 74], [21, 74], [51, 99], [51, 99]][lv];
        return { p: ri(lo, hi) };
      },
      instruction: (lv, c) => `${c.p}円ちょうど払え！`,
      setup(g) {
        const p = g.config.p;
        const values = g.level < 2 ? [10, 5, 1] : [50, 10, 5, 1];
        const color = { 50: "yellow", 10: "orange", 5: "lime", 1: "paper" };
        let sum = 0;
        const price = g.el("div", "g-coin-price", `${p}円`);
        const now = g.el("p", "g-coin-now", "いま 0円");
        const row = g.el("div", "g-coin-row");
        for (const v of values) {
          const b = g.el("div", `g-coin-btn coin-${color[v]}`, String(v));
          b.dataset.v = String(v);
          row.append(b);
        }
        g.stage.append(price, now, row);
        g.onTap(({ target }) => {
          const b = closest(target, ".g-coin-btn");
          if (!b || !row.contains(b)) return;
          sum += Number(b.dataset.v);
          now.textContent = `いま ${sum}円`;
          b.classList.remove("is-hit");
          void b.offsetWidth;
          b.classList.add("is-hit");
          if (sum === p) {
            now.classList.add("is-ok");
            g.win();
          } else if (sum > p) {
            now.textContent = "はらいすぎ！";
            now.classList.add("is-over");
            g.lose(`${sum}円で多すぎ！`);
          }
        });
      },
    }
  );
})();
