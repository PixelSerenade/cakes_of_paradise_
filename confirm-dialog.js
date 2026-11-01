(() => {
  if (window.cakesConfirm) return;

  const dialog = document.createElement('dialog');
  dialog.className = 'cakes-confirm-dialog';
  dialog.setAttribute('aria-labelledby', 'cakesConfirmTitle');
  dialog.setAttribute('aria-describedby', 'cakesConfirmMessage');
  dialog.innerHTML = `
    <section class="cakes-confirm-card">
      <button class="cakes-confirm-close" type="button" aria-label="Close confirmation">×</button>
      <span class="cakes-confirm-flourish" aria-hidden="true">୨୧</span>
      <p class="cakes-confirm-eyebrow">A QUICK CHECK, WITH CARE</p>
      <h2 id="cakesConfirmTitle"></h2>
      <p id="cakesConfirmMessage"></p>
      <footer>
        <button class="cakes-confirm-cancel" type="button"></button>
        <button class="cakes-confirm-accept" type="button"></button>
      </footer>
    </section>`;
  document.body.append(dialog);

  const title = dialog.querySelector('#cakesConfirmTitle');
  const message = dialog.querySelector('#cakesConfirmMessage');
  const cancelButton = dialog.querySelector('.cakes-confirm-cancel');
  const acceptButton = dialog.querySelector('.cakes-confirm-accept');
  let resolveCurrent;

  const finish = (accepted) => {
    if (!dialog.open) return;
    const resolve = resolveCurrent;
    resolveCurrent = null;
    dialog.close(accepted ? 'confirm' : 'cancel');
    resolve?.(accepted);
  };

  window.cakesConfirm = ({ title: heading = 'Are you sure?', message: detail = 'Please confirm to continue.', confirmText = 'Confirm', cancelText = 'Cancel' } = {}) => {
    if (dialog.open) return Promise.resolve(false);
    title.textContent = heading;
    message.textContent = detail;
    acceptButton.textContent = confirmText;
    cancelButton.textContent = cancelText;
    return new Promise((resolve) => {
      resolveCurrent = resolve;
      dialog.returnValue = '';
      dialog.showModal();
      cancelButton.focus({ preventScroll: true });
    });
  };

  cancelButton.addEventListener('click', () => finish(false));
  dialog.querySelector('.cakes-confirm-close').addEventListener('click', () => finish(false));
  acceptButton.addEventListener('click', () => finish(true));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) finish(false); });
})();
