/* ==========================================================
 * primitives.js - generator bentuk 3D (dibangun manual, tanpa library)
 *
 * Semua fungsi mengembalikan "soup":
 *   { p:[x,y,z,...], n:[nx,ny,nz,...], c:[r,g,b,...] }
 * (non-indexed, tiap 3 vertex = 1 segitiga, normal per-vertex)
 *
 * Objek quadric:
 *   - ellipsoid()      x²/a² + y²/b² + z²/c² = 1
 *   - frustum()        kerucut terpotong (quadric: cone)
 *   - hyperboloid1()   hyperboloid 1 sheet: x²/a² + z²/a² - y²/c² = 1
 * Kurva:
 *   - bez(), bezierRevolve()  kurva Bézier kubik -> surface of revolution
 * ========================================================== */
var Prim = (function () {
  var sub = LIBS.sub, dot = LIBS.dot, cross = LIBS.cross, unit = LIBS.normalize;

  function Soup() { return { p: [], n: [], c: [] }; }

  /** Tambah segitiga; winding otomatis disesuaikan dengan normal vertex
   *  supaya selalu CCW terhadap normal (dibutuhkan oleh CSG). */
  function addTri(s, A, B, C, nA, nB, nC, col) {
    var g = cross(sub(B, A), sub(C, A));
    if (dot(g, g) < 1e-16) return; // segitiga degenerate (di kutub)
    var avg = [nA[0] + nB[0] + nC[0], nA[1] + nB[1] + nC[1], nA[2] + nB[2] + nC[2]];
    if (dot(g, avg) < 0) {
      var t = B; B = C; C = t;
      t = nB; nB = nC; nC = t;
    }
    s.p.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
    s.n.push(nA[0], nA[1], nA[2], nB[0], nB[1], nB[2], nC[0], nC[1], nC[2]);
    for (var i = 0; i < 3; i++) s.c.push(col[0], col[1], col[2]);
  }

  /** Normal numerik dari turunan parsial permukaan parametrik fn(u,v). */
  function numericNormal(fn, u, v, hint) {
    var e = 1e-3, n = [0, 0, 0];
    for (var k = 0; k < 4; k++) {
      var du = sub(fn(u + e, v), fn(u - e, v));
      var dv = sub(fn(u, Math.min(1, v + e)), fn(u, Math.max(0, v - e)));
      n = cross(du, dv);
      if (dot(n, n) > 1e-24) break;
      e *= 4;
    }
    n = unit(n);
    if (hint && dot(n, hint(fn(u, v))) < 0) n = [-n[0], -n[1], -n[2]];
    return n;
  }

  /** Mesh dari permukaan parametrik fn(u,v), u,v in [0,1].
   *  opt.normal(u,v,p) -> normal analitik (opsional)
   *  opt.hint(p)       -> arah "keluar" untuk menentukan tanda normal numerik */
  function grid(s, fn, nu, nv, col, opt) {
    opt = opt || {};
    var P = [], N = [], i, j;
    for (i = 0; i <= nu; i++) {
      P[i] = []; N[i] = [];
      for (j = 0; j <= nv; j++) {
        var u = i / nu, v = j / nv, p = fn(u, v);
        P[i][j] = p;
        N[i][j] = opt.normal ? opt.normal(u, v, p) : numericNormal(fn, u, v, opt.hint);
      }
    }
    for (i = 0; i < nu; i++) {
      for (j = 0; j < nv; j++) {
        addTri(s, P[i][j], P[i + 1][j], P[i + 1][j + 1], N[i][j], N[i + 1][j], N[i + 1][j + 1], col);
        addTri(s, P[i][j], P[i + 1][j + 1], P[i][j + 1], N[i][j], N[i + 1][j + 1], N[i][j + 1], col);
      }
    }
  }

  /* ---------------- Bézier ---------------- */
  /** Kurva Bézier kubik; ctrl = 4 titik (array n-dimensi), t in [0,1] */
  function bez(ctrl, t) {
    var mt = 1 - t, a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    var out = [];
    for (var k = 0; k < ctrl[0].length; k++) {
      out.push(a * ctrl[0][k] + b * ctrl[1][k] + c * ctrl[2][k] + d * ctrl[3][k]);
    }
    return out;
  }

  /* ---------------- Quadric: Ellipsoid ---------------- */
  function ellipsoid(c, r, col, nu, nv) {
    var s = Soup();
    grid(s, function (u, v) {
      var th = 2 * Math.PI * u, ph = -Math.PI / 2 + Math.PI * v;
      return [
        c[0] + r[0] * Math.cos(ph) * Math.cos(th),
        c[1] + r[1] * Math.sin(ph),
        c[2] + r[2] * Math.cos(ph) * Math.sin(th)
      ];
    }, nu || 24, nv || 16, col, {
      normal: function (u, v, p) {
        return unit([(p[0] - c[0]) / (r[0] * r[0]), (p[1] - c[1]) / (r[1] * r[1]), (p[2] - c[2]) / (r[2] * r[2])]);
      }
    });
    return s;
  }

  /* ---------------- Surface of revolution (sumbu Y) ----------------
   * rfn(y)  : radius pada ketinggian y
   * drfn(y) : turunan dr/dy  (untuk normal analitik)
   * o: sx, sz (skala elips penampang), nu, nv, warp(t), capBottom, capTop, capColor */
  function revolve(rfn, drfn, y0, y1, col, o) {
    o = o || {};
    var sx = o.sx || 1, sz = o.sz || 1, nu = o.nu || 28, nv = o.nv || 8;
    var warp = o.warp || function (t) { return t; };
    var s = Soup();
    grid(s, function (u, v) {
      var y = y0 + (y1 - y0) * warp(v), r = rfn(y), th = 2 * Math.PI * u;
      return [sx * r * Math.cos(th), y, sz * r * Math.sin(th)];
    }, nu, nv, col, {
      normal: function (u, v, p) {
        var y = p[1], r = rfn(y);
        return unit([p[0] / (sx * sx), -r * drfn(y), p[2] / (sz * sz)]);
      }
    });
    var capCol = o.capColor || col;
    function cap(y, ny) {
      grid(s, function (u, v) {
        var th = 2 * Math.PI * u, r = rfn(y) * v;
        return [sx * r * Math.cos(th), y, sz * r * Math.sin(th)];
      }, nu, 2, capCol, { normal: function () { return [0, ny, 0]; } });
    }
    if (o.capBottom) cap(y0, -1);
    if (o.capTop) cap(y1, 1);
    return s;
  }

  /* ---------------- Quadric: kerucut terpotong ---------------- */
  function frustum(y0, r0, y1, r1, col, o) {
    var k = (r1 - r0) / (y1 - y0);
    return revolve(function (y) { return r0 + k * (y - y0); }, function () { return k; }, y0, y1, col, o);
  }

  /* ---------------- Quadric: hyperboloid 1 sheet ----------------
   * r(y) = a * sqrt(1 + (y/c)²)  (radius terkecil a di y = 0)        */
  function hyperboloid1(a, c, y0, y1, col, o) {
    return revolve(
      function (y) { return a * Math.sqrt(1 + (y / c) * (y / c)); },
      function (y) { return a * (y / (c * c)) / Math.sqrt(1 + (y / c) * (y / c)); },
      y0, y1, col, o
    );
  }

  /* ---------------- Bézier profile revolve ----------------
   * ctrl = 4 titik kontrol [radius, y]; profil diputar mengelilingi sumbu Y */
  function bezierRevolve(ctrl, col, o) {
    o = o || {};
    var sx = o.sx || 1, sz = o.sz || 1, s = Soup();
    grid(s, function (u, v) {
      var B = bez(ctrl, v), th = 2 * Math.PI * u;
      return [sx * B[0] * Math.cos(th), B[1], sz * B[0] * Math.sin(th)];
    }, o.nu || 28, o.nv || 10, col, { hint: function (p) { return [p[0], 0, p[2]]; } });
    return s;
  }

  /* ---------------- Box (untuk cutter CSG) ---------------- */
  function box(c, h, col) {
    var s = Soup();
    for (var a = 0; a < 3; a++) {
      for (var sg = -1; sg <= 1; sg += 2) {
        var b = (a + 1) % 3, d = (a + 2) % 3;
        var nrm = [0, 0, 0]; nrm[a] = sg;
        var corner = function (sb, sd) {
          var p = c.slice();
          p[a] += sg * h[a]; p[b] += sb * h[b]; p[d] += sd * h[d];
          return p;
        };
        var q = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
        addTri(s, q[0], q[1], q[2], nrm, nrm, nrm, col);
        addTri(s, q[0], q[2], q[3], nrm, nrm, nrm, col);
      }
    }
    return s;
  }

  /* ---------------- util soup ---------------- */
  function transform(s, m) {
    var nm = LIBS.normalMatrix(m), out = Soup(), i;
    for (i = 0; i < s.p.length; i += 3) {
      var p = LIBS.transformPoint(m, [s.p[i], s.p[i + 1], s.p[i + 2]]);
      var n = LIBS.transformNormal(nm, [s.n[i], s.n[i + 1], s.n[i + 2]]);
      out.p.push(p[0], p[1], p[2]);
      out.n.push(n[0], n[1], n[2]);
      out.c.push(s.c[i], s.c[i + 1], s.c[i + 2]);
    }
    return out;
  }

  /** letakkan soup: translasi t, rotasi Y (ry) lalu X (rx) */
  function place(s, t, rx, ry) {
    var m = LIBS.multiply(LIBS.translation(t[0], t[1], t[2]),
      LIBS.multiply(LIBS.rotationY(ry || 0), LIBS.rotationX(rx || 0)));
    return transform(s, m);
  }

  function merge(dst) {
    for (var k = 1; k < arguments.length; k++) {
      var s = arguments[k];
      for (var i = 0; i < s.p.length; i++) { dst.p.push(s.p[i]); dst.n.push(s.n[i]); dst.c.push(s.c[i]); }
    }
    return dst;
  }

  return {
    Soup: Soup, addTri: addTri, grid: grid, numericNormal: numericNormal,
    bez: bez, ellipsoid: ellipsoid, revolve: revolve, frustum: frustum,
    hyperboloid1: hyperboloid1, bezierRevolve: bezierRevolve, box: box,
    transform: transform, place: place, merge: merge
  };
})();