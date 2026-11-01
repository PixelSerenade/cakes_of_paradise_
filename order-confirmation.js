(() => {
  const freshPhotoUrl = (value) => {
    const url = String(value || '');
    if (!/^\/?(?:public\/)?images\//.test(url)) return url;
    const clean = url.replace(/([?&])v=[^&]*/g, '').replace(/[?&]$/, '');
    return `${clean}${clean.includes('?') ? '&' : '?'}v=20261101-real`;
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const count = window.CakeCart?.count(window.CakeCart.read(window.CakeCart.key())) || 0;
  const badge = document.getElementById('navCartCount');
  if (badge) badge.textContent = String(count);
  let order = null;
  try { order = JSON.parse(sessionStorage.getItem('lastOrderConfirmation') || 'null'); } catch { /* show the missing state below */ }
  if (!order?.orderNumber || !Array.isArray(order.items)) {
    document.getElementById('confirmationMissing').hidden = false;
    return;
  }
  document.getElementById('confirmationCard').hidden = false;
  document.getElementById('confirmationNumber').textContent = `Order ${order.orderNumber}`;
  document.getElementById('confirmationItems').textContent = order.items.map((item) => `${item.quantity} × ${item.name} (${item.flavor}, ${item.size})`).join(' · ');
  document.getElementById('confirmationTotal').textContent = money(order.total);
  document.getElementById('confirmationPayment').textContent = String(order.paymentMethod || 'Not specified').replaceAll('-', ' ');
  const customer = order.customer || {};
  const fulfillment = customer.deliveryType === 'pickup' ? 'Bakery pickup' : [customer.address, customer.area, customer.city, customer.postalCode].filter(Boolean).join(', ');
  const deliveryDate = customer.deliveryDate ? new Date(customer.deliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  document.getElementById('confirmationDelivery').textContent = [customer.name, customer.phone, fulfillment, deliveryDate, customer.deliveryTime].filter(Boolean).join(' · ');
  document.getElementById('confirmationImages').innerHTML = order.items.map((item) => `<figure class="confirmation-image"><img src="${escapeHtml(freshPhotoUrl(item.image))}" alt="${escapeHtml(item.name)}"><figcaption>${escapeHtml(item.name)} · ${Number(item.quantity)} item${Number(item.quantity) === 1 ? '' : 's'}</figcaption></figure>`).join('');
})();
