(() => {
  const API = window.CAKES_API_BASE || '/api';
  const token = () => localStorage.getItem('token');
  const paymentStatusLabel = (status) => ({ paid: 'Paid', unpaid: 'Unpaid', pending: 'Unpaid', failed: 'Unpaid', 'refund-due': 'Refund Due', refunded: 'Refunded' }[String(status || '').toLowerCase()] || 'Unpaid');
  const paymentMethodLabel = (method) => ({ razorpay: 'Online Payment', 'pay-at-pickup': 'Pay at Pickup', 'pay-on-delivery': 'Pay on Delivery', 'pay-at-store': 'Pay at bakery', 'gift-card': 'Gift card', promotion: 'Promotion' }[method] || String(method || 'Not specified').replaceAll('-', ' '));
  const orderStatusLabel = (status) => ({ placed: 'Placed', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', shipped: 'Shipped', 'out-for-delivery': 'Out for delivery', completed: 'Completed', cancelled: 'Cancelled' }[status] || String(status || '').replaceAll('-', ' '));
  const isUnpaid = (status) => ['unpaid', 'pending', 'failed'].includes(String(status || '').toLowerCase());
  let cancellationCutoff = 'confirmed';
  let allOrders = [];
  let activeStatusFilter = 'all';
  const ordersNode = document.getElementById('customerOrders');
  const messageNode = document.getElementById('ordersMessage');
  const placedBanner = document.getElementById('ordersPlacedBanner');
  const placedCopy = document.getElementById('ordersPlacedCopy');
  const detailDialog = document.getElementById('ordersDetailDialog');
  const detailContent = document.getElementById('ordersDetailContent');
  let visibleOrders = [];
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const setMessage = (message, error = false) => { messageNode.textContent = message; messageNode.classList.toggle('is-error', error); };

  if (new URLSearchParams(window.location.search).get('placed') === '1' && placedBanner && placedCopy) {
    let order = null;
    try { order = JSON.parse(sessionStorage.getItem('lastOrderConfirmation') || 'null'); } catch { /* Show the generic success state if stored order details are unreadable. */ }
    const orderLabel = order?.orderNumber ? ` ${order.orderNumber}` : '';
    const note = String(order?.confirmationNote || '').trim();
    placedCopy.textContent = `Your order${orderLabel} is saved and will appear in your history below.${note ? ` ${note}` : ' You can follow its status and payment details here.'}`;
    placedBanner.hidden = false;
    document.getElementById('dismissPlacedBanner')?.addEventListener('click', () => { placedBanner.hidden = true; });
    sessionStorage.removeItem('lastOrderConfirmation');
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`);
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...(options.headers || {}) } });
    let data = {};
    try { data = await response.json(); } catch { /* the HTTP status explains the failure */ }
    if (response.status === 401) {
      localStorage.removeItem('token'); localStorage.removeItem('user');
      sessionStorage.setItem('returnTo', 'orders.html'); window.location.replace('login.html');
      throw new Error('Please sign in to view your orders.');
    }
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
    return data;
  }

  const formatTime = (value) => {
    if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return '';
    const [hourText, minute] = value.split(':'); const hour = Number(hourText);
    return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
  };
  const newestFirst = (a, b) => {
    const left = Date.parse(a.createdAt || '') || 0;
    const right = Date.parse(b.createdAt || '') || 0;
    return (right - left) || String(b._id || '').localeCompare(String(a._id || ''));
  };
  const readableDate = (value, options = { day: 'numeric', month: 'short', year: 'numeric' }) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'To be confirmed' : date.toLocaleDateString('en-IN', options);
  };
  const statusTone = (status) => ({ placed: 'pending', confirmed: 'confirmed', completed: 'completed', cancelled: 'cancelled' }[status] || (status === 'paid' ? 'completed' : status === 'failed' ? 'cancelled' : 'progress'));

  function renderOrders(orders) {
    const filtered = [...orders].sort(newestFirst).filter((order) => activeStatusFilter === 'all' || (activeStatusFilter === 'other' && !['placed', 'confirmed', 'completed', 'cancelled'].includes(order.status)) || order.status === activeStatusFilter);
    visibleOrders = filtered;
    if (!filtered.length) {
      ordersNode.innerHTML = orders.length
        ? '<div class="orders-empty"><span class="orders-empty-icon" aria-hidden="true">♡</span><h3>No matching orders</h3><p>Try another status filter to see more of your cake orders.</p></div>'
        : '<div class="orders-empty"><span class="orders-empty-icon" aria-hidden="true">♡</span><h3>Your celebrations start here</h3><p>You haven’t placed an order yet. Find a cake for your next special moment.</p><a class="account-button primary" href="index.html#shop">Browse cakes <span aria-hidden="true">→</span></a></div>';
      return;
    }
    ordersNode.innerHTML = filtered.map((order, index) => {
      const items = order.items || [];
      const quantity = items.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
      const deliveryLabel = order.deliveryStatus === 'delivered' || order.status === 'completed' ? 'Delivered' : 'Not delivered';
      return `<article class="orders-summary-row"><div class="orders-summary-main"><strong>${escapeHtml(order.orderNumber)}</strong><small>${readableDate(order.createdAt)}</small></div><strong class="orders-summary-count">${quantity} item${quantity === 1 ? '' : 's'} · ${deliveryLabel}</strong><strong class="orders-summary-total">${money(order.total)}</strong><span class="order-badge status-${statusTone(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span><button class="orders-summary-open" type="button" data-open-order="${index}" aria-haspopup="dialog" aria-label="View details for order ${escapeHtml(order.orderNumber)}">View details <span aria-hidden="true">→</span></button></article>`;
    }).join('');
  }

  function openOrderDetails(order) {
    const customer = order.customer || {};
    const pickup = customer.deliveryType === 'pickup';
    const items = (order.items || []).map((item) => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const lineTotal = Number(item.unitPrice || 0) * quantity;
      return `<article class="orders-detail-item"><img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.name || 'Cake')}" loading="lazy"><div><strong>${escapeHtml(item.name || 'Cake')}</strong><span>${quantity} × ${escapeHtml(item.size || 'Standard')} · ${escapeHtml(item.flavor || 'Bakery selection')}</span>${item.cakeMessage ? `<small>Cake message: “${escapeHtml(item.cakeMessage)}”</small>` : ''}</div><b>${money(lineTotal)}</b></article>`;
    }).join('');
    const timeline = (order.tracking || []).map((entry) => {
      const kind = entry.type === 'payment-method' ? 'Payment option' : entry.type === 'payment' ? 'Payment' : entry.type === 'refund' ? 'Refund' : entry.type === 'delivery' ? 'Delivery' : 'Order status';
      const isPayment = entry.type === 'payment' || entry.type === 'refund';
      const state = entry.from && entry.to ? `${entry.type === 'payment-method' ? paymentMethodLabel(entry.from) : isPayment ? paymentStatusLabel(entry.from) : entry.type === 'delivery' ? entry.from.replaceAll('-', ' ') : orderStatusLabel(entry.from)} → ${entry.type === 'payment-method' ? paymentMethodLabel(entry.to) : isPayment ? paymentStatusLabel(entry.to) : entry.type === 'delivery' ? entry.to.replaceAll('-', ' ') : orderStatusLabel(entry.to)}` : orderStatusLabel(entry.status);
      return `<li class="${entry.status === order.status ? 'current' : ''}"><span></span><div><strong>${kind}: ${escapeHtml(state)}</strong>${entry.note ? `<small>${escapeHtml(entry.note)}</small>` : ''}<time>${escapeHtml(new Date(entry.at).toLocaleString('en-IN'))}</time></div></li>`;
    }).join('');
    const requestedTime = formatTime(customer.deliveryTime);
    const fee = pickup ? 'Free bakery pickup' : `${Number(order.deliveryFee || 0) ? money(order.deliveryFee) : 'Free delivery'}${order.deliveryDistanceBand ? ` · ${escapeHtml(order.deliveryDistanceBand)}` : ''}`;
    const address = pickup ? 'Cakes of Paradise, Surathkal, Mangaluru, Karnataka 575014, India' : [customer.address, customer.area, customer.city, customer.postalCode].filter(Boolean).join(', ');
    const canRequestCancellation = !['cancelled', 'completed'].includes(order.status);
    const cancelButton = canRequestCancellation ? `<button class="orders-detail-action cancel" type="button" data-order-action="cancel" data-order="${escapeHtml(order.orderNumber)}">Cancel order</button>` : '';
    const retryButton = order.paymentMethod === 'razorpay' && isUnpaid(order.paymentStatus) && order.status !== 'cancelled' ? `<button class="orders-detail-action primary" type="button" data-order-action="retry" data-order="${escapeHtml(order.orderNumber)}">Complete payment</button>` : '';
    const deliveryStatus = order.deliveryStatus === 'delivered' || order.status === 'completed' ? 'Delivered' : 'Not delivered yet';
    const shipping = ['shipped', 'out-for-delivery'].includes(order.status) ? `<p><span>Tracking</span><strong>${escapeHtml([order.trackingNumber, order.shippingCarrier].filter(Boolean).join(' · ') || (deliveryStatus === 'Delivered' ? 'Delivery complete' : 'Your order is on its way'))}</strong></p>${order.estimatedDelivery && deliveryStatus !== 'Delivered' ? `<p><span>Estimated delivery</span><strong>${readableDate(order.estimatedDelivery)}</strong></p>` : ''}` : '';
    const discount = Number(order.discountAmount || 0);
    document.getElementById('ordersDetailTitle').textContent = `Order ${order.orderNumber || ''}`;
    detailContent.innerHTML = `<div class="orders-detail-overview"><span class="order-badge status-${statusTone(order.status)}">${escapeHtml(orderStatusLabel(order.status))}</span><span>Placed ${readableDate(order.createdAt)}</span><strong>${money(order.total)}</strong></div><section class="orders-detail-section"><h3>What you ordered</h3><div class="orders-detail-items">${items || '<p>Order items are not available.</p>'}</div><div class="orders-detail-prices"><p><span>Items subtotal</span><strong>${money(order.subtotal)}</strong></p>${Number(order.deliveryFee || 0) ? `<p><span>Delivery</span><strong>${money(order.deliveryFee)}</strong></p>` : ''}${discount ? `<p><span>Discount</span><strong>−${money(discount)}</strong></p>` : ''}<p class="orders-detail-total"><span>Total</span><strong>${money(order.total)}</strong></p></div></section><section class="orders-detail-section"><h3>${pickup ? 'Pickup details' : 'Delivery details'}</h3><p><span>${pickup ? 'Pickup day' : 'Requested delivery day'}</span><strong>${readableDate(customer.deliveryDate)}${requestedTime ? ` · ${requestedTime}` : ''}</strong></p><p><span>${pickup ? 'Bakery address' : 'Delivery address'}</span><strong>${escapeHtml(address || 'Address on file')}</strong></p><p><span>Contact</span><strong>${escapeHtml(customer.name || '')}${customer.phone ? ` · ${escapeHtml(customer.phone)}` : ''}</strong></p><p><span>Fulfilment</span><strong>${fee}</strong></p><p><span>Delivery status</span><strong>${deliveryStatus}</strong></p>${customer.notes ? `<p><span>Note for the bakery</span><strong>${escapeHtml(customer.notes)}</strong></p>` : ''}${shipping}</section><section class="orders-detail-section"><h3>Payment</h3><p><span>Method</span><strong>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</strong></p><p><span>Status</span><strong>${escapeHtml(paymentStatusLabel(order.paymentStatus))}</strong></p></section>${timeline ? `<section class="orders-detail-section"><h3>Order updates</h3><ol class="orders-detail-timeline">${timeline}</ol></section>` : ''}<div class="orders-detail-actions">${retryButton}${cancelButton}</div><p class="orders-detail-action-message" role="status" aria-live="polite" hidden></p>`;
    if (typeof detailDialog.showModal === 'function') detailDialog.showModal();
    else detailDialog.setAttribute('open', '');
  }

  async function loadOrders() {
    if (!token()) {
      sessionStorage.setItem('returnTo', 'orders.html'); window.location.replace('login.html'); return;
    }
    try {
      const [policy, result] = await Promise.all([api('/policy'), api('/orders/mine')]);
      cancellationCutoff = policy.cancellationCutoffStatus || 'confirmed';
      const labels = { placed: 'placed', confirmed: 'confirmed', preparing: 'preparation starts', ready: 'ready for pickup/delivery' };
      document.getElementById('cancelPolicyHint').textContent = `Cancel at least one day before delivery, while the order is no later than ${labels[cancellationCutoff] || 'confirmed'}. Same-day cancellations are unavailable; contact the bakery if you need help.`;
      allOrders = (result.orders || []).sort(newestFirst);
      renderOrders(allOrders);
      setMessage(`${allOrders.length} order${allOrders.length === 1 ? '' : 's'} in your history.`);
    } catch (error) { setMessage(error.message, true); }
  }

  async function launchPayment(orderNumber, payment) {
    if (!window.Razorpay) await new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve; script.onerror = () => reject(new Error('Could not load secure online checkout.'));
      document.head.append(script);
    });
    const customer = JSON.parse(localStorage.getItem('user') || '{}');
    const checkout = new window.Razorpay({ key: payment.keyId, amount: payment.amount, currency: payment.currency, name: 'Cakes of Paradise', description: `Cake order ${orderNumber}`, order_id: payment.orderId, prefill: { name: customer.name || '', email: customer.email || '' }, theme: { color: '#e96a8d' },
      handler: async (response) => {
        try { await api(`/orders/${encodeURIComponent(orderNumber)}/payment/verify`, { method: 'POST', body: JSON.stringify(response) }); setMessage('Payment confirmed. Your order is updated.'); await loadOrders(); }
        catch (error) { setMessage(error.message, true); }
      },
      modal: { ondismiss: () => setMessage(`Payment for ${orderNumber} is still pending. You can retry here.`) },
    });
    checkout.on('payment.failed', (response) => setMessage(response.error?.description || 'Payment failed. You can retry this order.', true));
    if (detailDialog.open) detailDialog.close();
    checkout.open();
  }

  ordersNode.addEventListener('click', (event) => {
    const row = event.target.closest('[data-open-order]');
    if (!row) return;
    const order = visibleOrders[Number(row.dataset.openOrder)];
    if (order) openOrderDetails(order);
  });

  async function handleOrderAction(event) {
    const button = event.target.closest('[data-order-action]');
    if (!button) return;
    button.disabled = true;
    try {
      if (button.dataset.orderAction === 'cancel') {
        if (!await window.cakesConfirm({ title: 'Cancel this order?', message: 'Orders cannot be cancelled on the selected delivery date. Please review the order before confirming.', confirmText: 'Cancel order' })) return;
        const result = await api(`/orders/${encodeURIComponent(button.dataset.order)}/cancel`, { method: 'POST', body: JSON.stringify({}) });
        detailDialog.close?.();
        setMessage(result.message); await loadOrders();
      } else if (button.dataset.orderAction === 'retry') {
        const result = await api(`/orders/${encodeURIComponent(button.dataset.order)}/payment/retry`, { method: 'POST' });
        await launchPayment(button.dataset.order, result.payment);
      }
    } catch (error) {
      const feedback = detailContent.querySelector('.orders-detail-action-message');
      if (feedback) { feedback.textContent = error.message; feedback.hidden = false; feedback.classList.add('is-error'); }
      setMessage(error.message, true);
    }
    finally { button.disabled = false; }
  }

  detailContent.addEventListener('click', handleOrderAction);
  document.getElementById('closeOrdersDetail').addEventListener('click', () => detailDialog.close?.());
  detailDialog.addEventListener('click', (event) => {
    if (event.target === detailDialog) detailDialog.close?.();
  });

  document.getElementById('refreshOrders').addEventListener('click', loadOrders);
  document.getElementById('orderStatusFilter').addEventListener('change', (event) => {
    activeStatusFilter = event.target.value;
    renderOrders(allOrders);
  });
  document.getElementById('ordersSignOut').addEventListener('click', () => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.replace('index.html#home'); });
  loadOrders();
})();
