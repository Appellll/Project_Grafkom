/* =========================================================
 *  Sfx.js - efek suara sintetis (WebAudio, tanpa file audio)
 *  Dipanggil dari Anim.js. Baru aktif setelah ada klik pengguna.
 * ========================================================= */
window.createSfx = function () {
  var ctx = null, master = null, noiseBuf = null, muted = false;
  var radioOn = false, radioGain = null, nextNote = 0, noteIdx = 0;
  var heartNext = 0, droneGain = null;

  function init() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // drone gelap: dua sawtooth sedikit berbeda frekuensi + gemuruh noise
    droneGain = ctx.createGain(); droneGain.gain.value = 0.0;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 3;
    [45, 45.7, 67.5].forEach(function (f, i) {
      var o = ctx.createOscillator(); o.type = i === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      var g = ctx.createGain(); g.gain.value = i === 2 ? 0.25 : 0.5;
      o.connect(g); g.connect(lp); o.start();
    });
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    var lfoG = ctx.createGain(); lfoG.gain.value = 60; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    lp.connect(droneGain); droneGain.connect(master);
    var rumble = ctx.createBufferSource(); rumble.buffer = noiseBuf; rumble.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 80; bp.Q.value = 0.8;
    var rg = ctx.createGain(); rg.gain.value = 0.5;
    rumble.connect(bp); bp.connect(rg); rg.connect(droneGain); rumble.start();

    radioGain = ctx.createGain(); radioGain.gain.value = 0;
    radioGain.connect(master);
    // desis radio (noise bandpass)
    var rs = ctx.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true;
    var rb = ctx.createBiquadFilter(); rb.type = 'bandpass'; rb.frequency.value = 2200; rb.Q.value = 0.7;
    var rsg = ctx.createGain(); rsg.gain.value = 0.05;
    rs.connect(rb); rb.connect(rsg); rsg.connect(radioGain); rs.start();
    return true;
  }

  function noise(dur, type, freq, q, gain, delay) {
    if (!ctx) return;
    var s = ctx.createBufferSource(); s.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    var g = ctx.createGain(), t0 = ctx.currentTime + (delay || 0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0, Math.random() * 1.5, dur + 0.05);
  }
  function tone(type, f0, f1, dur, gain, delay, dest) {
    if (!ctx) return;
    var o = ctx.createOscillator(); o.type = type;
    var g = ctx.createGain(), t0 = ctx.currentTime + (delay || 0);
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  var api = {
    unlock: function () { if (!init()) return; if (ctx.state === 'suspended') ctx.resume(); droneGain.gain.value = 0.16; },
    suspend: function () { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume: function () { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    setMuted: function (m) { muted = m; if (master) master.gain.value = m ? 0 : 0.85; },
    isMuted: function () { return muted; },
    reset: function () { radioOn = false; if (radioGain) radioGain.gain.value = 0; heartNext = 0; },
    droneLevel: function (v) { if (droneGain) droneGain.gain.value = v; },

    step: function (kind, vol) {
      if (!ctx || vol < 0.02) return;
      if (kind === 'heavy') {                       // langkah The Janitor
        noise(0.22, 'lowpass', 180, 1, 0.9 * vol);
        tone('sine', 95, 38, 0.24, 0.9 * vol);
        noise(0.05, 'bandpass', 1200, 2, 0.08 * vol);
      } else {                                      // kaki telanjang anak-anak
        noise(0.07, 'bandpass', 700 + Math.random() * 300, 1.5, 0.10 * vol);
      }
    },
    click: function (v) { noise(0.04, 'highpass', 3000, 1, 0.25 * (v || 1)); tone('square', 1800, 900, 0.04, 0.05); },
    zap: function () { noise(0.5, 'bandpass', 3500, 6, 0.12); tone('sawtooth', 120, 100, 0.5, 0.05); },
    radio: function (on) {
      if (!ctx) return;
      if (on && !radioOn) { api.click(1); radioGain.gain.setTargetAtTime(0.9, ctx.currentTime, 0.05); nextNote = ctx.currentTime + 0.2; }
      if (!on && radioOn) { radioGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05); }
      radioOn = on;
    },
    crash: function () {
      noise(0.7, 'highpass', 1500, 0.8, 0.9);
      tone('sine', 1500, 700, 0.5, 0.25);
      noise(0.3, 'bandpass', 5200, 4, 0.35, 0.14);
      noise(0.25, 'bandpass', 4600, 4, 0.30, 0.3);
      noise(0.18, 'bandpass', 4200, 4, 0.22, 0.5);
    },
    unlock_door: function () { noise(0.12, 'lowpass', 900, 3, 0.8); tone('square', 220, 80, 0.2, 0.18); noise(0.05, 'highpass', 4000, 1, 0.3, 0.12); },
    creak: function (dur) {
      if (!ctx) return;
      var o = ctx.createOscillator(); o.type = 'sawtooth';
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 600; f.Q.value = 8;
      var g = ctx.createGain(), t0 = ctx.currentTime;
      o.frequency.setValueAtTime(140, t0); o.frequency.linearRampToValueAtTime(90, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.18, t0 + 0.3); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      var vib = ctx.createOscillator(); vib.frequency.value = 9; var vg = ctx.createGain(); vg.gain.value = 18; vib.connect(vg); vg.connect(o.frequency);
      o.connect(f); f.connect(g); g.connect(master); o.start(t0); vib.start(t0); o.stop(t0 + dur); vib.stop(t0 + dur);
    },
    rattle: function () { noise(0.35, 'bandpass', 1500, 5, 0.22); tone('square', 90, 70, 0.3, 0.06); },
    thud: function () { tone('sine', 70, 28, 0.5, 1.0); noise(0.3, 'lowpass', 120, 1, 0.8); },
    silence: function () {
      if (!ctx) return;
      var t = ctx.currentTime;
      droneGain.gain.cancelScheduledValues(t); droneGain.gain.setTargetAtTime(0, t, 0.03);
      radioGain.gain.cancelScheduledValues(t); radioGain.gain.setTargetAtTime(0, t, 0.03);
    },
    // dipanggil tiap frame saat bermain: not radio & detak jantung
    tick: function (t) {
      if (!ctx || ctx.state !== 'running') return;
      var now = ctx.currentTime;
      if (radioOn) {
        // lagu kotak musik sumbang (tangga nada minor, sedikit detune)
        var tune = [0, 3, 7, 3, 5, 3, 0, -2];
        while (nextNote < now + 0.25) {
          var semis = tune[noteIdx % tune.length]; noteIdx++;
          var f = 330 * Math.pow(2, semis / 12) * (1 + (Math.random() - 0.5) * 0.012);
          tone('triangle', f, f * 0.995, 0.5, 0.20, nextNote - now, radioGain);
          nextNote += 0.46;
        }
      }
      if (t > 60 && t < 99.3) {                       // detak jantung makin cepat saat pengejaran
        var interval = 0.95 - 0.5 * Math.min(1, (t - 60) / 38);
        if (heartNext < now) heartNext = now + 0.05;
        while (heartNext < now + 0.12) {
          tone('sine', 62, 38, 0.16, 0.55, heartNext - now);
          tone('sine', 55, 34, 0.14, 0.35, heartNext - now + 0.17);
          heartNext += interval;
        }
      } else { heartNext = 0; }
    }
  };
  return api;
};
