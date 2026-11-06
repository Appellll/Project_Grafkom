window.createJanitorModel = function () {
  var janitor = Janitor.create(null);
  var character = new THREE.Group();

  function addNode(node, parent) {
    var group = new THREE.Group();
    group.matrixAutoUpdate = false;
    group.matrix.fromArray(node.local());
    parent.add(group);

    if (node.mesh) {
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(node.mesh.p, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(node.mesh.n, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(node.mesh.c, 3));
      geometry.setIndex(node.mesh.i);
      group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.82,
        side: THREE.DoubleSide
      })));
    }

    node.children.forEach(function (child) { addNode(child, group); });
  }

  addNode(janitor.root, character);
  window.janitor = janitor;
  return character;
};
