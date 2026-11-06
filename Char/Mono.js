window.createMonoModel = function () {
const character = new THREE.Group();

const materials = {
    coat: new THREE.MeshStandardMaterial({ color: 0x24232b, roughness: 0.96 }),
    coatEdge: new THREE.MeshStandardMaterial({ color: 0x45434a, roughness: 1 }),
    inner: new THREE.MeshStandardMaterial({ color: 0x17171d, roughness: 1 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x484646, roughness: 1 }),
    clothLight: new THREE.MeshStandardMaterial({ color: 0x625b55, roughness: 1 }),
    bag: new THREE.MeshStandardMaterial({ color: 0x514b47, roughness: 1 }),
    bagLight: new THREE.MeshStandardMaterial({ color: 0x6a6059, roughness: 1 }),
    eye: new THREE.MeshBasicMaterial({ color: 0x080916 }),
    skin: new THREE.MeshStandardMaterial({ color: 0x47413e, roughness: 1 }),
    button: new THREE.MeshStandardMaterial({ color: 0x948b7e, roughness: 0.8 })
};

Object.values(materials).forEach(material => {
    material.side = THREE.DoubleSide;
});

function addMesh(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const object = new MyObject(geometry, material)
        .setPosition(...position)
        .setScale(...scale)
        .setRotation(...rotation);
    character.add(object.getMesh());
    return object.getMesh();
}

function addBezier(start, control1, control2, end, radius, material, segments = 40) {
    const curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(...start),
        new THREE.Vector3(...control1),
        new THREE.Vector3(...control2),
        new THREE.Vector3(...end)
    );
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
    character.add(mesh);
    return mesh;
}

function addCylinderBetween(start, end, radius, material, radialSegments = 8) {
    const from = new THREE.Vector3(...start);
    const to = new THREE.Vector3(...end);
    const direction = new THREE.Vector3().subVectors(to, from);
    const mesh = addMesh(
        new THREE.CylinderGeometry(radius * 0.86, radius, direction.length(), radialSegments),
        material,
        [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2]
    );
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
}

function createHyperboloidHeadGeometry() {
    const ringCount = 32;
    const sideCount = 64;
    const waistRadiusX = 0.32;
    const waistRadiusZ = 0.30;
    const verticalScale = 0.82;
    const halfHeight = 0.52;
    const vertices = [];
    const indices = [];

    for (let ring = 0; ring <= ringCount; ring += 1) {
        const y = -halfHeight + (ring / ringCount) * halfHeight * 2;
        const hyperboloidScale = Math.sqrt(1 + (y * y) / (verticalScale * verticalScale));

        for (let side = 0; side < sideCount; side += 1) {
            const angle = (side / sideCount) * Math.PI * 2;
            vertices.push(
                waistRadiusX * hyperboloidScale * Math.cos(angle),
                y,
                waistRadiusZ * hyperboloidScale * Math.sin(angle)
            );
        }
    }

    for (let ring = 0; ring < ringCount; ring += 1) {
        for (let side = 0; side < sideCount; side += 1) {
            const current = ring * sideCount + side;
            const next = ring * sideCount + (side + 1) % sideCount;
            const upper = current + sideCount;
            const upperNext = next + sideCount;
            indices.push(current, upper, next, next, upper, upperNext);
        }
    }

    const bottomCenter = vertices.length / 3;
    vertices.push(0, -halfHeight, 0);
    const topCenter = vertices.length / 3;
    vertices.push(0, halfHeight, 0);
    for (let side = 0; side < sideCount; side += 1) {
        const next = (side + 1) % sideCount;
        const top = ringCount * sideCount + side;
        const topNext = ringCount * sideCount + next;
        indices.push(bottomCenter, next, side);
        indices.push(topCenter, top, topNext);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

function addBackCape() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.25, 1.91);
    shape.bezierCurveTo(-0.52, 1.62, -0.68, 0.88, -1.02, 0.48);
    shape.bezierCurveTo(-0.66, 0.36, -0.31, 0.57, 0, 0.78);
    shape.bezierCurveTo(0.31, 0.57, 0.66, 0.36, 1.02, 0.48);
    shape.bezierCurveTo(0.68, 0.88, 0.52, 1.62, 0.25, 1.91);
    shape.bezierCurveTo(0.1, 1.84, -0.1, 1.84, -0.25, 1.91);
    const cape = addMesh(
        new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.035, bevelThickness: 0.025, curveSegments: 18 }),
        materials.coat,
        [0, 0, -0.28]
    );
    cape.castShadow = true;
}

// Coat tails sweep outward behind the legs, with a narrow tapered torso in front.
addBackCape();
addMesh(new THREE.CylinderGeometry(0.28, 0.53, 1.18, 24, 4), materials.coat, [0, 1.38, 0.02]);
addMesh(new THREE.CylinderGeometry(0.22, 0.34, 0.82, 18, 2), materials.inner, [0, 1.43, 0.19]);
addMesh(new THREE.CylinderGeometry(0.15, 0.18, 0.28, 12), materials.cloth, [0, 2.02, 0]);

// Folded lapels and small coat buttons.
addBezier([-0.29, 1.89, 0.31], [-0.23, 1.61, 0.43], [-0.1, 1.42, 0.47], [0.02, 1.19, 0.48], 0.035, materials.coatEdge, 24);
addBezier([0.29, 1.89, 0.31], [0.23, 1.61, 0.43], [0.1, 1.42, 0.47], [-0.02, 1.19, 0.48], 0.035, materials.coatEdge, 24);
[-1, 1].forEach(side => {
    [1.65, 1.35, 1.05].forEach(y => {
        addMesh(new THREE.SphereGeometry(0.035, 10, 8), materials.button, [side * 0.19, y, 0.42], [1, 1, 0.45]);
    });
});

const bagHead = addMesh(
    createHyperboloidHeadGeometry(),
    materials.bag,
    [0, 2.57, 0],
    [1.12, 1, 1.06]
);
bagHead.castShadow = true;

// The top crumple and side creases give the bag a paper silhouette.
addBezier([-0.35, 3.03, 0.16], [-0.19, 3.12, 0.25], [0.17, 3.1, 0.25], [0.36, 3.02, 0.16], 0.018, materials.bagLight, 24);
addBezier([-0.39, 2.24, 0.21], [-0.33, 2.37, 0.29], [-0.34, 2.77, 0.29], [-0.39, 2.96, 0.2], 0.009, materials.bagLight, 20);
addBezier([0.39, 2.24, 0.21], [0.33, 2.42, 0.29], [0.36, 2.76, 0.28], [0.4, 2.96, 0.2], 0.009, materials.coatEdge, 20);

// Two small, flat black eyes sit on the front of the sack.
[-1, 1].forEach(side => {
    addMesh(
        new THREE.SphereGeometry(0.092, 16, 12),
        materials.eye,
        [side * 0.15, 2.56, 0.359],
        [1, 1, 0.28]
    );
});

// Long, slightly bent sleeves hang down beside the coat.
const arms = [
    { side: -1, shoulder: [-0.34, 1.84, 0.02], elbow1: [-0.49, 1.56, 0.08], elbow2: [-0.68, 1.14, 0.15], wrist: [-0.91, 0.83, 0.2] },
    { side: 1, shoulder: [0.34, 1.84, 0.02], elbow1: [0.49, 1.56, 0.08], elbow2: [0.68, 1.14, 0.15], wrist: [0.91, 0.83, 0.2] }
];

arms.forEach(({ side, shoulder, elbow1, elbow2, wrist }) => {
    addBezier(shoulder, elbow1, elbow2, wrist, 0.13, materials.cloth, 44);
    const cuffStart = [wrist[0] - side * 0.07, wrist[1], wrist[2]];
    const cuffEnd = [wrist[0] + side * 0.07, wrist[1], wrist[2]];
    addCylinderBetween(cuffStart, cuffEnd, 0.14, materials.coatEdge);

    const palm = [wrist[0] + side * 0.075, wrist[1] - 0.11, wrist[2] + 0.02];
    addMesh(new THREE.SphereGeometry(1, 14, 10), materials.skin, palm, [0.11, 0.16, 0.075]);

    for (let finger = 0; finger < 3; finger += 1) {
        const offsetY = 0.035 - finger * 0.05;
        const start = [palm[0] + side * 0.035, palm[1] - 0.015 + offsetY, palm[2] + 0.035];
        const end = [start[0] + side * (0.13 - finger * 0.015), start[1] - 0.09 + finger * 0.035, start[2] + 0.005];
        addBezier(
            start,
            [start[0] + side * 0.045, start[1] - 0.025, start[2] + 0.02],
            [end[0] - side * 0.035, end[1] - 0.015, end[2] + 0.015],
            end,
            0.018,
            materials.skin,
            12
        );
    }
});

// Short trouser legs and small bare feet.
[-1, 1].forEach((side, index) => {
    const x = side * 0.19;
    const legBottom = index === 0 ? 0.22 : 0.18;
    addCylinderBetween([x, 0.94, 0.06], [x + (index === 0 ? -0.03 : 0.03), legBottom, 0.08], 0.13, materials.inner, 10);
    addMesh(new THREE.TorusGeometry(0.115, 0.025, 6, 14), materials.coatEdge, [x, 0.29, 0.08], [1, 1, 1], [Math.PI / 2, 0, 0]);

    const footX = x + (index === 0 ? -0.04 : 0.04);
    addMesh(new THREE.SphereGeometry(1, 16, 12), materials.skin, [footX, 0.12, 0.22], [0.17, 0.095, 0.29]);
    for (let toe = 0; toe < 3; toe += 1) {
        const toeX = footX + (toe - 1) * 0.065;
        addBezier(
            [toeX, 0.105, 0.39],
            [toeX, 0.09, 0.43],
            [toeX, 0.085, 0.47],
            [toeX, 0.09, 0.49 - Math.abs(toe - 1) * 0.025],
            0.018,
            materials.skin,
            10
        );
    }
});

return character;
};
