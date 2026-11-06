/* ==========================================================
 * CSG.js - Constructive Solid Geometry (UNION / SUBTRACT / INTERSECT)
 * Berbasis BSP-tree (algoritma klasik csg.js oleh Evan Wallace),
 * ditulis ulang ringkas dengan array biasa + normal per-vertex
 * (agar permukaan melengkung tetap smooth) + warna per-polygon.
 *
 * Pemakaian:
 *   var a = CSG.fromSoup(soupA);          // soup = {p:[], n:[], c:[]}
 *   var b = CSG.fromSoup(soupB);
 *   var hasil = a.subtract(b);            // juga .union(b) / .intersect(b)
 *   var soup  = hasil.toSoup();
 *
 * Syarat: mesh harus TERTUTUP (watertight) dan winding-nya
 * konsisten (normal geometris menghadap keluar).
 * ========================================================== */
var CSG = (function () {
  var EPS = 1e-5;

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function unit(a) {
    var l = Math.sqrt(dot(a, a)) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  function lerp(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  /* ---------------- Vertex ---------------- */
  function Vertex(pos, normal) { this.pos = pos; this.normal = normal; }
  Vertex.prototype.clone = function () {
    return new Vertex(this.pos.slice(), this.normal.slice());
  };
  Vertex.prototype.flip = function () {
    this.normal = [-this.normal[0], -this.normal[1], -this.normal[2]];
  };
  Vertex.prototype.interpolate = function (o, t) {
    return new Vertex(lerp(this.pos, o.pos, t), unit(lerp(this.normal, o.normal, t)));
  };

  /* ---------------- Plane ---------------- */
  function Plane(normal, w) { this.normal = normal; this.w = w; }
  Plane.prototype.clone = function () { return new Plane(this.normal.slice(), this.w); };
  Plane.prototype.flip = function () {
    this.normal = [-this.normal[0], -this.normal[1], -this.normal[2]];
    this.w = -this.w;
  };

  var COPLANAR = 0, FRONT = 1, BACK = 2, SPANNING = 3;

  Plane.prototype.splitPolygon = function (polygon, coplanarFront, coplanarBack, front, back) {
    var polygonType = 0, types = [], i, n = polygon.vertices.length;
    for (i = 0; i < n; i++) {
      var t = dot(this.normal, polygon.vertices[i].pos) - this.w;
      var type = t < -EPS ? BACK : (t > EPS ? FRONT : COPLANAR);
      polygonType |= type;
      types.push(type);
    }
    switch (polygonType) {
      case COPLANAR:
        (dot(this.normal, polygon.plane.normal) > 0 ? coplanarFront : coplanarBack).push(polygon);
        break;
      case FRONT: front.push(polygon); break;
      case BACK: back.push(polygon); break;
      case SPANNING:
        var f = [], b = [];
        for (i = 0; i < n; i++) {
          var j = (i + 1) % n;
          var ti = types[i], tj = types[j];
          var vi = polygon.vertices[i], vj = polygon.vertices[j];
          if (ti !== BACK) f.push(vi);
          if (ti !== FRONT) b.push(ti !== BACK ? vi.clone() : vi);
          if ((ti | tj) === SPANNING) {
            var tt = (this.w - dot(this.normal, vi.pos)) / dot(this.normal, sub(vj.pos, vi.pos));
            var v = vi.interpolate(vj, tt);
            f.push(v);
            b.push(v.clone());
          }
        }
        if (f.length >= 3) { var pf = new Polygon(f, polygon.shared); if (pf.valid) front.push(pf); }
        if (b.length >= 3) { var pb = new Polygon(b, polygon.shared); if (pb.valid) back.push(pb); }
        break;
    }
  };

  /* ---------------- Polygon (konveks) ---------------- */
  function Polygon(vertices, shared) {
    this.vertices = vertices;
    this.shared = shared; // warna [r,g,b]
    // normal bidang lewat metode Newell (stabil untuk polygon sempit)
    var nx = 0, ny = 0, nz = 0, n = vertices.length;
    for (var i = 0; i < n; i++) {
      var a = vertices[i].pos, b = vertices[(i + 1) % n].pos;
      nx += (a[1] - b[1]) * (a[2] + b[2]);
      ny += (a[2] - b[2]) * (a[0] + b[0]);
      nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    var l = Math.sqrt(nx * nx + ny * ny + nz * nz);
    this.valid = l > 1e-9;
    var nrm = this.valid ? [nx / l, ny / l, nz / l] : [0, 1, 0];
    this.plane = new Plane(nrm, dot(nrm, vertices[0].pos));
  }
  Polygon.prototype.clone = function () {
    var p = new Polygon(this.vertices.map(function (v) { return v.clone(); }), this.shared);
    return p;
  };
  Polygon.prototype.flip = function () {
    this.vertices.reverse();
    this.vertices.forEach(function (v) { v.flip(); });
    this.plane.flip();
  };

  /* ---------------- BSP Node ---------------- */
  function Node(polygons) {
    this.plane = null; this.front = null; this.back = null; this.polygons = [];
    if (polygons) this.build(polygons);
  }
  Node.prototype.clone = function () {
    var n = new Node();
    n.plane = this.plane && this.plane.clone();
    n.front = this.front && this.front.clone();
    n.back = this.back && this.back.clone();
    n.polygons = this.polygons.map(function (p) { return p.clone(); });
    return n;
  };
  Node.prototype.invert = function () {
    for (var i = 0; i < this.polygons.length; i++) this.polygons[i].flip();
    if (this.plane) this.plane.flip();
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();
    var t = this.front; this.front = this.back; this.back = t;
  };
  Node.prototype.clipPolygons = function (polygons) {
    if (!this.plane) return polygons.slice();
    var front = [], back = [];
    for (var i = 0; i < polygons.length; i++) {
      this.plane.splitPolygon(polygons[i], front, back, front, back);
    }
    if (this.front) front = this.front.clipPolygons(front);
    if (this.back) back = this.back.clipPolygons(back); else back = [];
    return front.concat(back);
  };
  Node.prototype.clipTo = function (bsp) {
    this.polygons = bsp.clipPolygons(this.polygons);
    if (this.front) this.front.clipTo(bsp);
    if (this.back) this.back.clipTo(bsp);
  };
  Node.prototype.allPolygons = function () {
    var p = this.polygons.slice();
    if (this.front) p = p.concat(this.front.allPolygons());
    if (this.back) p = p.concat(this.back.allPolygons());
    return p;
  };
  /** Pilih bidang pemisah terbaik dari beberapa kandidat acak: meminimalkan
   *  jumlah polygon yang terpotong (SPANNING) & menjaga pohon tetap seimbang.
   *  Tanpa ini, permukaan non-konveks (mis. hyperboloid) terpecah jadi puluhan
   *  ribu segitiga. */
  function chooseSplitter(polygons) {
    var n = polygons.length;
    if (n < 12) return polygons[0].plane;
    var cands = 8, sample = Math.min(n, 80), best = null, bestCost = Infinity;
    for (var c = 0; c < cands; c++) {
      var pl = polygons[Math.floor(Math.random() * n)].plane;
      var f = 0, b = 0, sp = 0;
      for (var i = 0; i < sample; i++) {
        var poly = polygons[sample === n ? i : Math.floor(Math.random() * n)];
        var pos = 0, neg = 0;
        for (var k = 0; k < poly.vertices.length; k++) {
          var t = dot(pl.normal, poly.vertices[k].pos) - pl.w;
          if (t > EPS) pos++; else if (t < -EPS) neg++;
        }
        if (pos && neg) sp++; else if (pos) f++; else if (neg) b++;
      }
      var cost = sp * 6 + Math.abs(f - b);
      if (cost < bestCost) { bestCost = cost; best = pl; }
    }
    return best;
  }

  Node.prototype.build = function (polygons) {
    if (!polygons.length) return;
    if (!this.plane) this.plane = chooseSplitter(polygons).clone();
    var front = [], back = [];
    for (var i = 0; i < polygons.length; i++) {
      this.plane.splitPolygon(polygons[i], this.polygons, this.polygons, front, back);
    }
    if (front.length) { if (!this.front) this.front = new Node(); this.front.build(front); }
    if (back.length) { if (!this.back) this.back = new Node(); this.back.build(back); }
  };

  /* ---------------- CSG ---------------- */
  function CSG() { this.polygons = []; }

  CSG.fromPolygons = function (polygons) {
    var c = new CSG(); c.polygons = polygons; return c;
  };

  /** soup = {p:[x,y,z,...], n:[...], c:[r,g,b,...]} ; tiap 3 vertex = 1 segitiga */
  CSG.fromSoup = function (soup) {
    var polys = [];
    for (var i = 0; i < soup.p.length; i += 9) {
      var vs = [];
      for (var k = 0; k < 3; k++) {
        var o = i + k * 3;
        vs.push(new Vertex(
          [soup.p[o], soup.p[o + 1], soup.p[o + 2]],
          [soup.n[o], soup.n[o + 1], soup.n[o + 2]]
        ));
      }
      var col = [soup.c[i], soup.c[i + 1], soup.c[i + 2]];
      var poly = new Polygon(vs, col);
      if (poly.valid) polys.push(poly);
    }
    return CSG.fromPolygons(polys);
  };

  CSG.prototype.clone = function () {
    return CSG.fromPolygons(this.polygons.map(function (p) { return p.clone(); }));
  };

  CSG.prototype.union = function (csg) {
    var a = new Node(this.clone().polygons);
    var b = new Node(csg.clone().polygons);
    a.clipTo(b);
    b.clipTo(a);
    b.invert(); b.clipTo(a); b.invert();
    a.build(b.allPolygons());
    return CSG.fromPolygons(a.allPolygons());
  };

  CSG.prototype.subtract = function (csg) {
    var a = new Node(this.clone().polygons);
    var b = new Node(csg.clone().polygons);
    a.invert();
    a.clipTo(b);
    b.clipTo(a);
    b.invert(); b.clipTo(a); b.invert();
    a.build(b.allPolygons());
    a.invert();
    return CSG.fromPolygons(a.allPolygons());
  };

  CSG.prototype.intersect = function (csg) {
    var a = new Node(this.clone().polygons);
    var b = new Node(csg.clone().polygons);
    a.invert();
    b.clipTo(a);
    b.invert();
    a.clipTo(b);
    b.clipTo(a);
    a.build(b.allPolygons());
    a.invert();
    return CSG.fromPolygons(a.allPolygons());
  };

  /** Konversi balik ke soup segitiga (polygon konveks di-fan). */
  CSG.prototype.toSoup = function () {
    var s = { p: [], n: [], c: [] };
    this.polygons.forEach(function (poly) {
      var v = poly.vertices, col = poly.shared;
      for (var i = 1; i < v.length - 1; i++) {
        var tri = [v[0], v[i], v[i + 1]];
        var g = cross(sub(tri[1].pos, tri[0].pos), sub(tri[2].pos, tri[0].pos));
        if (dot(g, g) < 1e-16) continue;
        for (var k = 0; k < 3; k++) {
          s.p.push(tri[k].pos[0], tri[k].pos[1], tri[k].pos[2]);
          s.n.push(tri[k].normal[0], tri[k].normal[1], tri[k].normal[2]);
          s.c.push(col[0], col[1], col[2]);
        }
      }
    });
    return s;
  };

  return CSG;
})();