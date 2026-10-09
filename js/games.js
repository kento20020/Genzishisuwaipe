/*
 * ミニゲームの一覧。ゲームを増やすときは、この配列に1つ足すだけでOKです。
 *
 *   id          : 英数字の名前（重複しないように）
 *   title       : 画面上のゲーム名
 *   theme       : 背景の色と模様（pink / yellow / mint / sky / orange / lilac / lime）
 *   timeout     : 5秒たったときの結果。"lose"＝時間切れで失敗、"win"＝耐えきれば成功
 *   instruction : お題の文章。level（0〜5、連続クリアで上がる）を受け取って返す
 *   setup(g)    : ゲーム本体。g の中身は次のとおり
 *     g.stage           ゲームを描く場所（div）
 *     g.level           むずかしさ（0〜5）
 *     g.el(tag, class, text)  要素を作る
 *     g.win() / g.lose()      成功・失敗で終了
 *     g.after(ms, fn)         ms後に1回だけ実行
 *     g.frame(fn)             毎フレーム fn(経過秒の差分, 開始からの秒) を実行
 *     g.onTap(fn)             画面に触れた瞬間 fn({x, y, w, h, target})
 *     g.onSwipe(fn, {tapSides})  左右のスワイプで fn("left" | "right")
 *                                tapSides: true なら、画面の左半分／右半分のタップでも反応
 * ゲームが終わると、タイマーや操作の受付はすべて自動で止まります。
 */

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
];
