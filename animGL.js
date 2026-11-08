/* =========================================================
 *  AnimGL.js - Timeline "Little Nightmares" (100 detik) untuk WebGL mentah
 *
 *  Scene 1  0:00-0:15  A Dark Beginning
 *  Scene 2  0:15-0:35  The Janitor Appears
 *  Scene 3  0:35-1:00  The Distraction
 *  Scene 4  1:00-1:25  The Chase
 *  Scene 5  1:25-1:40  The Last Escape
 *
 *  Yaw (radian): E=+x  N=-z (dinding belakang)  W=-x  S=+z (kamera)
 *  Semua waktu/posisi/kamera ada di blok DATA TIMELINE & SHOTS.
 * ========================================================= */
window.createAnimation = function (ctx) {
  var env = ctx.env, sfx = ctx.sfx;
  var DUR = 100;
  var E = Math.PI / 2, N = Math.PI, W = Math.PI * 1.5, S = 0, TAU = Math.PI * 2;

  /* ---------------- util ---------------- */
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function sstep(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function hash(n) { var s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

  // Track: nilai skalar berbasis keyframe [[t, v, 'l'?]]. Default smoothstep, 'l' = linear.
  function Track(k) { this.k = k; }
  Track.prototype.at = function (t) {
    var k = this.k, n = k.length;
    if (t <= k[0][0]) return k[0][1];
    if (t >= k[n - 1][0]) return k[n - 1][1];
    for (var i = 1; i < n; i++) {
      if (t < k[i][0]) {
        var a = k[i - 1], b = k[i], u = (t - a[0]) / (b[0] - a[0]);
        if (b[2] !== 'l') u = sstep(u);
        return a[1] + (b[1] - a[1]) * u;
      }
    }
    return k[n - 1][1];
  };
  function T(k) { return new Track(k); }

  // Path: jalur [t, x, z] linear + tabel jarak kumulatif (untuk siklus langkah)
  function Path(pts) {
    this.p = pts; this.step = 1 / 60;
    this.cum = [0];
    var prev = this.at(0), acc = 0;
    for (var t = this.step; t <= DUR + 0.001; t += this.step) {
      var c = this.at(t); acc += Math.hypot(c[0] - prev[0], c[1] - prev[1]); this.cum.push(acc); prev = c;
    }
  }
  Path.prototype.at = function (t) {
    var p = this.p, n = p.length;
    if (t <= p[0][0]) return [p[0][1], p[0][2]];
    if (t >= p[n - 1][0]) return [p[n - 1][1], p[n - 1][2]];
    for (var i = 1; i < n; i++) {
      if (t < p[i][0]) {
        var a = p[i - 1], b = p[i], u = (t - a[0]) / (b[0] - a[0]);
        return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
      }
    }
    return [p[n - 1][1], p[n - 1][2]];
  };
  Path.prototype.dist = function (t) {
    var f = clamp(t, 0, DUR) / this.step, i = Math.floor(f), u = f - i;
    return lerp(this.cum[i], this.cum[Math.min(i + 1, this.cum.length - 1)], u);
  };
  Path.prototype.speed = function (t) {           // kecepatan yang dihaluskan (jendela +-0.4 s)
    var a = this.at(t - 0.4), b = this.at(t + 0.4);
    return Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.8;
  };

  /* =======================================================
   *  DATA TIMELINE
   * ======================================================= */
  // ---- SIX ----
  var sixPath = new Path([
    [0, -5.0, -0.5], [0.8, -5.0, -0.5], [10.5, 6.0, -0.5], [13.4, 7.2, -2.3], [17.0, 7.2, -2.3],   // Scene 1: jalan ke pintu
    [22.0, 4.4, -0.8], [24.0, 4.4, -0.8],                                                           // Scene 2: ke meja
    [24.8, 4.4, -1.45], [26.8, 2.5, -1.75], [51.0, 2.5, -1.75],                                     // sembunyi di bawah meja
    [53.6, 4.075, -1.03], [59.6, 4.075, -1.03], [60.2, 4.075, -0.75], [62.2, 4.075, -0.75],         // Scene 3: ambil kunci
    [65.5, 8.275, -2.45], [85.0, 8.275, -2.45],                                                     // Scene 4: lari ke pintu
    [88.6, 8.45, -4.3], [91.0, 8.45, -4.3], [96.5, 8.15, -5.0], [DUR, 8.15, -5.0]                   // Scene 5: lift
  ]);
  var sixYaw = T([
    [0, E], [10.0, E], [11.8, 2.69], [13.8, N], [15.8, N], [17.2, 5.115], [21.4, 5.115], [22.8, N], [24.0, N],
    [25.6, 4.55], [26.8, 4.55], [27.8, TAU], [51.0, TAU], [51.6, 7.42], [53.4, 7.42], [54.2, 3 * Math.PI],
    [62.2, 3 * Math.PI], [62.9, 8.238], [65.3, 8.238], [66.0, 3 * Math.PI], [89.0, 3 * Math.PI], [90.6, 4 * Math.PI]
  ]);
  var sixCrouch = T([[0, 0], [23.8, 0], [24.5, 1], [53.0, 1], [54.2, 0]]);
  var sixFlame = T([[0, 1], [23.2, 1], [23.5, 0], [65.4, 0], [66.0, 1]]);          // lighter menyala
  var sixArmRUp = T([[0, 1], [23.2, 1], [24.2, 0], [65.2, 0], [66.0, 1]]);         // lengan kanan terangkat (lighter)
  var sixReachL = T([[0, 0], [21.8, 0], [22.6, 0.55], [23.3, 0.55], [24.2, 0],
    [54.2, 0], [56.3, 1], [56.9, 1], [58.4, 0.5], [66.2, 0.5], [68.0, 0.66], [84.5, 0.66], [85.4, 0.2], [86.5, 0]]);
  var sixScared = T([[0, 0], [22.8, 0.2], [24, 0.8], [27, 0.5], [59.0, 0.4], [60.2, 0.9], [66, 0.6], [85, 0.9], [DUR, 1]]);
  var sixHeadYaw = T([[0, 0], [15.8, 0], [16.6, 0.5], [17.4, 0], [22.9, 0], [23.5, 0.9], [26, 0.9], [28, -0.7], [48, -0.7], [50, 0],
    [60.2, 0], [60.7, 0.9], [62, 0.9], [62.9, 0], [66.5, 0], [67.5, 1.1], [69, 1.1], [69.5, 0.2], [72, 0.1], [73, 1.2], [75, 1.2],
    [75.6, 0], [79, 0], [80, 1.2], [82.5, 1.2], [83.5, 0.3], [89, 0.0], [91, 0.0], [95, 0.25], [DUR, 0.25]]);
  var sixHeadPitch = T([[0, 0], [54.2, 0], [55, -0.4], [58.4, -0.4], [59, 0.2], [60, 0]]);

  // ---- MONO ----
  var monoPath = new Path([
    [0, -6.8, -0.45], [0.8, -6.8, -0.45], [11.6, 5.0, -0.45], [14.4, 6.2, -1.5], [20.0, 6.2, -1.5],
    [23.2, 5.4, -0.9], [24.3, 5.4, -0.9], [25.2, 4.7, -1.65], [27.2, 3.4, -1.7], [37.0, 3.4, -1.7],
    [37.9, 3.4, -2.5], [44.2, -1.1, -2.5], [45.4, -1.55, -2.0], [48.4, -1.55, -2.0],                  // merangkak ke radio
    [49.6, -1.0, -2.5], [53.8, 3.4, -1.95], [61.0, 3.4, -1.8],                                         // kembali ke bawah meja
    [62.3, 3.55, -0.95], [66.0, 8.95, -2.4], [85.4, 8.95, -2.4],                                       // lari ke pintu
    [88.8, 9.0, -4.3], [91.0, 9.0, -4.3], [96.5, 9.2, -5.0], [DUR, 9.2, -5.0]
  ]);
  var monoYaw = T([
    [0, E], [11.4, E], [13.0, 2.45], [14.8, N], [19.9, N], [20.8, 5.11], [23.0, 5.11], [25.0, 3.89], [26.0, W], [27.5, TAU], [37.0, TAU],
    [37.7, N], [38.3, W], [43.6, W], [45.2, N], [48.4, N], [49.4, E], [53.5, E], [54.3, S], [61.0, S],
    [62.2, S], [62.9, 1.83], [65.8, 1.83], [67.0, N], [68.5, W], [84.5, W], [85.4, N], [89.0, N], [90.5, TAU]
  ]);
  var monoCrouch = T([[0, 0], [24.2, 0], [25.2, 1], [45.0, 1], [45.5, 0.55], [48.2, 0.55], [48.9, 0.8], [53.6, 0.8], [54.2, 1], [61.0, 1], [62.0, 0], [DUR, 0]]);
  var monoReach = T([[0, 0], [45.6, 0], [46.6, 1], [47.6, 1], [48.3, 0]]);       // lengan ke tombol radio
  var monoScared = T([[0, 0], [23.0, 0.2], [24.5, 0.9], [60, 0.8], [66, 0.7], [85, 1], [DUR, 1]]);
  var monoHeadYaw = T([[0, 0], [14.8, 0], [15.6, 0.6], [16.6, -0.6], [17.8, 0], [37, 0], [38, 0.7], [43, 0], [66.5, 0], [68.5, 0.5], [84, 0.5], [86, 0], [DUR, 0]]);
  var monoPull = T([[0, 0], [62.0, 0], [62.4, 1], [65.8, 1], [66.4, 0]]);        // Mono menarik Six

  // ---- THE JANITOR ----
  var janPath = new Path([
    [0, -7.2, 0.9], [22.2, -7.2, 0.9], [32.0, 0.6, 0.9],                                             // muncul dari kegelapan
    [39.0, 1.0, 0.6], [44.0, 0.3, 0.8], [50.0, 0.6, 0.9],                                            // mencari
    [57.0, -1.2, -1.1], [62.2, -1.2, -1.1],                                                          // menuju radio
    [65.0, 0.0, 0.35], [72.0, 3.6, 0.4], [85.0, 5.2, 0.3], [93.0, 7.9, -0.6], [DUR, 7.9, -0.6]      // pengejaran
  ]);
  var janYaw = T([
    [0, E], [33.0, E], [37.0, 2.44], [41, 2.44], [42.5, 0.9], [45, 2.44], [47.5, E], [48.4, E], [50.0, -E],
    [51.5, -2.4], [57, -2.68], [60.5, -2.68], [62.2, 1.45], [66, 1.8], [72, 2.1], [85, 2.25], [93, 2.34], [DUR, 2.34]
  ]);
  var janHeadYaw = T([[0, 0], [33, 0], [35, 0.5], [38, -0.5], [42, 0.4], [46, -0.3], [48.0, 0], [48.3, 1.0], [49.8, 0], [60.2, 0], [60.5, -1.0], [62.2, 0], [DUR, 0]]);
  var janHeadPitch = T([[0, 0], [33, 0], [36, -0.1], [49, -0.1], [50, 0], [56, 0.3], [60, 0.3], [62, -0.15], [DUR, -0.15]]);
  var janLean = T([[0, 0.05], [34, 0.05], [36, 0.35], [48, 0.35], [49, 0.1], [56, 0.1], [58, 0.3], [60, 0.3], [62, 0.2], [72, 0.38], [DUR, 0.5]]);
  var janSearch = T([[0, 0], [34.5, 0], [36.5, 0.9], [48.0, 0.9], [49.2, 0]]);   // lengan menyapu lantai
  var janReach = T([[0, 0], [62.0, 0], [63.3, 1], [DUR, 1]]);                       // lengan memanjang ke Six
  var janReachLen = T([[62.4, 1.8], [64.5, 2.7], [67, 3.0], [72, 3.4], [78, 3.9], [84.5, 4.4], [88, 4.6]]); // panjang lengan (meter dunia)
  var janDoor = T([[0, 0], [87.5, 0], [89.5, 1]]);                                  // beralih ke target pintu lift

  // ---- PROPS ----
  var doorAngle = T([[0, 0], [84.6, 0], [88.0, 1.75]]);          // daun pintu terbuka (rad)
  var gateScale = T([[0, 0.12], [90.0, 0.12], [93.0, 0.35], [96.0, 0.65], [98.5, 0.80]]);   // jeruji lift menutup
  var KEY_GRAB = 56.5, KEY_HELD = 57.2;                            // kunci diambil Six
  var CAN_T0 = 59.4, CAN_FALL = 0.62;                              // kaleng jatuh
  var RADIO_ON = 47.6;
  var UNLOCK_T = 84.0;

  /* =======================================================
   *  MATEMATIKA MATRIKS (array 16 column-major, bersama LIBS)
   * ======================================================= */
  var I4 = LIBS.identity, mul = LIBS.multiply, tp = LIBS.transformPoint, norm = LIBS.normalize;
  function inv4(a) {                              // invers matriks 4x4 (column-major)
    var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    var b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    det = 1 / (det || 1e-9);
    return [
      (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
      (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
      (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
      (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det
    ];
  }
  // rotasi 4x4 yang memutar vektor satuan a menjadi b
  function rotFromTo(a, b) {
    var v = LIBS.cross(a, b), c = LIBS.dot(a, b);
    if (c < -0.9999) return LIBS.rotationX(Math.PI);
    var k = 1 / (1 + c);
    return [c + k * v[0] * v[0], k * v[0] * v[1] + v[2], k * v[0] * v[2] - v[1], 0,
      k * v[0] * v[1] - v[2], c + k * v[1] * v[1], k * v[1] * v[2] + v[0], 0,
      k * v[0] * v[2] + v[1], k * v[1] * v[2] - v[0], c + k * v[2] * v[2], 0, 0, 0, 0, 1];
  }
  function actorMatrix(p, yaw, s) { return mul(mul(LIBS.translation(p[0], 0, p[1]), LIBS.rotationY(yaw)), LIBS.scaling(s, s, s)); }
  // campur dua matriks rotasi+translasi lalu orthonormalkan sumbunya
  function blendRT(a, b, u) {
    var o = new Array(16), i;
    for (i = 0; i < 16; i++) o[i] = a[i] + (b[i] - a[i]) * u;
    var x = norm([o[0], o[1], o[2]]), y = [o[4], o[5], o[6]], z = norm(LIBS.cross(x, y)); y = LIBS.cross(z, x);
    o[0] = x[0]; o[1] = x[1]; o[2] = x[2]; o[4] = y[0]; o[5] = y[1]; o[6] = y[2]; o[8] = z[0]; o[9] = z[1]; o[10] = z[2];
    return o;
  }

  /* =======================================================
   *  AKTOR
   * ======================================================= */
  var Rn = ctx.R, GeoX = window.LNGeo;
  var sixRoot = ctx.six.root, SN = ctx.six.nodes;
  SN.six = sixRoot;
  var monoRoot = ctx.mono.root, MN = ctx.mono.nodes;
  var janRoot = ctx.jan.root, JN = ctx.jan.nodes;
  Rn.prepSix(sixRoot); Rn.prepJanitor(janRoot); Rn.prepMono(monoRoot, ctx.mono.textures);
  var SCALE = { six: 0.78, mono: 0.49, jan: 0.95 };
  var M_ = { six: I4(), mono: I4(), jan: I4() };        // matriks dunia tiap aktor
  var P_ = { six: [0, 0], mono: [0, 0], jan: [0, 0] };  // posisi lantai (x, z)
  var W_ = { six: [0, 0.7, 0], mono: [0, 0.6, 0], jan: [0, 1.2, 0] };
  var janVisible = false;
  var lastStep = { six: 0, mono: 0, jan: 0 }, lastEvt = 0;
  var camEye = [0, 1, 5];

  var SIX_NAMES = ['six', 'head', 'hood', 'armL', 'armR', 'legL', 'legR'];
  function resetSix() { SIX_NAMES.forEach(function (k) { var n = SN[k]; n.t = n.base.t.slice(); n.r = n.base.r.slice(); n.s = [1, 1, 1]; }); sixRoot.t = [0, 0, 0]; sixRoot.r = [0, 0, 0]; }
  var MONO_NAMES = ['hips', 'head', 'armP', 'armN', 'legP', 'legN', 'cape'];
  function resetMono() { MONO_NAMES.forEach(function (k) { var n = MN[k]; n.t = n.base.t.slice(); n.r = n.base.r.slice(); n.s = [1, 1, 1]; }); }
  var JAN_NAMES = ['root', 'body', 'head', 'hat', 'legL', 'legR'], janRest = {};
  JAN_NAMES.forEach(function (k) { var n = JN[k]; janRest[k] = { p: n.position.slice(), r: n.rotation.slice(), s: n.scale.slice() }; });
  function resetJan() { JAN_NAMES.forEach(function (k) { var n = JN[k]; n.position = janRest[k].p.slice(); n.rotation = janRest[k].r.slice(); n.scale = janRest[k].s.slice(); }); }

  /* ---------------- props: lighter, api ---------------- */
  var lighterBody = Rn.mesh(GeoX.box(0.03, 0.075, 0.016, 1, 1)), lighterCap = Rn.mesh(GeoX.box(0.032, 0.02, 0.018, 1, 1));
  var mLighter = { color: [0.54, 0.55, 0.56], spec: 0.5, shin: 40 }, mLighterCap = { color: [0.33, 0.34, 0.35], spec: 0.5, shin: 40 };
  var flameGeo = Rn.mesh(GeoX.sphere(1, 1, 1, 10, 12));
  var armRWorld = I4(), armLWorld = I4(), flamePos = [0, 0, 0], flameK = 0, flameFlick = 1;

  function flick(t, seed, amt) {
    var slot = Math.floor(t * 11 + seed * 7), r = hash(slot + seed);
    var dip = r > 0.8 ? 0.08 + 0.5 * hash(slot * 3.3 + seed) : 1;
    var micro = 0.9 + 0.1 * Math.sin(t * 53 + seed * 3) * Math.sin(t * 19.7);
    return 1 - amt * (1 - dip * micro);
  }

  /* =======================================================
   *  POSE: SIX  (Euler per node)
   * ======================================================= */
  function poseSix(t) {
    resetSix();
    var sp = sixPath.speed(t), a = clamp(sp / 0.6, 0, 1), run = clamp((sp - 1.3) / 0.5, 0, 1);
    var c = sixCrouch.at(t), ph = sixPath.dist(t) / 0.62 * TAU, sw = Math.sin(ph);
    var s = sixScared.at(t), tr = (hash(Math.floor(t * 30)) - 0.5) * 0.03 * s;
    var lean = 0.05 * a + 0.20 * run + 0.42 * c;
    var amp = (0.30 + 0.38 * run) * a * (1 - 0.65 * c);
    var thL = -1.15 * c + sw * amp, thR = -1.15 * c - sw * amp;
    SN.legL.r[0] = thL - lean; SN.legR.r[0] = thR - lean;
    var D = 0.6 * (1 - Math.cos(Math.max(Math.abs(thL), Math.abs(thR)))), H = 0.62;
    sixRoot.r[0] = lean;
    sixRoot.t = [0, H * (1 - Math.cos(lean)) - D, -H * Math.sin(lean)];
    sixRoot.s[1] = 1 + 0.008 * Math.sin(t * 1.8);
    var swArm = -sw * 0.45 * a * (1 - c), reachL = sixReachL.at(t);
    SN.armL.r[0] = lerp(-0.06 + swArm - 0.5 * c - 0.6 * s, -2.35, reachL) + tr;
    SN.armL.r[2] = lerp(0.17 + 0.2 * s, 0.02, reachL);
    var up = sixArmRUp.at(t);
    SN.armR.r[0] = lerp(-0.06 - swArm - 0.5 * c - 0.6 * s, -1.15 - 0.05 * Math.sin(t * 2.1), up) - tr;
    SN.armR.r[2] = lerp(-0.17 - 0.2 * s, -0.12, up);
    SN.head.r[1] = sixHeadYaw.at(t) + tr * 2;
    SN.head.r[0] = sixHeadPitch.at(t) - 0.55 * lean;
    SN.hood.r[2] += 0.03 * Math.sin(t * 0.9 + 0.5) + tr;
  }

  /* =======================================================
   *  POSE: MONO
   * ======================================================= */
  function poseMono(t) {
    resetMono();
    var sp = monoPath.speed(t), a = clamp(sp / 0.6, 0, 1), run = clamp((sp - 1.25) / 0.5, 0, 1);
    var c = monoCrouch.at(t), ph = monoPath.dist(t) / 0.55 * TAU, sw = Math.sin(ph);
    var s = monoScared.at(t), tr = (hash(Math.floor(t * 30) + 9) - 0.5) * 0.04 * s;
    var lean = 0.05 * a + 0.16 * run + 0.38 * c;
    var amp = (0.42 + 0.32 * run) * a * (1 - 0.6 * c);
    var thP = -1.1 * c + sw * amp, thN = -1.1 * c - sw * amp;
    var D = 0.9 * (1 - Math.cos(Math.max(Math.abs(thP), Math.abs(thN)))), H = 0.9;
    MN.hips.r[0] = lean; MN.hips.t = [0, H * (1 - Math.cos(lean)) - D, -H * Math.sin(lean)];
    MN.legP.r[0] = thP; MN.legN.r[0] = thN; MN.legP.t[1] = 0.9 - D; MN.legN.t[1] = 0.9 - D;
    var pull = monoPull.at(t), reach = monoReach.at(t);
    var armPx = lerp(-sw * 0.5 * a * (1 - c) - 0.4 * s, -0.9, reach);
    armPx = lerp(armPx, -1.25, pull);
    MN.armP.r[0] = armPx + tr - lean * 0.3; MN.armP.r[2] = lerp(0, -0.1, pull);
    MN.armN.r[0] = sw * 0.5 * a * (1 - c) - 0.4 * s - tr - lean * 0.3;
    MN.head.r[0] = -0.6 * lean + 0.05 * Math.sin(t * 1.3); MN.head.r[1] = monoHeadYaw.at(t) + tr * 2;
    MN.cape.r[0] = 0.12 + 0.10 * a + 0.25 * run + 0.02 * Math.sin(t * 2.2);
  }

  /* =======================================================
   *  POSE: THE JANITOR - badan Euler, lengan panjang di-IK
   *  Lengan diregangkan pada sumbu-y lalu diputar agar ujungnya menuju target.
   * ======================================================= */
  function poseJanitorBody(t) {
    resetJan();
    var sp = janPath.speed(t), a = clamp(sp / 0.45, 0, 1), ph = janPath.dist(t) / 1.0 * TAU, sw = Math.sin(ph);
    var lean = janLean.at(t) + 0.03 * a, thw = 0.40 * sw * a;
    JN.legL.rotation[0] = thw; JN.legR.rotation[0] = -thw;
    JN.root.position = [0, -0.5 * (1 - Math.cos(thw)) + 0.02 * Math.abs(Math.cos(ph)) * a, 0];
    var H = 0.55;
    JN.body.rotation = [lean, 0, 0.05 * Math.sin(ph) * a];
    JN.body.position = [0, H * (1 - Math.cos(lean)), -H * Math.sin(lean)];
    JN.head.rotation = [JN.head.rotation[0] + janHeadPitch.at(t) - 0.5 * lean, janHeadYaw.at(t) + 0.12 * Math.sin(t * 0.7) * (1 - a), 0.04 * Math.sin(t * 0.5)];
  }
  // arah & regangan lengan agar ujung (jari) mencapai titik Tl (ruang lokal badan)
  function aimArm(S_, Tl) {
    var P = [S_ * 0.22, 1.27, 0], v = LIBS.sub(Tl, P), len = LIBS.length(v);
    var L = Math.max(len - 0.28, 1.38);
    var sy = clamp(Math.sqrt(Math.max(L * L - 0.5956, 1.2769)) / 1.13, 1.0, 5.0);
    return { dir: v.map(function (x) { return x / (len || 1); }), sy: sy };
  }
  var DOOR_R = [[88.0, 8.2, 0.9, -2.6], [91.0, 8.5, 0.9, -3.0], [93.5, 8.5, 0.9, -3.4], [95.5, 8.65, 0.85, -4.0], [97.5, 8.75, 0.85, -4.5], [99.4, 8.75, 0.85, -4.85]];
  var DOOR_L = [[88.0, 7.7, 1.1, -2.4], [92.0, 7.75, 1.4, -3.0], [99.5, 7.75, 1.45, -3.1]];
  function keyPoint(list, t) {
    var n = list.length;
    if (t <= list[0][0]) return [list[0][1], list[0][2], list[0][3]];
    if (t >= list[n - 1][0]) return [list[n - 1][1], list[n - 1][2], list[n - 1][3]];
    for (var i = 1; i < n; i++) if (t < list[i][0]) {
      var a = list[i - 1], b = list[i], u = sstep((t - a[0]) / (b[0] - a[0]));
      return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)];
    }
  }
  function poseJanitorArms(t) {
    var sp = janPath.speed(t), a = clamp(sp / 0.45, 0, 1), ph = janPath.dist(t) / 1.0 * TAU;
    var wSearch = janSearch.at(t), wReach = janReach.at(t), wDoor = janDoor.at(t);
    var bodyW = mul(mul(M_.jan, JN.root.local()), JN.body.local()), bodyInv = inv4(bodyW);
    [-1, 1].forEach(function (S_) {
      var node = S_ < 0 ? JN.armL : JN.armR, P = [S_ * 0.22, 1.27, 0];
      // 1) menggantung / diseret, sedikit mengayun
      var rh = mul(LIBS.rotationX(0.16 * Math.sin(ph + (S_ > 0 ? 0 : Math.PI)) * a + 0.03 * Math.sin(t * 0.8 + S_)), LIBS.rotationZ(S_ * 0.03));
      var sy = 1.08, dir = norm(tp(rh, norm([S_ * 0.40, -1.13 * sy, 0.66])));
      var hang = dir.slice();
      // 2) menyapu lantai
      if (wSearch > 0.001) {
        var ps = t * 0.9 + (S_ > 0 ? 0 : 2.2);
        var tl = [S_ * (0.30 + 0.60 * Math.sin(ps * 0.8)), 0.08 + 0.30 * Math.max(0, Math.sin(ps * 0.55)), 0.8 + 1.5 * (0.5 + 0.5 * Math.sin(ps))];
        var r1 = aimArm(S_, tl);
        dir = norm(LIBS.lerp(dir, r1.dir, wSearch)); sy = lerp(sy, r1.sy, wSearch);
      }
      // 3) meraih: mengejar Six / celah pintu lift
      if (wReach > 0.001) {
        var shW = tp(bodyW, P);
        var chest = [W_.six[0], 0.62, W_.six[2]], dv = LIBS.sub(chest, shW), dist = LIBS.length(dv), Lm = Math.min(janReachLen.at(t), dist);
        var tip = LIBS.add(shW, LIBS.scaleVector(norm(dv), Lm));
        tip[0] += 0.18 * S_ * Math.sin(t * 2.3 + S_); tip[1] += 0.06 * Math.sin(t * 3.1 + S_ * 2);
        if (wDoor > 0.001) tip = LIBS.lerp(tip, keyPoint(S_ < 0 ? DOOR_R : DOOR_L, t), wDoor);
        var r2 = aimArm(S_, tp(bodyInv, tip));
        dir = norm(LIBS.lerp(dir, r2.dir, wReach)); sy = lerp(sy, r2.sy, wReach);
      }
      var h = norm([S_ * 0.40, -1.13 * sy, 0.66]);
      node.matrixOverride = mul(mul(LIBS.translation(P[0], P[1], P[2]), rotFromTo(h, dir)), LIBS.scaling(1, sy, 1));
    });
  }

  /* =======================================================
   *  PROPS per frame: kunci, kaleng, radio, pintu, lift, lampu kunci
   * ======================================================= */
  var holdR = LIBS.rotationX(Math.PI / 2);
  var keyTableM = mul(LIBS.translation(env.keyTable[0], env.keyTable[1], env.keyTable[2]), mul(LIBS.rotationY(0.4), LIBS.rotationZ(Math.PI / 2)));
  var lampK = { left: 1, mid: 1, door: 1, table: 0 };       // dipakai bayangan

  function updateProps(t) {
    // lighter + api (lengan kanan Six)
    armRWorld = mul(mul(M_.six, sixRoot.local()), SN.armR.local());
    armLWorld = mul(mul(M_.six, sixRoot.local()), SN.armL.local());
    var fl = sixFlame.at(t), fk = flick(t, 5.0, 0.35);
    var hp = tp(armRWorld, [0, -0.56 * 1, 0.02]);
    flamePos = [hp[0], hp[1] + 0.045, hp[2]]; flameK = fl;
    flameFlick = (0.75 + 0.25 * Math.sin(t * 27) * Math.sin(t * 13.1)) * fk;
    lighterOn = sixArmRUp.at(t) > 0.05;

    // kunci: di meja -> terbang ke tangan kiri -> dipegang (bergetar saat dicoba masuk)
    var handM = mul(mul(armLWorld, LIBS.translation(0, -0.52, 0.02)), holdR);
    var km;
    if (t < KEY_GRAB) km = keyTableM;
    else if (t < KEY_HELD) km = blendRT(keyTableM, handM, sstep((t - KEY_GRAB) / (KEY_HELD - KEY_GRAB)));
    else km = handM.slice();
    if (t > 66.5 && t < 84.0) { km[12] += 0.004 * Math.sin(t * 40); km[13] += 0.003 * Math.sin(t * 33); }
    env.key.m = km;

    // kaleng jatuh dari meja lalu menggelinding ke arah kamera
    var s0 = env.canStart;
    if (t < CAN_T0) env.can.m = LIBS.translation(s0[0], s0[1], s0[2]);
    else if (t < CAN_T0 + CAN_FALL) {
      var tau = t - CAN_T0, u2 = tau / CAN_FALL;
      env.can.m = mul(LIBS.translation(s0[0] + 0.30 * u2, s0[1] - (s0[1] - 0.07) * u2 * u2, s0[2] + 0.45 * u2), mul(LIBS.rotationX(0.6 * tau * 6), LIBS.rotationZ(1.2 * u2 * Math.PI / 2)));
    } else {
      var r = t - (CAN_T0 + CAN_FALL), v = Math.max(0, 1 - r / 1.8), travel = 0.9 * (1 - v * v);
      env.can.m = mul(LIBS.translation(s0[0] + 0.30, 0.07, s0[2] + 0.45 + travel), mul(LIBS.rotationX(-travel / 0.07), LIBS.rotationZ(Math.PI / 2)));
    }

    // radio menyala
    var on = t >= RADIO_ON ? 1 : 0, pulse = on ? 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3) : 0;
    env.radio.dialMat.emis = [1.0 * on * pulse, 0.78 * on * pulse, 0.38 * on * pulse];
    env.radio.grilleMat.emis = [0.25 * on * pulse, 0.17 * on * pulse, 0.05 * on * pulse];

    // pintu & jeruji lift
    env.leafPivot.m = mul(LIBS.translation(9.6, 0, -3.08), LIBS.rotationY(doorAngle.at(t)));
    var gs = gateScale.at(t);
    env.gateL.m = mul(env.gateL.base, LIBS.scaling(gs, 1, 1)); env.gateR.m = mul(env.gateR.base, LIBS.scaling(gs, 1, 1));
    var open = sstep((t - 84.6) / 2.0);
    env.cabLampMat.emis = [1.0 * open, 0.85 * open, 0.55 * open];
    var unlocked = t >= UNLOCK_T, blink = unlocked ? 1 : (0.55 + 0.45 * Math.sin(t * 5.0));
    env.lockBulbMat.emis = unlocked ? [0.1 * 1.6 * blink, 1.6 * blink, 0.2 * 1.6 * blink] : [1.6 * blink, 0.24 * blink, 0.1 * blink];
  }
  var lighterOn = true;

  /* =======================================================
   *  LAMPU (dihitung tiap frame -> dikirim ke shader sebagai uniform)
   * ======================================================= */
  var frameLights = { points: [], spot: null, ambient: [0.18, 0.16, 0.12] };
  function scale3(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  function updateLights(t) {
    var f1 = t < 15 ? 0.85 : 0.3, chaos = t > 60 && t < 99.4 ? 0.55 : 0;
    var kL = flick(t, 1.0, Math.max(f1, chaos)), kM = flick(t, 2.0, t < 15 ? 0.6 : Math.max(0.3, chaos)), kD = flick(t, 3.0, Math.max(0.25, chaos));
    var midDim = 1 - 0.7 * sstep((t - 23.5) / 1.0) * (1 - sstep((t - 85) / 1));
    var iL = 1.5 * kL, iM = 1.8 * kM * midDim, iD = 1.3 * kD;
    function bulb(l, k) { l.bulbMat.emis = [2.4 * k, 2.0 * k, 1.4 * k]; }
    bulb(env.lamps.left, kL); bulb(env.lamps.mid, kM * midDim); bulb(env.lamps.door, kD);
    var onT = t >= 15.4 ? 1 : 0, amt = t < 17.5 ? 1.0 : (t > 22.5 && t < 26 ? 0.8 : (chaos ? 0.55 : 0.18));
    var kT = flick(t, 6.0, amt) * onT; bulb(env.lamps.table, kT);
    lampK.table = kT; lampK.mid = kM * midDim; lampK.left = kL;

    var cabI = 1.6 * sstep((t - 84.8) / 1.5) * (t > 98.6 ? flick(t, 4.0, 0.7) : 1);
    var radioI = (t >= RADIO_ON ? 1 : 0) * (0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3)) * 1.1 * flick(t, 8.0, 0.2);
    var blink = t >= UNLOCK_T ? 1 : (0.55 + 0.45 * Math.sin(t * 5.0));
    var lockC = t >= UNLOCK_T ? [0.2, 1, 0.3] : [1, 0.2, 0.1];
    var fl = flameK * 2.0 * flameFlick;
    var P = env.lamps, rp = env.radioPos;
    frameLights.points = [
      { pos: P.left.pos, color: scale3([1, 0.82, 0.54], iL), range: 11 },
      { pos: P.mid.pos, color: scale3([1, 0.85, 0.63], iM), range: 11 },
      { pos: P.door.pos, color: scale3([1, 0.81, 0.56], iD), range: 10 },
      { pos: [flamePos[0], flamePos[1] + 0.05, flamePos[2] + 0.05], color: scale3([1, 0.6, 0.24], fl), range: 6.5 },
      { pos: [rp[0] + 0.1, rp[1] + 0.3, rp[2] + 0.45], color: scale3([1, 0.77, 0.42], radioI), range: 4.5 },
      { pos: [8.6, 3.2, -2.5], color: scale3(lockC, 0.9 * blink), range: 5 },
      { pos: [8.6, 2.7, -4.2], color: scale3([1, 0.88, 0.63], cabI), range: 7 }
    ];
    var sp = P.table.pos, tg = [env.table.x, 0.3, env.table.z + 0.4];
    frameLights.spot = { pos: sp, dir: norm(LIBS.sub(tg, sp)), color: scale3([1, 0.87, 0.67], 5.0 * kT), cosOuter: Math.cos(0.95), cosInner: Math.cos(0.95 * 0.25), range: 11 };
    env.updateDust(t);
  }

  /* =======================================================
   *  KAMERA (shot list) : p/l = array [x,y,z] atau fungsi () => [x,y,z]
   * ======================================================= */
  function Wp(k, dx, dy, dz) { return function () { var v = W_[k]; return [v[0] + (dx || 0), v[1] + (dy || 0), v[2] + (dz || 0)]; }; }
  function Mid(a, b, dy) { return function () { return [(W_[a][0] + W_[b][0]) / 2, (W_[a][1] + W_[b][1]) / 2 + (dy || 0), (W_[a][2] + W_[b][2]) / 2]; }; }

  var SHOTS = [
    // ---- Scene 1 : A Dark Beginning ----
    { t0: 0.0,  t1: 4.0,  p0: [-3.8, 1.0, 5.8], p1: [-3.0, 1.0, 5.3], l0: [-1.0, 1.3, -1.0], l1: [0.0, 1.2, -1.0], f0: 42, f1: 42, sh: 0.003, name: 'Lorong gelap The Maw' },
    { t0: 4.0,  t1: 10.6, p0: [-0.5, 1.15, 5.6], p1: [4.0, 1.15, 5.2], l0: Wp('six', 1.2, 0.35, 0), l1: Wp('six', 1.2, 0.35, 0), f0: 38, f1: 38, sh: 0.003, name: 'Camera pan mengikuti Six' },
    { t0: 10.6, t1: 13.0, p0: [6.0, 1.0, 1.9], p1: [7.0, 1.0, 0.8], l0: [7.8, 0.9, -2.8], l1: [8.0, 0.9, -2.9], f0: 36, f1: 30, sh: 0.002, name: 'Mendekati pintu besi' },
    { t0: 13.0, t1: 15.0, p0: [8.7, 1.0, -1.1], p1: [8.45, 0.95, -1.7], l0: [8.1, 0.9, -3.0], l1: [8.1, 0.9, -3.0], f0: 32, f1: 26, sh: 0.002, name: 'Lubang kunci' },
    // ---- Scene 2 : The Janitor Appears ----
    { t0: 15.0, t1: 17.8, p0: [7.0, 1.2, 2.4], p1: [6.0, 1.2, 2.2], l0: [5.0, 1.0, -1.8], l1: [3.6, 1.1, -1.6], f0: 36, f1: 36, sh: 0.003, name: 'Six melihat kunci' },
    { t0: 17.8, t1: 22.2, p0: [7.2, 1.0, 2.3], p1: [3.8, 1.0, 2.0], l0: Wp('six', -0.6, 0.35, 0), l1: Wp('six', -0.6, 0.35, 0), f0: 34, f1: 34, sh: 0.003, name: 'Six mendekati meja' },
    { t0: 22.2, t1: 23.6, p0: [5.2, 1.55, 0.2], p1: [4.9, 1.45, -0.3], l0: [3.9, 1.2, -1.3], l1: [3.9, 1.2, -1.3], f0: 28, f1: 26, sh: 0.002, name: 'Tangan Six meraih kunci' },
    { t0: 23.6, t1: 26.0, p0: [4.0, 0.7, 5.6], p1: [3.5, 0.8, 5.3], l0: [-2.0, 1.2, 0.5], l1: [-1.5, 1.3, 0.6], f0: 40, f1: 40, sh: 0.004, name: 'Langkah kaki dari kegelapan' },
    { t0: 26.0, t1: 30.5, p0: [3.2, 0.4, 0.6], p1: [3.4, 0.45, 0.4], l0: [2.9, 0.4, -1.8], l1: [-0.5, 0.8, 0.8], f0: 38, f1: 38, sh: 0.004, name: 'Bersembunyi di bawah meja' },
    { t0: 30.5, t1: 35.0, p0: [6.8, 1.5, 5.2], p1: [5.6, 1.4, 4.4], l0: [2.0, 1.1, -0.5], l1: [2.0, 1.1, -0.5], f0: 40, f1: 40, sh: 0.003, name: 'The Janitor berhenti di dekat meja' },
    // ---- Scene 3 : The Distraction ----
    { t0: 35.0, t1: 39.5, p0: [3.5, 1.4, 5.2], p1: [2.4, 1.3, 4.4], l0: [1.2, 1.1, -0.4], l1: [1.2, 1.1, -0.4], f0: 40, f1: 40, sh: 0.003, name: 'Janitor mencari' },
    { t0: 39.5, t1: 43.5, p0: [-1.2, 0.55, 3.0], p1: [0.2, 0.6, 2.8], l0: [1.0, 0.45, 0.4], l1: [1.0, 0.45, 0.4], f0: 42, f1: 42, sh: 0.004, name: 'Tangan panjang menyapu lantai' },
    { t0: 43.5, t1: 47.4, p0: [-0.4, 0.6, 0.5], p1: [-0.9, 0.55, -0.5], l0: [-1.7, 0.45, -2.2], l1: [-1.7, 0.5, -2.2], f0: 36, f1: 34, sh: 0.003, name: 'Mono mendekati radio' },
    { t0: 47.4, t1: 48.6, p0: [-1.2, 0.75, -0.9], p1: [-1.4, 0.7, -1.2], l0: [-1.8, 0.6, -2.4], l1: [-1.8, 0.6, -2.4], f0: 30, f1: 28, sh: 0.002, name: 'Radio menyala' },
    { t0: 48.6, t1: 50.6, p0: [-1.5, 1.9, 3.0], p1: [-1.2, 1.95, 2.2], l0: [0.6, 2.0, 0.9], l1: [0.6, 2.0, 0.9], f0: 30, f1: 30, sh: 0.003, name: 'Janitor menoleh' },
    { t0: 50.6, t1: 55.0, p0: [3.0, 1.3, 5.3], p1: [1.5, 1.3, 5.0], l0: [0.3, 1.0, -0.2], l1: [-0.2, 1.0, -0.6], f0: 40, f1: 40, sh: 0.003, name: 'Janitor menuju sumber suara' },
    { t0: 55.0, t1: 60.0, p0: [5.4, 1.2, 1.2], p1: [5.0, 1.25, 0.6], l0: [4.0, 1.2, -1.2], l1: [4.0, 1.2, -1.2], f0: 32, f1: 30, sh: 0.002, name: 'Six mengambil kunci' },
    // ---- Scene 4 : The Chase ----
    { t0: 60.0, t1: 61.0, p0: [3.0, 0.9, 0.4], p1: [3.3, 0.8, 0.2], l0: [4.2, 0.7, -0.9], l1: [4.4, 0.3, -0.7], f0: 34, f1: 34, sh: 0.01, name: 'Kaleng jatuh' },
    { t0: 61.0, t1: 62.8, p0: [-2.5, 1.8, 2.6], p1: [-1.8, 1.9, 2.4], l0: [-1.2, 1.8, -0.9], l1: [-1.2, 1.8, -0.9], f0: 32, f1: 32, sh: 0.008, name: 'Janitor menyadari' },
    { t0: 62.8, t1: 66.0, p0: [2.0, 1.4, 5.3], p1: [6.2, 1.3, 4.5], l0: Mid('six', 'jan', 0.9), l1: Mid('six', 'jan', 0.9), f0: 42, f1: 42, sh: 0.012, name: 'Pengejaran' },
    { t0: 66.0, t1: 72.0, p0: [7.3, 1.05, -0.2], p1: [7.0, 1.1, -0.6], l0: [8.4, 0.9, -2.7], l1: [8.4, 0.9, -2.7], f0: 36, f1: 34, sh: 0.012, name: 'Six memasukkan kunci' },
    { t0: 72.0, t1: 77.0, p0: [9.9, 0.8, -1.7], p1: [9.5, 0.75, -1.3], l0: [6.0, 0.8, 0.0], l1: [6.4, 0.8, -0.2], f0: 40, f1: 40, sh: 0.012, name: 'Tangan Janitor mendekat' },
    { t0: 77.0, t1: 82.0, p0: [7.4, 0.95, -1.7], p1: [7.55, 0.9, -1.85], l0: [8.15, 0.88, -2.9], l1: [8.15, 0.88, -2.9], f0: 28, f1: 26, sh: 0.014, name: 'Kunci berputar' },
    { t0: 82.0, t1: 85.0, p0: [9.6, 1.1, -0.4], p1: [9.8, 1.2, 0.8], l0: [7.2, 1.1, -1.2], l1: [7.2, 1.1, -1.2], f0: 36, f1: 36, sh: 0.014, name: 'Tangan hampir meraih' },
    // ---- Scene 5 : The Last Escape ----
    { t0: 85.0, t1: 88.0, p0: [8.0, 1.1, 2.4], p1: [8.5, 1.25, 1.7], l0: [8.6, 1.2, -3.0], l1: [8.6, 1.2, -3.0], f0: 38, f1: 38, sh: 0.006, name: 'Pintu terbuka' },
    { t0: 88.0, t1: 91.5, p0: [8.6, 1.1, 1.2], p1: [8.6, 1.0, 0.5], l0: [8.6, 0.95, -4.5], l1: [8.6, 0.95, -4.5], f0: 36, f1: 36, sh: 0.006, name: 'Masuk ke elevator' },
    { t0: 91.5, t1: 96.0, p0: [7.2, 1.05, 0.9], p1: [7.0, 1.0, 0.3], l0: [8.6, 0.9, -3.8], l1: [8.6, 0.9, -3.8], f0: 34, f1: 34, sh: 0.008, name: 'Pintu menutup, tangan menyelinap' },
    { t0: 96.0, t1: 100.0, p0: [8.7, 0.85, -1.8], p1: [8.7, 0.9, -2.6], l0: [8.6, 0.85, -4.9], l1: [8.6, 0.85, -4.9], f0: 34, f1: 28, sh: 0.01, name: 'Mundur ketakutan' }
  ];

  function ev(v) { return typeof v === 'function' ? v() : v; }
  function shotAt(t) { for (var i = 0; i < SHOTS.length; i++) if (t < SHOTS[i].t1) return SHOTS[i]; return SHOTS[SHOTS.length - 1]; }


  function applyCamera(t) {
    var s = shotAt(t), u = sstep((t - s.t0) / (s.t1 - s.t0));
    var p0 = ev(s.p0), p1 = ev(s.p1), l0 = ev(s.l0), l1 = ev(s.l1);
    var eye = [lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u), lerp(p0[2], p1[2], u)];
    var look = [lerp(l0[0], l1[0], u), lerp(l0[1], l1[1], u), lerp(l0[2], l1[2], u)];
    var sh = s.sh || 0;                                   // getaran tangan (handheld)
    eye[0] += sh * Math.sin(t * 13.1) + sh * 0.6 * Math.sin(t * 29.7); eye[1] += sh * Math.sin(t * 11.3 + 1.0);
    look[0] += sh * 1.5 * Math.sin(t * 9.7 + 2.0); look[1] += sh * 1.5 * Math.sin(t * 8.9);
    return { eye: eye, look: look, fov: lerp(s.f0, s.f1, u), shot: s };
  }

  /* =======================================================
   *  OVERLAY: judul scene, teks cerita, fade
   * ======================================================= */
  var TITLES = [
    [0.4, 4.2, 'SCENE 1', 'A Dark Beginning'], [15.2, 19.0, 'SCENE 2', 'The Janitor Appears'], [35.2, 39.0, 'SCENE 3', 'The Distraction'],
    [60.2, 64.0, 'SCENE 4', 'The Chase'], [85.2, 89.0, 'SCENE 5', 'The Last Escape']
  ];
  var CAPTIONS = [
    [4.6, 9.5, 'Six berjalan perlahan sambil membawa lighter. Mono mengikuti dari belakang.'],
    [10.8, 14.9, 'Pintu besi terkunci. Lubang kunci itu menandakan mereka butuh kunci.'],
    [16.0, 21.5, 'Sebuah kunci tergeletak di atas meja penyimpanan.'],
    [23.0, 26.0, 'Terdengar suara langkah kaki...'],
    [26.5, 34.5, 'The Janitor muncul dari kegelapan. Six dan Mono bersembunyi di bawah meja.'],
    [36.0, 44.0, 'The Janitor mencari mereka dengan tangannya yang panjang.'],
    [44.2, 48.0, 'Mono melihat sebuah radio tua di sudut ruangan...'],
    [48.2, 55.0, 'Radio menyala. The Janitor bergerak menuju sumber suara.'],
    [55.2, 59.8, 'Six memanfaatkan kesempatan itu untuk mengambil kunci.'],
    [60.3, 64.0, 'Sesuatu jatuh dan menimbulkan suara keras!'],
    [64.2, 72.0, 'Mono menarik Six - mereka berlari menuju pintu besi.'],
    [72.2, 84.0, 'Six memasukkan kunci, sementara tangan The Janitor semakin mendekat.'],
    [85.4, 91.0, 'Pintu terbuka. Mereka masuk ke dalam elevator.'],
    [91.5, 99.0, 'Tangan The Janitor menyelinap lewat celah pintu...']
  ];
  function overlay(t) {
    var fade = 0;
    if (t < 1.2) fade = 1 - sstep(t / 1.2);
    if (t > 98.9) fade = sstep((t - 98.9) / 0.5);
    var title = null, caption = '';
    for (var i = 0; i < TITLES.length; i++) {
      var a = TITLES[i];
      if (t >= a[0] && t < a[1]) { title = { kicker: a[2], text: a[3], alpha: Math.min(sstep((t - a[0]) / 0.6), 1 - sstep((t - a[1] + 0.6) / 0.6)) }; }
    }
    for (var j = 0; j < CAPTIONS.length; j++) if (t >= CAPTIONS[j][0] && t < CAPTIONS[j][1]) caption = CAPTIONS[j][2];
    return { fade: fade, title: title, caption: caption };
  }

  /* =======================================================
   *  EVENT SUARA (sekali per lintasan waktu)
   * ======================================================= */
  var EVENTS = [
    [15.4, function () { sfx.zap(); }],
    [23.4, function () { sfx.click(0.6); }],
    [60.02, function () { sfx.crash(); }],
    [84.0, function () { sfx.unlock_door(); }],
    [84.7, function () { sfx.creak(3.6); }],
    [90.2, function () { sfx.rattle(); }],
    [93.0, function () { sfx.rattle(); }],
    [96.0, function () { sfx.rattle(); }],
    [99.4, function () { sfx.silence(); sfx.thud(); }]
  ];

  function stepSounds(t, playing) {
    if (!playing) return;
    var list = [['six', sixPath, 0.62, 'light', 0.9], ['mono', monoPath, 0.55, 'light', 0.7], ['jan', janPath, 1.0, 'heavy', 1.0]];
    list.forEach(function (it) {
      var key = it[0], path = it[1], idx = Math.floor(path.dist(t) / it[2] * 2);
      if (idx !== lastStep[key] && path.speed(t) > 0.25 && (key !== 'jan' || t > 21.5)) {
        var d = Math.hypot(camEye[0] - W_[key][0], camEye[1] - W_[key][1], camEye[2] - W_[key][2]);
        sfx.step(it[3], clamp(1.2 - d / 14, 0, 1) * it[4]);
      }
      lastStep[key] = idx;
    });
  }

  /* =======================================================
   *  UPDATE (waktu -> pose, props, lampu, kamera) & RENDER
   * ======================================================= */
  var cam = { eye: [0, 1, 5], look: [0, 1, 0], fov: 40 };
  var shadowQuad = Rn.mesh(GeoX.plane(2, 2, 0.5, 0.5));
  function update(t, playing, freeCam) {
    var ids = ['six', 'mono', 'jan'], paths = [sixPath, monoPath, janPath], yaws = [sixYaw, monoYaw, janYaw];
    for (var i = 0; i < 3; i++) {
      var p = paths[i].at(t), y = yaws[i].at(t), k = ids[i];
      P_[k] = p; M_[k] = actorMatrix(p, y, SCALE[k]);
      W_[k] = [p[0], k === 'six' ? 0.7 : (k === 'mono' ? 0.6 : 1.2), p[1]];
    }
    janVisible = t >= 22.0;
    poseSix(t); poseMono(t); poseJanitorBody(t); poseJanitorArms(t);
    updateProps(t); updateLights(t);

    if (playing) {
      for (var e = 0; e < EVENTS.length; e++) if (EVENTS[e][0] > lastEvt && EVENTS[e][0] <= t) EVENTS[e][1]();
      stepSounds(t, true); sfx.tick(t);
    } else {
      lastStep.six = Math.floor(sixPath.dist(t) / 0.62 * 2); lastStep.mono = Math.floor(monoPath.dist(t) / 0.55 * 2); lastStep.jan = Math.floor(janPath.dist(t) / 1.0 * 2);
    }
    lastEvt = t;
    sfx.radio(t >= RADIO_ON && t < 99.4);
    var c = freeCam ? null : applyCamera(t);
    if (c) { cam = c; camEye = c.eye; }
    return { cam: c, overlay: overlay(t), t: t };
  }

  var SH_UNDER = { x0: 1.1, x1: 4.5, z0: -2.3, z1: -1.1 };
  function drawBlob(x, z, rx, rz, a) {
    Rn.draw(shadowQuad, mul(LIBS.translation(x, 0.006, z), LIBS.scaling(rx, 1, rz)), { color: [0, 0, 0], tex: env.blobTex, unlit: true, alpha: a });
  }
  // dipanggil tiap frame oleh main.js setelah update()
  function render(view, proj, eye, exposure, t) {
    camEye = eye;
    Rn.beginFrame({
      view: view, proj: proj, eye: eye, exposure: exposure, ambient: frameLights.ambient, sky: [0.15, 0.15, 0.19], ground: [0.05, 0.04, 0.02],
      fogColor: [0.04, 0.035, 0.028], fogDensity: 0.07, points: frameLights.points, spot: frameLights.spot
    });
    env.drawOpaque();
    Rn.drawTree(sixRoot, M_.six); Rn.drawTree(monoRoot, M_.mono); if (janVisible) Rn.drawTree(janRoot, M_.jan);
    if (lighterOn) {
      var lm = mul(armRWorld, LIBS.translation(0, -0.5, 0.02));
      Rn.draw(lighterBody, mul(lm, LIBS.translation(0, -0.01, 0)), mLighter); Rn.draw(lighterCap, mul(lm, LIBS.translation(0, 0.038, 0)), mLighterCap);
    }
    // --- bayangan proyeksi planar dari lampu (stencil: tidak gelap ganda) ---
    var Lp, strength;
    if (lampK.table > 0.05) { Lp = env.lamps.table.pos; strength = 0.6 * Math.min(1, lampK.table); } else { Lp = env.lamps.mid.pos; strength = 0.45 * Math.min(1, lampK.mid); }
    Rn.beginShadows();
    ['six', 'mono', 'jan'].forEach(function (k) {
      if (k === 'jan' && !janVisible) return;
      var p = P_[k], under = p[0] > SH_UNDER.x0 && p[0] < SH_UNDER.x1 && p[1] > SH_UNDER.z0 && p[1] < SH_UNDER.z1;
      if (under || strength < 0.02) return;
      Rn.shadowDraw(k === 'six' ? sixRoot : (k === 'mono' ? monoRoot : janRoot), M_[k], Lp, 0.004, strength);
    });
    Rn.endShadows();
    // --- bayangan kontak lembut di kaki + kolong meja ---
    Rn.blendAlpha(true);
    drawBlob(P_.six[0], P_.six[1], 0.42, 0.42, 0.55); drawBlob(P_.mono[0], P_.mono[1], 0.38, 0.38, 0.55);
    if (janVisible) drawBlob(P_.jan[0], P_.jan[1], 0.75, 0.75, 0.6);
    drawBlob(env.table.x, env.table.z, 1.9, 0.8, 0.45);
    Rn.blendAlpha(false);
    // --- api lighter (unlit additive) ---
    if (flameK > 0.02) {
      Rn.blendAdd(true);
      var fk = flameK, fy = 1.7 + 0.5 * Math.sin(t * 31);
      Rn.draw(flameGeo, mul(LIBS.translation(flamePos[0], flamePos[1], flamePos[2]), LIBS.scaling(0.016 * fk, 0.02 * fy * fk, 0.016 * fk)), { color: [1, 0.62, 0.2], unlit: true, alpha: 0.9 });
      Rn.draw(flameGeo, mul(LIBS.translation(flamePos[0], flamePos[1] - 0.004, flamePos[2]), LIBS.scaling(0.009 * fk, 0.015 * fk, 0.009 * fk)), { color: [1, 0.95, 0.75], unlit: true, alpha: 0.95 });
      Rn.blendAdd(false);
    }
    Rn.drawPoints(env.dust, 26, [0.85, 0.8, 0.6], 0.45);
  }

  return { update: update, render: render, duration: DUR, shots: SHOTS, resetAudioClock: function (t) { lastEvt = t; } };
};
