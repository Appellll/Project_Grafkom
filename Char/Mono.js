/* ==========================================================
 * mono.js  -  Karakter "Mono" (Little Nightmares)
 *
 * Semua geometri dibangkitkan manual (array posisi / normal / index),
 * TANPA THREE.SphereGeometry / CylinderGeometry / TubeGeometry / dst.
 * THREE hanya dipakai sebagai wadah akhir (Group, BufferGeometry, Mesh).
 *
 * JENIS OBJEK YANG DIPAKAI
 *   1. Ellipsoid (quadric)                  : mata, telapak tangan, telapak kaki, kancing
 *   2. Hyperboloid satu lembar (quadric)    : kepala kantong kertas
 *   3. Cylinder / cone terpotong (quadric)  : badan jas, dalaman, leher, kaki, manset
 *   + Torus                                 : cincin ujung celana
 *   + Tube hasil sapuan kurva Bezier kubik  : lengan, lapel, lipatan kantong, jari tangan, jari kaki
 *   + Extrude kurva Bezier (+ bevel)        : jubah di punggung
 * ========================================================== */

window.createMonoModel = function () {
    'use strict';

    const PI = Math.PI;
    const character = new THREE.Group();

    /* ==========================================================
     *  BAGIAN 1 : MATEMATIKA KECIL
     * ========================================================== */
    const vAdd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const vSub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const vMul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
    const vDot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const vCross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
    const vNorm = a => {
        const l = Math.hypot(a[0], a[1], a[2]);
        return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 1, 0];
    };

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
    const newGeo = () => ({ pos: [], nor: [], idx: [] });

    function pushVertex(g, p, n) {
        g.pos.push(p[0], p[1], p[2]);
        g.nor.push(n[0], n[1], n[2]);
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

    // normal halus dari rata-rata normal bidang (berbobot luas) di tiap vertex
    function smoothNormals(g) {
        const acc = new Array(g.pos.length).fill(0), P = g.pos, I = g.idx;
        for (let t = 0; t < I.length; t += 3) {
            const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
            const f = vCross(
                [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]],
                [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]]
            );
            [a, b, c].forEach(o => { acc[o] += f[0]; acc[o + 1] += f[1]; acc[o + 2] += f[2]; });
        }
        g.nor = [];
        for (let i = 0; i < acc.length; i += 3) {
            const n = vNorm([acc[i], acc[i + 1], acc[i + 2]]);
            g.nor.push(n[0], n[1], n[2]);
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
        out.idx = g.idx.slice();
        return out;
    }

    function append(target, src) {
        const base = target.pos.length / 3;
        for (let i = 0; i < src.pos.length; i++) { target.pos.push(src.pos[i]); target.nor.push(src.nor[i]); }
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
    function cylinder(rTop, rBottom, h, radial, rows, caps) {
        const g = newGeo();
        const slope = (rBottom - rTop) / h;
        for (let r = 0; r <= rows; r++) {
            const v = r / rows, y = h / 2 - v * h, rad = rTop + (rBottom - rTop) * v;
            for (let j = 0; j <= radial; j++) {
                const th = 2 * PI * j / radial, c = Math.cos(th), s = Math.sin(th);
                pushVertex(g, [rad * c, y, rad * s], vNorm([c, slope, s]));
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
            for (let j = 0; j <= sides; j++) {
                const a = 2 * PI * j / sides;
                const dir = vAdd(vMul(N, Math.cos(a)), vMul(B, Math.sin(a)));
                pushVertex(g, vAdd(C, vMul(dir, radius)), dir);
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
                g.pos.push(a * k * Math.cos(ang), y, b * k * Math.sin(ang));
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
        // tutup bawah & atas dengan kipas segitiga
        const bottom = g.pos.length / 3; g.pos.push(0, -half, 0);
        const top = g.pos.length / 3;    g.pos.push(0, half, 0);
        for (let s = 0; s < sides; s++) {
            const nxt = (s + 1) % sides;
            g.idx.push(bottom, nxt, s);
            g.idx.push(top, rings * sides + s, rings * sides + nxt);
        }
        return smoothNormals(g);
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
    const mats = {
        coat:     new THREE.MeshStandardMaterial({ color: 0x24232b, roughness: 0.96 }),
        coatEdge: new THREE.MeshStandardMaterial({ color: 0x45434a, roughness: 1 }),
        inner:    new THREE.MeshStandardMaterial({ color: 0x17171d, roughness: 1 }),
        cloth:    new THREE.MeshStandardMaterial({ color: 0x484646, roughness: 1 }),
        bag:      new THREE.MeshStandardMaterial({ color: 0x514b47, roughness: 1 }),
        bagLight: new THREE.MeshStandardMaterial({ color: 0x6a6059, roughness: 1 }),
        eye:      new THREE.MeshBasicMaterial({ color: 0x080916 }),
        skin:     new THREE.MeshStandardMaterial({ color: 0x47413e, roughness: 1 }),
        button:   new THREE.MeshStandardMaterial({ color: 0x948b7e, roughness: 0.8 })
    };
    Object.keys(mats).forEach(k => { mats[k].side = THREE.DoubleSide; });

    // satu slot = satu mesh akhir (geometri bermaterial sama digabung)
    const slots = {
        cape:     { mat: 'coat', shadow: true },
        coat:     { mat: 'coat' },
        coatEdge: { mat: 'coatEdge' },
        inner:    { mat: 'inner' },
        cloth:    { mat: 'cloth' },
        bagHead:  { mat: 'bag', shadow: true },
        bagLight: { mat: 'bagLight' },
        eye:      { mat: 'eye' },
        skin:     { mat: 'skin' },
        button:   { mat: 'button' }
    };
    const pieces = {};
    function put(slot, geo) {
        if (!pieces[slot]) pieces[slot] = newGeo();
        append(pieces[slot], geo);
    }

    /* ==========================================================
     *  BAGIAN 5 : MERAKIT MONO
     * ========================================================== */

    // --- jubah belakang + badan ---
    put('cape', place(extrudedCape(), { pos: [0, 0, -0.28] }));
    put('coat',  place(cylinder(0.28, 0.53, 1.18, 24, 4), { pos: [0, 1.38, 0.02] }));
    put('inner', place(cylinder(0.22, 0.34, 0.82, 18, 2), { pos: [0, 1.43, 0.19] }));
    put('cloth', place(cylinder(0.15, 0.18, 0.28, 12, 1), { pos: [0, 2.02, 0] }));

    // --- lapel (kurva Bezier) ---
    put('coatEdge', bezierTube([-0.29, 1.89, 0.31], [-0.23, 1.61, 0.43], [-0.1, 1.42, 0.47], [0.02, 1.19, 0.48], 0.035, 24));
    put('coatEdge', bezierTube([0.29, 1.89, 0.31], [0.23, 1.61, 0.43], [0.1, 1.42, 0.47], [-0.02, 1.19, 0.48], 0.035, 24));

    // --- kancing (ellipsoid pipih) ---
    [-1, 1].forEach(side => {
        [1.65, 1.35, 1.05].forEach(y => {
            put('button', place(ellipsoid(0.035, 0.035, 0.035 * 0.45, 8, 10), { pos: [side * 0.19, y, 0.42] }));
        });
    });

    // --- kepala kantong kertas (hyperboloid) + lipatan ---
    put('bagHead', place(hyperboloidHead(), { pos: [0, 2.57, 0], scale: [1.12, 1, 1.06] }));
    put('bagLight', bezierTube([-0.35, 3.03, 0.16], [-0.19, 3.12, 0.25], [0.17, 3.1, 0.25], [0.36, 3.02, 0.16], 0.018, 24));
    put('bagLight', bezierTube([-0.39, 2.24, 0.21], [-0.33, 2.37, 0.29], [-0.34, 2.77, 0.29], [-0.39, 2.96, 0.2], 0.009, 20));
    put('coatEdge', bezierTube([0.39, 2.24, 0.21], [0.33, 2.42, 0.29], [0.36, 2.76, 0.28], [0.4, 2.96, 0.2], 0.009, 20));

    // --- dua mata (ellipsoid pipih) ---
    [-1, 1].forEach(side => {
        put('eye', place(ellipsoid(0.092, 0.092, 0.092 * 0.28, 12, 16), { pos: [side * 0.15, 2.56, 0.359] }));
    });

    // --- lengan panjang + manset + tangan ---
    const arms = [
        { side: -1, shoulder: [-0.34, 1.84, 0.02], elbow1: [-0.49, 1.56, 0.08], elbow2: [-0.68, 1.14, 0.15], wrist: [-0.91, 0.83, 0.2] },
        { side:  1, shoulder: [0.34, 1.84, 0.02],  elbow1: [0.49, 1.56, 0.08],  elbow2: [0.68, 1.14, 0.15],  wrist: [0.91, 0.83, 0.2] }
    ];
    arms.forEach(arm => {
        const s = arm.side, w = arm.wrist;

        put('cloth', bezierTube(arm.shoulder, arm.elbow1, arm.elbow2, w, 0.13, 44));

        put('coatEdge', cylinderBetween([w[0] - s * 0.07, w[1], w[2]], [w[0] + s * 0.07, w[1], w[2]], 0.14, 8));

        const palm = [w[0] + s * 0.075, w[1] - 0.11, w[2] + 0.02];
        put('skin', place(ellipsoid(0.11, 0.16, 0.075, 10, 14), { pos: palm }));

        for (let f = 0; f < 3; f++) {
            const dy = 0.035 - f * 0.05;
            const a = [palm[0] + s * 0.035, palm[1] - 0.015 + dy, palm[2] + 0.035];
            const d = [a[0] + s * (0.13 - f * 0.015), a[1] - 0.09 + f * 0.035, a[2] + 0.005];
            put('skin', bezierTube(
                a,
                [a[0] + s * 0.045, a[1] - 0.025, a[2] + 0.02],
                [d[0] - s * 0.035, d[1] - 0.015, d[2] + 0.015],
                d, 0.018, 12));
        }
    });

    // --- kaki celana pendek + cincin + telapak kaki + jari kaki ---
    [-1, 1].forEach((side, index) => {
        const x = side * 0.19;
        const left = index === 0;
        const bottom = left ? 0.22 : 0.18;

        put('inner', cylinderBetween([x, 0.94, 0.06], [x + (left ? -0.03 : 0.03), bottom, 0.08], 0.13, 10));
        put('coatEdge', place(torus(0.115, 0.025, 6, 14), { pos: [x, 0.29, 0.08], rot: [PI / 2, 0, 0] }));

        const fx = x + (left ? -0.04 : 0.04);
        put('skin', place(ellipsoid(0.17, 0.095, 0.29, 12, 16), { pos: [fx, 0.12, 0.22] }));

        for (let t = 0; t < 3; t++) {
            const tx = fx + (t - 1) * 0.065;
            put('skin', bezierTube(
                [tx, 0.105, 0.39], [tx, 0.09, 0.43], [tx, 0.085, 0.47],
                [tx, 0.09, 0.49 - Math.abs(t - 1) * 0.025], 0.018, 10));
        }
    });

    /* ==========================================================
     *  BAGIAN 6 : BUNGKUS KE THREE.JS
     * ========================================================== */
    Object.keys(slots).forEach(name => {
        const g = pieces[name];
        if (!g) return;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3));
        geometry.setIndex(g.idx);
        const mesh = new THREE.Mesh(geometry, mats[slots[name].mat]);
        mesh.name = 'mono_' + name;
        mesh.castShadow = !!slots[name].shadow;
        character.add(mesh);
    });

    return character;
};