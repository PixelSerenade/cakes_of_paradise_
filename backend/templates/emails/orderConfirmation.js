const { layout, absoluteUrl, detailPanel, escapeHtml, money, niceDate } = require('./shared');

module.exports = (order) => {
  const products = (order.items || []).map((item) => `${item.quantity} × ${item.name} (${item.size})`).join('\n');
  const rows = [
    ['Order Number', escapeHtml(order.orderNumber)],
    ['Order Date', niceDate(order.createdAt || new Date())],
    ['Total Amount', money(order.total)],
    ['Payment', escapeHtml(order.paymentStatus === 'paid' ? 'Paid' : 'Due at checkout / delivery')],
  ];
  const itemHtml = (order.items || []).map((item) => `<li style="padding:4px 0">${Number(item.quantity) || 1} × ${escapeHtml(item.name)} <span style="color:#8b8177">(${escapeHtml(item.size)})</span></li>`).join('');
  return {
    subject: `Order ${order.orderNumber} is confirmed ♡`,
    text: `Hello, ${order.customer?.name || 'sweet friend'}!\n\nThank you for choosing Cakes of Paradise. We received your order and are preparing it with care.\n\n${products}\n\nOrder number: ${order.orderNumber}\nOrder date: ${niceDate(order.createdAt || new Date())}\nTotal: ${money(order.total)}\nPayment: ${order.paymentStatus}\n\nThank you for making us part of your celebration.`,
    html: layout({
      preheader: `Order ${order.orderNumber} is safely in our bakery queue.`,
      title: 'Your order is confirmed!',
      name: order.customer?.name,
      eyebrow: 'THANK YOU FOR CHOOSING US',
      heroImage: order.items?.[0]?.image || '/public/images/hero-artisan-cake-optimized.jpg',
      content: `<p style="margin:0 0 12px">We’ve received your order and our bakers are getting everything ready with care.</p>${itemHtml ? `<ul style="margin:10px 0 16px;padding-left:20px">${itemHtml}</ul>` : ''}${detailPanel(rows, 'pink')}<p style="margin:0">We’ll keep you updated as your order makes its way to your celebration.</p>`,
      cta: { label: 'VIEW ORDER DETAILS', href: absoluteUrl(`/orders.html?order=${encodeURIComponent(order.orderNumber)}`) },
      footer: 'Thank you for being part of our sweet journey ♡',
    }),
  };
};
