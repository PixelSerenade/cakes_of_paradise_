(() => {
  const legacy = document.querySelector('body > header:not(.admin-topbar)');
  if (!legacy) return;

  let savedUser = null;
  try { savedUser = JSON.parse(localStorage.getItem('user') || 'null'); } catch { /* show customer navigation if the saved account is unreadable */ }
  const isAdmin = Boolean(localStorage.getItem('token') && savedUser?.role === 'admin');

  const header = document.createElement('header');
  header.className = `site-header shared-site-header${isAdmin ? ' admin-site-header' : ''}`;
  header.innerHTML = `
    <div class="nav-wrap">
      <a class="logo-group" href="index.html" aria-label="Cakes of Paradise home"><span class="logo-text">Cakes of Paradise</span></a>
      <nav aria-label="${isAdmin ? 'Admin navigation' : 'Main navigation'}"><ul id="navLinks"${isAdmin ? ' class="admin-nav-links"' : ''}>
        ${isAdmin ? `
        <li><a data-admin-view="overview" href="index.html?adminPage=overview">Overview</a></li>
        <li><a data-admin-view="orders" href="index.html?adminPage=orders">Orders</a></li>
        <li><a data-admin-view="products" href="index.html?adminPage=products">Products</a></li>
        <li><a data-admin-view="inventory" href="index.html?adminPage=inventory">Inventory</a></li>
        <li><a data-admin-view="customers" href="index.html?adminPage=customers">Customers</a></li>` : `
        <li><a href="index.html">Home</a></li>
        <li class="nav-item-dropdown"><div class="nav-cakes-control"><a href="shop.html?category=All" class="nav-link-dropdown" aria-haspopup="true" aria-expanded="false">Cakes</a><button class="nav-category-toggle" type="button" aria-label="Open cake categories" aria-expanded="false" aria-controls="sharedCakeMenu"><span aria-hidden="true">▾</span></button></div>
          <ul class="nav-compact-dropdown" id="sharedCakeMenu"><li><a href="shop.html?category=All">All Cakes</a></li><li><a href="shop.html?category=Birthday%20Cakes">Birthday Cakes</a></li><li><a href="shop.html?category=Wedding%20Cakes">Wedding Cakes</a></li><li><a href="shop.html?category=Anniversary%20Cakes">Anniversary Cakes</a></li><li><a href="shop.html?category=Cupcakes%20%26%20Jars">Cupcakes &amp; Jars</a></li><li><a href="shop.html?category=Theme%20Cakes">Theme Cakes</a></li><li><a href="shop.html?category=Photo%20Cakes">Photo Cakes</a></li></ul>
        </li>
        <li><a href="custom.html">Custom Cakes</a></li><li><a href="gallery.html">Sweet Moments</a></li><li><a href="about.html">About Us</a></li><li><a href="contact.html">Contact</a></li>`}
      </ul></nav>
      <div class="nav-cta">${isAdmin ? '<a class="nav-order-link admin-view-shop" href="shop.html">View shop</a>' : '<a class="nav-wishlist-link" href="wishlist.html" aria-label="Your wishlist" title="Your wishlist"><span aria-hidden="true">♡</span></a><a id="navCartLink" class="nav-cart-link" href="cart.html" aria-label="Cart, 0 items" title="View bag"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.5h11l1.2 12H5.3l1.2-12Z"/><path d="M9 9V6.5a3 3 0 0 1 6 0V9"/></svg><span id="navCartCount" class="nav-cart-count">0</span></a><a id="navOrderLink" class="nav-order-link" href="shop.html">Order Now</a>'}<a class="nav-sign-in" href="login.html">Sign In</a><button class="hamburger" id="hamburger" type="button" aria-label="Menu" aria-controls="navLinks" aria-expanded="false"><span></span><span></span><span></span></button></div>
      <div class="shared-nav-legacy-counts" aria-hidden="true"><span id="aboutCartCount">0</span><span id="contactCartCount">0</span><span id="customCartCount">0</span><span id="shopCartCount">0</span><span id="accountCartCount">0</span><span id="settingsCartCount">0</span></div>
    </div>`;

  const signOut = legacy.querySelector('#cartSignOut, #settingsSignOut, #ordersSignOut');
  if (signOut && !isAdmin) {
    signOut.classList.add('shared-nav-signout');
    header.querySelector('.nav-cta').append(signOut);
  }
  legacy.replaceWith(header);

  const accountLink = header.querySelector('.nav-sign-in');
  if (localStorage.getItem('token') && savedUser && savedUser.email && accountLink) {
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    const accountName = String(savedUser.name || 'Your account');
    accountLink.href = savedUser.role === 'admin' ? 'index.html?adminPage=overview' : 'account.html';
    accountLink.classList.remove('nav-sign-in');
    accountLink.classList.add('nav-profile-link');
    accountLink.textContent = '';
    accountLink.setAttribute('aria-label', `Open ${accountName}`);
    accountLink.title = accountName;
    accountLink.innerHTML = savedUser.avatar
      ? `<img src="${escapeHtml(savedUser.avatar)}" alt="${escapeHtml(accountName)} profile photo">`
      : `<span aria-hidden="true">${escapeHtml(accountName.charAt(0).toUpperCase())}</span>`;

    const accountMenu = document.createElement('div');
    accountMenu.className = 'nav-account-dropdown';
    accountMenu.innerHTML = `
      <button class="nav-account-toggle" type="button" aria-label="Open account shortcuts" aria-expanded="false" aria-controls="sharedAccountMenu"><span aria-hidden="true">▾</span></button>
      <ul class="nav-account-menu" id="sharedAccountMenu">
        <li><a href="${savedUser.role === 'admin' ? 'index.html?adminPage=overview' : 'account.html'}">${savedUser.role === 'admin' ? 'Admin overview' : 'Profile &amp; rewards'}</a></li>
        ${savedUser.role === 'admin' ? '' : '<li><a href="orders.html">My orders</a></li><li><a href="account.html#gift-wallet">Redeem a gift card</a></li><li><a href="account.html#rewards">Reward points</a></li>'}
        <li><button class="nav-account-signout" type="button">Sign Out</button></li>
      </ul>`;
    accountLink.after(accountMenu);
    accountMenu.prepend(accountLink);
    accountMenu.querySelector('.nav-account-signout')?.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.assign('index.html#home');
    });
  }
  let cartLines = [];
  try {
    const key = window.CakeCart?.key() || (localStorage.getItem('token') ? 'cakeBasket' : 'guestCakeBasket');
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    cartLines = Array.isArray(parsed) ? parsed : [];
  } catch { /* Keep the shared cart badge at zero if storage is unavailable. */ }
  const cartCount = cartLines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0);
  const cartCountBadge = header.querySelector('#navCartCount');
  const cartLink = header.querySelector('#navCartLink');
  if (cartCountBadge) cartCountBadge.textContent = String(cartCount);
  if (cartLink) cartLink.setAttribute('aria-label', `Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`);
  header.querySelectorAll('.shared-nav-legacy-counts span').forEach((count) => { count.textContent = String(cartCount); });

  const path = window.location.pathname.split('/').pop() || 'index.html';
  if (isAdmin) {
    const currentView = new URLSearchParams(window.location.search).get('adminPage') || 'overview';
    header.querySelectorAll('[data-admin-view]').forEach((link) => {
      if (link.dataset.adminView === currentView) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  } else header.querySelectorAll('.nav-wrap > nav > ul > li > a').forEach((link) => {
    const href = new URL(link.href, window.location.href);
    if (href.pathname.split('/').pop() === path && link.classList.contains('nav-link-dropdown')) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else if (href.pathname.split('/').pop() === path) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });
})();
