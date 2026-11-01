(() => {
  const apiBase = window.CAKES_API_BASE || '/api';
  const emailForm = document.getElementById('resetEmailForm');
  const otpForm = document.getElementById('resetOtpForm');
  const passwordForm = document.getElementById('resetPasswordForm');
  const doneStep = document.getElementById('resetDoneStep');
  const status = document.getElementById('resetStatus');
  const emailInput = document.getElementById('resetEmailInput');
  const otpInput = document.getElementById('resetOtpInput');
  const otpDigits = Array.from(document.querySelectorAll('[data-otp-digit]'));
  const title = document.getElementById('forgotTitle');
  const card = document.querySelector('.forgot-card');
  const stage = document.querySelector('.forgot-stage');
  const backLabel = document.getElementById('forgotBackLabel');
  const progress = document.querySelector('.forgot-progress');
  const resendButton = document.getElementById('resendResetCodeBtn');
  const countdown = document.getElementById('resetCountdown');
  const steps = [emailForm, otpForm, passwordForm, doneStep];
  let resetToken = '';
  let resendInterval = null;

  const showStatus = (message, type = 'success') => {
    status.textContent = message;
    status.className = `forgot-status${type === 'error' ? ' is-error' : ''}`;
    status.hidden = false;
  };
  const hideStatus = () => { status.hidden = true; status.textContent = ''; };
  const syncOtpValue = () => { otpInput.value = otpDigits.map((input) => input.value).join(''); };
  const clearOtp = () => {
    otpDigits.forEach((input) => { input.value = ''; });
    syncOtpValue();
  };

  const setStep = (active) => {
    steps.forEach((step, index) => { step.hidden = index !== active; });
    document.getElementById('forgotIntroEmail').hidden = active !== 0;
    document.getElementById('forgotIntroOtp').hidden = active !== 1;
    document.getElementById('forgotIntroPassword').hidden = active !== 2;
    title.textContent = ['Forgot your password?', 'Enter the OTP', 'Create New Password', 'Password changed successfully!'][active];
    if (backLabel) backLabel.textContent = active >= 2 ? 'Back to Login' : 'Back to Sign In';
    card.classList.toggle('is-otp', active === 1);
    card.classList.toggle('is-password', active >= 2);
    card.classList.toggle('is-done', active === 3);
    stage.classList.toggle('is-password', active >= 2);
    progress.hidden = active >= 1;
    document.querySelectorAll('[data-progress-step]').forEach((item, index) => {
      item.classList.toggle('is-active', index === active && active < 3);
      item.classList.toggle('is-complete', index < active && active < 3);
      item.hidden = active >= 1;
    });
    document.getElementById('forgotCardFoot').hidden = active >= 2;
    document.getElementById('forgotRemember').hidden = active !== 0;
    document.getElementById('otpResendRow').hidden = active !== 1;
    document.getElementById('forgotPasswordBack').hidden = active !== 2;
    hideStatus();
  };

  const request = async (path, body) => {
    let response;
    try {
      response = await fetch(`${apiBase}/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error('We couldn’t reach the bakery just now. Please try again in a moment.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'We could not complete that step. Please try again.');
    return data;
  };

  const runButton = async (button, busyLabel, task) => {
    const originalMarkup = button.innerHTML;
    button.disabled = true;
    button.textContent = busyLabel;
    try { await task(); }
    catch (error) { showStatus(error.message, 'error'); }
    finally {
      button.disabled = button === resendButton && Boolean(resendInterval);
      button.innerHTML = originalMarkup;
    }
  };

  const updateCountdown = (seconds) => {
    if (seconds > 0) {
      countdown.textContent = `(in 00:${String(seconds).padStart(2, '0')})`;
      resendButton.disabled = true;
      return;
    }
    countdown.textContent = '(you can resend now)';
    resendButton.disabled = false;
    if (resendInterval) window.clearInterval(resendInterval);
    resendInterval = null;
  };

  const startResendCountdown = () => {
    if (resendInterval) window.clearInterval(resendInterval);
    let remaining = 45;
    updateCountdown(remaining);
    resendInterval = window.setInterval(() => {
      remaining -= 1;
      updateCountdown(remaining);
    }, 1000);
  };

  const sendCode = async (button, isResend = false) => {
    if (!isResend && !emailForm.reportValidity()) return;
    const email = emailInput.value.trim();
    await runButton(button, isResend ? 'Sending a fresh code…' : 'Sending a little note…', async () => {
      await request('forgot-password', { email });
      resetToken = '';
      document.getElementById('resetEmailDisplay').textContent = email;
      clearOtp();
      setStep(1);
      startResendCountdown();
      otpDigits[0].focus();
    });
  };

  emailForm.addEventListener('submit', (event) => {
    event.preventDefault();
    sendCode(document.getElementById('sendResetCodeBtn'));
  });
  resendButton.addEventListener('click', () => {
    if (!resendButton.disabled) sendCode(resendButton, true);
  });

  const fillOtpFrom = (startIndex, rawValue) => {
    const digits = rawValue.replace(/\D/g, '').slice(0, otpDigits.length - startIndex);
    if (!digits) return;
    digits.split('').forEach((digit, offset) => {
      otpDigits[startIndex + offset].value = digit;
    });
    syncOtpValue();
    hideStatus();
    const nextIndex = Math.min(startIndex + digits.length, otpDigits.length - 1);
    otpDigits[nextIndex].focus();
    otpDigits[nextIndex].select();
  };

  otpDigits.forEach((input, index) => {
    input.addEventListener('input', () => {
      const rawValue = input.value;
      if (rawValue.length > 1) {
        input.value = '';
        fillOtpFrom(index, rawValue);
      } else {
        input.value = rawValue.replace(/\D/g, '').slice(0, 1);
        syncOtpValue();
        hideStatus();
        if (input.value && index < otpDigits.length - 1) otpDigits[index + 1].focus();
      }
    });
    input.addEventListener('keydown', (event) => {
      if (/^\d$/.test(event.key) && input.value) {
        event.preventDefault();
        input.value = event.key;
        syncOtpValue();
        hideStatus();
        if (index < otpDigits.length - 1) otpDigits[index + 1].focus();
      } else if (event.key === 'Backspace' && !input.value && index > 0) {
        otpDigits[index - 1].value = '';
        syncOtpValue();
        otpDigits[index - 1].focus();
      } else if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        otpDigits[index - 1].focus();
      } else if (event.key === 'ArrowRight' && index < otpDigits.length - 1) {
        event.preventDefault();
        otpDigits[index + 1].focus();
      }
    });
    input.addEventListener('paste', (event) => {
      const pasted = event.clipboardData?.getData('text') || '';
      if (!pasted) return;
      event.preventDefault();
      fillOtpFrom(index, pasted);
    });
  });

  otpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    syncOtpValue();
    if (otpInput.value.length !== 6) {
      showStatus('Please enter all six digits from your email.', 'error');
      otpDigits.find((input) => !input.value)?.focus();
      return;
    }
    const button = document.getElementById('verifyResetCodeBtn');
    await runButton(button, 'Checking your code…', async () => {
      const result = await request('verify-reset-otp', { email: emailInput.value.trim(), code: otpInput.value.trim() });
      resetToken = result.resetToken;
      setStep(2);
      document.getElementById('newResetPassword').focus();
    });
  });

  const newPasswordInput = document.getElementById('newResetPassword');
  const confirmPasswordInput = document.getElementById('confirmResetPassword');
  const passwordMatchNote = document.getElementById('passwordMatchNote');
  const getPasswordRules = (password) => ({
    length: password.length >= 6 && password.length <= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^A-Za-z0-9\s]/.test(password),
  });
  const updatePasswordRules = () => {
    const rules = getPasswordRules(newPasswordInput.value);
    document.querySelectorAll('[data-password-rule]').forEach((item) => {
      item.classList.toggle('is-met', Boolean(rules[item.dataset.passwordRule]));
    });
  };
  const updatePasswordMatch = () => {
    if (!confirmPasswordInput.value) {
      passwordMatchNote.textContent = '';
      passwordMatchNote.className = 'forgot-match-note';
      return;
    }
    const matches = confirmPasswordInput.value === newPasswordInput.value;
    passwordMatchNote.textContent = matches ? 'Your passwords match.' : 'Your passwords do not match yet.';
    passwordMatchNote.className = `forgot-match-note${matches ? '' : ' is-error'}`;
  };

  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    const target = document.getElementById(button.dataset.passwordToggle);
    button.addEventListener('click', () => {
      const visible = target.type === 'password';
      target.type = visible ? 'text' : 'password';
      button.classList.toggle('is-visible', visible);
      button.setAttribute('aria-pressed', String(visible));
      const fieldName = button.dataset.passwordToggle === 'newResetPassword' ? 'new password' : 'confirmation password';
      button.setAttribute('aria-label', `${visible ? 'Hide' : 'Show'} ${fieldName}`);
    });
  });
  newPasswordInput.addEventListener('input', () => { hideStatus(); updatePasswordRules(); updatePasswordMatch(); });
  confirmPasswordInput.addEventListener('input', () => { hideStatus(); updatePasswordMatch(); });

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!passwordForm.reportValidity()) return;
    const password = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    const rules = getPasswordRules(password);
    if (Object.values(rules).some((isMet) => !isMet)) {
      showStatus('Your password must meet every requirement above.', 'error');
      newPasswordInput.focus();
      return;
    }
    if (password !== confirmPassword) {
      showStatus('Those passwords don’t match yet. Please check them and try again.', 'error');
      confirmPasswordInput.focus();
      return;
    }
    const button = document.getElementById('saveResetPasswordBtn');
    await runButton(button, 'Saving your password…', async () => {
      await request('reset-password', { resetToken, password });
      setStep(3);
      document.getElementById('returnToSignInLink').focus();
    });
  });

  setStep(0);
  emailInput.focus({ preventScroll: true });
})();
