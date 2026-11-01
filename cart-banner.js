(() => {
  const image = document.getElementById('cartHeroImage');
  const dots = document.getElementById('cartHeroDots');
  if (!image || !dots) return;

  const fallbackSlides = [
    { src: '/public/images/products/theme/gender-reveal-celebration.jpg', alt: 'A pastel celebration cake shown from the front' },
    { src: '/public/images/products/birthday/birthday-confetti.jpg', alt: 'A confetti cake shown from the front and above' },
    { src: '/public/images/products/birthday/berry-harvest-birthday.jpg', alt: 'A berry topped celebration cake viewed from above' },
    { src: '/public/images/products/birthday/flower-letter-birthday.jpg', alt: 'A pink floral cake shown from the front' },
    { src: '/public/images/products/wedding/blush-bloom-wedding.jpg', alt: 'A floral tiered cake shown from the front' },
    { src: '/public/images/products/birthday/fresh-fruit-birthday.jpg', alt: 'A fruit topped cake viewed from above' },
  ];
  let slides = fallbackSlides;
  let active = 0;
  let timer = 0;
  let pointerStart = null;

  function showSlide(nextIndex) {
    active = (nextIndex + slides.length) % slides.length;
    const next = slides[active];
    const preload = new Image();
    preload.onload = () => {
      image.classList.add('is-changing');
      window.setTimeout(() => {
        image.src = next.src;
        image.alt = next.alt;
        image.classList.remove('is-changing');
      }, 220);
    };
    preload.onerror = () => image.classList.remove('is-changing');
    preload.src = next.src;
    dots.querySelectorAll('button').forEach((button, index) => {
      button.classList.toggle('is-active', index === active);
      button.setAttribute('aria-pressed', String(index === active));
    });
  }

  function buildControls() {
    dots.replaceChildren(...slides.map((slide, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'cart-hero-dot';
      dot.setAttribute('aria-label', `Show photo ${index + 1}: ${slide.alt}`);
      dot.setAttribute('aria-pressed', String(index === active));
      dot.addEventListener('click', () => { showSlide(index); restartTimer(); });
      return dot;
    }));
  }

  function restartTimer() {
    window.clearInterval(timer);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      timer = window.setInterval(() => { if (!document.hidden) showSlide(active + 1); }, 5600);
    }
  }

  document.getElementById('cartHeroPrevious')?.addEventListener('click', () => { showSlide(active - 1); restartTimer(); });
  document.getElementById('cartHeroNext')?.addEventListener('click', () => { showSlide(active + 1); restartTimer(); });
  image.parentElement?.addEventListener('pointerdown', (event) => { pointerStart = event.clientX; });
  image.parentElement?.addEventListener('pointerup', (event) => {
    if (pointerStart === null || Math.abs(event.clientX - pointerStart) < 45) { pointerStart = null; return; }
    showSlide(active + (event.clientX < pointerStart ? 1 : -1));
    restartTimer();
    pointerStart = null;
  });

  buildControls();
  restartTimer();
})();
