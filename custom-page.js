(() => {
  const form = document.getElementById('dreamCakeForm');
  const status = document.getElementById('enquiryStatus');
  const successDialog = document.getElementById('enquirySuccessDialog');
  const closeSuccessDialog = successDialog?.querySelector('.enquiry-success-close');
  let lastFocusedElement = null;
  const dismissSuccessDialog = () => {
    if (!successDialog || successDialog.hidden) return;
    successDialog.hidden = true;
    document.body.classList.remove('enquiry-dialog-open');
    lastFocusedElement?.focus();
  };
  closeSuccessDialog?.addEventListener('click', dismissSuccessDialog);
  successDialog?.addEventListener('click', (event) => {
    if (event.target === successDialog) dismissSuccessDialog();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') dismissSuccessDialog();
  });
  const setStatus = (message, error = false) => { status.textContent = message; status.classList.toggle('error', error); };
  const occasionInput = form.elements.occasion;
  document.querySelectorAll('.occasion-choice').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('.occasion-choice').forEach((item) => { item.classList.remove('selected'); item.setAttribute('aria-pressed', 'false'); });
    button.classList.add('selected'); button.setAttribute('aria-pressed', 'true'); occasionInput.value = button.dataset.occasion;
  }));

  document.querySelectorAll('.inspiration-tile').forEach((tile) => tile.addEventListener('click', () => {
    const image = tile.querySelector('img');
    document.querySelectorAll('.inspiration-tile').forEach((item) => { item.classList.remove('saved'); item.querySelector('span').textContent = '♡'; });
    tile.classList.add('saved'); tile.querySelector('span').textContent = '♥';
    const text = form.elements.design;
    const inspiration = `Inspired by ${image.alt.toLowerCase()}`;
    if (!text.value.toLowerCase().includes(inspiration.toLowerCase())) text.value = [text.value.trim(), inspiration].filter(Boolean).join('. ');
    document.getElementById('designCount').textContent = text.value.length;
    const occasion = tile.dataset.occasion;
    const matching = [...document.querySelectorAll('.occasion-choice')].find((item) => item.dataset.occasion === occasion);
    if (matching) matching.click();
    setStatus('Inspiration added to your enquiry.');
    window.setTimeout(() => setStatus(''), 2600);
  }));

  [['design', 'designCount'], ['notes', 'notesCount']].forEach(([field, counter]) => {
    form.elements[field].addEventListener('input', () => { document.getElementById(counter).textContent = form.elements[field].value.length; });
  });

  let referenceImage = '';
  const fileInput = document.getElementById('referenceImage');
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    const preview = document.getElementById('referencePreview');
    const imageStatus = document.getElementById('imageStatus');
    referenceImage = '';
    preview.hidden = true;
    if (!file) { imageStatus.textContent = ''; return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { fileInput.value = ''; imageStatus.textContent = 'Please choose a JPG, PNG or WebP image.'; return; }
    if (file.size > 1024 * 1024) { fileInput.value = ''; imageStatus.textContent = 'That image is over 1 MB. Please choose a smaller file.'; return; }
    const reader = new FileReader();
    reader.onload = () => { referenceImage = String(reader.result); preview.src = referenceImage; preview.hidden = false; imageStatus.textContent = `${file.name} is ready to attach.`; };
    reader.onerror = () => { imageStatus.textContent = 'This image could not be read. Please try another file.'; };
    reader.readAsDataURL(file);
  });

  const syncBagCount = () => {
    const count = window.CakeCart?.count(window.CakeCart.read(window.CakeCart.key())) || 0;
    const countBadge = document.getElementById('customCartCount');
    const bagLink = document.querySelector('.nav-cart-link, .bag-link');
    if (countBadge) countBadge.textContent = count;
    if (bagLink) bagLink.setAttribute('aria-label', `Shopping bag, ${count} items`);
  };
  syncBagCount();
  window.addEventListener('storage', syncBagCount);
  window.addEventListener('cake-cart-updated', syncBagCount);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const submit = form.querySelector('.submit-enquiry');
    submit.disabled = true;
    setStatus('Sending your cake ideas…');
    const values = new FormData(form);
    const details = [
      `Flavour: ${values.get('flavour')}`,
      `Shape: ${values.get('shape')}`,
      `Colour palette: ${values.get('themeColor')}`,
      values.get('design')?.trim() ? `Design idea: ${values.get('design').trim()}` : '',
      values.get('notes')?.trim() ? `Additional notes: ${values.get('notes').trim()}` : '',
    ].filter(Boolean).join('\n');
    const payload = {
      name: values.get('name').trim(), email: values.get('email').trim(), phone: values.get('phone').trim(),
      occasion: values.get('occasion'), cakeSize: values.get('cakeSize'), details,
      referenceImage: referenceImage || undefined,
    };
    try {
      const response = await fetch(`${window.CAKES_API_BASE || '/api'}/enquiries`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Your enquiry could not be sent. Please try again.');
      form.reset(); occasionInput.value = 'Birthday';
      document.querySelectorAll('.occasion-choice').forEach((item) => { const selected = item.dataset.occasion === 'Birthday'; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); });
      document.getElementById('designCount').textContent = '0'; document.getElementById('notesCount').textContent = '0';
      document.getElementById('referencePreview').hidden = true; document.getElementById('imageStatus').textContent = ''; referenceImage = '';
      setStatus('Your enquiry is on its way. We’ll be in touch soon ♡');
      const successMessage = document.getElementById('enquirySuccessMessage');
      if (successMessage) {
        const bakeryNotified = result.emailSent === true;
        const customerCopied = result.customerEmailSent === true;
        if (bakeryNotified && customerCopied) {
          successMessage.textContent = 'Your custom cake enquiry has been sent to the Cakes of Paradise team. A separate confirmation copy was sent to your email, and the bakery can reply directly to the address you provided.';
        } else if (bakeryNotified) {
          successMessage.textContent = 'Your custom cake enquiry has been sent to the Cakes of Paradise team. We could not send the confirmation copy to your email, but the bakery can reply directly to the address you provided.';
        } else if (customerCopied) {
          successMessage.textContent = 'A confirmation copy was sent to your email, but the bakery notification could not be delivered. Please contact Cakes of Paradise directly to make sure the team receives your request.';
        } else {
          successMessage.textContent = 'Your enquiry was saved, but neither email could be delivered just now. Please contact Cakes of Paradise directly so the team can follow up.';
        }
      }
      if (successDialog) {
        lastFocusedElement = document.activeElement;
        successDialog.hidden = false;
        document.body.classList.add('enquiry-dialog-open');
        closeSuccessDialog?.focus();
      }
    } catch (error) {
      setStatus(error.message || 'We couldn’t send your enquiry. Please try again.', true);
    } finally { submit.disabled = false; }
  });
})();
