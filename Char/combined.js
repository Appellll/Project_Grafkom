/* =========================================================
 *  combined.js - renderer, UI, loop utama.
 *  Karakter: six.js / Mono.js / janitor.js | Environment: Env.js
 *  Animasi: Anim.js | Suara: Sfx.js
 * ========================================================= */
function initSharedScene() {
  var canvas = document.getElementById('mycanvas');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x080705, 1);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080705);
  scene.fog = new THREE.FogExp2(0x0a0907, 0.07);

  var env = window.createLNEnvironment();
  scene.add(env.root);

  var six = window.createSixModel();
  var mono = window.createMonoModel();
  var jan = window.createJanitorModel();
  var sfx = window.createSfx();
  var anim = window.createAnimation({ scene: scene, env: env, six: six, mono: mono, jan: jan, sfx: sfx });

  var camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  camera.position.set(-3.8, 1.0, 5.8);

  /* ---------- state ---------- */
  var t = 0, playing = false, started = false, freeCam = false, DUR = anim.duration;
  var yaw = 0, pitch = 0.2, dist = 12, target = new THREE.Vector3(3, 1.2, -1), dragging = false, px = 0, py = 0;
  var $ = function (id) { return document.getElementById(id); };
  var slider = $('seek'), timeTxt = $('time'), shotTxt = $('shot');

  function fmt(s) { var m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + (x < 10 ? '0' : '') + x; }
  function setPlaying(p) {
    playing = p;
    $('btnPlay').textContent = p ? 'Jeda' : (t >= DUR ? 'Putar ulang' : 'Putar');
    if (p) sfx.resume(); else sfx.suspend();
  }
  function seek(v) { t = Math.max(0, Math.min(DUR, v)); anim.resetAudioClock(t); sfx.reset(); }

  $('startBtn').addEventListener('click', function () {
    sfx.unlock(); started = true; $('startCard').style.display = 'none'; seek(0); setPlaying(true);
  });
  $('btnPlay').addEventListener('click', function () {
    if (t >= DUR) { seek(0); }
    setPlaying(!playing);
  });
  $('btnRestart').addEventListener('click', function () { seek(0); sfx.unlock(); setPlaying(true); });
  slider.addEventListener('input', function () { seek(parseFloat(slider.value) / 1000 * DUR); });
  $('btnMute').addEventListener('click', function () { sfx.setMuted(!sfx.isMuted()); this.textContent = sfx.isMuted() ? 'Suara: mati' : 'Suara: hidup'; });
  $('btnCam').addEventListener('click', function () { freeCam = !freeCam; this.classList.toggle('on', freeCam); updateOrbit(); });
  $('btnWire').addEventListener('click', function () {
    var on = !this.classList.contains('on'); this.classList.toggle('on', on);
    scene.traverse(function (o) { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.wireframe = on; }); });
  });
  $('bright').addEventListener('input', function () { renderer.toneMappingExposure = parseFloat(this.value); });

  /* kamera bebas (orbit) */
  function updateOrbit() {
    if (!freeCam) return;
    var o = new THREE.Vector3().setFromSpherical(new THREE.Spherical(dist, Math.PI / 2 - pitch, yaw));
    camera.position.copy(target).add(o); camera.lookAt(target);
    camera.fov = 45; camera.updateProjectionMatrix();
  }
  canvas.addEventListener('pointerdown', function (e) { dragging = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging || !freeCam) return;
    yaw -= (e.clientX - px) * 0.005; pitch = Math.max(-0.3, Math.min(1.2, pitch + (e.clientY - py) * 0.005));
    px = e.clientX; py = e.clientY; updateOrbit();
  });
  canvas.addEventListener('pointerup', function () { dragging = false; });
  canvas.addEventListener('wheel', function (e) {
    if (!freeCam) return; dist = Math.max(2, Math.min(30, dist + e.deltaY * 0.01)); updateOrbit(); e.preventDefault();
  }, { passive: false });

  /* grain film */
  var grain = $('grain'), gctx = grain.getContext('2d'), gimg = gctx.createImageData(128, 128), gAcc = 0;
  function drawGrain() {
    for (var i = 0; i < gimg.data.length; i += 4) { var v = Math.random() * 255; gimg.data[i] = gimg.data[i + 1] = gimg.data[i + 2] = v; gimg.data[i + 3] = 255; }
    gctx.putImageData(gimg, 0, 0);
  }

  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize); resize();

  var clock = new THREE.Clock(), lastTitle = '';
  function frame() {
    var dt = Math.min(clock.getDelta(), 0.1);
    if (playing) {
      t += dt;
      if (t >= DUR) { t = DUR; setPlaying(false); $('btnPlay').textContent = 'Putar ulang'; }
    }
    var r = anim.update(t, playing, camera, freeCam);
    if (!freeCam && r.shot) { shotTxt.textContent = r.shot.name; }
    else if (freeCam) { updateOrbit(); shotTxt.textContent = 'Kamera bebas'; }
    // overlay
    var o = r.overlay;
    $('fade').style.opacity = o.fade;
    var tt = $('titleCard');
    if (o.title) { tt.style.opacity = o.title.alpha; if (lastTitle !== o.title.text) { $('tKick').textContent = o.title.kicker; $('tText').textContent = o.title.text; lastTitle = o.title.text; } }
    else { tt.style.opacity = 0; lastTitle = ''; }
    $('caption').textContent = o.caption; $('caption').style.opacity = o.caption ? 1 : 0;
    if (document.activeElement !== slider) slider.value = Math.round(t / DUR * 1000);
    timeTxt.textContent = fmt(t) + ' / ' + fmt(DUR);
    gAcc += dt; if (gAcc > 0.08) { gAcc = 0; drawGrain(); }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();
  $('loading').style.display = 'none';
}
