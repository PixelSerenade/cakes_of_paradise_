const { layout, absoluteUrl, apiUrl, escapeHtml } = require('./shared');

module.exports = ({ email, unsubscribeToken }) => {
  const unsubscribeUrl = `${apiUrl()}/newsletter/unsubscribe/${encodeURIComponent(unsubscribeToken)}`;
  return {
    subject: 'Sweet updates, just for you ♡',
    text: `Hi there!\n\nWelcome to the Cakes of Paradise newsletter. Expect occasional notes about new cakes, seasonal collections and bakery news.\n\nUnsubscribe: ${unsubscribeUrl}\n\nWith love, Cakes of Paradise`,
    html: layout({
      preheader: 'A little note from our bakery, just for you.',
      title: 'Welcome to the sweet list!',
      name: 'there',
      eyebrow: 'SWEET UPDATES · JUST FOR YOU',
      heroImage: '/public/images/custom-cake-craft-optimized.jpg?v=20261101-real',
      content: `<p style="margin:0 0 12px">You’ll be the first to hear about new cake launches, seasonal collections and little bakery surprises.</p><p style="margin:0">Thank you for inviting us into your inbox. We’ll keep our notes occasional and full of sweetness.</p><p style="margin:22px 0 0;text-align:center;color:#89937b">Freshly baked &nbsp;·&nbsp; New arrivals &nbsp;·&nbsp; Made with love</p>`,
      cta: { label: 'STAY IN THE LOOP', href: absoluteUrl('/shop.html') },
      footerHtml: `You’re receiving bakery news because you subscribed with ${escapeHtml(email)}. To stop marketing emails, <a href="${escapeHtml(unsubscribeUrl)}" style="color:#75816c;text-decoration:underline">unsubscribe here</a>.`,
    }),
    headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
};
