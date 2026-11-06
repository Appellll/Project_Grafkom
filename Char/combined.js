function initSharedScene() {
  var canvas = document.getElementById('mycanvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x171a1f, 1);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171a1f);
  scene.add(new THREE.HemisphereLight(0xd8d8ff, 0x24233d, 0.8));

  var keyLight = new THREE.DirectionalLight(0xffe3cc, 1.35);
  keyLight.position.set(-4, 8, 6);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -6;
  keyLight.shadow.camera.right = 6;
  keyLight.shadow.camera.top = 6;
  keyLight.shadow.camera.bottom = -4;
  scene.add(keyLight);

  var fillLight = new THREE.DirectionalLight(0x9baeff, 0.35);
  fillLight.position.set(4, 5, -4);
  scene.add(fillLight);

  var stage = new THREE.Group();
  scene.add(stage);

  var six = window.createSixModel();
  six.group.position.x = -1.62;
  six.group.scale.setScalar(0.78);
  stage.add(six.group);

  var mono = window.createMonoModel();
  mono.position.x = 0;
  mono.scale.setScalar(0.49);
  stage.add(mono);

  var janitor = window.createJanitorModel();
  janitor.position.set(2, 0, 0);
  janitor.scale.setScalar(0.62);
  stage.add(janitor);

  var plateGeometry = new THREE.CylinderGeometry(3.35, 3.35, 0.16, 96);
  var plate = new THREE.Mesh(plateGeometry, [
    new THREE.MeshStandardMaterial({ color: 0x292b33, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0x191b21, roughness: 0.92 }),
    new THREE.MeshStandardMaterial({ color: 0x3c3530, roughness: 0.78 })
  ]);
  plate.position.y = -0.08;
  plate.receiveShadow = true;
  stage.add(plate);

  var camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  var cameraTarget = new THREE.Vector3(0, 0.75, 0);
  var cameraOffset = new THREE.Vector3(0, 2.75, 9.8);
  camera.position.copy(cameraTarget).add(cameraOffset);
  camera.lookAt(cameraTarget);

  var autoRotate = false;
  var wireframe = false;
  var idle = false;
  var dragging = false;
  var previousX = 0;
  var previousY = 0;
  var yaw = 0;
  var pitch = 0.21;
  var distance = cameraOffset.length();
  var idleTargets = [six.group, mono, janitor];
  var meshes = [];

  stage.traverse(function (object) {
    if (object.isMesh) {
      object.castShadow = true;
      meshes.push(object);
    }
  });

  function resize() {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function updateCamera() {
    var offset = new THREE.Spherical(distance, Math.PI / 2 - pitch, yaw);
    camera.position.copy(cameraTarget).add(new THREE.Vector3().setFromSpherical(offset));
    camera.lookAt(cameraTarget);
  }

  canvas.addEventListener('pointerdown', function (event) {
    dragging = true;
    previousX = event.clientX;
    previousY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', function (event) {
    if (!dragging) return;
    yaw -= (event.clientX - previousX) * 0.005;
    pitch = THREE.MathUtils.clamp(pitch + (event.clientY - previousY) * 0.005, -0.25, 0.85);
    previousX = event.clientX;
    previousY = event.clientY;
    updateCamera();
  });
  canvas.addEventListener('pointerup', function () { dragging = false; });
  canvas.addEventListener('pointercancel', function () { dragging = false; });
  canvas.addEventListener('wheel', function (event) {
    distance = THREE.MathUtils.clamp(distance + event.deltaY * 0.008, 6, 20);
    updateCamera();
    event.preventDefault();
  }, { passive: false });

  document.getElementById('btnRotate').addEventListener('click', function () {
    autoRotate = !autoRotate;
    this.classList.toggle('on', autoRotate);
  });
  document.getElementById('btnWire').addEventListener('click', function () {
    wireframe = !wireframe;
    meshes.forEach(function (mesh) {
      var materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach(function (material) { material.wireframe = wireframe; });
    });
    this.classList.toggle('on', wireframe);
  });
  document.getElementById('btnIdle').addEventListener('click', function () {
    idle = !idle;
    this.classList.toggle('on', idle);
  });
  document.getElementById('btnReset').addEventListener('click', function () {
    yaw = 0;
    pitch = 0.21;
    distance = cameraOffset.length();
    updateCamera();
  });

  var triangleCount = six.triangleCount;
  meshes.forEach(function (mesh) {
    var geometry = mesh.geometry;
    var vertexCount = geometry.index ? geometry.index.count : geometry.attributes.position.count;
    triangleCount += vertexCount / 3;
  });
  document.getElementById('triCount').textContent = Math.round(triangleCount).toLocaleString('id-ID');

  window.addEventListener('resize', resize);
  resize();
  var clock = new THREE.Clock();
  function render() {
    var delta = clock.getDelta();
    var time = clock.elapsedTime;
    if (autoRotate) stage.rotation.y += delta * 0.6;
    idleTargets.forEach(function (character, index) {
      character.rotation.y = idle ? Math.sin(time * 1.2 + index) * 0.055 : 0;
    });
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  render();
  document.getElementById('loading').style.display = 'none';
}
