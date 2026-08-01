// ===== C-PAD Landing interactions =====
(function () {
  'use strict';

  var header = document.getElementById('header');
  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('navToggle');
  var toTop = document.getElementById('toTop');

  // --- Header solid on scroll + back-to-top ---
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    header.classList.toggle('solid', y > 40);
    toTop.classList.toggle('show', y > 500);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- Mobile nav ---
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { nav.classList.remove('open'); });
    });
  }

  // --- Reveal on scroll ---
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el, i) {
      el.style.transitionDelay = (i % 3) * 90 + 'ms';
      io.observe(el);
    });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  // --- Animated counters ---
  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    if (isNaN(target)) return;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var dur = 1600, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = Math.round(target * eased);
      el.textContent = prefix + val + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = prefix + target + suffix;
    }
    requestAnimationFrame(step);
  }
  var counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { animateCount(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) {
      // skip hero "No.1"/"2020"/"100%" text nodes that aren't numeric-only
      if (!isNaN(parseFloat(c.getAttribute('data-count')))) cio.observe(c);
    });
  }

  // --- Video modal ---
  var playBtn = document.getElementById('playVideo');
  var modal = document.getElementById('videoModal');
  var vmFrame = document.getElementById('vmFrame');
  var lastFocus = null;

  function openVideo() {
    if (!modal || !vmFrame) return;
    var id = playBtn.getAttribute('data-video');
    lastFocus = document.activeElement;
    vmFrame.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id +
      '?autoplay=1&rel=0" title="C-PAD 紹介動画" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var closeBtn = modal.querySelector('.vm-close');
    if (closeBtn) closeBtn.focus();
  }
  function closeVideo() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(function () { vmFrame.innerHTML = ''; }, 300); // stop playback
    if (lastFocus) lastFocus.focus();
  }
  if (playBtn) playBtn.addEventListener('click', openVideo);
  if (modal) {
    modal.querySelectorAll('[data-close]').forEach(function (el) {
      el.addEventListener('click', closeVideo);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeVideo();
    });
  }

  // --- Screen gallery lightbox + auto-scroll slideshow ---
  var track = document.getElementById('marqueeTrack');
  var thumbs = Array.prototype.slice.call(document.querySelectorAll('.shot-thumb'));
  // duplicate items once for a seamless looping marquee
  if (track) {
    thumbs.forEach(function (t) {
      var clone = t.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.setAttribute('tabindex', '-1');
      track.appendChild(clone);
    });
  }
  var gModal = document.getElementById('galleryModal');
  var gImg = document.getElementById('gvImg');
  var gTitle = document.getElementById('gvTitle');
  var gDesc = document.getElementById('gvDesc');
  var gDots = document.getElementById('gvDots');
  var gPrev = document.getElementById('gvPrev');
  var gNext = document.getElementById('gvNext');
  var gIndex = 0, gLastFocus = null;

  function renderScreen(i) {
    gIndex = (i + thumbs.length) % thumbs.length;
    var t = thumbs[gIndex];
    gImg.src = t.getAttribute('data-src') || '';
    gImg.alt = (t.getAttribute('data-title') || '') + ' — C-PAD 画面';
    gTitle.textContent = t.getAttribute('data-title') || '';
    gDesc.textContent = t.getAttribute('data-desc') || '';
    Array.prototype.forEach.call(gDots.children, function (d, di) {
      d.classList.toggle('active', di === gIndex);
    });
  }
  function buildDots() {
    if (!gDots || gDots.children.length) return;
    thumbs.forEach(function (t, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', (t.getAttribute('data-title') || '') + 'を表示');
      b.addEventListener('click', function () { renderScreen(i); });
      gDots.appendChild(b);
    });
  }
  function openGallery(i) {
    if (!gModal) return;
    buildDots();
    gLastFocus = document.activeElement;
    renderScreen(i);
    gModal.classList.add('open');
    gModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (gNext) gNext.focus();
  }
  function closeGallery() {
    if (!gModal) return;
    gModal.classList.remove('open');
    gModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (gLastFocus) gLastFocus.focus();
  }
  if (track) {
    track.addEventListener('click', function (e) {
      var b = e.target.closest('.shot-thumb');
      if (b) openGallery(parseInt(b.getAttribute('data-idx'), 10) || 0);
    });
  }
  if (gPrev) gPrev.addEventListener('click', function () { renderScreen(gIndex - 1); });
  if (gNext) gNext.addEventListener('click', function () { renderScreen(gIndex + 1); });
  if (gModal) {
    gModal.querySelectorAll('[data-gclose]').forEach(function (el) {
      el.addEventListener('click', closeGallery);
    });
    document.addEventListener('keydown', function (e) {
      if (!gModal.classList.contains('open')) return;
      if (e.key === 'Escape') closeGallery();
      else if (e.key === 'ArrowLeft') renderScreen(gIndex - 1);
      else if (e.key === 'ArrowRight') renderScreen(gIndex + 1);
    });
  }

  // --- Onboarding stepper: sequential light-up ---
  var stepper = document.getElementById('stepper');
  if (stepper) {
    var steps = Array.prototype.slice.call(stepper.querySelectorAll('.step'));
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      steps.forEach(function (s) { s.classList.add('on'); });
    } else {
      var lit = 0, timer = null;
      function tick() {
        lit++;
        if (lit > steps.length) {
          steps.forEach(function (s) { s.classList.remove('on', 'current'); });
          lit = 0;
          timer = setTimeout(tick, 900); // pause before restart
          return;
        }
        steps.forEach(function (s, i) {
          s.classList.toggle('on', i < lit);
          s.classList.toggle('current', i === lit - 1);
        });
        timer = setTimeout(tick, 780);
      }
      var started = false;
      if ('IntersectionObserver' in window) {
        var sio = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting && !started) { started = true; tick(); }
          });
        }, { threshold: 0.4 });
        sio.observe(stepper);
      } else { tick(); }
    }
  }

  // --- Contact form validation ---
  var form = document.getElementById('contactForm');
  var note = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      var name = form.querySelector('#cf-name');
      var email = form.querySelector('#cf-email');
      [name, email].forEach(function (f) {
        f.classList.remove('invalid');
        if (!f.value.trim()) { f.classList.add('invalid'); ok = false; }
      });
      var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email.value.trim() && !emailRe.test(email.value.trim())) {
        email.classList.add('invalid'); ok = false;
      }
      if (!ok) {
        note.textContent = '必須項目を正しくご入力ください。';
        note.className = 'form-note err';
        var firstBad = form.querySelector('.invalid');
        if (firstBad) firstBad.focus();
        return;
      }
      note.textContent = 'お問い合わせありがとうございます。担当者よりご連絡いたします。';
      note.className = 'form-note ok';
      form.reset();
    });
  }
})();
