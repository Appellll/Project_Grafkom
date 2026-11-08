/* =========================================================
 *  Env.js - Environment "The Maw" untuk WebGL mentah
 *  Geometri dibuat sendiri (Geo.box / cyl / sphere / torus / plane)
 *  dan tekstur dibuat dengan canvas 2D lalu di-upload sebagai tekstur WebGL.
 *
 *  Tata letak dunia (meter; kamera melihat dari +Z ke -Z):
 *    lantai y=0, dinding belakang z=-3, langit-langit y=4.6
 *    meja (2.8,-1.7) permukaan y=1.15 | radio (-1.9,-2.5) | pintu besi + lift x=7.6..9.6
 * ========================================================= */
window.LNGeo = (function () {
  function G() { return { p: [], n: [], uv: [], i: [] }; }
  function quad(g, a, b, c, d, n, uvs) {
    var k = g.p.length / 3;
    [a, b, c, d].forEach(function (v, j) { g.p.push(v[0], v[1], v[2]); g.n.push(n[0], n[1], n[2]); g.uv.push(uvs[j][0], uvs[j][1]); });
    g.i.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  function box(w, h, d, us, vs) {
    us = us || 1; vs = vs || 1;
    var g = G(), hx = w / 2, hy = h / 2, hz = d / 2;
    var F = [
      { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], du: w, dv: h, c: [0, 0, hz] },
      { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], du: w, dv: h, c: [0, 0, -hz] },
      { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], du: d, dv: h, c: [hx, 0, 0] },
      { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], du: d, dv: h, c: [-hx, 0, 0] },
      { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], du: w, dv: d, c: [0, hy, 0] },
      { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], du: w, dv: d, c: [0, -hy, 0] }
    ];
    F.forEach(function (f) {
      var s = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      var pts = s.map(function (q) {
        return [f.c[0] + f.u[0] * q[0] * f.du / 2 + f.v[0] * q[1] * f.dv / 2,
          f.c[1] + f.u[1] * q[0] * f.du / 2 + f.v[1] * q[1] * f.dv / 2,
          f.c[2] + f.u[2] * q[0] * f.du / 2 + f.v[2] * q[1] * f.dv / 2];
      });
      quad(g, pts[0], pts[1], pts[2], pts[3], f.n, [[0, 0], [f.du * us, 0], [f.du * us, f.dv * vs], [0, f.dv * vs]]);
    });
    return g;
  }
  // frustum/silinder sumbu y, terpusat di origin
  function cyl(rt, rb, h, seg, open) {
    var g = G(); seg = seg || 20;
    for (var i = 0; i <= seg; i++) {
      var a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      var ny = (rb - rt) / h, nl = Math.hypot(1, ny);
      g.p.push(rt * c, h / 2, rt * s, rb * c, -h / 2, rb * s);
      g.n.push(c / nl, ny / nl, s / nl, c / nl, ny / nl, s / nl);
      g.uv.push(i / seg, 1, i / seg, 0);
      if (i < seg) { var k = i * 2; g.i.push(k, k + 1, k + 3, k, k + 3, k + 2); }
    }
    if (!open) [[rt, h / 2, 1], [rb, -h / 2, -1]].forEach(function (cp) {
      var base = g.p.length / 3;
      g.p.push(0, cp[1], 0); g.n.push(0, cp[2], 0); g.uv.push(0.5, 0.5);
      for (var i = 0; i <= seg; i++) {
        var a = i / seg * Math.PI * 2;
        g.p.push(cp[0] * Math.cos(a), cp[1], cp[0] * Math.sin(a)); g.n.push(0, cp[2], 0); g.uv.push(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a));
        if (i < seg) g.i.push(base, base + 1 + i, base + 2 + i);
      }
    });
    return g;
  }
  function sphere(rx, ry, rz, st, sl) {
    var g = G(); st = st || 12; sl = sl || 16;
    for (var i = 0; i <= st; i++) {
      var ph = Math.PI * i / st, sp = Math.sin(ph), cp = Math.cos(ph);
      for (var j = 0; j <= sl; j++) {
        var th = 2 * Math.PI * j / sl, ct = Math.cos(th), stt = Math.sin(th);
        g.p.push(rx * sp * ct, ry * cp, rz * sp * stt);
        var n = [sp * ct / rx, cp / ry, sp * stt / rz], l = Math.hypot(n[0], n[1], n[2]);
        g.n.push(n[0] / l, n[1] / l, n[2] / l); g.uv.push(j / sl, 1 - i / st);
      }
    }
    for (var a = 0; a < st; a++) for (var b = 0; b < sl; b++) {
      var k = a * (sl + 1) + b; g.i.push(k, k + sl + 1, k + 1, k + 1, k + sl + 1, k + sl + 2);
    }
    return g;
  }
  function torus(R, r, seg, tseg, arc) {
    var g = G(); arc = arc || Math.PI * 2;
    for (var i = 0; i <= seg; i++) for (var j = 0; j <= tseg; j++) {
      var u = i / seg * arc, v = j / tseg * Math.PI * 2;
      var cx = R * Math.cos(u), cy = R * Math.sin(u);
      g.p.push((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v));
      g.n.push(Math.cos(v) * Math.cos(u), Math.cos(v) * Math.sin(u), Math.sin(v)); g.uv.push(i / seg, j / tseg);
    }
    for (var a = 0; a < seg; a++) for (var b = 0; b < tseg; b++) {
      var k = a * (tseg + 1) + b; g.i.push(k, k + tseg + 1, k + 1, k + 1, k + tseg + 1, k + tseg + 2);
    }
    return g;
  }
  // bidang datar XZ menghadap +y (uv dalam satuan meter * skala)
  function plane(w, d, us, vs) {
    var g = G(), hx = w / 2, hz = d / 2;
    quad(g, [-hx, 0, hz], [hx, 0, hz], [hx, 0, -hz], [-hx, 0, -hz], [0, 1, 0], [[0, 0], [w * us, 0], [w * us, d * vs], [0, d * vs]]);
    return g;
  }
  return { box: box, cyl: cyl, sphere: sphere, torus: torus, plane: plane };
})();

window.createLNEnvironment = function (R) {
  var seed = 1234567;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  var recs = [];                         // semua objek: { gpu, mat, local, parent, w }
  var cache = {};

  /* ---------- tekstur canvas -> WebGL ---------- */
  function canvasTex(w, h, draw, opt) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    return R.texture(c, opt);
  }
  function speckle(g, w, h, n, a) {
    for (var i = 0; i < n; i++) { var v = Math.floor(rnd() * 90); g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + a + ')'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
  }
  function stains(g, w, h, n) {
    for (var i = 0; i < n; i++) {
      var x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 90, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(12,9,4,' + (0.10 + rnd() * 0.18) + ')'); gr.addColorStop(1, 'rgba(12,9,4,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }
  var wallTex = canvasTex(512, 512, function (g, w, h) {
    g.fillStyle = '#4b4837'; g.fillRect(0, 0, w, h);
    var gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(14,12,8,0.6)'; g.lineWidth = 3;
    for (var y = h * 0.42; y < h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (var x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, h * 0.42); g.lineTo(x, h); g.stroke(); }
    g.fillStyle = '#2b2a20'; g.fillRect(0, h * 0.42 - 6, w, 8);
    stains(g, w, h, 46); speckle(g, w, h, 4500, 0.14);
    for (var i = 0; i < 9; i++) {
      var sx = rnd() * w, sl = 80 + rnd() * 240, lg = g.createLinearGradient(0, 0, 0, sl);
      lg.addColorStop(0, 'rgba(10,8,3,0.28)'); lg.addColorStop(1, 'rgba(10,8,3,0)');
      g.save(); g.translate(sx, 0); g.fillStyle = lg; g.fillRect(0, 0, 6 + rnd() * 10, sl); g.restore();
    }
  });
  var floorTex = canvasTex(512, 512, function (g, w, h) {
    var ph = 64;
    for (var i = 0; i < h / ph; i++) {
      var v = 38 + Math.floor(rnd() * 22);
      g.fillStyle = 'rgb(' + (v + 16) + ',' + (v + 6) + ',' + (v - 6) + ')'; g.fillRect(0, i * ph, w, ph);
      for (var k = 0; k < 14; k++) {
        g.strokeStyle = 'rgba(10,6,2,' + (0.1 + rnd() * 0.2) + ')'; g.lineWidth = 1;
        var yy = i * ph + 4 + rnd() * (ph - 8);
        g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + rnd() * 6 - 3, w * 0.6, yy + rnd() * 6 - 3, w, yy); g.stroke();
      }
      g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillRect(0, i * ph, w, 3);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(rnd() * w, i * ph, 3, ph);
    }
    stains(g, w, h, 30); speckle(g, w, h, 4000, 0.18);
  });
  var doorTex = canvasTex(256, 512, function (g, w, h) {
    g.fillStyle = '#4a4238'; g.fillRect(0, 0, w, h);
    stains(g, w, h, 34); speckle(g, w, h, 3000, 0.2);
    for (var i = 0; i < 40; i++) {
      var x = rnd() * w, y = rnd() * h, r = 8 + rnd() * 36, gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(120,64,28,0.32)'); gr.addColorStop(1, 'rgba(120,64,28,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.strokeStyle = 'rgba(15,12,9,0.8)'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    [h * 0.33, h * 0.66].forEach(function (y) { g.beginPath(); g.moveTo(14, y); g.lineTo(w - 14, y); g.stroke(); });
    g.fillStyle = 'rgba(25,20,15,0.95)';
    for (var rx = 28; rx < w; rx += 50) for (var ry = 28; ry < h; ry += 56) { g.beginPath(); g.arc(rx, ry, 4, 0, 6.3); g.fill(); }
  });
  var plateTex = canvasTex(256, 512, function (g, w, h) {
    g.fillStyle = '#2d2a26'; g.fillRect(0, 0, w, h);
    stains(g, w, h, 10); speckle(g, w, h, 1500, 0.2);
    g.strokeStyle = '#17140f'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    // simbol kunci = tanda "butuh kunci"
    g.strokeStyle = '#d9972a'; g.fillStyle = '#d9972a'; g.lineWidth = 14; g.lineCap = 'round';
    g.beginPath(); g.arc(w / 2, 100, 32, 0, 6.3); g.stroke();
    g.beginPath(); g.moveTo(w / 2, 132); g.lineTo(w / 2, 250); g.stroke();
    g.lineWidth = 12; g.beginPath(); g.moveTo(w / 2, 195); g.lineTo(w / 2 + 30, 195); g.moveTo(w / 2, 228); g.lineTo(w / 2 + 24, 228); g.stroke();
    // lubang kunci
    g.fillStyle = '#050403';
    g.beginPath(); g.arc(w / 2, 340, 22, 0, 6.3); g.fill();
    g.beginPath(); g.moveTo(w / 2 - 11, 350); g.lineTo(w / 2 + 11, 350); g.lineTo(w / 2 + 17, 420); g.lineTo(w / 2 - 17, 420); g.closePath(); g.fill();
  });
  var cabinTex = canvasTex(256, 256, function (g, w, h) {
    g.fillStyle = '#6b6650'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(20,18,10,0.5)'; g.lineWidth = 4;
    for (var x = 0; x <= w; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    stains(g, w, h, 14); speckle(g, w, h, 1800, 0.15);
  });
  var grilleTex = canvasTex(128, 128, function (g, w, h) {
    g.fillStyle = '#2a1d12'; g.fillRect(0, 0, w, h); g.strokeStyle = '#0c0805'; g.lineWidth = 3;
    for (var y = 8; y < h; y += 9) { g.beginPath(); g.moveTo(8, y); g.lineTo(w - 8, y); g.stroke(); }
  });
  var blobTex = canvasTex(64, 64, function (g, w, h) {       // bayangan kontak lembut (alpha radial)
    var gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { repeat: false });

  /* ---------- material & objek ---------- */
  function hex(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
  function M(color, rough, metal, o) {
    rough = rough === undefined ? 0.9 : rough; metal = metal || 0;
    var m = { color: hex(color), spec: 0.04 + 0.7 * metal * (1 - rough * 0.6) + 0.1 * (1 - rough), shin: 8 + (1 - rough) * 70 };
    if (o) for (var k in o) m[k] = o[k];
    return m;
  }
  function geoOf(key, fn) { return cache[key] || (cache[key] = R.mesh(fn())); }
  var Gx = window.LNGeo;
  function grp() { return { m: LIBS.identity() }; }
  function add(gpu, mat, local, parent) {
    var r = { gpu: gpu, mat: mat, local: local, parent: parent || null, w: parent ? null : local };
    recs.push(r); return r;
  }
  function T(x, y, z) { return LIBS.translation(x, y, z); }
  function TR(x, y, z, rx, ry, rz) { return LIBS.compose([x, y, z], [rx || 0, ry || 0, rz || 0], [1, 1, 1]); }
  function box(w, h, d, mat, x, y, z, parent, us, vs, rot) {
    var key = 'b' + [w, h, d, us, vs].join(',');
    return add(geoOf(key, function () { return Gx.box(w, h, d, us, vs); }), mat, rot ? TR(x, y, z, rot[0], rot[1], rot[2]) : T(x, y, z), parent);
  }
  function cyl(rt, rb, h, seg, mat, x, y, z, parent, rot) {
    var key = 'c' + [rt, rb, h, seg].join(',');
    return add(geoOf(key, function () { return Gx.cyl(rt, rb, h, seg || 20); }), mat, rot ? TR(x, y, z, rot[0], rot[1], rot[2]) : T(x, y, z), parent);
  }
  function sphere(rx, ry, rz, mat, x, y, z, parent, st, sl) {
    var key = 's' + [rx, ry, rz, st, sl].join(',');
    return add(geoOf(key, function () { return Gx.sphere(rx, ry, rz, st || 12, sl || 16); }), mat, T(x, y, z), parent);
  }
  function torus(Rr, r, mat, x, y, z, parent, rot, arc) {
    var key = 't' + [Rr, r, arc].join(',');
    return add(geoOf(key, function () { return Gx.torus(Rr, r, 20, 8, arc); }), mat, TR(x, y, z, rot && rot[0], rot && rot[1], rot && rot[2]), parent);
  }

  var mWall = M(0xffffff, 0.95, 0, { tex: wallTex });
  var mFloor = M(0xffffff, 0.85, 0, { tex: floorTex });
  var mDark = M(0x1b1815, 0.95);
  var mWood = M(0x3a2a1c, 0.85);
  var mWoodLt = M(0x5a4430, 0.8);
  var mRust = M(0x4a3426, 0.65, 0.5);
  var mMetal = M(0x55575a, 0.5, 0.7);
  var mDoor = M(0xffffff, 0.6, 0.55, { tex: doorTex });

  /* ---------- lantai, dinding, langit-langit ---------- */
  add(geoOf('floor', function () { return Gx.plane(44, 14, 1 / 3.14, 1 / 3); }), mFloor, T(0, 0, 4));
  // dinding belakang tebal 0.3 (z -3.3..-3.0), ambang pintu x 7.6..9.6
  box(29.6, 4.6, 0.3, mWall, -7.2, 2.3, -3.15, null, 0.25, 1 / 4.6);
  box(12.4, 4.6, 0.3, mWall, 15.8, 2.3, -3.15, null, 0.25, 1 / 4.6);
  box(2.0, 1.6, 0.3, mWall, 8.6, 3.8, -3.15, null, 0.25, 1 / 4.6);
  box(0.14, 3.0, 0.36, mDark, 7.55, 1.5, -3.15); box(0.14, 3.0, 0.36, mDark, 9.65, 1.5, -3.15); box(2.24, 0.14, 0.36, mDark, 8.6, 3.03, -3.15);
  add(geoOf('ceil', function () { return Gx.plane(44, 14, 1, 1); }), M(0x14120f, 1), TR(0, 4.6, 4, Math.PI, 0, 0));
  for (var bx = -21; bx <= 21; bx += 3) box(0.3, 0.32, 14, mDark, bx, 4.44, 4);
  cyl(0.26, 0.26, 44, 24, mRust, 0, 3.95, -2.5, null, [0, 0, Math.PI / 2]);
  cyl(0.12, 0.12, 44, 16, mRust, 0, 3.35, -2.75, null, [0, 0, Math.PI / 2]);
  cyl(0.09, 0.09, 44, 16, mMetal, 0, 2.7, -2.85, null, [0, 0, Math.PI / 2]);
  for (var pj = -20; pj <= 20; pj += 4) cyl(0.31, 0.31, 0.14, 24, mDark, pj, 3.95, -2.5, null, [0, 0, Math.PI / 2]);
  [-9.5, -2.5, 12.5].forEach(function (px) {
    cyl(0.15, 0.15, 4.6, 16, mRust, px, 2.3, -2.7);
    cyl(0.14, 0.14, 0.1, 16, mDark, px, 1.5, -2.55, null, [Math.PI / 2, 0, 0]);
    torus(0.2, 0.025, mMetal, px, 1.5, -2.45);
  });

  /* ---------- rak, tong, peti ---------- */
  function shelf(x0, n) {
    for (var s = 0; s < 3; s++) {
      var y = 0.75 + s * 0.85;
      box(n * 1.0, 0.07, 0.5, mWood, x0 + n * 0.5, y, -2.7);
      for (var j = 0; j < n * 3; j++) {
        var h = 0.16 + rnd() * 0.22;
        cyl(0.07, 0.07, h, 12, M(rnd() < 0.5 ? 0x4a5a3a : 0x5a4a2a, 0.4, 0.1), x0 + 0.2 + j * (n * 1.0 - 0.3) / (n * 3), y + 0.035 + h / 2, -2.7 + (rnd() - 0.5) * 0.2);
      }
    }
    box(0.08, 2.5, 0.5, mWood, x0 + 0.02, 1.25, -2.7); box(0.08, 2.5, 0.5, mWood, x0 + n - 0.02, 1.25, -2.7);
  }
  shelf(-9.5, 3); shelf(12.0, 3); shelf(-15.5, 4);
  function barrel(x, z) {
    cyl(0.38, 0.34, 0.95, 20, M(0x3b2f22, 0.8), x, 0.475, z);
    cyl(0.385, 0.385, 0.05, 20, mMetal, x, 0.3, z); cyl(0.385, 0.385, 0.05, 20, mMetal, x, 0.7, z);
  }
  barrel(-4.4, -2.4); barrel(-3.7, -2.55); barrel(11.9, -1.9); barrel(-12, -2.3);
  function crate(x, y, z, s, ry) { return box(s, s, s, mWoodLt, x, y + s / 2, z, null, 1, 1, [0, ry || 0, 0]); }
  crate(-6.2, 0, -2.3, 0.8, 0.1); crate(-6.2, 0.8, -2.35, 0.7, -0.2); crate(-5.4, 0, -2.4, 0.6, 0.3); crate(11.0, 0, -2.4, 0.7, 0.2); crate(-11, 0, -2.2, 0.9, 0.15);

  function chain(x, z, len) {
    for (var i = 0; i < len; i++) torus(0.05, 0.012, mMetal, x, 4.5 - i * 0.1, z, null, [0, (i % 2) * Math.PI / 2, 0]);
    torus(0.16, 0.03, mMetal, x, 4.5 - len * 0.1 - 0.12, z, null, [0, 0, 0.6], 4.4);
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
  cyl(0.09, 0.09, 0.26, 14, M(0x3d4f3a, 0.35, 0.1), 1.7, TABLE.top + 0.13, -1.9);
  cyl(0.06, 0.06, 0.34, 14, M(0x4f3d2a, 0.35, 0.1), 2.0, TABLE.top + 0.17, -2.0);
  cyl(0.1, 0.12, 0.08, 16, M(0x6a6a62, 0.5, 0.5), 2.5, TABLE.top + 0.04, -1.55);
  box(0.5, 0.025, 0.4, M(0x57493a, 1), 3.1, TABLE.top + 0.012, -2.0);
  cyl(0.03, 0.035, 0.12, 10, M(0xb8ab88, 0.9), 1.55, TABLE.top + 0.06, -1.4);

  // KUNCI (poros +z, cincin di bidang YZ) - grup dinamis; Anim mengisi key.m
  var key = grp(), mKey = M(0xc9a24a, 0.35, 0.65, { emis: [0.10, 0.07, 0.015] });
  torus(0.05, 0.012, mKey, 0, 0, -0.055, key, [0, Math.PI / 2, 0]);
  cyl(0.011, 0.011, 0.22, 10, mKey, 0, 0, 0.11, key, [Math.PI / 2, 0, 0]);
  box(0.01, 0.045, 0.02, mKey, 0, -0.026, 0.17, key); box(0.01, 0.033, 0.02, mKey, 0, -0.026, 0.2, key);
  var KEY_TABLE = [3.9, TABLE.top + 0.014, -1.3];

  // KALENG (benda yang jatuh pada Scene 4) - grup dinamis
  var can = grp();
  cyl(0.07, 0.07, 0.13, 16, M(0x77746a, 0.35, 0.8), 0, 0, 0, can); cyl(0.072, 0.072, 0.06, 16, M(0x8a3a24, 0.7, 0.1), 0, 0, 0, can);
  var CAN_START = [4.2, TABLE.top + 0.065, -1.24];

  /* ---------- radio tua di pojok kiri ---------- */
  var RADIO = { x: -1.9, z: -2.5, base: 0.38 };
  box(0.7, RADIO.base, 0.55, mWoodLt, RADIO.x, RADIO.base / 2, RADIO.z);
  var rg = grp(); rg.m = T(RADIO.x, RADIO.base, RADIO.z);
  box(0.5, 0.3, 0.2, M(0x6b4a2c, 0.55, 0.05), 0, 0.15, 0, rg);
  var mGrille = M(0xffffff, 0.9, 0, { tex: grilleTex, emis: [0, 0, 0] });
  box(0.2, 0.22, 0.02, mGrille, -0.12, 0.15, 0.106, rg, 5, 1 / 0.22);
  var mDial = M(0x2a2312, 0.5, 0, { emis: [0, 0, 0] });
  box(0.17, 0.07, 0.02, mDial, 0.13, 0.22, 0.106, rg);
  [0.09, 0.17].forEach(function (kx) { cyl(0.022, 0.022, 0.03, 12, M(0x14110d, 0.5, 0.3), kx + 0.04, 0.09, 0.115, rg, [Math.PI / 2, 0, 0]); });
  cyl(0.004, 0.004, 0.45, 6, mMetal, 0.17, 0.5, -0.04, rg, [0, 0, -0.35]);

  /* ---------- pintu besi terkunci + lift ---------- */
  var leafPivot = grp();                      // m = T(9.6,0,-3.08) * Ry(sudut)  (diatur Anim)
  box(2.0, 3.0, 0.1, mDoor, -1.0, 1.5, 0, leafPivot, 0.5, 1 / 3);
  box(0.5, 0.75, 0.04, M(0xffffff, 0.6, 0.4, { tex: plateTex }), -1.5, 0.95, 0.07, leafPivot, 2, 1 / 0.75);
  box(0.06, 0.4, 0.12, mMetal, -1.8, 1.0, 0.1, leafPivot);
  var KEYHOLE = [8.1, 0.85, -2.98];
  var lockBulbMat = M(0x300808, 0.4, 0, { emis: [1, 0.15, 0.06] });
  sphere(0.09, 0.09, 0.09, lockBulbMat, 8.6, 3.3, -2.95);

  var mCab = M(0xffffff, 0.8, 0.1, { tex: cabinTex });
  box(0.1, 3.0, 2.2, mCab, 7.55, 1.5, -4.4, null, 1 / 1.1, 1 / 1.1); box(0.1, 3.0, 2.2, mCab, 9.65, 1.5, -4.4, null, 1 / 1.1, 1 / 1.1);
  box(2.2, 3.0, 0.1, mCab, 8.6, 1.5, -5.55, null, 1 / 1.1, 1 / 1.1);
  box(2.2, 0.1, 2.3, M(0x2a2824, 0.6, 0.4), 8.6, 0.05, -4.4); box(2.2, 0.1, 2.3, M(0x1a1916, 1), 8.6, 3.05, -4.4);
  box(0.3, 0.12, 0.05, M(0x15130f, 0.6, 0.4), 8.6, 1.0, -5.48);
  var cabLampMat = M(0x555040, 0.4, 0, { emis: [0, 0, 0] });
  box(0.7, 0.06, 0.25, cabLampMat, 8.6, 2.98, -4.2);

  function gatePanel(dir, x0) {                 // jeruji lift; grup diskalakan pada sumbu x
    var g = grp(); g.base = T(x0, 0, -3.5); g.m = g.base;
    var gm = M(0x5a5a52, 0.5, 0.7), Wd = 1.0, n = 7;
    box(Wd, 0.07, 0.07, gm, dir * Wd / 2, 2.8, 0, g); box(Wd, 0.07, 0.07, gm, dir * Wd / 2, 0.1, 0, g); box(Wd, 0.05, 0.05, gm, dir * Wd / 2, 1.5, 0, g);
    for (var i = 0; i <= n; i++) box(0.035, 2.8, 0.035, gm, dir * (i * Wd / n), 1.45, 0, g);
    return g;
  }
  var gateL = gatePanel(+1, 7.6), gateR = gatePanel(-1, 9.6);

  /* ---------- lampu gantung (bulb = emisi, cahaya dihitung di shader) ---------- */
  function hangingLamp(x, y, z, len) {
    var g = grp(); g.m = T(x, y, z);
    cyl(0.008, 0.008, len, 6, mDark, 0, len / 2, 0, g);
    cyl(0.06, 0.34, 0.3, 24, M(0x2c3a2e, 0.6, 0.4), 0, -0.15, 0, g);
    var bulbMat = M(0x555040, 0.3, 0, { emis: [0, 0, 0] });
    sphere(0.075, 0.075, 0.075, bulbMat, 0, -0.2, 0, g);
    return { bulbMat: bulbMat, pos: [x, y - 0.35, z] };
  }
  var lamps = {
    table: hangingLamp(TABLE.x, 3.75, -1.55, 0.85), left: hangingLamp(-6.5, 3.55, -2.0, 1.05),
    mid: hangingLamp(-0.5, 3.6, -1.0, 1.0), door: hangingLamp(6.2, 3.65, -1.7, 0.95)
  };

  /* ---------- debu melayang ---------- */
  var DUST = 260, dustPos = new Float32Array(DUST * 3), dustBase = new Float32Array(DUST * 3);
  for (var d = 0; d < DUST; d++) { dustBase[d * 3] = -10 + rnd() * 24; dustBase[d * 3 + 1] = 0.3 + rnd() * 3.5; dustBase[d * 3 + 2] = -2.7 + rnd() * 7; }
  function updateDust(t) {
    for (var i = 0; i < DUST; i++) {
      dustPos[i * 3] = dustBase[i * 3] + Math.sin(t * 0.21 + i) * 0.35;
      dustPos[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(t * 0.33 + i * 1.7) * 0.18;
      dustPos[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(t * 0.17 + i * 0.6) * 0.3;
    }
  }

  /* ---------- menggambar ---------- */
  function world(r) { return r.parent ? LIBS.multiply(r.parent.m, r.local) : r.w; }
  function drawList(transparent) {
    for (var i = 0; i < recs.length; i++) {
      var r = recs[i], isT = r.mat.alpha !== undefined && r.mat.alpha < 1;
      if (isT === transparent) R.draw(r.gpu, world(r), r.mat);
    }
  }
  return {
    drawOpaque: function () { drawList(false); }, drawTransparent: function () { drawList(true); },
    table: TABLE, radioPos: [RADIO.x, RADIO.base, RADIO.z],
    key: key, keyTable: KEY_TABLE, can: can, canStart: CAN_START, keyhole: KEYHOLE,
    leafPivot: leafPivot, gateL: gateL, gateR: gateR,
    cabLampMat: cabLampMat, lockBulbMat: lockBulbMat, radio: { dialMat: mDial, grilleMat: mGrille },
    lamps: lamps, dust: dustPos, updateDust: updateDust, blobTex: blobTex
  };
};
