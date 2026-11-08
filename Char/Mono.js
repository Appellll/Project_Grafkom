/* ==========================================================
 * mono.js  -  Karakter "Mono" (Little Nightmares)
 *
 * Semua geometri dibangkitkan manual (array posisi / normal / index),
 * TANPA library geometri apa pun (tidak ada three.js).
 * Hasil akhirnya berupa pohon node + array vertex untuk renderer WebGL (GL.js).
 *
 * JENIS OBJEK YANG DIPAKAI
 *   1. Ellipsoid (quadric)                  : telapak tangan, kancing
 *   2. Hyperboloid satu lembar (quadric)    : kepala di dalam kantong kertas
 *   3. Cylinder / cone terpotong (quadric)  : badan jas, dalaman, leher, kaki, manset
 *   + Sphere kecil                         : mata pada kantong kertas
 *   + Tube hasil sapuan kurva Bezier kubik  : lengan, tangan, kaki, jari
 *   + Extrude kurva Bezier (+ bevel)        : jubah di punggung
 * ========================================================== */

window.createMonoModel = function () {
    'use strict';

    const PI = Math.PI;

    /* ==========================================================
     *  BAGIAN 1 : MATEMATIKA KECIL
     * ========================================================== */
    const vAdd = LIBS.vec3.add;
    const vSub = LIBS.vec3.sub;
    const vMul = LIBS.vec3.mul;
    const vDot = LIBS.vec3.dot;
    const vCross = LIBS.vec3.cross;
    const vNorm = LIBS.vec3.norm;

    // matriks 3x3 disimpan row-major (9 angka)
    const mApply = (m, v) => [
        m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
        m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
        m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
    function mMul(a, b) {
        const r = new Array(9);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
            }
        }
        return r;
    }
    function eulerMatrix(rx, ry, rz) {
        const cx = Math.cos(rx), sx = Math.sin(rx);
        const cy = Math.cos(ry), sy = Math.sin(ry);
        const cz = Math.cos(rz), sz = Math.sin(rz);
        const Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
        const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
        const Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
        return mMul(Rx, mMul(Ry, Rz));
    }
    // rotasi yang memutar sumbu +Y supaya searah dengan "dir" (rumus Rodrigues)
    function rotateYTo(dir) {
        const d = vNorm(dir);
        const c = d[1];
        if (c > 0.99999) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
        if (c < -0.99999) return [1, 0, 0, 0, -1, 0, 0, 0, -1];
        const k = vNorm([d[2], 0, -d[0]]);          // Y x d
        const s = Math.sqrt(1 - c * c), t = 1 - c;
        return [
            c + t * k[0] * k[0],        t * k[0] * k[1] - s * k[2], t * k[0] * k[2] + s * k[1],
            t * k[1] * k[0] + s * k[2], c + t * k[1] * k[1],        t * k[1] * k[2] - s * k[0],
            t * k[2] * k[0] - s * k[1], t * k[2] * k[1] + s * k[0], c + t * k[2] * k[2]
        ];
    }

    /* ==========================================================
     *  BAGIAN 2 : WADAH MESH + UTILITAS
     * ========================================================== */
    const newGeo = () => ({ pos: [], nor: [], uv: [], idx: [] });

    function pushVertex(g, p, n, uv) {
        g.pos.push(p[0], p[1], p[2]);
        g.nor.push(n[0], n[1], n[2]);
        g.uv.push(uv ? uv[0] : 0, uv ? uv[1] : 0);
        return g.pos.length / 3 - 1;
    }

    // grid (rows+1) x (cols+1) titik -> dua segitiga per sel
    function linkGrid(g, base, rows, cols) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const a = base + r * (cols + 1) + c;
                const b = a + cols + 1;
                g.idx.push(a, b, a + 1, a + 1, b, b + 1);
            }
        }
    }

    // pastikan arah putar segitiga searah dengan normal vertex (menghadap keluar)
    function orient(g) {
        const P = g.pos, N = g.nor, I = g.idx;
        for (let t = 0; t < I.length; t += 3) {
            const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
            const f = vCross(
                [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]],
                [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]
            );
            const d = f[0] * (N[a] + N[b] + N[c]) +
                      f[1] * (N[a + 1] + N[b + 1] + N[c + 1]) +
                      f[2] * (N[a + 2] + N[b + 2] + N[c + 2]);
            if (d < 0) { const tmp = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = tmp; }
        }
        return g;
    }

    // skala -> rotasi -> translasi (normal memakai invers-transpos agar benar saat skala tak seragam)
    function place(g, o) {
        o = o || {};
        const pos = o.pos || [0, 0, 0];
        const sc = o.scale || [1, 1, 1];
        const rot = o.rot || [0, 0, 0];
        const R = o.basis || eulerMatrix(rot[0], rot[1], rot[2]);
        const out = newGeo();
        for (let i = 0; i < g.pos.length; i += 3) {
            const p = mApply(R, [g.pos[i] * sc[0], g.pos[i + 1] * sc[1], g.pos[i + 2] * sc[2]]);
            out.pos.push(p[0] + pos[0], p[1] + pos[1], p[2] + pos[2]);
            const n = vNorm(mApply(R, [g.nor[i] / sc[0], g.nor[i + 1] / sc[1], g.nor[i + 2] / sc[2]]));
            out.nor.push(n[0], n[1], n[2]);
        }
        out.uv = g.uv.slice();
        out.idx = g.idx.slice();
        return out;
    }

    function append(target, src) {
        const base = target.pos.length / 3;
        for (let i = 0; i < src.pos.length; i += 3) {
            target.pos.push(src.pos[i], src.pos[i + 1], src.pos[i + 2]);
            target.nor.push(src.nor[i], src.nor[i + 1], src.nor[i + 2]);
            target.uv.push(src.uv[i / 3 * 2], src.uv[i / 3 * 2 + 1]);
        }
        for (let i = 0; i < src.idx.length; i++) target.idx.push(src.idx[i] + base);
        return target;
    }

    /* ==========================================================
     *  BAGIAN 3 : PRIMITIF
     * ========================================================== */

    /* ---- Quadric 1 : ELLIPSOID ---- */
    function ellipsoid(rx, ry, rz, stacks, slices) {
        const g = newGeo();
        for (let i = 0; i <= stacks; i++) {
            const phi = PI * i / stacks, sp = Math.sin(phi), cp = Math.cos(phi);
            for (let j = 0; j <= slices; j++) {
                const th = 2 * PI * j / slices, ct = Math.cos(th), st = Math.sin(th);
                pushVertex(g, [rx * sp * ct, ry * cp, rz * sp * st],
                              vNorm([sp * ct / rx, cp / ry, sp * st / rz]));
            }
        }
        linkGrid(g, 0, stacks, slices);
        return orient(g);
    }

    /* ---- Quadric 2 : CYLINDER / CONE TERPOTONG (pusat di origin, memanjang di sumbu Y) ---- */
    function cylinder(rTop, rBottom, h, radial, rows, caps, uvOffset) {
        const g = newGeo();
        const slope = (rBottom - rTop) / h;
        for (let r = 0; r <= rows; r++) {
            const v = r / rows, y = h / 2 - v * h, rad = rTop + (rBottom - rTop) * v;
            for (let j = 0; j <= radial; j++) {
                const th = 2 * PI * j / radial, c = Math.cos(th), s = Math.sin(th);
                pushVertex(g, [rad * c, y, rad * s], vNorm([c, slope, s]),
                    [j / radial + (uvOffset || 0), 1 - v]);
            }
        }
        linkGrid(g, 0, rows, radial);
        if (caps !== false) {
            [[h / 2, rTop, 1], [-h / 2, rBottom, -1]].forEach(cap => {
                const y = cap[0], rad = cap[1], ny = cap[2];
                if (rad <= 0) return;
                const centre = pushVertex(g, [0, y, 0], [0, ny, 0]);
                const first = g.pos.length / 3;
                for (let j = 0; j <= radial; j++) {
                    const th = 2 * PI * j / radial;
                    pushVertex(g, [rad * Math.cos(th), y, rad * Math.sin(th)], [0, ny, 0]);
                }
                for (let j = 0; j < radial; j++) g.idx.push(centre, first + j, first + j + 1);
            });
        }
        return orient(g);
    }

    // wobble(angle, t) -> faktor radius (lipatan/kerutan kain); bila ada, normal dihitung numerik dari permukaan
    function bezierConeProfile(profile, radial, rows, uvOffset, wobble) {
        const g = newGeo();
        const P = (angle, t) => {
            const pt = bezierPoint(profile[0], profile[1], profile[2], profile[3], t);
            const k = pt[0] * (1 + wobble(angle, t));
            return [k * Math.cos(angle), pt[1], k * Math.sin(angle)];
        };
        for (let r = 0; r <= rows; r++) {
            const t = r / rows;
            const point = bezierPoint(profile[0], profile[1], profile[2], profile[3], t);
            const tangent = bezierTangent(profile[0], profile[1], profile[2], profile[3], t);
            for (let j = 0; j <= radial; j++) {
                const angle = 2 * PI * j / radial, c = Math.cos(angle), s = Math.sin(angle);
                if (!wobble) {
                    pushVertex(g, [point[0] * c, point[1], point[0] * s],
                        vNorm([tangent[1] * c, -tangent[0], tangent[1] * s]),
                        [j / radial + (uvOffset || 0), t]);
                } else {
                    const e = 1e-3;
                    const da = vSub(P(angle + e, t), P(angle - e, t));
                    const dt = vSub(P(angle, Math.min(1, t + e)), P(angle, Math.max(0, t - e)));
                    let n = vNorm(vCross(da, dt));
                    if (n[0] * c + n[2] * s < 0) n = vMul(n, -1);                 // pastikan menghadap keluar
                    pushVertex(g, P(angle, t), n, [j / radial + (uvOffset || 0), t]);
                }
            }
        }
        linkGrid(g, 0, rows, radial);

        [[profile[0][1], profile[0][0], -1, 0], [profile[3][1], profile[3][0], 1, 1]].forEach(cap => {
            const centre = pushVertex(g, [0, cap[0], 0], [0, cap[2], 0]);
            const first = g.pos.length / 3;
            for (let j = 0; j <= radial; j++) {
                const angle = 2 * PI * j / radial;
                const rr = cap[1] * (1 + (wobble ? wobble(angle, cap[3]) : 0));
                pushVertex(g, [rr * Math.cos(angle), cap[0], rr * Math.sin(angle)], [0, cap[2], 0]);
            }
            for (let j = 0; j < radial; j++) g.idx.push(centre, first + j, first + j + 1);
        });
        return orient(g);
    }

    /* kantong kertas berkerut: radius dimodulasi lipatan vertikal tak beraturan (menguat ke atas),
     * bibir atas bergelombang, kerut horizontal halus; normal numerik agar kerutan terlihat pada shading */
    function crumpledBag(rTop, rBot, h, radial, rows) {
        const g = newGeo();
        const P = (a, v) => {
            const top = 1 - v;
            const crease = 0.014 * (Math.sin(4 * a + 1.0) + 0.6 * Math.sin(7 * a + 2.3) + 0.35 * Math.sin(11 * a + 0.4)) * (0.35 + 0.65 * top)
                         + 0.006 * Math.sin(3 * a + v * 17.0) * Math.sin(v * 9.0 + a);
            const rad = rTop + (rBot - rTop) * v + crease;
            return [rad * Math.cos(a), h / 2 - v * h + 0.04 * top * top * top * Math.sin(5 * a + 0.7), rad * Math.sin(a)];
        };
        for (let r = 0; r <= rows; r++) {
            const v = r / rows;
            for (let j = 0; j <= radial; j++) {
                const a = 2 * PI * j / radial, e = 1e-3;
                const da = vSub(P(a + e, v), P(a - e, v));
                const dv = vSub(P(a, Math.min(1, v + e)), P(a, Math.max(0, v - e)));
                let n = vNorm(vCross(da, dv));
                if (n[0] * Math.cos(a) + n[2] * Math.sin(a) < 0) n = vMul(n, -1);
                pushVertex(g, P(a, v), n, [j / radial, 1 - v]);
            }
        }
        linkGrid(g, 0, rows, radial);
        [[0, 1], [1, -1]].forEach(cap => {            // tutup atas (agak cekung) & bawah
            const v = cap[0], ny = cap[1];
            const centre = pushVertex(g, [0, h / 2 - v * h - 0.03 * (1 - v), 0], [0, ny, 0]);
            const first = g.pos.length / 3;
            for (let j = 0; j <= radial; j++) {
                const p = P(2 * PI * j / radial, v);
                pushVertex(g, p, [0, ny, 0]);
            }
            for (let j = 0; j < radial; j++) g.idx.push(centre, first + j, first + j + 1);
        });
        return orient(g);
    }

    // silinder dari titik A ke titik B
    function cylinderBetween(a, b, radius, radial) {
        const dir = vSub(b, a);
        const body = cylinder(radius * 0.86, radius, Math.hypot(dir[0], dir[1], dir[2]), radial, 1);
        return place(body, {
            pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
            basis: rotateYTo(dir)
        });
    }

    /* ---- Torus (bidang XY, sumbu cincin = Z) ---- */
    function torus(R, r, tubeSides, ringSides) {
        const g = newGeo();
        for (let i = 0; i <= tubeSides; i++) {
            const v = 2 * PI * i / tubeSides, cv = Math.cos(v), sv = Math.sin(v);
            for (let j = 0; j <= ringSides; j++) {
                const u = 2 * PI * j / ringSides, cu = Math.cos(u), su = Math.sin(u);
                pushVertex(g, [(R + r * cv) * cu, (R + r * cv) * su, r * sv], [cv * cu, cv * su, sv]);
            }
        }
        linkGrid(g, 0, tubeSides, ringSides);
        return orient(g);
    }

    /* ---- KURVA BEZIER KUBIK ---- */
    function bezierPoint(p0, p1, p2, p3, t) {
        const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
                a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
                a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2]];
    }
    function bezierTangent(p0, p1, p2, p3, t) {
        const u = 1 - t, a = 3 * u * u, b = 6 * u * t, c = 3 * t * t;
        return vNorm([
            a * (p1[0] - p0[0]) + b * (p2[0] - p1[0]) + c * (p3[0] - p2[0]),
            a * (p1[1] - p0[1]) + b * (p2[1] - p1[1]) + c * (p3[1] - p2[1]),
            a * (p1[2] - p0[2]) + b * (p2[2] - p1[2]) + c * (p3[2] - p2[2])
        ]);
    }

    /* ---- TUBE: lingkaran disapukan sepanjang kurva Bezier (frame digeser paralel) ---- */
    function bezierTube(p0, p1, p2, p3, radius, segs, sides) {
        sides = sides || 8;
        const g = newGeo();
        let N = null;
        for (let i = 0; i <= segs; i++) {
            const t = i / segs;
            const C = bezierPoint(p0, p1, p2, p3, t);
            const T = bezierTangent(p0, p1, p2, p3, t);
            if (!N) {
                const ref = Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
                N = vNorm(vCross(ref, T));
            } else {
                N = vNorm(vSub(N, vMul(T, vDot(N, T))));
            }
            const B = vCross(T, N);
            const ringRadius = typeof radius === 'function' ? radius(t) : radius;
            for (let j = 0; j <= sides; j++) {
                const a = 2 * PI * j / sides;
                const dir = vAdd(vMul(N, Math.cos(a)), vMul(B, Math.sin(a)));
                pushVertex(g, vAdd(C, vMul(dir, ringRadius)), dir);
            }
        }
        linkGrid(g, 0, segs, sides);
        return orient(g);
    }

    /* ---- Quadric 3 : HYPERBOLOID satu lembar untuk kepala kantong ----
       x^2/a^2 + z^2/b^2 = 1 + y^2/v^2                                      */
    function hyperboloidHead() {
        const rings = 32, sides = 64;
        const a = 0.32, b = 0.30, v = 0.82, half = 0.52;
        const g = newGeo();

        for (let r = 0; r <= rings; r++) {
            const y = -half + (r / rings) * half * 2;
            const k = Math.sqrt(1 + (y * y) / (v * v));
            for (let s = 0; s < sides; s++) {
                const ang = 2 * PI * s / sides;
                pushVertex(g, [a * k * Math.cos(ang), y, b * k * Math.sin(ang)], [0, 0, 0]);
            }
        }
        for (let r = 0; r < rings; r++) {
            for (let s = 0; s < sides; s++) {
                const cur = r * sides + s;
                const nxt = r * sides + (s + 1) % sides;
                const up = cur + sides, upNxt = nxt + sides;
                g.idx.push(cur, up, nxt, nxt, up, upNxt);
            }
        }
        const bottom = pushVertex(g, [0, -half, 0], [0, -1, 0]);
        const top = pushVertex(g, [0, half, 0], [0, 1, 0]);
        for (let s = 0; s < sides; s++) {
            const nxt = (s + 1) % sides;
            g.idx.push(bottom, nxt, s);
            g.idx.push(top, rings * sides + s, rings * sides + nxt);
        }
        const normals = [];
        for (let r = 0; r <= rings; r++) {
            const y = -half + (r / rings) * half * 2;
            for (let s = 0; s < sides; s++) {
                const ang = 2 * PI * s / sides;
                normals.push(...vNorm([Math.cos(ang) / a, -y / (v * v), Math.sin(ang) / b]));
            }
        }
        g.nor = normals.concat([0, -1, 0, 0, 1, 0]);
        return orient(g);
    }

    /* ---- EXTRUDE : bentuk 2D dari kurva Bezier -> diberi ketebalan + bevel ---- */
    function earClip(poly) {          // poly berlawanan jarum jam; hasil: daftar [i, j, k]
        const area2 = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
        const inside = (p, A, B, C) =>
            area2(A, B, p) >= -1e-12 && area2(B, C, p) >= -1e-12 && area2(C, A, p) >= -1e-12;
        const ids = poly.map((_, i) => i), out = [];
        while (ids.length > 3) {
            let cut = -1;
            for (let k = 0; k < ids.length && cut < 0; k++) {
                const ia = ids[(k + ids.length - 1) % ids.length], ib = ids[k], ic = ids[(k + 1) % ids.length];
                const A = poly[ia], B = poly[ib], C = poly[ic];
                if (area2(A, B, C) <= 1e-10) continue;                          // sudut cekung
                if (ids.every(id => id === ia || id === ib || id === ic || !inside(poly[id], A, B, C))) cut = k;
            }
            if (cut < 0) cut = 0;                                               // pengaman
            out.push([ids[(cut + ids.length - 1) % ids.length], ids[cut], ids[(cut + 1) % ids.length]]);
            ids.splice(cut, 1);
        }
        out.push(ids.slice());
        return out;
    }

    function extrudedCape() {
        const SEG = 18, DEPTH = 0.1, BEVEL_T = 0.025, BEVEL_S = 0.035, BEVEL_N = 3;

        // kontur jubah: 5 segmen Bezier (tiap segmen dipotong SEG bagian)
        const path = [
            [[-0.25, 1.91], [-0.52, 1.62], [-0.68, 0.88], [-1.02, 0.48]],
            [[-1.02, 0.48], [-0.66, 0.36], [-0.31, 0.57], [0, 0.78]],
            [[0, 0.78], [0.31, 0.57], [0.66, 0.36], [1.02, 0.48]],
            [[1.02, 0.48], [0.68, 0.88], [0.52, 1.62], [0.25, 1.91]],
            [[0.25, 1.91], [0.1, 1.84], [-0.1, 1.84], [-0.25, 1.91]]
        ];
        let outline = [];
        path.forEach(c => {
            for (let i = 0; i < SEG; i++) {
                const p = bezierPoint(
                    [c[0][0], c[0][1], 0], [c[1][0], c[1][1], 0],
                    [c[2][0], c[2][1], 0], [c[3][0], c[3][1], 0], i / SEG);
                outline.push([p[0], p[1]]);
            }
        });
        const M = outline.length;

        // pastikan berlawanan jarum jam
        let area = 0;
        for (let i = 0; i < M; i++) {
            const p = outline[i], q = outline[(i + 1) % M];
            area += p[0] * q[1] - q[0] * p[1];
        }
        if (area < 0) outline.reverse();

        // normal 2D ke arah luar di tiap titik kontur
        const out2 = outline.map((_, i) => {
            const p = outline[(i + M - 1) % M], q = outline[(i + 1) % M];
            const n = vNorm([q[1] - p[1], -(q[0] - p[0]), 0]);
            return [n[0], n[1]];
        });

        // daftar cincin: (jarak ke luar, z, bobot normal)
        const rings = [];
        for (let k = 0; k <= BEVEL_N; k++) {                 // bevel depan
            const a = (k / BEVEL_N) * PI / 2;
            rings.push({ off: BEVEL_S * Math.sin(a), z: -BEVEL_T * Math.cos(a), nr: Math.sin(a), nz: -Math.cos(a) });
        }
        for (let k = 0; k <= BEVEL_N; k++) {                 // bevel belakang
            const a = (k / BEVEL_N) * PI / 2;
            rings.push({ off: BEVEL_S * Math.cos(a), z: DEPTH + BEVEL_T * Math.sin(a), nr: Math.cos(a), nz: Math.sin(a) });
        }

        const g = newGeo();
        rings.forEach(R => {
            outline.forEach((p, i) => {
                pushVertex(g,
                    [p[0] + out2[i][0] * R.off, p[1] + out2[i][1] * R.off, R.z],
                    vNorm([out2[i][0] * R.nr, out2[i][1] * R.nr, R.nz]));
            });
        });
        for (let r = 0; r < rings.length - 1; r++) {
            for (let i = 0; i < M; i++) {
                const a = r * M + i, a2 = r * M + (i + 1) % M;
                const b = (r + 1) * M + i, b2 = (r + 1) * M + (i + 1) % M;
                g.idx.push(a, b, a2, a2, b, b2);
            }
        }

        // tutup depan & belakang (segitigasi kontur)
        const tris = earClip(outline);
        [[-BEVEL_T, -1], [DEPTH + BEVEL_T, 1]].forEach(face => {
            const base = g.pos.length / 3;
            outline.forEach(p => pushVertex(g, [p[0], p[1], face[0]], [0, 0, face[1]]));
            tris.forEach(t => g.idx.push(base + t[0], base + t[1], base + t[2]));
        });
        return orient(g);
    }

    /* ==========================================================
     *  BAGIAN 4 : MATERIAL & PENGUMPUL MESH
     * ========================================================== */
    const coatCanvas = document.createElement('canvas');
    coatCanvas.width = 512;
    coatCanvas.height = 512;
    const coatContext = coatCanvas.getContext('2d');
    if (!coatContext) throw new Error('Tidak dapat membuat tekstur kain Mono.');
    const coatGradient = coatContext.createLinearGradient(0, 0, 0, 512);
    coatGradient.addColorStop(0, '#5d5957');
    coatGradient.addColorStop(0.5, '#55514f');
    coatGradient.addColorStop(1, '#4d4947');
    coatContext.fillStyle = coatGradient;
    coatContext.fillRect(0, 0, 512, 512);

    let textureSeed = 17;
    const textureRandom = () => {
        textureSeed = (textureSeed * 1664525 + 1013904223) >>> 0;
        return textureSeed / 4294967296;
    };
    for (let i = 0; i < 5200; i++) {
        const shade = 175 + Math.floor(textureRandom() * 55);
        coatContext.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.12)`;
        coatContext.fillRect(textureRandom() * 512, textureRandom() * 512, 1, 3);
    }

    coatContext.save();
    coatContext.beginPath();
    coatContext.rect(112, 0, 288, 512);
    coatContext.clip();

    const shirtGradient = coatContext.createLinearGradient(0, 150, 0, 512);
    shirtGradient.addColorStop(0, '#77747a');
    shirtGradient.addColorStop(1, '#5d5a61');
    coatContext.fillStyle = shirtGradient;
    coatContext.beginPath();
    coatContext.moveTo(208, 142);
    coatContext.quadraticCurveTo(256, 170, 304, 142);
    coatContext.lineTo(366, 512);
    coatContext.lineTo(146, 512);
    coatContext.closePath();
    coatContext.fill();

    const coatPanel = coatContext.createLinearGradient(70, 0, 440, 0);
    coatPanel.addColorStop(0, '#817d79');
    coatPanel.addColorStop(0.5, '#74706d');
    coatPanel.addColorStop(1, '#625f5e');
    coatContext.fillStyle = coatPanel;
    coatContext.beginPath();
    coatContext.moveTo(174, -8);
    coatContext.bezierCurveTo(130, 88, 112, 208, 72, 420);
    coatContext.quadraticCurveTo(82, 466, 116, 490);
    coatContext.bezierCurveTo(154, 410, 188, 300, 228, 213);
    coatContext.bezierCurveTo(204, 148, 181, 74, 174, -8);
    coatContext.closePath();
    coatContext.fill();
    coatContext.beginPath();
    coatContext.moveTo(338, -8);
    coatContext.bezierCurveTo(382, 88, 400, 208, 440, 420);
    coatContext.quadraticCurveTo(430, 466, 396, 490);
    coatContext.bezierCurveTo(358, 410, 324, 300, 284, 213);
    coatContext.bezierCurveTo(308, 148, 331, 74, 338, -8);
    coatContext.closePath();
    coatContext.fill();

    const lapelGradient = coatContext.createLinearGradient(100, 0, 260, 260);
    lapelGradient.addColorStop(0, '#8d8882');
    lapelGradient.addColorStop(0.55, '#7b756f');
    lapelGradient.addColorStop(1, '#67625e');
    coatContext.fillStyle = lapelGradient;
    coatContext.beginPath();
    coatContext.moveTo(204, -4);
    coatContext.bezierCurveTo(201, 72, 183, 142, 164, 213);
    coatContext.bezierCurveTo(140, 296, 118, 390, 95, 470);
    coatContext.quadraticCurveTo(113, 482, 134, 488);
    coatContext.bezierCurveTo(174, 390, 211, 284, 238, 205);
    coatContext.bezierCurveTo(221, 130, 208, 54, 204, -4);
    coatContext.closePath();
    coatContext.fill();
    coatContext.beginPath();
    coatContext.moveTo(308, -4);
    coatContext.bezierCurveTo(311, 72, 329, 142, 348, 213);
    coatContext.bezierCurveTo(372, 296, 394, 390, 417, 470);
    coatContext.quadraticCurveTo(399, 482, 378, 488);
    coatContext.bezierCurveTo(338, 390, 301, 284, 274, 205);
    coatContext.bezierCurveTo(291, 130, 304, 54, 308, -4);
    coatContext.closePath();
    coatContext.fill();

    coatContext.strokeStyle = 'rgba(35, 33, 33, 0.65)';
    coatContext.lineWidth = 6;
    coatContext.beginPath();
    coatContext.moveTo(204, 0);
    coatContext.bezierCurveTo(201, 82, 181, 149, 164, 213);
    coatContext.bezierCurveTo(140, 296, 118, 390, 112, 477);
    coatContext.moveTo(308, 0);
    coatContext.bezierCurveTo(311, 82, 331, 149, 348, 213);
    coatContext.bezierCurveTo(372, 296, 394, 390, 400, 477);
    coatContext.stroke();

    coatContext.strokeStyle = 'rgba(190, 184, 176, 0.35)';
    coatContext.lineWidth = 3;
    coatContext.beginPath();
    coatContext.moveTo(212, 6);
    coatContext.bezierCurveTo(207, 82, 188, 148, 172, 213);
    coatContext.bezierCurveTo(150, 296, 128, 390, 120, 477);
    coatContext.moveTo(300, 6);
    coatContext.bezierCurveTo(305, 82, 324, 148, 340, 213);
    coatContext.bezierCurveTo(362, 296, 384, 390, 392, 477);
    coatContext.stroke();

    coatContext.strokeStyle = 'rgba(214, 207, 197, 0.18)';
    coatContext.lineWidth = 2;
    [
        [104, 254, 145, 364],
        [390, 248, 352, 354],
        [138, 344, 112, 443],
        [371, 338, 400, 446]
    ].forEach(([x1, y1, x2, y2]) => {
        coatContext.beginPath();
        coatContext.moveTo(x1, y1);
        coatContext.quadraticCurveTo((x1 + x2) / 2 + 10, (y1 + y2) / 2, x2, y2);
        coatContext.stroke();
    });

    coatContext.fillStyle = '#b7a998';
    coatContext.beginPath();
    coatContext.arc(256, 176, 10, 0, 2 * PI);
    coatContext.fill();
    coatContext.fillStyle = '#59534e';
    coatContext.beginPath();
    coatContext.arc(256, 176, 4, 0, 2 * PI);
    coatContext.fill();
    coatContext.restore();

    const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
    const mats = {
        coat:  { color: [1, 1, 1], tex: 'coat', spec: 0.02 },
        cape:  { color: hex(0x222033) },
        inner: { color: hex(0x17171d) },
        cloth: { color: hex(0x34343c) },
        bag:   { color: hex(0x625b57) },
        head:  { color: hex(0x393437) },
        eye:   { color: hex(0x080916), unlit: true },
        skin:  { color: hex(0x514b49) }
    };

    // satu slot = satu mesh akhir (geometri bermaterial sama digabung)
    const slots = {
        cape:     { mat: 'cape', shadow: true },
        coat:     { mat: 'coat' },
        inner:    { mat: 'inner' },
        cloth:    { mat: 'cloth' },
        bagHead:  { mat: 'bag', shadow: true },
        head:     { mat: 'head' },
        eye:      { mat: 'eye' },
        skin:     { mat: 'skin' }
    };
    const pieces = {};
    // part = bagian tubuh yang bisa digerakkan (torso, head, armP, armN, legP, legN)
    function put(slot, geo, part) {
        const key = (part || 'torso') + '|' + slot;
        if (!pieces[key]) pieces[key] = newGeo();
        append(pieces[key], geo);
    }

    /* ==========================================================
     *  BAGIAN 5 : MERAKIT MONO
     * ========================================================== */

    // --- jubah belakang + badan ---
    put('cape', place(extrudedCape(), { pos: [0, 0, -0.28] }));
    // lipatan mantel: pleat vertikal yang menguat ke arah hem (t=0 bawah, t=1 leher)
    const coatWobble = (a, t) => 0.028 * (1 - t) * (Math.sin(5 * a + 0.8) + 0.6 * Math.sin(9 * a + 2.0) + 0.35 * Math.sin(3 * a + 0.3));
    put('coat', bezierConeProfile([
        [0.48, 0.78, 0], [0.43, 0.9, 0], [0.3, 1.65, 0], [0.28, 2.03, 0]
    ], 64, 32, 0.25, coatWobble));

    // --- paper bag frustum; hyperboloid head stays inside the paper shell ---
    put('bagHead', place(crumpledBag(0.43, 0.39, 1.08, 48, 14), { pos: [0, 2.57, 0], scale: [1, 1, 0.88] }), 'head');
    put('head', place(hyperboloidHead(), { pos: [0, 2.57, 0], scale: [0.72, 0.82, 0.72] }), 'head');

    // --- dua mata kecil berbentuk bola pada sisi depan paper bag ---
    [-1, 1].forEach(side => {
        put('eye', place(ellipsoid(0.085, 0.085, 0.085, 24, 16), { pos: [side * 0.15, 2.56, 0.39] }), 'head');
    });

    // --- lengan kurva Bezier + telapak ellipsoid dan jari sapuan Bezier ---
    // Kurva dipotong di t=0.5 (de Casteljau): lengan atas (armP/N) + lengan bawah & tangan (foreP/N),
    // bentuk gabungan identik pada sudut siku 0; bola siku menutup sambungan saat menekuk.
    const ELB = {};
    const mid3 = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    [
        [[-0.36, 1.9, 0.02], [-0.58, 1.78, 0.06], [-0.78, 1.2, 0.14], [-0.91, 0.83, 0.2]],
        [[0.36, 1.9, 0.02], [0.58, 1.78, 0.06], [0.78, 1.2, 0.14], [0.91, 0.83, 0.2]]
    ].forEach(points => {
        const side = points[0][0] < 0 ? -1 : 1;
        const armPart = side < 0 ? 'armN' : 'armP';
        const forePart = side < 0 ? 'foreN' : 'foreP';
        const q01 = mid3(points[0], points[1]), q12 = mid3(points[1], points[2]), q23 = mid3(points[2], points[3]);
        const r0 = mid3(q01, q12), r1 = mid3(q12, q23), m = mid3(r0, r1);
        ELB[armPart] = m;
        put('cloth', bezierTube(points[0], q01, r0, m, 0.12, 16, 12), armPart);
        put('cloth', place(ellipsoid(0.125, 0.125, 0.125, 12, 16), { pos: m }), armPart);          // sendi siku
        put('cloth', bezierTube(m, r1, q23, points[3], 0.12, 16, 12), forePart);
        const w = points[3];
        const palm = [w[0] + side * 0.075, w[1] - 0.11, w[2] + 0.02];
        put('skin', place(ellipsoid(0.11, 0.16, 0.075, 10, 14), { pos: palm }), forePart);

        for (let f = 0; f < 3; f++) {
            const fingerX = palm[0] + side * (f - 1) * 0.045;
            const a = [fingerX, palm[1] - 0.015, palm[2] + 0.035];
            const d = [fingerX + side * (0.1 - f * 0.018), palm[1] - 0.09 + f * 0.025, palm[2] + 0.06];
            put('skin', bezierTube(
                a,
                [a[0] + side * 0.035, a[1] - 0.025, a[2] + 0.02],
                [d[0] - side * 0.025, d[1] - 0.015, d[2] + 0.015],
                d, 0.014, 12), forePart);
        }
    });

    // --- kaki silinder pendek; telapak dan jari mengikuti kurva Bezier ---
    // Dibagi: paha (legP/N) | betis (shinP/N) | telapak (footP/N). Celana kini menyambung ke sepatu
    // (model lama berhenti di y=0.24 sedangkan sepatu mulai y=0.12) dan diberi manset.
    [-1, 1].forEach((side, index) => {
        const x = side * 0.19;
        const left = index === 0;
        const fx = x + (left ? -0.035 : 0.035);

        const legPart = side < 0 ? 'legN' : 'legP';
        const shinPart = side < 0 ? 'shinN' : 'shinP';
        const footPart = side < 0 ? 'footN' : 'footP';
        put('inner', place(cylinder(0.13, 0.13, 0.44, 16, 2), { pos: [x, 0.72, 0.07] }), legPart);                  // paha y 0.50..0.94
        put('inner', place(ellipsoid(0.133, 0.133, 0.133, 10, 14), { pos: [x, 0.5, 0.07] }), legPart);              // sendi lutut
        put('inner', place(cylinder(0.13, 0.12, 0.44, 16, 2), { pos: [x, 0.28, 0.07] }), shinPart);                // betis y 0.06..0.50
        put('cloth', place(cylinder(0.142, 0.142, 0.07, 16, 1, false), { pos: [x, 0.125, 0.07] }), shinPart);      // manset celana
        put('skin', bezierTube(
            [fx, 0, -0.12], [fx, -0.075, 0.06], [fx, -0.065, 0.34], [fx, 0, 0.49],
            t => 0.012 + 0.105 * Math.pow(Math.sin(PI * t), 0.65), 24, 12), footPart);

        for (let t = 0; t < 3; t++) {
            const tx = fx + (t - 1) * 0.065;
            put('skin', bezierTube(
                [tx, 0.105, 0.39], [tx, 0.09, 0.43], [tx, 0.085, 0.47],
                [tx, 0.09, 0.49 - Math.abs(t - 1) * 0.025], 0.012, 10), footPart);
        }
    });

    function MNode(name, t) {
        this.name = name; this.t = t ? t.slice() : [0, 0, 0]; this.r = [0, 0, 0]; this.s = [1, 1, 1];
        this.base = { t: this.t.slice(), r: [0, 0, 0] };
        this.kids = []; this.meshes = [];
    }
    MNode.prototype.add = function (k) { this.kids.push(k); return k; };
    MNode.prototype.local = function () { return LIBS.compose(this.t, this.r, this.s); };

    // pivot (sendi) tiap bagian, koordinat model Mono
    const PIVOT = {
        head:  [0, 2.1, 0],
        armP:  [0.36, 1.9, 0.02],
        armN:  [-0.36, 1.9, 0.02],
        legP:  [0.19, 0.9, 0.07],
        legN:  [-0.19, 0.9, 0.07],
        shinP: [0.19, 0.5, 0.07],  shinN: [-0.19, 0.5, 0.07],     // lutut
        footP: [0.19, 0.15, 0.07], footN: [-0.19, 0.15, 0.07],    // pergelangan kaki
        foreP: ELB.armP,           foreN: ELB.armN                // siku
    };
    const root = new MNode('mono');
    const hips = root.add(new MNode('hips'));          // badan atas: torso + kepala + lengan
    const nodes = { root: root, hips: hips };
    ['head', 'armP', 'armN'].forEach(p => { nodes[p] = hips.add(new MNode(p, PIVOT[p])); });
    ['legP', 'legN'].forEach(p => { nodes[p] = root.add(new MNode(p, PIVOT[p])); });
    // sub-sendi: posisi relatif terhadap pivot induknya
    const sub = (child, parent) => { nodes[child] = nodes[parent].add(new MNode(child, [0, 1, 2].map(i => PIVOT[child][i] - PIVOT[parent][i]))); };
    sub('shinP', 'legP'); sub('shinN', 'legN'); sub('footP', 'shinP'); sub('footN', 'shinN'); sub('foreP', 'armP'); sub('foreN', 'armN');
    nodes.cape = hips.add(new MNode('cape', [0, 1.9, 0.12]));
    nodes.cape.r[0] = 0.12; nodes.cape.base.r[0] = 0.12;

    Object.keys(pieces).forEach(key => {
        const part = key.split('|')[0], name = key.split('|')[1];
        const g = pieces[key];
        let off = [0, 0, 0], target = hips;
        if (name === 'cape') { off = [0, 1.9, 0]; target = nodes.cape; }       // pivot jubah di bahu
        else if (part !== 'torso') { off = PIVOT[part]; target = nodes[part]; }
        const pos = new Float32Array(g.pos.length);
        for (let i = 0; i < pos.length; i += 3) { pos[i] = g.pos[i] - off[0]; pos[i + 1] = g.pos[i + 1] - off[1]; pos[i + 2] = g.pos[i + 2] - off[2]; }
        target.meshes.push({ pos: pos, nor: new Float32Array(g.nor), uv: new Float32Array(g.uv), idx: g.idx, mat: mats[slots[name].mat] });
    });
    return { root: root, nodes: nodes, textures: { coat: coatCanvas } };

};