const { layout, absoluteUrl } = require('./shared');

module.exports = (user) => ({
  subject: 'Welcome to Cakes of Paradise ♡',
  text: `Hello, ${user.name || 'sweet friend'}!\n\nWelcome to Cakes of Paradise. We are so happy you are here. Browse our freshly baked cakes and save a little sweetness for your next celebration.\n\nWith love,\nCakes of Paradise`,
  html: layout({
    preheader: 'A warm little welcome from our bakery to you.',
    title: 'Welcome to Cakes of Paradise!',
    name: user.name,
    eyebrow: 'WE’RE SO HAPPY YOU’RE HERE',
    content: '<p style="margin:0 0 12px">Your account is ready, and we cannot wait to be part of your sweetest celebrations.</p><p style="margin:0">Discover handcrafted cakes, thoughtful details and freshly baked favourites made with love.</p>',
    cta: { label: 'EXPLORE OUR CAKES', href: absoluteUrl('/shop.html') },
  }),
});
