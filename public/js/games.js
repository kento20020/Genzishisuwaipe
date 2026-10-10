/*
 * ミニゲームの一覧。ゲームを増やすときは、この配列に1つ足すだけでOKです。
 *
 *   id          : 英数字の名前（重複しないように）
 *   title       : 画面上のゲーム名
 *   theme       : 背景の色と模様（pink / yellow / mint / sky / orange / lilac / lime）
 *   timeout     : 5秒たったときの結果。"lose"＝時間切れで失敗、"win"＝耐えきれば成功
 *   prepare     : （なくてもよい）お題を決める前の準備。level を受け取り、設定を返す
 *   instruction : お題の文章。level（0〜5、連続クリアで上がる）と prepare の設定を受け取って返す
 *   setup(g)    : ゲーム本体。g の中身は次のとおり
 *     g.stage           ゲームを描く場所（div）
 *     g.level           むずかしさ（0〜5）
 *     g.config          prepare が返した設定
 *     g.el(tag, class, text)  要素を作る
 *     g.win() / g.lose()      成功・失敗で終了
 *     g.after(ms, fn)         ms後に1回だけ実行
 *     g.frame(fn)             毎フレーム fn(経過秒の差分, 開始からの秒) を実行
 *     g.onTap(fn)             画面に触れた瞬間 fn({x, y, w, h, target})（スペースキーでも反応）
 *     g.onRelease(fn)         指をはなした瞬間 fn({x, y, w, h})（長押しゲーム用）
 *     g.onDrag(fn)            指を動かしているあいだ fn({x, y, w, h})
 *     g.onSwipe(fn, {tapSides})  左右のスワイプで fn("left" | "right")（←→キーでも反応）
 *                                tapSides: true なら、画面の左半分／右半分のタップでも反応
 *     g.onFlick(fn)           上下左右のスワイプで fn("up" | "down" | "left" | "right")（矢印キーでも反応）
 *     g.onKey(fn)             キー操作 fn(key, "down" | "up")
 * ゲームが終わると、タイマーや操作の受付はすべて自動で止まります。
 */

// ---------- ゲームで使う小物 ----------

// 3択などのボタン列。answer が正解、wrongs がまちがいの選択肢
function gChoiceRow(g, answer, wrongs) {
  const options = [answer, ...wrongs];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const row = g.el("div", "g-choices");
  for (const v of options) {
    const b = g.el("div", "g-choice", String(v));
    b.dataset.v = String(v);
    row.append(b);
  }
  return row;
}

// 正解の近くの、まちがいの数を count 個つくる
function gNearWrongs(answer, count, spread) {
  const set = new Set();
  for (let tries = 0; set.size < count && tries < 100; tries++) {
    const d = (1 + Math.floor(Math.random() * spread)) * (Math.random() < 0.5 ? -1 : 1);
    if (answer + d > 0) set.add(answer + d);
  }
  return [...set];
}

// 選択肢をタップしたときの判定。canAnswer() が false のあいだは受け付けない
function gOnChoice(g, row, answer, canAnswer = () => true) {
  g.onTap(({ target }) => {
    const b = target && target.closest && target.closest(".g-choice");
    if (!b || !row.contains(b) || !canAnswer()) return;
    const ok = b.dataset.v === String(answer);
    b.classList.add(ok ? "is-right" : "is-wrong");
    if (ok) {
      g.win();
    } else {
      const right = [...row.children].find((c) => c.dataset.v === String(answer));
      if (right) right.classList.add("is-right");
      g.lose();
    }
  });
}

// SVGの要素を作る
function gSvg(tag, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, String(v));
  return node;
}

const GAMES = [
  {
    id: "mash",
    title: "連打",
    theme: "pink",
    timeout: "lose",
    instruction: (lv) => `${12 + lv * 2}回タップ！`,
    setup(g) {
      const goal = 12 + g.level * 2;
      let count = 0;
      const left = g.el("p", "g-big-num", String(goal));
      const btn = g.el("div", "g-push", "PUSH");
      g.stage.append(left, btn, g.el("p", "g-note", "どこをタップしてもOK"));
      g.onTap(() => {
        count++;
        left.textContent = String(Math.max(0, goal - count));
        btn.classList.remove("hit");
        void btn.offsetWidth;
        btn.classList.add("hit");
        if (count >= goal) g.win();
      });
    },
  },

  {
    id: "stop",
    title: "ピタッと止めろ",
    theme: "yellow",
    timeout: "lose",
    instruction: () => "3.00秒で止めろ！",
    setup(g) {
      const target = 3;
      const tolerance = Math.max(0.06, 0.15 - g.level * 0.02);
      const hideAfter = g.level >= 2 ? 1.2 : Infinity;
      const watch = g.el("p", "g-watch", "0.00");
      const note = g.el(
        "p",
        "g-note",
        g.level >= 2 ? "とちゅうで見えなくなるぞ！" : `±${tolerance.toFixed(2)}秒以内でクリア`
      );
      g.stage.append(watch, note);
      const start = performance.now();
      let stopped = false;
      g.frame((dt, elapsed) => {
        if (!stopped) watch.textContent = elapsed >= hideAfter ? "?.??" : elapsed.toFixed(2);
      });
      g.onTap(() => {
        if (stopped) return;
        stopped = true;
        const t = (performance.now() - start) / 1000;
        watch.textContent = t.toFixed(2);
        note.textContent = `ずれ ${(t - target >= 0 ? "+" : "") + (t - target).toFixed(2)}秒`;
        if (Math.abs(t - target) <= tolerance) g.win();
        else g.lose();
      });
    },
  },

  {
    id: "sort",
    title: "仕分けろ",
    theme: "mint",
    timeout: "lose",
    instruction: () => "●は左へ　■は右へ",
    setup(g) {
      const total = 4 + Math.min(3, g.level);
      let done = 0;
      let current = "left";
      const counter = g.el("p", "g-note g-top", `のこり ${total}`);
      const lanes = g.el("div", "g-lanes");
      const l = g.el("span", "g-lane");
      l.append("← ", g.el("b", "c-pink", "●"));
      const r = g.el("span", "g-lane");
      r.append(g.el("b", "c-sky", "■"), " →");
      lanes.append(l, r);
      const item = g.el("div", "g-item");
      g.stage.append(counter, item, lanes);

      const next = () => {
        current = Math.random() < 0.5 ? "left" : "right";
        item.className = `g-item ${current === "left" ? "is-circle" : "is-square"}`;
        void item.offsetWidth;
        item.classList.add("pop");
      };
      next();

      g.onSwipe(
        (dir) => {
          const ghost = item.cloneNode(true);
          ghost.classList.remove("pop");
          ghost.classList.add(dir === "left" ? "fly-left" : "fly-right");
          g.stage.append(ghost);
          if (dir !== current) {
            item.style.visibility = "hidden";
            g.lose();
            return;
          }
          done++;
          counter.textContent = `のこり ${total - done}`;
          if (done >= total) {
            item.style.visibility = "hidden";
            g.win();
            return;
          }
          next();
        },
        { tapSides: true }
      );
    },
  },

  {
    id: "dodge",
    title: "よけろ",
    theme: "sky",
    timeout: "win",
    instruction: () => "左右スワイプでよけろ！",
    setup(g) {
      const LANES = 3;
      const road = g.el("div", "g-road");
      for (let i = 1; i < LANES; i++) {
        const line = g.el("span", "g-road-line");
        line.style.left = `${(i / LANES) * 100}%`;
        road.append(line);
      }
      const car = g.el("div", "g-car");
      road.append(car);
      g.stage.append(road);

      let lane = 1;
      const laneX = (n) => `${((n + 0.5) / LANES) * 100}%`;
      car.style.left = laneX(lane);
      g.onSwipe(
        (dir) => {
          lane = Math.min(LANES - 1, Math.max(0, lane + (dir === "left" ? -1 : 1)));
          car.style.left = laneX(lane);
        },
        { tapSides: true }
      );

      const rocks = [];
      const spawnEvery = Math.max(0.3, 0.6 - g.level * 0.06); // 秒
      const speed = 0.55 + g.level * 0.08; // 1秒に進む割合（画面の高さ比）
      let untilSpawn = 0.2;
      let lastLane = -1;
      const CAR_Y = 0.84;

      g.frame((dt) => {
        untilSpawn -= dt;
        if (untilSpawn <= 0) {
          untilSpawn += spawnEvery;
          let n = Math.floor(Math.random() * LANES);
          if (n === lastLane) n = (n + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES;
          lastLane = n;
          const el = g.el("div", "g-rock", "!");
          el.style.left = laneX(n);
          road.append(el);
          rocks.push({ el, lane: n, y: -0.08 });
        }
        const h = road.clientHeight || 1;
        for (const rock of rocks) {
          rock.y += speed * dt;
          rock.el.style.top = `${rock.y * 100}%`;
          if (rock.lane === lane && Math.abs(rock.y - CAR_Y) * h < 46) {
            car.classList.add("crash");
            g.lose();
            return;
          }
        }
        while (rocks.length && rocks[0].y > 1.1) rocks.shift().el.remove();
      });
    },
  },

  {
    id: "dont",
    title: "押すな",
    theme: "orange",
    timeout: "win",
    instruction: () => "5秒間、さわるな！",
    setup(g) {
      const btn = g.el("div", "g-push g-push-dont", "押すな");
      const tease = g.el("p", "g-note", "見るだけにしてね");
      g.stage.append(btn, tease);
      const lines = ["がまん、がまん…", "ちょっとだけなら…？", "今だけ押していいよ！", "…ほんとだよ？"];
      lines.forEach((text, i) => {
        g.after(1000 + i * 950, () => {
          tease.textContent = text;
          if (i === 2) btn.textContent = "押して！";
        });
      });
      g.onTap(() => {
        btn.classList.add("pressed");
        tease.textContent = "押しちゃった…";
        g.lose();
      });
    },
  },

  {
    id: "odd",
    title: "色ちがい",
    theme: "lilac",
    timeout: "lose",
    instruction: () => "1つだけ色がちがう！",
    setup(g) {
      const n = g.level >= 3 ? 5 : 4;
      const hue = Math.floor(Math.random() * 360);
      const delta = Math.max(5, 12 - g.level * 1.5);
      const odd = Math.floor(Math.random() * n * n);
      const grid = g.el("div", "g-grid");
      grid.style.setProperty("--n", String(n));
      for (let i = 0; i < n * n; i++) {
        const tile = g.el("div", "g-tile");
        tile.dataset.i = String(i);
        tile.style.background = `hsl(${hue} 75% ${i === odd ? 60 + delta : 60}%)`;
        grid.append(tile);
      }
      g.stage.append(grid);
      g.onTap(({ target }) => {
        const tile = target && target.closest && target.closest(".g-tile");
        if (!tile) return;
        if (Number(tile.dataset.i) === odd) {
          tile.classList.add("is-right");
          g.win();
        } else {
          tile.classList.add("is-wrong");
          grid.children[odd].classList.add("is-right");
          g.lose();
        }
      });
    },
  },

  {
    id: "center",
    title: "ど真ん中",
    theme: "lime",
    timeout: "lose",
    instruction: () => "まん中でタップ！",
    setup(g) {
      const zone = Math.max(0.08, 0.18 - g.level * 0.02); // 当たりの幅
      const speed = 0.9 + g.level * 0.25; // 1秒に何回端まで行くか
      const meter = g.el("div", "g-meter");
      const track = g.el("div", "g-meter-track");
      const hit = g.el("span", "g-meter-zone");
      hit.style.width = `${zone * 100}%`;
      const mark = g.el("span", "g-meter-mark");
      track.append(hit, mark);
      meter.append(track);
      const note = g.el("p", "g-note", "ねらって…");
      g.stage.append(meter, note);
      let pos = 0;
      g.frame((dt, elapsed) => {
        const p = (elapsed * speed) % 2;
        pos = p < 1 ? p : 2 - p;
        mark.style.left = `${pos * 100}%`;
      });
      g.onTap(() => {
        const ok = Math.abs(pos - 0.5) <= zone / 2;
        mark.classList.add(ok ? "is-hit" : "is-miss");
        note.textContent = ok ? "ど真ん中！" : "おしい！";
        if (ok) g.win();
        else g.lose();
      });
    },
  },
  {
    id: "whack",
    title: "もぐらたたき",
    theme: "orange",
    timeout: "lose",
    instruction: (lv) => `モグラを${4 + Math.floor(lv / 2)}匹たたけ！`,
    setup(g) {
      const goal = 4 + Math.floor(g.level / 2);
      const stay = Math.max(0.5, 0.9 - g.level * 0.08); // モグラが出ている秒数
      const every = Math.max(0.32, 0.5 - g.level * 0.04); // 何秒ごとに出るか
      let hits = 0;
      const counter = g.el("p", "g-note g-top", `のこり ${goal}`);
      const field = g.el("div", "g-holes");
      const holes = [];
      for (let i = 0; i < 9; i++) {
        const hole = g.el("div", "g-hole");
        hole.dataset.i = String(i);
        field.append(hole);
        holes.push({ el: hole, mole: null, until: 0 });
      }
      g.stage.append(counter, field);

      let now = 0;
      let untilSpawn = 0.15;
      let last = -1;
      g.frame((dt, elapsed) => {
        now = elapsed;
        untilSpawn -= dt;
        if (untilSpawn <= 0) {
          untilSpawn += every;
          const free = holes.map((h, i) => i).filter((i) => !holes[i].mole && i !== last);
          if (free.length) {
            const i = free[Math.floor(Math.random() * free.length)];
            last = i;
            const mole = g.el("span", "g-mole");
            holes[i].el.append(mole);
            holes[i].mole = mole;
            holes[i].until = now + stay;
          }
        }
        for (const h of holes) {
          if (h.mole && now >= h.until) {
            h.mole.remove();
            h.mole = null;
          }
        }
      });

      g.onTap(({ target }) => {
        const holeEl = target && target.closest && target.closest(".g-hole");
        if (!holeEl) return;
        const h = holes[Number(holeEl.dataset.i)];
        if (!h.mole) return;
        const mole = h.mole;
        h.mole = null;
        mole.classList.add("is-hit");
        g.after(200, () => mole.remove());
        hits++;
        counter.textContent = `のこり ${goal - hits}`;
        if (hits >= goal) g.win();
      });
    },
  },

  {
    id: "balloon",
    title: "ふうせん",
    theme: "sky",
    timeout: "lose",
    instruction: () => "長押しして、線のあいだで離せ！",
    setup(g) {
      const zMin = 0.6;
      const zMax = zMin + Math.max(0.08, 0.17 - g.level * 0.018);
      const burstAt = zMax + 0.1;
      const rate = 0.42 + g.level * 0.06; // 1秒にふくらむ量
      const box = g.el("div", "g-balloon-box");
      const ringMax = g.el("span", "g-ring g-ring-max");
      ringMax.style.setProperty("--s", String(zMax));
      const ringMin = g.el("span", "g-ring g-ring-min");
      ringMin.style.setProperty("--s", String(zMin));
      const balloon = g.el("span", "g-balloon");
      const note = g.el("p", "g-note", "おしているあいだ、ふくらむ");
      box.append(ringMax, ringMin, balloon);
      g.stage.append(box, note);

      let size = 0.15;
      let pressing = false;
      let released = false;
      const draw = () => balloon.style.setProperty("--s", size.toFixed(3));
      draw();

      g.onTap(() => {
        if (!released) pressing = true;
      });
      g.onRelease(() => {
        if (!pressing || released) return;
        pressing = false;
        released = true;
        if (size >= zMin && size <= zMax) {
          note.textContent = "ちょうどいい！";
          g.win();
        } else {
          note.textContent = size < zMin ? "ちいさすぎ！" : "おおきすぎ！";
          g.lose();
        }
      });
      g.frame((dt) => {
        if (!pressing) return;
        size += rate * dt;
        draw();
        if (size >= burstAt) {
          pressing = false;
          released = true;
          balloon.classList.add("is-burst");
          note.textContent = "パーン！";
          g.lose();
        }
      });
    },
  },

  {
    id: "react",
    title: "早押し",
    theme: "lime",
    timeout: "lose",
    instruction: () => "赤になったらタップ！",
    setup(g) {
      const windowSec = Math.max(0.35, 0.65 - g.level * 0.06); // 赤になってから押せる秒数
      const redAt = 1 + Math.random() * (2.6 - windowSec);
      const lamp = g.el("div", "g-lamp", "まだ…");
      const note = g.el("p", "g-note", "フライングはアウト");
      g.stage.append(lamp, note);
      let redTime = null;
      g.after(redAt * 1000, () => {
        redTime = performance.now();
        lamp.classList.add("is-red");
        lamp.textContent = "今だ！";
      });
      g.after((redAt + windowSec) * 1000, () => {
        lamp.textContent = "おそい！";
        g.lose();
      });
      g.onTap(() => {
        if (redTime === null) {
          lamp.classList.add("is-foul");
          lamp.textContent = "フライング";
          g.lose();
          return;
        }
        note.textContent = `${Math.round(performance.now() - redTime)}ミリ秒`;
        g.win();
      });
    },
  },

  {
    id: "janken",
    title: "後出しじゃんけん",
    theme: "yellow",
    timeout: "lose",
    prepare(level) {
      const modes = level >= 2 ? ["win", "lose", "draw"] : ["win", "lose"];
      return { cpu: Math.floor(Math.random() * 3), mode: modes[Math.floor(Math.random() * modes.length)] };
    },
    instruction: (lv, c) => ({ win: "あいてに かて！", lose: "わざと まけろ！", draw: "あいこに しろ！" })[c.mode],
    setup(g) {
      const HANDS = [
        { name: "グー", icon: "✊" },
        { name: "チョキ", icon: "✌️" },
        { name: "パー", icon: "✋" },
      ];
      const { cpu, mode } = g.config;
      const beats = (a, b) => (b - a + 3) % 3 === 1; // a が b に勝つ
      const makeHand = (hand, className) => {
        const node = g.el("div", `g-hand ${className}`);
        node.append(g.el("span", "g-hand-icon", hand.icon), g.el("span", "g-hand-name", hand.name));
        return node;
      };
      const row = g.el("div", "g-hands");
      HANDS.forEach((hand, i) => {
        const pickEl = makeHand(hand, "g-hand-pick");
        pickEl.dataset.i = String(i);
        row.append(pickEl);
      });
      g.stage.append(g.el("p", "g-note", "あいての手"), makeHand(HANDS[cpu], "g-hand-cpu"), row);
      g.onTap(({ target }) => {
        const pickEl = target && target.closest && target.closest(".g-hand-pick");
        if (!pickEl) return;
        const me = Number(pickEl.dataset.i);
        const ok = mode === "win" ? beats(me, cpu) : mode === "lose" ? beats(cpu, me) : me === cpu;
        pickEl.classList.add(ok ? "is-right" : "is-wrong");
        if (ok) g.win();
        else g.lose();
      });
    },
  },

  {
    id: "catch",
    title: "キャッチ",
    theme: "mint",
    timeout: "lose",
    instruction: (lv) => `★を${3 + Math.floor(lv / 2)}こキャッチ！`,
    setup(g) {
      const goal = 3 + Math.floor(g.level / 2);
      const speed = 0.5 + g.level * 0.07; // 1秒に落ちる割合（画面の高さ比）
      const every = Math.max(0.35, 0.55 - g.level * 0.04);
      const BASKET_Y = 0.86;
      let got = 0;
      const counter = g.el("p", "g-note g-top", `のこり ${goal}`);
      const field = g.el("div", "g-field");
      const basket = g.el("div", "g-basket");
      field.append(basket);
      g.stage.append(counter, field);

      let bx = 0.5;
      const place = () => {
        basket.style.left = `${bx * 100}%`;
      };
      place();
      const follow = ({ x, w }) => {
        bx = Math.min(0.9, Math.max(0.1, x / w));
        place();
      };
      g.onTap(follow);
      g.onDrag(follow);
      g.onKey((key, type) => {
        if (type !== "down") return;
        if (key === "ArrowLeft") bx = Math.max(0.1, bx - 0.15);
        else if (key === "ArrowRight") bx = Math.min(0.9, bx + 0.15);
        place();
      });

      const stars = [];
      let untilSpawn = 0.1;
      g.frame((dt) => {
        untilSpawn -= dt;
        if (untilSpawn <= 0) {
          untilSpawn += every;
          // いまのカゴの位置から離れたところに出す（カゴを動かさなくても偶然入る、を防ぐ）
          let sx = 0.1 + Math.random() * 0.8;
          for (let tries = 0; tries < 20 && Math.abs(sx - bx) < 0.22; tries++) sx = 0.1 + Math.random() * 0.8;
          const star = { x: sx, y: -0.05, el: g.el("span", "g-star"), done: false };
          star.el.style.left = `${star.x * 100}%`;
          field.append(star.el);
          stars.push(star);
        }
        const w = field.clientWidth || 1;
        const h = field.clientHeight || 1;
        for (const star of stars) {
          if (star.done) continue;
          star.y += speed * dt;
          star.el.style.top = `${star.y * 100}%`;
          if (Math.abs(star.y - BASKET_Y) * h < 24 && Math.abs(star.x - bx) * w < 50) {
            star.done = true;
            star.el.classList.add("is-got");
            got++;
            counter.textContent = `のこり ${Math.max(0, goal - got)}`;
            if (got >= goal) {
              g.win();
              return;
            }
          } else if (star.y > 1.1) {
            star.done = true;
            star.el.remove();
          }
        }
      });
    },
  },

  {
    id: "memory",
    title: "おぼえて",
    theme: "lilac",
    timeout: "lose",
    instruction: () => "矢印をおぼえて、同じ順にスワイプ！",
    setup(g) {
      const len = Math.min(6, 3 + Math.floor(g.level / 2));
      const seq = Array.from({ length: len }, () => (Math.random() < 0.5 ? "left" : "right"));
      const showFor = 0.9 + len * 0.25; // 矢印を見せる秒数
      const row = g.el("div", "g-arrows");
      const cells = seq.map((dir) => {
        const cell = g.el("span", "g-arrow", dir === "left" ? "←" : "→");
        row.append(cell);
        return cell;
      });
      const note = g.el("p", "g-note", "おぼえて…");
      const lanes = g.el("div", "g-lanes");
      lanes.append(g.el("span", "g-lane", "← 左"), g.el("span", "g-lane", "右 →"));
      g.stage.append(row, note, lanes);

      let input = false;
      let i = 0;
      g.after(showFor * 1000, () => {
        input = true;
        cells.forEach((cell) => {
          cell.textContent = "?";
          cell.classList.add("is-hidden");
        });
        note.textContent = "スワイプ！";
      });
      g.onSwipe(
        (dir) => {
          if (!input) return;
          const ok = dir === seq[i];
          cells[i].textContent = dir === "left" ? "←" : "→";
          cells[i].classList.remove("is-hidden");
          cells[i].classList.add(ok ? "is-right" : "is-wrong");
          if (!ok) {
            g.lose();
            return;
          }
          i++;
          if (i >= len) g.win();
        },
        { tapSides: true }
      );
    },
  },
  {
    id: "flick",
    title: "フリック",
    theme: "sky",
    timeout: "lose",
    instruction: (lv) => `矢印の向きに${3 + Math.floor(lv / 2)}回はじけ！`,
    setup(g) {
      const total = 3 + Math.floor(g.level / 2);
      const ARROWS = { up: "↑", down: "↓", left: "←", right: "→" };
      const dirs = Object.keys(ARROWS);
      let done = 0;
      let current = null;
      const counter = g.el("p", "g-note g-top", `のこり ${total}`);
      const tile = g.el("div", "g-flick");
      g.stage.append(counter, tile);
      const next = () => {
        let d;
        do d = dirs[Math.floor(Math.random() * dirs.length)];
        while (d === current);
        current = d;
        tile.textContent = ARROWS[d];
        tile.classList.remove("pop");
        void tile.offsetWidth;
        tile.classList.add("pop");
      };
      next();
      g.onFlick((dir) => {
        const ghost = tile.cloneNode(true);
        ghost.classList.remove("pop");
        ghost.classList.add(`fly-${dir}`);
        g.stage.append(ghost);
        if (dir !== current) {
          tile.classList.add("is-wrong");
          tile.textContent = ARROWS[current];
          ghost.remove();
          g.lose();
          return;
        }
        done++;
        counter.textContent = `のこり ${total - done}`;
        if (done >= total) {
          tile.style.visibility = "hidden";
          g.win();
          return;
        }
        next();
      });
    },
  },

  {
    id: "count",
    title: "数えろ",
    theme: "yellow",
    timeout: "lose",
    instruction: () => "一瞬だけ出る★を数えろ！",
    setup(g) {
      const min = 4 + g.level;
      const max = 7 + Math.floor(g.level * 1.5);
      const n = min + Math.floor(Math.random() * (max - min + 1));
      const showFor = Math.max(0.8, 1.4 - g.level * 0.1);
      // ★が重ならないように置く（置けた数が答え）
      const w = g.stage.clientWidth || 300;
      const h = g.stage.clientHeight || 400;
      const placed = [];
      for (let tries = 0; placed.length < n && tries < 600; tries++) {
        const x = 0.12 + Math.random() * 0.76;
        const y = 0.14 + Math.random() * 0.58;
        if (placed.every(([px, py]) => Math.hypot((px - x) * w, (py - y) * h) > 44)) placed.push([x, y]);
      }
      const answer = placed.length;

      const field = g.el("div", "g-field");
      for (const [x, y] of placed) {
        const star = g.el("span", "g-star is-small");
        star.style.left = `${x * 100}%`;
        star.style.top = `${y * 100}%`;
        field.append(star);
      }
      const note = g.el("p", "g-note g-top", "よく見て…");
      const row = gChoiceRow(g, answer, gNearWrongs(answer, 2, 2));
      row.classList.add("g-bottom");
      row.hidden = true;
      g.stage.append(field, note, row);

      let shown = false;
      g.after(showFor * 1000, () => {
        field.replaceChildren();
        note.textContent = "★はいくつあった？";
        row.hidden = false;
        shown = true;
      });
      gOnChoice(g, row, answer, () => shown);
    },
  },

  {
    id: "math",
    title: "計算",
    theme: "lime",
    timeout: "lose",
    instruction: () => "答えをタップ！",
    setup(g) {
      const r = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
      let a;
      let b;
      let op;
      let answer;
      if (g.level < 2) {
        a = r(2, 9);
        b = r(2, 9);
        op = "+";
        answer = a + b;
      } else if (g.level < 4) {
        if (Math.random() < 0.5) {
          a = r(8, 19);
          b = r(2, a - 2);
          op = "−";
          answer = a - b;
        } else {
          a = r(11, 39);
          b = r(3, 9);
          op = "+";
          answer = a + b;
        }
      } else if (Math.random() < 0.5) {
        a = r(3, 9);
        b = r(3, 9);
        op = "×";
        answer = a * b;
      } else {
        a = r(21, 69);
        b = r(12, 29);
        op = "+";
        answer = a + b;
      }
      const wrongs = op === "×" ? gNearWrongs(answer, 2, Math.max(a, b)) : gNearWrongs(answer, 2, 3);
      const row = gChoiceRow(g, answer, wrongs);
      g.stage.append(g.el("p", "g-question", `${a} ${op} ${b} = ?`), row);
      gOnChoice(g, row, answer);
    },
  },

  {
    id: "trace",
    title: "なぞれ",
    theme: "mint",
    timeout: "lose",
    instruction: () => "はみ出さずにゴールまでなぞれ！",
    setup(g) {
      const svg = gSvg("svg", { class: "g-trace" });
      const note = g.el("p", "g-note g-top", "Sから指をはなさずに");
      g.stage.append(svg, note);
      const sr = g.stage.getBoundingClientRect();
      const vr = svg.getBoundingClientRect();
      const ox = vr.left - sr.left;
      const oy = vr.top - sr.top;
      const W = vr.width || 300;
      const H = vr.height || 400;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

      const road = Math.max(30, 48 - g.level * 3);
      const turns = 3 + Math.min(2, Math.floor(g.level / 2));
      const m = road + 8;
      const pts = [];
      for (let i = 0; i <= turns; i++) {
        const y = H - m - ((H - 2 * m - 24) * i) / turns;
        const side = i % 2 === 0 ? 0 : 1;
        const x = side === 0 ? m + Math.random() * W * 0.22 : W - m - Math.random() * W * 0.22;
        pts.push([x, y]);
      }
      const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
      const common = { d, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
      svg.append(
        gSvg("path", { ...common, class: "g-trace-edge", "stroke-width": road + 6 }),
        gSvg("path", { ...common, class: "g-trace-road", "stroke-width": road }),
        gSvg("path", { ...common, class: "g-trace-center", "stroke-width": 2 })
      );
      const trail = gSvg("polyline", { class: "g-trace-trail", fill: "none", "stroke-width": road * 0.45, "stroke-linecap": "round", "stroke-linejoin": "round", points: "" });
      svg.append(trail);
      const marker = (p, label, cls) => {
        const grp = gSvg("g", { class: cls });
        grp.append(gSvg("circle", { cx: p[0], cy: p[1], r: road * 0.62 }));
        const t = gSvg("text", { x: p[0], y: p[1], "text-anchor": "middle", "dominant-baseline": "central" });
        t.textContent = label;
        grp.append(t);
        svg.append(grp);
      };
      const start = pts[0];
      const goal = pts[pts.length - 1];
      marker(start, "S", "g-trace-start");
      marker(goal, "G", "g-trace-goal");

      const distToSeg = (x, y, [ax, ay], [bx, by]) => {
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
      };
      const distToPath = (x, y) => {
        let best = Infinity;
        for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSeg(x, y, pts[i - 1], pts[i]));
        return best;
      };

      let tracing = false;
      let over = false;
      let points = [];
      const toLocal = (p) => [p.x - ox, p.y - oy];
      g.onTap((p) => {
        if (over) return;
        const [x, y] = toLocal(p);
        if (Math.hypot(x - start[0], y - start[1]) <= road * 0.8) {
          tracing = true;
          points = [[x, y]];
          note.textContent = "そのまま…";
        }
      });
      g.onDrag((p) => {
        if (!tracing || over) return;
        const [x, y] = toLocal(p);
        points.push([x, y]);
        trail.setAttribute("points", points.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" "));
        if (distToPath(x, y) > road / 2 + 4) {
          over = true;
          trail.classList.add("is-out");
          note.textContent = "はみ出した！";
          g.lose();
        } else if (Math.hypot(x - goal[0], y - goal[1]) <= road * 0.6) {
          over = true;
          note.textContent = "ゴール！";
          g.win();
        }
      });
      g.onRelease(() => {
        if (!tracing || over) return;
        tracing = false;
        points = [];
        trail.setAttribute("points", "");
        note.textContent = "指をはなさないで！Sからもう一度";
      });
    },
  },

  {
    id: "pair",
    title: "ペアさがし",
    theme: "pink",
    timeout: "lose",
    instruction: () => "同じマークを2つタップ！",
    setup(g) {
      const n = g.level >= 3 ? 4 : 3;
      const SHAPES = ["circle", "tri", "square", "diamond", "star", "down"];
      const COLORS = g.level >= 2 ? ["pink", "sky", "mint"] : ["pink", "sky", "mint", "yellow", "orange", "lilac"];
      const combos = [];
      for (const shape of SHAPES) for (const color of COLORS) combos.push({ shape, color });
      for (let i = combos.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [combos[i], combos[j]] = [combos[j], combos[i]];
      }
      const tiles = combos.slice(0, n * n - 1);
      tiles.push(tiles[0]);
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
      const grid = g.el("div", "g-grid");
      grid.style.setProperty("--n", String(n));
      tiles.forEach((t, i) => {
        const tile = g.el("div", `g-pair c-${t.color}`);
        tile.append(g.el("span", `g-shape s-${t.shape}`));
        tile.dataset.key = `${t.shape}${t.color}`;
        tile.dataset.i = String(i);
        grid.append(tile);
      });
      g.stage.append(grid);

      let first = null;
      g.onTap(({ target }) => {
        const tile = target && target.closest && target.closest(".g-pair");
        if (!tile) return;
        if (!first) {
          first = tile;
          tile.classList.add("is-picked");
          return;
        }
        if (tile === first) {
          first.classList.remove("is-picked");
          first = null;
          return;
        }
        if (tile.dataset.key === first.dataset.key) {
          tile.classList.add("is-right");
          first.classList.add("is-right");
          g.win();
        } else {
          tile.classList.add("is-wrong");
          first.classList.add("is-wrong");
          for (const c of grid.children) if (c.dataset.key === tiles[0].shape + tiles[0].color) c.classList.add("is-right");
          g.lose();
        }
      });
    },
  },

  {
    id: "stack",
    title: "つみあげ",
    theme: "orange",
    timeout: "lose",
    instruction: (lv) => `タップで落として${3 + Math.floor(lv / 2)}段つめ！`,
    setup(g) {
      const goal = 3 + Math.floor(g.level / 2);
      const speed = 0.8 + g.level * 0.15; // 1秒に動く量（幅に対する割合）
      const COLORS = ["pink", "sky", "mint", "yellow", "lilac", "lime"];
      const field = g.el("div", "g-field");
      const counter = g.el("p", "g-note g-top", `のこり ${goal}`);
      g.stage.append(field, counter);
      const fieldH = field.clientHeight || 400;
      const blockH = Math.min(38, Math.floor((fieldH - 70) / (goal + 2)));

      const makeBlock = (left, width, row, color) => {
        const node = g.el("div", `g-block c-${color}`);
        node.style.height = `${blockH}px`;
        node.style.bottom = `${12 + row * blockH}px`;
        node.style.left = `${left * 100}%`;
        node.style.width = `${width * 100}%`;
        field.append(node);
        return node;
      };
      const tower = [{ left: 0.25, width: 0.5 }];
      makeBlock(0.25, 0.5, 0, "orange").classList.add("is-base");

      let moving = null;
      const spawn = () => {
        const top = tower[tower.length - 1];
        const fromLeft = tower.length % 2 === 1;
        const left = fromLeft ? 0 : 1 - top.width;
        moving = { left, width: top.width, dir: fromLeft ? 1 : -1 };
        moving.el = makeBlock(left, top.width, tower.length, COLORS[tower.length % COLORS.length]);
      };
      spawn();

      g.frame((dt) => {
        if (!moving) return;
        moving.left += moving.dir * speed * dt;
        if (moving.left <= 0) {
          moving.left = 0;
          moving.dir = 1;
        } else if (moving.left >= 1 - moving.width) {
          moving.left = 1 - moving.width;
          moving.dir = -1;
        }
        moving.el.style.left = `${moving.left * 100}%`;
      });

      g.onTap(() => {
        if (!moving) return;
        const top = tower[tower.length - 1];
        const m = moving;
        moving = null;
        if (Math.abs(m.left - top.left) < 0.025) m.left = top.left; // ほぼぴったりならそろえる
        const l = Math.max(m.left, top.left);
        const r = Math.min(m.left + m.width, top.left + top.width);
        if (r - l <= 0.02) {
          m.el.classList.add("is-fall");
          g.lose();
          return;
        }
        m.el.style.left = `${l * 100}%`;
        m.el.style.width = `${(r - l) * 100}%`;
        tower.push({ left: l, width: r - l });
        const placed = tower.length - 1;
        counter.textContent = `のこり ${goal - placed}`;
        if (placed >= goal) {
          g.win();
          return;
        }
        spawn();
      });
    },
  },

  {
    id: "pop",
    title: "ふうせん割り",
    theme: "lilac",
    timeout: "lose",
    instruction: (lv) => `ふうせんだけ${4 + Math.floor(lv / 2)}こ割れ！`,
    setup(g) {
      const goal = 4 + Math.floor(g.level / 2);
      const bombRate = Math.min(0.45, 0.22 + g.level * 0.05);
      const every = Math.max(0.28, 0.42 - g.level * 0.03);
      const speed = 0.32 + g.level * 0.05; // 1秒にのぼる量（高さに対する割合）
      const COLORS = ["pink", "sky", "yellow", "mint"];
      const field = g.el("div", "g-field");
      const counter = g.el("p", "g-note g-top", `のこり ${goal}　ばくだんはダメ`);
      g.stage.append(field, counter);

      const items = [];
      let untilSpawn = 0;
      let popped = 0;
      let lastBomb = false;
      g.frame((dt, elapsed) => {
        untilSpawn -= dt;
        if (untilSpawn <= 0) {
          untilSpawn += every;
          const bomb = !lastBomb && Math.random() < bombRate;
          lastBomb = bomb;
          const node = g.el("div", bomb ? "g-floater is-bomb" : `g-floater is-balloon c-${COLORS[Math.floor(Math.random() * COLORS.length)]}`);
          const item = { node, x0: 0.14 + Math.random() * 0.72, y: 1.1, phase: Math.random() * 6, bomb, gone: false };
          node.style.left = `${item.x0 * 100}%`;
          field.append(node);
          items.push(item);
        }
        for (const item of items) {
          if (item.gone) continue;
          item.y -= speed * dt;
          item.node.style.top = `${item.y * 100}%`;
          item.node.style.left = `${(item.x0 + Math.sin(elapsed * 2 + item.phase) * 0.03) * 100}%`;
          if (item.y < -0.15) {
            item.gone = true;
            item.node.remove();
          }
        }
      });

      g.onTap(({ target }) => {
        const node = target && target.closest && target.closest(".g-floater");
        if (!node) return;
        const item = items.find((it) => it.node === node);
        if (!item || item.gone) return;
        item.gone = true;
        if (item.bomb) {
          node.classList.add("is-boom");
          counter.textContent = "ドカーン！";
          g.lose();
          return;
        }
        node.classList.add("is-popped");
        popped++;
        counter.textContent = `のこり ${Math.max(0, goal - popped)}　ばくだんはダメ`;
        if (popped >= goal) g.win();
      });
    },
  },
];
