(() => {
  const form = document.getElementById('giftPurchaseForm');
  const offersNode = document.getElementById('giftCardOffers');
  if (!form || !offersNode) return;

  const selectedName = document.getElementById('giftSelectedName');
  const selectedAmount = document.getElementById('giftSelectedAmount');
  const message = document.getElementById('giftFormMessage');
  const submitButton = form.querySelector('.gift-submit');
  const API = window.CAKES_API_BASE || '/api';
  const token = () => localStorage.getItem('token') || '';
  const redirectToGiftSignIn = () => {
    try {
      sessionStorage.setItem('giftCardPendingCheckout', JSON.stringify({ offerId: selectedOffer?._id || '', recipientName: form.elements.recipientName.value, recipientEmail: form.elements.recipientEmail.value, message: form.elements.message.value }));
      sessionStorage.setItem('returnTo', 'gift-cards.html');
    } catch {}
    window.location.href = 'login.html';
  };
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const designDetails = {
    'sweet-moments': { className: 'rose-art', emblem: '❀', subtitle: 'Sweet Moments', motif: 'A little sweetness' },
    'cake-love': { className: 'blush-art', emblem: '♡', subtitle: 'Cake Love', motif: 'Made with love' },
    'birthday-bliss': { className: 'blue-art', emblem: '🎂', subtitle: 'Birthday Bliss', motif: 'Make a wish' },
    'just-because': { className: 'lavender-art', emblem: '✧', subtitle: 'Just Because', motif: 'For no reason at all' },
    'with-love': { className: 'rose-art', emblem: '♡', subtitle: 'With Love', motif: 'A note from the heart' },
    'special-treat': { className: 'peach-art', emblem: '✦', subtitle: 'A Special Treat', motif: 'A little something special' },
  };
  let offers = [];
  let selectedOffer = null;
  let retryOrder = null;
  let retryPayment = null;
  let retryWalletPurchaseId = '';
  let walletBalance = null;
  let walletNeedsSignIn = !token();
  const selectedPayment = () => form.elements.paymentMethod.value || 'razorpay';
  const refreshPayButton = () => {
    if (!selectedOffer || retryOrder || retryWalletPurchaseId) return;
    const wallet = selectedPayment() === 'wallet';
    const enough = wallet && walletBalance !== null && walletBalance >= Number(selectedOffer.price);
    submitButton.disabled = wallet ? !enough : false;
    submitButton.innerHTML = wallet
      ? `<span aria-hidden="true">♡</span> Pay with gift wallet · <strong>${money(selectedOffer.price)}</strong>`
      : `<span aria-hidden="true">♡</span> Pay securely with Razorpay · <strong>${money(selectedOffer.price)}</strong>`;
    if (wallet && walletBalance !== null && !enough) {
      message.textContent = `Your gift wallet has ${money(walletBalance)}. This card costs ${money(selectedOffer.price)}. Redeem a gift code in your account or choose Razorpay.`;
      message.classList.add('gift-info');
    } else if (wallet && enough && message.classList.contains('gift-info')) {
      message.textContent = '';
      message.classList.remove('gift-info');
    }
  };
  const clearRecipientFields = () => {
    form.elements.recipientName.value = '';
    form.elements.recipientEmail.value = '';
    form.elements.message.value = '';
    const count = form.querySelector('.gift-count');
    if (count) count.textContent = '0 / 200';
    refreshPayButton();
  };

  const renderOffers = () => {
    if (!offers.length) {
      offersNode.innerHTML = '<p class="gift-offer-empty">No gift cards are available right now. Please check back soon.</p>';
      submitButton.disabled = true;
      selectedName.textContent = 'No cards available';
      selectedAmount.textContent = '—';
      submitButton.innerHTML = '<span aria-hidden="true">♧</span> Gift cards are currently unavailable';
      return;
    }
    offersNode.innerHTML = offers.map((offer) => {
      const design = designDetails[offer.design] || designDetails['sweet-moments'];
      const selected = selectedOffer?._id === offer._id;
      const price = Number(offer.price);
      const tier = price >= 2500 ? 'grand' : price >= 1500 ? 'celebration' : price >= 1000 ? 'special' : 'little';
      return `<button type="button" class="gift-design gift-tier-${tier} ${selected ? 'selected' : ''}" data-offer-id="${escapeHtml(offer._id)}" role="radio" aria-checked="${selected}" aria-label="${escapeHtml(offer.name)}, ${money(offer.price)}"><span class="gift-art ${design.className}" data-motif="${escapeHtml(design.motif)}"><b>Cakes of<br>Paradise</b><i>Gift Card</i><em aria-hidden="true">${design.emblem}</em><strong class="gift-face-value">${money(offer.price)}</strong><small>${escapeHtml(design.subtitle)}</small></span><strong>${escapeHtml(offer.name)}</strong><span class="gift-offer-price">${money(offer.price)} <small>· one year validity</small></span></button>`;
    }).join('');
    if (selectedOffer) {
      selectedName.textContent = selectedOffer.name;
      selectedAmount.textContent = money(selectedOffer.price);
      refreshPayButton();
    }
  };

  offersNode.addEventListener('click', (event) => {
    const button = event.target.closest('[data-offer-id]');
    if (!button) return;
    selectedOffer = offers.find((offer) => offer._id === button.dataset.offerId) || null;
    message.textContent = '';
    renderOffers();
  });
  form.elements.message.addEventListener('input', (event) => {
    form.querySelector('.gift-count').textContent = `${event.target.value.length} / 200`;
  });
  form.addEventListener('change', (event) => {
    if (event.target.name === 'paymentMethod') {
      message.textContent = '';
      message.classList.remove('gift-info');
      if (event.target.value === 'razorpay') {
        try { sessionStorage.removeItem('giftCardPendingCheckout'); } catch {}
      }
      if (event.target.value === 'wallet' && (!token() || walletNeedsSignIn)) {
        redirectToGiftSignIn();
        return;
      }
      refreshPayButton();
    }
  });

  const loadGiftWallet = async () => {
    const hint = document.getElementById('giftWalletHint');
    const walletInput = form.querySelector('input[value="wallet"]');
    if (!token()) { walletNeedsSignIn = true; hint.textContent = 'Select to sign in and pay from your gift wallet'; return; }
    try {
      const response = await fetch(`${API}/commerce/gift-wallet`, { headers: { Authorization: `Bearer ${token()}` }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Sign in again to use your balance.');
      walletNeedsSignIn = false;
      walletBalance = Number(data.balance || 0);
      hint.textContent = `${money(walletBalance)} available`;
      walletInput.disabled = false;
      refreshPayButton();
    } catch {
      walletBalance = null;
      walletNeedsSignIn = true;
      walletInput.disabled = false;
      hint.textContent = 'Select to sign in and use your gift wallet';
      if (selectedPayment() === 'wallet') redirectToGiftSignIn();
    }
  };

  const restorePendingGiftCheckout = () => {
    try {
      const pending = JSON.parse(sessionStorage.getItem('giftCardPendingCheckout') || 'null');
      if (!pending) return;
      selectedOffer = offers.find((offer) => offer._id === pending.offerId) || selectedOffer;
      form.elements.recipientName.value = pending.recipientName || '';
      form.elements.recipientEmail.value = pending.recipientEmail || '';
      form.elements.message.value = pending.message || '';
      form.querySelector('.gift-count').textContent = `${form.elements.message.value.length} / 200`;
      if (!token()) {
        form.querySelector('input[name="paymentMethod"][value="razorpay"]').checked = true;
        form.querySelector('input[name="paymentMethod"][value="wallet"]').checked = false;
        message.textContent = 'Sign in to use your gift wallet. Select Gift wallet to sign in, or choose Razorpay.';
        message.classList.add('gift-info');
        return;
      }
      form.querySelector('input[name="paymentMethod"][value="wallet"]').checked = true;
      sessionStorage.removeItem('giftCardPendingCheckout');
      message.textContent = 'Welcome back. Your gift details are ready.';
      message.classList.add('gift-info');
    } catch {}
  };

  const loadOffers = async () => {
    try {
      const response = await fetch(`${API}/commerce/gift-card-offers`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load gift cards. Please try again.');
      offers = Array.isArray(data.offers) ? data.offers : [];
      selectedOffer = offers[0] || null;
      restorePendingGiftCheckout();
      renderOffers();
    } catch (error) {
      offersNode.innerHTML = `<p class="gift-offer-empty gift-error">${escapeHtml(error.message || 'Could not load gift cards.')}</p>`;
      submitButton.disabled = true;
      selectedName.textContent = 'Could not load cards';
      selectedAmount.textContent = '—';
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    message.textContent = '';
    message.classList.remove('gift-info');
    if (retryOrder && retryPayment) {
      await verifyGiftCardPayment(retryOrder, retryPayment);
      return;
    }
    if (retryWalletPurchaseId) { await retryWalletDelivery(retryWalletPurchaseId); return; }
    if (!form.reportValidity()) return;
    if (!selectedOffer) { message.textContent = 'Choose one of the available gift cards first.'; return; }
    const paymentMethod = selectedPayment();
    if (paymentMethod === 'razorpay') { try { sessionStorage.removeItem('giftCardPendingCheckout'); } catch {} }
    if (paymentMethod === 'wallet') {
      if (!token()) { message.textContent = 'Sign in to pay using your account balance.'; return; }
      if (walletBalance === null || walletBalance < Number(selectedOffer.price)) { message.textContent = 'Your gift wallet balance is not enough. Choose UPI or add funds to your wallet.'; return; }
      await purchaseWithWallet();
      return;
    }
    if (!window.Razorpay) { message.textContent = 'Secure checkout could not load. Check your connection and try again.'; return; }
    submitButton.disabled = true;
    submitButton.textContent = 'Preparing secure checkout…';
    try {
      const response = await fetch(`${API}/commerce/gift-cards/purchase`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: selectedOffer._id, recipientName: form.elements.recipientName.value, recipientEmail: form.elements.recipientEmail.value, message: form.elements.message.value }),
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order.message || 'Could not start checkout.');
      const checkout = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency, order_id: order.orderId,
        name: 'Cakes of Paradise', description: `${order.offerName} · ${money(order.amount / 100)}`, prefill: { email: form.elements.recipientEmail.value },
        theme: { color: '#d99b98' },
        handler: async (payment) => {
          retryOrder = order;
          retryPayment = payment;
          await verifyGiftCardPayment(order, payment);
        },
        modal: { ondismiss: () => { submitButton.disabled = false; renderOffers(); } },
      });
      checkout.on('payment.failed', (result) => {
        submitButton.disabled = false;
        renderOffers();
        showPaymentFailure(result.error?.description || 'Your payment could not be completed.');
      });
      checkout.open();
    } catch (error) {
      message.textContent = error.message || 'Could not start checkout. Please try again.';
      submitButton.disabled = false;
      renderOffers();
    }
  });

  async function verifyGiftCardPayment(order, payment) {
    submitButton.disabled = true;
    submitButton.textContent = 'Confirming your payment…';
    try {
      const verified = await fetch(`${API}/commerce/gift-cards/purchase/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purchaseId: order.purchaseId, ...payment }) });
      const result = await verified.json();
      if (result.paymentRejected) {
        retryOrder = null;
        retryPayment = null;
        message.textContent = result.message || 'Gift cards can only be paid with UPI or account balance.';
        submitButton.disabled = false;
        refreshPayButton();
        return;
      }
      if (!verified.ok) {
        if (result.paymentFailed) {
          retryOrder = null;
          retryPayment = null;
          submitButton.disabled = false;
          refreshPayButton();
          showPaymentFailure(result.message || 'Razorpay could not complete this payment.');
          return;
        }
        if (result.paid || result.deliveryPending) {
          submitButton.disabled = false;
          submitButton.textContent = 'Retry gift card email';
          showDeliveryPending(result.message || 'Payment was received, but the gift email is still pending.', () => verifyGiftCardPayment(order, payment));
          return;
        }
        if (result.paymentPending) {
          submitButton.disabled = false;
          submitButton.textContent = 'Check payment status';
          showVerificationPending(result.message, () => verifyGiftCardPayment(order, payment));
          return;
        }
        throw new Error(result.message || 'Payment verification could not be completed.');
      }
      retryOrder = null;
      retryPayment = null;
      showSuccess(result.recipientEmail, order.offerName);
    } catch (error) {
      submitButton.disabled = false;
      submitButton.textContent = 'Check payment status';
      showVerificationPending(error.message || 'We could not confirm payment and email delivery yet.', () => verifyGiftCardPayment(order, payment));
    }
  }

  async function purchaseWithWallet() {
    submitButton.disabled = true;
    submitButton.textContent = 'Using your account balance…';
    try {
      const response = await fetch(`${API}/commerce/gift-cards/purchase/wallet`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ offerId: selectedOffer._id, recipientName: form.elements.recipientName.value, recipientEmail: form.elements.recipientEmail.value, message: form.elements.message.value }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.purchaseId && result.paid) {
          retryWalletPurchaseId = result.purchaseId;
          submitButton.disabled = false;
          submitButton.textContent = 'Retry gift card email';
          showDeliveryPending(result.message || 'Your payment was received, but the gift email is still pending.', () => retryWalletDelivery(retryWalletPurchaseId));
          return;
        }
        throw new Error(result.message || 'Could not complete the wallet purchase.');
      }
      walletBalance = Number(result.balance || 0);
      showSuccess(result.recipientEmail, selectedOffer?.name);
    } catch (error) {
      message.textContent = error.message || 'Could not complete the wallet purchase.';
      submitButton.disabled = false;
      if (!retryWalletPurchaseId) refreshPayButton();
    }
  }

  async function retryWalletDelivery(purchaseId) {
    submitButton.disabled = true;
    submitButton.textContent = 'Retrying gift card email…';
    try {
      const response = await fetch(`${API}/commerce/gift-cards/purchase/wallet/${encodeURIComponent(purchaseId)}/deliver`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Email delivery could not be completed.');
      retryWalletPurchaseId = '';
      showSuccess(result.recipientEmail, selectedOffer?.name);
    } catch (error) {
      submitButton.disabled = false;
      submitButton.textContent = 'Retry gift card email';
      showDeliveryPending(error.message || 'The gift email is still pending.', () => retryWalletDelivery(purchaseId));
    }
  }

  function showSuccess(recipientEmail, offerName) {
    retryOrder = null;
    retryPayment = null;
    retryWalletPurchaseId = '';
    let dialog = document.getElementById('giftPurchaseSuccessDialog');
    if (!dialog) {
      dialog = document.createElement('div');
      dialog.id = 'giftPurchaseSuccessDialog';
      dialog.className = 'gift-success-backdrop';
      dialog.setAttribute('role', 'presentation');
      dialog.innerHTML = `<section class="gift-success-dialog" role="dialog" aria-modal="true" aria-labelledby="giftSuccessTitle"><button class="gift-success-close" type="button" aria-label="Close confirmation">×</button><span class="gift-success-seal" aria-hidden="true">✓</span><p class="gift-success-kicker">A LITTLE JOY IS ON ITS WAY</p><h2 id="giftSuccessTitle">Gift card purchased</h2><p class="gift-success-copy"></p><p class="gift-success-code-note">The full gift card and its redeem code are delivered by email only. Enter that code under <strong>My Account → Gift wallet</strong> to add its value to the wallet.</p><div class="gift-success-actions"><a class="gift-success-account" href="account.html#gift-wallet">Go to gift wallet</a><button class="gift-success-done" type="button">Lovely, thank you</button></div></section>`;
      document.body.append(dialog);
      const close = () => { dialog.remove(); clearRecipientFields(); };
      dialog.addEventListener('click', (event) => { if (event.target === dialog || event.target.closest('.gift-success-close, .gift-success-done')) close(); });
      document.addEventListener('keydown', function onEscape(event) { if (event.key === 'Escape' && document.getElementById('giftPurchaseSuccessDialog')) { close(); document.removeEventListener('keydown', onEscape); } });
    }
    dialog.querySelector('.gift-success-copy').textContent = `Your payment is confirmed and ${offerName || 'your gift card'} is purchased. We’re sending the gift email to ${recipientEmail} now; it should arrive shortly.`;
    dialog.querySelector('.gift-success-account').textContent = token() ? 'View gift wallet' : 'Sign in to view gift wallet';
    dialog.querySelector('.gift-success-close').focus();
  }

  function showPaymentFailure(reason) {
    document.getElementById('giftPaymentFailureDialog')?.remove();
    const dialog = document.createElement('div');
    dialog.id = 'giftPaymentFailureDialog';
    dialog.className = 'gift-success-backdrop';
    dialog.innerHTML = `<section class="gift-payment-failure-dialog" role="dialog" aria-modal="true" aria-labelledby="giftPaymentFailureTitle"><button class="gift-failure-exit" type="button" aria-label="Exit payment">×</button><span class="gift-failure-seal" aria-hidden="true">!</span><p class="gift-success-kicker">PAYMENT NOT COMPLETED</p><h2 id="giftPaymentFailureTitle">Would you like to try again?</h2><p class="gift-success-copy"></p><p class="gift-success-code-note">No gift card has been issued and no redeem code has been sent. Gift cards are purchased only after Razorpay confirms payment.</p><div class="gift-success-actions"><button class="gift-failure-retry" type="button">Try payment again</button><button class="gift-failure-exit-action" type="button">Exit for now</button></div></section>`;
    document.body.append(dialog);
    dialog.querySelector('.gift-success-copy').textContent = reason;
    const exit = () => {
      dialog.remove();
      retryOrder = null;
      retryPayment = null;
      submitButton.disabled = false;
      refreshPayButton();
      clearRecipientFields();
      message.classList.remove('gift-info');
      message.textContent = 'Payment was not completed, so the gift card was not purchased. You can try again whenever you are ready.';
    };
    dialog.querySelectorAll('.gift-failure-exit, .gift-failure-exit-action').forEach((button) => button.addEventListener('click', exit));
    dialog.querySelector('.gift-failure-retry').addEventListener('click', () => {
      dialog.remove();
      message.textContent = '';
      message.classList.remove('gift-info');
      form.requestSubmit();
    });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) exit(); });
    document.addEventListener('keydown', function onEscape(event) { if (event.key === 'Escape' && document.getElementById('giftPaymentFailureDialog')) { exit(); document.removeEventListener('keydown', onEscape); } });
    dialog.querySelector('.gift-failure-retry').focus();
  }

  function showDeliveryPending(reason, retry) {
    document.getElementById('giftDeliveryPendingDialog')?.remove();
    const dialog = document.createElement('div');
    dialog.id = 'giftDeliveryPendingDialog';
    dialog.className = 'gift-success-backdrop';
    dialog.innerHTML = `<section class="gift-payment-failure-dialog gift-delivery-pending-dialog" role="dialog" aria-modal="true" aria-labelledby="giftDeliveryPendingTitle"><button class="gift-failure-exit" type="button" aria-label="Close message">×</button><span class="gift-failure-seal" aria-hidden="true">♡</span><p class="gift-success-kicker">PAYMENT RECEIVED</p><h2 id="giftDeliveryPendingTitle">Your gift email is still on its way</h2><p class="gift-success-copy"></p><p class="gift-success-code-note">The gift code is sent only to the recipient email you entered. Retrying delivery will not charge you again.</p><div class="gift-success-actions"><button class="gift-failure-retry" type="button">Retry email delivery</button><button class="gift-failure-exit-action" type="button">Close for now</button></div></section>`;
    document.body.append(dialog);
    dialog.querySelector('.gift-success-copy').textContent = reason;
    const close = () => dialog.remove();
    const exit = () => {
      close();
      message.classList.remove('gift-info');
      message.textContent = 'Payment received. Gift email delivery is pending. Use “Retry gift card email” to try again; you will not be charged again.';
    };
    dialog.querySelectorAll('.gift-failure-exit, .gift-failure-exit-action').forEach((button) => button.addEventListener('click', exit));
    dialog.querySelector('.gift-failure-retry').addEventListener('click', () => { close(); retry(); });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) exit(); });
    document.addEventListener('keydown', function onEscape(event) { if (event.key === 'Escape' && document.getElementById('giftDeliveryPendingDialog')) { exit(); document.removeEventListener('keydown', onEscape); } });
    dialog.querySelector('.gift-failure-retry').focus();
  }

  function showVerificationPending(reason, retry) {
    document.getElementById('giftVerificationPendingDialog')?.remove();
    const dialog = document.createElement('div');
    dialog.id = 'giftVerificationPendingDialog';
    dialog.className = 'gift-success-backdrop';
    dialog.innerHTML = `<section class="gift-payment-failure-dialog gift-delivery-pending-dialog" role="dialog" aria-modal="true" aria-labelledby="giftVerificationPendingTitle"><button class="gift-failure-exit" type="button" aria-label="Close message">×</button><span class="gift-failure-seal" aria-hidden="true">…</span><p class="gift-success-kicker">PAYMENT STATUS</p><h2 id="giftVerificationPendingTitle">We’re checking your payment</h2><p class="gift-success-copy"></p><p class="gift-success-code-note">The gift card will be issued and emailed to your recipient only after Razorpay confirms the payment. Checking again will not create another charge.</p><div class="gift-success-actions"><button class="gift-failure-retry" type="button">Check payment again</button><button class="gift-failure-exit-action" type="button">Close for now</button></div></section>`;
    document.body.append(dialog);
    dialog.querySelector('.gift-success-copy').textContent = reason || 'Payment confirmation is taking a little longer.';
    const exit = () => {
      dialog.remove();
      message.textContent = 'Payment status is still being checked. Use “Check payment status” to continue without starting a second charge.';
    };
    dialog.querySelectorAll('.gift-failure-exit, .gift-failure-exit-action').forEach((button) => button.addEventListener('click', exit));
    dialog.querySelector('.gift-failure-retry').addEventListener('click', () => { dialog.remove(); retry(); });
    dialog.addEventListener('click', (event) => { if (event.target === dialog) exit(); });
    document.addEventListener('keydown', function onEscape(event) { if (event.key === 'Escape' && document.getElementById('giftVerificationPendingDialog')) { exit(); document.removeEventListener('keydown', onEscape); } });
    dialog.querySelector('.gift-failure-retry').focus();
  }

  loadOffers();
  loadGiftWallet();
})();
