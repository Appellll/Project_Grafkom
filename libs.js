/* ==========================================================
 * LIBS.js - helper matriks & vektor untuk WebGL (tanpa three.js)
 * Semua matriks 4x4 disimpan COLUMN-MAJOR (sesuai WebGL):
 *   elemen (baris r, kolom c) = m[c*4 + r]
 * multiply(a, b) = a * b  -> b diterapkan lebih dulu ke titik.
 * ========================================================== */
var LIBS = {
  identity: function () {
    return [1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1];
  },

  multiply: function (a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        var s = 0;
        for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    }
    return o;
  },

  translation: function (x, y, z) {
    var m = LIBS.identity();
    m[12] = x; m[13] = y; m[14] = z;
    return m;
  },

  scaling: function (x, y, z) {
    var m = LIBS.identity();
    m[0] = x; m[5] = y; m[10] = z;
    return m;
  },

  rotationX: function (a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [1, 0, 0, 0,  0, c, s, 0,  0, -s, c, 0,  0, 0, 0, 1];
  },

  rotationY: function (a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [c, 0, -s, 0,  0, 1, 0, 0,  s, 0, c, 0,  0, 0, 0, 1];
  },

  rotationZ: function (a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [c, s, 0, 0,  -s, c, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1];
  },

  /** M = T * Ry * Rx * Rz * S  (t, r, s masing-masing array 3 elemen) */
  compose: function (t, r, s) {
    var m = LIBS.translation(t[0], t[1], t[2]);
    m = LIBS.multiply(m, LIBS.rotationY(r[1]));
    m = LIBS.multiply(m, LIBS.rotationX(r[0]));
    m = LIBS.multiply(m, LIBS.rotationZ(r[2]));
    m = LIBS.multiply(m, LIBS.scaling(s[0], s[1], s[2]));
    return m;
  },

  perspective: function (fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2);
    var nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ];
  },

  lookAt: function (eye, target, up) {
    var z = LIBS.normalize(LIBS.sub(eye, target));
    var x = LIBS.normalize(LIBS.cross(up, z));
    var y = LIBS.cross(z, x);
    return [
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -LIBS.dot(x, eye), -LIBS.dot(y, eye), -LIBS.dot(z, eye), 1
    ];
  },

  /* ---------- vektor ---------- */
  sub: function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; },
  add: function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; },
  scaleVector: function (a, k) { return [a[0] * k, a[1] * k, a[2] * k]; },
  dot: function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; },
  cross: function (a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  },
  length: function (a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); },
  normalize: function (a) {
    var l = LIBS.length(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  lerp: function (a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  },

  /* ---------- transform titik / normal ---------- */
  transformPoint: function (m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
    ];
  },

  /** Normal matrix 3x3 (column-major) = inverse-transpose dari 3x3 atas m.
   *  Dipakai cofactor: kolomnya c1xc2, c2xc0, c0xc1 (dikali tanda determinan). */
  normalMatrix: function (m) {
    var c0 = [m[0], m[1], m[2]], c1 = [m[4], m[5], m[6]], c2 = [m[8], m[9], m[10]];
    var a = LIBS.cross(c1, c2), b = LIBS.cross(c2, c0), c = LIBS.cross(c0, c1);
    var sg = LIBS.dot(c0, a) < 0 ? -1 : 1;
    return [a[0] * sg, a[1] * sg, a[2] * sg,  b[0] * sg, b[1] * sg, b[2] * sg,  c[0] * sg, c[1] * sg, c[2] * sg];
  },

  transformNormal: function (nm, n) {
    return LIBS.normalize([
      nm[0] * n[0] + nm[3] * n[1] + nm[6] * n[2],
      nm[1] * n[0] + nm[4] * n[1] + nm[7] * n[2],
      nm[2] * n[0] + nm[5] * n[1] + nm[8] * n[2]
    ]);
  }
};

LIBS.vec3 = {
  add: LIBS.add,
  sub: LIBS.sub,
  mul: LIBS.scaleVector,
  dot: LIBS.dot,
  cross: LIBS.cross,
  len: LIBS.length,
  norm: function (a) {
    var length = LIBS.length(a);
    return length < 1e-12 ? [0, 1, 0] : LIBS.scaleVector(a, 1 / length);
  },
  lerp: LIBS.lerp
};

LIBS.degToRad = function (degrees) {
  return degrees * Math.PI / 180;
};

LIBS.fromTranslation = function (x, y, z) {
  return LIBS.translation(x, y, z);
};

LIBS.fromScaling = function (x, y, z) {
  return LIBS.scaling(x, y, z);
};

LIBS.fromRotationX = function (angle) {
  return LIBS.rotationX(angle);
};

LIBS.fromRotationY = function (angle) {
  return LIBS.rotationY(angle);
};

LIBS.fromRotationZ = function (angle) {
  return LIBS.rotationZ(angle);
};

LIBS.translate = function (matrix, x, y, z) {
  return LIBS.multiply(matrix, LIBS.translation(x, y, z));
};

LIBS.rotateX = function (matrix, angle) {
  return LIBS.multiply(matrix, LIBS.rotationX(angle));
};

LIBS.rotateY = function (matrix, angle) {
  return LIBS.multiply(matrix, LIBS.rotationY(angle));
};

LIBS.rotateZ = function (matrix, angle) {
  return LIBS.multiply(matrix, LIBS.rotationZ(angle));
};

// Keep vector scaling compatibility while supporting the incoming matrix-scale API.
LIBS.scale = function (matrix, x, y, z) {
  if (arguments.length === 2) return LIBS.scaleVector(matrix, x);
  return LIBS.multiply(matrix, LIBS.scaling(x, y, z));
};

LIBS.scaleMatrix = LIBS.scale;

LIBS.basis = function (x, y, z, position) {
  return [
    x[0], x[1], x[2], 0,
    y[0], y[1], y[2], 0,
    z[0], z[1], z[2], 0,
    position[0], position[1], position[2], 1
  ];
};

LIBS.segmentMatrix = function (start, end, radius) {
  var direction = LIBS.sub(end, start);
  var length = LIBS.length(direction);
  var y = LIBS.normalize(direction);
  var reference = Math.abs(y[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
  var x = LIBS.normalize(LIBS.cross(reference, y));
  var z = LIBS.cross(x, y);
  return [
    x[0] * radius, x[1] * radius, x[2] * radius, 0,
    y[0] * length, y[1] * length, y[2] * length, 0,
    z[0] * radius, z[1] * radius, z[2] * radius, 0,
    start[0], start[1], start[2], 1
  ];
};

LIBS.compileShader = function (gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    var error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compilation failed: ' + (error || 'unknown error'));
  }
  return shader;
};

LIBS.createProgram = function (gl, vertexSource, fragmentSource) {
  var vertexShader = LIBS.compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  var fragmentShader;
  try {
    fragmentShader = LIBS.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  } catch (error) {
    gl.deleteShader(vertexShader);
    throw error;
  }
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    var error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error('Program link failed: ' + (error || 'unknown error'));
  }
  return program;
};