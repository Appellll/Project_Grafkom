// kasih "export" kalau live server
// hapus "export" kalau pakai f5
import { CSG } from "./csg.js";
export function generateBSpline(controlPoint, m, degree) {
    var curves = [];
    var knotVector = [];
    var n = controlPoint.length / 2;

    // Generate knot vector
    for (var i = 0; i < n + degree + 1; i++) {
        if (i < degree + 1) knotVector.push(0);
        else if (i >= n) knotVector.push(n - degree);
        else knotVector.push(i - degree);
    }

    // Basis function
    var basisFunc = function (i, j, t) {
        if (j == 0) {
            if (t >= knotVector[n] && i === n - 1) return 1;
            return (knotVector[i] <= t && t < knotVector[i + 1]) ? 1 : 0;
        }
        var den1 = knotVector[i + j] - knotVector[i];
        var den2 = knotVector[i + j + 1] - knotVector[i + 1];

        var term1 = 0, term2 = 0;
        if (den1 != 0 && !isNaN(den1)) {
            term1 = ((t - knotVector[i]) / den1) * basisFunc(i, j - 1, t);
        }
        if (den2 != 0 && !isNaN(den2)) {
            term2 = ((knotVector[i + j + 1] - t) / den2) * basisFunc(i + 1, j - 1, t);
        }
        return term1 + term2;
    };

    for (var t = 0; t < m; t++) {
        var x = 0, y = 0;
        var u = (t / (m - 1) * (knotVector[n] - knotVector[degree])) + knotVector[degree];
        for (var key = 0; key < n; key++) {
            var C = basisFunc(key, degree, u);
            x += (controlPoint[key * 2] * C);
            y += (controlPoint[key * 2 + 1] * C);
        }
        curves.push(x);
        curves.push(y);
    }
    return curves;
}

export function generateEllipsoid(a, b, c, stack, step) {
    var vertices = [];
    var faces = [];

    // Generate vertices and colors
    for (var i = 0; i <= stack; i++) {
        var u = i / stack * Math.PI - (Math.PI / 2); // Latitude -> garis lintang (atas-bawah)
        for (var j = 0; j <= step; j++) {
            var v = j / step * 2 * Math.PI - Math.PI; // Longitude -> garis bujur (kiri-kanan)

            var x = a * Math.cos(v) * Math.cos(u);
            var y = b * Math.sin(u);
            var z = c * Math.sin(v) * Math.cos(u);

            // Push vertex position
            vertices.push(x, y, z);
            // Push color data (derived from position)
            vertices.push(...[x, y, z].map(val => val / 2 + 0.5));
        }
    }

    // Generate faces (indices)
    for (var i = 0; i < stack; i++) {
        for (var j = 0; j < step; j++) {
            // Index of the 4 vertices forming a quad
            var first = i * (step + 1) + j;
            var second = first + 1;
            var third = first + (step + 1);
            var fourth = third + 1;

            // Push two triangles to form the quad
            faces.push(first, second, fourth);
            faces.push(first, fourth, third);
        }
    }
    return { vertices, faces };
}

export function generateCone(radius, height, step) {
    var vertices = [];
    var faces = [];

    // Vertex puncak
    vertices.push(
        0, height / 2, 0,   // position
        1, 1, 1             // color
    );

    // Vertex pusat alas
    var centerIndex = 1;

    // Vertex lingkaran alas
    for (var i = 0; i < step; i++) {
        var angle = i / step * 2 * Math.PI;

        var x = radius * Math.cos(angle);
        var z = radius * Math.sin(angle);
        var y = -height / 2;

        // Position
        vertices.push(x, y, z);

        // Color
        vertices.push(
            Math.abs(x / radius),
            0.5,
            Math.abs(z / radius)
        );
    }

    // Membuat sisi kerucut
    for (var i = 0; i < step; i++) {
        var current = 1 + i;
        var next = 1 + ((i + 1) % step);

        // Segitiga sisi kerucut
        faces.push(
            0,      // puncak
            current,
            next
        );
    }

    // Tambahkan vertex pusat alas
    vertices.push(
        0, -height / 2, 0,
        0.5, 0.5, 0.5
    );

    var centerVertex = 1 + step;

    // Membuat alas kerucut
    for (var i = 0; i < step; i++) {
        var current = 1 + i;
        var next = 1 + ((i + 1) % step);

        faces.push(
            centerVertex,
            next,
            current
        );
    }

    return { vertices, faces };
}

// CSG TO MESH (berlaku untuk objek objek pada csg.js saja)
// helpers/builders.js

export function csgToMesh(csgObject) {
    var polygons = csgObject.toPolygons();
    var vertices = [];
    var faces = [];
    var vertexCount = 0;

    for (var i = 0; i < polygons.length; i++) {
        var poly = polygons[i];
        var count = poly.vertices.length;
        if (count < 3) continue;

        var startIndex = vertexCount;

        for (var j = 0; j < count; j++) {
            var v = poly.vertices[j];

            // 1. Position (X, Y, Z)
            vertices.push(v.pos.x, v.pos.y, v.pos.z);

            // 2. Color (derived from normal vector for 3D shading tone)
            var r = Math.abs(v.normal.x) * 0.6 + 0.4;
            var g = Math.abs(v.normal.y) * 0.6 + 0.4;
            var b = Math.abs(v.normal.z) * 0.6 + 0.4;
            vertices.push(r, g, b);

            vertexCount++;
        }

        // Triangulate convex polygon using Triangle Fan
        for (var k = 1; k < count - 1; k++) {
            faces.push(startIndex, startIndex + k, startIndex + k + 1);
        }
    }

    return { vertices, faces };
}

export function meshToCSG(mesh) {
    var polygons = [];

    var vertices = mesh.vertices;
    var faces = mesh.faces;

    // Setiap vertex memiliki 6 data:
    // X, Y, Z, R, G, B
    function getVertex(index) {
        var i = index * 6;

        var pos = new CSG.Vector(
            vertices[i],
            vertices[i + 1],
            vertices[i + 2]
        );

        // Normal sementara
        var normal = new CSG.Vector(0, 0, 0);

        return new CSG.Vertex(pos, normal);
    }

    // Setiap 3 index = 1 triangle
    for (var i = 0; i < faces.length; i += 3) {
        var v1 = getVertex(faces[i]);
        var v2 = getVertex(faces[i + 1]);
        var v3 = getVertex(faces[i + 2]);

        polygons.push(
            new CSG.Polygon([
                v1,
                v2,
                v3
            ])
        );
    }

    return CSG.fromPolygons(polygons);
}