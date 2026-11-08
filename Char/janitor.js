/* ==========================================================
 * janitor.js  -  Karakter "The Janitor" (Little Nightmares)
 * WebGL murni (tanpa three.js).
 *
 * JENIS OBJEK YANG DIPAKAI
 *   1. Ellipsoid (quadric)        : kepala, telinga, mata, sepatu, sendi, kancing, lidah
 *   2. Cylinder  (quadric)        : kaki, jari tangan, gigi, ban lengan
 *   3. Cone terpotong (quadric)   : badan/jas, leher, topi, gigi, ground
 *   + Mesh hasil sapuan kurva Bezier (tube) : wajah (perban, bibir, hidung),
 *     lengan panjang, telapak tangan, ujung lengan (manset), kerah, dll.
 * ========================================================== */

var V = LIBS.vec3;

/* ==========================================================
 *  BAGIAN 1 : GEOMETRI
 * ========================================================== */
var Geo = (function () {

  function newMesh() { return { p: [], n: [], c: [], i: [] }; }

  function colorAt(color, p) { return (typeof color === 'function') ? color(p) : color; }

  function pushV(m, p, n, color) {
    var c = colorAt(color, p);
    m.p.push(p[0], p[1], p[2]);
    m.n.push(n[0], n[1], n[2]);
    m.c.push(c[0], c[1], c[2]);
    return m.p.length / 3 - 1;
  }

  // grid (rows+1) x (cols+1) vertex -> segitiga
  function gridIndices(m, rows, cols, base) {
    for (var i = 0; i < rows; i++) {
      for (var j = 0; j < cols; j++) {
        var a = base + i * (cols + 1) + j;
        var b = a + cols + 1;
        m.i.push(a, b, a + 1,  b, b + 1, a + 1);
      }
    }
  }

  /* variasi warna halus agar tidak terlihat "plastik" */
  function tint(base, amp, f) {
    f = f || 1;
    return function (p) {
      var k = 1 + amp * (0.6 * Math.sin(p[0] * 17 * f + p[1] * 11 * f) +
                         0.4 * Math.sin(p[2] * 23 * f + p[0] * 5 * f + p[1] * 29 * f));
      return [base[0] * k, base[1] * k, base[2] * k];
    };
  }

  /* ---------- Quadric 1 : ELLIPSOID ---------- */
  function ellipsoid(rx, ry, rz, stacks, slices, color) {
    var m = newMesh();
    for (var i = 0; i <= stacks; i++) {
      var ph = Math.PI * i / stacks, sp = Math.sin(ph), cp = Math.cos(ph);
      for (var j = 0; j <= slices; j++) {
        var th = 2 * Math.PI * j / slices, st = Math.sin(th), ct = Math.cos(th);
        var p = [rx * sp * ct, ry * cp, rz * sp * st];
        var n = V.norm([sp * ct / rx, cp / ry, sp * st / rz]);
        pushV(m, p, n, color);
      }
    }
    gridIndices(m, stacks, slices, 0);
    return m;
  }

  /* ---------- Quadric 2 & 3 : CYLINDER / CONE TERPOTONG ----------
     alas di y = 0 (radius rB), atas di y = h (radius rT).            */
  function frustum(rB, rT, h, slices, color, caps) {
    var m = newMesh();
    var slope = (rB - rT) / h;
    for (var ring = 0; ring <= 1; ring++) {
      var y = ring * h, r = ring ? rT : rB;
      for (var j = 0; j <= slices; j++) {
        var th = 2 * Math.PI * j / slices, ct = Math.cos(th), st = Math.sin(th);
        pushV(m, [r * ct, y, r * st], V.norm([ct, slope, st]), color);
      }
    }
    gridIndices(m, 1, slices, 0);
    if (caps !== false) {
      [[0, rB, -1], [h, rT, 1]].forEach(function (cp) {
        var y = cp[0], r = cp[1], ny = cp[2];
        if (r <= 0) return;
        var center = pushV(m, [0, y, 0], [0, ny, 0], color);
        var first = m.p.length / 3;
        for (var j = 0; j <= slices; j++) {
          var th = 2 * Math.PI * j / slices;
          pushV(m, [r * Math.cos(th), y, r * Math.sin(th)], [0, ny, 0], color);
        }
        for (var k = 0; k < slices; k++) m.i.push(center, first + k, first + k + 1);
      });
    }
    return m;
  }

  function cylinder(r, h, slices, color, caps) { return frustum(r, r, h, slices, color, caps); }

  /* ---------- Permukaan parametrik umum (normal numerik) ---------- */
  function surface(fn, nu, nv, color, hint) {
    var m = newMesh(), e = 1e-3;
    for (var i = 0; i <= nu; i++) {
      var u = i / nu;
      for (var j = 0; j <= nv; j++) {
        var v = j / nv;
        var P = fn(u, v);
        var du = V.sub(fn(Math.min(1, u + e), v), fn(Math.max(0, u - e), v));
        var dv = V.sub(fn(u, Math.min(1, v + e)), fn(u, Math.max(0, v - e)));
        var n = V.norm(V.cross(du, dv));
        if (hint && V.dot(n, hint) < 0) n = V.mul(n, -1);
        pushV(m, P, n, color);
      }
    }
    gridIndices(m, nu, nv, 0);
    return m;
  }

  /* ---------- KURVA BEZIER ---------- */
  // Bezier kubik 3D
  function bez3(p0, p1, p2, p3, t) {
    var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
            a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
            a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2]];
  }

  // Kurva halus melewati semua titik: rangkaian Bezier kubik (Catmull-Rom -> Bezier)
  // closed = true -> kurva tertutup (loop). t di [0,1].
  function spline(points, closed) {
    var n = points.length, segN = closed ? n : n - 1;
    function P(i) {
      if (closed) return points[((i % n) + n) % n];
      return points[Math.max(0, Math.min(n - 1, i))];
    }
    var segs = [];
    for (var i = 0; i < segN; i++) {
      var p0 = P(i), p1 = P(i + 1), pm = P(i - 1), p2 = P(i + 2);
      var c1 = V.add(p0, V.mul(V.sub(p1, pm), 1 / 6));
      var c2 = V.sub(p1, V.mul(V.sub(p2, p0), 1 / 6));
      segs.push([p0, c1, c2, p1]);
    }
    return function (t) {
      if (closed) t = t - Math.floor(t); else t = Math.min(1, Math.max(0, t));
      var s = t * segN, i = Math.min(Math.floor(s), segN - 1), u = s - i, sg = segs[i];
      return bez3(sg[0], sg[1], sg[2], sg[3], u);
    };
  }

  /* ---------- TUBE : mesh hasil generate mengikuti kurva ----------
     curve(t) -> [x,y,z]; radius(t, a) -> radius di posisi t & sudut a
     opt: closed, center (utk closed), hint (arah awal), flat(t) (pipihkan), caps */
  function tube(curve, radius, segs, sides, color, opt) {
    opt = opt || {};
    var closed = !!opt.closed;
    var capsOn = !closed && opt.caps !== false;
    var flat = opt.flat || function () { return 1; };
    var hint = opt.hint || [0, 0, 1];
    var CC = 5, e = 1e-3;
    var body = [], prevN = null, i, j;

    for (i = 0; i <= segs; i++) {
      var t = i / segs;
      var P = curve(t);
      var t0 = closed ? t - e : Math.max(0, t - e);
      var t1 = closed ? t + e : Math.min(1, t + e);
      var d = V.sub(curve(t1), curve(t0));
      var speed = V.len(d) / (t1 - t0);
      var T = V.norm(d), N;
      if (closed) {
        var q = V.sub(P, opt.center);
        N = V.norm(V.sub(q, V.mul(T, V.dot(q, T))));
      } else {
        var ref = prevN || hint;
        if (!prevN && Math.abs(V.dot(V.norm(ref), T)) > 0.95) ref = [0, 1, 0];
        N = V.norm(V.sub(ref, V.mul(T, V.dot(ref, T))));
      }
      prevN = N;
      body.push({ P: P, T: T, N: N, B: V.cross(T, N), t: t, speed: speed, k: 1, nT: 0, body: true });
    }

    var rings = [], rr, ph, f, l;
    if (capsOn) {
      f = body[0]; rr = radius(0, 0);
      for (j = 0; j <= CC; j++) {
        ph = Math.PI / 2 * (1 - j / CC);
        rings.push({ P: V.sub(f.P, V.mul(f.T, rr * Math.sin(ph))), T: f.T, N: f.N, B: f.B,
                     t: 0, k: Math.cos(ph), nT: -Math.sin(ph), body: false });
      }
    }
    rings = rings.concat(body);
    if (capsOn) {
      l = body[body.length - 1]; rr = radius(1, 0);
      for (j = 0; j <= CC; j++) {
        ph = Math.PI / 2 * (j / CC);
        rings.push({ P: V.add(l.P, V.mul(l.T, rr * Math.sin(ph))), T: l.T, N: l.N, B: l.B,
                     t: 1, k: Math.cos(ph), nT: Math.sin(ph), body: false });
      }
    }

    var m = newMesh();
    rings.forEach(function (R) {
      var fl = flat(R.t);
      for (var s = 0; s <= sides; s++) {
        var a = 2 * Math.PI * s / sides, ca = Math.cos(a), sa = Math.sin(a);
        var r = radius(R.t, a) * R.k;
        var p = V.add(R.P, V.add(V.mul(R.N, ca * r), V.mul(R.B, sa * r * fl)));
        var rad = V.norm(V.add(V.mul(R.N, ca), V.mul(R.B, sa / fl)));
        var n;
        if (R.body) {
          var ta = closed ? R.t - e : Math.max(0, R.t - e);
          var tb = closed ? R.t + e : Math.min(1, R.t + e);
          var slope = (radius(tb, a) - radius(ta, a)) / ((tb - ta) * R.speed);
          n = V.norm(V.sub(rad, V.mul(R.T, slope)));
        } else {
          n = V.norm(V.add(V.mul(rad, R.k), V.mul(R.T, R.nT)));
        }
        pushV(m, p, n, color);
      }
    });
    gridIndices(m, rings.length - 1, sides, 0);
    return m;
  }

  /* ---------- transformasi & gabung mesh ---------- */
  function transform(m, mat) {
    var nm = LIBS.normalMatrix(mat), o = newMesh(), k, x, y, z, p, n;
    for (k = 0; k < m.p.length; k += 3) {
      p = LIBS.transformPoint(mat, [m.p[k], m.p[k + 1], m.p[k + 2]]);
      x = m.n[k]; y = m.n[k + 1]; z = m.n[k + 2];
      n = V.norm([nm[0] * x + nm[3] * y + nm[6] * z,
                  nm[1] * x + nm[4] * y + nm[7] * z,
                  nm[2] * x + nm[5] * y + nm[8] * z]);
      o.p.push(p[0], p[1], p[2]);
      o.n.push(n[0], n[1], n[2]);
      o.c.push(m.c[k], m.c[k + 1], m.c[k + 2]);
    }
    o.i = m.i.slice();
    return o;
  }

  function merge(list) {
    var o = newMesh();
    list.forEach(function (m) {
      var base = o.p.length / 3, k;
      for (k = 0; k < m.p.length; k++) { o.p.push(m.p[k]); o.n.push(m.n[k]); o.c.push(m.c[k]); }
      for (k = 0; k < m.i.length; k++) o.i.push(m.i[k] + base);
    });
    return o;
  }

  return { newMesh: newMesh, ellipsoid: ellipsoid, frustum: frustum, cylinder: cylinder,
           surface: surface, tube: tube, bez3: bez3, spline: spline,
           transform: transform, merge: merge, tint: tint };
})();


/* ==========================================================
 *  BAGIAN 2 : SCENE GRAPH SEDERHANA (siap untuk animasi nanti)
 * ========================================================== */
function Node(name, mesh, shine) {
  this.name = name;
  this.mesh = mesh || null;
  this.shine = shine || 16;
  this.position = [0, 0, 0];      // translasi (pivot)
  this.rotation = [0, 0, 0];      // rotasi x,y,z (radian)
  this.scale = [1, 1, 1];
  this.base = null;               // matriks tetap sebelum T*R*S (mis. orientasi tangan)
  this.children = [];
  this.parent = null;
}
Node.prototype.add = function (c) { c.parent = this; this.children.push(c); return c; };
Node.prototype.local = function () {
  if (this.matrixOverride) return this.matrixOverride;   // dipakai IK lengan (Anim)
  var m = this.base ? new Float32Array(this.base) : LIBS.identity();
  m = LIBS.translate(m, this.position[0], this.position[1], this.position[2]);
  m = LIBS.rotateY(m, this.rotation[1]);
  m = LIBS.rotateX(m, this.rotation[0]);
  m = LIBS.rotateZ(m, this.rotation[2]);
  m = LIBS.scale(m, this.scale[0], this.scale[1], this.scale[2]);
  return m;
};


/* ==========================================================
 *  BAGIAN 3 : KARAKTER THE JANITOR
 * ========================================================== */
var Janitor = (function () {

  var COL = {
    skin:    [0.66, 0.62, 0.54],
    skinDk:  [0.50, 0.45, 0.38],
    cloth:   [0.80, 0.75, 0.63],   // perban kain
    jacket:  [0.46, 0.41, 0.27],
    jacketDk:[0.30, 0.27, 0.18],
    sleeve:  [0.52, 0.47, 0.32],
    hat:     [0.42, 0.27, 0.26],
    hatBand: [0.20, 0.14, 0.14],
    pants:   [0.28, 0.25, 0.20],
    shoe:    [0.15, 0.14, 0.15],
    teeth:   [0.93, 0.90, 0.78],
    mouth:   [0.22, 0.03, 0.05],
    lip:     [0.45, 0.24, 0.22],
    tongue:  [0.64, 0.22, 0.24],
    eye:     [0.96, 0.93, 0.72],
    pupil:   [0.04, 0.03, 0.02],
    button:  [0.14, 0.11, 0.07],
    band:    [0.06, 0.06, 0.06],
    ground:  [0.17, 0.20, 0.19]
  };

  var tint = Geo.tint;
  var PI = Math.PI;

  // letakkan mesh: posisi, rotasi (rad), skala
  function place(mesh, pos, rot, scl) {
    var m = LIBS.identity();
    pos = pos || [0, 0, 0]; rot = rot || [0, 0, 0]; scl = scl || [1, 1, 1];
    m = LIBS.translate(m, pos[0], pos[1], pos[2]);
    m = LIBS.rotateY(m, rot[1]);
    m = LIBS.rotateX(m, rot[0]);
    m = LIBS.rotateZ(m, rot[2]);
    m = LIBS.scale(m, scl[0], scl[1], scl[2]);
    return Geo.transform(mesh, m);
  }

  /* ---------------- dimensi kepala ---------------- */
  var HR = { x: 0.5, y: 0.62, z: 0.5 };     // radius ellipsoid kepala (memanjang di y)
  var HOFF = 0.6;                            // pusat kepala di atas pivot leher
  function headZ(x, y) {
    var v = 1 - (x / HR.x) * (x / HR.x) - (y / HR.y) * (y / HR.y);
    return HR.z * Math.sqrt(Math.max(v, 0));
  }
  function toHead(mesh) { return Geo.transform(mesh, LIBS.fromTranslation(0, HOFF, 0)); }

  /* ---------------- bentuk mulut (menyeringai lebar) ---------------- */
  var MW = 0.30;
  function yU(x) { var q = x / MW; return -0.33 + 0.07 * q * q; }
  function yL(x) { var q = x / MW; return yU(x) - 0.045 * Math.pow(Math.max(0, 1 - q * q), 0.6); }

  /* ---------------- bentuk jas ---------------- */
  var J0 = 0.45, JH = 0.9, JRB = 0.32, JRT = 0.23, JZ = 0.75;
  function jr(y) { return JRB + (JRT - JRB) * (y - J0) / JH; }           // radius jas pada tinggi y
  function jz(x, y) { var r = jr(y); return JZ * Math.sqrt(Math.max(0, r * r - x * x)); } // z permukaan depan

  /* ======================= BUILDER ======================= */

  // ---- KEPALA (ellipsoid memanjang + telinga) ----
  function buildSkull() {
    var skull = Geo.ellipsoid(HR.x, HR.y, HR.z, 36, 48, tint(COL.skin, 0.07, 1.3));
    var earL = place(Geo.ellipsoid(0.05, 0.10, 0.07, 12, 16, tint(COL.skin, 0.05)), [-0.5, -0.15, -0.02], [0, 0, 0.25]);
    var earR = place(Geo.ellipsoid(0.05, 0.10, 0.07, 12, 16, tint(COL.skin, 0.05)), [0.5, -0.15, -0.02], [0, 0, -0.25]);
    return toHead(Geo.merge([skull, earL, earR]));
  }

  // ---- PERBAN yang melilit mata (tube mengikuti kurva Bezier tertutup) ----
  function bandageLoop(y0, tilt, phase, rBase, seed) {
    var pts = [], N = 14, k;
    for (k = 0; k < N; k++) {
      var a = 2 * PI * k / N;
      var yy = y0 + tilt * Math.sin(a + phase);
      var f = Math.sqrt(Math.max(0, 1 - (yy / HR.y) * (yy / HR.y)));
      pts.push([HR.x * f * Math.sin(a), yy, HR.z * f * Math.cos(a)]);
    }
    return Geo.tube(Geo.spline(pts, true),
      function (t, a) { return rBase * (1 + 0.16 * Math.sin(t * 38 + a * 2 + seed)); },
      140, 12, tint(COL.cloth, 0.09, 1.6), { closed: true, center: [0, y0, 0] });
  }

  function buildBandage() {
    var list = [];
    // SATU lilitan kain lebar yang menutupi mata (permukaan hasil sapuan kurva)
    var yc = 0.21, hw = 0.18, tilt = 0.03;
    list.push(Geo.surface(function (u, v) {
      var a = 2 * PI * u;
      var yy = yc + tilt * Math.sin(a) + (v - 0.5) * 2 * hw;
      var f = Math.sqrt(Math.max(0, 1 - (yy / HR.y) * (yy / HR.y)));
      var fold = 0.035 * Math.sin(v * PI * 4 + a * 3) + 0.02 * Math.sin(a * 7 + v * 5);
      var s = 1 + 0.09 + fold;
      return [HR.x * f * Math.sin(a) * s, yy, HR.z * f * Math.cos(a) * s];
    }, 120, 16, tint(COL.cloth, 0.09, 1.6)));
    // gulungan kain di tepi atas & bawah (loop Bezier tertutup)
    list.push(bandageLoop(yc - hw, tilt, 0.0, 0.05, 0.3));
    list.push(bandageLoop(yc + hw, tilt, 0.0, 0.05, 1.7));
    // ujung perban yang menjuntai di sisi kiri (kurva Bezier terbuka, pipih seperti pita)
    var tail = Geo.spline([[-0.49, 0.40, 0.12], [-0.60, 0.26, 0.14], [-0.65, 0.04, 0.16], [-0.62, -0.18, 0.22]], false);
    list.push(Geo.tube(tail, function (t) { return 0.034 * (1 - 0.35 * t); }, 40, 10,
      tint(COL.cloth, 0.08, 1.5), { flat: function () { return 0.35; }, hint: [0, 0, 1] }));
    return toHead(Geo.merge(list));
  }

  // ---- MATA (sphere kecil) + pupil ----
  function buildEye() {
    var eye = Geo.ellipsoid(0.036, 0.036, 0.036, 14, 18, COL.eye);
    var pupil = place(Geo.ellipsoid(0.015, 0.015, 0.015, 8, 10, COL.pupil), [0, 0, 0.032]);
    return Geo.merge([eye, pupil]);
  }

  // ---- HIDUNG (tube mengikuti kurva Bezier) ----
  function buildNose() {
    var z0 = headZ(0, 0.0), z1 = headZ(0, -0.07), z2 = headZ(0, -0.15);
    var c = Geo.spline([[0, 0.0, z0 + 0.03], [0, -0.07, z1 + 0.07], [0, -0.15, z2 + 0.07]], false);
    var nose = Geo.tube(c, function (t) { return 0.022 + 0.026 * Math.sin(PI * (0.25 + 0.75 * t)); },
      30, 14, tint(COL.skin, 0.06), { hint: [1, 0, 0] });
    var nl = place(Geo.ellipsoid(0.014, 0.01, 0.014, 6, 8, COL.skinDk), [-0.022, -0.17, z2 + 0.085]);
    var nr = place(Geo.ellipsoid(0.014, 0.01, 0.014, 6, 8, COL.skinDk), [0.022, -0.17, z2 + 0.085]);
    return toHead(Geo.merge([nose, nl, nr]));
  }

  // ---- MULUT : permukaan loft di antara 2 kurva + bibir (tube) + gigi + lidah ----
  function buildMouth() {
    var parts = [], k;   // mulut tertutup: hanya dua bibir yang saling bertemu
    // bibir atas & bawah (Bezier spline mengikuti permukaan kepala)
    var up = [], lo = [];
    for (k = 0; k <= 10; k++) {
      var x = -MW + 0.06 * k;
      var cr = Math.pow(Math.max(0, 1 - (x / MW) * (x / MW)), 0.6);   // 0 di sudut, 1 di tengah
      up.push([x, yU(x) + 0.008 * cr, headZ(x, yU(x)) + 0.014]);
      lo.push([x, yU(x) - 0.010 * cr, headZ(x, yU(x)) + 0.014]);
    }
    parts.push(Geo.tube(Geo.spline(up, false), function (t) { return 0.010 + 0.008 * Math.sin(PI * t); },
      80, 10, tint(COL.lip, 0.08), { hint: [0, 1, 0] }));
    parts.push(Geo.tube(Geo.spline(lo, false), function (t) { return 0.012 + 0.010 * Math.sin(PI * t); },
      80, 10, tint(COL.lip, 0.08), { hint: [0, 1, 0] }));

    return toHead(Geo.merge(parts));
  }

  // ---- TOPI : cone terpotong (brim & mahkota) + tepi brim kurva Bezier ----
  function buildHat() {
    var parts = [];
    parts.push(Geo.frustum(0.64, 0.50, 0.05, 48, tint(COL.hat, 0.06, 1.2)));                 // brim
    parts.push(place(Geo.frustum(0.34, 0.29, 0.30, 40, tint(COL.hat, 0.07, 1.2)), [0, 0.03, 0])); // crown
    parts.push(place(Geo.frustum(0.346, 0.338, 0.07, 40, COL.hatBand), [0, 0.03, 0]));       // pita topi
    var rim = [], k, N = 12;
    for (k = 0; k < N; k++) {
      var a = 2 * PI * k / N, w = 1 + 0.035 * Math.sin(3 * a + 0.6);
      rim.push([0.64 * w * Math.cos(a), 0.02, 0.64 * w * Math.sin(a)]);
    }
    parts.push(Geo.tube(Geo.spline(rim, true), function () { return 0.024; }, 90, 8,
      tint(COL.hat, 0.05), { closed: true, center: [0, 0.02, 0] }));
    return Geo.merge(parts);
  }

  // ---- BADAN / JAS : cone terpotong + detail kurva (kerah, hem, saku, kancing) ----
  function buildBody() {
    var parts = [], k;
    // inti (tutup atas/bawah) sedikit lebih kecil + permukaan jas berlipat di atasnya
    var core = Geo.frustum(JRB * 0.93, JRT * 0.93, JH, 32, tint(COL.jacket, 0.07, 1.1));
    parts.push(place(core, [0, J0, 0], [0, 0, 0], [1, 1, JZ]));
    // warna usang: hem menggelap/kotor, noda tak beraturan, variasi kain
    var jBase = tint(COL.jacket, 0.07, 1.1);
    var jColor = function (p) {
      var c = jBase(p), v = p[1] / JH;
      var st = Math.max(0, Math.sin(p[0] * 13 + p[1] * 7) * Math.sin(p[2] * 11 - p[1] * 5));
      var k = 1 - 0.30 * Math.pow(1 - v, 3) - 0.16 * st * st - 0.05 * Math.max(0, Math.sin(p[1] * 60 + p[0] * 9));
      return [c[0] * k, c[1] * k, c[2] * k];
    };
    var jacket = Geo.surface(function (u, v) {
      var th = -2 * PI * u, a = ((th % (2 * PI)) + 2 * PI) % (2 * PI), y = v * JH;
      var calm = 1 - 0.95 * Math.exp(-Math.pow((a - PI / 2) / 0.9, 2));       // depan (kancing/saku/kelim) tetap rata
      var f = 0.035 * (0.3 + 0.7 * (1 - v)) * calm * (Math.sin(6 * th + 0.5) + 0.6 * Math.sin(11 * th + 1.7) + 0.35 * Math.sin(3 * th + 2.2)) +
              0.012 * (1 - v) * calm * Math.sin(v * 40 + 3 * th);             // lipatan vertikal + kerutan horizontal
      var r = jr(J0 + y) * (1 + f);
      return [r * Math.cos(th), y, r * Math.sin(th)];
    }, 96, 14, jColor);
    parts.push(place(jacket, [0, J0, 0], [0, 0, 0], [1, 1, JZ]));

    // hem bawah (loop Bezier)
    var hem = [], N = 14;
    for (k = 0; k < N; k++) {
      var a = 2 * PI * k / N;
      hem.push([(JRB + 0.005) * Math.sin(a), J0 + 0.01, JRB * JZ * Math.cos(a) * 1.01]);
    }
    parts.push(Geo.tube(Geo.spline(hem, true), function (t, a) { return 0.024 * (1 + 0.2 * Math.sin(t * 30 + a)); },
      100, 8, tint(COL.jacketDk, 0.06), { closed: true, center: [0, J0, 0] }));

    // kerah
    var col = [];
    for (k = 0; k < 12; k++) {
      var b = 2 * PI * k / 12, w = 1 + 0.06 * Math.sin(3 * b);
      col.push([0.25 * w * Math.sin(b), 1.36, 0.19 * w * Math.cos(b)]);
    }
    parts.push(Geo.tube(Geo.spline(col, true), function (t, a) { return 0.05 * (1 + 0.15 * Math.sin(t * 26 + a * 2)); },
      100, 10, tint(COL.jacketDk, 0.07, 1.4), { closed: true, center: [0, 1.36, 0] }));

    // garis tengah jas (kurva Bezier mengikuti permukaan depan)
    var seam = [];
    for (k = 0; k <= 6; k++) { var ys = 1.33 - 0.14 * k; seam.push([0, ys, jz(0, ys) + 0.004]); }
    parts.push(Geo.tube(Geo.spline(seam, false), function () { return 0.008; }, 40, 6, COL.jacketDk, { hint: [1, 0, 0] }));

    // saku (loop Bezier persegi membulat)
    function pocket(cx, cy, w, h) {
      var pts = [[-w, h], [0, h * 1.05], [w, h], [w * 1.03, 0], [w, -h], [0, -h * 1.05], [-w, -h], [-w * 1.03, 0]]
        .map(function (q) { var x = cx + q[0], y = cy + q[1]; return [x, y, jz(x, y) + 0.004]; });
      return Geo.tube(Geo.spline(pts, true), function () { return 0.007; }, 50, 6, COL.jacketDk,
        { closed: true, center: [cx, cy, jz(cx, cy) * 0.2] });
    }
    parts.push(pocket(-0.13, 0.76, 0.075, 0.06));
    parts.push(pocket(0.13, 0.76, 0.075, 0.06));
    parts.push(pocket(0.11, 1.12, 0.06, 0.045));

    // kancing (ellipsoid kecil)
    [0.62, 0.82, 1.02, 1.20].forEach(function (y) {
      parts.push(place(Geo.ellipsoid(0.028, 0.028, 0.013, 10, 12, COL.button), [0.0, y, jz(0, y) + 0.008]));
    });

    // bahu (ellipsoid) - menutup pangkal lengan
    parts.push(place(Geo.ellipsoid(0.10, 0.085, 0.10, 14, 18, tint(COL.jacket, 0.05)), [-0.22, 1.27, 0]));
    parts.push(place(Geo.ellipsoid(0.10, 0.085, 0.10, 14, 18, tint(COL.jacket, 0.05)), [0.22, 1.27, 0]));
    return Geo.merge(parts);
  }

  // ---- LEHER (cone terpotong) + lilitan kain di leher ----
  function buildNeck() {
    var parts = [];
    parts.push(place(Geo.frustum(0.15, 0.11, 0.40, 24, tint(COL.skin, 0.05)), [0, 1.3, 0]));
    [1.44, 1.52].forEach(function (y, idx) {
      var pts = [], k;
      for (k = 0; k < 10; k++) {
        var a = 2 * PI * k / 10;
        pts.push([0.15 * Math.sin(a), y + 0.015 * Math.sin(a + idx), 0.15 * Math.cos(a)]);
      }
      parts.push(Geo.tube(Geo.spline(pts, true), function (t, a) { return 0.028 * (1 + 0.2 * Math.sin(t * 24 + a)); },
        70, 8, tint(COL.cloth, 0.08), { closed: true, center: [0, y, 0] }));
    });
    return Geo.merge(parts);
  }

  // ---- KAKI (cylinder pendek) & SEPATU (ellipsoid) ----
  // Kaki dibagi di lutut (y=-0.21 dari pivot pinggul): paha di node kaki, betis + sepatu di node 'shin*'.
  function buildLeg() {
    var pc = tint(COL.pants, 0.06, 1.2);
    return Geo.merge([
      place(Geo.cylinder(0.085, 0.21, 20, pc), [0, -0.21, 0]),
      place(Geo.ellipsoid(0.088, 0.088, 0.088, 10, 14, pc), [0, -0.21, 0])          // sendi lutut
    ]);
  }
  function buildShin() {
    var pc = tint(COL.pants, 0.06, 1.2);
    return Geo.merge([
      place(Geo.cylinder(0.085, 0.21, 20, pc), [0, -0.21, 0]),
      place(Geo.cylinder(0.096, 0.045, 20, tint(COL.jacketDk, 0.08, 1.4), false), [0, -0.21, 0])   // manset celana usang
    ]);
  }
  function buildShoe() {
    return Geo.ellipsoid(0.115, 0.075, 0.19, 18, 24, tint(COL.shoe, 0.10, 1.5));
  }

  // ---- LENGAN PANJANG : tube mengikuti kurva Bezier ----
  function buildArm(S) {
    var shoulder = [S * 0.22, 1.27, 0];
    var world = [[0.22, 1.27, 0.0], [0.45, 1.27, 0.0], [0.62, 1.05, 0.06],
                 [0.70, 0.70, 0.20], [0.68, 0.38, 0.42], [0.62, 0.14, 0.66]];
    var pts = world.map(function (p) { return [S * p[0] - shoulder[0], p[1] - shoulder[1], p[2] - shoulder[2]]; });
    var curve = Geo.spline(pts, false);

    // lengan: radius mengecil ke pergelangan, kerutan kain makin banyak di ujung
    var arm = Geo.tube(curve, function (t, a) {
      return (0.078 - 0.026 * t) * (1 + (0.05 + 0.12 * t * t) * Math.sin(t * 60 + a * 2));
    }, 180, 20, tint(COL.sleeve, 0.06, 1.1), { hint: [0, 0, 1] });

    var parts = [arm];

    // ujung lengan (manset): loop kurva Bezier tertutup, 2 lilitan
    var E = curve(1), T = V.norm(V.sub(curve(1), curve(0.985)));
    var ref = Math.abs(T[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    var cn = V.norm(V.cross(T, ref)), cb = V.cross(T, cn);
    [0, 1].forEach(function (L) {
      var c0 = V.sub(E, V.mul(T, 0.045 * L)), loop = [], k;
      for (k = 0; k < 10; k++) {
        var a = 2 * PI * k / 10, rc = (0.062 + 0.004 * L) * (1 + 0.10 * Math.sin(3 * a + L));
        loop.push(V.add(V.add(c0, V.mul(T, 0.008 * Math.sin(2 * a))),
                        V.add(V.mul(cn, rc * Math.cos(a)), V.mul(cb, rc * Math.sin(a)))));
      }
      parts.push(Geo.tube(Geo.spline(loop, true), function (t, a) { return 0.019 * (1 + 0.15 * Math.sin(t * 20 + a)); },
        60, 8, tint(COL.jacketDk, 0.07), { closed: true, center: c0 }));
    });

    // ban lengan hitam di lengan kiri (cylinder, mengikuti tangen kurva)
    if (S < 0) {
      var Pb = curve(0.10), Tb = V.norm(V.sub(curve(0.105), curve(0.095)));
      parts.push(Geo.transform(Geo.cylinder(1, 1, 24, COL.band),
        LIBS.segmentMatrix(V.sub(Pb, V.mul(Tb, 0.04)), V.add(Pb, V.mul(Tb, 0.04)), 0.092)));
    }

    // orientasi tangan di ujung lengan
    var hz = V.norm([T[0], T[1] * 0.45, T[2]]);
    var up = [0, 1, 0];
    var hy = V.norm(V.sub(up, V.mul(hz, V.dot(up, hz))));
    var hx = V.cross(hy, hz);
    return { mesh: Geo.merge(parts), shoulder: shoulder, wristBase: LIBS.basis(hx, hy, hz, E) };
  }

  // ---- TELAPAK TANGAN : tube pipih mengikuti kurva Bezier ----
  function buildPalm() {
    var c = Geo.spline([[0, 0.01, -0.05], [0, 0.02, 0.03], [0, 0.0, 0.10], [0, -0.005, 0.15]], false);
    return Geo.tube(c, function (t) { return 0.040 + 0.024 * Math.sin(PI * (0.15 + 0.7 * t)); },
      30, 16, tint(COL.skin, 0.05), { hint: [1, 0, 0], flat: function () { return 0.5; } });
  }

  // ---- JARI : cylinder kecil berantai mengikuti kurva Bezier ----
  function buildFinger(L, spread, drop, thick) {
    var P0 = [0, 0, 0], P1 = [spread * 0.25, 0.006, L * 0.33],
        P2 = [spread * 0.62, 0.0 - drop * 0.4, L * 0.68], P3 = [spread, -drop, L];
    var N = 4, pts = [], parts = [], k;
    for (k = 0; k <= N; k++) pts.push(Geo.bez3(P0, P1, P2, P3, k / N));
    var skin = tint(COL.skin, 0.05, 1.5);
    parts.push(Geo.ellipsoid(thick * 1.15, thick * 1.15, thick * 1.15, 8, 10, skin));
    for (k = 0; k < N; k++) {
      var ra = thick * (1 - 0.38 * k / N), rb = thick * (1 - 0.38 * (k + 1) / N);
      parts.push(Geo.transform(Geo.frustum(1, rb / ra, 1, 10, skin), LIBS.segmentMatrix(pts[k], pts[k + 1], ra)));
      var jr2 = rb * 1.12;
      parts.push(place(Geo.ellipsoid(jr2, jr2, jr2, 8, 10, skin), pts[k + 1]));
    }
    return Geo.merge(parts);
  }

  /* ======================= RAKIT KARAKTER ======================= */
  function create(gl) {
    var uint = gl && gl.getExtension('OES_element_index_uint');
    if (gl && !uint) console.warn('OES_element_index_uint tidak tersedia; mesh besar bisa rusak.');

    function upload(m) {
      var o = {};
      function mk(arr, Type) {
        var b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, new Type(arr), gl.STATIC_DRAW);
        return b;
      }
      o.pos = mk(m.p, Float32Array); o.nor = mk(m.n, Float32Array); o.col = mk(m.c, Float32Array);
      o.idx = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.idx);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, uint ? new Uint32Array(m.i) : new Uint16Array(m.i), gl.STATIC_DRAW);
      o.count = m.i.length;
      o.type = uint ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      return o;
    }
    function node(name, mesh, shine) {
      return new Node(name, mesh ? (gl ? upload(mesh) : mesh) : null, shine);
    }

    var nodes = {};
    function reg(n) { nodes[n.name] = n; return n; }

    // ground (bukan bagian karakter)
    var groundMesh = Geo.frustum(3.4, 3.4, 0.05, 72, function (p) {
      var d = Math.sqrt(p[0] * p[0] + p[2] * p[2]) / 3.4, k = 1 - 0.55 * d * d;
      return [COL.ground[0] * k, COL.ground[1] * k, COL.ground[2] * k];
    });
    var ground = reg(node('ground', place(groundMesh, [0, -0.05, 0]), 4));

    // root
    var root = reg(new Node('root'));

    // badan
    var body = root.add(reg(node('body', buildBody(), 10)));
    body.add(reg(node('neck', buildNeck(), 12)));

    // kaki + sepatu
    [-1, 1].forEach(function (s) {
      var leg = root.add(reg(node(s < 0 ? 'legL' : 'legR', buildLeg(), 8)));
      leg.position = [s * 0.14, 0.5, 0];
      var shin = leg.add(reg(node(s < 0 ? 'shinL' : 'shinR', buildShin(), 8)));
      shin.position = [0, -0.21, 0];
      var shoe = shin.add(reg(node(s < 0 ? 'shoeL' : 'shoeR', buildShoe(), 30)));
      shoe.position = [0, -0.215, 0.07];
    });

    // kepala (pivot di leher)
    var head = body.add(reg(node('head', buildSkull(), 20)));
    head.position = [0, 1.6, 0];
    head.rotation = [LIBS.degToRad(8), 0, 0];          // sedikit menunduk
    head.add(reg(node('bandage', buildBandage(), 6)));
    head.add(reg(node('nose', buildNose(), 18)));
    head.add(reg(node('mouth', buildMouth(), 40)));
    var eyeMesh = buildEye();
    [-1, 1].forEach(function (s) {
      var e = head.add(reg(node(s < 0 ? 'eyeL' : 'eyeR', eyeMesh, 70)));
      e.position = [s * 0.17, 0.22 + HOFF, headZ(s * 0.17, 0.22) - 0.03];
    });
    var hat = head.add(reg(node('hat', buildHat(), 12)));
    hat.position = [0, HOFF + 0.52, 0];
    hat.rotation = [LIBS.degToRad(4), 0, LIBS.degToRad(8)];

    // lengan panjang + tangan + jari
    var palmMesh = buildPalm();
    [-1, 1].forEach(function (s) {
      var A = buildArm(s), side = s < 0 ? 'L' : 'R';
      var arm = body.add(reg(node('arm' + side, A.mesh, 8)));
      arm.position = A.shoulder;
      var wrist = arm.add(reg(node('wrist' + side, null)));
      wrist.base = A.wristBase;
      wrist.add(reg(node('palm' + side, palmMesh, 14)));
      // 4 jari panjang + ibu jari (cylinder kecil mengikuti Bezier)
      var fingers = [
        { n: 'index',  bx: -0.040 * s, L: 0.30, sp: -0.018 * s, drop: 0.03 },
        { n: 'middle', bx: -0.013 * s, L: 0.34, sp: -0.004 * s, drop: 0.03 },
        { n: 'ring',   bx:  .014 * s, L: 0.31, sp:  0.010 * s, drop: 0.03 },
        { n: 'pinky',  bx:  0.040 * s, L: 0.24, sp:  0.030 * s, drop: 0.025 }
      ];
      fingers.forEach(function (f) {
        var fn = wrist.add(reg(node(f.n + side, buildFinger(f.L, f.sp, f.drop, 0.0175), 18)));
        fn.position = [f.bx, 0, 0.14];
      });
      var th = wrist.add(reg(node('thumb' + side, buildFinger(0.20, -0.13 * s, 0.02, 0.019), 18)));
      th.position = [-0.052 * s, 0, 0.02];
      th.rotation = [0, 0.25 * s, 0];
    });

    /* ---------- menggambar ---------- */
    function drawNode(loc, n, parent) {
      var w = LIBS.multiply(parent, n.local());
      if (n.mesh) {
        gl.uniformMatrix4fv(loc.uModel, false, w);
        gl.uniformMatrix3fv(loc.uNormalMat, false, LIBS.normalMatrix(w));
        gl.uniform1f(loc.uShine, n.shine);
        gl.bindBuffer(gl.ARRAY_BUFFER, n.mesh.pos);
        gl.vertexAttribPointer(loc.aPosition, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, n.mesh.nor);
        gl.vertexAttribPointer(loc.aNormal, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, n.mesh.col);
        gl.vertexAttribPointer(loc.aColor, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, n.mesh.idx);
        gl.drawElements(gl.TRIANGLES, n.mesh.count, n.mesh.type, 0);
      }
      for (var i = 0; i < n.children.length; i++) drawNode(loc, n.children[i], w);
    }

    return {
      root: root, ground: ground, nodes: nodes,
      // tempat untuk animasi nanti: ubah node.position / node.rotation / node.scale berdasarkan waktu
      update: function (timeSeconds) { /* TODO animasi */ },
      draw: function (loc) {
        var I = LIBS.identity();
        drawNode(loc, ground, I);
        drawNode(loc, root, I);
      }
    };
  }

  return { create: create };
})();

window.createJanitorModel = function () {
  var janitor = Janitor.create(null);   // gl = null -> mesh tetap berupa array
  return { root: janitor.root, nodes: janitor.nodes };
};


/* ==========================================================
 *  BAGIAN 4 : SHADER, KAMERA & LOOP RENDER
 *  (dipindah dari index.html; index.html hanya berisi canvas)
 * ========================================================== */
var VS_SRC = [
  'attribute vec3 aPosition;',
  'attribute vec3 aNormal;',
  'attribute vec3 aColor;',
  'uniform mat4 uModel, uView, uProj;',
  'uniform mat3 uNormalMat;',
  'varying vec3 vN, vPos, vColor;',
  'void main() {',
  '  vec4 wp = uModel * vec4(aPosition, 1.0);',
  '  vPos = wp.xyz;',
  '  vN = uNormalMat * aNormal;',
  '  vColor = aColor;',
  '  gl_Position = uProj * uView * wp;',
  '}'
].join('\n');

var FS_SRC = [
  'precision mediump float;',
  'varying vec3 vN, vPos, vColor;',
  'uniform vec3 uEye;',
  'uniform float uShine;',
  'void main() {',
  '  vec3 N = normalize(vN);',
  '  vec3 Vd = normalize(uEye - vPos);',
  '  if (dot(N, Vd) < 0.0) N = -N;',                                   // dua sisi
  '  vec3 L1 = normalize(vec3(-0.5, 0.9, 0.7));',                      // key light (hangat)
  '  vec3 L2 = normalize(vec3(0.7, 0.2, -0.6));',                      // rim/back light (dingin)
  '  vec3 L3 = normalize(vec3(0.6, 0.3, 0.7));',                       // fill light
  '  float d1 = max(dot(N, L1), 0.0);',
  '  float d2 = max(dot(N, L2), 0.0);',
  '  float d3 = max(dot(N, L3), 0.0);',
  '  vec3 amb = mix(vec3(0.16, 0.15, 0.13), vec3(0.30, 0.33, 0.34), N.y * 0.5 + 0.5);',
  '  vec3 col = vColor * (amb + vec3(1.0, 0.92, 0.80) * d1 * 0.80',
  '                           + vec3(0.30, 0.42, 0.50) * d2 * 0.40',
  '                           + vec3(0.50, 0.50, 0.55) * d3 * 0.20);',
  '  vec3 H = normalize(L1 + Vd);',
  '  col += vec3(pow(max(dot(N, H), 0.0), uShine) * 0.22);',           // specular
  '  col += vec3(0.28, 0.33, 0.30) * pow(1.0 - max(dot(N, Vd), 0.0), 3.0) * 0.12;', // rim
  '  float dist = length(uEye - vPos);',
  '  col = mix(col, vec3(0.06, 0.08, 0.08), clamp((dist - 9.0) / 16.0, 0.0, 0.6));', // kabut
  '  gl_FragColor = vec4(col, 1.0);',
  '}'
].join('\n');

function startJanitorApp() {
  var canvas = document.getElementById('glcanvas');
  var gl = canvas.getContext('webgl', { antialias: true });
  if (!gl) { alert('WebGL tidak didukung di browser ini.'); return; }

  var prog = LIBS.createProgram(gl, VS_SRC, FS_SRC);
  gl.useProgram(prog);

  var loc = {
    aPosition: gl.getAttribLocation(prog, 'aPosition'),
    aNormal:   gl.getAttribLocation(prog, 'aNormal'),
    aColor:    gl.getAttribLocation(prog, 'aColor'),
    uModel:    gl.getUniformLocation(prog, 'uModel'),
    uView:     gl.getUniformLocation(prog, 'uView'),
    uProj:     gl.getUniformLocation(prog, 'uProj'),
    uNormalMat:gl.getUniformLocation(prog, 'uNormalMat'),
    uEye:      gl.getUniformLocation(prog, 'uEye'),
    uShine:    gl.getUniformLocation(prog, 'uShine')
  };
  gl.enableVertexAttribArray(loc.aPosition);
  gl.enableVertexAttribArray(loc.aNormal);
  gl.enableVertexAttribArray(loc.aColor);

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.09, 0.12, 0.12, 1);

  var janitor = Janitor.create(gl);
  window.janitor = janitor;   // supaya bisa diutak-atik dari console

  /* ---------------- kamera orbit ---------------- */
  var DEF = { yaw: 0.45, pitch: 0.15, dist: 7.0, target: [0, 1.25, 0.3] };
  var cam = { yaw: DEF.yaw, pitch: DEF.pitch, dist: DEF.dist, target: DEF.target.slice() };
  var dragging = false, panning = false, lx = 0, ly = 0;

  canvas.addEventListener('pointerdown', function (e) {
    dragging = true; panning = e.shiftKey || e.button === 2; lx = e.clientX; ly = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', function () { dragging = false; });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    if (panning) {
      var s = cam.dist * 0.0016;
      var right = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)];
      cam.target[0] -= right[0] * dx * s;
      cam.target[2] -= right[2] * dx * s;
      cam.target[1] = Math.max(0, cam.target[1] + dy * s);
    } else {
      cam.yaw -= dx * 0.008;
      cam.pitch = Math.max(-0.2, Math.min(1.4, cam.pitch + dy * 0.008));
    }
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    cam.dist = Math.max(2.0, Math.min(16, cam.dist * (1 + e.deltaY * 0.001)));
  }, { passive: false });

  /* ---------------- resize ---------------- */
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  /* ---------------- loop render ---------------- */
  function frame(now) {
    resize();
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    var eye = [cam.target[0] + cam.dist * cp * Math.sin(cam.yaw),
               cam.target[1] + cam.dist * sp,
               cam.target[2] + cam.dist * cp * Math.cos(cam.yaw)];
    var view = LIBS.lookAt(eye, cam.target, [0, 1, 0]);
    var proj = LIBS.perspective(LIBS.degToRad(40), canvas.width / canvas.height, 0.1, 60);

    gl.uniformMatrix4fv(loc.uView, false, view);
    gl.uniformMatrix4fv(loc.uProj, false, proj);
    gl.uniform3fv(loc.uEye, eye);

    janitor.update(now / 1000);
    janitor.draw(loc);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}