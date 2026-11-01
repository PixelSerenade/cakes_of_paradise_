const fs = require('node:fs');
const path = require('node:path');
const { layout, absoluteUrl, detailPanel, escapeHtml, money, niceDate } = require('./shared');

const projectRoot = path.resolve(__dirname, '../../..');
const productImageRoot = path.resolve(projectRoot, 'public', 'images');

function localCakePhoto(image) {
  const clean = String(image || '').split(/[?#]/, 1)[0];
  if (!clean || /^https?:\/\//i.test(clean)) return null;
  let relative = clean.replace(/^\/+/, '');
  if (relative.startsWith('images/')) relative = `public/${relative}`;
  if (!relative.startsWith('public/images/')) return null;
  const resolved = path.resolve(projectRoot, relative);
  if (!resolved.startsWith(`${productImageRoot}${path.sep}`)) return null;
  try { return fs.statSync(resolved).isFile() ? resolved : null; } catch { return null; }
}

function requestedTime(value) {
  const match = String(value || '').match(/^(\d{2}):(\d{2})$/);
  if (!match) return 'As arranged with the bakery';
  const hour = Number(match[1]);
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'} IST`;
}

module.exports = (order) => {
  const customer = order.customer || {};
  const items = order.items || [];
  const pickup = customer.deliveryType === 'pickup';
  const pickupAddress = process.env.BAKERY_PICKUP_ADDRESS || 'Cakes of Paradise, Surathkal, Mangaluru, Karnataka 575014, India';
  const address = pickup
    ? pickupAddress
    : [customer.address, customer.area, customer.city, customer.postalCode].filter(Boolean).join(', ') || 'Delivery address saved with your order';
  const dateLabel = pickup ? 'Requested pickup date' : 'Requested delivery date';
  const fulfillmentLabel = pickup ? 'Bakery pickup' : 'Home delivery';
  const date = niceDate(customer.deliveryDate);
  const time = requestedTime(customer.deliveryTime);
  const method = ({ razorpay: 'Online payment · Razorpay', 'pay-at-pickup': 'Pay at pickup', 'pay-on-delivery': 'Pay on delivery', 'pay-at-store': 'Pay at bakery', 'gift-card': 'Gift card', promotion: 'Promotion' })[order.paymentMethod] || String(order.paymentMethod || '').replaceAll('-', ' ');
  const payment = order.paymentStatus === 'paid'
    ? 'Paid'
    : order.paymentMethod === 'razorpay'
      ? 'Payment pending · complete checkout to confirm payment'
      : `Due at ${pickup ? 'pickup' : 'delivery'}`;
  const photoPath = localCakePhoto(items[0]?.image);
  const photoCid = photoPath ? 'cakes-of-paradise-order-cake' : '';
  const photoExtension = photoPath ? path.extname(photoPath).toLowerCase() : '';
  const photoContentType = ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' })[photoExtension] || 'image/jpeg';
  const heroImage = photoPath ? `cid:${photoCid}` : (/^https?:\/\//i.test(String(items[0]?.image || '')) ? items[0].image : '');
  const attachments = photoPath ? [{ filename: `your-cake${photoExtension}`, path: photoPath, cid: photoCid, contentType: photoContentType }] : [];
  const itemText = items.map((item) => `${Number(item.quantity) || 1} × ${item.name} (${item.flavor}, ${item.size}) · ${money((Number(item.unitPrice) || 0) * (Number(item.quantity) || 1))}`).join('\n');
  const itemHtml = items.map((item) => `<li style="padding:5px 0;border-bottom:1px solid #eee3d9">${Number(item.quantity) || 1} × ${escapeHtml(item.name)} <span style="color:#8b8177">(${escapeHtml(item.flavor)}, ${escapeHtml(item.size)})</span><strong style="float:right;color:#403c36">${money((Number(item.unitPrice) || 0) * (Number(item.quantity) || 1))}</strong>${item.cakeMessage ? `<br><span style="color:#8b8177;font-size:13px">Cake message: “${escapeHtml(item.cakeMessage)}”</span>` : ''}</li>`).join('');
  const rows = [
    ['Order number', escapeHtml(order.orderNumber)],
    ['Order placed', niceDate(order.createdAt || new Date())],
    ['Fulfilment', escapeHtml(fulfillmentLabel)],
    [dateLabel, date],
    [pickup ? 'Pickup time' : 'Requested time', escapeHtml(time)],
    ['Address', escapeHtml(address)],
    ['Payment method', escapeHtml(method || 'To be confirmed')],
    ['Payment status', escapeHtml(payment)],
    ...(customer.phone ? [['Contact number', escapeHtml(customer.phone)]] : []),
    ['Order total', money(order.total)],
  ];
  const locationLink = pickup
    ? `<p style="margin:10px 0 0"><a href="https://maps.google.com/?q=${encodeURIComponent(pickupAddress)}" style="color:#68745f;text-decoration:underline">Open pickup area in Maps →</a></p><p style="margin:8px 0 0;color:#81766b;font-size:13px">We’ll confirm the precise pickup point with you if needed.</p>`
    : '';
  const text = `Hello, ${customer.name || 'sweet friend'}!\n\nYour order is in! Cakes of Paradise has received your order and our team will prepare it with care.\n\n${itemText}\n\nOrder number: ${order.orderNumber}\nFulfilment: ${fulfillmentLabel}\n${dateLabel}: ${date}\n${pickup ? 'Pickup' : 'Requested'} time: ${time}\n${pickup ? 'Bakery address' : 'Delivery address'}: ${address}\nPayment: ${payment}\nTotal: ${money(order.total)}\n${pickup ? '\nPlease contact us if you need help finding the bakery pickup point.\n' : ''}\nThank you for choosing Cakes of Paradise ♡`;

  return {
    subject: `Your Cakes of Paradise order is in · ${order.orderNumber} ♡`,
    text,
    html: layout({
      preheader: `Order ${order.orderNumber} is safely in our bakery queue. Requested ${pickup ? 'pickup' : 'delivery'}: ${date}.`,
      title: 'Your order was placed successfully! ♡',
      name: customer.name,
      eyebrow: 'THANK YOU FOR CHOOSING CAKES OF PARADISE',
      heroImage,
      content: `<p style="margin:0 0 12px">We’ve received your order and our bakers are getting everything ready with care. We’ve saved your requested ${pickup ? 'pickup' : 'delivery'} day below.</p>${itemHtml ? `<ul style="margin:10px 0 16px;padding:0;list-style:none">${itemHtml}</ul>` : ''}${detailPanel(rows, 'pink')}${locationLink}<p style="margin:16px 0 0">We’ll keep you updated as your celebration gets closer. If you need to change a detail, reply to this email and our bakery team will help.</p>`,
      cta: { label: 'VIEW YOUR ORDER', href: absoluteUrl('/orders.html') },
      footer: 'Baked with love for your special moment · Cakes of Paradise ♡',
    }),
    ...(attachments.length ? { attachments } : {}),
  };
};
