/* ==========================================================
 * six.js - Karakter "Six" (Little Nightmares) dengan WebGL murni
 *          (v2: proporsi & siluet disesuaikan dengan model referensi
 *           six_little_nightmares.glb)
 *
 *   Versi ini TIDAK memakai three.js sama sekali. Blok
 *   window.createSixModel mengembalikan pohon SceneNode murni;
 *   rendering dilakukan oleh GL.js (R.prepSix) dan animasi oleh animGL.js.
 *   Bentuk karakter (buildBody, buildHood, buildHead, buildArm, buildLeg)
 *   tidak diubah.
 *
 * Cara memakai model referensi:
 *   File .glb TIDAK dimuat saat runtime (tetap WebGL murni + primitif
 *   quadric + kurva). Model dipakai sebagai "blueprint": dimensi tiap bagian
 *   diukur (irisan penampang per ketinggian y) lalu dikalikan K = 1.44 supaya
 *   tinggi total karakter tetap 2.0 satuan (puncak tudung = 2.0).
 *
 *   Hasil ukur (satuan GLB -> dikali K):
 *     - kaki   : tinggi 0..0.374, betis sangat ramping (r ~0.015-0.029)
 *     - jas    : A-line, hem 0.374 (r 0.157), pinggang 0.77 (r 0.107)
 *     - bahu   : y ~0.89, lengan T-pose sepanjang +-0.49 + tangan s/d 0.589
 *     - kepala : y 0.95-1.24, lebar +-0.12, kedalaman -0.10..0.157
 *     - rambut : y 0.94-1.26, lebar +-0.17 (menjuntai melewati pipi)
 *     - tudung : y 0.92-1.39, runcing; lebar maks 0.236 di y=1.02
 *                depan miring ke depan (x maks 0.276 di y=1.17)
 *
 * Objek & kurva yang dipakai:
 *   ELLIPSOID      : kepala, mata, kelopak, hidung, mulut, tangan, jari,
 *                    lutut, kaki, jari kaki, kancing, kantong, rambut, bahu
 *   KERUCUT TERPOTONG : badan atas, leher, kerah, betis, paha
 *   KURVA BÉZIER   : profil rok A-line & lengan jas (surface of revolution),
 *                    tepi bawah jas (spline Bézier periodik),
 *                    lebar tudung (Bézier kubik hasil fitting data GLB)
 *   TUDUNG         : loft penampang superellipse, siluet samping poligon
 *                    hasil ukur GLB; CSG: tudung = solid - rongga - jendela
 *   RAMBUT         : ellipsoid - kotak potong (CSG)
 *
 * Hierarki (scene graph):
 *   root(badan)
 *    ├─ head ── (kepala, rambut, mata, ...)
 *    ├─ hood
 *    ├─ armL / armR
 *    └─ legL / legR
 * ========================================================== */

/* ---------------- warna (disesuaikan dengan tekstur GLB) ---------------- */
var COL = {
  coat: [0.74, 0.66, 0.09],
  coatLight: [0.84, 0.76, 0.16],
  coatDark: [0.55, 0.48, 0.06],
  coatInner: [0.34, 0.30, 0.04],
  hoodIn: [0.015, 0.012, 0.01],
  skin: [0.55, 0.47, 0.38],
  skinDark: [0.40, 0.33, 0.27],
  hair: [0.04, 0.035, 0.03],
  eyeWhite: [0.74, 0.72, 0.66],
  iris: [0.22, 0.20, 0.17],
  pupil: [0.01, 0.01, 0.01],
  mouth: [0.36, 0.20, 0.18],
  button: [0.45, 0.40, 0.05],
  floor: [0.17, 0.18, 0.20],
  shadow: [0.07, 0.07, 0.08]
};

/* ---------------- node scene graph ---------------- */
function SceneNode(name, t, r) {
  this.name = name;
  this.t = t || [0, 0, 0];
  this.r = r || [0, 0, 0];
  this.s = [1, 1, 1];
  this.base = { t: this.t.slice(), r: this.r.slice() };
  this.soup = null;
  this.mesh = null;
  this.kids = [];
}
SceneNode.prototype.add = function (k) { this.kids.push(k); return k; };
SceneNode.prototype.local = function () { return LIBS.compose(this.t, this.r, this.s); };

/* ---------------- Bézier periodik untuk tepi bawah jas ----------------
 * Titik-titik anchor dihubungkan segmen Bézier kubik; titik kontrol
 * dihitung dari tangen Catmull-Rom (c1 = h[i] + (h[i+1]-h[i-1])/6, dst.)  */
function periodicBezier(h, u) {
  var K = h.length;
  var s = u * K, fl = Math.floor(s), t = s - fl;
  var i = ((fl % K) + K) % K;
  var p0 = h[(i + K - 1) % K], p1 = h[i], p2 = h[(i + 1) % K], p3 = h[(i + 2) % K];
  var c1 = p1 + (p2 - p0) / 6, c2 = p2 - (p3 - p1) / 6;
  return Prim.bez([[p1], [c1], [c2], [p2]], t)[0];
}

/* =========================================================
 *  BUILD KARAKTER
 * ========================================================= */
var SZ = 0.92;          // rasio depan-belakang / kiri-kanan badan (hasil ukur GLB: 0.90-0.96)
var SIX_WAIST_Y = 1.109;    // pinggang (GLB y=0.77 * K)
var SIX_HEM_Y = 0.54;       // tepi bawah jas (GLB y=0.374 * K)
var SIX_CHEST_Y = 1.31;     // atas badan sebelum kerah
var SIX_R_WAIST = 0.154, SIX_R_CHEST = 0.17;

/* profil radius rok A-line (Bézier kubik, hasil fitting irisan GLB).
 * Hanya komponen radius [0] yang dipakai; y bergerak linear terhadap v. */
var SIX_SKIRT = [[0.154, 1.109], [0.156, 0.97], [0.206, 0.75], [0.226, 0.54]];

function coatRadiusAt(y) { // jari-jari penampang badan pada ketinggian y
  if (y >= SIX_WAIST_Y) return SIX_R_WAIST + (SIX_R_CHEST - SIX_R_WAIST) * (y - SIX_WAIST_Y) / (SIX_CHEST_Y - SIX_WAIST_Y);
  var v = Math.max(0, Math.min(1, (SIX_WAIST_Y - y) / (SIX_WAIST_Y - SIX_HEM_Y)));
  return Prim.bez(SIX_SKIRT, v)[0];
}

/** pusat penampang badan bergeser ke depan (hasil ukur GLB: 0.005 di hem,
 *  0.029 di pinggang, 0.014 di leher; dikali K). Belakang jas lebih
 *  mengembang daripada depan. */
function sixCoatCenterZ(y) {
  if (y >= SIX_WAIST_Y) return 0.035 - 0.015 * (y - SIX_WAIST_Y) / (1.345 - SIX_WAIST_Y);
  return 0.007 + 0.028 * Math.max(0, y - SIX_HEM_Y) / (SIX_WAIST_Y - SIX_HEM_Y);
}

/** titik di permukaan depan badan pada ketinggian y & offset x */
function coatFront(y, x) {
  var r = coatRadiusAt(y);
  return sixCoatCenterZ(y) + SZ * Math.sqrt(Math.max(r * r - x * x, 0));
}

function buildBody(node) {
  var S = Prim.Soup();

  /* --- badan atas (pinggang -> dada): KERUCUT TERPOTONG --- */
  Prim.merge(S, Prim.place(Prim.frustum(SIX_WAIST_Y, SIX_R_WAIST, SIX_CHEST_Y, SIX_R_CHEST, COL.coat,
    { sz: SZ, nu: 40, nv: 6, capBottom: true, capTop: true, capColor: COL.coatInner }),
    [0, 0, 0.033], 0, 0));

  /* --- rok jas hujan A-line: profil Bézier + tepi bawah spline Bézier periodik ---
   *     Dipisah menjadi node 'skirt' (pivot di pinggang) agar bisa bergerak sendiri (gerakan sekunder).
   *     Lipatan: modulasi radius (pleat) yang menguat ke arah hem & mereda di garis kancing depan. */
  var SK = Prim.Soup();
  var hem = [0.0, -0.02, 0.008, -0.018, 0.01, -0.02];
  var TOP_Y = SIX_WAIST_Y, T = 0.012, FOLD = 0.045; // T = tebal kain

  function outer(u, v) {
    var th = 2 * Math.PI * u;
    var yb = SIX_HEM_Y + periodicBezier(hem, u);
    var B = Prim.bez(SIX_SKIRT, v);
    var y = TOP_Y + (yb - TOP_Y) * v;
    var calm = 1 - 0.8 * Math.exp(-Math.pow((th - Math.PI / 2) / 0.55, 2));          // depan (kancing) lebih rata
    var fold = FOLD * Math.pow(v, 1.4) * calm *
      (Math.sin(7 * th + 0.6) + 0.55 * Math.sin(13 * th + 2.1) + 0.3 * Math.sin(3 * th + 1.2));
    var R = B[0] * (1 + fold);
    return [R * Math.cos(th), y, sixCoatCenterZ(y) + SZ * R * Math.sin(th)];
  }
  var radial = function (p) { return [p[0], 0, p[2] - sixCoatCenterZ(p[1])]; };
  function innerPt(u, v) {
    var p = outer(u, v), n = Prim.numericNormal(outer, u, v, radial);
    return [p[0] - n[0] * T, p[1] - n[1] * T, p[2] - n[2] * T];
  }
  Prim.grid(SK, outer, 104, 12, COL.coat, { hint: radial });
  Prim.grid(SK, innerPt, 104, 12, COL.coatInner,
    { hint: function (p) { return [-p[0], 0, -(p[2] - sixCoatCenterZ(p[1]))]; } });
  // bibir tepi bawah (menutup antara sisi luar & dalam)
  Prim.grid(SK, function (u, w) {
    return LIBS.lerp(outer(u, 1), innerPt(u, 1), w);
  }, 104, 1, COL.coatLight, {
    normal: function (u) {
      var a = outer(u, 1), b = outer(u, 0.995);
      return LIBS.normalize(LIBS.sub(a, b));
    }
  });
  // pita tumpang-tindih di atas pinggang (di dalam badan atas) agar tidak ada celah saat rok bergerak
  Prim.grid(SK, function (u, w) {
    var th = 2 * Math.PI * u, y = SIX_WAIST_Y + 0.035 * (1 - w), R = SIX_R_WAIST - 0.001;
    return [R * Math.cos(th), y, sixCoatCenterZ(y) + SZ * R * Math.sin(th)];
  }, 48, 1, COL.coat, { hint: radial });
  var skirtNode = node.add(new SceneNode('skirt', [0, SIX_WAIST_Y, 0]));
  skirtNode.soup = Prim.transform(SK, LIBS.compose([0, -SIX_WAIST_Y, 0], [0, 0, 0], [1, 1, 1]));

  /* --- bahu rata (GLB: garis bahu lurus di y=0.93*K=1.34, menyatu dengan lengan) --- */
  Prim.merge(S, Prim.ellipsoid([0, 1.287, 0.03], [0.248, 0.056, 0.13], COL.coat, 28, 10));

  /* --- kerah (di bawah tudung) --- */
  Prim.merge(S, Prim.place(Prim.frustum(1.27, 0.175, 1.345, 0.15, COL.coat,
    { sz: SZ, nu: 28, nv: 2, capTop: true, capColor: COL.coatInner }), [0, 0, 0.028], 0, 0));

  /* --- leher --- */
  Prim.merge(S, Prim.place(Prim.frustum(1.30, 0.052, 1.47, 0.044, COL.skin, { nu: 14, nv: 2 }), [0, 0, 0.03], 0, 0));

  /* --- kancing pengikat di kelim depan (kecil & rata, seperti tekstur GLB).
   *     Kantong pinggul dibuang: tidak ada di model referensi. --- */
  var tilt = -0.16, seamX = 0.03;
  var placket = Prim.ellipsoid([0, 0, 0], [0.008, 0.27, 0.009], COL.coatDark, 8, 10);
  Prim.merge(S, Prim.place(placket, [seamX, 0.90, coatFront(0.90, seamX) + 0.003], tilt, 0));
  [1.06, 0.89, 0.72].forEach(function (y) {
    var z = coatFront(y, 0) + 0.004;
    var tab = Prim.ellipsoid([0, 0, 0], [0.036, 0.018, 0.007], COL.coatLight, 14, 8);
    Prim.merge(S, Prim.place(tab, [-0.005, y, z], tilt, 0));
    var btn = Prim.ellipsoid([0, 0, 0], [0.010, 0.010, 0.007], COL.button, 12, 8);
    Prim.merge(S, Prim.place(btn, [seamX + 0.008, y, z + 0.005], tilt, 0));
  });

  node.soup = S;
}

/* =========================================================
 *  TUDUNG - lokal: y=0 di pangkal tudung (GLB y=0.92), z+ = depan
 *  Semua angka = hasil ukur GLB * K.
 * ========================================================= */
function buildHood(node) {
  var H = 0.68, N = 5;

  /* lebar setengah (sumbu x) sepanjang tinggi: Bézier kubik hasil fitting
   * 16 irisan GLB (melebar di dekat pangkal, lalu meruncing ke puncak) */
  var curveA = [[0.2439], [0.4930], [0.0700], [0.0]];

  /* siluet samping: [y lokal, z]  (depan & belakang tudung) */
  var frontPts = [
    [0.00, 0.215],
    [0.144, 0.266],
    [0.274, 0.336],
    [0.360, 0.397],
    [0.446, 0.353],
    [0.533, 0.243],
    [0.619, 0.177],
    [0.680, 0.058]
  ];
  var backPts = [
    [0.00, -0.120],
    [0.058, -0.194],
    [0.144, -0.272],
    [0.187, -0.312],
    [0.230, -0.312],
    [0.317, -0.236],
    [0.403, -0.174],
    [0.490, -0.109],
    [0.576, -0.053],
    [0.680, 0.022]
  ];

  function sgnPow(x, e) { return (x < 0 ? -1 : 1) * Math.pow(Math.abs(x), e); }

  function interp(pts, y) {
    if (y <= pts[0][0]) return pts[0][1];
    for (var k = 0; k < pts.length - 1; k++) {
      if (y <= pts[k + 1][0]) {
        var t = (y - pts[k][0]) / (pts[k + 1][0] - pts[k][0]);
        return pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t;
      }
    }
    return pts[pts.length - 1][1];
  }

  function prof(y, wall) {
    var yy = Math.max(0, Math.min(H, y));
    var a = Math.max(Prim.bez(curveA, yy / H)[0] - wall, 0.012);
    var zf = interp(frontPts, yy) - wall;
    var zb = interp(backPts, yy) + wall;
    return { a: a, b: Math.max((zf - zb) / 2, 0.012), zc: (zf + zb) / 2 };
  }

  function section(u, y, wall) {
    var p = prof(y, wall);
    var th = 2 * Math.PI * u;
    return [
      p.a * sgnPow(Math.cos(th), 2 / N),
      y,
      p.zc + p.b * sgnPow(Math.sin(th), 2 / N)
    ];
  }

  function solid(col, wall, segs) {
    var S = Prim.Soup();
    var hint = function (p) { return [p[0], 0, p[2] - prof(p[1], wall).zc]; };

    segs.forEach(function (sg) {
      var fn = function (u, w) { return section(u, sg[0] + (sg[1] - sg[0]) * w, wall); };
      Prim.grid(S, fn, 26, sg[2], col, {
        normal: function (u, w) { return Prim.numericNormal(fn, u, w, hint); }
      });
    });

    var yb = segs[0][0];
    var yt = segs[segs.length - 1][1];

    function cap(y, ny) {
      var zc = prof(y, wall).zc;
      Prim.grid(S, function (u, w) {
        var p = section(u, y, wall);
        return [p[0] * w, y, zc + (p[2] - zc) * w];
      }, 26, 2, col, { normal: function () { return [0, ny, 0]; } });
    }
    cap(yb, -1);
    cap(yt, 1);
    return S;
  }

  // Bagian luar tudung
  var outer = solid(COL.coat, 0, [
    [0, 0.15, 3],
    [0.15, 0.30, 3],
    [0.30, 0.55, 4],
    [0.55, 0.68, 3]
  ]);

  // Rongga dalam tudung
  var cavity = solid(COL.hoodIn, 0.020, [
    [-0.03, 0.15, 3],
    [0.15, 0.30, 3],
    [0.30, 0.55, 4],
    [0.55, 0.63, 3]
  ]);

  // Jendela wajah (bukaan depan tudung berbentuk lengkung runcing)
  var win = Prim.ellipsoid(
    [0, 0.20, 0.43],
    [0.15, 0.25, 0.27],
    COL.coatLight, 16, 10
  );

  var hood = CSG.fromSoup(outer)
    .subtract(CSG.fromSoup(cavity))
    .subtract(CSG.fromSoup(win));

  node.soup = hood.toSoup();
}

/* =========================================================
 *  KEPALA - lokal: pusat kepala (GLB y=1.10 * K = 1.60)
 * ========================================================= */
function buildHead(node) {
  var S = Prim.Soup();

  /* wajah dibangun pada skala "kepala satuan" lalu diskalakan ke ukuran GLB
   * (lebar 0.175, tinggi 0.19, kedalaman 0.19; pusat sedikit di depan z=0.04) */
  var F = Prim.Soup();

  /* kepala: ELLIPSOID */
  Prim.merge(F, Prim.ellipsoid([0, 0, 0], [0.155, 0.17, 0.15], COL.skin, 28, 20));

  /* mata: sclera + iris + pupil + kelopak (semua ellipsoid kecil) */
  [-1, 1].forEach(function (sg) {
    var x = sg * 0.058, y = -0.006, z = 0.128;
    Prim.merge(F, Prim.ellipsoid([x, y, z], [0.028, 0.026, 0.022], COL.eyeWhite, 14, 10));
    Prim.merge(F, Prim.ellipsoid([x, y - 0.002, z + 0.016], [0.017, 0.017, 0.012], COL.iris, 12, 8));
    Prim.merge(F, Prim.ellipsoid([x, y - 0.002, z + 0.024], [0.009, 0.009, 0.006], COL.pupil, 10, 6));
    Prim.merge(F, Prim.ellipsoid([x, y + 0.016, z + 0.004], [0.032, 0.017, 0.026], COL.skin, 14, 8));  // kelopak atas
    Prim.merge(F, Prim.ellipsoid([x, y - 0.026, z - 0.002], [0.026, 0.008, 0.02], COL.skinDark, 12, 6)); // kantung mata
  });

  /* hidung & mulut */
  Prim.merge(F, Prim.ellipsoid([0, -0.046, 0.143], [0.012, 0.016, 0.014], COL.skin, 10, 8));
  Prim.merge(F, Prim.ellipsoid([0, -0.088, 0.132], [0.024, 0.0045, 0.007], COL.mouth, 12, 6));

  Prim.merge(S, Prim.transform(F, LIBS.compose([0, 0, 0.04], [0, 0, 0], [1.13, 1.12, 1.25])));

  /* rambut bob + poni: ELLIPSOID dikurangi kotak (CSG subtract).
   * GLB: rambut lebih lebar dari kepala (+-0.245), menjuntai melewati pipi. */
  var hair = CSG.fromSoup(Prim.ellipsoid([0, -0.016, 0.07], [0.245, 0.226, 0.22], COL.hair, 28, 18));
  var cutFront = CSG.fromSoup(Prim.box([0, -0.17, 0.27], [0.15, 0.22, 0.17], COL.hair));   // bukaan wajah
  var cutBottom = CSG.fromSoup(Prim.box([0, -0.35, 0], [0.5, 0.15, 0.5], COL.hair));       // ujung bob rata
  hair = hair.subtract(cutFront).subtract(cutBottom);
  /* rambut = node anak 'hair' (pivot di puncak kepala) agar bisa mengayun sebagai gerakan sekunder */
  var hairNode = node.add(new SceneNode('hair', [0, 0.14, 0]));
  hairNode.soup = Prim.transform(hair.toSoup(), LIBS.compose([0, -0.14, 0], [0, 0, 0], [1, 1, 1]));

  node.soup = S;
}

/* =========================================================
 *  LENGAN - lokal: pivot bahu, lengan menggantung ke -y
 *  GLB: jari-jari lengan ~0.04 -> 0.06 (manset melebar), panjang
 *  lengan 0.325 + tangan 0.094 -> dikali K.
 * ========================================================= */
function buildArm(node, side) {
  var S = Prim.Soup(), F = Prim.Soup();
  /* Lengan GLB: penampang elips (depan-belakang ~1.2x lebih besar dari tinggi
   * saat T-pose), tebal hampir konstan, lalu manset melebar di ujung.
   * Kurva Bézier lengan dipotong di t=0.5 (de Casteljau) -> lengan atas + lengan bawah ('foreL/R')
   * dengan bentuk gabungan IDENTIK pada sudut siku 0. Bola siku menutup sambungan saat menekuk. */
  var c = [[0.055, 0], [0.052, -0.17], [0.054, -0.38], [0.080, -0.47]];
  function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  var q01 = mid(c[0], c[1]), q12 = mid(c[1], c[2]), q23 = mid(c[2], c[3]);
  var r0 = mid(q01, q12), r1 = mid(q12, q23), m = mid(r0, r1);
  var upperC = [c[0], q01, r0, m], lowerC = [m, r1, q23, c[3]];
  var EY = m[1];                                                     // tinggi siku (lokal lengan)

  Prim.merge(S, Prim.ellipsoid([0, 0, 0], [0.056, 0.054, 0.064], COL.coat, 16, 10));
  Prim.merge(S, Prim.bezierRevolve(upperC, COL.coat, { sz: 1.2, nu: 24, nv: 5 }));
  Prim.merge(S, Prim.ellipsoid([0, EY, 0], [m[0] * 1.03, m[0] * 1.03, m[0] * 1.03 * 1.2], COL.coat, 14, 8));   // sendi siku

  Prim.merge(F, Prim.bezierRevolve(lowerC, COL.coat, { sz: 1.2, nu: 24, nv: 5 }));
  // lipatan manset
  Prim.merge(F, Prim.frustum(-0.49, 0.082, -0.465, 0.090, COL.coatLight, { sz: 1.2, nu: 24, nv: 1 }));
  Prim.merge(F, Prim.frustum(-0.49, 0.082, -0.43, 0.082, COL.coatInner, { sz: 1.2, nu: 24, nv: 1, capBottom: true }));

  /* tangan GLB: pipih (tipis di arah kiri-kanan, lebar di depan-belakang),
   * jari rapat meruncing, panjang total dari manset ~0.14 */
  Prim.merge(F, Prim.ellipsoid([0, -0.525, 0.004], [0.020, 0.045, 0.040], COL.skin, 14, 10)); // telapak
  for (var f = 0; f < 4; f++) {
    var fz = (f - 1.5) * 0.021, len = [0.034, 0.040, 0.038, 0.030][f];
    Prim.merge(F, Prim.ellipsoid([0, -0.55 - len, 0.004 + fz], [0.011, len, 0.0095], COL.skin, 8, 6));
  }
  Prim.merge(F, Prim.place(                                      // ibu jari
    Prim.ellipsoid([0, 0, 0], [0.010, 0.030, 0.010], COL.skin, 8, 6),
    [0, -0.545, 0.046], 0.45, 0));
  node.soup = S;
  var fore = node.add(new SceneNode(side > 0 ? 'foreL' : 'foreR', [0, EY, 0]));
  fore.soup = Prim.transform(F, LIBS.compose([0, -EY, 0], [0, 0, 0], [1, 1, 1]));
}

/* =========================================================
 *  KAKI - lokal: pivot pinggul y=0.60; telapak kaki di y = -0.60
 *  GLB: kaki sangat ramping (r 0.015-0.029 * K), telapak panjang
 *  (x -0.042..0.143 * K = 0.27), 5 jari kaki.
 * ========================================================= */
function buildLeg(node, side) {
  var S = Prim.Soup(), F = Prim.Soup();
  /* Kaki = satu tabung mulus (permukaan parametrik) dengan penampang elips.
   * Tiga kurva Bézier kubik (hasil fitting irisan GLB) mengatur sepanjang y:
   *   HW = setengah lebar (kiri-kanan), HD = setengah kedalaman (depan-belakang),
   *   CZ = pergeseran pusat ke depan.
   * Tabung dibagi di lutut (v = VK) menjadi paha (node kaki) + betis & telapak (node 'shinL/R');
   * pada sudut lutut 0 bentuknya identik dengan tabung tunggal. Bola lutut menutup sambungan.
   * y lokal = y dunia - 0.60 (dari -0.54 s/d 0.02; ujung bawah masuk ke tumit). */
  var HW = [[0.0205], [0.0302], [0.0464], [0.0312]];
  var HD = [[0.0286], [0.0219], [0.0641], [0.0298]];
  var CZ = [[-0.003], [-0.0187], [0.0259], [0.0248]];
  var Y0 = -0.54, LEN = 0.56, KY = -0.27, VK = (KY - Y0) / LEN;
  function tube(u, v) {
    var th = 2 * Math.PI * u;
    return [Prim.bez(HW, v)[0] * Math.cos(th), Y0 + LEN * v,
      Prim.bez(CZ, v)[0] + Prim.bez(HD, v)[0] * Math.sin(th)];
  }
  var hint = function (p) { return [p[0], 0, p[2] - Prim.bez(CZ, (p[1] - Y0) / LEN)[0]]; };
  Prim.grid(S, function (u, w) { return tube(u, VK + (1 - VK) * w); }, 20, 6, COL.skin, { hint: hint });   // paha
  Prim.grid(F, function (u, w) { return tube(u, VK * w); }, 20, 6, COL.skin, { hint: hint });             // betis
  var hwK = Prim.bez(HW, VK)[0], hdK = Prim.bez(HD, VK)[0], czK = Prim.bez(CZ, VK)[0];
  Prim.merge(S, Prim.ellipsoid([0, KY, czK], [hwK * 1.03, hwK * 1.03, hdK * 1.03], COL.skin, 12, 8));       // sendi lutut
  /* telapak kaki: tumit + punggung kaki (ellipsoid pipih), 5 jari kaki
   * (GLB: panjang x -0.061..0.206, lebar 0.12, tinggi s/d 0.086)
   * -> node 'foot' (pergelangan di y=-0.53) agar telapak tetap rata saat lutut menekuk */
  var FT = Prim.Soup(), AY = -0.53;
  Prim.merge(FT, Prim.ellipsoid([0, -0.550, -0.005], [0.042, 0.040, 0.052], COL.skin, 14, 10)); // tumit
  Prim.merge(FT, Prim.ellipsoid([0, -0.568, 0.070], [0.058, 0.032, 0.120], COL.skin, 18, 10));  // telapak
  for (var k = 0; k < 5; k++) {
    var tx = (k - 2) * 0.020;
    Prim.merge(FT, Prim.ellipsoid([tx, -0.583, 0.186 - Math.abs(k - 2) * 0.007],
      [0.0105, 0.0105, 0.018], COL.skin, 8, 6));
  }
  node.soup = S;
  var shin = node.add(new SceneNode(side > 0 ? 'shinL' : 'shinR', [0, KY, 0]));
  shin.soup = Prim.transform(F, LIBS.compose([0, -KY, 0], [0, 0, 0], [1, 1, 1]));
  var foot = shin.add(new SceneNode(side > 0 ? 'footL' : 'footR', [0, AY - KY, 0]));
  foot.soup = Prim.transform(FT, LIBS.compose([0, -AY, 0], [0, 0, 0], [1, 1, 1]));
}

function buildEnvironment() {
  var floor = new SceneNode('floor');
  var S = Prim.frustum(-0.05, 1.3, -0.002, 1.3, COL.floor, { nu: 48, nv: 1, capTop: true });
  Prim.merge(S, Prim.frustum(-0.002, 0.46, 0.0012, 0.46, COL.shadow, { nu: 40, nv: 1, capTop: true }));
  floor.soup = S;
  return floor;
}

function buildScene() {
  var root = new SceneNode('six');
  buildBody(root);

  var head = root.add(new SceneNode('head', [0, 1.60, 0]));
  buildHead(head);

  var hood = root.add(new SceneNode('hood', [0, 1.325, 0]));
  buildHood(hood);

  var armL = root.add(new SceneNode('armL', [0.245, 1.287, 0.03], [-0.04, 0, 0.14]));
  buildArm(armL, 1);
  var armR = root.add(new SceneNode('armR', [-0.245, 1.287, 0.03], [-0.04, 0, -0.14]));
  buildArm(armR, -1);

  var legL = root.add(new SceneNode('legL', [0.076, 0.60, 0]));
  buildLeg(legL, 1);
  var legR = root.add(new SceneNode('legR', [-0.076, 0.60, 0]));
  buildLeg(legR, -1);

  function kid(n, name) { for (var i = 0; i < n.kids.length; i++) if (n.kids[i].name === name) return n.kids[i]; return null; }
  return { root: root, floor: buildEnvironment(),
    nodes: { head: head, hood: hood, armL: armL, armR: armR, legL: legL, legR: legR,
      skirt: kid(root, 'skirt'), hair: kid(head, 'hair'),
      foreL: kid(armL, 'foreL'), foreR: kid(armR, 'foreR'), shinL: kid(legL, 'shinL'), shinR: kid(legR, 'shinR'),
      footL: kid(kid(legL, 'shinL'), 'footL'), footR: kid(kid(legR, 'shinR'), 'footR') } };
  // (footL/footR = anak shinL/shinR, didaftarkan di bawah)
}

/* Model Six = pohon SceneNode murni (tanpa three.js). Renderer menggambar node.soup. */
window.createSixModel = function () {
  var source = buildScene();
  return { root: source.root, nodes: source.nodes };
};