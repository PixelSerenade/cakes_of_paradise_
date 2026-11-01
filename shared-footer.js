(() => {
  document.querySelectorAll('.sweet-announcement, .gallery-announcement').forEach((banner) => banner.remove());
  document.body.insertAdjacentHTML('afterbegin', '<div class="sweet-announcement"><span aria-hidden="true">♡</span><span>Freshly baked</span><i aria-hidden="true">·</i><span>Made with love</span><i aria-hidden="true">·</i><span>For your special moments</span><span aria-hidden="true">♡</span></div>');

  const newsletterTitle = document.body.classList.contains('home-page')
    ? 'Join us on a sweet journey ♡'
    : 'Join our sweet journey ♡';

  const footerMarkup = `
    <footer class="sweet-footer" id="siteFooter">
      <span class="sweet-footer-top-bow" aria-hidden="true">୨୧</span>
      <div class="sweet-footer-main">
        <a class="sweet-footer-brand" href="index.html#home" aria-label="Cakes of Paradise home">
          <span class="sweet-footer-wordmark">Cakes of<br>Paradise<span> · </span></span>
          <span class="sweet-footer-tagline">cakes for every occasion</span>
        </a>
        <nav class="sweet-footer-column sweet-footer-shop" aria-label="Shop links"><h2>♡ &nbsp; Shop</h2><a href="shop.html">Shop</a><a href="index.html#featuredCakesHeading">Bestsellers</a><a href="gift-cards.html">Gift Cards</a><a href="gallery.html">Gallery</a></nav>
        <nav class="sweet-footer-column sweet-footer-about" aria-label="About links"><h2>♡ &nbsp; About Us</h2><a href="about.html">Our Story</a><a href="contact.html">Contact</a></nav>
        <nav class="sweet-footer-column sweet-footer-account" aria-label="Account links"><h2>♡ &nbsp; My Account</h2><a href="login.html">Sign In</a><a href="orders.html">My Orders</a><a href="cart.html">Bag</a></nav>
        <nav class="sweet-footer-column sweet-footer-help" aria-label="Help links"><h2>♡ &nbsp; Help</h2><a href="faq.html">FAQs</a><a href="delivery.html">Delivery</a><a href="privacy.html">Privacy Policy</a></nav>
        <section class="sweet-footer-newsletter" aria-labelledby="footerNewsletterTitle">
          <a class="sweet-footer-social" href="https://instagram.com/_cakes_of_paradise/" target="_blank" rel="noopener noreferrer" aria-label="Follow Cakes of Paradise on Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle class="instagram-flash" cx="17.7" cy="6.8" r="1"/></svg></a><h2 id="footerNewsletterTitle">${newsletterTitle}</h2>
          <form class="sweet-newsletter-form"><label class="visually-hidden" for="footerNewsletterEmail">Your email address</label><input id="footerNewsletterEmail" name="email" type="email" placeholder="Your email address" autocomplete="email" maxlength="254" required><button type="submit" aria-label="Subscribe to the newsletter">→</button></form>
          <label class="sweet-newsletter-consent"><input name="consent" type="checkbox" required><span>I agree to receive occasional bakery emails. Unsubscribe any time.</span></label>
          <p class="sweet-newsletter-status" aria-live="polite" role="status"></p>
        </section>
      </div>
      <div class="sweet-footer-bottom"><span class="sweet-footer-rule" aria-hidden="true"></span><span class="sweet-footer-bottom-bow" aria-hidden="true">୨୧</span><span class="sweet-footer-rule" aria-hidden="true"></span><p>© ${new Date().getFullYear()} Cakes of Paradise. Made with love ♡</p></div>
    </footer>`;

  document.querySelectorAll('body > footer').forEach((footer) => footer.remove());
  document.body.insertAdjacentHTML('beforeend', footerMarkup);

  const form = document.querySelector('.sweet-newsletter-form');
  const emailInput = form.querySelector('input[type="email"]');
  const submitButton = form.querySelector('button[type="submit"]');
  const status = document.querySelector('.sweet-newsletter-status');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const email = emailInput.value.trim();
    submitButton.disabled = true;
    status.className = 'sweet-newsletter-status is-pending';
    status.textContent = 'Sending a little note your way…';
    try {
      const localPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '5000';
      const apiBase = window.CAKES_API_BASE || (localPreview ? `http://${window.location.hostname}:5000/api` : '/api');
      const response = await fetch(`${apiBase}/newsletter/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, consent: form.querySelector('[name="consent"]').checked }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'We could not complete your subscription just yet.');
      status.className = 'sweet-newsletter-status is-success';
      status.textContent = result.message || 'You’re on the sweet list! Check your inbox for a little hello. ♡';
      form.reset();
    } catch (error) {
      status.className = 'sweet-newsletter-status is-error';
      status.textContent = error instanceof TypeError ? 'We couldn’t reach the bakery just yet. Please try again soon.' : error.message;
    } finally {
      submitButton.disabled = false;
    }
  });
})();
