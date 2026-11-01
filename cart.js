(() => {
  const freshPhotoUrl = (value) => {
    const url = String(value || '');
    if (!/^\/?(?:public\/)?images\//.test(url)) return url;
    const clean = url.replace(/([?&])v=[^&]*/g, '').replace(/[?&]$/, '');
    return `${clean}${clean.includes('?') ? '&' : '?'}v=20261101-real`;
  };
  const API = window.CAKES_API_BASE || '/api';
  const token = () => localStorage.getItem('token');
  const user = () => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } };
  if (!token()) {
    sessionStorage.setItem('returnTo', 'checkout.html#checkout');
    window.location.replace('login.html');
    return;
  }
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const message = document.getElementById('cartPageMessage');
  const form = document.getElementById('cartCheckoutForm');
  const linesNode = document.getElementById('cartLines');
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
  const readCart = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(window.CakeCart?.key() || 'cakeBasket') || '[]');
      return Array.isArray(saved) ? saved.filter((line) => line && typeof line.productId === 'string' && Number.isInteger(Number(line.quantity)) && Number(line.quantity) > 0) : [];
    } catch { return []; }
  };
  const cart = readCart();
  let products = [];
  let account = null;
  let deliveryFee = 0;
  let deliveryValid = false;
  let deliveryTimer;
  let deliverySequence = 0;
  let discount = 0;
  let discountCode = '';
  let giftBalance = 0;
  let giftCode = '';

  const setMessage = (text, isError = false) => {
    message.textContent = text;
    message.classList.toggle('is-error', isError);
  };
  function showOrderSuccess(order, note = '') {
    sessionStorage.setItem('lastOrderConfirmation', JSON.stringify({ ...order, confirmationNote: note }));
    window.location.assign('order-confirmation.html');
  }
  const successDialog = document.getElementById('orderSuccess');
  successDialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || successDialog.hidden) return;
    const focusable = [...successDialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter((element) => !element.hidden && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
    if (!focusable.length) {
      event.preventDefault();
      document.getElementById('orderSuccessTitle').focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const title = document.getElementById('orderSuccessTitle');
    if (!successDialog.contains(document.activeElement) || (event.shiftKey && (document.activeElement === first || document.activeElement === title))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    if (token()) headers.Authorization = `Bearer ${token()}`;
    let response;
    try { response = await fetch(`${API}${path}`, { ...options, headers }); }
    catch (error) {
      if (error instanceof TypeError) throw new Error(`Cannot reach the bakery API at ${API}. Start the backend or set its deployed URL in api-config.js.`);
      throw error;
    }
    let data = {};
    try { data = await response.json(); } catch { /* the status below explains an empty response */ }
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
    return data;
  }
  const saveCart = () => {
    localStorage.setItem(window.CakeCart?.key() || 'cakeBasket', JSON.stringify(cart));
    window.CakeCart?.saveAccountCart(cart);
    const count = cart.reduce((sum, line) => sum + line.quantity, 0);
    document.getElementById('cartPageCount').textContent = String(count);
    for (const id of ['navCartCount', 'shopCartCount', 'accountCartCount', 'settingsCartCount']) {
      const badge = document.getElementById(id);
      if (badge) badge.textContent = String(count);
    }
    const navCart = document.getElementById('navCartLink');
    if (navCart) navCart.setAttribute('aria-label', `Cart, ${count} item${count === 1 ? '' : 's'}`);
  };
  const subtotal = () => cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const loyaltyRedemption = () => {
    const input = document.getElementById('loyaltyPointsToRedeem');
    const discounted = Math.max(0, subtotal() - discount);
    const pointsLimit = Math.floor(Math.min(Number(account?.user?.loyaltyPoints || 0), Math.floor(discounted * .2) * 100) / 100) * 100;
    const points = Math.min(Math.floor((Number(input.value) || 0) / 100) * 100, pointsLimit);
    return { points, amount: points / 100, pointsLimit };
  };
  const total = () => {
    const discounted = Math.max(0, subtotal() - discount);
    const pointsDiscount = loyaltyRedemption().amount;
    const afterGiftCard = Math.max(0, discounted + (deliveryValid ? deliveryFee : 0) - pointsDiscount - Math.min(giftBalance, discounted + (deliveryValid ? deliveryFee : 0) - pointsDiscount));
    const walletUsed = Math.min(Math.max(0, Math.floor(Number(document.getElementById('giftWalletToRedeem').value) || 0)), account?.user?.giftWalletBalance || 0, afterGiftCard);
    return Math.max(0, afterGiftCard - walletUsed);
  };
  function renderCart() {
    saveCart();
    document.getElementById('cartEmptyState').hidden = Boolean(cart.length);
    document.getElementById('checkoutSubtotal').textContent = money(subtotal());
    document.getElementById('checkoutDelivery').textContent = deliveryValid ? money(deliveryFee) : 'To be calculated';
    document.getElementById('checkoutDiscount').textContent = `−${money(discount)}`;
    const discounted = Math.max(0, subtotal() - discount);
    const beforeBenefits = discounted + (deliveryValid ? deliveryFee : 0);
    const points = loyaltyRedemption();
    const giftUsed = Math.min(giftBalance, Math.max(0, beforeBenefits - points.amount));
    document.getElementById('checkoutGift').textContent = `−${money(giftUsed)}`;
    document.getElementById('checkoutPoints').textContent = `−${money(points.amount)} · ${points.points.toLocaleString('en-IN')} pts`;
    const pointsInput = document.getElementById('loyaltyPointsToRedeem');
    pointsInput.max = String(points.pointsLimit);
    pointsInput.value = String(points.points);
    const afterGiftCard = Math.max(0, beforeBenefits - points.amount - giftUsed);
    const walletInput = document.getElementById('giftWalletToRedeem');
    const walletUsed = Math.min(Math.max(0, Math.floor(Number(walletInput.value) || 0)), account?.user?.giftWalletBalance || 0, afterGiftCard);
    walletInput.max = String(Math.min(account?.user?.giftWalletBalance || 0, afterGiftCard));
    walletInput.value = String(walletUsed);
    document.getElementById('checkoutWallet').textContent = `−${money(walletUsed)}`;
    document.getElementById('checkoutTotal').textContent = money(total());
    document.getElementById('emptyCartShop').hidden = Boolean(cart.length);
    if (!cart.length) {
      linesNode.innerHTML = '<p class="empty-account">Your cart is empty. Browse the catalogue and add a cake to get started.</p>';
      document.getElementById('cartCheckoutSection').hidden = true;
      return;
    }
    linesNode.innerHTML = cart.map((line, index) => {
      const product = products.find((item) => item.id === line.productId);
      return `<article class="checkout-cart-line"><img src="${escapeHtml(freshPhotoUrl(product?.image || line.image || ''))}" alt="${escapeHtml(line.name)}"><div class="checkout-cart-line-details"><h3>${escapeHtml(line.name)}</h3><p>${escapeHtml(line.flavor)} · ${escapeHtml(line.size)}</p>${line.cakeMessage ? `<small class="cart-cake-message">Cake message: “${escapeHtml(line.cakeMessage)}”</small>` : ''}</div><div class="cart-page-line-actions"><button type="button" data-cart-action="decrease" data-index="${index}" aria-label="Remove one ${escapeHtml(line.name)}">−</button><output>${line.quantity}</output><button type="button" data-cart-action="increase" data-index="${index}" aria-label="Add one ${escapeHtml(line.name)}">+</button></div><strong class="cart-page-line-price">${money(line.price * line.quantity)}</strong><button type="button" class="remove-cart-item" data-cart-action="remove" data-index="${index}" aria-label="Remove ${escapeHtml(line.name)} from order">×</button></article>`;
    }).join('');
  }
  function setDeliveryMode() {
    const pickup = form.elements.deliveryType.value === 'pickup';
    syncPaymentChoices();
    const deliveryFields = document.getElementById('cartDeliveryFields');
    deliveryFields.hidden = pickup;
    for (const name of ['area', 'city', 'postalCode', 'address']) form.elements[name].required = !pickup;
    if (pickup) {
      deliverySequence += 1;
      clearTimeout(deliveryTimer);
      deliveryFee = 0;
      deliveryValid = true;
      document.getElementById('deliveryQuoteMessage').textContent = 'Bakery pickup is free.';
    } else {
      deliveryValid = false;
      deliveryFee = 0;
      quoteDelivery();
    }
    renderCart();
  }
  function syncPaymentChoices() {
    const pickup = form.elements.deliveryType.value === 'pickup';
    const select = form.elements.paymentMethod;
    const pickupOption = [...select.options].find((option) => option.value === 'pay-at-pickup');
    const deliveryOption = [...select.options].find((option) => option.value === 'pay-on-delivery');
    pickupOption.hidden = !pickup;
    pickupOption.disabled = !pickup;
    deliveryOption.hidden = pickup;
    deliveryOption.disabled = pickup;
    if (select.selectedOptions[0]?.disabled) select.value = pickup ? 'pay-at-pickup' : 'pay-on-delivery';
  }
  function quoteDelivery() {
    const sequence = ++deliverySequence;
    clearTimeout(deliveryTimer);
    deliveryValid = false;
    deliveryFee = 0;
    const { area, city, postalCode } = form.elements;
    const pin = postalCode.value.trim();
    if (form.elements.deliveryType.value !== 'delivery' || !/^\d{6}$/.test(pin) || !area.value.trim() || !city.value.trim()) {
      document.getElementById('deliveryQuoteMessage').textContent = 'Enter your area, city, and 6-digit PIN code to calculate delivery.';
      renderCart();
      return;
    }
    document.getElementById('deliveryQuoteMessage').textContent = 'Calculating approximate driving distance and delivery fee…';
    deliveryTimer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ type: 'delivery', area: area.value.trim(), city: city.value.trim(), postalCode: pin });
        const quote = await api(`/delivery/quote?${params}`);
        if (sequence !== deliverySequence) return;
        deliveryFee = quote.fee;
        deliveryValid = true;
        document.getElementById('deliveryQuoteMessage').textContent = `${quote.distanceKm ? `Estimated driving distance ${quote.distanceKm} km · ` : ''}${deliveryFee ? `Delivery fee ${money(deliveryFee)}` : 'Free delivery'}${quote.distanceBand ? ` (${quote.distanceBand} band)` : ''}`;
      } catch (error) {
        if (sequence !== deliverySequence) return;
        document.getElementById('deliveryQuoteMessage').textContent = error.message;
      }
      renderCart();
    }, 400);
    renderCart();
  }
  function applyAddress(address) {
    if (!address) return;
    form.elements.deliveryType.value = 'delivery';
    form.elements.name.value = address.recipientName || account?.user?.name || '';
    for (const field of ['phone', 'address', 'area', 'city', 'postalCode']) if (address[field]) form.elements[field].value = address[field];
    setDeliveryMode();
  }
  async function loadAccount() {
    if (!token()) return;
    try {
      account = await api('/auth/account');
      form.elements.name.value = account.user.name || '';
      form.elements.email.value = account.user.email || '';
      form.elements.phone.value = account.user.phone || '';
      document.getElementById('loyaltyPointsToRedeem').max = account.user.loyaltyPoints || 0;
      document.getElementById('giftWalletToRedeem').max = account.user.giftWalletBalance || 0;
      document.getElementById('giftWalletAvailable').textContent = `${money(account.user.giftWalletBalance || 0)} available`;
      try {
        const pendingAddress = JSON.parse(sessionStorage.getItem('checkoutAddress') || 'null');
        if (pendingAddress && typeof pendingAddress === 'object') applyAddress(pendingAddress);
        sessionStorage.removeItem('checkoutAddress');
      } catch { sessionStorage.removeItem('checkoutAddress'); }
      const addresses = account.user.savedAddresses || [];
      if (addresses.length) {
        const wrap = document.getElementById('savedAddressField');
        const select = document.getElementById('savedAddressSelect');
        wrap.hidden = false;
        select.innerHTML = '<option value="">Enter a new address</option>' + addresses.map((address, index) => `<option value="${index}">${escapeHtml(address.label || address.area)} · ${escapeHtml(address.city)} (${escapeHtml(address.postalCode)})</option>`).join('');
        select.addEventListener('change', () => { if (select.value !== '') applyAddress(addresses[Number(select.value)]); });
      }
    } catch (error) { setMessage(error.message, true); }
  }
  async function loadRazorpay() {
    if (window.Razorpay) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Unable to load the secure payment window.'));
      document.head.appendChild(script);
    });
  }
  async function startPayment(payment, order) {
    const orderNumber = order.orderNumber;
    await loadRazorpay();
    const currentUser = user() || {};
    const checkout = new window.Razorpay({
      key: payment.keyId, amount: payment.amount, currency: payment.currency,
      name: 'Cakes of Paradise', description: `Cake order ${orderNumber}`, order_id: payment.orderId,
      prefill: { name: currentUser.name || '', email: currentUser.email || '' }, theme: { color: '#80503d' },
      handler: async (response) => {
        try {
          await api(`/orders/${encodeURIComponent(orderNumber)}/payment/verify`, { method: 'POST', body: JSON.stringify(response) });
          showOrderSuccess(order);
        } catch (error) { setMessage(`${error.message} Your order ${orderNumber} remains available in Your orders.`, true); }
      },
      modal: { ondismiss: () => setMessage(`Checkout closed. You can finish payment for ${orderNumber} from Your orders.`) },
    });
    checkout.on('payment.failed', (response) => setMessage(response.error?.description || 'Payment failed. You can retry from Your orders.', true));
    checkout.open();
  }
  linesNode.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cart-action]');
    if (!button) return;
    const index = Number(button.dataset.index);
    if (!cart[index]) return;
    if (button.dataset.cartAction === 'increase') cart[index].quantity = Math.min(10, cart[index].quantity + 1);
    if (button.dataset.cartAction === 'decrease') cart[index].quantity -= 1;
    const line = cart[index];
    const removingLine = button.dataset.cartAction === 'remove' || (button.dataset.cartAction === 'decrease' && Number(line.quantity) <= 1);
    if (button.dataset.cartAction === 'remove' || line.quantity < 1) cart.splice(index, 1);
    renderCart();
    if (removingLine) showRemovalToast(line.name);
  });
  form.elements.deliveryType.addEventListener('change', setDeliveryMode);
  for (const name of ['area', 'city', 'postalCode']) form.elements[name].addEventListener('input', quoteDelivery);
  document.getElementById('applyPromo').addEventListener('click', async () => {
    try {
      const result = await api('/commerce/promotions/validate', { method: 'POST', body: JSON.stringify({ code: document.getElementById('promoCode').value, subtotal: subtotal() }) });
      discount = result.discount;
      discountCode = document.getElementById('promoCode').value.trim();
      document.getElementById('benefitMessage').textContent = result.referral ? result.message : `${result.code} applied · ${money(discount)} off`;
    } catch (error) { discount = 0; discountCode = ''; document.getElementById('benefitMessage').textContent = error.message; }
    renderCart();
  });
  document.getElementById('applyGiftCard').addEventListener('click', async () => {
    try {
      const code = document.getElementById('giftCardCode').value.trim();
      const result = await api('/commerce/gift-cards/check', { method: 'POST', body: JSON.stringify({ code }) });
      giftBalance = result.active ? result.balance : 0;
      giftCode = giftBalance ? code : '';
      document.getElementById('benefitMessage').textContent = `${result.active ? 'Gift card active' : 'Gift card expired or inactive'} · ${money(result.balance)} balance`;
      document.getElementById('giftCardHistory').innerHTML = result.transactions?.length ? result.transactions.map((item) => `<p>${escapeHtml(item.type)} · ${money(item.amount)} · balance ${money(item.balanceAfter)}${item.orderNumber ? ` · ${escapeHtml(item.orderNumber)}` : ''}</p>`).join('') : '';
    } catch (error) { giftBalance = 0; giftCode = ''; document.getElementById('benefitMessage').textContent = error.message; }
    renderCart();
  });
  document.getElementById('loyaltyPointsToRedeem').addEventListener('input', renderCart);
  document.getElementById('giftWalletToRedeem').addEventListener('input', renderCart);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!token()) { setMessage('Please sign in before placing your order.'); sessionStorage.setItem('returnTo', 'checkout.html#checkout'); window.location.href = 'login.html'; return; }
    if (!cart.length) { setMessage('Your cart is empty.', true); return; }
    if (form.elements.deliveryType.value === 'delivery' && !deliveryValid) { setMessage('Enter your delivery area and PIN code and wait for the delivery estimate.', true); return; }
    const button = document.getElementById('placeOrderButton');
    const fields = new FormData(form);
    button.disabled = true;
    button.textContent = 'Placing your order…';
    try {
      const data = await api('/orders', { method: 'POST', body: JSON.stringify({
        items: cart.map(({ productId, size, flavor, cakeMessage, quantity }) => ({ productId, size, flavor, cakeMessage, quantity })),
        paymentMethod: fields.get('paymentMethod'), promoCode: discountCode, giftCardCode: giftCode,
        loyaltyPoints: Number(fields.get('loyaltyPointsToRedeem')) || 0,
        giftWalletAmount: Number(fields.get('giftWalletToRedeem')) || 0,
        customer: { name: fields.get('name'), phone: fields.get('phone'), deliveryType: fields.get('deliveryType'), address: [fields.get('address'), fields.get('addressLine2')].filter(Boolean).join(', '), area: fields.get('area'), city: fields.get('city'), postalCode: fields.get('postalCode'), deliveryDate: fields.get('deliveryDate'), deliveryTime: fields.get('deliveryTime'), notes: fields.get('notes') },
      }) });
      let addressNotice = '';
      if (fields.get('deliveryType') === 'delivery' && fields.get('saveAddress') === 'yes') {
        try { await api('/auth/account/addresses', { method: 'POST', body: JSON.stringify({ label: fields.get('area'), recipientName: fields.get('name'), phone: fields.get('phone'), address: [fields.get('address'), fields.get('addressLine2')].filter(Boolean).join(', '), area: fields.get('area'), city: fields.get('city'), postalCode: fields.get('postalCode') }) }); addressNotice = ' Delivery address saved to your account.'; }
        catch (error) { addressNotice = ` Order placed, but the address could not be saved: ${error.message}`; }
      }
      cart.splice(0, cart.length);
      localStorage.setItem(window.CakeCart?.key() || 'cakeBasket', '[]');
      discount = 0; discountCode = ''; giftBalance = 0; giftCode = '';
      renderCart();
      try { await window.CakeCart?.saveAccountCart(cart); }
      catch (error) { addressNotice += ` Your order is placed, but the saved cart could not be cleared: ${error.message}`; }
      form.reset();
      document.getElementById('cartCheckoutSection').hidden = true;
      if (data.payment) {
        try { await startPayment(data.payment, data.order.orderNumber); }
        catch (error) { setMessage(`${error.message} Order ${data.order.orderNumber} is saved. Visit Your orders to retry payment.`, true); }
      } else showOrderSuccess(data.order, addressNotice);
    } catch (error) { setMessage(error.message, true); }
    finally { button.disabled = false; button.innerHTML = 'Continue to payment <span aria-hidden="true">→</span>'; }
  });
  document.getElementById('cartSignOut').addEventListener('click', () => {
    localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.replace('index.html#home');
  });

  const userData = user();
  if (userData?.name) form.elements.name.value = userData.name;
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  form.elements.deliveryDate.min = new Date(minDate.getTime() - minDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  Promise.all([
    api('/catalog').then((data) => { products = data.products || []; }),
    window.CakeCart?.loadAccountCart ? window.CakeCart.loadAccountCart().then((saved) => { cart.splice(0, cart.length, ...saved); }) : Promise.resolve(),
    loadAccount(),
  ]).then(() => {
    for (let index = cart.length - 1; index >= 0; index -= 1) {
      const line = cart[index];
      const product = products.find((item) => item.id === line.productId && item.available !== false);
      const size = product?.sizes.find((item) => item.name === line.size);
      if (!product || !size || !product.flavors.includes(line.flavor)) { cart.splice(index, 1); continue; }
      line.name = product.name; line.price = size.price; line.image = product.image;
    }
    renderCart();
    if (cart.length && account?.user?.referralCodeUsed && !(account.orders || []).length) {
      const benefitMessage = document.getElementById('benefitMessage');
      if (benefitMessage) benefitMessage.textContent = `Referral linked. You will receive ${account.referralPolicy?.referralFriendPoints ?? 50} bonus points and your friend ${account.referralPolicy?.referralOwnerPoints ?? 100} points after your first paid order is completed.`;
    }
  }).catch((error) => setMessage(error.message, true)).finally(() => {
    if (window.location.hash === '#checkout' && cart.length) {
      const reduceMotion = document.documentElement.dataset.reduceMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('cartCheckoutSection').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  });
})();
