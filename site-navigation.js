(() => {
  document.querySelectorAll('.nav-cart-link').forEach((cartLink) => {
    if (cartLink.parentElement?.querySelector('.nav-wishlist-link')) return;
    const wishlistLink = document.createElement('a');
    wishlistLink.className = 'nav-wishlist-link';
    wishlistLink.href = 'wishlist.html';
    wishlistLink.title = 'Your wishlist';
    wishlistLink.setAttribute('aria-label', 'Your wishlist');
    wishlistLink.innerHTML = '<span aria-hidden="true">♡</span>';
    cartLink.before(wishlistLink);
  });
  document.querySelectorAll('.nav-wishlist-link').forEach((link) => {
    link.href = 'wishlist.html';
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem('cakeWishlist') || '[]'); } catch { /* show the empty wishlist count */ }
    link.hidden = false;
    link.setAttribute('aria-label', `Your wishlist${saved.length ? `, ${saved.length} saved` : ''}`);
    link.title = saved.length ? `Your wishlist · ${saved.length} saved` : 'Your wishlist';
  });

  const accountDropdown = document.querySelector('.site-header .nav-account-dropdown');
  const accountToggle = accountDropdown?.querySelector('.nav-account-toggle');
  const setAccountMenuOpen = (open) => {
    if (!accountDropdown || !accountToggle) return;
    accountDropdown.classList.toggle('open', open);
    accountToggle.setAttribute('aria-expanded', String(open));
  };
  if (accountDropdown && accountToggle) {
    accountToggle.addEventListener('click', () => setAccountMenuOpen(!accountDropdown.classList.contains('open')));
    accountDropdown.addEventListener('pointerenter', () => {
      if (window.matchMedia('(min-width: 841px)').matches) setAccountMenuOpen(true);
    });
    accountDropdown.addEventListener('pointerleave', () => setAccountMenuOpen(false));
    accountDropdown.addEventListener('focusin', () => setAccountMenuOpen(true));
    accountDropdown.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setAccountMenuOpen(false)));
    document.addEventListener('click', (event) => {
      if (!accountDropdown.contains(event.target)) setAccountMenuOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !accountDropdown.classList.contains('open')) return;
      setAccountMenuOpen(false);
      accountToggle.focus();
    });
  }

  const dropdown = document.querySelector('.site-header .nav-item-dropdown');
  const toggle = dropdown?.querySelector('.nav-category-toggle');
  const trigger = dropdown?.querySelector('.nav-link-dropdown');
  const nav = document.querySelector('.site-header .nav-wrap > nav > ul');
  const hamburger = document.querySelector('.site-header .hamburger');
  if (!nav || !hamburger) return;

  const setDropdownOpen = (open) => {
    if (!dropdown || !toggle || !trigger) return;
    dropdown.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-expanded', String(open));
  };
  const closeMobileNav = () => {
    nav.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    setDropdownOpen(false);
  };

  if (dropdown && toggle && trigger) {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      setDropdownOpen(!dropdown.classList.contains('open'));
    });
    toggle.addEventListener('click', () => setDropdownOpen(!dropdown.classList.contains('open')));
    dropdown.addEventListener('pointerenter', () => {
      if (window.matchMedia('(min-width: 841px)').matches) setDropdownOpen(true);
    });
    dropdown.addEventListener('pointerleave', () => setDropdownOpen(false));
    dropdown.addEventListener('focusin', () => setDropdownOpen(true));
  }
  hamburger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', String(open));
    if (!open) setDropdownOpen(false);
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', (event) => {
    if (link.classList.contains('nav-link-dropdown')) return;
    if (link.closest('.nav-compact-dropdown')) setDropdownOpen(false);
    closeMobileNav();
    if (link.getAttribute('href')?.startsWith('index.html#')) return;
    if (link.getAttribute('href')?.startsWith('#')) event.preventDefault();
  }));
  document.addEventListener('click', (event) => {
    if (dropdown && !dropdown.contains(event.target)) setDropdownOpen(false);
    if (!event.target.closest('.site-header')) closeMobileNav();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const hadOpenMenu = Boolean(dropdown?.classList.contains('open'));
    setDropdownOpen(false);
    if (nav.classList.contains('open')) closeMobileNav();
    if (hadOpenMenu) toggle.focus();
  });
})();
