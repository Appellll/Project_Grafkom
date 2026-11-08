function initScene() {
  var canvas = document.getElementById('mycanvas');
  var R = window.createRenderer(canvas);
  var env = window.createLNEnvironment(R);
  var six = window.createSixModel(), mono = window.createMonoModel(), jan = window.createJanitorModel();
  var sfx = window.createSfx();
  var anim = window.createAnimation({ R: R, env: env, six: six, mono: mono, jan: jan, sfx: sfx });

  var t = 0, playing = false, freeCam = false, DUR = anim.duration, exposure = 0.95;
  var yaw = 0, pitch = 0.2, dist = 12, target = [3, 1.2, -1], dragging = false, px = 0, py = 0;
  var $ = function (id) { return document.getElementById(id); };
  var slider = $('seek');
  function fmt(s) { var m = Math.floor(s / 60), x = Math.floor(s % 60); return m + ':' + (x < 10 ? '0' : '') + x; }
  function setPlaying(p) { playing = p; $('btnPlay').textContent = p ? 'Jeda' : (t >= DUR ? 'Putar ulang' : 'Putar'); if (p) sfx.resume(); else sfx.suspend(); }
  function seek(v) { t = Math.max(0, Math.min(DUR, v)); anim.resetAudioClock(t); sfx.reset(); }
  var camOverride = null;
  window.__seek = seek; window.__setPlaying = setPlaying; window.__cam = function (o) { camOverride = o; };   // untuk debugging

  $('startBtn').addEventListener('click', function () { sfx.unlock(); $('startCard').style.display = 'none'; seek(0); setPlaying(true); });
  $('btnPlay').addEventListener('click', function () { if (t >= DUR) seek(0); setPlaying(!playing); });
  $('btnRestart').addEventListener('click', function () { seek(0); sfx.unlock(); setPlaying(true); });
  slider.addEventListener('input', function () { seek(parseFloat(slider.value) / 1000 * DUR); });
  $('btnMute').addEventListener('click', function () { sfx.setMuted(!sfx.isMuted()); this.textContent = sfx.isMuted() ? 'Suara: mati' : 'Suara: hidup'; });
  $('btnCam').addEventListener('click', function () { freeCam = !freeCam; this.classList.toggle('on', freeCam); });
  $('bright').addEventListener('input', function () { exposure = parseFloat(this.value); });

  canvas.addEventListener('pointerdown', function (e) { dragging = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', function (e) {
    if (!dragging || !freeCam) return;
    yaw -= (e.clientX - px) * 0.005; pitch = Math.max(-0.3, Math.min(1.2, pitch + (e.clientY - py) * 0.005)); px = e.clientX; py = e.clientY;
  });
  canvas.addEventListener('pointerup', function () { dragging = false; });
  canvas.addEventListener('wheel', function (e) { if (!freeCam) return; dist = Math.max(2, Math.min(30, dist + e.deltaY * 0.01)); e.preventDefault(); }, { passive: false });

  var grain = $('grain'), gctx = grain.getContext('2d'), gimg = gctx.createImageData(128, 128), gAcc = 0;
  function drawGrain() {
    for (var i = 0; i < gimg.data.length; i += 4) { var v = Math.random() * 255; gimg.data[i] = gimg.data[i + 1] = gimg.data[i + 2] = v; gimg.data[i + 3] = 255; }
    gctx.putImageData(gimg, 0, 0);
  }
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr); canvas.height = Math.floor(canvas.clientHeight * dpr);
  }
  window.addEventListener('resize', resize); resize();

  var last = performance.now(), lastTitle = '';
  function frame(now) {
    var dt = Math.min((now - last) / 1000, 0.1); last = now;
    if (playing) { t += dt; if (t >= DUR) { t = DUR; setPlaying(false); } }
    var r = anim.update(t, playing, freeCam);
    var eye, look, fov;
    if (freeCam || !r.cam) {
      var cp = Math.cos(pitch);
      eye = [target[0] + dist * cp * Math.sin(yaw), target[1] + dist * Math.sin(pitch), target[2] + dist * cp * Math.cos(yaw)]; look = target; fov = 45;
      $('shot').textContent = 'Kamera bebas';
    } else { eye = r.cam.eye; look = r.cam.look; fov = r.cam.fov; $('shot').textContent = r.cam.shot.name; }
    if (camOverride) { eye = camOverride.eye; look = camOverride.look; fov = camOverride.fov || 40; }
    var view = LIBS.lookAt(eye, look, [0, 1, 0]);
    var proj = LIBS.perspective(fov * Math.PI / 180, canvas.width / canvas.height, 0.1, 80);
    anim.render(view, proj, eye, exposure, t);

    var o = r.overlay;
    $('fade').style.opacity = o.fade;
    var tt = $('titleCard');
    if (o.title) { tt.style.opacity = o.title.alpha; if (lastTitle !== o.title.text) { $('tKick').textContent = o.title.kicker; $('tText').textContent = o.title.text; lastTitle = o.title.text; } }
    else { tt.style.opacity = 0; lastTitle = ''; }
    $('caption').textContent = o.caption; $('caption').style.opacity = o.caption ? 1 : 0;
    if (document.activeElement !== slider) slider.value = Math.round(t / DUR * 1000);
    $('time').textContent = fmt(t) + ' / ' + fmt(DUR);
    gAcc += dt; if (gAcc > 0.08) { gAcc = 0; drawGrain(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  $('loading').style.display = 'none';
}
