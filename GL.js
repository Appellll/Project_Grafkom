/* =========================================================
 *  GL.js - renderer WebGL MENTAH (tanpa three.js)
 *  - satu shader: pencahayaan Blinn-Phong banyak lampu titik + 1 spot,
 *    ambient hemisfer, fog exp2, tekstur, tone mapping ACES + gamma
 *  - bayangan proyeksi planar (stencil) untuk karakter + bayangan kontak
 *  - partikel debu (GL_POINTS), api (unlit additive)
 *  Matriks memakai LIBS (libs.js): 4x4 column-major.
 * ========================================================= */
(function () {
  var MAXP = 8;
  var VS = [
    'attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol; attribute vec2 aUV;',
    'uniform mat4 uModel, uView, uProj; uniform mat3 uNM;',
    'varying vec3 vW, vN, vC; varying vec2 vUV;',
    'void main(){',
    '  vec4 w = uModel * vec4(aPos, 1.0);',
    '  vW = w.xyz; vN = uNM * aNor; vC = aCol; vUV = aUV;',
    '  gl_Position = uProj * uView * w;',
    '}'
  ].join('\n');

  var FS = [
    'precision highp float;',
    'varying vec3 vW, vN, vC; varying vec2 vUV;',
    'uniform vec3 uBase, uEmis, uCam, uAmb, uSky, uGnd, uFogCol;',
    'uniform float uFogD, uExposure, uAlpha, uSpec, uShin;',
    'uniform int uMode; uniform bool uUseTex; uniform sampler2D uTex;',
    'uniform vec3 uPP[' + MAXP + ']; uniform vec3 uPC[' + MAXP + ']; uniform float uPR[' + MAXP + '];',
    'uniform vec3 uSP, uSD, uSC; uniform vec2 uSCone; uniform float uSR;',
    'vec3 lightOne(vec3 L, float d, float range, vec3 col, vec3 N, vec3 V, vec3 albedo, float cone){',
    '  float att = pow(clamp(1.0 - d / range, 0.0, 1.0), 1.8) * cone;',
    '  float nd = max(dot(N, L), 0.0);',
    '  vec3 H = normalize(L + V);',
    '  float sp = pow(max(dot(N, H), 0.0), uShin) * uSpec * step(0.001, nd);',
    '  return col * att * (albedo * nd + vec3(sp));',
    '}',
    'void main(){',
    '  vec4 tx = uUseTex ? texture2D(uTex, vUV) : vec4(1.0);',
    '  if (uMode == 2) { gl_FragColor = vec4(0.0, 0.0, 0.0, uAlpha); return; }',
    '  if (uMode == 1) { gl_FragColor = vec4(uBase * vC * tx.rgb, uAlpha * tx.a); return; }',
    '  vec3 N = normalize(vN); vec3 V = normalize(uCam - vW);',
    '  if (dot(N, V) < 0.0) N = -N;',                         // material dua sisi
    '  vec3 albedo = pow(vC * uBase * tx.rgb, vec3(2.2));',
    '  vec3 lit = albedo * (uAmb + mix(uGnd, uSky, N.y * 0.5 + 0.5));',
    '  for (int i = 0; i < ' + MAXP + '; i++) {',
    '    vec3 L = uPP[i] - vW; float d = length(L); L /= max(d, 0.0001);',
    '    lit += lightOne(L, d, uPR[i], uPC[i], N, V, albedo, 1.0);',
    '  }',
    '  { vec3 L = uSP - vW; float d = length(L); L /= max(d, 0.0001);',
    '    float cone = smoothstep(uSCone.x, uSCone.y, dot(-L, uSD));',
    '    lit += lightOne(L, d, uSR, uSC, N, V, albedo, cone); }',
    '  lit += uEmis;',
    '  float fd = length(uCam - vW); float f = 1.0 - exp(-pow(uFogD * fd, 2.0));',
    '  lit = mix(lit, uFogCol, f);',
    '  lit *= uExposure;',
    '  lit = (lit * (2.51 * lit + 0.03)) / (lit * (2.43 * lit + 0.59) + 0.14);',   // ACES (Narkowicz)
    '  lit = pow(clamp(lit, 0.0, 1.0), vec3(1.0 / 2.2));',
    '  gl_FragColor = vec4(lit, uAlpha);',
    '}'
  ].join('\n');

  var PVS = [
    'attribute vec3 aPos; uniform mat4 uVP; uniform float uSize;',
    'void main(){ gl_Position = uVP * vec4(aPos, 1.0); gl_PointSize = clamp(uSize / gl_Position.w, 1.0, 14.0); }'
  ].join('\n');
  var PFS = [
    'precision mediump float; uniform vec3 uColor; uniform float uOpa;',
    'void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = clamp(1.0 - d, 0.0, 1.0); gl_FragColor = vec4(uColor, a * a * uOpa); }'
  ].join('\n');

  window.createRenderer = function (canvas) {
    var gl = canvas.getContext('webgl', { antialias: true, stencil: true, alpha: false });
    if (!gl) throw new Error('WebGL tidak didukung browser ini.');
    var uint = gl.getExtension('OES_element_index_uint');
    var aniso = gl.getExtension('EXT_texture_filter_anisotropic');

    var prog = LIBS.createProgram(gl, VS, FS);
    var pprog = LIBS.createProgram(gl, PVS, PFS);
    gl.useProgram(prog);
    var U = {}, A = {};
    ['uModel', 'uView', 'uProj', 'uNM', 'uBase', 'uEmis', 'uCam', 'uAmb', 'uSky', 'uGnd', 'uFogCol', 'uFogD', 'uExposure', 'uAlpha', 'uSpec', 'uShin',
      'uMode', 'uUseTex', 'uTex', 'uPP', 'uPC', 'uPR', 'uSP', 'uSD', 'uSC', 'uSCone', 'uSR'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    ['aPos', 'aNor', 'aCol', 'aUV'].forEach(function (n) { A[n] = gl.getAttribLocation(prog, n); });
    var PU = { uVP: gl.getUniformLocation(pprog, 'uVP'), uSize: gl.getUniformLocation(pprog, 'uSize'), uColor: gl.getUniformLocation(pprog, 'uColor'), uOpa: gl.getUniformLocation(pprog, 'uOpa'), aPos: gl.getAttribLocation(pprog, 'aPos') };

    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.uniform1i(U.uTex, 0);

    /* ---------- buffer & tekstur ---------- */
    function buf(target, data, Type) {
      var b = gl.createBuffer(); gl.bindBuffer(target, b);
      gl.bufferData(target, data instanceof Type ? data : new Type(data), gl.STATIC_DRAW); return b;
    }
    // geo: { p, n, c?, uv?, i? }  -> objek GPU
    function mesh(geo) {
      var m = { pos: buf(gl.ARRAY_BUFFER, geo.p, Float32Array), nor: buf(gl.ARRAY_BUFFER, geo.n, Float32Array), col: null, uv: null, idx: null };
      if (geo.c) m.col = buf(gl.ARRAY_BUFFER, geo.c, Float32Array);
      if (geo.uv) m.uv = buf(gl.ARRAY_BUFFER, geo.uv, Float32Array);
      if (geo.i) {
        if (!uint) throw new Error('OES_element_index_uint tidak tersedia.');
        m.idx = buf(gl.ELEMENT_ARRAY_BUFFER, geo.i, Uint32Array); m.count = geo.i.length; m.type = gl.UNSIGNED_INT;
      } else m.count = geo.p.length / 3;
      return m;
    }
    function isPOT(n) { return (n & (n - 1)) === 0; }
    function texture(canvas, opt) {
      opt = opt || {};
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      var pot = isPOT(canvas.width) && isPOT(canvas.height);
      var wrap = (opt.repeat !== false && pot) ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      if (pot && opt.mip !== false) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
      } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    }

    /* ---------- state frame ---------- */
    var frame = null;
    function beginFrame(f) {
      frame = f;
      gl.useProgram(prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(f.fogColor[0], f.fogColor[1], f.fogColor[2], 1);
      gl.clearStencil(0);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
      gl.uniformMatrix4fv(U.uView, false, f.view); gl.uniformMatrix4fv(U.uProj, false, f.proj);
      gl.uniform3fv(U.uCam, f.eye); gl.uniform3fv(U.uAmb, f.ambient); gl.uniform3fv(U.uSky, f.sky); gl.uniform3fv(U.uGnd, f.ground);
      gl.uniform3fv(U.uFogCol, f.fogColor); gl.uniform1f(U.uFogD, f.fogDensity); gl.uniform1f(U.uExposure, f.exposure);
      var pp = new Float32Array(MAXP * 3), pc = new Float32Array(MAXP * 3), pr = new Float32Array(MAXP);
      for (var i = 0; i < MAXP; i++) {
        var L = f.points[i];
        if (L) { pp.set(L.pos, i * 3); pc.set(L.color, i * 3); pr[i] = L.range; } else { pr[i] = 1; }
      }
      gl.uniform3fv(U.uPP, pp); gl.uniform3fv(U.uPC, pc); gl.uniform1fv(U.uPR, pr);
      var s = f.spot;
      gl.uniform3fv(U.uSP, s.pos); gl.uniform3fv(U.uSD, s.dir); gl.uniform3fv(U.uSC, s.color);
      gl.uniform2f(U.uSCone, s.cosOuter, s.cosInner); gl.uniform1f(U.uSR, s.range);
    }

    var override = null;     // { mode, alpha } dipakai untuk pass bayangan
    var lastTex = null;
    function bindAttrib(loc, b, size) {
      if (b) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); }
    }
    // gpu = hasil mesh(); model = 4x4 ; mat = { color, tex(GL texture), emis, alpha, spec, shin, unlit }
    function draw(gpu, model, mat) {
      mat = mat || {};
      gl.uniformMatrix4fv(U.uModel, false, model);
      gl.uniformMatrix3fv(U.uNM, false, LIBS.normalMatrix(model));
      var mode = mat.unlit ? 1 : 0, alpha = mat.alpha === undefined ? 1 : mat.alpha;
      if (override) { mode = override.mode; alpha = override.alpha; }
      gl.uniform1i(U.uMode, mode); gl.uniform1f(U.uAlpha, alpha);
      var c = mat.color || [1, 1, 1], e = mat.emis || [0, 0, 0];
      gl.uniform3f(U.uBase, c[0], c[1], c[2]); gl.uniform3f(U.uEmis, e[0], e[1], e[2]);
      gl.uniform1f(U.uSpec, mat.spec === undefined ? 0.08 : mat.spec); gl.uniform1f(U.uShin, mat.shin || 16);
      if (mat.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mat.tex); gl.uniform1i(U.uUseTex, 1); } else gl.uniform1i(U.uUseTex, 0);

      bindAttrib(A.aPos, gpu.pos, 3); bindAttrib(A.aNor, gpu.nor, 3);
      if (gpu.col) bindAttrib(A.aCol, gpu.col, 3); else { gl.disableVertexAttribArray(A.aCol); gl.vertexAttrib3f(A.aCol, 1, 1, 1); }
      if (gpu.uv) bindAttrib(A.aUV, gpu.uv, 2); else { gl.disableVertexAttribArray(A.aUV); gl.vertexAttrib2f(A.aUV, 0, 0); }
      if (gpu.idx) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gpu.idx); gl.drawElements(gl.TRIANGLES, gpu.count, gpu.type, 0); }
      else gl.drawArrays(gl.TRIANGLES, 0, gpu.count);
    }

    // gambar pohon node: node._draws = [{ gpu, mat }] ; anak di n.kids atau n.children
    function drawTree(n, pm) {
      var w = LIBS.multiply(pm, n.local());
      var d = n._draws;
      if (d) for (var i = 0; i < d.length; i++) draw(d[i].gpu, w, d[i].mat);
      var ks = n.kids || n.children;
      if (ks) for (var k = 0; k < ks.length; k++) drawTree(ks[k], w);
    }

    /* bayangan planar: proyeksikan geometri ke bidang y = h dari lampu L, stencil mencegah gelap ganda */
    function shadowMatrix(L, h) {
      var plane = [0, 1, 0, -h], dot = plane[0] * L[0] + plane[1] * L[1] + plane[2] * L[2] + plane[3];
      var Lh = [L[0], L[1], L[2], 1], o = new Array(16);
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = (r === c ? dot : 0) - Lh[r] * plane[c];
      return o;
    }
    function beginShadows() {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false); gl.enable(gl.STENCIL_TEST);
      gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
    }
    function endShadows() {
      override = null; gl.disable(gl.STENCIL_TEST); gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND);
    }
    function shadowDraw(root, actorM, L, h, alpha) {
      override = { mode: 2, alpha: alpha };
      drawTree(root, LIBS.multiply(shadowMatrix(L, h), actorM));
      override = null;
    }

    function blendAlpha(on) { if (on) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); } }
    function blendAdd(on) { if (on) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); } }

    /* partikel debu */
    var dustBuf = gl.createBuffer();
    function drawPoints(positions, size, color, opacity) {
      gl.useProgram(pprog);
      gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(PU.aPos); gl.vertexAttribPointer(PU.aPos, 3, gl.FLOAT, false, 0, 0);
      gl.uniformMatrix4fv(PU.uVP, false, LIBS.multiply(frame.proj, frame.view));
      gl.uniform1f(PU.uSize, size); gl.uniform3fv(PU.uColor, color); gl.uniform1f(PU.uOpa, opacity);
      blendAdd(true); gl.drawArrays(gl.POINTS, 0, positions.length / 3); blendAdd(false);
      gl.disableVertexAttribArray(PU.aPos);
      gl.useProgram(prog);
    }

    return { gl: gl, mesh: mesh, texture: texture, beginFrame: beginFrame, draw: draw, drawTree: drawTree,
      beginShadows: beginShadows, endShadows: endShadows, shadowDraw: shadowDraw, blendAlpha: blendAlpha, blendAdd: blendAdd, drawPoints: drawPoints,
      /* menyiapkan node karakter: upload geometri -> node._draws */
      prepSix: function (n) {
        if (n.soup) n._draws = [{ gpu: mesh({ p: n.soup.p, n: n.soup.n, c: n.soup.c }), mat: { spec: 0.1, shin: 16 } }];
        n.kids.forEach(this.prepSix, this);
      },
      prepJanitor: function (n) {
        if (n.mesh) n._draws = [{ gpu: mesh({ p: n.mesh.p, n: n.mesh.n, c: n.mesh.c, i: n.mesh.i }), mat: { spec: 0.22, shin: n.shine || 16 } }];
        n.children.forEach(this.prepJanitor, this);
      },
      prepMono: function (n, textures) {
        var self = this;
        n._draws = n.meshes.map(function (m) {
          var mat = { color: m.mat.color, unlit: !!m.mat.unlit, spec: m.mat.spec === undefined ? 0.04 : m.mat.spec, shin: 12 };
          if (m.mat.tex) mat.tex = self.texture(textures[m.mat.tex]);
          return { gpu: mesh({ p: m.pos, n: m.nor, uv: m.uv, i: m.idx }), mat: mat };
        });
        n.kids.forEach(function (k) { self.prepMono(k, textures); });
      }
    };
  };
})();
