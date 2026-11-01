const { layout, absoluteUrl, detailPanel, escapeHtml, lines, niceDate } = require('./shared');

module.exports = (enquiry) => {
  const enquiryId = String(enquiry._id || enquiry.id || 'received').slice(-10).toUpperCase();
  const rows = [
    ['Enquiry ID', escapeHtml(enquiryId)],
    ['Cake Type', escapeHtml(enquiry.cakeType || 'Custom Cake')],
    ['Occasion', escapeHtml(enquiry.occasion || 'Special moment')],
    ['Requested Size', escapeHtml(enquiry.cakeSize || 'To be discussed')],
    ['Date', niceDate(enquiry.createdAt || new Date())],
  ];
  const details = enquiry.details ? `<p style="margin:16px 0 0"><strong>Your note</strong><br>${lines(enquiry.details)}</p>` : '';
  return {
    subject: 'Thank you for your custom cake enquiry ♡',
    text: `Hello, ${enquiry.name || 'sweet friend'}!\n\nWe’ve received your custom cake request and will get back to you within 24–48 hours.\nEnquiry ID: ${enquiryId}\nOccasion: ${enquiry.occasion || 'Special moment'}\nCake size: ${enquiry.cakeSize || 'To be discussed'}\n\n${enquiry.details || ''}\n\nWith love, Cakes of Paradise`,
    html: layout({
      preheader: 'Your custom cake note has reached our bakery.',
      title: 'Thank you for your enquiry!',
      name: enquiry.name,
      eyebrow: 'LET’S MAKE SOMETHING SWEET',
      heroImage: '/public/images/custom-cake-craft-optimized.jpg?v=20261101-real',
      content: `<p style="margin:0 0 12px">We’ve received your custom cake request and our team will get back to you within 24–48 hours with the next sweet details.</p>${detailPanel(rows, 'pink')}${details}`,
      cta: { label: 'VISIT OUR CAKE SHOP', href: absoluteUrl('/shop.html') },
      footer: 'We can’t wait to create something special for you ♡',
    }),
  };
};
