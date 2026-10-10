(() => {
  "use strict";

  const NOADS_KEY = "gobyo-noads";
  const $ = (id) => document.getElementById(id);
  const status = $("status");
  const params = new URLSearchParams(location.search);
  const sessionId = params.get("session_id") || "";

  function show(text, kind) {
    status.textContent = text;
    status.className = `status${kind ? ` is-${kind}` : ""}`;
  }

  function saveToken(token) {
    try {
      localStorage.setItem(NOADS_KEY, token);
      return true;
    } catch (_) {
      return false;
    }
  }

  function done(token) {
    const saved = saveToken(token);
    show(
      saved
        ? "ありがとうございます！広告なしパックが使えるようになりました。"
        : "支払いは確認できましたが、このブラウザには保存できませんでした。プライベートモードを使っていませんか？",
      saved ? "ok" : "ng"
    );
    $("retry").hidden = true;
    if (sessionId) {
      $("restoreUrl").textContent = location.href;
      $("restore").hidden = false;
    }
  }

  async function redeem() {
    if (!sessionId) {
      let have = "";
      try {
        have = localStorage.getItem(NOADS_KEY) || "";
      } catch (_) {
        have = "";
      }
      show(have ? "このブラウザでは、広告なしパックを購入済みです。" : "購入の情報が見つかりません。購入完了後のアドレスから開いてください。", have ? "ok" : "ng");
      return;
    }
    show("購入を確認しています…");
    $("retry").hidden = true;
    let res;
    try {
      res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch (_) {
      show("通信できませんでした。電波のよいところで、もう一度たしかめてください。", "ng");
      $("retry").hidden = false;
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok && data.token) {
      done(data.token);
    } else if (data.reason === "not_paid") {
      show("支払いがまだ完了していません。銀行振込など時間がかかる方法の場合は、支払いの完了後にこのページをもう一度開いてください。", "ng");
      $("retry").hidden = false;
    } else if (data.reason === "not_found" || data.reason === "bad_request") {
      show("この購入は見つかりませんでした。アドレスが正しいか確認してください。", "ng");
    } else {
      show("確認できませんでした。しばらくしてから、もう一度たしかめてください。", "ng");
      $("retry").hidden = false;
    }
  }

  $("retry").addEventListener("click", redeem);
  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      $("copy").textContent = "コピーしました";
    } catch (_) {
      $("copy").textContent = "上のアドレスを長押ししてコピーしてください";
    }
  });
  redeem();
})();
