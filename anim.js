/* =========================================================
 *  Anim.js  -  Timeline "Little Nightmares" (100 detik)
 *
 *  Scene 1  0:00-0:15  A Dark Beginning
 *  Scene 2  0:15-0:35  The Janitor Appears
 *  Scene 3  0:35-1:00  The Distraction
 *  Scene 4  1:00-1:25  The Chase
 *  Scene 5  1:25-1:40  The Last Escape
 *
 *  Arah hadap (yaw, radian):  E=+x  N=-z (dinding belakang)  W=-x  S=+z (kamera)
 *  Semua nilai animasi ada di blok "DATA TIMELINE" di bawah -> mudah diatur.
 * ========================================================= */
window.createAnimation = function (ctx) {
  var scene = ctx.scene, env = ctx.env, sfx = ctx.sfx;
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
   *  AKTOR
   * ======================================================= */
  var stage = new THREE.Group(); scene.add(stage);
  function makeActor(model, scl) { var g = new THREE.Group(); model.scale.setScalar(scl); g.add(model); stage.add(g); return g; }
  var sixM = ctx.six.group, sixRig = ctx.six.rig;
  var actorSix = makeActor(sixM, 0.78);
  var actorMono = makeActor(ctx.mono, 0.49);
  var actorJan = makeActor(ctx.jan, 0.95);
  var monoRig = ctx.mono.userData.rig, janRig = ctx.jan.userData.rig;
  [sixM, ctx.mono, ctx.jan].forEach(function (m) {
    m.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  });

  /* ---------------- props: lighter, kunci, kaleng ---------------- */
  var lighter = new THREE.Group();
  var lBody = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.075, 0.016), new THREE.MeshStandardMaterial({ color: 0x8a8d90, metalness: 0.8, roughness: 0.35 }));
  lBody.position.y = -0.01; lighter.add(lBody);
  var lCap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.02, 0.018), new THREE.MeshStandardMaterial({ color: 0x55575a, metalness: 0.8, roughness: 0.4 }));
  lCap.position.y = 0.038; lighter.add(lCap);
  lighter.position.set(0, -0.5, 0.02); lighter.rotation.x = Math.PI / 2 * 0.0;
  sixRig.groups.armR.add(lighter);

  var flame = new THREE.Group(); scene.add(flame);
  var flameMat = new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
  var flameMesh = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), flameMat);
  flameMesh.scale.set(0.8, 1.9, 0.8); flame.add(flameMesh);
  var flameCore = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.95, depthWrite: false }));
  flameCore.scale.set(0.8, 1.7, 0.8); flame.add(flameCore);
  var flameLight = new THREE.PointLight(0xff9a3c, 0, 6.5, 1.7); flame.add(flameLight);

  /* ---------------- lampu ---------------- */
  var amb = new THREE.AmbientLight(0x3a3426, 0.8); scene.add(amb);
  var hemi = new THREE.HemisphereLight(0x55556a, 0x1c150d, 0.45); scene.add(hemi);
  var rim = new THREE.DirectionalLight(0x6c7a99, 0.35); rim.position.set(-6, 8, 8); scene.add(rim);
  function pointLamp(lamp, color, dist) { var l = new THREE.PointLight(color, 0, dist, 1.6); l.position.copy(lamp.pos); scene.add(l); return l; }
  var lightLeft = pointLamp(env.lamps.left, 0xffd08a, 11);
  var lightMid = pointLamp(env.lamps.mid, 0xffd9a0, 11);
  var lightDoor = pointLamp(env.lamps.door, 0xffcf90, 10);
  var spot = new THREE.SpotLight(0xffddaa, 0, 11, 0.95, 0.75, 1.4);
  spot.position.copy(env.lamps.table.pos); spot.target.position.set(env.table.x, 0.3, env.table.z + 0.4);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0006; spot.shadow.normalBias = 0.03;
  scene.add(spot); scene.add(spot.target);

  function flick(t, seed, amt) {                 // 1 = terang penuh; amt = seberapa parah berkedip
    var slot = Math.floor(t * 11 + seed * 7), r = hash(slot + seed);
    var dip = r > 0.8 ? 0.08 + 0.5 * hash(slot * 3.3 + seed) : 1;
    var micro = 0.9 + 0.1 * Math.sin(t * 53 + seed * 3) * Math.sin(t * 19.7);
    return 1 - amt * (1 - dip * micro);
  }
  function setBulb(lamp, k) { lamp.bulbMat.emissiveIntensity = 2.4 * k; }

  /* ---------------- keadaan runtime ---------------- */
  var W_ = { six: new THREE.Vector3(), mono: new THREE.Vector3(), jan: new THREE.Vector3() };
  var tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(),
    tmpE = new THREE.Euler(), tmpM = new THREE.Matrix4(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  var lastStep = { six: 0, mono: 0, jan: 0 }, lastEvt = 0, evtDone = {};

  /* =======================================================
   *  POSE: SIX  (Euler per node; rig.nodes.<n>.r = [x, y, z])
   * ======================================================= */
  function poseSix(t) {
    var R = sixRig, Nn = R.nodes;
    R.reset();
    var sp = sixPath.speed(t), a = clamp(sp / 0.6, 0, 1), run = clamp((sp - 1.3) / 0.5, 0, 1);
    var c = sixCrouch.at(t), ph = sixPath.dist(t) / 0.62 * TAU, sw = Math.sin(ph);
    var s = sixScared.at(t), tr = (hash(Math.floor(t * 30)) - 0.5) * 0.03 * s;

    var lean = 0.05 * a + 0.20 * run + 0.42 * c;
    var amp = (0.30 + 0.38 * run) * a * (1 - 0.65 * c);
    var thL = -1.15 * c + sw * amp, thR = -1.15 * c - sw * amp;          // sudut kaki di dunia
    Nn.legL.r[0] = thL - lean; Nn.legR.r[0] = thR - lean;
    var D = 0.6 * (1 - Math.cos(Math.max(Math.abs(thL), Math.abs(thR))));
    var H = 0.62;
    Nn.six.r[0] = lean;
    Nn.six.t = [0, H * (1 - Math.cos(lean)) - D, -H * Math.sin(lean)];
    Nn.six.s[1] = 1 + 0.008 * Math.sin(t * 1.8);

    // lengan kiri: ayun / meraih kunci
    var swArm = -sw * 0.45 * a * (1 - c);
    var reachL = sixReachL.at(t);
    var armLx = lerp(-0.06 + swArm - 0.5 * c - 0.6 * s, -2.35, reachL);
    Nn.armL.r[0] = armLx + tr; Nn.armL.r[2] = lerp(0.17 + 0.2 * s, 0.02, reachL);
    // lengan kanan: memegang lighter
    var up = sixArmRUp.at(t);
    var armRx = lerp(-0.06 - swArm - 0.5 * c - 0.6 * s, -1.15 - 0.05 * Math.sin(t * 2.1), up);
    Nn.armR.r[0] = armRx - tr; Nn.armR.r[2] = lerp(-0.17 - 0.2 * s, -0.12, up);

    Nn.head.r[1] = sixHeadYaw.at(t) + tr * 2;
    Nn.head.r[0] = sixHeadPitch.at(t) - 0.55 * lean;
    Nn.hood.r[2] += 0.03 * Math.sin(t * 0.9 + 0.5) + tr;
    R.sync();
  }

  /* =======================================================
   *  POSE: MONO  (Three.Group per bagian, rotation langsung)
   * ======================================================= */
  function poseMono(t) {
    var R = monoRig;
    var sp = monoPath.speed(t), a = clamp(sp / 0.6, 0, 1), run = clamp((sp - 1.25) / 0.5, 0, 1);
    var c = monoCrouch.at(t), ph = monoPath.dist(t) / 0.55 * TAU, sw = Math.sin(ph);
    var s = monoScared.at(t), tr = (hash(Math.floor(t * 30) + 9) - 0.5) * 0.04 * s;

    var lean = 0.05 * a + 0.16 * run + 0.38 * c;
    var amp = (0.42 + 0.32 * run) * a * (1 - 0.6 * c);
    var thP = -1.1 * c + sw * amp, thN = -1.1 * c - sw * amp;
    var D = 0.9 * (1 - Math.cos(Math.max(Math.abs(thP), Math.abs(thN))));
    var H = 0.9;
    R.hips.rotation.set(lean, 0, 0);
    R.hips.position.set(0, H * (1 - Math.cos(lean)) - D, -H * Math.sin(lean));
    R.legP.rotation.x = thP; R.legN.rotation.x = thN;
    R.legP.position.y = 0.9 - D; R.legN.position.y = 0.9 - D;

    var pull = monoPull.at(t), reach = monoReach.at(t);
    // lengan P: meraih radio / menarik Six ; lengan N: ayun
    var armPx = lerp(-sw * 0.5 * a * (1 - c) - 0.8 * s * 0.5, -0.9, reach);
    armPx = lerp(armPx, -1.25, pull);
    R.armP.rotation.set(armPx + tr - lean * 0.3, 0, lerp(0, -0.1, pull));
    var armNx = sw * 0.5 * a * (1 - c) - 0.8 * s * 0.5;
    R.armN.rotation.set(armNx - tr - lean * 0.3, 0, 0);
    R.head.rotation.set(-0.6 * lean + 0.05 * Math.sin(t * 1.3), monoHeadYaw.at(t) + tr * 2, 0);
    if (R.cape) R.cape.rotation.x = 0.12 + 0.10 * a + 0.25 * run + 0.02 * Math.sin(t * 2.2);
  }

  /* =======================================================
   *  POSE: THE JANITOR
   *  Badan/kaki memakai Euler; lengan panjang di-aim (IK sederhana):
   *  lengan diregangkan pada sumbu-y lalu diputar agar ujungnya menuju target.
   * ======================================================= */
  var JN = janRig.nodes;
  var bodyG = janRig.groups.body;

  function aimArm(S, Tl, qOut) {                  // Tl = target di ruang lokal badan (satuan model)
    tmpP.set(S * 0.22, 1.27, 0);
    tmpV.copy(Tl).sub(tmpP);
    var L = Math.max(tmpV.length() - 0.28, 1.38);
    var sy = clamp(Math.sqrt(Math.max(L * L - 0.5956, 1.2769)) / 1.13, 1.0, 5.0);
    tmpV2.set(S * 0.40, -1.13 * sy, 0.66).normalize();
    qOut.setFromUnitVectors(tmpV2, tmpV.normalize());
    return sy;
  }
  var DOOR_R = [[88.0, 8.2, 0.9, -2.6], [91.0, 8.5, 0.9, -3.0], [93.5, 8.5, 0.9, -3.4], [95.5, 8.65, 0.85, -4.0], [97.5, 8.75, 0.85, -4.5], [99.4, 8.75, 0.85, -4.85]];
  var DOOR_L = [[88.0, 7.7, 1.1, -2.4], [92.0, 7.75, 1.4, -3.0], [99.5, 7.75, 1.45, -3.1]];
  function keyPoint(list, t, out) {
    var n = list.length;
    if (t <= list[0][0]) return out.set(list[0][1], list[0][2], list[0][3]);
    if (t >= list[n - 1][0]) return out.set(list[n - 1][1], list[n - 1][2], list[n - 1][3]);
    for (var i = 1; i < n; i++) if (t < list[i][0]) {
      var a = list[i - 1], b = list[i], u = sstep((t - a[0]) / (b[0] - a[0]));
      return out.set(lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u));
    }
  }

  var sixChest = new THREE.Vector3(), shW = new THREE.Vector3(), tipW = new THREE.Vector3(), tipW2 = new THREE.Vector3(), tl = new THREE.Vector3();
  var qHang = new THREE.Quaternion(), qS = new THREE.Quaternion(), qR = new THREE.Quaternion();

  function poseJanitorBody(t) {
    var R = janRig;
    R.reset();
    var sp = janPath.speed(t), a = clamp(sp / 0.45, 0, 1);
    var ph = janPath.dist(t) / 1.0 * TAU, sw = Math.sin(ph);
    var lean = janLean.at(t) + 0.03 * a;
    var thw = 0.40 * sw * a;
    JN.legL.rotation[0] = thw; JN.legR.rotation[0] = -thw;
    JN.root.position = [0, -0.5 * (1 - Math.cos(thw)) + 0.02 * Math.abs(Math.cos(ph)) * a, 0];
    var H = 0.55;
    JN.body.rotation = [lean, 0, 0.05 * Math.sin(ph) * a];
    JN.body.position = [0, H * (1 - Math.cos(lean)), -H * Math.sin(lean)];
    JN.head.rotation = [JN.head.rotation[0] + janHeadPitch.at(t) - 0.5 * lean, janHeadYaw.at(t) + 0.12 * Math.sin(t * 0.7) * (1 - a), 0.04 * Math.sin(t * 0.5)];
    R.sync();
  }
  function poseJanitorArms(t) {
    var sp = janPath.speed(t), a = clamp(sp / 0.45, 0, 1), ph = janPath.dist(t) / 1.0 * TAU;
    var wSearch = janSearch.at(t), wReach = janReach.at(t), wDoor = janDoor.at(t);
    var cs = Math.cos(actorJan.rotation.y), sn = Math.sin(actorJan.rotation.y);
    [-1, 1].forEach(function (S_) {
      var grp = janRig.groups[S_ < 0 ? 'armL' : 'armR'];
      // 1) menggantung / diseret, sedikit mengayun
      tmpE.set(0.16 * Math.sin(ph + (S_ > 0 ? 0 : Math.PI)) * a + 0.03 * Math.sin(t * 0.8 + S_), 0, S_ * 0.03);
      qHang.setFromEuler(tmpE);
      var sy = 1.08;
      var q = tmpQ.copy(qHang);
      // 2) menyapu lantai
      if (wSearch > 0.001) {
        var ps = t * 0.9 + (S_ > 0 ? 0 : 2.2);
        tl.set(S_ * (0.30 + 0.60 * Math.sin(ps * 0.8)), 0.08 + 0.30 * Math.max(0, Math.sin(ps * 0.55)), 0.8 + 1.5 * (0.5 + 0.5 * Math.sin(ps)));
        var sy1 = aimArm(S_, tl, qS);
        q.slerp(qS, wSearch); sy = lerp(sy, sy1, wSearch);
      }
      // 3) meraih (mengejar Six / celah pintu lift)
      if (wReach > 0.001) {
        tmpP.set(S_ * 0.22, 1.27, 0); shW.copy(tmpP); bodyG.localToWorld(shW);
        // target kejar: dada Six, dibatasi panjang jangkauan L(t)
        sixChest.set(W_.six.x, 0.62 + 0.0, W_.six.z);
        tmpV.copy(sixChest).sub(shW);
        var dist = tmpV.length(), Lm = Math.min(janReachLen.at(t), dist);
        tipW.copy(shW).addScaledVector(tmpV.normalize(), Lm);
        tipW.x += 0.18 * S_ * Math.sin(t * 2.3 + S_); tipW.y += 0.06 * Math.sin(t * 3.1 + S_ * 2);
        // target pintu lift (setelah t ~ 88)
        if (wDoor > 0.001) {
          keyPoint(S_ < 0 ? DOOR_R : DOOR_L, t, tipW2);
          tipW.lerp(tipW2, wDoor);
        }
        tl.copy(tipW); bodyG.worldToLocal(tl);
        var sy2 = aimArm(S_, tl, qR);
        q.slerp(qR, wReach); sy = lerp(sy, sy2, wReach);
      }
      tmpP.set(S_ * 0.22, 1.27, 0);
      tmpM.compose(tmpP, q, tmpS.set(1, sy, 1));
      grp.matrix.copy(tmpM); grp.matrixWorldNeedsUpdate = true;
    });
  }

  /* =======================================================
   *  PROPS per frame
   * ======================================================= */
  var handW = new THREE.Vector3(), keyQ = new THREE.Quaternion(), holdQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), tmpQw = new THREE.Quaternion();
  var keyTableQ = new THREE.Quaternion().setFromEuler(env.key.rotation.clone ? env.key.rotation.clone() : new THREE.Euler(0, 0.4, Math.PI / 2));

  function updateProps(t) {
    /* lighter + api */
    var fl = sixFlame.at(t), fk = flick(t, 5.0, 0.35);
    lighter.visible = sixArmRUp.at(t) > 0.05;
    handW.set(0, -0.56, 0.02); sixRig.groups.armR.localToWorld(handW);
    flame.position.set(handW.x, handW.y + 0.045, handW.z);
    flame.visible = fl > 0.02;
    flameMesh.scale.set(0.8 * fl, (1.7 + 0.5 * Math.sin(t * 31)) * fl, 0.8 * fl);
    flameCore.scale.set(0.8 * fl, 1.5 * fl, 0.8 * fl);
    flameLight.intensity = 2.0 * fl * (0.75 + 0.25 * Math.sin(t * 27) * Math.sin(t * 13.1)) * fk;
    flameLight.position.set(0, 0.05, 0.05);

    /* kunci */
    var key = env.key;
    sixRig.groups.armL.updateWorldMatrix(true, false);
    handW.set(0, -0.52, 0.02); sixRig.groups.armL.localToWorld(handW);
    sixRig.groups.armL.getWorldQuaternion(tmpQw);
    keyQ.copy(tmpQw).multiply(holdQ);
    if (t < KEY_GRAB) { key.position.copy(env.keyTable); key.quaternion.copy(keyTableQ); }
    else if (t < KEY_HELD) {
      var u = sstep((t - KEY_GRAB) / (KEY_HELD - KEY_GRAB));
      key.position.copy(env.keyTable).lerp(handW, u); key.quaternion.copy(keyTableQ).slerp(keyQ, u);
    } else { key.position.copy(handW); key.quaternion.copy(keyQ); }
    // gemetar saat mencoba memasukkan kunci
    if (t > 66.5 && t < 84.0) { key.position.x += 0.004 * Math.sin(t * 40); key.position.y += 0.003 * Math.sin(t * 33); }

    /* kaleng */
    var can = env.can, s0 = env.canStart;
    if (t < CAN_T0) { can.position.copy(s0); can.rotation.set(0, 0, 0); }
    else if (t < CAN_T0 + CAN_FALL) {
      var tau = t - CAN_T0, u2 = tau / CAN_FALL;
      can.position.set(s0.x + 0.30 * u2, s0.y - (s0.y - 0.07) * u2 * u2, s0.z + 0.45 * u2);
      can.rotation.set(0.6 * tau * 6, 0, 1.2 * u2 * Math.PI / 2);
    } else {                                      // menggelinding ke arah kamera
      var r = t - (CAN_T0 + CAN_FALL), v = Math.max(0, 1 - r / 1.8);
      var travel = 0.9 * (1 - v * v);
      can.position.set(s0.x + 0.30, 0.07, s0.z + 0.45 + travel);
      can.rotation.set(-travel / 0.07, 0, Math.PI / 2);
    }

    /* radio */
    var on = t >= RADIO_ON ? 1 : 0, pulse = on ? 0.75 + 0.25 * Math.sin(t * 9) * Math.sin(t * 5.3) : 0;
    env.radio.light.intensity = 1.1 * on * pulse * (on ? flick(t, 8.0, 0.2) : 1);
    env.radio.dialMat.emissiveIntensity = 1.8 * on * pulse;
    env.radio.grilleMat.emissive.setRGB(0.25 * on * pulse, 0.17 * on * pulse, 0.05 * on * pulse);

    /* pintu & jeruji lift */
    env.leafPivot.rotation.y = doorAngle.at(t);
    var gs = gateScale.at(t); env.gateL.scale.x = gs; env.gateR.scale.x = gs;
    var open = sstep((t - 84.6) / 2.0);
    env.cabinLight.intensity = 1.6 * sstep((t - 84.8) / 1.5) * (t > 98.6 ? flick(t, 4.0, 0.7) : 1);
    env.cabLampMat.emissiveIntensity = 2.0 * open;
    // lampu kunci: merah berkedip -> hijau saat dibuka
    var unlocked = t >= UNLOCK_T;
    var blink = unlocked ? 1 : (0.55 + 0.45 * Math.sin(t * 5.0));
    env.lockBulbMat.emissive.setRGB(unlocked ? 0.1 : 1, unlocked ? 1 : 0.15, unlocked ? 0.2 : 0.06);
    env.lockBulbMat.emissiveIntensity = 1.6 * blink;
    env.lockLight.color.setRGB(unlocked ? 0.2 : 1, unlocked ? 1 : 0.2, unlocked ? 0.3 : 0.1);
    env.lockLight.intensity = 0.9 * blink;
  }

  /* lampu ruangan */
  function updateLights(t) {
    // kedipan: parah di Scene 1, makin parah setelah kaleng jatuh
    var f1 = t < 15 ? 0.85 : 0.3;
    var chaos = t > 60 && t < 99.4 ? 0.55 : 0;
    var kL = flick(t, 1.0, Math.max(f1, chaos)), kM = flick(t, 2.0, t < 15 ? 0.6 : Math.max(0.3, chaos)),
      kD = flick(t, 3.0, Math.max(0.25, chaos));
    var midDim = 1 - 0.7 * sstep((t - 23.5) / 1.0) * (1 - sstep((t - 85) / 1)) ;   // koridor menggelap saat Janitor muncul
    lightLeft.intensity = 1.5 * kL; setBulb(env.lamps.left, kL);
    lightMid.intensity = 1.8 * kM * midDim; setBulb(env.lamps.mid, kM * midDim);
    lightDoor.intensity = 1.3 * kD; setBulb(env.lamps.door, kD);
    // lampu meja menyala pada 0:15 (Scene 2) dengan kedipan
    var on = t >= 15.4 ? 1 : 0;
    var amt = t < 17.5 ? 1.0 : (t > 22.5 && t < 26 ? 0.8 : (chaos ? 0.55 : 0.18));
    var kT = flick(t, 6.0, amt) * on;
    spot.intensity = 5.0 * kT; setBulb(env.lamps.table, kT);
    // kabin gelap sebelum terbuka -> sudah diatur di updateProps
    env.updateDust(t);
    amb.intensity = 0.8;
  }

  /* =======================================================
   *  KAMERA (shot list)
   *  p/l bisa array [x,y,z] atau fungsi () => [x,y,z] (untuk mengikuti karakter)
   * ======================================================= */
  function Wp(k, dx, dy, dz) { return function () { var v = W_[k]; return [v.x + (dx || 0), v.y + (dy || 0), v.z + (dz || 0)]; }; }
  function Mid(a, b, dy) { return function () { return [(W_[a].x + W_[b].x) / 2, (W_[a].y + W_[b].y) / 2 + (dy || 0), (W_[a].z + W_[b].z) / 2]; }; }
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

  var camP = new THREE.Vector3(), camL = new THREE.Vector3();
  function applyCamera(t, camera) {
    var s = shotAt(t), u = sstep((t - s.t0) / (s.t1 - s.t0));
    var p0 = ev(s.p0), p1 = ev(s.p1), l0 = ev(s.l0), l1 = ev(s.l1);
    camP.set(lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u), lerp(p0[2], p1[2], u));
    camL.set(lerp(l0[0], l1[0], u), lerp(l0[1], l1[1], u), lerp(l0[2], l1[2], u));
    // getaran tangan (handheld)
    var sh = s.sh || 0;
    camP.x += sh * Math.sin(t * 13.1) + sh * 0.6 * Math.sin(t * 29.7);
    camP.y += sh * Math.sin(t * 11.3 + 1.0);
    camL.x += sh * 1.5 * Math.sin(t * 9.7 + 2.0); camL.y += sh * 1.5 * Math.sin(t * 8.9);
    camera.position.copy(camP); camera.lookAt(camL);
    var fov = lerp(s.f0, s.f1, u);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    return s;
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

  function stepSounds(t, playing, camera) {
    if (!playing) return;
    var list = [['six', sixPath, 0.62, 'light', 0.9], ['mono', monoPath, 0.55, 'light', 0.7], ['jan', janPath, 1.0, 'heavy', 1.0]];
    list.forEach(function (it) {
      var key = it[0], path = it[1], idx = Math.floor(path.dist(t) / it[2] * 2);
      if (idx !== lastStep[key] && path.speed(t) > 0.25) {
        if (key !== 'jan' || t > 21.5) {
          var d = camera.position.distanceTo(W_[key]);
          var vol = clamp(1.2 - d / 14, 0, 1) * it[4];
          sfx.step(it[3], vol);
        }
      }
      lastStep[key] = idx;
    });
  }

  /* =======================================================
   *  UPDATE UTAMA
   * ======================================================= */
  function update(t, playing, camera, freeCam) {
    // posisi aktor
    var p = sixPath.at(t); actorSix.position.set(p[0], 0, p[1]); actorSix.rotation.y = sixYaw.at(t);
    p = monoPath.at(t); actorMono.position.set(p[0], 0, p[1]); actorMono.rotation.y = monoYaw.at(t);
    p = janPath.at(t); actorJan.position.set(p[0], 0, p[1]); actorJan.rotation.y = janYaw.at(t);
    actorJan.visible = t >= 22.0;
    W_.six.set(actorSix.position.x, 0.7, actorSix.position.z);
    W_.mono.set(actorMono.position.x, 0.6, actorMono.position.z);
    W_.jan.set(actorJan.position.x, 1.2, actorJan.position.z);

    poseSix(t); poseMono(t); poseJanitorBody(t);
    stage.updateMatrixWorld(true);                 // matriks dunia terbaru (dibutuhkan IK lengan & posisi tangan)
    poseJanitorArms(t);
    updateProps(t);
    updateLights(t);

    // efek suara berbasis peristiwa & langkah
    if (playing) {
      for (var i = 0; i < EVENTS.length; i++) {
        var e = EVENTS[i];
        if (e[0] > lastEvt && e[0] <= t) e[1]();
      }
      stepSounds(t, true, camera);
      sfx.tick(t);
    } else {
      lastStep.six = Math.floor(sixPath.dist(t) / 0.62 * 2); lastStep.mono = Math.floor(monoPath.dist(t) / 0.55 * 2); lastStep.jan = Math.floor(janPath.dist(t) / 1.0 * 2);
    }
    lastEvt = t;
    sfx.radio(t >= RADIO_ON && t < 99.4);

    var shot = freeCam ? null : applyCamera(t, camera);
    return { shot: shot, overlay: overlay(t) };
  }

  return { update: update, duration: DUR, shots: SHOTS, overlay: overlay, resetAudioClock: function (t) { lastEvt = t; } };
};
