(() => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.replace('login.html');
    return;
  }

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const showMessage = (id, message, isError = false) => {
    const element = document.getElementById(id);
    element.textContent = message;
    element.classList.toggle('is-error', isError);
  };
  const renderGiftWallet = (data) => {
    document.getElementById('giftWalletBalance').textContent = money(data.balance || 0);
    document.getElementById('giftCardHistory').innerHTML = data.transactions?.length ? data.transactions.map((item) => `<article class="account-row"><span><strong>${escapeHtml(item.type)} · ${item.type === 'spent' ? '−' : '+'}${money(item.amount)}</strong><small>${escapeHtml(item.note || 'Gift wallet activity')} · balance ${money(item.balanceAfter)} · ${new Date(item.createdAt).toLocaleDateString('en-IN')}</small></span></article>`).join('') : '<p class="empty-account">Your gift wallet activity will appear here.</p>';
  };
  const freshPhotoUrl = (value) => {
    const url = String(value || '');
    if (!/^\/?(?:public\/)?images\//.test(url)) return url;
    const clean = url.replace(/([?&])v=[^&]*/g, '').replace(/[?&]$/, '');
    return `${clean}${clean.includes('?') ? '&' : '?'}v=20261101-real`;
  };
  const api = async (path, options = {}) => {
    const apiBase = window.CAKES_API_BASE || '/api';
    let response;
    try { response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}`, ...(options.headers || {}) },
    }); } catch (error) {
      if (error instanceof TypeError) throw new Error(`Cannot reach the bakery API at ${apiBase}. Start the backend or set its deployed URL in api-config.js.`);
      throw error;
    }
    let data = {};
    try { data = await response.json(); } catch { /* response may be empty */ }
    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.replace('login.html');
      throw new Error('Please sign in again to continue.');
    }
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
    return data;
  };
  const accountUser = () => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } };
  let pendingAvatar = null;
  let occasions = [];

  document.getElementById('avatarFile').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      event.target.value = '';
      showMessage('profileMessage', 'Choose a JPEG, PNG, or WebP photo under 2 MB.', true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      pendingAvatar = String(reader.result || '');
      document.getElementById('accountAvatar').innerHTML = `<img src="${escapeHtml(pendingAvatar)}" alt="">`;
      document.getElementById('profileAvatarPreview').innerHTML = `<img src="${escapeHtml(pendingAvatar)}" alt="">`;
      showMessage('profileMessage', 'Photo selected. Save your profile to apply it.');
    };
    reader.onerror = () => showMessage('profileMessage', 'Could not read that photo. Please choose it again.', true);
    reader.readAsDataURL(file);
  });

  async function loadPage() {
    try {
      const [profile, account, catalog, orderData, giftWallet] = await Promise.all([
        api('/auth/profile'), api('/auth/account'), api('/catalog'), api('/orders/mine'), api('/commerce/gift-wallet'),
      ]);
      if (profile.role === 'admin') {
        window.location.replace('index.html#admin-overview');
        return;
      }
      const user = profile;
      document.title = `${user.name}’s Account | Cakes of Paradise`;
      document.getElementById('accountWelcome').textContent = `Hello, ${user.name}`;
      document.getElementById('accountEmail').textContent = user.email;
      const avatarMarkup = user.avatar ? `<img src="${escapeHtml(user.avatar)}" alt="">` : escapeHtml(user.name?.charAt(0)?.toUpperCase() || 'C');
      document.getElementById('accountAvatar').innerHTML = avatarMarkup;
      document.getElementById('profileAvatarPreview').innerHTML = avatarMarkup;
      const profileForm = document.getElementById('profileForm');
      profileForm.elements.name.value = user.name || '';
      profileForm.elements.email.value = user.email || '';
      profileForm.elements.phone.value = user.phone || '';
      profileForm.elements.dateOfBirth.value = user.dateOfBirth || '';

      const customer = account.user;
      const rewardPoints = Number(customer.loyaltyPoints || 0);
      const rewardValue = (rewardPoints / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      document.getElementById('loyaltyBalance').textContent = `${rewardPoints.toLocaleString('en-IN')} points · ₹${rewardValue} value`;
      renderGiftWallet(giftWallet);
      document.getElementById('referralCode').textContent = customer.referralCode || '—';
      document.getElementById('referralSummary').textContent = `You both earn bonus points when your friend completes their first paid order.`;
      document.getElementById('referralTerms').textContent = `Share your code with a friend. After their first paid order is completed, they receive ${account.referralPolicy.referralFriendPoints} bonus points and you receive ${account.referralPolicy.referralOwnerPoints} points.`;
      document.getElementById('orderCount').textContent = String(orderData.orders.length);

      occasions = (customer.occasions || []).map((item) => ({ id: item._id, personName: item.personName || 'Someone special', relationship: item.relationship || 'Other', title: item.title, date: `2000-${item.dateMonthDay}`, reminderOptIn: Boolean(item.reminderOptIn) }));
      renderOccasions();

      document.getElementById('loyaltyHistory').innerHTML = account.loyaltyHistory.length ? account.loyaltyHistory.map((item) => `<article class="account-row"><span><strong>${escapeHtml(item.kind)} · ${item.kind === 'redeemed' ? '−' : '+'}${Number(item.points)} points</strong><small>${escapeHtml(item.orderNumber || item.note || 'Reward activity')} · ${new Date(item.createdAt).toLocaleDateString('en-IN')}</small></span></article>`).join('') : '<p class="empty-account">Your reward activity will appear here.</p>';
      renderAddresses(customer.savedAddresses || []);

      const products = catalog.products || [];
      const favorites = customer.favoriteProducts || [];
      document.getElementById('favoriteCakes').innerHTML = favorites.length ? favorites.map((slug) => {
        const product = products.find((item) => item.id === slug || item.slug === slug);
        return `<article class="account-row favorite-cake-row">${product?.image ? `<img src="${escapeHtml(freshPhotoUrl(product.image))}" alt="${escapeHtml(product.name)}" loading="lazy">` : ''}<span><strong>${escapeHtml(product?.name || slug)}</strong><small>${product ? `${money(product.sizes?.[0]?.price)} · ${escapeHtml(product.category)}` : 'Cake in your favourites'}</small></span><button class="account-button secondary" type="button" data-remove-favorite="${escapeHtml(slug)}">Remove</button></article>`;
      }).join('') : '<p class="empty-account">Save cakes from the catalogue and they will show up here.</p>';
      renderOrders(orderData.orders || []);
    } catch (error) {
      showMessage('pageMessage', error.message, true);
    }
  }

  function renderAddresses(addresses) {
    document.getElementById('savedAddresses').innerHTML = addresses.length ? addresses.map((address) => `<article class="account-row"><span><strong>${escapeHtml(address.label || address.recipientName || 'Saved address')}</strong><small>${escapeHtml(address.address)}, ${escapeHtml(address.area)}, ${escapeHtml(address.city)} ${escapeHtml(address.postalCode)}${address.phone ? ` · ${escapeHtml(address.phone)}` : ''}</small></span><div class="account-row-actions"><button class="account-button secondary" type="button" data-use-address="${escapeHtml(address._id)}">Use at checkout</button><button class="account-button secondary" type="button" data-delete-address="${escapeHtml(address._id)}">Delete</button></div></article>`).join('') : '<p class="empty-account">Save an address for faster checkout next time.</p>';
  }

  function renderOccasions() {
    const list = document.getElementById('occasionList');
    list.innerHTML = occasions.length ? occasions.map((item, index) => `<article class="occasion-row" data-occasion-index="${index}"><label>Person’s name<input data-occasion-person value="${escapeHtml(item.personName)}" maxlength="100" required></label><label>Relationship<select data-occasion-relationship required>${['Partner','Parent','Child','Sibling','Friend','Relative','Other'].map((relation) => `<option${item.relationship === relation ? ' selected' : ''}>${relation}</option>`).join('')}</select></label><label>Occasion<input data-occasion-title value="${escapeHtml(item.title)}" maxlength="60" required></label><label>Date<input data-occasion-date type="date" value="${escapeHtml(item.date)}" required></label><label class="consent-line"><input data-occasion-consent type="checkbox" ${item.reminderOptIn ? 'checked' : ''}> Email me a reminder</label><button class="account-button secondary" type="button" data-remove-occasion>Remove</button></article>`).join('') : '<p class="empty-account">No reminders for other people yet. Add one below.</p>';
  }

  const occasionList = document.getElementById('occasionList');
  occasionList.addEventListener('input', (event) => {
    const row = event.target.closest('[data-occasion-index]');
    if (!row) return;
    const item = occasions[Number(row.dataset.occasionIndex)];
    if (!item) return;
    if (event.target.matches('[data-occasion-person]')) item.personName = event.target.value;
    if (event.target.matches('[data-occasion-title]')) item.title = event.target.value;
    if (event.target.matches('[data-occasion-date]')) item.date = event.target.value;
  });
  occasionList.addEventListener('change', (event) => {
    const row = event.target.closest('[data-occasion-index]');
    if (row && event.target.matches('[data-occasion-relationship]')) occasions[Number(row.dataset.occasionIndex)].relationship = event.target.value;
    if (row && event.target.matches('[data-occasion-consent]')) occasions[Number(row.dataset.occasionIndex)].reminderOptIn = event.target.checked;
  });
  occasionList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-occasion]');
    if (!button) return;
    occasions.splice(Number(button.closest('[data-occasion-index]').dataset.occasionIndex), 1);
    renderOccasions();
  });

  const addOccasionForm = document.getElementById('addOccasionForm');
  addOccasionForm.elements.type.addEventListener('change', () => {
    const custom = addOccasionForm.elements.type.value === 'custom';
    document.getElementById('customOccasionWrap').hidden = !custom;
    addOccasionForm.elements.customTitle.required = custom;
  });
  addOccasionForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (occasions.length >= 20) return showMessage('occasionMessage', 'You can save up to 20 occasions.', true);
    const form = event.currentTarget;
    const title = form.elements.type.value === 'custom' ? form.elements.customTitle.value.trim() : form.elements.type.value;
    occasions.push({ personName: form.elements.personName.value.trim(), relationship: form.elements.relationship.value, title, date: form.elements.date.value, reminderOptIn: form.elements.reminderOptIn.checked });
    renderOccasions();
    form.reset();
    document.getElementById('customOccasionWrap').hidden = true;
    form.elements.customTitle.required = false;
    showMessage('occasionMessage', 'Occasion added. Save reminder settings to keep your changes.');
  });
  document.getElementById('saveOccasions').addEventListener('click', async () => {
    try {
      if (occasions.some((item) => !item.personName.trim() || !item.relationship.trim() || !item.title.trim() || !item.date)) throw new Error('Add a person’s name, relationship, occasion, and date for each reminder.');
      const payload = occasions.map((item) => ({ id: item.id, personName: item.personName.trim(), relationship: item.relationship.trim(), title: item.title.trim(), date: item.date, reminderOptIn: Boolean(item.reminderOptIn) }));
      const result = await api('/auth/account/preferences', { method: 'PUT', body: JSON.stringify({ occasions: payload }) });
      occasions = (result.preferences.occasions || []).map((item) => ({ id: item._id, personName: item.personName || 'Someone special', relationship: item.relationship || 'Other', title: item.title, date: `2000-${item.dateMonthDay}`, reminderOptIn: Boolean(item.reminderOptIn) }));
      renderOccasions();
      showMessage('occasionMessage', 'Your reminder settings are saved.');
    } catch (error) { showMessage('occasionMessage', error.message, true); }
  });

  let accountOrdersForDialog = [];
  const orderDate = (value, options = { day: 'numeric', month: 'short', year: 'numeric' }) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'To be confirmed' : date.toLocaleDateString('en-IN', options);
  };
  const formatTime = (value) => {
    if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return '';
    const [hourText, minute] = value.split(':'); const hour = Number(hourText);
    return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
  };
  function renderOrders(orders) {
    accountOrdersForDialog = [...orders].sort((a, b) => {
      const left = Date.parse(a.createdAt || '') || 0;
      const right = Date.parse(b.createdAt || '') || 0;
      return (right - left) || String(b._id || '').localeCompare(String(a._id || ''));
    });
    document.getElementById('pastOrders').innerHTML = accountOrdersForDialog.length ? accountOrdersForDialog.map((order, index) => {
      const items = order.items || [];
      const firstCake = items[0]?.name || 'Cake order';
      const additionalItems = items.length > 1 ? ` + ${items.length - 1} more` : '';
      const totalQuantity = items.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
      const fulfilment = order.customer?.deliveryType === 'pickup' ? 'Bakery pickup' : 'Delivery';
      const state = String(order.status || 'placed').replaceAll('-', ' ');
      return `<button class="account-order-row" type="button" data-account-order-index="${index}" aria-haspopup="dialog"><span class="account-order-row-mark" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span class="account-order-row-main"><strong>${escapeHtml(firstCake)}${additionalItems}</strong><small>${escapeHtml(order.orderNumber)} · ${orderDate(order.createdAt, { day: 'numeric', month: 'short' })} · ${totalQuantity} item${totalQuantity === 1 ? '' : 's'} · ${fulfilment}</small></span><span class="account-order-row-total"><strong>${money(order.total)}</strong><span class="account-status">${escapeHtml(state)}</span></span><span class="account-order-row-arrow" aria-hidden="true">→</span></button>`;
    }).join('') : '<p class="empty-account">Your orders will appear here after checkout.</p>';
  }

  const orderDialog = document.getElementById('accountOrderDialog');
  const orderDialogContent = document.getElementById('accountOrderDialogContent');
  function openAccountOrder(order) {
    const customer = order.customer || {};
    const items = (order.items || []).map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const amount = Number(item.lineTotal ?? item.total ?? (Number(item.unitPrice ?? item.price ?? 0) * quantity));
      return `<article class="account-order-detail-item">${item.image ? `<img src="${escapeHtml(freshPhotoUrl(item.image))}" alt="${escapeHtml(item.name || 'Cake')}" loading="lazy">` : ''}<div><strong>${escapeHtml(item.name || 'Cake')}</strong><span>${quantity} × ${escapeHtml(item.size || 'Standard')} · ${escapeHtml(item.flavor || 'Bakery selection')}</span>${item.cakeMessage ? `<small>Cake message: “${escapeHtml(item.cakeMessage)}”</small>` : ''}</div><b>${money(amount)}</b></article>`;
    }).join('');
    const tracking = (order.tracking || []).map((entry) => `<li class="${entry.status === order.status ? 'current' : ''}"><span></span><div><strong>${escapeHtml(String(entry.status || entry.to || 'Update').replaceAll('-', ' '))}</strong>${entry.note ? `<small>${escapeHtml(entry.note)}</small>` : ''}<time>${escapeHtml(new Date(entry.at).toLocaleString('en-IN'))}</time></div></li>`).join('');
    const deliveryDay = orderDate(customer.deliveryDate);
    const requestedTime = formatTime(customer.deliveryTime);
    const fulfilmentDetails = customer.deliveryType === 'pickup'
      ? 'Pick up at Cakes of Paradise bakery · Surathkal, Mangaluru'
      : [customer.address, customer.area, customer.city, customer.postalCode].filter(Boolean).join(', ') || 'Delivery address on file';
    const method = ({ razorpay: 'Razorpay online payment', 'pay-at-pickup': 'Pay at pickup', 'pay-on-delivery': 'Pay on delivery', 'pay-at-store': 'Pay at bakery', 'gift-card': 'Gift card' })[order.paymentMethod] || String(order.paymentMethod || 'Not specified').replaceAll('-', ' ');
    const paymentState = String(order.paymentStatus || 'pending').replaceAll('-', ' ');
    const breakdown = [
      ['Items subtotal', order.subtotal], ['Delivery', order.deliveryFee], ['Discount', order.discountAmount ?? order.discount],
    ].filter(([, amount]) => amount != null && Number(amount) !== 0).map(([label, amount]) => `<p><span>${label}</span><strong>${money(amount)}</strong></p>`).join('');
    document.getElementById('accountOrderDialogTitle').textContent = `Order ${order.orderNumber || ''}`;
    orderDialogContent.innerHTML = `<div class="account-order-detail-summary"><span class="account-status">${escapeHtml(String(order.status || 'placed').replaceAll('-', ' '))}</span><span>Placed ${orderDate(order.createdAt)}</span><strong>${money(order.total)}</strong></div><section class="account-order-detail-section"><h3>Your cakes</h3><div class="account-order-detail-items">${items || '<p>Order items are not available.</p>'}</div>${breakdown}<p class="account-order-grand-total"><span>Total paid / due</span><strong>${money(order.total)}</strong></p></section><section class="account-order-detail-section"><h3>${customer.deliveryType === 'pickup' ? 'Pickup details' : 'Delivery details'}</h3><p><span>${customer.deliveryType === 'pickup' ? 'Collect on' : 'Deliver on'}</span><strong>${deliveryDay}${requestedTime ? ` · ${requestedTime}` : ''}</strong></p><p><span>Address</span><strong>${escapeHtml(fulfilmentDetails)}</strong></p>${customer.name ? `<p><span>Recipient</span><strong>${escapeHtml(customer.name)}${customer.phone ? ` · ${escapeHtml(customer.phone)}` : ''}</strong></p>` : ''}${customer.notes ? `<p><span>Note for the bakery</span><strong>${escapeHtml(customer.notes)}</strong></p>` : ''}</section><section class="account-order-detail-section"><h3>Payment</h3><p><span>Method</span><strong>${escapeHtml(method)}</strong></p><p><span>Status</span><strong class="account-payment-state">${escapeHtml(paymentState)}</strong></p></section>${tracking ? `<section class="account-order-detail-section"><h3>Order updates</h3><ol class="account-order-detail-timeline">${tracking}</ol></section>` : ''}`;
    if (typeof orderDialog.showModal === 'function') orderDialog.showModal();
    else orderDialog.setAttribute('open', '');
  }
  document.getElementById('pastOrders').addEventListener('click', (event) => {
    const row = event.target.closest('[data-account-order-index]');
    if (!row) return;
    const order = accountOrdersForDialog[Number(row.dataset.accountOrderIndex)];
    if (order) openAccountOrder(order);
  });
  document.getElementById('closeAccountOrderDialog').addEventListener('click', () => orderDialog.close());
  orderDialog.addEventListener('click', (event) => { if (event.target === orderDialog) orderDialog.close(); });

  document.getElementById('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const changes = { name: form.elements.name.value, phone: form.elements.phone.value, dateOfBirth: form.elements.dateOfBirth.value };
      if (pendingAvatar !== null) changes.avatar = pendingAvatar;
      const result = await api('/auth/profile', { method: 'PUT', body: JSON.stringify(changes) });
      const savedUser = { ...(accountUser() || {}), ...result.user };
      localStorage.setItem('user', JSON.stringify(savedUser));
      document.getElementById('accountWelcome').textContent = `Hello, ${result.user.name}`;
      const avatarMarkup = result.user.avatar ? `<img src="${escapeHtml(result.user.avatar)}" alt="">` : escapeHtml(result.user.name.charAt(0).toUpperCase());
      document.getElementById('accountAvatar').innerHTML = avatarMarkup;
      document.getElementById('profileAvatarPreview').innerHTML = avatarMarkup;
      pendingAvatar = null;
      document.getElementById('avatarFile').value = '';
      showMessage('profileMessage', 'Your profile has been updated.');
    } catch (error) { showMessage('profileMessage', error.message, true); }
  });

  document.getElementById('passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      if (form.elements.newPassword.value !== form.elements.confirmPassword.value) throw new Error('Your new passwords do not match.');
      await api('/auth/profile', { method: 'PUT', body: JSON.stringify({ currentPassword: form.elements.currentPassword.value, newPassword: form.elements.newPassword.value }) });
      form.reset();
      showMessage('profileMessage', 'Password updated successfully.');
    } catch (error) { showMessage('profileMessage', error.message, true); }
  });

  document.getElementById('addressForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const data = await api('/auth/account/addresses', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      form.reset();
      renderAddresses(data.addresses || []);
      showMessage('addressMessage', data.message || 'Address saved.');
    } catch (error) { showMessage('addressMessage', error.message, true); }
  });

  document.getElementById('savedAddresses').addEventListener('click', async (event) => {
    const useButton = event.target.closest('[data-use-address]');
    if (useButton) {
      try {
        const data = await api('/auth/account');
        const address = data.user.savedAddresses.find((item) => String(item._id) === useButton.dataset.useAddress);
        if (!address) throw new Error('That saved address is no longer available.');
        sessionStorage.setItem('checkoutAddress', JSON.stringify({ name: address.recipientName || '', phone: address.phone || '', address: address.address, area: address.area, city: address.city, postalCode: address.postalCode }));
        window.location.href = 'index.html#shop';
      } catch (error) { showMessage('addressMessage', error.message, true); }
      return;
    }
    const button = event.target.closest('[data-delete-address]');
    if (!button) return;
    try {
      const data = await api(`/auth/account/addresses/${encodeURIComponent(button.dataset.deleteAddress)}`, { method: 'DELETE' });
      renderAddresses(data.addresses || []);
      showMessage('addressMessage', 'Address removed.');
    } catch (error) { showMessage('addressMessage', error.message, true); }
  });

  document.getElementById('favoriteCakes').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove-favorite]');
    if (!button) return;
    try {
      const productId = button.dataset.removeFavorite;
      await api(`/auth/account/favorites/${encodeURIComponent(productId)}`, { method: 'PUT' });
      try { const saved = JSON.parse(localStorage.getItem('cakeWishlist') || '[]'); localStorage.setItem('cakeWishlist', JSON.stringify((Array.isArray(saved) ? saved : []).filter((id) => id !== productId))); } catch { /* account wishlist removal has already completed */ }
      await loadPage();
    }
    catch (error) { showMessage('pageMessage', error.message, true); }
  });

  document.getElementById('giftCardForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = document.getElementById('giftCardCode').value.trim();
    try {
      const response = await fetch(`${window.CAKES_API_BASE || '/api'}/commerce/gift-cards/claim`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify({ code }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not redeem this gift card.');
      showMessage('giftCardMessage', result.message);
      const wallet = await fetch(`${window.CAKES_API_BASE || '/api'}/commerce/gift-wallet`, { headers: { Authorization: `Bearer ${token()}` } });
      const walletData = await wallet.json();
      if (!wallet.ok) throw new Error(walletData.message || 'The card was redeemed, but the wallet activity could not be refreshed. Reload your account to see the new balance.');
      renderGiftWallet(walletData);
    } catch (error) { showMessage('giftCardMessage', error.message, true); }
  });

  document.getElementById('copyReferralCode').addEventListener('click', async () => {
    const code = document.getElementById('referralCode').textContent;
    try { await navigator.clipboard.writeText(code); showMessage('pageMessage', 'Referral code copied.'); }
    catch { showMessage('pageMessage', `Your referral code is ${code}`); }
  });

  document.getElementById('logoutButton').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('index.html#home');
  });

  loadPage();
})();
