class MyObject {
    constructor(geometry, material) {
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = false;
    }

    setPosition(x, y, z) {
        this.mesh.position.set(x, y, z);
        return this;
    }

    setScale(x, y, z) {
        this.mesh.scale.set(x, y, z);
        return this;
    }

    setRotation(x, y, z) {
        this.mesh.rotation.set(x, y, z);
        return this;
    }

    getMesh() {
        return this.mesh;
    }
}

window.MyObject = MyObject;
