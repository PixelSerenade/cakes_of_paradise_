const { layout, absoluteUrl, detailPanel, escapeHtml, niceDate } = require('./shared');

module.exports = (order) => {
  const trackingNumber = order.trackingNumber || 'Your bakery will share this shortly';
  const rows = [
    ['Tracking Number', escapeHtml(trackingNumber)],
    ['Carrier', escapeHtml(order.shippingCarrier || 'Cakes of Paradise delivery')],
    ['Estimated Delivery', niceDate(order.estimatedDelivery || order.customer?.deliveryDate)],
  ];
  return {
    subject: `Cakes of Paradise · Your cake is on its way · ${order.orderNumber} ♡`,
    text: `Hello, ${order.customer?.name || 'sweet friend'}!\n\nYour order ${order.orderNumber} has been shipped and is on its way.\nTracking number: ${trackingNumber}\nCarrier: ${order.shippingCarrier || 'Cakes of Paradise delivery'}\nEstimated delivery: ${niceDate(order.estimatedDelivery || order.customer?.deliveryDate)}\n\nWe hope it brings a little extra sweetness to your day!\n\nWith love,\nCakes of Paradise`,
    html: layout({
      preheader: `Good news: order ${order.orderNumber} is on its way.`,
      title: 'Your order is on the way!',
      name: order.customer?.name,
      eyebrow: 'FRESHLY BAKED · CAREFULLY ON ITS WAY',
      heroImage: order.items?.[0]?.image || '/public/images/hero-artisan-cake-optimized.jpg?v=20261101-real',
      content: `<p style="margin:0 0 12px">Good news! Your delicious treats have been shipped and are on their way to you.</p>${detailPanel(rows, 'blue')}<p style="margin:0">Can’t wait for you to enjoy these sweet treats ♡</p>`,
      cta: { label: 'TRACK YOUR ORDER', href: absoluteUrl(`/orders.html?order=${encodeURIComponent(order.orderNumber)}`) },
      footer: 'Packed with care by Cakes of Paradise ♡',
    }),
  };
};
