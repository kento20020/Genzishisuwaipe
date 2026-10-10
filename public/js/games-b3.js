/*
 * ミニゲーム 第3弾（10種類）：なわとび / すべれ！ / かたはめ / めでおえ / つぎはなに
 *                          / リフティング / なんにん？ / はぐるま / かがみ / ふわふわ
 * games.js のあと、app.js の前に読み込む。
 */
(() => {
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const shuffled = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  // field の左上が stage の左上からどれだけずれているか（stage の枠ぶん）
  const fieldOffset = (field, stage) => {
    const f = field.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    return { x: f.left - s.left, y: f.top - s.top };
  };
  const COLORS = ["pink", "sky", "mint", "yellow", "orange", "lilac", "lime"];

  // ---------- すべれ！ の盤面づくり ----------
  const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
  // (r,c) から (dr,dc) へすべった終点。壁か盤の端で止まり、★を通ったらそこで止まる
  function slideEnd(walls, n, goal, r, c, dr, dc) {
    let len = 0;
    for (;;) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= n || nc >= n || walls[nr * n + nc]) break;
      r = nr;
      c = nc;
      len++;
      if (r === goal[0] && c === goal[1]) break;
    }
    return [r, c, len];
  }
  // 最短手数（たどり着けなければ -1）
  function slideDist(walls, n, start, goal) {
    const seen = new Map([[start[0] * n + start[1], 0]]);
    let queue = [start];
    while (queue.length) {
      const next = [];
      for (const [r, c] of queue) {
        const d = seen.get(r * n + c);
        for (const [dr, dc] of Object.values(DIRS)) {
          const [er, ec, len] = slideEnd(walls, n, goal, r, c, dr, dc);
          if (!len || seen.has(er * n + ec)) continue;
          seen.set(er * n + ec, d + 1);
          if (er === goal[0] && ec === goal[1]) return d + 1;
          next.push([er, ec]);
        }
      }
      queue = next;
    }
    return -1;
  }
  function makeSlide(level) {
    const n = level >= 3 ? 6 : 5;
    const wallN = level >= 3 ? 6 + level : 4 + level;
    const want = level === 0 ? 1 : level <= 3 ? 2 : 3;
    let best = null;
    for (let attempt = 0; attempt < 200; attempt++) {
      const walls = new Array(n * n).fill(0);
      for (let placed = 0; placed < wallN; ) {
        const i = ri(0, n * n - 1);
        if (!walls[i]) {
          walls[i] = 1;
          placed++;
        }
      }
      const free = [];
      walls.forEach((w, i) => w || free.push(i));
      const s = pick(free);
      const start = [Math.floor(s / n), s % n];
      const exact = [];
      for (const i of free) {
        if (i === s) continue;
        const goal = [Math.floor(i / n), i % n];
        const d = slideDist(walls, n, start, goal);
        if (d === want) exact.push(goal);
        else if (d > 0 && d < want && (!best || d > best.d)) best = { n, walls, start, goal, d };
      }
      if (exact.length) {
        const goal = pick(exact);
        return { n, walls, start, goal, d: want, limit: level < 2 ? want + 1 : want };
      }
    }
    if (!best) best = { n, walls: new Array(n * n).fill(0), start: [0, 0], goal: [0, n - 1], d: 1 };
    return { ...best, limit: level < 2 ? best.d + 1 : best.d };
  }

  // ---------- つぎはなに の問題づくり ----------
  const SHAPE_COLOR = { circle: "pink", square: "sky", tri: "yellow", star: "orange", diamond: "mint", down: "lilac" };
  const SHAPE_NAMES = Object.keys(SHAPE_COLOR);
  function numberRule(level) {
    const rules = level === 2 ? ["add"] : level === 3 ? ["sub", "mul"] : level === 4 ? ["inc"] : ["sub", "mul", "inc"];
    const rule = pick(rules);
    const big = level >= 5;
    const k = ri(2, 5);
    let seq;
    let step = k;
    if (rule === "add") {
      const a = ri(1, 9);
      seq = [0, 1, 2, 3, 4].map((i) => a + k * i);
    } else if (rule === "sub") {
      const a = 4 * k + (big ? ri(3, 9) : ri(1, 9));
      seq = [0, 1, 2, 3, 4].map((i) => a - k * i);
    } else if (rule === "mul") {
      seq = [big ? ri(3, 9) : ri(1, 4)];
      for (let i = 1; i < 5; i++) seq.push(seq[i - 1] * 2);
      step = seq[3];
    } else {
      seq = [big ? ri(3, 9) : ri(1, 9)];
      for (let i = 1; i < 5; i++) seq.push(seq[i - 1] + i);
      step = 5;
    }
    return { seq, step };
  }

  // ---------- かがみ の模様づくり ----------
  const flipH = (bits, n) => {
    let out = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out += bits[r * n + (n - 1 - c)];
    return out;
  };
  const flipV = (bits, n) => {
    let out = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out += bits[(n - 1 - r) * n + c];
    return out;
  };
  const rot180 = (bits) => [...bits].reverse().join("");
  function makeMirror(level) {
    const n = level >= 3 ? 4 : 3;
    const fill = 3 + Math.floor(level / 2);
    const axis = level >= 4 && Math.random() < 0.5 ? "h" : "v";
    for (let tries = 0; tries < 500; tries++) {
      const on = new Set(shuffled([...Array(n * n).keys()]).slice(0, fill));
      const orig = [...Array(n * n).keys()].map((i) => (on.has(i) ? "1" : "0")).join("");
      const answer = axis === "v" ? flipH(orig, n) : flipV(orig, n);
      if (answer === orig) continue; // 鏡に映しても変わらない模様は使わない
      const other = axis === "v" ? flipV(orig, n) : flipH(orig, n);
      const near = [...answer];
      const t = ri(0, n * n - 1);
      near[t] = near[t] === "1" ? "0" : "1";
      const cands = [orig, other, ...(level >= 3 ? [rot180(orig)] : []), near.join("")];
      const uniq = [...new Set(cands)].filter((b) => b !== answer);
      if (uniq.length < 2) continue;
      return { n, axis, orig, answer, wrongs: shuffled(uniq).slice(0, 2) };
    }
    const orig = n === 3 ? "110100000" : "1101000000000000";
    const answer = axis === "v" ? flipH(orig, n) : flipV(orig, n);
    return { n, axis, orig, answer, wrongs: [orig, rot180(orig)] };
  }
  function miniGrid(g, bits, n, cls) {
    const grid = g.el("div", cls);
    grid.style.setProperty("--n", String(n));
    for (const b of bits) grid.append(g.el("span", b === "1" ? "g-mirror-cell is-on" : "g-mirror-cell"));
    return grid;
  }

  GAMES.push(
    // =====================================================================
    // 1. なわとび
    // =====================================================================
    {
      id: "jumprope",
      title: "なわとび",
      theme: "lilac",
      timeout: "win",
      instruction: () => "なわが来たらタップでジャンプ！",
      setup(g) {
        const field = g.el("div", "g-field g-jumprope");
        const counter = g.el("p", "g-note g-top", "とんだ 0");
        g.stage.append(field, counter);
        const W = field.clientWidth || 320;
        const H = field.clientHeight || 420;
        const groundY = H * 0.8;
        const svg = gSvg("svg", { class: "g-jumprope-svg", viewBox: `0 0 ${W} ${H}` });
        const rope = gSvg("path", { class: "g-jumprope-rope", fill: "none", "stroke-linecap": "round" });
        const ground = g.el("div", "g-jumprope-ground");
        ground.style.top = `${groundY}px`;
        const man = g.el("div", "g-jumprope-man");
        man.append(g.el("span", "g-jumprope-head"), g.el("span", "g-jumprope-body"));
        svg.append(rope);
        field.append(ground, man, svg);

        let period = Math.max(0.6, 1.1 - 0.08 * g.level);
        const jumpFor = () => Math.min(0.42, period * 0.6);
        const HEIGHT = 60;
        let phase = Math.PI; // 一番上から始まる
        let jumps = 0;
        let jumping = false;
        let jt = 0;
        let height = 0;

        const draw = () => {
          const cy = H * (0.45 + 0.45 * Math.cos(phase));
          rope.setAttribute(
            "d",
            `M${(W * 0.1).toFixed(1)} ${(H * 0.55).toFixed(1)} Q${(W * 0.5).toFixed(1)} ${cy.toFixed(1)} ${(W * 0.9).toFixed(1)} ${(H * 0.55).toFixed(1)}`
          );
          rope.classList.toggle("is-back", Math.sin(phase) < 0);
          man.style.top = `${groundY - 60 - height}px`;
          man.classList.toggle("is-air", jumping);
          const omega = TAU / period;
          const nextCross = (Math.floor(phase / TAU) + 1) * TAU - phase;
          field.dataset.until = String(Math.round((nextCross / omega) * 1000));
        };
        draw();

        g.onTap(() => {
          if (jumping) return;
          jumping = true;
          jt = 0;
        });
        g.frame((rawDt) => {
          const dt = Math.min(rawDt, 0.05);
          if (jumping) {
            jt += dt;
            if (jt >= jumpFor()) {
              jumping = false;
              jt = 0;
              height = 0;
            } else {
              const u = jt / jumpFor();
              height = 4 * HEIGHT * u * (1 - u);
            }
          }
          const before = Math.floor(phase / TAU);
          phase += (TAU / period) * dt;
          if (Math.floor(phase / TAU) > before) {
            if (height > 8) {
              jumps++;
              counter.textContent = `とんだ ${jumps}`;
              if (g.level >= 3) period = Math.max(0.6, period * 0.92);
            } else {
              man.classList.add("is-trip");
              phase = TAU * Math.floor(phase / TAU);
              draw();
              g.lose();
              return;
            }
          }
          draw();
        });
      },
    },

    // =====================================================================
    // 2. すべれ！
    // =====================================================================
    {
      id: "slide",
      title: "すべれ！",
      theme: "orange",
      timeout: "lose",
      prepare: (level) => makeSlide(level),
      instruction: (lv, c) => `${c.limit}手以内で★まですべらせろ！`,
      setup(g) {
        const { n, walls, start, goal, limit } = g.config;
        const note = g.el("p", "g-note g-slide-note", `のこり手数 ${limit}`);
        const board = g.el("div", "g-slide-board");
        board.style.setProperty("--n", String(n));
        board.dataset.n = String(n);
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const cell = g.el("div", "g-slide-cell");
            cell.dataset.r = String(r);
            cell.dataset.c = String(c);
            if (walls[r * n + c]) cell.classList.add("is-wall");
            if (r === goal[0] && c === goal[1]) {
              cell.classList.add("is-goal");
              cell.append(g.el("span", "g-star g-slide-star"));
            }
            board.append(cell);
          }
        }
        const ball = g.el("div", "g-slide-ball");
        ball.append(g.el("span", "g-slide-ball-body"));
        const place = (r, c) => {
          ball.style.left = `${(c * 100) / n}%`;
          ball.style.top = `${(r * 100) / n}%`;
        };
        place(start[0], start[1]);
        ball.dataset.r = String(start[0]);
        ball.dataset.c = String(start[1]);
        board.append(ball);
        g.stage.append(note, board);

        let hands = limit;
        let moving = false;
        let pos = [...start];
        g.onFlick((dir) => {
          if (moving) return;
          const [dr, dc] = DIRS[dir];
          const [er, ec, len] = slideEnd(walls, n, goal, pos[0], pos[1], dr, dc);
          if (!len) return;
          hands--;
          note.textContent = `のこり手数 ${hands}`;
          moving = true;
          ball.dataset.moving = "1";
          const t = `${(len * 0.12).toFixed(2)}s linear`;
          ball.style.transition = `left ${t}, top ${t}`;
          place(er, ec);
          g.after(len * 120 + 40, () => {
            moving = false;
            delete ball.dataset.moving;
            pos = [er, ec];
            ball.dataset.r = String(er);
            ball.dataset.c = String(ec);
            if (er === goal[0] && ec === goal[1]) {
              ball.classList.add("is-goal");
              g.win();
            } else if (hands <= 0) {
              ball.classList.add("is-out");
              g.lose();
            }
          });
        });
      },
    },

    // =====================================================================
    // 3. かたはめ
    // =====================================================================
    {
      id: "fit",
      title: "かたはめ",
      theme: "lilac",
      timeout: "lose",
      instruction: () => "形をぴったりの穴にはめろ！",
      setup(g) {
        const field = g.el("div", "g-field g-fit");
        g.stage.append(field);
        const W = field.clientWidth || 320;
        const H = field.clientHeight || 420;
        const n = g.level < 3 ? 3 : 4;
        const sway = g.level >= 4 ? 30 : 0;
        const shapes =
          g.level < 2
            ? shuffled(["circle", "square", "star", "tri"]).slice(0, n)
            : shuffled(["tri", "down", "diamond", "square"]).slice(0, n);
        const size = Math.min(76, Math.floor((W - 2 * sway - 8 - (n - 1) * 4) / n));

        const row = g.el("div", "g-fit-row");
        row.style.top = `${H * 0.25}px`;
        const slots = shapes.map((s) => {
          const slot = g.el("div", "g-fit-slot");
          slot.dataset.shape = s;
          slot.style.width = `${size}px`;
          slot.style.height = `${size}px`;
          slot.append(g.el("span", `g-shape s-${s}`));
          row.append(slot);
          return slot;
        });
        const answerShape = pick(shapes);
        const piece = g.el("div", `g-fit-piece is-home c-${pick(COLORS)}`);
        piece.dataset.shape = answerShape;
        piece.append(g.el("span", `g-shape s-${answerShape}`));
        field.append(row, piece);
        const home = { x: W / 2, y: H * 0.78 };
        const setPiece = (x, y) => {
          piece.style.left = `${x}px`;
          piece.style.top = `${y}px`;
        };
        setPiece(home.x, home.y);

        const slotCenter = (slot) => {
          const f = field.getBoundingClientRect();
          const r = slot.getBoundingClientRect();
          return { x: r.left - f.left + r.width / 2, y: r.top - f.top + r.height / 2 };
        };
        let holding = false;
        let cur = { ...home };
        let over = false;
        const toField = (p) => {
          const o = fieldOffset(field, g.stage);
          return { x: p.x - o.x, y: p.y - o.y };
        };
        g.onTap((p) => {
          if (over) return;
          const q = toField(p);
          if (Math.hypot(q.x - cur.x, q.y - cur.y) > 35 + 10) return;
          holding = true;
          piece.classList.remove("is-home");
          piece.classList.add("is-held");
          cur = { x: q.x, y: q.y - 40 };
          setPiece(cur.x, cur.y);
        });
        g.onDrag((p) => {
          if (!holding || over) return;
          const q = toField(p);
          cur = { x: q.x, y: q.y - 40 };
          setPiece(cur.x, cur.y);
        });
        g.onRelease(() => {
          if (!holding || over) return;
          holding = false;
          piece.classList.remove("is-held");
          let best = null;
          let bestD = Infinity;
          for (const slot of slots) {
            const c = slotCenter(slot);
            const d = Math.hypot(c.x - cur.x, c.y - cur.y);
            if (d < bestD) {
              bestD = d;
              best = slot;
            }
          }
          piece.classList.add("is-home");
          if (!best || bestD > 38) {
            cur = { ...home };
            setPiece(cur.x, cur.y);
            return;
          }
          over = true;
          const c = slotCenter(best);
          setPiece(c.x, c.y);
          if (best.dataset.shape === answerShape) {
            best.classList.add("is-right");
            g.win();
          } else {
            best.classList.add("is-wrong");
            for (const s of slots) if (s.dataset.shape === answerShape) s.classList.add("is-answer");
            g.lose();
          }
        });
        if (sway) {
          g.frame((dt, t) => {
            row.style.transform = `translateX(${(sway * Math.sin((TAU * t) / 1.5)).toFixed(1)}px)`;
          });
        }
      },
    },

    // =====================================================================
    // 4. めでおえ
    // =====================================================================
    {
      id: "mot",
      title: "めでおえ",
      theme: "yellow",
      timeout: "lose",
      instruction: () => "光った○を目で追ってタップ！",
      setup(g) {
        const field = g.el("div", "g-field g-mot");
        const note = g.el("p", "g-note g-top", "この○を見て！");
        g.stage.append(field, note);
        const W = field.clientWidth || 320;
        const H = field.clientHeight || 420;
        const N = 5 + g.level;
        const T = g.level >= 3 ? 2 : 1;
        const speed = 120 + 15 * g.level;
        const moveT = 2.0 + 0.1 * g.level;
        const R = 22;
        const dots = [];
        for (let tries = 0; dots.length < N && tries < 2000; tries++) {
          const x = rnd(R + 2, W - R - 2);
          const y = rnd(R + 40, H - R - 2);
          if (dots.some((d) => Math.hypot(d.x - x, d.y - y) < 2 * R + 6)) continue;
          const a = rnd(0, TAU);
          const el = g.el("div", "g-mot-dot");
          el.dataset.t = dots.length < T ? "1" : "0";
          dots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, el });
        }
        for (const d of shuffled(dots)) field.append(d.el);
        const paint = () => {
          for (const d of dots) d.el.style.transform = `translate(${(d.x - R).toFixed(1)}px, ${(d.y - R).toFixed(1)}px)`;
        };
        dots.forEach((d) => d.el.classList.toggle("is-mark", d.el.dataset.t === "1"));
        paint();

        let phase = "show";
        let found = 0;
        let over = false;
        g.frame((rawDt, t) => {
          const dt = Math.min(rawDt, 0.05);
          if (phase === "show" && t >= 0.8) {
            phase = "move";
            dots.forEach((d) => d.el.classList.remove("is-mark"));
            note.textContent = "どれかな…";
          }
          if (phase === "move") {
            for (const d of dots) {
              d.x += d.vx * dt;
              d.y += d.vy * dt;
              if (d.x < R) {
                d.x = R;
                d.vx = Math.abs(d.vx);
              } else if (d.x > W - R) {
                d.x = W - R;
                d.vx = -Math.abs(d.vx);
              }
              if (d.y < R) {
                d.y = R;
                d.vy = Math.abs(d.vy);
              } else if (d.y > H - R) {
                d.y = H - R;
                d.vy = -Math.abs(d.vy);
              }
            }
            for (let i = 0; i < dots.length; i++) {
              for (let j = i + 1; j < dots.length; j++) {
                const a = dots[i];
                const b = dots[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                if (Math.hypot(dx, dy) < 2 * R && (a.vx - b.vx) * dx + (a.vy - b.vy) * dy < 0) {
                  [a.vx, b.vx] = [b.vx, a.vx];
                  [a.vy, b.vy] = [b.vy, a.vy];
                }
              }
            }
            if (t >= 0.8 + moveT) {
              phase = "stopped";
              // 重なりを押し出す（止まったあとのタップを押しやすくする）
              for (let k = 0; k < 4; k++) {
                for (let i = 0; i < dots.length; i++) {
                  for (let j = i + 1; j < dots.length; j++) {
                    const a = dots[i];
                    const b = dots[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const dist = Math.hypot(dx, dy) || 0.01;
                    if (dist < 2 * R) {
                      const push = (2 * R - dist) / 2;
                      a.x += (dx / dist) * push;
                      a.y += (dy / dist) * push;
                      b.x -= (dx / dist) * push;
                      b.y -= (dy / dist) * push;
                    }
                  }
                }
                for (const d of dots) {
                  d.x = clamp(d.x, R, W - R);
                  d.y = clamp(d.y, R, H - R);
                }
              }
              field.classList.add("is-stopped");
              note.textContent = T > 1 ? `光った○を${T}つタップ！` : "光った○はどれ？";
            }
          }
          if (phase !== "show") paint();
        });
        g.onTap(({ target }) => {
          if (phase !== "stopped" || over) return;
          const dot = target && target.closest && target.closest(".g-mot-dot");
          if (!dot || !field.contains(dot)) return;
          if (dot.classList.contains("is-right")) return;
          if (dot.dataset.t === "1") {
            dot.classList.add("is-right");
            found++;
            if (found >= T) {
              over = true;
              g.win();
            }
          } else {
            over = true;
            dot.classList.add("is-wrong");
            dots.forEach((d) => d.el.dataset.t === "1" && d.el.classList.add("is-mark"));
            g.lose();
          }
        });
      },
    },

    // =====================================================================
    // 5. つぎはなに
    // =====================================================================
    {
      id: "next",
      title: "つぎはなに",
      theme: "sky",
      timeout: "lose",
      instruction: () => "？に入るのはどれ？",
      setup(g) {
        const isShape = g.level <= 1;
        const shapeBox = (name) => g.el("span", `g-shape s-${name} c-${SHAPE_COLOR[name]}`);
        let shown;
        let answer;
        let wrongs;
        if (isShape) {
          const [A, B, C, X] = shuffled(SHAPE_NAMES);
          if (g.level === 0) {
            shown = [A, B, A, B]; // A B A B ?  → A
            answer = A;
            wrongs = [B, X];
          } else {
            shown = [A, B, C, A]; // A B C A ?  → B
            answer = B;
            wrongs = [A, C];
          }
        } else {
          const { seq, step } = numberRule(g.level);
          shown = seq.slice(0, 4);
          answer = seq[4];
          const set = new Set();
          for (const w of shuffled([answer + 1, answer - 1, answer + step, answer - step])) {
            if (w > 0 && w !== answer && set.size < 2) set.add(w);
          }
          for (let i = 2; set.size < 2 && i < 30; i++) if (answer + i > 0) set.add(answer + i);
          wrongs = [...set];
        }
        const seqEl = g.el("div", "g-next-seq");
        shown.forEach((v) => {
          const cell = g.el("div", "g-next-cell");
          if (isShape) cell.append(shapeBox(v));
          else cell.textContent = String(v);
          seqEl.append(cell);
        });
        seqEl.append(g.el("div", "g-next-cell is-q", "?"));
        seqEl.dataset.answer = String(answer);

        const row = gChoiceRow(g, String(answer), wrongs.map(String));
        row.classList.add("g-next-choices");
        if (isShape) {
          for (const c of row.children) {
            c.textContent = "";
            c.append(shapeBox(c.dataset.v));
          }
        }
        g.stage.append(seqEl, row);
        gOnChoice(g, row, String(answer));
      },
    },

    // =====================================================================
    // 6. リフティング
    // =====================================================================
    {
      id: "lift",
      title: "リフティング",
      theme: "orange",
      timeout: "win",
      instruction: () => "ボールをタップして落とすな！",
      setup(g) {
        const field = g.el("div", "g-field g-lift");
        g.stage.append(field);
        const W = field.clientWidth || 320;
        const H = field.clientHeight || 420;
        const D = Math.max(44, 64 - 4 * g.level);
        const gravity = 900 + 80 * g.level;
        const kick = 520 + 30 * g.level;
        const wind = g.level >= 3 ? (Math.random() < 0.5 ? -60 : 60) : 0;
        const floorY = H * 0.95;
        const floor = g.el("div", "g-lift-floor");
        floor.style.top = `${floorY}px`;
        const ball = g.el("div", "g-lift-ball");
        ball.style.width = `${D}px`;
        ball.style.height = `${D}px`;
        field.append(floor, ball);
        if (wind) g.stage.append(g.el("p", "g-note g-top", wind > 0 ? "かぜ →" : "← かぜ"));
        let x = W / 2;
        let y = H * 0.3;
        let vx = 0;
        let vy = 0;
        const show = () => {
          ball.style.transform = `translate(${(x - D / 2).toFixed(1)}px, ${(y - D / 2).toFixed(1)}px) rotate(${(x * 2).toFixed(0)}deg)`;
          ball.dataset.x = x.toFixed(1);
          ball.dataset.y = y.toFixed(1);
          ball.dataset.vy = vy.toFixed(1);
        };
        field.dataset.h = String(H);
        show();
        let over = false;
        g.onTap((p) => {
          if (over) return;
          const o = fieldOffset(field, g.stage);
          const tx = p.x - o.x;
          const ty = p.y - o.y;
          if (Math.hypot(tx - x, ty - y) > D / 2 + 18) return;
          vy = -kick;
          vx = clamp((x - tx) * 6, -220, 220);
          ball.classList.remove("hit");
          void ball.offsetWidth;
          ball.classList.add("hit");
        });
        g.frame((rawDt) => {
          const dt = Math.min(rawDt, 0.05);
          vy += gravity * dt;
          vx += wind * dt;
          x += vx * dt;
          y += vy * dt;
          if (x < D / 2) {
            x = D / 2;
            vx = Math.abs(vx);
          } else if (x > W - D / 2) {
            x = W - D / 2;
            vx = -Math.abs(vx);
          }
          if (y < D / 2) {
            y = D / 2;
            if (vy < 0) vy = 0;
          }
          if (y + D / 2 >= floorY) {
            y = floorY - D / 2;
            over = true;
            show();
            ball.classList.add("is-fall");
            g.lose();
            return;
          }
          show();
        });
      },
    },

    // =====================================================================
    // 7. なんにん？
    // =====================================================================
    {
      id: "bus",
      title: "なんにん？",
      theme: "lime",
      timeout: "lose",
      instruction: () => "バスに今なん人乗ってる？",
      setup(g) {
        const start = ri(1, 3);
        const E = 3 + g.level;
        const dur = Math.max(0.28, 0.5 - 0.04 * g.level);
        const events = [];
        let count = start;
        for (let i = 0; i < E; i++) {
          let type = count >= 2 && Math.random() < 0.45 ? "out" : "in";
          let m = g.level >= 3 && Math.random() < 0.4 ? 2 : 1;
          if (type === "out" && count - m < 1) m = 1;
          if (type === "out" && count - m < 1) type = "in";
          count += type === "in" ? m : -m;
          events.push({ type, m });
        }
        const answer = count;

        const label = g.el("p", "g-bus-start", `はじめ ${start}人`);
        const scene = g.el("div", "g-bus-scene");
        const body = g.el("div", "g-bus-body");
        body.dataset.start = String(start);
        for (const side of ["l", "r"]) {
          const wins = g.el("div", `g-bus-windows is-${side}`);
          wins.append(g.el("span", "g-bus-window"), g.el("span", "g-bus-window"));
          body.append(wins);
        }
        body.append(g.el("div", "g-bus-door"));
        scene.append(body, g.el("span", "g-bus-wheel is-l"), g.el("span", "g-bus-wheel is-r"));
        const row = gChoiceRow(g, answer, gNearWrongs(answer, 2, 2));
        row.classList.add("g-bottom");
        row.hidden = true;
        g.stage.append(label, scene, row);

        let ready = false;
        const personColors = ["pink", "sky", "yellow", "mint", "lilac", "orange"];
        events.forEach((ev, i) => {
          g.after(600 + i * dur * 1000, () => {
            for (let k = 0; k < ev.m; k++) {
              const p = g.el("div", `g-bus-person c-${pick(personColors)}`);
              p.dataset.move = ev.type;
              p.style.setProperty("--dur", `${dur}s`);
              if (k === 1) p.classList.add("is-second");
              p.append(g.el("span", "g-bus-head"), g.el("span", "g-bus-torso"));
              scene.append(p);
            }
          });
        });
        g.after(600, () => {
          label.textContent = "いま なん人…？";
          label.classList.add("is-small");
        });
        g.after(600 + E * dur * 1000 + 60, () => {
          label.textContent = "バスに今なん人？";
          row.hidden = false;
          ready = true;
        });
        gOnChoice(g, row, answer, () => ready);
      },
    },

    // =====================================================================
    // 8. はぐるま
    // =====================================================================
    {
      id: "gear",
      title: "はぐるま",
      theme: "pink",
      timeout: "lose",
      instruction: () => "さいごの歯車はどっち回り？",
      setup(g) {
        const field = g.el("div", "g-field g-gear");
        g.stage.append(field);
        const W = field.clientWidth || 320;
        const H = field.clientHeight || 420;
        const svg = gSvg("svg", { class: "g-gear-svg", viewBox: `0 0 ${W} ${H}` });
        field.append(svg);

        const N = Math.min(8, 3 + g.level);
        const S = 62; // 歯車の中心どうしの間隔（歯がかみ合う）
        // 4×3 の格子の上のジグザグ（階段）。7個以上は蛇行
        const stairs = [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2]];
        const snake = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 1], [1, 1], [0, 1]];
        const cells = (N <= 6 ? stairs : snake).slice(0, N);
        const maxC = Math.max(...cells.map((c) => c[0]));
        const maxR = Math.max(...cells.map((c) => c[1]));
        const x0 = (W - maxC * S) / 2;
        const y0 = Math.max(52, (H - 70 - maxR * S) / 2);
        const centers = cells.map(([c, r]) => [x0 + c * S, y0 + r * S]);

        const d0 = Math.random() < 0.5 ? "cw" : "ccw";
        const opposite = (d) => (d === "cw" ? "ccw" : "cw");
        const answer = (N - 1) % 2 === 0 ? d0 : opposite(d0);

        const makeGear = (cx, cy, cls, chain) => {
          const gear = gSvg("g", { class: `g-gear ${cls}`, transform: `translate(${cx.toFixed(1)} ${cy.toFixed(1)})` });
          gear.dataset.chain = chain;
          const spin = gSvg("g", { class: "g-gear-spin" });
          spin.append(
            gSvg("circle", { class: "g-gear-teeth", r: 29, fill: "none", "stroke-width": 7, "stroke-dasharray": "6 9.2" }),
            gSvg("circle", { class: "g-gear-body", r: 25 }),
            gSvg("circle", { class: "g-gear-hub", r: 5 }),
            gSvg("path", { class: "g-gear-spoke", d: "M0 -13 V-5 M0 13 V5 M-13 0 H-5 M13 0 H5" })
          );
          gear.append(spin);
          svg.append(gear);
          return { gear, spin };
        };

        // かざりの歯車（つながっていない）
        if (g.level >= 3) {
          const decoN = ri(1, 2);
          const decos = [];
          for (let tries = 0; decos.length < decoN && tries < 300; tries++) {
            const x = rnd(36, W - 36);
            const y = rnd(36, H - 90);
            if ([...centers, ...decos].every(([cx, cy]) => Math.hypot(cx - x, cy - y) > 88)) decos.push([x, y]);
          }
          for (const [x, y] of decos) makeGear(x, y, "is-deco", "0");
        }

        const gears = centers.map(([cx, cy], i) => {
          const cls = i === 0 ? "is-first" : i === N - 1 ? "is-last" : i % 2 ? "is-odd" : "is-even";
          const { gear, spin } = makeGear(cx, cy, cls, "1");
          const dir = i % 2 === 0 ? d0 : opposite(d0);
          spin.classList.add(dir === "cw" ? "is-cw" : "is-ccw");
          if (i % 2) spin.style.animationDelay = "-0.125s"; // 歯をずらしてかみ合わせる
          if (i === 0) {
            gear.dataset.dir = d0;
            spin.classList.add("is-run");
          }
          return { gear, spin };
        });
        const arrow = gSvg("text", { class: "g-gear-mark", x: centers[0][0], y: centers[0][1], "text-anchor": "middle", "dominant-baseline": "central" });
        arrow.textContent = d0 === "cw" ? "↻" : "↺";
        const last = centers[N - 1];
        const q = gSvg("text", { class: "g-gear-mark is-q", x: last[0], y: last[1], "text-anchor": "middle", "dominant-baseline": "central" });
        q.textContent = "?";
        svg.append(arrow, q);

        const lanes = g.el("div", "g-lanes g-gear-lanes");
        const l = g.el("span", "g-lane", "← ↺ 左回り");
        const r = g.el("span", "g-lane", "右回り ↻ →");
        lanes.append(l, r);
        g.stage.append(lanes);

        let done = false;
        g.onSwipe(
          (dir) => {
            if (done) return;
            done = true;
            const chosen = dir === "left" ? "ccw" : "cw";
            gears.forEach(({ spin }) => spin.classList.add("is-run"));
            q.textContent = answer === "cw" ? "↻" : "↺";
            const ok = chosen === answer;
            (dir === "left" ? l : r).classList.add(ok ? "is-right" : "is-wrong");
            g.after(450, () => (ok ? g.win() : g.lose()));
          },
          { tapSides: true }
        );
      },
    },

    // =====================================================================
    // 9. かがみ
    // =====================================================================
    {
      id: "mirror",
      title: "かがみ",
      theme: "lilac",
      timeout: "lose",
      instruction: () => "かがみに映すとどれになる？",
      setup(g) {
        const m = makeMirror(g.level);
        const view = g.el("div", `g-mirror-view is-${m.axis}`);
        const pat = miniGrid(g, m.orig, m.n, "g-mirror-pattern");
        pat.dataset.bits = m.orig;
        pat.dataset.n = String(m.n);
        pat.dataset.axis = m.axis;
        view.append(pat, g.el("div", "g-mirror-line"));
        const row = gChoiceRow(g, m.answer, m.wrongs);
        row.classList.add("g-mirror-choices");
        for (const c of row.children) {
          c.textContent = "";
          c.append(miniGrid(g, c.dataset.v, m.n, "g-mirror-mini"));
        }
        g.stage.append(view, row);
        gOnChoice(g, row, m.answer);
      },
    },

    // =====================================================================
    // 10. ふわふわ
    // =====================================================================
    {
      id: "hover",
      title: "ふわふわ",
      theme: "mint",
      timeout: "win",
      instruction: () => "長押しで上昇！わくから出るな",
      setup(g) {
        const field = g.el("div", "g-field g-hover");
        g.stage.append(field);
        const H = field.clientHeight || 420;
        const zh = Math.max(70, 130 - 12 * g.level);
        // 振れ幅は設計どおり（画面の高さの割合）だが、背の高い画面で追いつけなくならないよう上限をつける
        const A = Math.min((0.12 + 0.02 * g.level) * H, 75);
        const omega = 1.2 + 0.15 * g.level;
        const zone = g.el("div", "g-hover-zone");
        zone.style.height = `${zh}px`;
        const floaty = g.el("div", "g-hover-floaty");
        const banner = g.el("p", "g-hover-banner", "スタート");
        field.append(zone, floaty, banner);

        const R = 20;
        let y = H * 0.5;
        let v = 0;
        let zc = y;
        let pressing = false;
        const show = () => {
          zone.style.transform = `translateY(${(zc - zh / 2).toFixed(1)}px)`;
          zone.dataset.y = zc.toFixed(1);
          floaty.style.transform = `translateY(${(y - R).toFixed(1)}px)`;
          floaty.dataset.y = y.toFixed(1);
          floaty.classList.toggle("is-up", pressing);
        };
        show();
        g.onTap(() => {
          pressing = true;
        });
        g.onRelease(() => {
          pressing = false;
        });
        g.frame((rawDt, t) => {
          const dt = Math.min(rawDt, 0.05);
          if (t < 0.8) {
            // 猶予：ふうせんは中央でふわふわ待つ（枠もそこで待つ）
            y = H * 0.5;
            zc = y;
            v = 0;
            show();
            return;
          }
          v = clamp(v + (pressing ? -500 : 500) * dt, -260, 260);
          y += v * dt;
          if (y < R) {
            y = R;
            if (v < 0) v = 0;
          } else if (y > H - R) {
            y = H - R;
            if (v > 0) v = 0;
          }
          if (banner.isConnected) banner.remove();
          const tt = t - 0.8;
          zc = 0.5 * H + A * Math.min(1, tt / 0.7) * Math.sin(omega * tt); // 動きはじめはゆっくり
          if (Math.abs(y - zc) > zh / 2) {
            zone.classList.add("is-out");
            show();
            g.lose();
            return;
          }
          show();
        });
      },
    }
  );
})();
