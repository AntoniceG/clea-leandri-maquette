/* SOMMAIRE — chercher « ## » : SETUP · FORMAT-TEXTURE · SHADERS · CIBLES · TEXTURE-TOILE · PALETTE-PINCEAU · ENTREES · INTRO · BOUCLE · INTERFACE */
/* Toile interactive du hero — peinture WebGL (sans dépendance).
   Le pinceau dépose un pigment avec une épaisseur ; l'épaisseur produit un relief éclairé
   (lumière rasante) et, si la matière s'accumule, elle coule. */
(function () {
  'use strict';

  /* ## SETUP — éléments, contexte WebGL */
  var hero = document.getElementById('accueil');
  var canvas = document.getElementById('paint');
  if (!hero || !canvas) return;

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  function fail() { hero.classList.add('no-gl'); }

  if (/[?&]nogl/.test(location.search)) { fail(); return; }
  var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: false }) ||
           canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) { fail(); return; }
  var isGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

  /* ## FORMAT-TEXTURE — demi-flottant si possible */
  var texInternal = gl.RGBA, texType = gl.UNSIGNED_BYTE, linearOK = true;
  (function pickFormat() {
    var cands = [];
    if (isGL2) {
      if (gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')) {
        cands.push({ i: gl.RGBA16F, t: gl.HALF_FLOAT });
      }
    } else {
      var h = gl.getExtension('OES_texture_half_float');
      if (h && gl.getExtension('EXT_color_buffer_half_float')) {
        cands.push({ i: gl.RGBA, t: h.HALF_FLOAT_OES });
      }
    }
    cands.push({ i: gl.RGBA, t: gl.UNSIGNED_BYTE });
    for (var k = 0; k < cands.length; k++) {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, cands[k].i, 4, 4, 0, gl.RGBA, cands[k].t, null);
      var f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(f); gl.deleteTexture(t);
      if (ok) { texInternal = cands[k].i; texType = cands[k].t; break; }
    }
    if (texType !== gl.UNSIGNED_BYTE) {
      linearOK = isGL2 ? true : !!gl.getExtension('OES_texture_half_float_linear');
    }
  })();
  var filter = linearOK ? gl.LINEAR : gl.NEAREST;
  var hiPrec = texType !== gl.UNSIGNED_BYTE;

  /* ## SHADERS — dépôt, écoulement, affichage (relief) */
  var PRE = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  var NOISE = [
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
    'return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}'
  ].join('\n');

  var VS = 'attribute vec2 a_pos;varying vec2 v_uv;void main(){v_uv=a_pos*0.5+0.5;gl_Position=vec4(a_pos,0.,1.);}';

  var FS_SPLAT = PRE + [
    'varying vec2 v_uv;',
    'uniform sampler2D u_tex;uniform sampler2D u_art;',
    'uniform vec2 u_a;uniform vec2 u_b;uniform vec2 u_artScale;',
    'uniform vec2 u_clip;uniform float u_aspect;uniform float u_r;uniform float u_dep;uniform float u_seed;uniform float u_artMix;',
    'uniform vec3 u_color;',
    NOISE,
    'void main(){',
    ' vec4 old=texture2D(u_tex,v_uv);',
    ' if(v_uv.y<u_clip.x||v_uv.y>u_clip.y){gl_FragColor=old;return;}',
    ' vec2 p=vec2(v_uv.x*u_aspect,v_uv.y);',
    ' vec2 ba=u_b-u_a;float bl=length(ba);',
    ' vec2 dir=bl>1e-5?ba/bl:vec2(1.,0.);',
    ' vec2 pa=p-u_a;',
    ' float h=bl>1e-5?clamp(dot(pa,ba)/(bl*bl),0.,1.):0.;',
    ' float d=length(pa-ba*h);',
    ' float side=dot(pa,vec2(-dir.y,dir.x));float along=dot(pa,dir);',
    ' float fall=1.0-smoothstep(u_r*0.72,u_r,d);',
    ' float bris=0.25+0.95*vnoise(vec2(side/u_r*9.0+u_seed*0.0,along/u_r*0.22));',
    ' float rag=vnoise(vec2(along/u_r*2.5,side/u_r*2.0)+u_seed*3.0);',
    ' float m=fall*bris*smoothstep(0.05,0.55,fall*1.4+rag*0.5-0.35);',
    ' float dep=m*u_dep*(1.0-smoothstep(0.2,1.45,old.a));',
    ' if(dep<0.0006){gl_FragColor=old;return;}',
    ' vec3 col=u_color;',
    ' if(u_artMix>0.5){col=texture2D(u_art,(v_uv-0.5)*u_artScale+0.5).rgb;}',
    ' col*=0.93+0.14*vnoise(vec2(side/u_r*12.0,along/u_r*0.6+u_seed*2.0));',
    ' float wOld=old.a*0.45;',
    ' vec3 rgb=(old.rgb*wOld+col*dep)/(wOld+dep);',
    ' gl_FragColor=vec4(rgb,min(old.a+dep,1.5));',
    '}'
  ].join('\n');

  var FS_FLOW = PRE + [
    'varying vec2 v_uv;uniform sampler2D u_tex;uniform vec2 u_texel;uniform vec2 u_res;',
    NOISE,
    'void main(){',
    ' vec4 c=texture2D(u_tex,v_uv);',
    ' vec4 up=texture2D(u_tex,v_uv+vec2(0.,u_texel.y));',
    ' vec4 l=texture2D(u_tex,v_uv-vec2(u_texel.x,0.));vec4 r=texture2D(u_tex,v_uv+vec2(u_texel.x,0.));',
    ' vec4 dn=texture2D(u_tex,v_uv-vec2(0.,u_texel.y));',
       ' float gate=smoothstep(0.50,0.82,vnoise(vec2(v_uv.x*u_res.x*0.30,7.3)));',
    ' float thr=1.0;',
    ' float inF=max(up.a-thr,0.)*0.45*gate;',
    ' float gateD=smoothstep(0.50,0.82,vnoise(vec2(v_uv.x*u_res.x*0.30,7.3)));',
    ' float outF=max(c.a-thr,0.)*0.45*gateD;',
    ' float a=c.a+inF-outF;',
    ' vec3 rgb=mix(c.rgb,up.rgb,inF/(c.a+inF+1e-4));',
    ' float bl=(l.a+r.a+up.a+dn.a)*0.25;',
    ' a=mix(a,bl,0.015);',
    ' gl_FragColor=vec4(rgb,max(a,0.));',
    '}'
  ].join('\n');

  var FS_DISPLAY = PRE + [
    'varying vec2 v_uv;uniform sampler2D u_tex;uniform vec2 u_texel;uniform float u_dpr;uniform float u_relief;',
    NOISE,
    'void main(){',
    ' vec4 c=texture2D(u_tex,v_uv);',
    ' vec2 px=gl_FragCoord.xy/u_dpr;',
    ' float hL=texture2D(u_tex,v_uv-vec2(u_texel.x,0.)).a;float hR=texture2D(u_tex,v_uv+vec2(u_texel.x,0.)).a;',
    ' float hU=texture2D(u_tex,v_uv+vec2(0.,u_texel.y)).a;float hD=texture2D(u_tex,v_uv-vec2(0.,u_texel.y)).a;',
    ' vec3 n=normalize(vec3((hL-hR)*u_relief,(hD-hU)*u_relief,1.0));',
    ' vec3 L=normalize(vec3(-0.55,0.62,0.56));',
    ' float grain=vnoise(px*0.55)*0.6+vnoise(px*1.7)*0.4;',
    ' float weave=0.5+0.5*sin(px.x*1.35)*sin(px.y*1.35);',
    ' vec3 paper=vec3(0.965,0.945,0.905);',
    ' paper*=1.0-0.045*grain-0.03*weave;',
    ' float cov=1.0-exp(-c.a*4.0);',
    ' vec3 glaze=paper*mix(vec3(1.),c.rgb,min(1.,cov*1.25));',
    ' vec3 col=mix(glaze,c.rgb*(0.97-0.03*grain),smoothstep(0.30,0.95,c.a));',
    ' float diff=dot(n,L);',
    ' col*=0.80+0.34*clamp(diff,0.,1.2);',
    ' vec3 Hh=normalize(L+vec3(0.,0.,1.));',
    ' float spec=pow(max(dot(n,Hh),0.),34.0)*smoothstep(0.3,1.1,c.a);',
    ' col+=spec*0.2;',
    ' float sh=texture2D(u_tex,v_uv+vec2(0.0035,-0.0045)).a;',
    ' col*=1.0-0.16*smoothstep(0.1,1.0,sh)*(1.0-smoothstep(0.2,0.8,c.a));',
    ' gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function program(fs) {
    var v = compile(gl.VERTEX_SHADER, VS), f = compile(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'a_pos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); return null; }
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var nm = gl.getActiveUniform(p, i).name; u[nm] = gl.getUniformLocation(p, nm); }
    return { p: p, u: u };
  }
  var pSplat = program(FS_SPLAT), pFlow = program(FS_FLOW), pDisp = program(FS_DISPLAY);
  if (!pSplat || !pFlow || !pDisp) { fail(); return; }

  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  /* ## CIBLES — textures ping-pong, taille */
  var simW = 0, simH = 0, simAspect = 1, A = null, B = null;
  function makeTarget(w, h) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, texInternal, w, h, 0, gl.RGBA, texType, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(1, 1, 1, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    return { tex: t, fbo: f };
  }
  function freeTarget(t) { if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); } }

  var quality = coarse ? 0.6 : 0.9;       // part de la résolution d'affichage
  var maxSim = coarse ? 900 : 1500;
  var dpr = 1, cw = 0, ch = 0;

  function sizeCanvas() {
    var r = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.6 : 2);
    var w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; }
    cw = w; ch = h;
  }
  function buildSim() {
    sizeCanvas();
    var w = cw * quality, h = ch * quality, m = Math.max(w, h);
    if (m > maxSim) { w *= maxSim / m; h *= maxSim / m; }
    simW = Math.max(64, Math.round(w)); simH = Math.max(64, Math.round(h));
    simAspect = simW / simH;
    freeTarget(A); freeTarget(B);
    A = makeTarget(simW, simH); B = makeTarget(simW, simH);
    updateArtScale();
  }

  /* ## TEXTURE-TOILE — mode révélation */
  var artTex = gl.createTexture(), artLoaded = false, artAspect = 1, artScale = [1, 1];
  gl.bindTexture(gl.TEXTURE_2D, artTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  var artImg = new Image();
  artImg.onload = function () {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, artTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, artImg);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    artAspect = artImg.naturalWidth / artImg.naturalHeight; artLoaded = true; updateArtScale();
    hero.classList.add('art-ready');
  };
  artImg.src = canvas.getAttribute('data-art') || '';
  function updateArtScale() {
    var ca = simAspect || 1;
    artScale = ca > artAspect ? [1, artAspect / ca] : [ca / artAspect, 1];
  }

  /* ## PALETTE-PINCEAU — couleurs, tailles, dessin */
  var PALETTE = [[0.12, 0.27, 0.78], [0.10, 0.69, 0.77], [0.95, 0.72, 0.03], [0.90, 0.26, 0.18], [0.88, 0.31, 0.54], [0.33, 0.66, 0.29]];
  var FIXED = {
    cobalt: [0.11, 0.27, 0.80], turquoise: [0.09, 0.68, 0.77], jaune: [0.96, 0.72, 0.04],
    vermillon: [0.90, 0.25, 0.17], rose: [0.88, 0.31, 0.54], encre: [0.10, 0.10, 0.17], vert: [0.30, 0.65, 0.29]
  };
  var mode = 'auto';             // auto | toile | <clé de FIXED>
  var clipBand = [0, 1];
  var sizesPx = coarse ? { s: 13, m: 22, l: 38 } : { s: 20, m: 34, l: 59 };   // rayon en px CSS
  var size = 'm';

  function driftColor(t) {
    var n = PALETTE.length, x = ((t * 0.10) % n + n) % n, i = Math.floor(x), f = x - i;
    f = f * f * (3 - 2 * f);
    var a = PALETTE[i], b = PALETTE[(i + 1) % n];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  var segs = [];                 // segments en attente {a:[x,y], b:[x,y], dep}
  function queueSeg(x0, y0, x1, y1, dep) { // coordonnées normalisées (0..1, origine haut-gauche)
    if (segs.length > 160) segs.shift();
    segs.push({ a: [x0, 1 - y0], b: [x1, 1 - y1], dep: dep });
  }

  var seed = 1, clock = 0;
  function bind(tex, unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
  function swap() { var t = A; A = B; B = t; }

  function drawSplat(s) {
    var col = mode === 'auto' ? driftColor(clock) : (FIXED[mode] || driftColor(clock));
    gl.useProgram(pSplat.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.fbo);
    gl.viewport(0, 0, simW, simH);
    bind(A.tex, 0); bind(artTex, 1);
    var u = pSplat.u;
    gl.uniform1i(u.u_tex, 0); gl.uniform1i(u.u_art, 1);
    gl.uniform2f(u.u_a, s.a[0] * simAspect, s.a[1]);
    gl.uniform2f(u.u_b, s.b[0] * simAspect, s.b[1]);
    gl.uniform2f(u.u_artScale, artScale[0], artScale[1]);
    gl.uniform1f(u.u_aspect, simAspect);
    gl.uniform2f(u.u_clip, clipBand[0], clipBand[1]);
    gl.uniform1f(u.u_r, sizesPx[size] / (ch / dpr));
    gl.uniform1f(u.u_dep, s.dep);
    gl.uniform1f(u.u_seed, (seed += 0.37));
    gl.uniform1f(u.u_artMix, (mode === 'toile' && artLoaded) ? 1 : 0);
    gl.uniform3f(u.u_color, col[0], col[1], col[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    swap();
  }
  function drawFlow() {
    gl.useProgram(pFlow.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.fbo);
    gl.viewport(0, 0, simW, simH);
    bind(A.tex, 0);
    gl.uniform1i(pFlow.u.u_tex, 0);
    gl.uniform2f(pFlow.u.u_texel, 1 / simW, 1 / simH);
    gl.uniform2f(pFlow.u.u_res, simW, simH);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    swap();
  }
  var saveRequested = false;
  function drawDisplay() {
    gl.useProgram(pDisp.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, cw, ch);
    bind(A.tex, 0);
    gl.uniform1i(pDisp.u.u_tex, 0);
    gl.uniform2f(pDisp.u.u_texel, 1 / simW, 1 / simH);
    gl.uniform1f(pDisp.u.u_dpr, dpr);
    gl.uniform1f(pDisp.u.u_relief, hiPrec ? 5.5 : 3.2);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ## ENTREES — souris et doigt */
  var active = false, painting = false, userTouched = false, paintOn = !coarse;
  var last = null, lastT = 0;
  var holdPoint = null;

  function toNorm(e) {
    var r = hero.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }
  function onUI(target) { return target.closest && target.closest('.paint-ui, .site-header, a, button, .scroll-cue'); }

  function markTouched() {
    if (!userTouched) { userTouched = true; autoStop(); hero.classList.add('touched'); }
  }

  hero.addEventListener('pointerdown', function (e) {
    if (onUI(e.target) || !paintOn) return;
    if (isNarrow() && !(e.target.closest && e.target.closest('.zone-hint'))) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    markTouched();
    painting = true; active = true;
    var p = toNorm(e); last = p; holdPoint = p;
    queueSeg(p[0], p[1], p[0], p[1], 0.5);
    try { hero.setPointerCapture(e.pointerId); } catch (_) {}
  });
  hero.addEventListener('pointermove', function (e) {
    if (!paintOn || onUI(e.target) && !painting) { return; }
    if (e.pointerType !== 'mouse' && !painting) return;
    var p = toNorm(e);
    if (p[0] < 0 || p[0] > 1 || p[1] < 0 || p[1] > 1) return;
    if (!last) { last = p; }
    markTouched();
    var dx = p[0] - last[0], dy = p[1] - last[1];
    var dist = Math.sqrt(dx * dx * simAspect * simAspect + dy * dy);
    if (dist < 0.0015) return;
    queueSeg(last[0], last[1], p[0], p[1], painting ? 0.16 : 0.075);
    last = p; holdPoint = painting ? p : null; active = true; lastT = performance.now();
  });
  function end(e) {
    painting = false; holdPoint = null;
    if (e && e.pointerType !== 'mouse') last = null;
  }
  hero.addEventListener('pointerup', end);
  hero.addEventListener('pointercancel', end);
  hero.addEventListener('pointerleave', function () { last = null; holdPoint = null; painting = false; });

  /* ## INTRO — traits automatiques */
  var autoOn = false, autoT0 = 0;
  var STROKES = [
    { t0: 0.0, d: 1.9, pts: [[0.62, 0.78], [0.68, 0.52], [0.80, 0.34], [0.92, 0.30]] },
    { t0: 0.9, d: 2.0, pts: [[0.55, 0.30], [0.66, 0.40], [0.74, 0.62], [0.86, 0.72]] },
    { t0: 1.9, d: 1.8, pts: [[0.60, 0.62], [0.72, 0.70], [0.83, 0.56], [0.95, 0.60]] },
    { t0: 2.6, d: 1.5, pts: [[0.70, 0.22], [0.76, 0.32], [0.82, 0.44], [0.88, 0.50]] }
  ];
  function bez(p, t) {
    var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]];
  }
  function isNarrow() { return window.innerWidth < 760; }
  function autoStart() {
    if (reduceMotion) return;
    autoOn = true; autoT0 = performance.now(); autoK = [];
  }
  function autoStop() { autoOn = false; }
  var autoK = [], zone = [0.5, 0.8];
  function measureZone() {   // mobile : on ne peint que dans la zone dédiée, entre les boutons du texte et la barre d'outils
    var zh = hero.querySelector('.zone-hint'), ui2 = hero.querySelector('.paint-ui'), r = hero.getBoundingClientRect();
    if (!isNarrow() || !zh || !ui2 || !r.height) { clipBand = [0, 1]; return; }
    var top = (zh.getBoundingClientRect().top - r.top) / r.height;
    var bot = (ui2.getBoundingClientRect().top - r.top) / r.height - 0.005;
    clipBand = [1 - bot, 1 - top];
    zone = [top + 0.03, Math.max(top + 0.1, bot - 0.03)];
  }
  function autoPoint(s, k) {
    var e = k * k * (3 - 2 * k), p = bez(s.pts, e);
    if (isNarrow()) p = [0.12 + (p[0] - 0.5) / 0.5 * 0.76, zone[0] + (p[1] - 0.2) / 0.6 * (zone[1] - zone[0])];
    return p;
  }
  function autoStep() {
    var t = (performance.now() - autoT0) / 1000, any = false;
    for (var i = 0; i < STROKES.length; i++) {
      var s = STROKES[i], k = Math.min(1, (t - s.t0) / s.d);
      if (t - s.t0 < 0) { any = true; continue; }
      var k0 = autoK[i] === undefined ? 0 : autoK[i];
      if (k0 >= 1) continue;
      any = true;
      var n = Math.max(1, Math.ceil((k - k0) / 0.01));
      var prevP = autoPoint(s, k0);
      for (var j = 1; j <= n; j++) {
        var p = autoPoint(s, k0 + (k - k0) * j / n);
        queueSeg(prevP[0], prevP[1], p[0], p[1], 0.14);
        prevP = p;
      }
      autoK[i] = k;
    }
    if (!any) autoOn = false;
  }

  /* ## BOUCLE — rendu, qualité adaptative */
  var visible = true, raf = 0, prev = 0, frames = 0, slow = 0, running = false;
  function frame(ts) {
    raf = requestAnimationFrame(frame);
    var dt = prev ? ts - prev : 16; prev = ts;
    clock += dt / 1000;
    if ((frames % 15) === 0) measureZone();
    if (autoOn) autoStep();
    if (holdPoint) queueSeg(holdPoint[0], holdPoint[1], holdPoint[0], holdPoint[1], 0.06);
    // fusionne les segments en attente : un seul dépôt par segment
    if (segs.length > 20) {
      var g = Math.ceil(segs.length / 20), merged = [];
      for (var m = 0; m < segs.length; m += g) {
        var grp = segs.slice(m, m + g), d = 0;
        grp.forEach(function (q) { d += q.dep; });
        merged.push({ a: grp[0].a, b: grp[grp.length - 1].b, dep: d / grp.length });
      }
      segs = merged;
    }
    for (var i = 0; i < segs.length; i++) drawSplat(segs[i]);
    segs.length = 0;
    drawFlow(); drawFlow();
    drawDisplay();
    if (saveRequested) { saveRequested = false; doSave(); }
    // qualité adaptative (durant les premières secondes)
    frames++;
    if (frames > 20 && frames < 140) {
      if (dt > 30) slow++;
      if (frames === 139 && slow > 55 && quality > 0.4 && !userTouched) { quality *= 0.7; buildSim(); if (!userTouched) autoStart(); }
    }
  }
  function start() { if (!running && visible && !document.hidden) { running = true; prev = 0; raf = requestAnimationFrame(frame); } }
  function stop() { running = false; cancelAnimationFrame(raf); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting; visible ? start() : stop();
    }, { threshold: 0.02 }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var r = hero.getBoundingClientRect();
      var na = r.width / r.height;
      if (Math.abs(na / simAspect - 1) > 0.22 || Math.abs(r.width * dpr / cw - 1) > 0.4) {
        buildSim(); if (!userTouched) autoStart();
      } else { sizeCanvas(); }
    }, 220);
  });

  /* ## INTERFACE — boutons, export, démarrage */
  var ui = hero.querySelector('.paint-ui');
  if (ui) {
    ui.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.color) {
        mode = b.dataset.color;
        ui.querySelectorAll('[data-color]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        markTouched();
      } else if (b.dataset.size) {
        size = b.dataset.size;
        ui.querySelectorAll('[data-size]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      } else if (b.dataset.action === 'clear') {
        freeTarget(A); freeTarget(B); A = makeTarget(simW, simH); B = makeTarget(simW, simH);
      } else if (b.dataset.action === 'save') {
        saveRequested = true;
      } else if (b.dataset.action === 'toggle') {
        paintOn = !paintOn;
        hero.classList.toggle('paint-on', paintOn);
        b.setAttribute('aria-pressed', paintOn ? 'true' : 'false');
        b.querySelector('span').textContent = paintOn ? 'Défiler' : 'Peindre';
      }
    });
  }
  function doSave() {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'ma-toile-clea-leandri.png';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }, 'image/png');
  }

  hero.classList.toggle('paint-on', paintOn);
  (function () { var tg = hero.querySelector('[data-action="toggle"]'); if (tg) { tg.setAttribute('aria-pressed', paintOn ? 'true' : 'false'); tg.querySelector('span').textContent = paintOn ? 'Défiler' : 'Peindre'; } })();
  buildSim();
  measureZone();
  hero.classList.add('gl-ready');
  start();
  setTimeout(function () { if (!userTouched) autoStart(); }, 700);
})();
