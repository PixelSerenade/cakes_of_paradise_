(() => {
  const read = (key) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value.filter((line) => line && typeof line.productId === 'string' && Number.isInteger(Number(line.quantity)) && Number(line.quantity) > 0) : [];
    } catch { return []; }
  };
  const write = (key, lines) => localStorage.setItem(key, JSON.stringify(lines));
  const count = (lines) => lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const accountKey = () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      return `cakeBasket:${user?._id || user?.id || 'account'}`;
    } catch { return 'cakeBasket:account'; }
  };
  const apiBase = () => window.CAKES_API_BASE || '/api';
  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' });
  let accountCartQueue = Promise.resolve();
  const saveAccountCart = (lines) => {
    const copy = lines.map(({ productId, size, flavor, cakeMessage, quantity }) => ({ productId, size, flavor, cakeMessage: String(cakeMessage || '').trim().slice(0, 50), quantity: Number(quantity) }));
    write(accountKey(), lines);
    accountCartQueue = accountCartQueue.catch(() => {}).then(async () => {
      if (!localStorage.getItem('token')) return lines;
      const response = await fetch(`${apiBase()}/auth/account/cart`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ cart: copy }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Could not save your account cart.');
      write(accountKey(), data.cart || lines);
      return data.cart || lines;
    });
    accountCartQueue.catch((error) => window.dispatchEvent(new CustomEvent('cake-cart-sync-error', { detail: error.message })));
    return accountCartQueue;
  };
  const loadAccountCart = async () => {
    if (!localStorage.getItem('token')) return read('guestCakeBasket');
    const response = await fetch(`${apiBase()}/auth/account/cart`, { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Could not load your saved cart.');
    write(accountKey(), data.cart || []);
    return data.cart || [];
  };
  const activeKey = () => localStorage.getItem('token') ? accountKey() : 'guestCakeBasket';
  const mergeGuestIntoAccount = async () => {
    const destination = accountKey();
    const cachedAccount = read(destination);
    const guest = read('guestCakeBasket');
    let account = [];
    let hasServerCart = false;
    try { account = await loadAccountCart(); hasServerCart = true; }
    catch { account = read(destination); }
    // Migrate older browser carts once when there is no account cart on the server yet.
    //
    const legacy = read('cakeBasket');
    if (!account.length) {
      if (legacy.length) account.push(...legacy);
      else if (cachedAccount.length) account.push(...cachedAccount);
    }
    for (const line of guest) {
      const match = account.find((saved) => saved.productId === line.productId && saved.size === line.size && saved.flavor === line.flavor && (saved.cakeMessage || '') === (line.cakeMessage || ''));
      if (match) match.quantity = Math.min(10, Number(match.quantity) + Number(line.quantity));
      else account.push({ ...line, quantity: Math.min(10, Number(line.quantity)) });
    }
    if (hasServerCart) {
      try { await saveAccountCart(account); }
      catch { hasServerCart = false; write(destination, account); }
    } else write(destination, account);
    if (hasServerCart) localStorage.removeItem('guestCakeBasket');
    if (hasServerCart || legacy.length) localStorage.removeItem('cakeBasket');
    return account;
  };
  window.CakeCart = {
    read,
    write,
    count,
    key: activeKey,
    mergeGuestIntoAccount,
    loadAccountCart,
    saveAccountCart,
  };
})();
