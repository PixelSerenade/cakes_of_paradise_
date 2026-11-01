(() => {
  const API = window.CAKES_API_BASE || '/api';
  const token = () => localStorage.getItem('token');
  const statuses = ['placed', 'confirmed', 'preparing', 'ready', 'shipped', 'out-for-delivery', 'completed', 'cancelled'];
  const paymentStatusLabel = (status) => ({ paid: 'Paid', unpaid: 'Unpaid', pending: 'Unpaid', failed: 'Unpaid', 'refund-due': 'Refund Due', refunded: 'Refunded' }[String(status || '').toLowerCase()] || 'Unpaid');
  const paymentMethodLabel = (method) => ({ razorpay: 'Online Payment', 'pay-at-pickup': 'Pay at Pickup', 'pay-on-delivery': 'Pay on Delivery', 'pay-at-store': 'Pay at bakery', 'gift-card': 'Gift card', promotion: 'Promotion' }[method] || String(method || 'Not specified').replaceAll('-', ' '));
  const orderStatusLabel = (status) => ({ placed: 'Placed', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', shipped: 'Shipped', 'out-for-delivery': 'Out for delivery', completed: 'Completed', cancelled: 'Cancelled' }[status] || String(status || '').replaceAll('-', ' '));
  const isUnpaid = (status) => ['unpaid', 'pending', 'failed'].includes(String(status || '').toLowerCase());
  let cancellationCutoff = 'confirmed';
  let allOrders = [];
  let activeStatusFilter = 'all';
  const ordersNode = document.getElementById('customerOrders');
  const messageNode = document.getElementById('ordersMessage');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const setMessage = (message, error = false) => { messageNode.textContent = message; messageNode.classList.toggle('is-error', error); };

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

  function renderOrders(orders) {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const filtered = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).filter((order) => activeStatusFilter === 'all' || (activeStatusFilter === 'other' && !['placed', 'confirmed', 'completed', 'cancelled'].includes(order.status)) || order.status === activeStatusFilter);
    if (!filtered.length) {
      ordersNode.innerHTML = orders.length
        ? '<div class="orders-empty"><span class="orders-empty-icon" aria-hidden="true">♡</span><h3>No matching orders</h3><p>Try another status filter to see more of your cake orders.</p></div>'
        : '<div class="orders-empty"><span class="orders-empty-icon" aria-hidden="true">♡</span><h3>Your celebrations start here</h3><p>You haven’t placed an order yet. Find a cake for your next special moment.</p><a class="account-button primary" href="index.html#shop">Browse cakes <span aria-hidden="true">→</span></a></div>';
      return;
    }
    const statusLabel = orderStatusLabel;
    const statusTone = (status) => ({ placed: 'pending', confirmed: 'confirmed', completed: 'completed', cancelled: 'cancelled' }[status] || (status === 'paid' ? 'completed' : status === 'failed' ? 'cancelled' : 'progress'));
    ordersNode.innerHTML = filtered.map((order) => {
      const deliveryDay = new Date(order.customer.deliveryDate).toISOString().slice(0, 10);
      const requestedTime = formatTime(order.customer.deliveryTime);
      const items = (order.items || []).map((item) => `<div class="order-line"><img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.name)}" loading="lazy"><div><strong>${escapeHtml(item.name)}</strong><span>${Number(item.quantity)} × ${escapeHtml(item.size)} · ${escapeHtml(item.flavor)}</span>${item.cakeMessage ? `<small>Cake message: “${escapeHtml(item.cakeMessage)}”</small>` : ''}</div></div>`).join('');
      const timeline = (order.tracking || []).map((entry) => { const kind = entry.type === 'payment' ? 'Payment' : entry.type === 'refund' ? 'Refund' : 'Order status'; const paymentEvent = entry.type === 'payment' || entry.type === 'refund'; const state = entry.from && entry.to ? `${paymentEvent ? paymentStatusLabel(entry.from) : orderStatusLabel(entry.from)} → ${paymentEvent ? paymentStatusLabel(entry.to) : orderStatusLabel(entry.to)}` : orderStatusLabel(entry.status); return `<li class="${entry.status === order.status ? 'current' : ''}"><strong>${kind}: ${escapeHtml(state)}</strong>${entry.note ? `<span>${escapeHtml(entry.note)}</span>` : ''}<time>${new Date(entry.at).toLocaleString('en-IN')}</time></li>`; }).join('');
      const canCancel = today < deliveryDay && statuses.indexOf(order.status) <= statuses.indexOf(cancellationCutoff) && order.status !== 'cancelled';
      const cancelButton = canCancel ? `<button class="retry-payment" type="button" data-order-action="cancel" data-order="${escapeHtml(order.orderNumber)}">Cancel order</button>` : '';
      const retryButton = order.paymentMethod === 'razorpay' && isUnpaid(order.paymentStatus) && order.status !== 'cancelled' ? `<button class="retry-payment" type="button" data-order-action="retry" data-order="${escapeHtml(order.orderNumber)}">Pay online</button>` : '';
      const fee = order.customer.deliveryType === 'pickup' ? 'Free bakery pickup' : `${Number(order.deliveryFee || 0) ? money(order.deliveryFee) : 'Free delivery'}${order.deliveryDistanceBand ? ` · ${escapeHtml(order.deliveryDistanceBand)}` : ''}`;
      const paymentLabel = `${paymentStatusLabel(order.paymentStatus)} · ${paymentMethodLabel(order.paymentMethod)}`;
      const placedDate = new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const fulfilment = order.customer.deliveryType === 'pickup' ? `Collect from the bakery · ${fee}` : `Deliver to: ${escapeHtml(order.customer.address)}, ${escapeHtml(order.customer.area)}, ${escapeHtml(order.customer.city)} ${escapeHtml(order.customer.postalCode)} · ${escapeHtml(order.customer.phone)} · ${fee}`;
      const shippingDetails = order.status === 'shipped' ? `<p class="order-detail-wide"><span>Tracking</span><strong>${escapeHtml([order.trackingNumber, order.shippingCarrier].filter(Boolean).join(' · ') || 'Your order is on its way')}</strong></p>${order.estimatedDelivery ? `<p><span>Estimated delivery</span><strong>${new Date(order.estimatedDelivery).toLocaleDateString('en-IN')}</strong></p>` : ''}` : '';
      return `<article class="order-card" data-order-card="${escapeHtml(order.orderNumber)}"><div class="order-card-top"><div class="order-title-block"><span class="order-number-label">ORDER NUMBER</span><h3>${escapeHtml(order.orderNumber)}</h3><span class="order-number">Placed ${placedDate}</span></div><div class="order-status-group"><span class="order-badge order-status-badge status-${statusTone(order.status)}">${escapeHtml(statusLabel(order.status))}</span><span class="order-badge payment-status-badge status-${statusTone(order.paymentStatus)}">Payment · ${escapeHtml(paymentLabel)}</span>${order.refundStatus && order.refundStatus !== 'none' ? `<span class="order-badge status-progress">Refund · ${escapeHtml(paymentStatusLabel(order.paymentStatus))}</span>` : ''}</div></div><div class="order-card-main"><div class="order-items">${items}</div><div class="order-total"><span>Total</span><strong>${money(order.total)}</strong></div></div><div class="orders-actions"><button class="retry-payment details-toggle" type="button" data-order-action="details" aria-expanded="false" aria-controls="details-${escapeHtml(order.orderNumber)}">View details</button>${retryButton}${cancelButton}</div><div class="order-details" id="details-${escapeHtml(order.orderNumber)}" hidden><div class="order-detail-grid"><p><span>Payment method</span><strong>${escapeHtml(paymentMethodLabel(order.paymentMethod))}</strong></p><p><span>Payment status</span><strong>${escapeHtml(paymentStatusLabel(order.paymentStatus))}</strong></p><p><span>${order.customer.deliveryType === 'pickup' ? 'Pickup' : 'Delivery'} date</span><strong>${new Date(order.customer.deliveryDate).toLocaleDateString('en-IN')}${requestedTime ? ` · ${requestedTime}` : ''}</strong></p><p class="order-detail-wide"><span>Fulfilment</span><strong>${fulfilment}</strong></p>${order.customer.notes ? `<p class="order-detail-wide"><span>Message for the baker</span><strong>${escapeHtml(order.customer.notes)}</strong></p>` : ''}${shippingDetails}</div><ol class="order-timeline">${timeline}</ol></div></article>`;
    }).join('');
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
      allOrders = result.orders || [];
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
    checkout.open();
  }

  ordersNode.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-order-action]');
    if (!button) return;
    if (button.dataset.orderAction === 'details') {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (!panel) return;
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
      button.textContent = panel.hidden ? 'View details' : 'Hide details';
      return;
    }
    button.disabled = true;
    try {
      if (button.dataset.orderAction === 'cancel') {
        if (!window.confirm('Cancel this order? Orders cannot be cancelled on the delivery date.')) return;
        const result = await api(`/orders/${encodeURIComponent(button.dataset.order)}/cancel`, { method: 'POST', body: JSON.stringify({}) });
        setMessage(result.message); await loadOrders();
      } else if (button.dataset.orderAction === 'retry') {
        const result = await api(`/orders/${encodeURIComponent(button.dataset.order)}/payment/retry`, { method: 'POST' });
        await launchPayment(button.dataset.order, result.payment);
      }
    } catch (error) { setMessage(error.message, true); }
    finally { button.disabled = false; }
  });

  document.getElementById('refreshOrders').addEventListener('click', loadOrders);
  document.getElementById('orderStatusFilter').addEventListener('change', (event) => {
    activeStatusFilter = event.target.value;
    renderOrders(allOrders);
  });
  document.getElementById('ordersSignOut').addEventListener('click', () => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.replace('index.html#home'); });
  loadOrders();
})();
