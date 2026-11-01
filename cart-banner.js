(() => {
  const image = document.getElementById('cartHeroImage');
  const dots = document.getElementById('cartHeroDots');
  if (!image || !dots) return;

  const fallbackSlides = [
    { src: '/public/images/editorial/hero-blush.webp?v=20261101-ai-hero', alt: 'AI illustrated blush celebration cake' },
    { src: '/public/images/editorial/hero-blue.webp?v=20261101-ai-hero', alt: 'AI illustrated powder blue cake with ivory flowers' },
    { src: '/public/images/editorial/hero-sage.webp?v=20261101-ai-hero', alt: 'AI illustrated sage green cake with cream bows' },
    { src: '/public/images/editorial/birthday-cake.png?v=20261101-ai-hero', alt: 'AI illustrated birthday cake with colorful decorations' },
    { src: '/public/images/editorial/anniversary-cake.png?v=20261101-ai-hero', alt: 'AI illustrated anniversary cake with vintage piping' },
    { src: '/public/images/editorial/wedding-cake.png?v=20261101-ai-hero', alt: 'AI illustrated tiered wedding cake with delicate flowers' },
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
