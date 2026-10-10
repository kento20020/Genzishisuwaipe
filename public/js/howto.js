/*
 * 初めて出るゲームで見せる「操作の見本」の種類。ゲームのidごとに、どの操作かを決める。
 *   tap     タップ         rapid  れんだ         hold   長押し          swipe  左右にスワイプ
 *   flick   4方向にスワイプ  drag   ドラッグ        pull   引いて離す       rub    左右にこする
 *   circle  円をえがく      nothing さわらない      choose えらんでタップ
 * 新しいゲームを足したら、ここにも1行足す（なければ見本は出ない）。
 */
const HOWTO = {
  mash: "rapid", stop: "tap", sort: "swipe", dodge: "swipe", dont: "nothing", odd: "choose", center: "tap",
  whack: "tap", balloon: "hold", react: "tap", janken: "choose", catch: "drag", memory: "swipe", flick: "flick",
  count: "choose", math: "choose", trace: "drag", pair: "choose", stack: "tap", pop: "tap",
  shell: "tap", run: "rapid", daruma: "hold", stroop: "choose", scale: "swipe", flash: "tap", amida: "tap",
  crank: "circle", captain: "flick", coin: "rapid",
  clock: "choose", sling: "pull", flanker: "swipe", make10: "choose", follow: "drag", beat: "tap", missing: "choose",
  keeper: "swipe", half: "tap", polish: "rub",
  jumprope: "tap", slide: "flick", fit: "drag", mot: "tap", next: "choose", lift: "tap", bus: "choose",
  gear: "swipe", mirror: "choose", hover: "hold",
};

const HOWTO_LABEL = {
  tap: "タップ", rapid: "れんだ！", hold: "長押し（おしっぱなし）", swipe: "左右にスワイプ",
  flick: "上下左右にスワイプ", drag: "ドラッグ（指でうごかす）", pull: "ひっぱって はなす",
  rub: "左右にこする", circle: "円をえがく", nothing: "さわらない！", choose: "えらんでタップ",
};
