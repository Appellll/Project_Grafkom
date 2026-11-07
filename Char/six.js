/* ==========================================================
 * six.js - Karakter "Six" (Little Nightmares) dengan WebGL murni
 *
 * Objek & kurva yang dipakai:
 *   ELLIPSOID      : kepala, mata, kelopak, hidung, mulut, tangan, jari,
 *                    lutut, kaki, jari kaki, kancing, kantong, rambut
 *   KERUCUT TERPOTONG : badan jas hujan, kaki, leher
 *   (kerucut terpotong = quadric BUKAN ellipsoid/cylinder, memenuhi syarat)
 *   KURVA BÉZIER   : profil rok & lengan jas hujan (surface of revolution),
 *                    tepi bawah jas hujan (spline Bézier periodik)
 *   TUDUNG         : loft penampang superellipse dengan siluet samping
 *                    poligon (titik depan F, lipatan A, puncak B, titik
 *                    belakang C); lebar mengikuti kurva Bézier + CSG:
 *                    tudung = solid − rongga − jendela wajah
 *                    rambut  = ellipsoid − kotak potong (poni & bob)
 *
 * Hierarki (scene graph):
 *   root(badan)
 *    ├─ head ── (kepala, rambut, mata, ...)
 *    ├─ hood
 *    ├─ armL / armR
 *    └─ legL / legR
 * ========================================================== */

/* ---------------- warna ---------------- */
var COL = {
  coat: [0.86, 0.78, 0.10],
  coatLight: [0.93, 0.86, 0.20],
  coatDark: [0.66, 0.58, 0.07],
  coatInner: [0.40, 0.35, 0.05],
  hoodIn: [0.015, 0.012, 0.01],
  skin: [0.80, 0.70, 0.56],
  skinDark: [0.60, 0.50, 0.40],
  hair: [0.05, 0.04, 0.035],
  eyeWhite: [0.80, 0.78, 0.70],
  iris: [0.22, 0.20, 0.17],
  pupil: [0.01, 0.01, 0.01],
  mouth: [0.40, 0.22, 0.20],
  button: [0.50, 0.44, 0.06],
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
var SZ = 0.84; // penampang badan elips (depan-belakang lebih pipih)

function coatRadiusAt(y) { // jari-jari frustum badan (0.285 @0.66 -> 0.185 @1.22)
  return 0.285 + (0.185 - 0.285) * (y - 0.66) / (1.22 - 0.66);
}

/** titik di permukaan depan badan pada ketinggian y & offset x */
function coatFront(y, x) {
  var r = coatRadiusAt(y);
  return SZ * Math.sqrt(Math.max(r * r - x * x, 0));
}

function buildBody(node) {
  var S = Prim.Soup();

  /* --- badan atas: KERUCUT TERPOTONG --- */
  Prim.merge(S, Prim.frustum(0.66, 0.285, 1.22, 0.185, COL.coat,
    { sz: SZ, nu: 40, nv: 6, capBottom: true, capTop: true, capColor: COL.coatInner }));

  /* --- rok jas hujan: profil Bézier + tepi bawah spline Bézier periodik ---
   * Profil radius (r,y) dimulai dari ujung frustum dengan tangen yang sama
   * sehingga sambungan halus (G1).                                        */
  var prof = [[0.285, 0.66], [0.2993, 0.58], [0.325, 0.52], [0.348, 0.46]];
  var hem = [0.0, -0.035, 0.012, -0.03, 0.014, -0.032];
  var HEM_Y = 0.46, TOP_Y = 0.66, T = 0.012; // T = tebal kain

  function outer(u, v) {
    var th = 2 * Math.PI * u;
    var yb = HEM_Y + periodicBezier(hem, u);
    var B = Prim.bez(prof, v);
    return [B[0] * Math.cos(th), TOP_Y + (yb - TOP_Y) * v, SZ * B[0] * Math.sin(th)];
  }
  var radial = function (p) { return [p[0], 0, p[2]]; };
  function innerPt(u, v) {
    var p = outer(u, v), n = Prim.numericNormal(outer, u, v, radial);
    return [p[0] - n[0] * T, p[1] - n[1] * T, p[2] - n[2] * T];
  }
  Prim.grid(S, outer, 48, 10, COL.coat, { hint: radial });
  Prim.grid(S, innerPt, 48, 10, COL.coatInner,
    { hint: function (p) { return [-p[0], 0, -p[2]]; } });
  // bibir tepi bawah (menutup antara sisi luar & dalam)
  Prim.grid(S, function (u, w) {
    return LIBS.lerp(outer(u, 1), innerPt(u, 1), w);
  }, 48, 1, COL.coatLight, {
    normal: function (u) {
      var a = outer(u, 1), b = outer(u, 0.995);
      return LIBS.normalize(LIBS.sub(a, b));
    }
  });

  /* --- bahu bulat --- */
  Prim.merge(S, Prim.ellipsoid([0, 1.20, 0], [0.205, 0.05, 0.17], COL.coat, 24, 8));

  /* --- leher --- */
  Prim.merge(S, Prim.frustum(1.12, 0.048, 1.31, 0.04, COL.skin, { nu: 14, nv: 2 }));

  /* --- kancing pengikat (placket + 3 toggle) --- */
  var tilt = -0.18, seamX = 0.03;
  var placket = Prim.ellipsoid([0, 0, 0], [0.011, 0.30, 0.012], COL.coatDark, 8, 10);
  Prim.merge(S, Prim.place(placket, [seamX, 0.915, coatFront(0.915, seamX) + 0.004], tilt, 0));
  [1.08, 0.89, 0.70].forEach(function (y) {
    var z = coatFront(y, 0) + 0.006;
    var tab = Prim.ellipsoid([0, 0, 0], [0.055, 0.027, 0.011], COL.coatLight, 14, 8);
    Prim.merge(S, Prim.place(tab, [-0.005, y, z], tilt, 0));
    var btn = Prim.ellipsoid([0, 0, 0], [0.016, 0.016, 0.010], COL.button, 12, 8);
    Prim.merge(S, Prim.place(btn, [seamX + 0.012, y, z + 0.008], tilt, 0));
  });

  /* --- kantong --- */
  [-1, 1].forEach(function (sg) {
    var x = sg * 0.145, y = 0.62;
    var z = coatFront(y, x) + 0.004;
    var pocket = Prim.ellipsoid([0, 0, 0], [0.075, 0.07, 0.009], COL.coatLight, 16, 8);
    Prim.merge(S, Prim.place(pocket, [x, y, z], -0.14, sg * 0.5));
  });

  node.soup = S;
}

function buildHood(node) {
  var H = 0.80, N = 5;

  var curveA = [[0.24], [0.26], [0.15], [0.036]];

  var frontPts = [
    [0, 0.25],
    [0.18, 0.34],
    [0.60, 0.25],
    [0.80, 0.11]
  ];

  var backPts = [
    [0.40, -0.27],
    [0.47, -0.27],
    [0.80, 0.075]
  ];

  function sgnPow(x, e) {
    return (x < 0 ? -1 : 1) * Math.pow(Math.abs(x), e);
  }

  function interp(pts, y) {
    if (y <= pts[0][0]) return pts[0][1];

    for (var k = 0; k < pts.length - 1; k++) {
      if (y <= pts[k + 1][0]) {
        var t = (y - pts[k][0]) /
                (pts[k + 1][0] - pts[k][0]);

        return pts[k][1] +
          (pts[k + 1][1] - pts[k][1]) * t;
      }
    }

    return pts[pts.length - 1][1];
  }

  function prof(y, wall) {
    var yy = Math.max(0, Math.min(H, y));

    var a = Math.max(
      Prim.bez(curveA, yy / H)[0] - wall,
      0.012
    );

    var zf = interp(frontPts, yy) - wall;
    var zb = interp(backPts, yy) + wall;

    return {
      a: a,
      b: Math.max((zf - zb) / 2, 0.012),
      zc: (zf + zb) / 2
    };
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

    var hint = function (p) {
      return [
        p[0],
        0,
        p[2] - prof(p[1], wall).zc
      ];
    };

    segs.forEach(function (sg) {
      var fn = function (u, w) {
        return section(
          u,
          sg[0] + (sg[1] - sg[0]) * w,
          wall
        );
      };

      Prim.grid(S, fn, 36, sg[2], col, {
        normal: function (u, w) {
          return Prim.numericNormal(fn, u, w, hint);
        }
      });
    });

    var yb = segs[0][0];
    var yt = segs[segs.length - 1][1];

    function cap(y, ny) {
      var zc = prof(y, wall).zc;

      Prim.grid(S, function (u, w) {
        var p = section(u, y, wall);

        return [
          p[0] * w,
          y,
          zc + (p[2] - zc) * w
        ];
      }, 36, 2, col, {
        normal: function () {
          return [0, ny, 0];
        }
      });
    }

    cap(yb, -1);
    cap(yt, 1);

    return S;
  }

  // Bagian luar hood yang lebih kecil
  var outer = solid(COL.coat, 0, [
    [0, 0.18, 3],
    [0.18, 0.32, 2],
    [0.32, 0.60, 5],
    [0.60, 0.80, 3]
  ]);

  // Rongga dalam hood
  var cavity = solid(COL.hoodIn, 0.020, [
    [-0.03, 0.18, 3],
    [0.18, 0.32, 2],
    [0.32, 0.60, 5],
    [0.60, 0.72, 3]
  ]);

  // Jendela wajah yang disesuaikan dengan ukuran kepala
  var win = Prim.ellipsoid(
    [0, 0.35, 0.37],
    [0.17, 0.27, 0.27],
    COL.coatLight,
    20,
    12
  );

  var hood = CSG.fromSoup(outer)
    .subtract(CSG.fromSoup(cavity))
    .subtract(CSG.fromSoup(win));

  node.soup = hood.toSoup();
}

function buildHead(node) {
  var S = Prim.Soup();

  /* kepala: ELLIPSOID */
  Prim.merge(S, Prim.ellipsoid([0, 0, 0], [0.155, 0.17, 0.15], COL.skin, 28, 20));

  /* mata: sclera + iris + pupil + kelopak (semua ellipsoid kecil) */
  [-1, 1].forEach(function (sg) {
    var x = sg * 0.058, y = -0.006, z = 0.128;
    Prim.merge(S, Prim.ellipsoid([x, y, z], [0.028, 0.026, 0.022], COL.eyeWhite, 14, 10));
    Prim.merge(S, Prim.ellipsoid([x, y - 0.002, z + 0.016], [0.017, 0.017, 0.012], COL.iris, 12, 8));
    Prim.merge(S, Prim.ellipsoid([x, y - 0.002, z + 0.024], [0.009, 0.009, 0.006], COL.pupil, 10, 6));
    Prim.merge(S, Prim.ellipsoid([x, y + 0.016, z + 0.004], [0.032, 0.017, 0.026], COL.skin, 14, 8));  // kelopak atas
    Prim.merge(S, Prim.ellipsoid([x, y - 0.026, z - 0.002], [0.026, 0.008, 0.02], COL.skinDark, 12, 6)); // kantung mata
  });

  /* hidung & mulut */
  Prim.merge(S, Prim.ellipsoid([0, -0.046, 0.143], [0.012, 0.016, 0.014], COL.skin, 10, 8));
  Prim.merge(S, Prim.ellipsoid([0, -0.088, 0.132], [0.024, 0.0045, 0.007], COL.mouth, 12, 6));

  /* rambut bob + poni: ELLIPSOID dikurangi kotak (CSG subtract) */
  var hair = CSG.fromSoup(Prim.ellipsoid([0, 0.012, -0.008], [0.172, 0.19, 0.168], COL.hair, 24, 16));
  var cutFront = CSG.fromSoup(Prim.box([0, -0.1275, 0.15], [0.12, 0.1725, 0.15], COL.hair));
  var cutBottom = CSG.fromSoup(Prim.box([0, -0.235, 0], [0.4, 0.115, 0.4], COL.hair));
  hair = hair.subtract(cutFront).subtract(cutBottom);
  Prim.merge(S, hair.toSoup());

  node.soup = S;
}

function buildArm(node, side) {
  var S = Prim.Soup();
  /* bahu & lengan: profil Bézier (flare di manset) */
  Prim.merge(S, Prim.ellipsoid([0, 0, 0], [0.082, 0.082, 0.082], COL.coat, 16, 10));
  Prim.merge(S, Prim.bezierRevolve([[0.078, 0], [0.070, -0.14], [0.080, -0.30], [0.100, -0.42]],
    COL.coat, { nu: 24, nv: 10 }));
  // lipatan manset
  Prim.merge(S, Prim.frustum(-0.44, 0.092, -0.415, 0.101, COL.coatLight, { nu: 24, nv: 1 }));
  Prim.merge(S, Prim.frustum(-0.44, 0.092, -0.38, 0.092, COL.coatInner, { nu: 24, nv: 1, capBottom: true }));

  /* tangan: ELLIPSOID kecil */
  Prim.merge(S, Prim.ellipsoid([0, -0.49, 0], [0.030, 0.038, 0.020], COL.skin, 14, 10)); // telapak
  for (var f = 0; f < 4; f++) {
    var fx = (f - 1.5) * 0.015, len = [0.036, 0.042, 0.040, 0.032][f];
    Prim.merge(S, Prim.ellipsoid([fx, -0.535 - len * 0.35, 0.002], [0.0072, len, 0.0072], COL.skin, 8, 6));
  }
  Prim.merge(S, Prim.place(
    Prim.ellipsoid([0, 0, 0], [0.009, 0.030, 0.009], COL.skin, 8, 6),
    [side * 0.028, -0.505, 0.012], 0, 0));
  node.soup = S;
}

function buildLeg(node, side) {
  var S = Prim.Soup();
  /* paha & betis: KERUCUT TERPOTONG, lutut: ellipsoid */
  Prim.merge(S, Prim.frustum(-0.30, 0.038, 0.0, 0.047, COL.skin, { nu: 16, nv: 3 }));
  Prim.merge(S, Prim.ellipsoid([0, -0.30, 0.004], [0.040, 0.034, 0.040], COL.skinDark, 14, 10));
  Prim.merge(S, Prim.frustum(-0.565, 0.026, -0.30, 0.037, COL.skin, { nu: 16, nv: 4 }));
  Prim.merge(S, Prim.ellipsoid([0, -0.568, 0], [0.030, 0.026, 0.030], COL.skin, 12, 8)); // pergelangan
  /* kaki (ellipsoid pipih) + jari kaki */
  Prim.merge(S, Prim.ellipsoid([0, -0.592, 0.045], [0.040, 0.028, 0.085], COL.skin, 16, 10));
  for (var k = 0; k < 4; k++) {
    var tx = side * 0.0 + (k - 1.5) * 0.019;
    Prim.merge(S, Prim.ellipsoid([tx, -0.603, 0.128 - Math.abs(k - 1.5) * 0.006],
      [0.0105, 0.0105, 0.016], COL.skin, 8, 6));
  }
  node.soup = S;
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

  var head = root.add(new SceneNode('head', [0, 1.40, 0]));
  head.s = [1.08, 1.08, 1.08];
  buildHead(head);

  var hood = root.add(new SceneNode('hood', [0, 1.20, -0.02], [0.04, 0, 0]));
  buildHood(hood);

  var armL = root.add(new SceneNode('armL', [0.225, 1.175, 0], [-0.06, 0, 0.17]));
  buildArm(armL, 1);
  var armR = root.add(new SceneNode('armR', [-0.225, 1.175, 0], [-0.06, 0, -0.17]));
  buildArm(armR, -1);

  var legL = root.add(new SceneNode('legL', [0.085, 0.62, 0]));
  buildLeg(legL, 1);
  var legR = root.add(new SceneNode('legR', [-0.085, 0.62, 0]));
  buildLeg(legR, -1);

  return { root: root, floor: buildEnvironment(),
    nodes: { head: head, hood: hood, armL: armL, armR: armR, legL: legL, legR: legR } };
}

window.createSixModel = function () {
  var source = buildScene();
  var group = new THREE.Group();
  var triangleCount = 0;
  var groups = {};

  function addNode(node, parent) {
    var container = new THREE.Group();
    container.matrixAutoUpdate = false;
    container.matrix.fromArray(node.local());
    groups[node.name] = container;
    parent.add(container);

    if (node.soup) {
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(node.soup.p, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(node.soup.n, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(node.soup.c, 3));
      var material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.72,
        side: THREE.DoubleSide
      });
      container.add(new THREE.Mesh(geometry, material));
      triangleCount += node.soup.p.length / 9;
    }

    node.kids.forEach(function (child) { addNode(child, container); });
  }

  addNode(source.root, group);

  /* ---- RIG: dipakai Anim.js untuk menggerakkan anggota badan ----
   * nodes.<nama>.t / .r diubah tiap frame, lalu rig.sync() menyalin ke Three.js.
   * rig.reset() mengembalikan semua node ke pose awal.            */
  var animated = ['six', 'head', 'hood', 'armL', 'armR', 'legL', 'legR'];
  var nodeOf = { six: source.root, head: source.nodes.head, hood: source.nodes.hood,
    armL: source.nodes.armL, armR: source.nodes.armR, legL: source.nodes.legL, legR: source.nodes.legR };
  var rig = {
    nodes: nodeOf,
    groups: groups,
    reset: function () {
      animated.forEach(function (k) {
        var n = nodeOf[k];
        n.t = n.base.t.slice();
        n.r = n.base.r.slice();
        n.s = [1, 1, 1];
      });
      source.root.t = [0, 0, 0]; source.root.r = [0, 0, 0];
    },
    sync: function () {
      animated.forEach(function (k) {
        groups[k].matrix.fromArray(nodeOf[k].local());
        groups[k].matrixWorldNeedsUpdate = true;
      });
    }
  };
  return { group: group, triangleCount: triangleCount, rig: rig };
};

/* =========================================================
 *  RENDERER WebGL
 * ========================================================= */
function main() {
  var canvas = document.getElementById('mycanvas');
  var gl = canvas.getContext('webgl', { antialias: true });
  if (!gl) { alert('WebGL tidak didukung browser ini.'); return; }

  var vsSrc = [
    'attribute vec3 position;',
    'attribute vec3 normal;',
    'attribute vec3 color;',
    'uniform mat4 mvp;',
    'uniform mat4 model;',
    'uniform mat3 nmat;',
    'varying vec3 vN; varying vec3 vC; varying vec3 vW;',
    'void main(void){',
    '  vec4 w = model * vec4(position, 1.0);',
    '  vW = w.xyz; vN = nmat * normal; vC = color;',
    '  gl_Position = mvp * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var fsSrc = [
    'precision mediump float;',
    'varying vec3 vN; varying vec3 vC; varying vec3 vW;',
    'uniform vec3 eye;',
    'uniform float flat_;',
    'void main(void){',
    '  if (flat_ > 0.5) { gl_FragColor = vec4(0.85, 0.9, 1.0, 1.0); return; }',
    '  vec3 N = normalize(vN);',
    '  vec3 V = normalize(eye - vW);',
    '  vec3 L1 = normalize(vec3(-0.45, 0.85, 0.95));',
    '  vec3 L2 = normalize(vec3(0.7, 0.25, -0.7));',
    '  float d1 = max(dot(N, L1), 0.0);',
    '  float d2 = max(dot(N, L2), 0.0) * 0.30;',
    '  float amb = 0.34 + 0.16 * (N.y * 0.5 + 0.5);',
    '  // material mengkilap (jas hujan kuning) dideteksi dari warna',
    '  float gloss = step(0.45, vC.r - vC.b);',
    '  vec3 H = normalize(L1 + V);',
    '  float spec = pow(max(dot(N, H), 0.0), 36.0) * 0.38 * gloss;',
    '  vec3 col = vC * (amb + d1 * 0.78 + d2) + vec3(spec);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function sh(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fsSrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);

  var aPos = gl.getAttribLocation(prog, 'position');
  var aNor = gl.getAttribLocation(prog, 'normal');
  var aCol = gl.getAttribLocation(prog, 'color');
  var uMvp = gl.getUniformLocation(prog, 'mvp');
  var uModel = gl.getUniformLocation(prog, 'model');
  var uNmat = gl.getUniformLocation(prog, 'nmat');
  var uEye = gl.getUniformLocation(prog, 'eye');
  var uFlat = gl.getUniformLocation(prog, 'flat_');
  gl.enableVertexAttribArray(aPos);
  gl.enableVertexAttribArray(aNor);
  gl.enableVertexAttribArray(aCol);

  /* ---- bangun scene + upload ---- */
  var t0 = performance.now();
  var scene = buildScene();
  console.log('Build karakter: ' + Math.round(performance.now() - t0) + ' ms');

  function interleave(soup) {
    var n = soup.p.length / 3, data = new Float32Array(n * 9);
    for (var i = 0; i < n; i++) {
      data.set([soup.p[i * 3], soup.p[i * 3 + 1], soup.p[i * 3 + 2],
        soup.n[i * 3], soup.n[i * 3 + 1], soup.n[i * 3 + 2],
        soup.c[i * 3], soup.c[i * 3 + 1], soup.c[i * 3 + 2]], i * 9);
    }
    return data;
  }
  function wireData(data) { // setiap segitiga -> 3 garis
    var tris = data.length / 27, out = new Float32Array(tris * 6 * 9);
    for (var t = 0; t < tris; t++) {
      for (var e = 0; e < 3; e++) {
        out.set(data.subarray(t * 27 + e * 9, t * 27 + e * 9 + 9), t * 54 + e * 18);
        out.set(data.subarray(t * 27 + ((e + 1) % 3) * 9, t * 27 + ((e + 1) % 3) * 9 + 9), t * 54 + e * 18 + 9);
      }
    }
    return out;
  }
  function upload(soup) {
    var d = interleave(soup), w = wireData(d);
    var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
    var wb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, wb); gl.bufferData(gl.ARRAY_BUFFER, w, gl.STATIC_DRAW);
    return { vb: vb, wb: wb, count: d.length / 9, wcount: w.length / 9 };
  }
  var totalTris = 0;
  (function prep(n) {
    if (n.soup) { n.mesh = upload(n.soup); totalTris += n.mesh.count / 3; }
    n.kids.forEach(prep);
  })(scene.root);
  scene.floor.mesh = upload(scene.floor.soup);
  var info = document.getElementById('triCount');
  if (info) info.textContent = Math.round(totalTris).toLocaleString('id-ID');

  /* ---- kamera orbit ---- */
  var cam = { yaw: 0.55, pitch: 0.12, dist: 4.4, target: [0, 1.12, 0] };
  var camHome = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
  var state = { autoRotate: false, wire: false, idle: false };

  var dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('mousedown', function (e) { dragging = true; lx = e.clientX; ly = e.clientY; });
  window.addEventListener('mouseup', function () { dragging = false; });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    cam.yaw -= (e.clientX - lx) * 0.008;
    cam.pitch = Math.max(-0.5, Math.min(1.2, cam.pitch + (e.clientY - ly) * 0.006));
    lx = e.clientX; ly = e.clientY;
  });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    cam.dist = Math.max(1.5, Math.min(12, cam.dist * (1 + e.deltaY * 0.001)));
  }, { passive: false });
  canvas.addEventListener('touchstart', function (e) { dragging = true; lx = e.touches[0].clientX; ly = e.touches[0].clientY; });
  canvas.addEventListener('touchend', function () { dragging = false; });
  canvas.addEventListener('touchmove', function (e) {
    if (!dragging) return; e.preventDefault();
    cam.yaw -= (e.touches[0].clientX - lx) * 0.008;
    cam.pitch = Math.max(-0.5, Math.min(1.2, cam.pitch + (e.touches[0].clientY - ly) * 0.006));
    lx = e.touches[0].clientX; ly = e.touches[0].clientY;
  }, { passive: false });

  function bind(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
  bind('btnRotate', function () { state.autoRotate = !state.autoRotate; this.classList.toggle('on', state.autoRotate); });
  bind('btnWire', function () { state.wire = !state.wire; this.classList.toggle('on', state.wire); });
  bind('btnIdle', function () { state.idle = !state.idle; this.classList.toggle('on', state.idle); });
  bind('btnReset', function () { cam.yaw = camHome.yaw; cam.pitch = camHome.pitch; cam.dist = camHome.dist; });

  /* ---- gambar ---- */
  var viewProj;
  function drawNode(n, parent) {
    var model = LIBS.multiply(parent, n.local());
    if (n.mesh) drawMesh(n.mesh, model);
    for (var i = 0; i < n.kids.length; i++) drawNode(n.kids[i], model);
  }
  function drawMesh(m, model) {
    gl.uniformMatrix4fv(uMvp, false, new Float32Array(LIBS.multiply(viewProj, model)));
    gl.uniformMatrix4fv(uModel, false, new Float32Array(model));
    gl.uniformMatrix3fv(uNmat, false, new Float32Array(LIBS.normalMatrix(model)));
    gl.bindBuffer(gl.ARRAY_BUFFER, state.wire ? m.wb : m.vb);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(aNor, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(aCol, 3, gl.FLOAT, false, 36, 24);
    gl.drawArrays(state.wire ? gl.LINES : gl.TRIANGLES, 0, state.wire ? m.wcount : m.count);
  }

  /* animasi idle sederhana (hanya untuk menguji hierarki; animasi lengkap menyusul) */
  function applyIdle(time) {
    var N = scene.nodes, b;
    ['head', 'hood', 'armL', 'armR', 'legL', 'legR'].forEach(function (k) {
      N[k].t = N[k].base.t.slice(); N[k].r = N[k].base.r.slice();
    });
    scene.root.t = [0, 0, 0]; scene.root.s = [1, 1, 1];
    if (!state.idle) return;
    var s = Math.sin(time * 1.8);
    scene.root.s = [1, 1 + 0.008 * s, 1];
    N.head.r[1] = 0.25 * Math.sin(time * 0.9);
    N.hood.r[2] = 0.03 * Math.sin(time * 0.9 + 0.5);
    N.armL.r[2] += 0.04 * s; N.armR.r[2] -= 0.04 * s;
  }

  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var w = Math.floor(canvas.clientWidth * dpr), h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.09, 0.10, 0.12, 1);

  var last = performance.now();
  function frame(now) {
    var dt = (now - last) / 1000; last = now;
    resize();
    if (state.autoRotate) cam.yaw += dt * 0.6;
    applyIdle(now / 1000);

    var eye = [
      cam.target[0] + cam.dist * Math.cos(cam.pitch) * Math.sin(cam.yaw),
      cam.target[1] + cam.dist * Math.sin(cam.pitch),
      cam.target[2] + cam.dist * Math.cos(cam.pitch) * Math.cos(cam.yaw)
    ];
    var proj = LIBS.perspective(Math.PI / 4, canvas.width / canvas.height, 0.1, 60);
    var view = LIBS.lookAt(eye, cam.target, [0, 1, 0]);
    viewProj = LIBS.multiply(proj, view);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform3fv(uEye, new Float32Array(eye));
    gl.uniform1f(uFlat, state.wire ? 1 : 0);
    if (!state.wire) drawNode(scene.floor, LIBS.identity());
    drawNode(scene.root, LIBS.identity());
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  var ov = document.getElementById('loading');
  if (ov) ov.style.display = 'none';
}