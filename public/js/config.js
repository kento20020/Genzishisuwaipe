/*
 * 公開するときに書きかえる設定です。ここ以外のファイルはさわらなくてOKです。
 * （くわしい手順は README.md の「公開のしかた」を見てください）
 */
const SITE = {
  // 公開したURL（例: "https://gobyo.pages.dev/"）。
  // シェアするときに付くURLになります。空のままなら、開いているページのURLを使います。
  url: "https://gobyo.kento-dev.workers.dev/",

  // CM画面に広告を出すときは "ad.html" にします。
  // 先に ad.html の中に、広告サービスでもらった広告タグを貼りつけてください。
  adFrame: "",

  // 広告の大きさ [横, 縦]。広告サービスで作った広告枠の大きさに合わせます。
  adSize: [300, 250],

  // 広告なしパック（買い切り）の設定。paymentLink が空のあいだは、購入ボタンは表示されません。
  // Stripe で作った支払いリンクのURL（https://buy.stripe.com/...）をここに入れます。
  // ※支払い後の移動先は、このサイトの /thanks?session_id={CHECKOUT_SESSION_ID} にします（README参照）
  shop: {
    paymentLink: "",
    price: "500円",
  },
};
