(() => {
  const API = window.CAKES_API_BASE || '/api';
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const filters = { search: '', rating: 'all', status: 'all' };
  let products = [];
  let rows = [];
  let editingId = '';
  let page = 1;
  let pageSize = 7;
  let searchTimer;

  async function request(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API}${path}`, { ...options, headers, credentials: 'same-origin' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
    return data;
  }

  function setMessage(message, error = false) {
    const el = $('#adminReviewMessage');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error-text', error);
    el.classList.toggle('success-text', !error);
  }

  function dateLabel(review) {
    const date = new Date(review.reviewDate || review.createdAt);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function renderStats(stats = {}) {
    const el = $('#adminReviewStats');
    if (!el) return;
    const cards = [
      ['☆', 'Total Reviews', stats.totalReviews ?? 0, 'All customer feedback'],
      ['☺', 'Positive Reviews', stats.positiveReviews ?? 0, 'Rated 4 stars or above'],
      ['★', 'Average Rating', `${Number(stats.averageRating || 0).toFixed(1)} / 5`, 'Published reviews'],
      ['◌', 'Hidden Reviews', stats.hiddenReviews ?? 0, 'Visible to your team'],
    ];
    el.innerHTML = cards.map(([icon, label, value, note]) => `<article class="review-stat-card"><span class="review-stat-icon" aria-hidden="true">${icon}</span><div><small>${label}</small><strong>${value}</strong><em>${note}</em></div></article>`).join('');
  }

  function renderRows(reviews) {
    const tbody = $('#adminReviewsList');
    if (!reviews.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="review-table-empty">No reviews match these filters.</td></tr>';
      return;
    }
    tbody.innerHTML = reviews.map((review) => {
      const rating = Math.max(1, Math.min(5, Number(review.rating) || 1));
      const status = review.status === 'hidden' ? 'hidden' : 'published';
      const img = review.productImage
        ? `<img src="${escapeHtml(review.productImage)}" alt="" loading="lazy" onerror="this.hidden=true">`
        : '<span class="review-cake-fallback" aria-hidden="true">✿</span>';
      const toggle = status === 'published'
        ? `<button type="button" title="Hide" aria-label="Hide review" data-action="hide" data-id="${escapeHtml(review._id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.5 4.5 9.5 7a10.8 10.8 0 0 1-3.1 4.2M6.2 6.3C3.7 7.8 2.7 10.1 2.5 12c.5 1.2 1.6 3 3.6 4.5A10.5 10.5 0 0 0 12 19c.8 0 1.5-.1 2.2-.3"/></svg></button>`
        : `<button type="button" title="Publish Again" aria-label="Publish review again" data-action="publish" data-id="${escapeHtml(review._id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3"/></svg></button>`;
      return `<tr>
        <td><div class="review-customer-cell"><strong>${escapeHtml(review.customerName || 'Customer')}</strong><small>${escapeHtml(review.customerEmail || 'Email not provided')}</small></div></td>
        <td><div class="review-cake-cell">${img}<span>${escapeHtml(review.productName || review.productId)}</span></div></td>
        <td><span class="review-row-stars" aria-label="${rating} out of 5 stars">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</span></td>
        <td><span class="review-row-text">${escapeHtml(review.comment)}</span></td>
        <td>${dateLabel(review)}</td>
        <td><span class="review-status-pill is-${status}">${status === 'published' ? 'Published' : 'Hidden'}</span></td>
        <td><div class="review-action-group"><button type="button" title="View" aria-label="View review" data-action="view" data-id="${escapeHtml(review._id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></svg></button><button type="button" title="Edit" aria-label="Edit review" data-action="edit" data-id="${escapeHtml(review._id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.5-1 11-11a2.1 2.1 0 0 0-3-3l-11 11L4 20Z"/></svg></button>${toggle}<button type="button" title="Delete" aria-label="Delete review" data-action="delete" data-id="${escapeHtml(review._id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></button></div></td>
      </tr>`;
    }).join('');
  }

  function renderPagination(info = {}) {
    const total = Number(info.total || 0);
    const pages = Math.max(1, Number(info.pages || 1));
    const from = total ? (page - 1) * pageSize + 1 : 0;
    const to = Math.min(total, page * pageSize);
    $('#adminReviewPageSummary').textContent = `Showing ${from}–${to} of ${total} reviews`;
    $('#reviewCountChip').textContent = `${total} review${total === 1 ? '' : 's'}`;
    $('#adminReviewPrevPage').disabled = page <= 1;
    $('#adminReviewNextPage').disabled = page >= pages;
    const first = Math.max(1, Math.min(page - 2, pages - 4));
    const buttons = [];
    for (let number = first; number <= Math.min(pages, first + 4); number += 1) {
      buttons.push(`<button type="button" data-review-page="${number}" class="${number === page ? 'is-current' : ''}" aria-label="Page ${number}" ${number === page ? 'aria-current="page"' : ''}>${number}</button>`);
    }
    $('#adminReviewPageButtons').innerHTML = buttons.join('');
  }

  function renderSidebar(data = {}) {
    const recent = $('#adminRecentReviews');
    const top = $('#adminHighestRatedCakes');
    const recentReviews = data.recentReviews || [];
    const highest = data.highestRatedCakes || [];
    recent.innerHTML = recentReviews.length
      ? recentReviews.slice(0, 4).map((review) => `<article class="review-recent-row"><strong>${escapeHtml(review.customerName || 'Customer')} · ${escapeHtml(review.productName || review.productId)}</strong><small>${dateLabel(review)} · ${review.status === 'hidden' ? 'Hidden' : 'Published'}</small><span>${escapeHtml(review.comment)}</span></article>`).join('')
      : '<p class="review-side-empty">Your latest reviews will appear here.</p>';
    top.innerHTML = highest.length
      ? highest.slice(0, 4).map((cake) => `<article class="review-top-cake">${cake.productImage ? `<img src="${escapeHtml(cake.productImage)}" alt="" loading="lazy" onerror="this.hidden=true">` : '<span class="review-cake-fallback" aria-hidden="true">✿</span>'}<span><strong>${escapeHtml(cake.productName)}</strong><small>${cake.reviewCount} published review${cake.reviewCount === 1 ? '' : 's'}</small></span><b>★ ${Number(cake.averageRating).toFixed(1)}</b></article>`).join('')
      : '<p class="review-side-empty">Published cake ratings will appear here.</p>';
  }

  async function load() {
    if (!$('#adminReviewsList') || JSON.parse(localStorage.getItem('user') || 'null')?.role !== 'admin') return;
    const params = new URLSearchParams({ status: filters.status, page: String(page), limit: String(pageSize) });
    if (filters.rating !== 'all') params.set('rating', filters.rating);
    if (filters.search) params.set('search', filters.search);
    $('#adminReviewsList').innerHTML = '<tr><td colspan="7" class="review-table-empty">Gathering your reviews…</td></tr>';
    try {
      const data = await request(`/admin/reviews?${params.toString()}`, { cache: 'no-store' });
      rows = data.reviews || [];
      renderStats(data.stats);
      renderRows(rows);
      renderPagination(data.pagination);
      renderSidebar(data);
    } catch (error) {
      $('#adminReviewsList').innerHTML = `<tr><td colspan="7" class="review-table-empty">Could not load reviews: ${escapeHtml(error.message)}</td></tr>`;
    }
  }

  async function loadCakes() {
    const select = $('#manualReviewProductSelect');
    if (!select || JSON.parse(localStorage.getItem('user') || 'null')?.role !== 'admin') return;
    select.disabled = true;
    try {
      const data = await request('/catalog/admin/products', { cache: 'no-store' });
      products = data.products || [];
      const selected = select.value;
      select.innerHTML = '<option value="">Select a cake</option>' + products.map((product) => `<option value="${escapeHtml(product.id || product.slug)}">${escapeHtml(product.name)}</option>`).join('');
      if (products.some((product) => (product.id || product.slug) === selected)) select.value = selected;
      select.disabled = products.length === 0;
    } catch (error) {
      select.innerHTML = '<option value="">Could not load cakes</option>';
      setMessage(error.message, true);
    }
  }

  function resetForm() {
    const form = $('#adminManualReviewForm');
    form.reset();
    editingId = '';
    form.elements.customerEmail.required = true;
    $('#reviewFormTitle').textContent = 'Add New Review';
    $('#adminReviewSubmit').textContent = '＋ Add Review';
    $('#cancelManualReviewEdit').hidden = true;
    $('#reviewCharCount').textContent = '0';
  }

  $('#adminReviewSearch')?.addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { filters.search = event.target.value.trim(); page = 1; load(); }, 250);
  });
  $('#adminReviewRatingFilter')?.addEventListener('change', (event) => { filters.rating = event.target.value; page = 1; load(); });
  $('#adminReviewStatusFilter')?.addEventListener('change', (event) => { filters.status = event.target.value; page = 1; load(); });
  $('#adminReviewPageSize')?.addEventListener('change', (event) => { pageSize = Number(event.target.value) || 7; page = 1; load(); });
  $('#adminReviewPrevPage')?.addEventListener('click', () => { page = Math.max(1, page - 1); load(); });
  $('#adminReviewNextPage')?.addEventListener('click', () => { page += 1; load(); });
  $('#adminReviewPageButtons')?.addEventListener('click', (event) => { const button = event.target.closest('[data-review-page]'); if (button) { page = Number(button.dataset.reviewPage); load(); } });
  $('#adminManualReviewForm')?.elements.comment?.addEventListener('input', (event) => { $('#reviewCharCount').textContent = String(event.target.value.length); });

  $('#adminReviewsList')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const review = rows.find((entry) => entry._id === button.dataset.id);
    if (!review) return;
    const action = button.dataset.action;
    if (action === 'view') {
      $('#adminReviewDetailsContent').innerHTML = `<span class="eyebrow">CUSTOMER REVIEW</span><h4>${escapeHtml(review.customerName || 'Customer')}</h4><small>${escapeHtml(review.customerEmail || 'Email not provided')} · ${escapeHtml(review.productName || review.productId)} · ${dateLabel(review)}</small><p style="color:#d0a04d;font-size:1.05rem">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} <span style="color:#71675c">(${review.rating}/5)</span></p><p>${escapeHtml(review.comment)}</p><small>Status: ${review.status === 'hidden' ? 'Hidden' : 'Published'}</small>`;
      const dialog = $('#adminReviewDetailsDialog');
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
      return;
    }
    if (action === 'edit') {
      await loadCakes();
      const form = $('#adminManualReviewForm');
      editingId = review._id;
      form.elements.customerName.value = review.customerName || '';
      form.elements.customerEmail.value = review.customerEmail || '';
      form.elements.customerEmail.required = false;
      form.elements.productId.value = review.productId || '';
      form.elements.rating.value = String(review.rating || '');
      form.elements.comment.value = review.comment || '';
      form.elements.permissionGiven.checked = review.permissionGiven === true || review.source === 'customer';
      $('#reviewCharCount').textContent = String((review.comment || '').length);
      $('#reviewFormTitle').textContent = 'Edit Review';
      $('#adminReviewSubmit').textContent = 'Save Changes';
      $('#cancelManualReviewEdit').hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (action === 'delete' && !await window.cakesConfirm({ title: 'Delete this review?', message: `${review.customerName || 'This customer'}’s review will be permanently removed.`, confirmText: 'Delete review' })) return;
    button.disabled = true;
    try {
      if (action === 'hide' || action === 'publish') {
        await request(`/admin/reviews/${encodeURIComponent(review._id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: action === 'hide' ? 'hidden' : 'published' }) });
        setMessage(action === 'hide' ? 'Review hidden from the shop.' : 'Review published again.');
      } else if (action === 'delete') {
        await request(`/admin/reviews/${encodeURIComponent(review._id)}`, { method: 'DELETE' });
        setMessage('Review deleted.');
      }
      await load();
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  $('#adminManualReviewForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const submit = $('#adminReviewSubmit');
    const wasEditing = Boolean(editingId);
    submit.disabled = true;
    submit.textContent = wasEditing ? 'Saving…' : 'Adding…';
    try {
      const body = {
        productId: form.elements.productId.value,
        customerName: form.elements.customerName.value.trim(),
        customerEmail: form.elements.customerEmail.value.trim(),
        rating: Number(form.elements.rating.value),
        reviewText: form.elements.comment.value.trim(),
        permissionGiven: form.elements.permissionGiven.checked,
        status: wasEditing ? (rows.find((entry) => entry._id === editingId)?.status || 'published') : 'published',
      };
      const response = await request(wasEditing ? `/admin/reviews/${encodeURIComponent(editingId)}` : '/admin/reviews/manual', { method: wasEditing ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setMessage(response.message || (wasEditing ? 'Review changes saved.' : 'Review added and published.'));
      resetForm();
      page = 1;
      await load();
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      submit.disabled = false;
      submit.textContent = editingId ? 'Save Changes' : '＋ Add Review';
    }
  });
  $('#cancelManualReviewEdit')?.addEventListener('click', resetForm);
  $('#closeAdminReviewDetails')?.addEventListener('click', () => $('#adminReviewDetailsDialog').close());
  $('#adminReviewDetailsDialog')?.addEventListener('click', (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });

  window.AdminReviewManager = { load, loadCakes };
  if (new URLSearchParams(location.search).get('adminPage') === 'reviews') {
    load();
    loadCakes();
  }
})();
