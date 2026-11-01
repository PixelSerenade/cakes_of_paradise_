/* Progressive motion: content and controls work even when animation is unavailable. */
(() => {
  const root = document.documentElement;
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => systemMotion.matches || root.dataset.reduceMotion === 'true';
  const seen = new WeakSet();
  const running = new Set();
  const animate = (element, frames, options) => {
    if (reduced() || !element.animate) return;
    const animation = element.animate(frames, options);
    running.add(animation);
    animation.finished.catch(() => {}).finally(() => running.delete(animation));
  };
  const syncMotion = () => {
    if (reduced()) {
      running.forEach(animation => animation.cancel());
      running.clear();
    }
  };
  systemMotion.addEventListener('change', syncMotion);
  new MutationObserver(syncMotion).observe(root, { attributes: true, attributeFilter: ['data-reduce-motion'] });

  const selector = '.reveal,.product-card,.cake-card,.g-item,.account-welcome,.account-card,.account-order,.account-row,.overview-card,.orders-card,.order-card,.cart-page-card,.cart-checkout-card,.cart-page-heading,.settings-card,.settings-actions,.admin-chart-card,.admin-kpi,.admin-order-card,.admin-welcome,.admin-section-heading,.admin-subpanel,.admin-list-row,.admin-product-card,.admin-tools,.auth-card,.section-head,.custom-visual,.custom-text,.about-photo,.about-text,.contact-info,.contact-form';
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    let stagger = 0;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      entry.target.classList.add('motion-enter');
      entry.target.style.setProperty('--motion-delay', `${Math.min(stagger++ * 75, 375)}ms`);
    });
  }, { threshold: .08 }) : null;
  const discover = container => {
    const nodes = [...(container.matches?.(selector) ? [container] : []), ...container.querySelectorAll(selector)];
    nodes.forEach(node => {
      if (seen.has(node)) return;
      seen.add(node);
      observer?.observe(node);
    });
  };
  discover(document.body);
  new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) discover(node);
    }));
  }).observe(document.body, { childList: true, subtree: true });

  // A short tactile response follows mouse, touch, and keyboard activation.
  document.addEventListener('click', event => {
    const button = event.target.closest('button,.btn,.account-button,.store-secondary');
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
    animate(button, [
      { scale: '1' }, { scale: '.96', offset: .35 }, { scale: '1' }
    ], { duration: 260, easing: 'ease-out' });
  });
  document.addEventListener('change', event => {
    if (!event.target.matches('input[type=checkbox],input[type=radio]')) return;
    animate(event.target, [{ scale: '.85' }, { scale: '1.14', offset: .6 }, { scale: '1' }], { duration: 260 });
  });
  document.addEventListener('toggle', event => {
    if (!event.target.matches('details') || !event.target.open) return;
    [...event.target.children].filter(child => child.tagName !== 'SUMMARY').forEach(child => {
      animate(child, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280, easing: 'ease-out' });
    });
  }, true);
})();
