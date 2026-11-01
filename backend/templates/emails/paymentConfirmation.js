const { layout, absoluteUrl, detailPanel, escapeHtml, money, niceDate } = require('./shared');

module.exports = (order) => {
  const paymentId = order.paymentId || order.paymentOrderId || 'Recorded by the bakery';
  const method = String(order.paymentMethod || 'Payment').replaceAll('-', ' ');
  const rows = [
    ['Payment ID', escapeHtml(paymentId)],
    ['Amount', money(order.total)],
    ['Payment Method', escapeHtml(method)],
    ['Paid On', niceDate(order.paidAt || new Date())],
  ];
  return {
    subject: `Cakes of Paradise · Payment received for order ${order.orderNumber} ♡`,
    text: `Hello, ${order.customer?.name || 'sweet friend'}!\n\nYour payment for order ${order.orderNumber} was successful.\nPayment ID: ${paymentId}\nAmount: ${money(order.total)}\nPayment method: ${method}\n\nYour order is confirmed and will be prepared soon.\n\nWith love,\nCakes of Paradise`,
    html: layout({
      preheader: `Payment received for order ${order.orderNumber}.`,
      title: 'Payment successful!',
      name: order.customer?.name,
      eyebrow: 'A LITTLE CHECKOUT RELIEF',
      heroImage: order.items?.[0]?.image || '/public/images/hero-artisan-cake-optimized.jpg?v=20261101-real',
      content: `<p style="margin:0 0 12px">Your payment has been successfully processed. Your order is confirmed and our bakers will prepare it soon.</p>${detailPanel(rows, 'sage')}<p style="margin:0">Order number: <strong>${escapeHtml(order.orderNumber)}</strong></p>`,
      cta: { label: 'VIEW YOUR ORDER', href: absoluteUrl(`/orders.html?order=${encodeURIComponent(order.orderNumber)}`) },
      footer: 'Thank you for making us part of your celebration ♡',
    }),
  };
};
