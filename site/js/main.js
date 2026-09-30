/* SOMMAIRE — chercher « ## » : (SETUP) · HEADER · REVEAL · TILT · OEUVRES · VISIONNEUSE · EXPOSITIONS · CONTACT-PRIX */
(function () {
  'use strict';
  /* ## SETUP — données et raccourcis */
  var W = window.WORKS || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var canHover = window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  var CATS = Object.keys(W).filter(function (k) { return k.charAt(0) !== '_'; });

  /* ## HEADER — menu, lien actif */
  var header = $('.site-header');
  function onScroll() { header.classList.toggle('solid', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  var burger = $('.burger'), nav = $('#nav');
  function closeMenu() { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }
  burger.addEventListener('click', function () {
    var open = !nav.classList.contains('open');
    nav.classList.toggle('open', open); burger.setAttribute('aria-expanded', open); document.body.style.overflow = open ? 'hidden' : '';
    if (open) header.classList.add('solid');
  });
  $$('#nav a').forEach(function (a) { a.addEventListener('click', closeMenu); });

  // menu déroulant Œuvres
  var sub = $('[data-sub="works"]');
  CATS.concat(['tapis']).forEach(function (k) {
    var li = document.createElement('li'), a = document.createElement('a');
    a.href = '#oeuvres'; a.dataset.cat = k; a.textContent = k === 'tapis' ? 'Les tapis' : W[k].label;
    li.appendChild(a); sub.appendChild(li);
  });

  // lien actif
  var links = {};
  $$('.nav-link').forEach(function (a) { links[a.getAttribute('href')] = a; });
  var secs = ['accueil', 'oeuvres', 'expositions', 'atelier', 'contact'].map(function (id) { return document.getElementById(id); });
  if ('IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (e.isIntersecting) { Object.keys(links).forEach(function (h) { links[h].classList.toggle('active', h === '#' + e.target.id); }); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (s) { s && so.observe(s); });
  }

  /* ## REVEAL — apparition au défilement */
  var rv = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    rv.forEach(function (el) { ro.observe(el); });
  } else { rv.forEach(function (el) { el.classList.add('in'); }); }

  /* ## TILT — inclinaison 3D au survol */
  function tilt(el, max) {
    if (!canHover) return;
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', ((x - .5) * max * 2).toFixed(2) + 'deg');
      el.style.setProperty('--rx', ((.5 - y) * max * 2).toFixed(2) + 'deg');
      el.style.setProperty('--gx', (x * 100) + '%'); el.style.setProperty('--gy', (y * 100) + '%');
    });
    el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  }
  $$('.tilt').forEach(function (el) {
    el.style.transition = 'transform .5s cubic-bezier(.2,.7,.2,1)';
    el.addEventListener('pointermove', function () { el.style.transform = 'perspective(1000px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg))'; });
    el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    tilt(el, 4);
  });

  /* ## OEUVRES — filtres, galerie */
  var gallery = $('#gallery'), filters = $('.filters'), moreBtn = $('#more'), tapis = $('#tapis');
  var PAGE = 18, shown = 0, current = 'all', list = [];

  function all() { // toutes catégories mêlées pour que le début de la galerie soit varié
    var out = [], max = 0;
    CATS.forEach(function (k) { max = Math.max(max, W[k].items.length); });
    for (var i = 0; i < max; i++) CATS.forEach(function (k) { var it = W[k].items[i]; if (it) out.push({ id: it.id, w: it.w, cat: k, label: W[k].label }); });
    return out;
  }
  function byCat(k) { return W[k].items.map(function (it) { return { id: it.id, w: it.w, cat: k, label: W[k].label }; }); }

  function chip(key, label) {
    var b = document.createElement('button');
    b.className = 'chip'; b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.cat = key; b.textContent = label;
    b.setAttribute('aria-selected', key === 'all' ? 'true' : 'false');
    filters.appendChild(b);
  }
  chip('all', 'Toutes');
  CATS.forEach(function (k) { chip(k, W[k].label); });
  chip('tapis', 'Les tapis');

  function card(it, i) {
    var b = document.createElement('button');
    b.className = 'work'; b.type = 'button'; b.style.setProperty('--ar', it.w);
    b.style.animationDelay = ((i % PAGE) * 45) + 'ms';
    b.setAttribute('aria-label', 'Agrandir une œuvre — ' + it.label);
    var img = new Image();
    img.src = 'assets/img/t/' + it.id + '.webp'; img.alt = 'Œuvre de Cléa-Chantal Léandri — ' + it.label;
    img.loading = 'lazy'; img.decoding = 'async'; img.width = 720; img.height = Math.round(720 / it.w);
    img.onload = function () { img.classList.add('ok'); };
    if (img.complete) img.classList.add('ok');
    b.appendChild(img);
    var sh = document.createElement('span'); sh.className = 'sheen'; b.appendChild(sh);
    var cp = document.createElement('span'); cp.className = 'cap'; cp.textContent = it.label; b.appendChild(cp);
    b.addEventListener('click', function () { openLB(list, list.indexOf(it)); });
    tilt(b, 3);
    return b;
  }
  function renderMore() {
    var next = list.slice(shown, shown + PAGE), frag = document.createDocumentFragment();
    next.forEach(function (it, i) { frag.appendChild(card(it, shown + i)); });
    gallery.appendChild(frag); shown += next.length;
    moreBtn.hidden = shown >= list.length;
  }
  function setCat(k, scroll) {
    current = k;
    $$('.chip', filters).forEach(function (c) { c.setAttribute('aria-selected', c.dataset.cat === k ? 'true' : 'false'); });
    gallery.innerHTML = ''; shown = 0;
    var isT = k === 'tapis';
    tapis.hidden = !isT; gallery.hidden = isT; moreBtn.hidden = true;
    if (!isT) { list = k === 'all' ? all() : byCat(k); renderMore(); }
    if (scroll) document.getElementById('oeuvres').scrollIntoView({ behavior: 'smooth' });
  }
  filters.addEventListener('click', function (e) { var c = e.target.closest('.chip'); if (c) setCat(c.dataset.cat); });
  moreBtn.addEventListener('click', renderMore);
  $$('[data-cat]').forEach(function (a) {
    if (a.classList.contains('chip')) return;
    a.addEventListener('click', function (e) { e.preventDefault(); setCat(a.dataset.cat, true); });
  });
  setCat('all');

  /* ## VISIONNEUSE */
  var lb = $('#lb'), lbImg = $('#lb-img'), lbCat = $('#lb-cat'), lbCta = $('#lb-cta'), stage = $('.lb-stage');
  var lbList = [], lbIdx = 0, lastFocus = null;
  function openLB(items, idx) {
    lbList = items; lbIdx = Math.max(0, idx); lastFocus = document.activeElement;
    lb.hidden = false; document.body.classList.add('lb-open'); showLB();
    $('.lb-close', lb).focus();
  }
  function showLB() {
    var it = lbList[lbIdx]; if (!it) return;
    stage.classList.remove('zoom');
    lbImg.style.opacity = 0.35;
    var big = new Image(); big.onload = function () { lbImg.src = big.src; lbImg.style.opacity = 1; }; big.src = 'assets/img/w/' + it.id + '.webp';
    lbImg.src = 'assets/img/t/' + it.id + '.webp';
    lbImg.alt = it.cap || ('Œuvre — ' + it.label);
    lbCat.textContent = it.cap || it.label;
    var single = lbList.length < 2;
    $('.lb-prev', lb).hidden = single; $('.lb-next', lb).hidden = single;
    // précharge la voisine
    var nx = lbList[(lbIdx + 1) % lbList.length]; if (nx) { (new Image()).src = 'assets/img/w/' + nx.id + '.webp'; }
  }
  function step(d) { lbIdx = (lbIdx + d + lbList.length) % lbList.length; showLB(); }
  function closeLB() { lb.hidden = true; document.body.classList.remove('lb-open'); if (lastFocus) lastFocus.focus(); }
  $('.lb-close', lb).addEventListener('click', closeLB);
  $('.lb-prev', lb).addEventListener('click', function () { step(-1); });
  $('.lb-next', lb).addEventListener('click', function () { step(1); });
  lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb-fig')) closeLB(); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLB(); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1);
  });
  stage.addEventListener('click', function (e) {
    var r = stage.getBoundingClientRect();
    stage.style.setProperty('--ox', ((e.clientX - r.left) / r.width * 100) + '%');
    stage.style.setProperty('--oy', ((e.clientY - r.top) / r.height * 100) + '%');
    stage.classList.toggle('zoom');
  });
  stage.addEventListener('pointermove', function (e) {
    if (!stage.classList.contains('zoom')) return;
    var r = stage.getBoundingClientRect();
    stage.style.setProperty('--ox', ((e.clientX - r.left) / r.width * 100) + '%');
    stage.style.setProperty('--oy', ((e.clientY - r.top) / r.height * 100) + '%');
  });
  var sx = null;
  lb.addEventListener('touchstart', function (e) { sx = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (sx === null || stage.classList.contains('zoom')) return;
    var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1); sx = null;
  }, { passive: true });
  lbCta.addEventListener('click', function () {
    var it = lbList[lbIdx];
    closeLB(); prefill('Bonjour, je souhaite en savoir plus sur une œuvre : ' + (it.cap || it.label) + ' (réf. ' + it.id + ').');
  });

  /* ## EXPOSITIONS — onglets */
  var expoItems = (W._expo || []).map(function (it, i) {
    return { id: it.id, w: it.w, label: 'Histoires d\'eau', cap: 'Histoires d\'eau — Chapelle des Pénitents Bleus, La Ciotat (' + (i + 1) + '/' + W._expo.length + ')' };
  });
  var eg = $('[data-expo-grid]');
  expoItems.forEach(function (it) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Agrandir une œuvre de l\'exposition');
    var img = new Image(); img.src = 'assets/img/t/' + it.id + '.webp'; img.alt = 'Œuvre de l\'exposition Histoires d\'eau'; img.loading = 'lazy'; img.width = 720; img.height = 720;
    b.appendChild(img); b.addEventListener('click', function () { openLB(expoItems, expoItems.indexOf(it)); }); eg.appendChild(b);
  });
  function selectTab(name) {
    $$('.tabs button').forEach(function (t) { t.setAttribute('aria-selected', t.dataset.tab === name ? 'true' : 'false'); });
    $$('.panel').forEach(function (p) { p.hidden = p.dataset.panel !== name; });
  }
  $$('.tabs button').forEach(function (t) { t.addEventListener('click', function () { selectTab(t.dataset.tab); }); });
  $$('[data-expo]').forEach(function (a) { a.addEventListener('click', function () { selectTab(a.dataset.expo); closeMenu(); }); });

  /* ## CONTACT-PRIX — formulaire (ouvre la messagerie) */
  var form = $('#form'), note = $('#form-note'), fb = $('#form-fallback');
  function prefill(text) {
    var ta = form.elements.message; ta.value = text;
    document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    setTimeout(function () { ta.focus({ preventScroll: true }); }, 700);
  }
  $$('[data-prefill]').forEach(function (a) { a.addEventListener('click', function () { form.elements.message.value = a.dataset.prefill; }); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    ['nom', 'email', 'message'].forEach(function (n) {
      var f = form.elements[n], bad = !f.value.trim() || (n === 'email' && !/^\S+@\S+\.\S+$/.test(f.value));
      f.classList.toggle('err', bad); if (bad) ok = false;
    });
    if (!ok) return;
    var subject = 'Demande de rendez-vous — ' + form.elements.nom.value.trim();
    var body = form.elements.message.value.trim() + '\n\n' + form.elements.nom.value.trim() + '\n' + form.elements.email.value.trim();
    window.location.href = 'mailto:chantalleandri@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    note.hidden = false; fb.hidden = false;
  });

  $('#year').textContent = new Date().getFullYear();
})();
