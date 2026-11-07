/* =========================================================
 *  Env.js  -  Environment "The Maw" (gaya Little Nightmares)
 *  Semua geometri dibuat dari primitif THREE + tekstur canvas prosedural.
 *
 *  Tata letak dunia (satuan meter; kamera melihat dari +Z ke arah -Z):
 *    - lantai y = 0, dinding belakang di z = -3, langit-langit y = 4.6
 *    - meja penyimpanan   : pusat (2.8, -1.7),  permukaan y = 1.15
 *    - radio tua          : (-1.9, -2.5)   (di pojok kiri)
 *    - pintu besi + lift  : x = 7.6 .. 9.6 pada dinding belakang
 * ========================================================= */
window.createLNEnvironment = function () {
  var root = new THREE.Group();
  var seed = 1234567;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

  /* ---------- helper tekstur & material ---------- */
  function canvasTex(w, h, draw, rx, ry) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  }
  function speckle(g, w, h, n, a) {
    for (var i = 0; i < n; i++) {
      var v = Math.floor(rnd() * 90);
      g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + a + ')';
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  }
  function stains(g, w, h, n) {
    for (var i = 0; i < n; i++) {
      var x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 90;
      var gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(12,9,4,' + (0.10 + rnd() * 0.18) + ')');
      gr.addColorStop(1, 'rgba(12,9,4,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  function M(color, rough, metal, extra) {
    var o = { color: color, roughness: rough === undefined ? 0.9 : rough, metalness: metal || 0 };
    if (extra) for (var k in extra) o[k] = extra[k];
    return new THREE.MeshStandardMaterial(o);
  }
  function mesh(geo, mat, x, y, z, parent) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    (parent || root).add(m);
    return m;
  }
  function box(w, h, d, mat, x, y, z, parent) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent); }
  function cyl(rt, rb, h, seg, mat, x, y, z, parent) { return mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat, x, y, z, parent); }

  /* ---------- tekstur ---------- */
  var wallTex = canvasTex(512, 512, function (g, w, h) {
    g.fillStyle = '#4b4837'; g.fillRect(0, 0, w, h);
    var gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // ubin kotor di separuh bawah dinding
    g.strokeStyle = 'rgba(14,12,8,0.6)'; g.lineWidth = 3;
    for (var y = h * 0.42; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (var x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, h * 0.42); g.lineTo(x, h); g.stroke(); }
    // garis pembatas ubin
    g.fillStyle = '#2b2a20'; g.fillRect(0, h * 0.42 - 6, w, 8);
    stains(g, w, h, 46); speckle(g, w, h, 4500, 0.14);
    // bekas bocor vertikal
    for (var i = 0; i < 9; i++) {
      var sx = rnd() * w, sl = 80 + rnd() * 240;
      var lg = g.createLinearGradient(0, 0, 0, sl);
      lg.addColorStop(0, 'rgba(10,8,3,0.28)'); lg.addColorStop(1, 'rgba(10,8,3,0)');
      g.save(); g.translate(sx, 0); g.fillStyle = lg; g.fillRect(0, 0, 6 + rnd() * 10, sl); g.restore();
    }
  }, 11, 1);

  var floorTex = canvasTex(512, 512, function (g, w, h) {
    var ph = 64;
    for (var i = 0; i < h / ph; i++) {
      var v = 38 + Math.floor(rnd() * 22);
      g.fillStyle = 'rgb(' + (v + 16) + ',' + (v + 6) + ',' + (v - 6) + ')';
      g.fillRect(0, i * ph, w, ph);
      for (var k = 0; k < 14; k++) {  // serat kayu
        g.strokeStyle = 'rgba(10,6,2,' + (0.1 + rnd() * 0.2) + ')'; g.lineWidth = 1;
        var yy = i * ph + 4 + rnd() * (ph - 8);
        g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + rnd() * 6 - 3, w * 0.6, yy + rnd() * 6 - 3, w, yy); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(0, i * ph, w, 3);          // celah antar papan
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(rnd() * w, i * ph, 3, ph);  // sambungan papan
    }
    stains(g, w, h, 30); speckle(g, w, h, 4000, 0.18);
  }, 14, 4);

  var doorTex = canvasTex(256, 512, function (g, w, h) {
    g.fillStyle = '#4a4238'; g.fillRect(0, 0, w, h);
    stains(g, w, h, 34); speckle(g, w, h, 3000, 0.2);
    for (var i = 0; i < 40; i++) {            // karat
      var x = rnd() * w, y = rnd() * h, r = 8 + rnd() * 36;
      var gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(120,64,28,0.32)'); gr.addColorStop(1, 'rgba(120,64,28,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.strokeStyle = 'rgba(15,12,9,0.8)'; g.lineWidth = 6;            // panel & palang
    g.strokeRect(14, 14, w - 28, h - 28);
    [h * 0.33, h * 0.66].forEach(function (y) { g.beginPath(); g.moveTo(14, y); g.lineTo(w - 14, y); g.stroke(); });
    g.fillStyle = 'rgba(25,20,15,0.95)';                             // paku keling
    for (var rx = 28; rx < w; rx += 50) for (var ry = 28; ry < h; ry += 56) { g.beginPath(); g.arc(rx, ry, 4, 0, 6.3); g.fill(); }
  }, 1, 1);

  var plateTex = canvasTex(256, 384, function (g, w, h) {
    g.fillStyle = '#2d2a26'; g.fillRect(0, 0, w, h);
    stains(g, w, h, 10); speckle(g, w, h, 1500, 0.2);
    g.strokeStyle = '#17140f'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    // simbol kunci (tanda "butuh kunci")
    g.strokeStyle = '#d9972a'; g.fillStyle = '#d9972a'; g.lineWidth = 14; g.lineCap = 'round';
    g.beginPath(); g.arc(w / 2, 82, 30, 0, 6.3); g.stroke();
    g.beginPath(); g.moveTo(w / 2, 112); g.lineTo(w / 2, 208); g.stroke();
    g.lineWidth = 12; g.beginPath(); g.moveTo(w / 2, 160); g.lineTo(w / 2 + 28, 160); g.moveTo(w / 2, 190); g.lineTo(w / 2 + 22, 190); g.stroke();
    // lubang kunci
    g.fillStyle = '#050403';
    g.beginPath(); g.arc(w / 2, 280, 20, 0, 6.3); g.fill();
    g.beginPath(); g.moveTo(w / 2 - 10, 288); g.lineTo(w / 2 + 10, 288); g.lineTo(w / 2 + 15, 344); g.lineTo(w / 2 - 15, 344); g.closePath(); g.fill();
  }, 1, 1);

  var cabinTex = canvasTex(256, 256, function (g, w, h) {
    g.fillStyle = '#6b6650'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(20,18,10,0.5)'; g.lineWidth = 4;
    for (var x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    stains(g, w, h, 14); speckle(g, w, h, 1800, 0.15);
  }, 2, 2);

  var grilleTex = canvasTex(128, 128, function (g, w, h) {
    g.fillStyle = '#2a1d12'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#0c0805'; g.lineWidth = 3;
    for (var y = 8; y < h; y += 9) { g.beginPath(); g.moveTo(8, y); g.lineTo(w - 8, y); g.stroke(); }
  }, 1, 1);

  /* ---------- material umum ---------- */
  var mWall = M(0xffffff, 0.95, 0, { map: wallTex });
  var mFloor = M(0xffffff, 0.85, 0, { map: floorTex });
  var mDark = M(0x1b1815, 0.95);
  var mWood = M(0x3a2a1c, 0.85);
  var mWoodLt = M(0x5a4430, 0.8);
  var mRust = M(0x4a3426, 0.65, 0.5);
  var mMetal = M(0x55575a, 0.5, 0.7);
  var mDoor = M(0xffffff, 0.6, 0.55, { map: doorTex });

  /* ---------- lantai, dinding, langit-langit ---------- */
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 14), mFloor);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 4); floor.receiveShadow = true; root.add(floor);

  // dinding belakang tebal 0.3 (z -3.3 .. -3.0) dengan ambang pintu x 7.6 .. 9.6
  box(29.6, 4.6, 0.3, mWall, -7.2, 2.3, -3.15);               // kiri  (x -22 .. 7.6)
  box(12.4, 4.6, 0.3, mWall, 15.8, 2.3, -3.15);               // kanan (x 9.6 .. 22)
  box(2.0, 1.6, 0.3, mWall, 8.6, 3.8, -3.15);                 // di atas pintu
  // bingkai pintu
  box(0.14, 3.0, 0.36, mDark, 7.55, 1.5, -3.15);
  box(0.14, 3.0, 0.36, mDark, 9.65, 1.5, -3.15);
  box(2.24, 0.14, 0.36, mDark, 8.6, 3.03, -3.15);
  // langit-langit & balok
  var ceil = new THREE.Mesh(new THREE.PlaneGeometry(44, 14), M(0x14120f, 1));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.6, 4); root.add(ceil);
  for (var bx = -21; bx <= 21; bx += 3) box(0.3, 0.32, 14, mDark, bx, 4.44, 4);
  // pipa besar sepanjang lorong
  var p1 = cyl(0.26, 0.26, 44, 24, mRust, 0, 3.95, -2.5); p1.rotation.z = Math.PI / 2;
  var p2 = cyl(0.12, 0.12, 44, 16, mRust, 0, 3.35, -2.75); p2.rotation.z = Math.PI / 2;
  var p3 = cyl(0.09, 0.09, 44, 16, mMetal, 0, 2.7, -2.85); p3.rotation.z = Math.PI / 2;
  for (var pj = -20; pj <= 20; pj += 4) {                     // sambungan pipa
    var ring = cyl(0.31, 0.31, 0.14, 24, mDark, pj, 3.95, -2.5); ring.rotation.z = Math.PI / 2;
  }
  // pipa vertikal + katup
  [-9.5, -2.5, 12.5].forEach(function (px) {
    cyl(0.15, 0.15, 4.6, 16, mRust, px, 2.3, -2.7);
    var v = cyl(0.14, 0.14, 0.1, 16, mDark, px, 1.5, -2.55); v.rotation.x = Math.PI / 2;
    var wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 20), mMetal);
    wheel.position.set(px, 1.5, -2.45); root.add(wheel);
  });

  /* ---------- perabot latar: rak, tong, peti ---------- */
  function shelf(x0, n) {
    for (var s = 0; s < 3; s++) {
      var y = 0.75 + s * 0.85;
      box(n * 1.0, 0.07, 0.5, mWood, x0 + n * 0.5, y, -2.7);
      for (var j = 0; j < n * 3; j++) {
        var h = 0.16 + rnd() * 0.22;
        var jar = cyl(0.07, 0.07, h, 12, M(rnd() < 0.5 ? 0x4a5a3a : 0x5a4a2a, 0.4, 0.1, { transparent: true, opacity: 0.85 }),
          x0 + 0.2 + j * (n * 1.0 - 0.3) / (n * 3), y + 0.035 + h / 2, -2.7 + (rnd() - 0.5) * 0.2);
        jar.castShadow = true;
      }
    }
    box(0.08, 2.5, 0.5, mWood, x0 + 0.02, 1.25, -2.7);
    box(0.08, 2.5, 0.5, mWood, x0 + n - 0.02, 1.25, -2.7);
  }
  shelf(-9.5, 3); shelf(12.0, 3); shelf(-15.5, 4);
  function barrel(x, z) { cyl(0.38, 0.34, 0.95, 20, M(0x3b2f22, 0.8), x, 0.475, z); var b = cyl(0.385, 0.385, 0.05, 20, mMetal, x, 0.3, z); b.castShadow = false; var b2 = cyl(0.385, 0.385, 0.05, 20, mMetal, x, 0.7, z); b2.castShadow = false; }
  barrel(-4.4, -2.4); barrel(-3.7, -2.55); barrel(11.9, -1.9); barrel(-12, -2.3);
  function crate(x, y, z, s, ry) { var c = box(s, s, s, mWoodLt, x, y + s / 2, z); c.rotation.y = ry || 0; return c; }
  crate(-6.2, 0, -2.3, 0.8, 0.1); crate(-6.2, 0.8, -2.35, 0.7, -0.2); crate(-5.4, 0, -2.4, 0.6, 0.3);
  crate(11.0, 0, -2.4, 0.7, 0.2); crate(-11, 0, -2.2, 0.9, 0.15);

  // rantai & kait menggantung (nuansa The Maw)
  function chain(x, z, len) {
    for (var i = 0; i < len; i++) {
      var link = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), mMetal);
      link.position.set(x, 4.5 - i * 0.1, z); link.rotation.y = (i % 2) * Math.PI / 2; root.add(link);
    }
    var hook = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 8, 18, 4.4), mMetal);
    hook.position.set(x, 4.5 - len * 0.1 - 0.12, z); hook.rotation.z = 0.6; hook.castShadow = true; root.add(hook);
  }
  chain(-2.0, -1.8, 12); chain(5.8, -2.2, 9); chain(-7.5, -1.5, 14); chain(13, -1.8, 11);

  /* ---------- meja penyimpanan ---------- */
  var TABLE = { x: 2.8, z: -1.7, w: 3.4, d: 1.2, top: 1.15 };
  box(TABLE.w, 0.1, TABLE.d, mWood, TABLE.x, TABLE.top - 0.05, TABLE.z);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
    box(0.12, TABLE.top - 0.1, 0.12, mWood, TABLE.x + s[0] * (TABLE.w / 2 - 0.1), (TABLE.top - 0.1) / 2, TABLE.z + s[1] * (TABLE.d / 2 - 0.1));
  });
  box(TABLE.w - 0.3, 0.06, 0.06, mWood, TABLE.x, 0.35, TABLE.z + TABLE.d / 2 - 0.1);
  box(TABLE.w - 0.3, 0.06, 0.06, mWood, TABLE.x, 0.35, TABLE.z - TABLE.d / 2 + 0.1);
  // barang di atas meja
  cyl(0.09, 0.09, 0.26, 14, M(0x3d4f3a, 0.35, 0.1, { transparent: true, opacity: 0.88 }), 1.7, TABLE.top + 0.13, -1.9);
  cyl(0.06, 0.06, 0.34, 14, M(0x4f3d2a, 0.35, 0.1, { transparent: true, opacity: 0.88 }), 2.0, TABLE.top + 0.17, -2.0);
  cyl(0.1, 0.12, 0.08, 16, M(0x6a6a62, 0.5, 0.5), 2.5, TABLE.top + 0.04, -1.55);
  box(0.5, 0.025, 0.4, M(0x57493a, 1), 3.1, TABLE.top + 0.012, -2.0);   // kain
  var candle = cyl(0.03, 0.035, 0.12, 10, M(0xb8ab88, 0.9), 1.55, TABLE.top + 0.06, -1.4);

  // KUNCI di atas meja (poros sepanjang +z, ring di bidang YZ)
  var key = new THREE.Group();
  var mKey = M(0xc9a24a, 0.35, 0.65, { emissive: 0x3a2a08, emissiveIntensity: 0.9 });
  var ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 20), mKey);
  ring.rotation.y = Math.PI / 2; ring.position.z = -0.055; key.add(ring);
  var shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.22, 10), mKey);
  shaft.rotation.x = Math.PI / 2; shaft.position.z = 0.11; key.add(shaft);
  [0.17, 0.2].forEach(function (z, i) {
    var bit = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.045 - i * 0.012, 0.02), mKey);
    bit.position.set(0, -0.026, z); key.add(bit);
  });
  key.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
  root.add(key);
  var KEY_TABLE = new THREE.Vector3(3.9, TABLE.top + 0.014, -1.3);
  key.position.copy(KEY_TABLE); key.rotation.set(0, 0.4, Math.PI / 2);

  // KALENG (benda yang jatuh pada Scene 4)
  var can = new THREE.Group();
  var canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.13, 16), M(0x77746a, 0.35, 0.8));
  var canLabel = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.06, 16), M(0x8a3a24, 0.7, 0.1));
  canBody.castShadow = canLabel.castShadow = true; can.add(canBody); can.add(canLabel);
  root.add(can);
  var CAN_START = new THREE.Vector3(4.2, TABLE.top + 0.065, -1.24);
  can.position.copy(CAN_START);

  /* ---------- radio tua di pojok kiri ---------- */
  var RADIO = { x: -1.9, z: -2.5, base: 0.38 };
  box(0.7, RADIO.base, 0.55, mWoodLt, RADIO.x, RADIO.base / 2, RADIO.z);     // peti alas
  var radioG = new THREE.Group(); radioG.position.set(RADIO.x, RADIO.base, RADIO.z); root.add(radioG);
  var mRadioBody = M(0x6b4a2c, 0.55, 0.05);
  box(0.5, 0.3, 0.2, mRadioBody, 0, 0.15, 0, radioG);
  var mGrille = M(0xffffff, 0.9, 0, { map: grilleTex, emissive: 0x000000 });
  box(0.2, 0.22, 0.02, mGrille, -0.12, 0.15, 0.106, radioG);
  var mDial = M(0x2a2312, 0.5, 0, { emissive: 0xffc860, emissiveIntensity: 0 });
  box(0.17, 0.07, 0.02, mDial, 0.13, 0.22, 0.106, radioG);
  [0.09, 0.17].forEach(function (kx) {
    var kn = cyl(0.022, 0.022, 0.03, 12, M(0x14110d, 0.5, 0.3), kx + 0.04, 0.09, 0.115, radioG); kn.rotation.x = Math.PI / 2;
  });
  var antenna = cyl(0.004, 0.004, 0.45, 6, mMetal, 0.17, 0.5, -0.04, radioG); antenna.rotation.z = -0.35;
  var radioLight = new THREE.PointLight(0xffc56a, 0, 4.5, 2);
  radioLight.position.set(RADIO.x + 0.1, RADIO.base + 0.3, RADIO.z + 0.45); root.add(radioLight);

  /* ---------- pintu besi terkunci + lift ---------- */
  var leafPivot = new THREE.Group(); leafPivot.position.set(9.6, 0, -3.08); root.add(leafPivot);
  var leaf = box(2.0, 3.0, 0.1, mDoor, -1.0, 1.5, 0, leafPivot);
  var plate = box(0.5, 0.75, 0.04, M(0xffffff, 0.6, 0.4, { map: plateTex }), -1.5, 0.95, 0.07, leafPivot);
  // posisi lubang kunci di dunia (pada keadaan pintu tertutup): x = 8.1, y ~ 0.7, z = -2.99
  var KEYHOLE = new THREE.Vector3(8.1, 0.95 - 0.1, -2.98);
  var handle = box(0.06, 0.4, 0.12, mMetal, -1.8, 1.0, 0.1, leafPivot);
  // lampu indikator merah (terkunci) -> hijau (terbuka)
  var lockBulbMat = M(0x300808, 0.4, 0, { emissive: 0xff2410, emissiveIntensity: 1.4 });
  var lockBulb = mesh(new THREE.SphereGeometry(0.09, 14, 10), lockBulbMat, 8.6, 3.3, -2.95);
  var lockLight = new THREE.PointLight(0xff3018, 0.7, 5, 2); lockLight.position.set(8.6, 3.2, -2.5); root.add(lockLight);

  // kabin lift (x 7.6 .. 9.6, z -3.3 .. -5.5)
  var mCab = M(0xffffff, 0.8, 0.1, { map: cabinTex });
  box(0.1, 3.0, 2.2, mCab, 7.55, 1.5, -4.4);
  box(0.1, 3.0, 2.2, mCab, 9.65, 1.5, -4.4);
  box(2.2, 3.0, 0.1, mCab, 8.6, 1.5, -5.55);
  box(2.2, 0.1, 2.3, M(0x2a2824, 0.6, 0.4), 8.6, 0.05, -4.4);
  box(2.2, 0.1, 2.3, M(0x1a1916, 1), 8.6, 3.05, -4.4);
  box(0.3, 0.12, 0.05, M(0x15130f, 0.6, 0.4), 8.6, 1.0, -5.48);          // palang pegangan
  var cabLampMat = M(0x555040, 0.4, 0, { emissive: 0xffe4a0, emissiveIntensity: 0 });
  box(0.7, 0.06, 0.25, cabLampMat, 8.6, 2.98, -4.2);
  var cabinLight = new THREE.PointLight(0xffe0a0, 0, 7, 1.6); cabinLight.position.set(8.6, 2.7, -4.2); root.add(cabinLight);

  // gerbang lift (2 panel jeruji yang menutup dari kedua sisi)
  function gatePanel(dir) {
    var g = new THREE.Group();
    g.position.set(dir < 0 ? 7.6 : 9.6, 0, -3.5);
    var gm = M(0x5a5a52, 0.5, 0.7);
    var W = 1.0, n = 7;
    box(W, 0.07, 0.07, gm, dir * W / 2, 2.8, 0, g);
    box(W, 0.07, 0.07, gm, dir * W / 2, 0.1, 0, g);
    box(W, 0.05, 0.05, gm, dir * W / 2, 1.5, 0, g);
    for (var i = 0; i <= n; i++) box(0.035, 2.8, 0.035, gm, dir * (i * W / n), 1.45, 0, g);
    return g;
  }
  var gateL = gatePanel(+1), gateR = gatePanel(-1);   // L: tumbuh ke +x dari x=7.6 ; R: tumbuh ke -x dari x=9.6
  root.add(gateL); root.add(gateR);

  /* ---------- lampu gantung ---------- */
  function hangingLamp(x, y, z, len) {
    var g = new THREE.Group(); g.position.set(x, y, z);
    cyl(0.008, 0.008, len, 6, mDark, 0, len / 2, 0, g);
    var shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.34, 0.3, 24, 1, true), M(0x2c3a2e, 0.6, 0.4, { side: THREE.DoubleSide }));
    shade.position.y = -0.15; shade.castShadow = false; g.add(shade);
    var bulbMat = M(0x555040, 0.3, 0, { emissive: 0xffd9a0, emissiveIntensity: 0 });
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), bulbMat);
    bulb.position.y = -0.2; g.add(bulb);
    root.add(g);
    return { group: g, bulbMat: bulbMat, pos: new THREE.Vector3(x, y - 0.35, z) };
  }
  var lampTable = hangingLamp(TABLE.x, 3.75, -1.55, 0.85);
  var lampLeft = hangingLamp(-6.5, 3.55, -2.0, 1.05);
  var lampMid = hangingLamp(-0.5, 3.6, -1.0, 1.0);
  var lampDoor = hangingLamp(6.2, 3.65, -1.7, 0.95);

  /* ---------- debu melayang ---------- */
  var DUST = 260, dustPos = new Float32Array(DUST * 3), dustBase = new Float32Array(DUST * 3);
  for (var d = 0; d < DUST; d++) {
    dustBase[d * 3] = -10 + rnd() * 24; dustBase[d * 3 + 1] = 0.3 + rnd() * 3.5; dustBase[d * 3 + 2] = -2.7 + rnd() * 7;
  }
  var dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xd8c9a0, size: 0.035, transparent: true, opacity: 0.45, depthWrite: false }));
  root.add(dust);

  function updateDust(t) {
    for (var i = 0; i < DUST; i++) {
      dustPos[i * 3] = dustBase[i * 3] + Math.sin(t * 0.21 + i) * 0.35;
      dustPos[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(t * 0.33 + i * 1.7) * 0.18;
      dustPos[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(t * 0.17 + i * 0.6) * 0.3;
    }
    dustGeo.attributes.position.needsUpdate = true;
  }

  return {
    root: root, table: TABLE, radioPos: new THREE.Vector3(RADIO.x, RADIO.base, RADIO.z),
    key: key, keyTable: KEY_TABLE, can: can, canStart: CAN_START,
    keyhole: KEYHOLE, leafPivot: leafPivot, gateL: gateL, gateR: gateR, cabinLight: cabinLight, cabLampMat: cabLampMat,
    lockBulbMat: lockBulbMat, lockLight: lockLight,
    radio: { light: radioLight, dialMat: mDial, grilleMat: mGrille },
    lamps: { table: lampTable, left: lampLeft, mid: lampMid, door: lampDoor },
    updateDust: updateDust
  };
};
