(() => {
  const gallery = document.getElementById('aboutGallery');
  const previous = document.getElementById('aboutGalleryPrev');
  const next = document.getElementById('aboutGalleryNext');
  const updateArrows = () => {
    const max = Math.max(0, gallery.scrollWidth - gallery.clientWidth);
    previous.disabled = gallery.scrollLeft <= 2;
    next.disabled = gallery.scrollLeft >= max - 2;
  };
  previous.addEventListener('click', () => gallery.scrollBy({ left: -gallery.clientWidth * .72, behavior: 'smooth' }));
  next.addEventListener('click', () => gallery.scrollBy({ left: gallery.clientWidth * .72, behavior: 'smooth' }));
  gallery.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  window.addEventListener('load', updateArrows);
  updateArrows();
  try {
    const count = window.CakeCart?.count(window.CakeCart.read(window.CakeCart.key())) || 0;
    document.getElementById('aboutCartCount').textContent = count;
  } catch { document.getElementById('aboutCartCount').textContent = '0'; }
})();
