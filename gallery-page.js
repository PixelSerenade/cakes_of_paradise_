(() => {
  const photos = [
    { src: '/public/images/products/birthday/flower-letter-birthday.jpg', title: 'A little birthday wish', category: 'Birthdays', group: 'birthdays' },
    { src: '/public/images/products/anniversary/strawberry-cream-anniversary.jpg', title: 'A day to remember', category: 'Anniversaries', group: 'anniversaries' },
    { src: '/public/images/products/birthday/berry-harvest-birthday.jpg', title: 'Birthday, with berries', category: 'Birthdays', group: 'birthdays' },
    { src: '/public/images/products/theme/baby-shower-celebration.jpg', title: 'A little one on the way', category: 'Baby Showers', group: 'baby-showers' },
    { src: '/public/images/products/anniversary/liana-blush-anniversary.jpg', title: 'Twenty one', category: 'Anniversaries', group: 'anniversaries' },
    { src: '/public/images/products/birthday/fresh-fruit-birthday.jpg', title: 'A little happiness', category: 'Birthdays', group: 'birthdays' },
    { src: '/public/images/gallery/6.jpeg', title: 'Just graduated', category: 'Graduations', group: 'graduations' },
    { src: '/public/images/products/theme/gender-reveal-celebration.jpg', title: 'A sweet surprise', category: 'Baby Showers', group: 'baby-showers' },
    { src: '/public/images/products/wedding/ivory-gold-wedding.jpg', title: 'A celebration in bloom', category: 'Other', group: 'other' },
    { src: '/public/images/products/anniversary/berry-layer-anniversary.jpg', title: 'Forever & always', category: 'Anniversaries', group: 'anniversaries' },
    { src: '/public/images/products/birthday/woodland-vanilla-birthday.jpg', title: 'It is a good day', category: 'Birthdays', group: 'birthdays' },
    { src: '/public/images/products/cupcakes-jars/pink-sprinkle-cupcake-box.jpg', title: 'A sweet little treat', category: 'Other', group: 'other' },
  ];

  const grid = document.getElementById('momentsGrid');
  const count = document.getElementById('galleryResultCount');
  const lightbox = document.getElementById('momentLightbox');
  const lightboxPhoto = document.getElementById('lightboxPhoto');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxCategory = document.getElementById('lightboxCategory');
  let lastFocused = null;

  document.querySelectorAll('.moment-filter').forEach((button) => {
    const selected = button.dataset.filter === 'all';
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

  function render(filter = 'all') {
    const visible = filter === 'all' ? photos : photos.filter((photo) => photo.group === filter);
    grid.innerHTML = visible.map((photo, index) => `
      <button type="button" class="moment-card" data-photo-index="${photos.indexOf(photo)}" aria-label="View ${escapeHtml(photo.title)}, ${escapeHtml(photo.category)}">
        <span class="moment-photo-wrap"><img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.title)}" ${index < 4 ? 'fetchpriority="high"' : 'loading="lazy"'}><span class="moment-heart moment-heart-top" aria-hidden="true">♡</span><span class="moment-heart moment-heart-bottom" aria-hidden="true">♡</span></span>
        <span class="moment-caption"><span>${escapeHtml(photo.title)} <i aria-hidden="true">♡</i></span><small>${escapeHtml(photo.category)}</small></span>
      </button>`).join('');
    count.textContent = `${visible.length} sweet moment${visible.length === 1 ? '' : 's'}`;
  }

  document.querySelector('.moment-filters').addEventListener('click', (event) => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    document.querySelectorAll('.moment-filter').forEach((filterButton) => {
      const selected = filterButton === button;
      filterButton.classList.toggle('is-active', selected);
      filterButton.setAttribute('aria-pressed', String(selected));
    });
    render(button.dataset.filter);
  });

  grid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-photo-index]');
    if (!card) return;
    const photo = photos[Number(card.dataset.photoIndex)];
    if (!photo) return;
    lastFocused = card;
    lightboxPhoto.src = photo.src;
    lightboxPhoto.alt = photo.title;
    lightboxTitle.textContent = photo.title;
    lightboxCategory.textContent = photo.category;
    lightbox.hidden = false;
    document.body.classList.add('lightbox-open');
    lightbox.querySelector('.lightbox-close').focus();
  });

  function closeLightbox() {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    lightboxPhoto.removeAttribute('src');
    document.body.classList.remove('lightbox-open');
    lastFocused?.focus();
  }

  lightbox.querySelectorAll('.lightbox-close,.lightbox-backdrop').forEach((button) => button.addEventListener('click', closeLightbox));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeLightbox();
  });

  render('all');
})();
