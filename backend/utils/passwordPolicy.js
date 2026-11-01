const passwordPolicyMessage = 'Password must be 6–12 characters and include an uppercase letter, a lowercase letter, a number, and a symbol.';

const isValidPassword = (password) => typeof password === 'string' &&
  password.length >= 6 && password.length <= 12 &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password) &&
  /[0-9]/.test(password) &&
  /[^A-Za-z0-9\s]/.test(password);

module.exports = { isValidPassword, passwordPolicyMessage };
