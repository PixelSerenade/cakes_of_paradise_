(() => {
  const form = document.getElementById('contactForm');
  const status = document.getElementById('contactStatus');
  const submit = form.querySelector('button[type="submit"]');
  const setStatus = (message, isError = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', isError);
  };
  const syncBagCount = () => {
    const count = window.CakeCart?.count(window.CakeCart.read(window.CakeCart.key())) || 0;
    document.getElementById('contactCartCount').textContent = count;
  };
  syncBagCount();
  window.addEventListener('storage', syncBagCount);
  window.addEventListener('cake-cart-updated', syncBagCount);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    submit.firstChild.textContent = 'Sending… ';
    setStatus('Sending your note to the bakery…');
    const values = new FormData(form);
    try {
      const response = await fetch(`${window.CAKES_API_BASE || '/api'}/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.get('name').trim(),
          email: values.get('email').trim(),
          occasion: 'General enquiry',
          cakeSize: 'Not specified',
          details: values.get('message').trim(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Your message could not be sent. Please try again.');
      form.reset();
      setStatus(result.customerEmailSent
        ? 'Your note is on its way! Check your inbox for a little confirmation. ♡'
        : 'Thank you! We’ve received your message and will be in touch soon. ♡');
    } catch (error) {
      setStatus(error instanceof TypeError ? 'We couldn’t reach the bakery just now. Please try again shortly.' : error.message, true);
    } finally {
      submit.disabled = false;
      submit.firstChild.textContent = 'Send Message ';
    }
  });
})();
