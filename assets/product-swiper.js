
(() => {
  const instances = new Map();

  const qs = (r, s) => r.querySelector(s);
  const qsa = (r, s) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const BP = { MOBILE: 'mobile', TABLET: 'tablet', DESKTOP: 'desktop' };
  const getBP = () => {
    const w = window.innerWidth || document.documentElement.clientWidth || 0;
    if (w >= 990) return BP.DESKTOP;
    if (w >= 750) return BP.TABLET;
    return BP.MOBILE;
  };

  
  function getConfig(viewer) {
    const ds = viewer.dataset;
    const toBool = (v) => String(v).toLowerCase() === 'true';

    return {
      pagination: {
        [BP.DESKTOP]: toBool(ds.paginationDesktop),
        [BP.TABLET]:  toBool(ds.paginationTablet),
        [BP.MOBILE]:  toBool(ds.paginationMobile),
      },
      arrows: {
        [BP.DESKTOP]: true, 
        [BP.TABLET]:  toBool(ds.arrowsTablet),
        [BP.MOBILE]:  toBool(ds.arrowsMobile),
      }
    };
  }

  function getSlidesPerView(ul) {
    const first = ul.querySelector('.slider__slide');
    if (!first) return 1;
    const slideWidth = first.getBoundingClientRect().width || 1;
    const containerWidth = ul.getBoundingClientRect().width || slideWidth;
    return Math.max(1, Math.round(containerWidth / slideWidth));
  }

  function getGapPx(ul) {
    const s = getComputedStyle(ul);
    return parseFloat(s.columnGap || s.gap || '0') || 0;
  }

  function buildDots(container, pages, current, onGo) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'media-swiper__dots';
    for (let i = 0; i < pages; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'media-swiper__dot' + (i === current ? ' is-active' : '');
      b.setAttribute('aria-label', `Go to slide ${i + 1}`);
      b.addEventListener('click', () => onGo(i));
      wrap.appendChild(b);
    }
    container.appendChild(wrap);
  }

  function toggleCounter(viewer, hide) {
    const cnt = qs(viewer, '.slider-counter');
    if (cnt) cnt.style.display = hide ? 'none' : '';
  }

  function initOne(viewer) {
    const ul = qs(viewer, 'ul[id^="Slider-Gallery-"]');
    if (!ul || instances.has(ul)) return;

    const cfg = getConfig(viewer);
    const buttonsScope = qs(viewer, '.slider-buttons');
    const btnPrev = buttonsScope && qs(buttonsScope, '.slider-button--prev');
    const btnNext = buttonsScope && qs(buttonsScope, '.slider-button--next');

    viewer.classList.add('media-swiper--active');

    
    let dotsHost = buttonsScope && qs(buttonsScope, '.media-swiper__dots-host');
    if (!dotsHost && buttonsScope) {
      dotsHost = document.createElement('div');
      dotsHost.className = 'media-swiper__dots-host';
      if (btnPrev) buttonsScope.insertBefore(dotsHost, btnNext || null);
      else buttonsScope.appendChild(dotsHost);
    }

    const state = { pageIndex: 0, pages: 1, spv: 1, pageWidth: 0, gap: 0, cleanup: [], bp: getBP() };

    function applyVisibilityForBP() {
      state.bp = getBP();
      const showDots   = !!cfg.pagination[state.bp];
      const showArrows = !!cfg.arrows[state.bp];

      
      if (!showDots && dotsHost) dotsHost.innerHTML = '';
      toggleCounter(viewer, showDots); 

      
      [btnPrev, btnNext].forEach(b => {
        if (!b) return;
        b.classList.toggle('media-swiper__btn-hidden', !showArrows);
      });
    }

    function measure() {
      const slides = qsa(ul, '.slider__slide');
      if (!slides.length) return;

      state.spv = getSlidesPerView(ul);
      state.gap = getGapPx(ul);

      const firstW = slides[0].getBoundingClientRect().width || 0;
      state.pageWidth = firstW * state.spv + state.gap * (state.spv - 1);
      state.pages = Math.max(1, Math.ceil(slides.length / state.spv));

      const approxIndex = Math.round(ul.scrollLeft / (state.pageWidth || 1));
      state.pageIndex = clamp(approxIndex, 0, state.pages - 1);

      applyVisibilityForBP();

      if (cfg.pagination[state.bp] && dotsHost) {
        buildDots(dotsHost, state.pages, state.pageIndex, goToPage);
      }
      updateButtons();
    }

    function goToPage(i, smooth = true) {
      state.pageIndex = clamp(i, 0, state.pages - 1);
      const x = Math.round(state.pageIndex * (state.pageWidth || 0));
      ul.scrollTo({ left: x, behavior: smooth ? 'smooth' : 'auto' });
      updateDotsActive();
      updateButtons();
    }

    function updateDotsActive() {
      if (!dotsHost) return;
      qsa(dotsHost, '.media-swiper__dot').forEach((d, i) => d.classList.toggle('is-active', i === state.pageIndex));
    }

    function updateButtons() {
      if (btnPrev) btnPrev.disabled = state.pageIndex <= 0;
      if (btnNext) btnNext.disabled = state.pageIndex >= state.pages - 1;
    }

    function onPrev() { goToPage(state.pageIndex - 1); }
    function onNext() { goToPage(state.pageIndex + 1); }
    btnPrev && btnPrev.addEventListener('click', onPrev);
    btnNext && btnNext.addEventListener('click', onNext);
    state.cleanup.push(() => { btnPrev && btnPrev.removeEventListener('click', onPrev); });
    state.cleanup.push(() => { btnNext && btnNext.removeEventListener('click', onNext); });

 
    let raf = null;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const idx = Math.round(ul.scrollLeft / (state.pageWidth || 1));
        if (idx !== state.pageIndex) {
          state.pageIndex = clamp(idx, 0, state.pages - 1);
          updateDotsActive();
          updateButtons();
        }
      });
    }
    ul.addEventListener('scroll', onScroll, { passive: true });
    state.cleanup.push(() => ul.removeEventListener('scroll', onScroll));


    const ro = new ResizeObserver(() => {
      const beforeBP = state.bp;
      measure();
      const bpNow = getBP();
      
      if (beforeBP !== bpNow) goToPage(0, false);
      else goToPage(state.pageIndex, false);
    });
    ro.observe(ul);
    state.cleanup.push(() => ro.disconnect());

  
    measure();
    goToPage(state.pageIndex, false);

    
    instances.set(ul, {
      destroy() {
        state.cleanup.forEach(fn => fn());
        instances.delete(ul);
        viewer.classList.remove('media-swiper--active');
      
        toggleCounter(viewer, false);
        if (dotsHost) dotsHost.innerHTML = '';
      }
    });
  }

  function initAllWithin(root = document) {
    qsa(root, 'slider-component[id^="GalleryViewer-"]').forEach(initOne);
  }

  function destroyInside(root) {
    instances.forEach((inst, ul) => {
      if (root.contains(ul)) inst.destroy();
    });
  }

  document.addEventListener('DOMContentLoaded', () => initAllWithin(document));
  document.addEventListener('shopify:section:load', e => initAllWithin(e.target || document));
  document.addEventListener('shopify:section:reorder', () => initAllWithin(document));
  document.addEventListener('product-info:loaded', (e) => initAllWithin(e.target || document));

  const mo = new MutationObserver((mut) => {
    for (const m of mut) {
      m.removedNodes?.forEach(n => { if (n.nodeType === 1) destroyInside(n); });
      m.addedNodes?.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches?.('slider-component[id^="GalleryViewer-"], media-gallery, ul[id^="Slider-Gallery-"]')) {
          initAllWithin(n);
        } else {
          initAllWithin(n);
        }
      });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });


  const style = document.createElement('style');
  style.textContent = `
    .media-swiper__dots-host{display:flex;align-items:center}
    .media-swiper__dots{display:flex;gap:.5rem;align-items:center}
    .media-swiper__dot{width:.5rem;height:.5rem;border-radius:50%;background:currentColor;opacity:.35;border:none;cursor:pointer}
    .media-swiper__dot.is-active{opacity:1}
    .media-swiper__btn-hidden{display:none!important}
  `;
  document.head.appendChild(style);
})();
