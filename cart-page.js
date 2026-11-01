(() => {
  const freshPhotoUrl = (value) => {
    const url = String(value || '');
    if (!/^\/?(?:public\/)?images\//.test(url)) return url;
    const clean = url.replace(/([?&])v=[^&]*/g, '').replace(/[?&]$/, '');
    return `${clean}${clean.includes('?') ? '&' : '?'}v=20261101-real`;
  };
  const API = window.CAKES_API_BASE || '/api';
  const linesNode = document.getElementById('cartLines');
  const setHidden = (id, hidden) => {
    const element = document.getElementById(id);
    if (element) element.hidden = hidden;
  };
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let cart = [];
  try {
    const saved = JSON.parse(localStorage.getItem(window.CakeCart?.key() || 'cakeBasket') || '[]');
    cart = Array.isArray(saved) ? saved.filter((line) => line && typeof line.productId === 'string' && Number.isInteger(Number(line.quantity)) && Number(line.quantity) > 0) : [];
  } catch { cart = []; }
  const persist = () => {
    localStorage.setItem(window.CakeCart?.key() || 'guestCakeBasket', JSON.stringify(cart));
    if (localStorage.getItem('token')) window.CakeCart?.saveAccountCart(cart).catch((error) => {
      const notice = document.getElementById('cartPageMessage');
      notice.textContent = error.message;
      notice.classList.add('is-error');
    });
  };
  let removalToastTimer;
  const showRemovalToast = (name) => {
    let toast = document.getElementById('cartSuccessToast');
    if (!toast) {
      toast = document.createElement('aside');
      toast.id = 'cartSuccessToast';
      toast.className = 'cart-success-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
    }
    toast.innerHTML = `<div class="toast-card"><div class="toast-icon-wrap" aria-hidden="true">✓</div><div class="toast-body"><strong class="toast-title">Removed from Bag</strong><p class="toast-meta">${escapeHtml(name || 'Cake')} was removed from your bag.</p><a href="shop.html" class="toast-btn-view">Continue shopping <span aria-hidden="true">→</span></a></div><button type="button" class="toast-close" aria-label="Dismiss notification">×</button></div>`;
    toast.classList.add('is-visible');
    toast.querySelector('.toast-close').addEventListener('click', () => toast.classList.remove('is-visible'), { once: true });
    window.clearTimeout(removalToastTimer);
    removalToastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4500);
  };

  function render() {
    const count = cart.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
    setHidden('cartEmptyState', Boolean(cart.length));
    setHidden('cartFilledState', !cart.length);
    document.getElementById('cartPageCount').textContent = String(count);
    document.getElementById('cartSubtotal').textContent = money(cart.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.quantity || 0), 0));
    setHidden('emptyCartShop', Boolean(cart.length));
    const checkoutButton = document.getElementById('cartCheckoutButton');
    if (checkoutButton) checkoutButton.disabled = !cart.length;
    const badge = document.getElementById('navCartCount');
    if (badge) badge.textContent = String(count);
    setHidden('cartSignOut', !localStorage.getItem('token'));
    if (checkoutButton) checkoutButton.textContent = localStorage.getItem('token') ? 'Continue to checkout' : 'Login to checkout';
    linesNode.innerHTML = cart.length ? cart.map((line, index) => `<article class="cart-page-line"><div class="cart-line-product"><img src="${escapeHtml(freshPhotoUrl(line.image || ''))}" alt="${escapeHtml(line.name || 'Cake')}"></div><div class="cart-line-details"><h3>${escapeHtml(line.name || 'Cake')}</h3><p>${escapeHtml(line.flavor || '')} · ${escapeHtml(line.size || '')}</p>${line.cakeMessage ? `<small class="cart-cake-message">Cake message: “${escapeHtml(line.cakeMessage)}”</small>` : ''}<button type="button" class="cart-save-later" data-cart-action="save" data-index="${index}">♡ &nbsp; Save for later</button></div><div class="cart-line-unit-price"><span>Unit price</span><strong>${money(Number(line.price || 0))}</strong></div><div class="cart-line-quantity"><span>Quantity</span><div class="cart-page-line-actions"><button type="button" data-cart-action="decrease" data-index="${index}" aria-label="Remove one ${escapeHtml(line.name || 'cake')}">−</button><output>${Number(line.quantity)}</output><button type="button" data-cart-action="increase" data-index="${index}" aria-label="Add one ${escapeHtml(line.name || 'cake')}">+</button></div></div><strong class="cart-page-line-price">${money(Number(line.price || 0) * Number(line.quantity || 0))}</strong><button type="button" class="remove-cart-item" data-cart-action="remove" data-index="${index}" aria-label="Remove ${escapeHtml(line.name || 'cake')} from cart">×</button></article>`).join('') : '<p class="empty-account">Your cart is empty. Browse the catalogue and add a cake to get started.</p>';
  }

  linesNode.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-cart-action]');
    if (!button) return;
    const index = Number(button.dataset.index);
    const line = cart[index];
    if (!line) return;
    if (button.dataset.cartAction === 'save') {
      try {
        const token = localStorage.getItem('token');
        const savedIds = JSON.parse(localStorage.getItem('cakeWishlist') || '[]');
        const saved = new Set(Array.isArray(savedIds) ? savedIds : []);
        if (token) {
          const headers = { Authorization: `Bearer ${token}` };
          const accountResponse = await fetch(`${window.CAKES_API_BASE || '/api'}/auth/account`, { headers });
          const account = await accountResponse.json();
          if (!accountResponse.ok) throw new Error(account.message || 'Could not check your wishlist.');
          if (!(account.user?.favoriteProducts || []).includes(line.productId)) {
            const favoriteResponse = await fetch(`${window.CAKES_API_BASE || '/api'}/auth/account/favorites/${encodeURIComponent(line.productId)}`, { method: 'PUT', headers });
            const result = await favoriteResponse.json();
            if (!favoriteResponse.ok) throw new Error(result.message || 'Could not save this cake to your wishlist.');
          }
        } else {
          saved.add(line.productId);
          localStorage.setItem('cakeWishlist', JSON.stringify([...saved]));
        }
        cart.splice(index, 1);
        persist();
        render();
        const notice = document.getElementById('cartPageMessage');
        notice.textContent = `${line.name || 'Cake'} was saved to your wishlist.`;
        notice.classList.remove('is-error');
      } catch (error) {
        const notice = document.getElementById('cartPageMessage');
        notice.textContent = error.message;
        notice.classList.add('is-error');
      }
      return;
    }
    if (button.dataset.cartAction === 'increase') line.quantity = Math.min(10, Number(line.quantity) + 1);
    if (button.dataset.cartAction === 'decrease') line.quantity = Number(line.quantity) - 1;
    const removingLine = button.dataset.cartAction === 'remove' || (button.dataset.cartAction === 'decrease' && Number(line.quantity) <= 1);
    if (button.dataset.cartAction === 'remove' || line.quantity < 1) cart.splice(index, 1);
    persist();
    render();
    if (removingLine) showRemovalToast(line.name);
  });

  document.getElementById('cartCheckoutButton').addEventListener('click', async () => {
    if (!cart.length) return;
    if (!localStorage.getItem('token')) {
      sessionStorage.setItem('returnTo', 'checkout.html#checkout');
      window.location.href = 'login.html';
      return;
    }
    try { await window.CakeCart?.saveAccountCart(cart); }
    catch (error) {
      const notice = document.getElementById('cartPageMessage');
      notice.textContent = error.message;
      notice.classList.add('is-error');
      return;
    }
    window.location.href = 'checkout.html#checkout';
  });

  render();
  fetch(`${API}/catalog`).then(async (response) => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
    const products = data.products || [];
    if (localStorage.getItem('token') && window.CakeCart?.loadAccountCart) {
      cart = await window.CakeCart.loadAccountCart();
    }
    for (let index = cart.length - 1; index >= 0; index -= 1) {
      const line = cart[index];
      const product = products.find((item) => item.id === line.productId && item.available !== false);
      const size = product?.sizes?.find((item) => item.name === line.size);
      if (!product || !size || !product.flavors?.includes(line.flavor)) { cart.splice(index, 1); continue; }
      line.name = product.name;
      line.price = size.price;
      line.image = product.image;
    }
    persist();
    render();
  }).catch((error) => {
    const notice = document.getElementById('cartPageMessage');
    notice.textContent = `Could not refresh cake availability and prices: ${error.message}`;
    notice.classList.add('is-error');
  });
})();
