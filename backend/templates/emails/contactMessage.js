const { layout, absoluteUrl, detailPanel, escapeHtml, lines, niceDate } = require('./shared');

module.exports = (enquiry) => {
  const enquiryId = String(enquiry._id || enquiry.id || 'received').slice(-10).toUpperCase();
  const rows = [
    ['Message reference', escapeHtml(enquiryId)],
    ['Received', niceDate(enquiry.createdAt || new Date())],
    ['Your email', escapeHtml(enquiry.email || '')],
  ];
  const message = String(enquiry.details || '').trim();
  return {
    subject: 'We received your message | Cakes of Paradise',
    text: `Hello, ${enquiry.name || 'there'}!\n\nThank you for getting in touch with Cakes of Paradise. Your message has reached our bakery team. We’ll reply to this email address as soon as we can.\n\nReference: ${enquiryId}\n\nYour message:\n${message || 'No message provided'}\n\nWith care,\nCakes of Paradise`,
    html: layout({
      preheader: 'Your note has reached the Cakes of Paradise team.',
      title: 'Your note is with us',
      name: enquiry.name,
      eyebrow: 'A NOTE FROM YOU, RECEIVED WITH CARE',
      content: `<p style="margin:0 0 12px">Thank you for reaching out. Your message is safely with our bakery team, and we’ll reply to you at this email address as soon as we can.</p>${detailPanel(rows, 'sage')}${message ? `<div style="margin:16px 0 0;padding:15px 17px;border-left:3px solid #aab59d;border-radius:0 10px 10px 0;background:#f5f3eb"><strong>Your message</strong><p style="margin:8px 0 0;line-height:1.65">${lines(message)}</p></div>` : ''}`,
      cta: { label: 'EXPLORE OUR CAKES', href: absoluteUrl('/shop.html') },
      footer: 'Questions in the meantime? Simply reply to this email ♡',
    }),
  };
};
