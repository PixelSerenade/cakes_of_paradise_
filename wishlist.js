(() => {
  const freshPhotoUrl = (value) => {
    const url = String(value || '');
    if (!/^\/?(?:public\/)?images\//.test(url)) return url;
    const clean = url.replace(/([?&])v=[^&]*/g, '').replace(/[?&]$/, '');
    return `${clean}${clean.includes('?') ? '&' : '?'}v=20261101-real`;
  };
  const API = window.CAKES_API_BASE || '/api';
  const list = document.getElementById('wishlistItems');
  const empty = document.getElementById('wishlistEmpty');
  const setStatus = (text) => { const status = document.getElementById('wishlistMessage'); if (status) status.textContent = text; };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const bagIconMarkup = '<svg class="bag-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.5 8.5h13l1.2 12H4.3l1.2-12Z"/><path d="M9 9V6.5a3 3 0 0 1 6 0V9"/></svg>';
  let bagToastTimer;
  const showBagToast = (product, title = 'Added to Bag!') => {
    let toast = document.getElementById('wishlistBagToast');
    if (!toast) {
      toast = document.createElement('aside');
      toast.id = 'wishlistBagToast';
      toast.className = 'wishlist-bag-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.append(toast);
    }
    toast.innerHTML = `<span class="wishlist-bag-toast-photo">${product.image ? `<img src="${escapeHtml(freshPhotoUrl(product.image))}" alt="">` : '♡'}<b aria-hidden="true">${title.startsWith('Added') ? '✓' : '♡'}</b></span><div><strong>${title}</strong><p>${escapeHtml(product.name)}${title.startsWith('Added') ? ` (${escapeHtml(product.sizes?.[0]?.name || 'Cake')})` : ' removed from your wishlist.'}</p>${title.startsWith('Added') ? '<a href="cart.html">View Bag <span aria-hidden="true">→</span></a>' : ''}</div><button type="button" aria-label="Dismiss notification">×</button>`;
    toast.classList.add('is-visible');
    toast.querySelector('button').addEventListener('click', () => toast.classList.remove('is-visible'), { once: true });
    clearTimeout(bagToastTimer);
    bagToastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4800);
  };
  const updateCartCount = () => { const count = document.getElementById('navCartCount'); if (count && window.CakeCart) count.textContent = String(window.CakeCart.count(window.CakeCart.read(window.CakeCart.key()))); };
  const getSaved = () => { try { const ids = JSON.parse(localStorage.getItem('cakeWishlist') || '[]'); return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []; } catch { return []; } };
  const updateWishlistCount = (count) => { const counter = document.getElementById('wishlistCount'); if (counter) counter.textContent = String(count); const heroCounter = document.getElementById('wishlistHeroCount'); if (heroCounter) heroCounter.textContent = `${count} sweet favorite${count === 1 ? '' : 's'}`; };
  const setSaved = (ids) => { const unique = [...new Set(ids)]; localStorage.setItem('cakeWishlist', JSON.stringify(unique)); updateWishlistCount(unique.length); };
  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });
  let products = [];
  const render = () => {
    if (!list || !empty) return;
    const saved = new Set(getSaved());
    const items = products.filter((product) => saved.has(product.id));
    updateWishlistCount(saved.size);
    empty.hidden = items.length !== 0;
    list.innerHTML = items.map((product) => `<article class="wishlist-row" data-wishlist-product="${escapeHtml(product.id)}"><div class="wishlist-image-wrap"><img src="${escapeHtml(freshPhotoUrl(product.image || '/public/images/products/birthday/birthday-confetti.jpg'))}" alt="${escapeHtml(product.name)}"><button class="wishlist-remove" type="button" data-remove="${escapeHtml(product.id)}" aria-label="Remove ${escapeHtml(product.name)} from wishlist" title="Remove from wishlist">♥</button></div><div class="wishlist-copy"><h2>${escapeHtml(product.name)}</h2><p>${money(product.sizes?.[0]?.price)}</p><small>${escapeHtml(product.description || 'A sweet little favorite, baked fresh for your celebration.')}</small></div><div class="wishlist-row-actions"><button class="wishlist-add" type="button" data-add="${escapeHtml(product.id)}" ${product.stock <= 0 ? 'disabled' : ''}>${product.stock <= 0 ? 'Out of stock' : `${bagIconMarkup}<span>Add to bag</span>`}</button></div></article>`).join('');
    if (!items.length) setStatus('Your saved cakes will be collected here.');
  };
  const load = async () => {
    try {
      const response = await fetch(`${API}/catalog?limit=60`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load the cake collection.');
      products = data.products || [];
      if (localStorage.getItem('token')) {
        try {
          const accountResponse = await fetch(`${API}/auth/account`, { headers: headers() });
          const account = await accountResponse.json();
          if (accountResponse.ok) setSaved([...getSaved(), ...(account.user?.favoriteProducts || [])]);
        } catch { /* Browser-saved wishlist remains available offline. */ }
      }
      render();
    } catch (error) {
      setStatus(error.message || 'Could not load your wishlist right now. Please try again.');
      if (empty) empty.hidden = false;
      if (list) list.innerHTML = '';
    }
  };
  list?.addEventListener('click', async (event) => {
    const remove = event.target.closest('[data-remove]');
    const add = event.target.closest('[data-add]');
    if (remove) {
      const id = remove.dataset.remove;
      const removedProduct = products.find((product) => product.id === id) || { id, name: 'Cake' };
      setSaved(getSaved().filter((savedId) => savedId !== id));
      const user = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
      if (localStorage.getItem('token') && user?.role !== 'admin') fetch(`${API}/auth/account/favorites/${encodeURIComponent(id)}`, { method: 'PUT', headers: headers() }).catch(() => {});
      render();
      setStatus('Removed from your wishlist.');
      showBagToast(removedProduct, 'Removed from Wishlist');
      return;
    }
    if (!add) return;
    const product = products.find((item) => item.id === add.dataset.add);
    const size = product?.sizes?.[0];
    const flavor = product?.flavors?.[0];
    if (!product || !size || !flavor || !window.CakeCart) return;
    const originalMarkup = add.innerHTML;
    const lines = window.CakeCart.read(window.CakeCart.key());
    const existing = lines.find((line) => line.productId === product.id && line.size === size.name && line.flavor === flavor);
    if (existing) existing.quantity = Math.min(10, Number(existing.quantity) + 1);
    else lines.push({ productId: product.id, name: product.name, size: size.name, flavor, price: size.price, quantity: 1 });
    window.CakeCart.write(window.CakeCart.key(), lines);
    window.CakeCart.saveAccountCart(lines).catch(() => {});
    updateCartCount();
    showBagToast(product);
    add.innerHTML = `${bagIconMarkup}<span>Added to bag</span>`;
    setStatus(`${product.name} was added to your bag.`);
    window.setTimeout(() => { if (add.isConnected) add.innerHTML = originalMarkup; }, 1100);
  });
  updateCartCount();
  load();
})();
