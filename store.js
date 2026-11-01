(() => {
  const API = window.CAKES_API_BASE || '/api';
  const statuses = ['placed', 'confirmed', 'preparing', 'ready', 'shipped', 'out-for-delivery', 'completed', 'cancelled'];
  const adminOrderStatuses = ['placed', 'confirmed', 'preparing', 'ready', 'shipped', 'out-for-delivery', 'completed', 'cancelled'];
  const paymentStatusLabel = (status) => ({ paid: 'Paid', unpaid: 'Unpaid', pending: 'Unpaid', failed: 'Unpaid', 'refund-due': 'Refund Due', refunded: 'Refunded' }[String(status || '').toLowerCase()] || 'Unpaid');
  const isOrderUnpaid = (status) => ['unpaid', 'pending', 'failed'].includes(String(status || '').toLowerCase());
  const isOfflinePayment = (method) => ['pay-at-pickup', 'pay-on-delivery', 'pay-at-store'].includes(method);
  const orderStatusLabel = (status) => ({ placed: 'Placed', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', shipped: 'Shipped', 'out-for-delivery': 'Out for delivery', completed: 'Completed', cancelled: 'Cancelled' }[status] || String(status || '').replaceAll('-', ' '));
  const paymentMethodLabel = (method) => ({ razorpay: 'Online Payment', 'pay-at-pickup': 'Pay at Pickup', 'pay-on-delivery': 'Pay on Delivery', 'pay-at-store': 'Pay at bakery', 'gift-card': 'Gift card', promotion: 'Promotion' }[method] || String(method || 'Not specified').replaceAll('-', ' '));
  const productGrid = document.getElementById('productGrid');
  const cart = (() => {
    try {
      const cartKey = window.CakeCart?.key() || 'cakeBasket';
      const saved = JSON.parse(localStorage.getItem(cartKey) || '[]');
      return Array.isArray(saved) ? saved.filter((line) => line && typeof line.productId === 'string' && typeof line.name === 'string' && Number.isFinite(Number(line.price)) && Number.isInteger(Number(line.quantity))) : [];
    } catch { return []; }
  })();
  let productData = [];
  let featuredProductData = [];
  let latestSalesInsights = null;
  let displayedTopCakes = [];
  const modalCakePhotoOverrides = {
    'gender-reveal-celebration': [
      '/public/images/products/theme/gender-reveal-celebration.jpg',
      '/public/images/products/theme/gender-reveal-detail-2.png',
      '/public/images/products/theme/gender-reveal-detail-3.png',
      '/public/images/products/theme/gender-reveal-detail-4.png',
    ],
  };
  const CATALOG_ROWS_PER_BATCH = 4;
  let catalogPageSize = 12;
  let catalogPage = 1;
  let catalogRequestId = 0;
  let catalogTotalPages = 1;
  let catalogTotalItems = 0;
  let inventoryData = [];
  let currentInventoryType = 'all';
  let currentInventoryPage = 1;
  let currentInventoryPageSize = 8;
  let inventoryRequestId = 0;
  const selectedInventoryRows = new Set();
  let searchTimer;
  let adminPage = 1;
  let adminPages = 1;
  const adminViewKeys = { overview: 'admin-overview', orders: 'admin-order-section', completed: 'completed-order-section', inventory: 'admin-inventory-section', products: 'admin-product-section', categories: 'admin-category-section', wishlist: 'admin-wishlist-section', 'gift-cards': 'admin-giftcard-section', reviews: 'admin-reviews-section', customers: 'admin-customer-section', enquiries: 'admin-enquiry-section', offers: 'admin-offer-section', settings: 'admin-settings-section' };
  const requestedAdminView = new URLSearchParams(location.search).get('adminPage') || (location.hash.startsWith('#admin-') ? ({ 'admin-overview': 'overview', 'admin-order-section': 'orders', 'completed-order-section': 'completed', 'admin-inventory-section': 'inventory', 'admin-product-section': 'products', 'admin-category-section': 'categories', 'admin-wishlist-section': 'wishlist', 'admin-giftcard-section': 'gift-cards', 'admin-reviews-section': 'reviews', 'admin-customer-section': 'customers' }[location.hash.slice(1)] || 'overview') : 'overview');
  let adminView = Object.hasOwn(adminViewKeys, requestedAdminView) ? requestedAdminView : 'overview';
  let completedPage = 1;
  let completedPages = 1;
  let accountData = null;
  let cancellationCutoff = 'confirmed';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
  const salesMoney = (value) => value === null || value === undefined || !Number.isFinite(Number(value)) ? 'Unavailable' : money(value);
  const bagIconMarkup = '<svg class="bag-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5.5 8.5h13l1.2 12H4.3l1.2-12Z"/><path d="M9 9V6.5a3 3 0 0 1 6 0V9"/></svg>';
  const getUser = () => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  };
  const getToken = () => localStorage.getItem('token');
  const hasWishlistAccount = () => Boolean(getToken() && getUser()?.email && getUser()?.role !== 'admin');
  const readWishlist = () => {
    try { const ids = JSON.parse(localStorage.getItem('cakeWishlist') || '[]'); return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []; }
    catch { return []; }
  };
  const wishlistIds = () => [...new Set([...readWishlist(), ...(hasWishlistAccount() ? accountData?.user?.favoriteProducts || [] : [])])];
  const saveWishlist = (ids) => { localStorage.setItem('cakeWishlist', JSON.stringify([...new Set(ids)])); };
  const redirectToWishlistSignIn = () => {
    const returnTo = `${window.location.pathname.replace(/^\//, '')}${window.location.search}${window.location.hash}`;
    sessionStorage.setItem('returnTo', returnTo || 'shop.html');
    window.location.href = 'login.html?reason=wishlist';
  };
  const setMessage = (id, message, isError = false) => {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = message;
      node.style.color = isError ? 'var(--admin-danger, #B4234D)' : '';
    }
    if (!message || !document.body.classList.contains('admin-mode')) return;
    if (!isError && (/^\d+ orders?\b/i.test(message) || /^No /i.test(message) || /Loading|Saving|Updating|Preparing/i.test(message))) return;
    let region = document.getElementById('adminToastRegion');
    if (!region) {
      region = document.createElement('div');
      region.id = 'adminToastRegion';
      region.className = 'admin-toast-region';
      region.setAttribute('aria-live', isError ? 'assertive' : 'polite');
      document.body.append(region);
    }
    const toast = document.createElement('div');
    toast.className = `admin-toast ${isError ? 'is-error' : 'is-success'}`;
    toast.setAttribute('role', isError ? 'alert' : 'status');
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.remove(), 4200);
  };
  let cartRevision = 0;
  const saveCart = () => {
    cartRevision += 1;
    localStorage.setItem(window.CakeCart?.key() || 'cakeBasket', JSON.stringify(cart));
    return getToken() ? window.CakeCart?.saveAccountCart(cart) : Promise.resolve(cart);
  };

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body) headers['Content-Type'] = 'application/json';
    if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
    let response;
    try { response = await fetch(`${API}${path}`, { ...options, headers }); }
    catch (error) {
      if (error instanceof TypeError) throw new Error(`Cannot reach the bakery API at ${API}. Start the backend or set its deployed URL in api-config.js.`);
      throw error;
    }
    let data = {};
    try { data = await response.json(); } catch { /* handled below */ }
    if (!response.ok) {
      if (response.status === 401) throw new Error('Please sign in before using this feature.');
      if (response.status === 403) throw new Error(data.message || 'This account cannot perform that action.');
      throw new Error(data.message || `Request failed (${response.status}).`);
    }
    return data;
  }

  
  function updateCategoryBanner(category) {
    const banner = document.getElementById('categoryBanner');
    if (!banner) return;
    if (!category || category === 'All') {
      banner.style.display = 'none';
      return;
    }
    const categoryMeta = {
      'Birthday Cakes': { desc: 'Celebrate milestones with handcrafted birthday cakes made to bring joy to every wish.', img: '/public/images/products/birthday/birthday-confetti.jpg' },
      'Wedding Cakes': {
        desc: 'Elegant, multi-tiered artisanal centerpieces baked fresh for your special day.',
        img: '/public/images/products/wedding/luxury-tiered-wedding.jpg'
      },
      'Anniversary Cakes': {
        desc: 'Sweet romance baked into every layer with premium chocolates, fresh berries, and florals.',
        img: '/public/images/products/anniversary/red-velvet.jpg'
      },
      'Cupcakes & Jars': { desc: 'Bite-sized perfection and dessert jars filled with velvety sponge and luscious fillings.', img: '/public/images/products/cupcakes-jars/gourmet-cupcake-box.jpg' },
      'Theme Cakes': { desc: 'Artistic custom creations sculpted to match your celebration theme and passions.', img: '/public/images/products/theme/minnie-mouse-theme.jpg' },
      'Photo Cakes': { desc: 'Personalised edible photo memories printed with food-safe colors on delicious fresh cake.', img: '/public/images/products/photo/golden-frame-photo-cake.jpg' }
    };
    const meta = categoryMeta[category] || { desc: 'Handcrafted cakes made fresh to order in Surathkal.', img: '/public/images/products/birthday/birthday-confetti.jpg' };
    const titleEl = document.getElementById('categoryBannerTitle');
    const descEl = document.getElementById('categoryBannerDesc');
    const imgEl = document.getElementById('categoryBannerImg');
    if (titleEl) titleEl.textContent = category;
    if (descEl) descEl.textContent = meta.desc;
    if (imgEl) imgEl.src = meta.img;
    banner.style.display = 'block';
  }

  
  function initGallery() {
    const galleryGrid = document.getElementById('galleryGrid');
    if (!galleryGrid) return;
    const galleryItems = [
      { src: '/images/gallery/8.jpeg', title: 'Golden Candle Celebration Cake', category: 'Birthday', subtitle: 'Handcrafted birthday tier with golden celebration candles and swirl accents' },
      { src: '/images/gallery/2.jpeg', title: 'Blush Floral Dream', category: 'Birthday', subtitle: 'Fresh strawberry compote layered with delicate buttercream florals' },
      { src: '/images/gallery/3.jpeg', title: 'Golden Crown Theme Cake', category: 'Theme', subtitle: 'Sculpted royal crown and intricate gold lace detailing' },
      { src: '/images/gallery/4.jpeg', title: 'Ivory Tiered Wedding Showpiece', category: 'Wedding', subtitle: 'Multi-tiered classic elegance with edible pearl finish' },
      { src: '/images/gallery/5.jpeg', title: 'Rose Gold Romance', category: 'Anniversary', subtitle: 'Handcrafted anniversary cake topped with macaron and rose accents' },
      { src: '/images/gallery/6.jpeg', title: 'Dessert Jars & Cupcake Platter', category: 'Theme', subtitle: 'Individual party jars layered with Belgian chocolate mousse and sponge' },
      { src: '/images/gallery/7.jpeg', title: 'Memories Edible Photo Cake', category: 'Anniversary', subtitle: 'Sharp food-grade photo print over light vanilla cream' }
    ];

    function renderGallery(filter = 'all') {
      const filtered = filter === 'all' 
        ? galleryItems 
        : galleryItems.filter(item => item.category.toLowerCase() === filter.toLowerCase());

      galleryGrid.innerHTML = filtered.map(item => `
        <article class="gallery-item" data-src="${item.src}" data-title="${escapeHtml(item.title)}" data-subtitle="${escapeHtml(item.subtitle)}">
          <div class="gallery-img-box">
            <img src="${item.src}" alt="${escapeHtml(item.title)}" loading="lazy" />
            <div class="gallery-hover-overlay">
              <span>🔍 View Photo</span>
            </div>
          </div>
          <div class="gallery-item-caption">
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.subtitle)}</small>
          </div>
        </article>
      `).join('');
    }

    renderGallery('all');

    // Filter bar buttons
    const filterBtns = document.querySelectorAll('.gallery-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderGallery(btn.dataset.galleryFilter);
      });
    });

    // Lightbox click & close
    const lightbox = document.getElementById('galleryLightbox');
    const lbImg = document.getElementById('lightboxImage');
    const lbTitle = document.getElementById('lightboxTitle');
    const lbSub = document.getElementById('lightboxSubtitle');

    galleryGrid.addEventListener('click', (e) => {
      const item = e.target.closest('.gallery-item');
      if (!item || !lightbox) return;
      lbImg.src = item.dataset.src;
      lbTitle.textContent = item.dataset.title;
      lbSub.textContent = item.dataset.subtitle;
      lightbox.hidden = false;
      document.body.style.overflow = 'hidden';
    });

    const closeLightbox = () => {
      if (!lightbox) return;
      lightbox.hidden = true;
      lbImg.src = '';
      document.body.style.overflow = '';
    };

    document.getElementById('lightboxCloseBtn')?.addEventListener('click', closeLightbox);
    document.getElementById('lightboxOverlay')?.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && lightbox && !lightbox.hidden) closeLightbox();
    });
  }

  const defaultHomeCategories = ['Birthday Cakes', 'Wedding Cakes', 'Anniversary Cakes', 'Theme Cakes', 'Cupcakes & Jars'];
  const homeCategoryTints = {
    'birthday cakes': '#edcaca',
    'wedding cakes': '#cbd5bd',
    'anniversary cakes': '#d9cde4',
    'theme cakes': '#c9dce2',
    'cupcakes & jars': '#eadbb8',
    'photo cakes': '#e4cfba'
  };
  let homeCategoryNames = [...defaultHomeCategories];
  let homeCategoryPage = 0;
  const homeCategoryImage = (category) => {
    const name = String(category).toLowerCase();
    if (name.includes('wedding') || name.includes('bridal')) return '/public/images/editorial/wedding-cake.jpg';
    if (name.includes('anniversary') || name.includes('engagement')) return '/public/images/editorial/anniversary-cake.jpg';
    if (name.includes('cupcake') || name.includes('jar') || name.includes('pastry')) return '/public/images/editorial/cupcakes.jpg';
    if (name.includes('theme') || name.includes('custom') || name.includes('photo')) return '/public/images/editorial/theme-cake.jpg';
    if (name.includes('birthday') || name.includes('celebration')) return '/public/images/editorial/birthday-cake.jpg';
    return '/public/images/hero-artisan-cake-optimized.jpg';
  };
  function homeCategoryPageSize() {
    return window.matchMedia('(max-width: 520px)').matches ? 2 : window.matchMedia('(max-width: 760px)').matches ? 3 : 5;
  }
  function renderHomeCategoryRibbon(categories = homeCategoryNames) {
    const ribbon = document.querySelector('.category-ribbon');
    if (!ribbon) return;
    const names = [...new Set((categories || []).filter((name) => typeof name === 'string' && name.trim() && name.toLowerCase() !== 'all').map((name) => name.trim()))];
    const categoryLookup = new Map(names.map((name) => [name.toLowerCase(), name]));
    const preferred = defaultHomeCategories.map((name) => categoryLookup.get(name.toLowerCase())).filter(Boolean);
    const preferredKeys = new Set(defaultHomeCategories.map((name) => name.toLowerCase()));
    homeCategoryNames = names.length ? [...preferred, ...names.filter((name) => !preferredKeys.has(name.toLowerCase()))] : [...defaultHomeCategories];
    const pageSize = homeCategoryPageSize();
    const pageCount = Math.max(1, Math.ceil(homeCategoryNames.length / pageSize));
    homeCategoryPage = Math.min(homeCategoryPage, pageCount - 1);
    const start = homeCategoryPage * pageSize;
    const visible = homeCategoryNames.slice(start, start + pageSize);
    ribbon.querySelectorAll('.category-orbit').forEach((item) => item.remove());
    const next = document.getElementById('homeCategoryNext');
    const customTints = ['#dce2d4', '#d7e3e8', '#e8dfc9', '#ddd7e5', '#d9e2dc'];
    visible.forEach((category, categoryIndex) => {
      const tile = document.createElement('a');
      tile.className = 'category-orbit select-category-btn';
      tile.href = 'shop.html';
      tile.dataset.category = category;
      const image = document.createElement('img');
      image.src = homeCategoryImage(category);
      image.alt = '';
      image.loading = 'lazy';
      const imageWrap = document.createElement('span');
      imageWrap.className = 'category-orbit-image';
      imageWrap.style.setProperty('--category-tint', homeCategoryTints[category.toLowerCase()] || customTints[(start + categoryIndex) % customTints.length]);
      imageWrap.append(image);
      const label = document.createElement('span');
      label.textContent = category;
      const arrow = document.createElement('i');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      tile.append(imageWrap, label, arrow);
      ribbon.insertBefore(tile, next);
    });
    const previous = document.getElementById('homeCategoryPrevious');
    if (previous) previous.disabled = homeCategoryPage === 0;
    if (next) next.disabled = homeCategoryPage >= pageCount - 1;
    ribbon.dataset.categoryPage = `${homeCategoryPage + 1}/${pageCount}`;
  }
  document.getElementById('homeCategoryPrevious')?.addEventListener('click', () => {
    if (homeCategoryPage > 0) { homeCategoryPage -= 1; renderHomeCategoryRibbon(); }
  });
  document.getElementById('homeCategoryNext')?.addEventListener('click', () => {
    if ((homeCategoryPage + 1) * homeCategoryPageSize() < homeCategoryNames.length) { homeCategoryPage += 1; renderHomeCategoryRibbon(); }
  });
  window.addEventListener('resize', () => renderHomeCategoryRibbon());

  function startHeroCakeSlideshow() {
    const image = document.querySelector('#home .hero-cake-photo');
    if (!image || image.dataset.slideshowStarted) return;
    const initialSrc = image.getAttribute('src') || '/public/images/hero-artisan-cake-optimized.jpg';
    const slides = [
      { src: initialSrc, alt: image.alt || 'Scrapbook collage of vintage celebration cakes' },
      { src: '/public/images/editorial/hero-blush.webp', alt: 'Blush vintage cake with cherries, bows and buttercream piping' },
      { src: '/public/images/editorial/hero-blue.webp', alt: 'Powder blue vintage cake with ivory daisies and ribbon bows' },
      { src: '/public/images/editorial/hero-sage.webp', alt: 'Sage green vintage cake with cream bows and delicate blossoms' },
    ];
    image.dataset.slideshowStarted = 'true';
    let index = 0;
    const dots = document.getElementById('homeHeroDots');
    const renderDots = () => {
      if (!dots) return;
      dots.replaceChildren(...slides.map((slide, slideIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hero-carousel-dot';
        button.setAttribute('aria-label', `Show cake photo ${slideIndex + 1}`);
        button.setAttribute('aria-pressed', String(slideIndex === index));
        button.addEventListener('click', () => showSlide(slideIndex));
        return button;
      }));
    };
    const showSlide = (nextIndex) => {
      index = (nextIndex + slides.length) % slides.length;
      image.classList.add('is-fading');
      window.setTimeout(() => {
        image.src = slides[index].src;
        image.alt = slides[index].alt;
        image.classList.remove('is-fading');
      }, 520);
      renderDots();
    };
    document.getElementById('homeHeroPrevious')?.addEventListener('click', () => showSlide(index - 1));
    document.getElementById('homeHeroNext')?.addEventListener('click', () => showSlide(index + 1));
    let pointerStart = null;
    image.addEventListener('pointerdown', (event) => { pointerStart = event.clientX; });
    image.addEventListener('pointerup', (event) => {
      if (pointerStart === null || Math.abs(event.clientX - pointerStart) < 45) { pointerStart = null; return; }
      showSlide(index + (event.clientX < pointerStart ? 1 : -1));
      pointerStart = null;
    });
    renderDots();
  }

  async function loadFeaturedCakes() {
    const cakesGrid = document.getElementById('cakesGrid');
    if (!cakesGrid) return;
    try {
      const { products = [], categories = [] } = await api('/catalog?all=true&sort=popular');
      renderHomeCategoryRibbon(categories);
      startHeroCakeSlideshow();
      const actualBestSellers = products.filter((product) => Number(product.unitsSold) > 0);
      featuredProductData = actualBestSellers;
      const eyebrow = document.getElementById('featuredCakesEyebrow');
      const heading = document.getElementById('featuredCakesHeading');
      if (actualBestSellers.length >= 5) {
        if (eyebrow) eyebrow.textContent = 'BESTSELLERS · COMPLETED ORDERS';
        if (heading) heading.textContent = 'Our bestsellers';
      } else {
        if (eyebrow) eyebrow.textContent = 'AWAITING COMPLETED ORDERS';
        if (heading) heading.textContent = 'Bestsellers';
      }
      const categoryAccents = { 'Birthday Cakes':'#edcaca', 'Wedding Cakes':'#cbd5bd', 'Anniversary Cakes':'#d9cde4', 'Theme Cakes':'#c9dce2', 'Cupcakes & Jars':'#eadbb8', 'Photo Cakes':'#e4cfba' };
      const savedFeaturedProducts = new Set(wishlistIds());
      cakesGrid.innerHTML = featuredProductData.map((product) => {
        const isFavorite = savedFeaturedProducts.has(product.id);
        return `
        <article class="cake-card featured-cake-card" data-featured-product="${escapeHtml(product.id)}" tabindex="0" role="group" aria-label="${escapeHtml(product.name)} cake details; press Enter to open" style="--cake-accent:${categoryAccents[product.category] || '#ded3c3'}">
          <div class="cake-card-thumb-wrap"><img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="cake-card-thumb" loading="lazy"><span class="featured-bestseller-badge">Bestseller</span><button class="featured-wishlist-toggle" type="button" data-featured-favorite="${escapeHtml(product.id)}" aria-label="${isFavorite ? 'Remove ' + escapeHtml(product.name) + ' from wishlist' : 'Add ' + escapeHtml(product.name) + ' to wishlist'}" aria-pressed="${isFavorite}">${isFavorite ? '♥' : '♡'}</button></div>
          <div class="cake-card-body">
            <span class="product-category" data-category="${escapeHtml(product.category)}">${escapeHtml(product.category)}</span>
            <h3>${escapeHtml(product.name)}</h3>
            <span class="featured-cake-rating">${product.reviewCount ? `★ ${Number(product.reviewAverage).toFixed(1)} (${product.reviewCount})` : 'No reviews yet'}</span>
            <strong class="price-tag">${money(product.sizes?.[0]?.price)}</strong>
            <button class="btn btn-primary" type="button" data-featured-add="${escapeHtml(product.id)}" ${product.stock <= 0 ? 'disabled' : ''}>${product.stock <= 0 ? 'Out of stock' : `${bagIconMarkup}<span>Add to bag</span>`}</button>
          </div>
      </article>`;
      }).join('') || '<p class="empty-category-card">Bestsellers will appear here after completed orders.</p>';
      requestAnimationFrame(updateFeaturedCakeControls);
      if (latestSalesInsights && adminView === 'overview') {
        if (latestSalesInsights.topCakes?.length) renderSalesCharts(latestSalesInsights);
        else renderTopCakeFallback();
      } else if (adminView === 'overview') renderTopCakeFallback();
    } catch (error) {
      startHeroCakeSlideshow();
      cakesGrid.innerHTML = `<p class="empty-category-card">Unable to load cakes right now. ${escapeHtml(error.message)}</p>`;
      requestAnimationFrame(updateFeaturedCakeControls);
    }
  }

  function updateFeaturedCakeControls() {
    const grid = document.getElementById('cakesGrid');
    const previous = document.getElementById('featuredCakesPrevious');
    const next = document.getElementById('featuredCakesNext');
    if (!grid || !previous || !next) return;
    const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
    previous.hidden = maxScroll <= 4;
    next.hidden = maxScroll <= 4;
    previous.disabled = grid.scrollLeft <= 4;
    next.disabled = grid.scrollLeft >= maxScroll - 4;
  }

  document.getElementById('featuredCakesPrevious')?.addEventListener('click', () => {
    const grid = document.getElementById('cakesGrid');
    grid?.scrollBy({ left: -grid.clientWidth * 0.82, behavior: 'smooth' });
  });
  document.getElementById('featuredCakesNext')?.addEventListener('click', () => {
    const grid = document.getElementById('cakesGrid');
    grid?.scrollBy({ left: grid.clientWidth * 0.82, behavior: 'smooth' });
  });
  document.getElementById('cakesGrid')?.addEventListener('scroll', updateFeaturedCakeControls, { passive: true });
  window.addEventListener('resize', updateFeaturedCakeControls);

  const CANONICAL_CATEGORIES = {
    'birthday': 'Birthday Cakes',
    'birthday cakes': 'Birthday Cakes',
    'wedding': 'Wedding Cakes',
    'wedding cakes': 'Wedding Cakes',
    'anniversary': 'Anniversary Cakes',
    'anniversary cakes': 'Anniversary Cakes',
    'cupcake': 'Cupcakes & Jars',
    'cupcakes': 'Cupcakes & Jars',
    'cupcakes-jars': 'Cupcakes & Jars',
    'cupcakes & jars': 'Cupcakes & Jars',
    'theme': 'Theme Cakes',
    'theme cakes': 'Theme Cakes',
    'photo': 'Photo Cakes',
    'photo cakes': 'Photo Cakes'
  };

  function syncCollectionCategoryState(category) {
    document.querySelectorAll('.collection-sidebar [data-category]').forEach((button) => {
      const selected = button.dataset.category === category;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  document.querySelector('.collection-sidebar')?.addEventListener('click', (event) => {
    const button = event.target.closest('.select-category-btn[data-category]');
    if (!button) return;
    event.preventDefault();
    const category = button.dataset.category;
    const categorySelect = document.getElementById('catalogCategory');
    if (categorySelect && ![...categorySelect.options].some((option) => option.value === category)) {
      categorySelect.add(new Option(category, category));
    }
    if (categorySelect) categorySelect.value = category;
    syncCollectionCategoryState(category);
    updateCategoryBanner(category);
    const nextUrl = new URL(window.location.href);
    if (category === 'All') nextUrl.searchParams.delete('category');
    else nextUrl.searchParams.set('category', category);
    nextUrl.hash = 'shop';
    window.history.replaceState({}, '', nextUrl);
    loadCatalog(1);
  });

  function selectCategoryAndScroll(categoryName, { load = true, scroll = true } = {}) {
    const canonical = CANONICAL_CATEGORIES[String(categoryName).toLowerCase()] || categoryName;
    const select = document.getElementById('catalogCategory');
    if (select) {
      if (![...select.options].some(o => o.value === canonical)) {
        select.add(new Option(canonical, canonical));
      }
      select.value = canonical;
    }
    updateCategoryBanner(canonical);
    syncCollectionCategoryState(canonical);
    if (load) loadCatalog(1);
    const shopEl = document.getElementById('shop');
    if (scroll && shopEl) {
      shopEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function loadCatalog(page = 1, { append = false } = {}) {
    const requestId = ++catalogRequestId;
    if (typeof page !== 'number') page = 1;
    if (!append) {
      const columnCount = productGrid
        ? (window.getComputedStyle(productGrid).gridTemplateColumns.split(/\s+/).filter(Boolean).length || 3)
        : 3;
      catalogPageSize = Math.max(1, columnCount) * CATALOG_ROWS_PER_BATCH;
    }
    catalogPage = page;
    const searchVal = document.getElementById('catalogSearch').value.trim();
    const categoryVal = document.getElementById('catalogCategory').value;
    const sortVal = document.getElementById('catalogSort').value;
    const dietaryVal = document.getElementById('catalogDietary').value;
    const priceVal = document.getElementById('catalogPriceRange')?.value || '';
    const flavorVal = document.getElementById('catalogFlavor')?.value || '';
    const sizeVal = document.getElementById('catalogSize')?.value || '';
    const wishlistOnly = document.getElementById('wishlistOnlyToggle')?.getAttribute('aria-pressed') === 'true';
    const savedIds = wishlistOnly ? wishlistIds() : [];

    const params = new URLSearchParams({
      search: searchVal,
      category: categoryVal,
      sort: sortVal,
      dietary: dietaryVal,
      price: priceVal,
      flavor: flavorVal,
      size: sizeVal,
      page: String(catalogPage),
      // Fetch one screenful at a time so Load more can reveal the next group.
      limit: String(catalogPageSize),
    });
    if (wishlistOnly) params.set('ids', savedIds.join(','));
    const loadMoreButton = document.getElementById('loadMoreCakes');
    if (append) {
      if (loadMoreButton) {
        loadMoreButton.disabled = true;
        loadMoreButton.textContent = 'Loading cakes…';
      }
    } else {
      productGrid.innerHTML = '<p class="empty-cart">Finding something sweet…</p>';
    }
    try {
      const data = await api(`/catalog?${params}`);
      if (requestId !== catalogRequestId) return;
      const nextProducts = data.products || [];
      productData = append ? [...productData, ...nextProducts] : nextProducts;
      catalogTotalPages = data.pages || 1;
      catalogTotalItems = data.total ?? productData.length;
      catalogPage = page;

      // Re-validate cart against current prices & availability
      for (let index = cart.length - 1; index >= 0; index -= 1) {
        const line = cart[index];
        const product = productData.find((item) => item.id === line.productId);
        if (product) {
          const size = product.sizes.find((item) => item.name === line.size);
          if (size && product.flavors.includes(line.flavor)) {
            line.name = product.name;
            line.price = size.price;
          }
        }
      }
      saveCart();
      renderCart();

      const categorySelect = document.getElementById('catalogCategory');
      const currentCategory = categorySelect.value;
      if (Array.isArray(data.categories) && data.categories.length) {
        categorySelect.innerHTML = data.categories.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('');
        if (data.categories.includes(currentCategory)) categorySelect.value = currentCategory;
      }
      renderProducts();
      renderCatalogPagination({ ...data, page });
      const isFiltered = categoryVal !== 'All' || searchVal || dietaryVal || priceVal || flavorVal || sizeVal || wishlistOnly;
      setMessage('catalogMessage', document.body.classList.contains('admin-mode') ? '' : wishlistOnly
        ? `${catalogTotalItems} wishlisted cake${catalogTotalItems === 1 ? '' : 's'} found${searchVal ? ' for this search' : ''}`
        : `${catalogTotalItems} cake${catalogTotalItems === 1 ? '' : 's'} found${isFiltered ? ' (filtered)' : ''}`);
    } catch (error) {
      if (requestId !== catalogRequestId) return;
      if (append) {
        catalogPage = Math.max(1, page - 1);
        if (loadMoreButton) {
          loadMoreButton.disabled = false;
          loadMoreButton.textContent = 'Try loading more';
        }
      } else {
        productGrid.innerHTML = '<div class="empty-category-card"><span class="empty-icon">⚠️</span><h3>Unable to load cakes</h3><p>' + escapeHtml(error.message) + '</p><button type="button" class="btn btn-outline" onclick="location.reload()">Retry</button></div>';
      }
      setMessage('catalogMessage', `Catalogue error: ${error.message}`, true);
    }
  }

  function renderCatalogPagination(data) {
    const button = document.getElementById('loadMoreCakes');
    if (!button) return;
    const hasMore = Boolean(data && Number(data.page) < Number(data.pages));
    button.hidden = !hasMore;
    button.disabled = false;
    button.textContent = 'Load more cakes';
    if (hasMore) {
      const remaining = Math.max(0, Number(data.total || catalogTotalItems) - productData.length);
      button.setAttribute('aria-label', `Load ${Math.min(catalogPageSize, remaining)} more cakes`);
    }
  }

  function renderProducts() {
    const selectedCategory = document.getElementById('catalogCategory')?.value;
    updateCategoryBanner(selectedCategory);
    const isSpecificCat = selectedCategory && selectedCategory !== 'All';

    if (!productData.length) {
      productGrid.innerHTML = `
        <div class="empty-category-card">
          <span class="empty-icon">🍰</span>
          <h3>No cakes currently available</h3>
          <p>${document.getElementById('wishlistOnlyToggle')?.getAttribute('aria-pressed') === 'true' ? (wishlistIds().length ? 'No wishlisted cakes match these filters. Try clearing your search or filters.' : 'Your wishlist is empty. Tap a heart on any cake to save it here.') : isSpecificCat ? `We currently don't have cakes listed under "${escapeHtml(selectedCategory)}".` : 'No cakes matched your search or dietary filter.'}</p>
          ${isSpecificCat ? '<p class="empty-admin-hint">Bakery administrators can add fresh cakes to this category at any time through the <strong>Cake Catalogue</strong> section in the Admin Dashboard.</p>' : ''}
          <button type="button" class="btn btn-outline" id="emptyClearCategoryBtn">← View All Cakes</button>
        </div>`;
      const emptyBtn = document.getElementById('emptyClearCategoryBtn');
      if (emptyBtn) {
        emptyBtn.addEventListener('click', () => {
          document.getElementById('catalogSearch').value = '';
          document.getElementById('catalogCategory').value = 'All';
          document.getElementById('catalogDietary').value = '';
          document.getElementById('catalogSort').value = 'popular';
          syncCollectionCategoryState('All');
          const banner = document.getElementById('categoryBanner');
          if (banner) banner.style.display = 'none';
          loadCatalog(1);
        });
      }
      return;
    }

    const categoryPlaceholders = {
      'Birthday Cakes': '/public/images/products/birthday/birthday-confetti.jpg',
      'Wedding Cakes': '/public/images/products/wedding/luxury-tiered-wedding.jpg',
      'Anniversary Cakes': '/public/images/products/anniversary/red-velvet.jpg',
      'Cupcakes & Jars': '/public/images/products/cupcakes-jars/gourmet-cupcake-box.jpg',
      'Theme Cakes': '/public/images/products/theme/minnie-mouse-theme.jpg',
      'Photo Cakes': '/public/images/products/photo/golden-frame-photo-cake.jpg'
    };

    const isShopPage = document.body.classList.contains('shop-page');
    const savedFavorites = new Set(wishlistIds());
    const accents = { 'Birthday Cakes':'#edcaca', 'Wedding Cakes':'#cbd5bd', 'Anniversary Cakes':'#d9cde4', 'Theme Cakes':'#c9dce2', 'Cupcakes & Jars':'#eadbb8', 'Photo Cakes':'#e4cfba' };
    productGrid.innerHTML = productData.map((product) => {
      const isOutOfStock = product.stock !== undefined && product.stock <= 0;
      const isLowStock = product.stock !== undefined && product.stock > 0 && product.stock <= 5;
      const stockBadge = isOutOfStock
        ? '<span class="stock-status-pill badge-danger" style="margin-left:8px;">Out of stock</span>'
        : isLowStock
          ? `<span class="stock-status-pill badge-warning" style="margin-left:8px;">Only ${product.stock} left</span>`
          : '';

      const fallbackImg = categoryPlaceholders[product.category] || '/public/images/products/birthday/birthday-confetti.jpg';
      const imgSrc = product.image && !product.image.includes('/images/gallery/') ? product.image : fallbackImg;
      const isPlaceholder = imgSrc.includes('placeholder-');
      const isFavorite = savedFavorites.has(product.id);

      if (isShopPage) return `
        <article class="product-card shop-product-card" data-product-card="${escapeHtml(product.id)}" tabindex="0" aria-label="View ${escapeHtml(product.name)} details" style="--cake-accent:${accents[product.category] || '#c8b8a7'}">
          <div class="product-photo-wrap">
            <img class="product-photo ${isPlaceholder ? 'is-placeholder' : ''}" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.name)}" loading="lazy">
            <button class="favorite-toggle" type="button" data-action="favorite" data-product="${escapeHtml(product.id)}" aria-label="${isFavorite ? 'Remove ' + escapeHtml(product.name) + ' from wishlist' : 'Add ' + escapeHtml(product.name) + ' to wishlist'}" aria-pressed="${isFavorite ? 'true' : 'false'}">${isFavorite ? '♥' : '♡'}</button>
          </div>
          <div class="product-content">
            <div class="shop-product-title-row"><h3>${escapeHtml(product.name)}</h3><span class="product-category">${escapeHtml(product.category.replace(/ Cakes$/,'').replace(' & Jars',''))}</span></div>
            <p class="product-description">${escapeHtml(product.description)}</p>
            <details class="shop-product-options"><summary>Choose flavour &amp; size</summary>
              <label>Flavour<select class="product-flavor">${product.flavors.map((flavor) => `<option value="${escapeHtml(flavor)}">${escapeHtml(flavor)}</option>`).join('')}</select></label>
              <label>Size<select class="product-size">${product.sizes.map((size) => `<option value="${escapeHtml(size.name)}" data-price="${size.price}">${escapeHtml(size.name)} · ${money(size.price)}</option>`).join('')}</select></label>
            </details>
            <div class="product-buy-row"><strong class="product-price">${money(product.sizes[0].price)}</strong><button class="btn btn-primary" type="button" data-action="add" data-product="${escapeHtml(product.id)}" ${isOutOfStock ? 'disabled' : ''}>${isOutOfStock ? 'Out of stock' : `${bagIconMarkup}<span>Add to bag</span>`}</button></div>
          </div>
        </article>`;

      return `
        <article class="product-card" data-product-card="${escapeHtml(product.id)}">
          <div class="product-photo-wrap">
            <img class="product-photo ${isPlaceholder ? 'is-placeholder' : ''}" src="${escapeHtml(imgSrc)}" alt="${escapeHtml(product.name)}" loading="lazy">
            ${isPlaceholder ? '<span class="placeholder-tag">Fresh Bake · Photo Coming Soon</span>' : ''}
          </div>
          <div class="product-content">
            ${product.photoCredit ? `<span class="photo-credit">${escapeHtml(product.photoCredit)}</span>` : ''}
            <div class="product-meta">
              <span class="product-category">${escapeHtml(product.category)}</span>
              <span class="product-rating">${product.reviewCount ? `★ ${Number(product.reviewAverage).toFixed(1)} (${product.reviewCount})` : '★ No reviews yet'}${stockBadge}</span>
            </div>
            <h3>${escapeHtml(product.name)}</h3>
            <p class="product-description">${escapeHtml(product.description)}</p>
            <label>Choose flavour<select class="product-flavor">${product.flavors.map((flavor) => `<option value="${escapeHtml(flavor)}">${escapeHtml(flavor)}</option>`).join('')}</select></label>
            <label>Choose size<select class="product-size">${product.sizes.map((size) => `<option value="${escapeHtml(size.name)}" data-price="${size.price}">${escapeHtml(size.name)} · ${money(size.price)}</option>`).join('')}</select></label>
            <p class="allergen-note"><strong>Potential allergens:</strong> ${escapeHtml(product.allergens.join(', '))}. Recipes and cross-contact can vary; please confirm with the bakery before ordering.</p>
            ${product.dietaryTags?.length ? `<p class="dietary-tags">Verified: ${product.dietaryTags.map((tag) => escapeHtml(tag)).join(' · ')}</p>` : ''}
            <div class="product-buy-row">
              <strong class="product-price">${money(product.sizes[0].price)}</strong>
              <button class="favorite-toggle" type="button" data-action="favorite" data-product="${escapeHtml(product.id)}" aria-pressed="${isFavorite ? 'true' : 'false'}">${isFavorite ? '♥ Saved' : '♡ Save'}</button>
              <button class="btn btn-primary" type="button" data-action="add" data-product="${escapeHtml(product.id)}" ${isOutOfStock ? 'disabled' : ''}>${isOutOfStock ? 'Out of stock' : `${bagIconMarkup}<span>Add to bag</span>`}</button>
            </div>
            <button class="product-reviews-link" type="button" data-action="open-modal" data-product="${escapeHtml(product.id)}" style="margin-top:auto; margin-bottom:12px;">
              ${product.reviewCount ? `★ ${Number(product.reviewAverage).toFixed(1)} · Reviews (${product.reviewCount}) →` : 'Write a review / Details →'}
            </button>
          </div>
        </article>`;
    }).join('');
  }

  
  let cartToastTimer = null;
  function showCartToast(title, meta, isError = false, productImage = '') {
    let toast = document.getElementById('cartSuccessToast');
    if (!toast) {
      toast = document.createElement('aside');
      toast.id = 'cartSuccessToast';
      toast.className = 'cart-success-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }
    clearTimeout(cartToastTimer);
    toast.innerHTML = `
      <div class="toast-card ${isError ? 'toast-error' : ''}">
        ${productImage && !isError ? `<span class="toast-product-wrap"><img class="toast-product-thumb" src="${escapeHtml(productImage)}" alt=""><span class="toast-product-check" aria-hidden="true">✓</span></span>` : `<div class="toast-icon-wrap" style="${isError ? 'background:#ffebee; color:#d32f2f;' : ''}">
          ${isError ? `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#d32f2f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          ` : `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#E0587D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `}
        </div>`}
        <div class="toast-body">
          <strong class="toast-title">${escapeHtml(title)}</strong>
          ${meta ? `<p class="toast-meta">${escapeHtml(meta)}</p>` : ''}
          ${!isError ? '<a href="cart.html" class="toast-btn-view">View Bag <span aria-hidden="true">→</span></a>' : ''}
        </div>
        <button type="button" class="toast-close" aria-label="Dismiss notification">&times;</button>
      </div>
    `;
    requestAnimationFrame(() => {
      toast.classList.add('is-visible');
    });
    toast.querySelector('.toast-close')?.addEventListener('click', () => {
      toast.classList.remove('is-visible');
    }, { once: true });
    cartToastTimer = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 4500);
  }

  function showAddToCartToast(productName, flavor, sizeName, image) {
    showCartToast('Added to Bag!', `${productName} (${sizeName})`, false, image);
  }

  function showAddToCartError(message) {
    showCartToast('Could not add to cart', message || 'Please check selections and try again.', true);
  }

  function showWishlistSuccess(productName = 'Your cake', action = 'added') {
    let toast = document.getElementById('wishlistSuccessToast');
    if (!toast) {
      toast = document.createElement('aside');
      toast.id = 'wishlistSuccessToast';
      toast.className = 'wishlist-success-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.innerHTML = `<span class="wishlist-toast-icon" aria-hidden="true">♥<i>✧</i></span><div class="wishlist-toast-copy"><h2 data-wishlist-toast-title></h2><p><span data-wishlist-toast-product></span> <span data-wishlist-toast-message></span></p><a href="wishlist.html">View Wishlist <span aria-hidden="true">→</span></a></div><button type="button" class="wishlist-toast-close" aria-label="Dismiss notification">×</button>`;
      document.body.append(toast);
      toast.querySelector('.wishlist-toast-close').addEventListener('click', () => toast.classList.remove('is-visible'));
    }
    toast.querySelector('[data-wishlist-toast-product]').textContent = productName;
    const added = action === 'added';
    toast.querySelector('[data-wishlist-toast-title]').textContent = added ? 'Added to Wishlist' : 'Removed from Wishlist';
    toast.querySelector('[data-wishlist-toast-message]').textContent = added ? 'has been saved to your favorites.' : 'has been removed from your favorites.';
    toast.querySelector('.wishlist-toast-icon').textContent = added ? '♥' : '♡';
    toast.classList.add('is-visible');
    clearTimeout(toast._dismissTimer);
    toast._dismissTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 5200);
  }

  window.addEventListener('cake-cart-sync-error', (event) => {
    showCartToast('Cart could not be saved', event.detail || 'Please try again.', true);
  });

  function renderCart() {
    const count = cart.reduce((sum, line) => sum + line.quantity, 0);
    for (const id of ['navCartCount', 'shopCartCount', 'accountCartCount', 'settingsCartCount']) {
      const badge = document.getElementById(id);
      if (badge) badge.textContent = String(count);
    }
    document.querySelectorAll('.menu-cart-count').forEach((badge) => { badge.textContent = String(count); });
    const navCart = document.getElementById('navCartLink');
    if (navCart) navCart.setAttribute('aria-label', `Cart, ${count} item${count === 1 ? '' : 's'}`);
  }

  renderCart();
  if (getToken() && window.CakeCart?.loadAccountCart) {
    const startingRevision = cartRevision;
    window.CakeCart.loadAccountCart().then((saved) => {
      if (cartRevision !== startingRevision) return;
      cart.splice(0, cart.length, ...saved);
      renderCart();
    }).catch((error) => showCartToast('Could not load saved cart', error.message, true));
  }

  async function loadReviews(productId, card) {
    const list = card.querySelector('.review-list');
    try {
      const data = await api(`/catalog/${encodeURIComponent(productId)}/reviews`);
      list.innerHTML = data.reviews.length ? data.reviews.map((review) => `
        <article class="review-entry"><strong>${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} (${review.rating} / 5) · ${escapeHtml(review.customerName)}</strong><p>${escapeHtml(review.comment)}</p><small>${new Date(review.createdAt).toLocaleDateString('en-IN')}</small></article>`).join('') : '<p class="empty-cart">Be the first to review this cake.</p>';
    } catch (error) {
      list.innerHTML = `<p class="empty-cart">${escapeHtml(error.message)}</p>`;
    }
  }

  function orderCard(order, isAdmin = false) {
    const formatTime = (value) => {
      if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return '';
      const [hourText, minute] = value.split(':'); const hour = Number(hourText);
      return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
    };
    const indiaToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const deliveryDay = new Date(order.customer.deliveryDate).toISOString().slice(0, 10);
    const timeline = (order.tracking || []).map((event) => {
      const kind = event.type === 'payment' ? 'Payment' : event.type === 'refund' ? 'Refund' : 'Order status';
      const change = event.from && event.to ? `${event.type === 'payment' || event.type === 'refund' ? paymentStatusLabel(event.from) : orderStatusLabel(event.from)} → ${event.type === 'payment' || event.type === 'refund' ? paymentStatusLabel(event.to) : orderStatusLabel(event.to)}` : orderStatusLabel(event.status || order.status);
      return `<li><strong>${kind}: ${escapeHtml(change)}</strong>${event.note ? ` · ${escapeHtml(event.note)}` : ''}<small>By ${escapeHtml(event.changedBy || 'system')}</small><time>${new Date(event.at).toLocaleString('en-IN')}</time></li>`;
    }).join('');
    const items = order.items.map((item) => `${item.quantity} × ${escapeHtml(item.name)} (${escapeHtml(item.flavor)}, ${escapeHtml(item.size)})${item.cakeMessage ? ` · Cake message: “${escapeHtml(item.cakeMessage)}”` : ''}`).join(' · ');
    const userName = order.user?.name ? `<span class="order-delivery">Customer: ${escapeHtml(order.user.name)} · ${escapeHtml(order.user.email)}</span>` : '';
    const retry = !isAdmin && order.paymentMethod === 'razorpay' && isOrderUnpaid(order.paymentStatus)
      ? `<button class="retry-payment" type="button" data-order-action="retry" data-order="${escapeHtml(order.orderNumber)}">Pay online</button>` : '';
      const canRefund = order.status === 'cancelled' && order.paymentStatus === 'refund-due' && order.total > 0 && order.refundStatus !== 'processed';
      const refundLabel = order.paymentMethod !== 'razorpay' ? 'Record refund sent' : order.refundStatus === 'pending' ? 'Check refund status' : order.refundStatus === 'failed' ? 'Retry refund' : 'Start refund';
      const refundControl = isAdmin && canRefund ? `<button type="button" data-order-action="refund" data-order="${escapeHtml(order.orderNumber)}">${refundLabel}</button>` : '';
    const adminControls = isAdmin ? `
      <div class="order-admin-controls"><label>Update status<select data-next-status="${escapeHtml(order.orderNumber)}">${adminOrderStatuses.map((status) => `<option value="${status}" ${((status === 'placed' && ['placed', 'pending'].includes(order.status)) || status === order.status) ? 'selected' : ''}>${orderStatusLabel(status)}</option>`).join('')}</select></label><label>Customer update<input type="text" maxlength="240" data-status-note="${escapeHtml(order.orderNumber)}" placeholder="Optional note"></label><div class="order-shipping-controls"><label>Tracking number<input type="text" maxlength="100" data-tracking-number="${escapeHtml(order.orderNumber)}" value="${escapeHtml(order.trackingNumber || '')}" placeholder="Optional"></label><label>Carrier<input type="text" maxlength="100" data-shipping-carrier="${escapeHtml(order.orderNumber)}" value="${escapeHtml(order.shippingCarrier || '')}" placeholder="Bakery delivery"></label><label>Estimated delivery<input type="date" data-estimated-delivery="${escapeHtml(order.orderNumber)}" value="${order.estimatedDelivery ? new Date(order.estimatedDelivery).toISOString().slice(0, 10) : ''}"></label></div><button type="button" data-order-action="status" data-order="${escapeHtml(order.orderNumber)}">Save update</button>${isOfflinePayment(order.paymentMethod) && isOrderUnpaid(order.paymentStatus) && order.status !== 'cancelled' ? `<button type="button" data-order-action="paid" data-order="${escapeHtml(order.orderNumber)}">Record payment received</button>` : ''}${refundControl}</div>` : '';
    const cancelControl = !isAdmin && indiaToday < deliveryDay && statuses.indexOf(order.status) <= statuses.indexOf(cancellationCutoff) && order.status !== 'cancelled' ? `<button class="retry-payment" type="button" data-order-action="cancel" data-order="${escapeHtml(order.orderNumber)}">Cancel order</button>` : '';
    const fulfillment = order.customer.deliveryType === 'pickup' ? 'Bakery pickup · free' : `Delivery fee: ${Number(order.deliveryFee || 0) ? money(order.deliveryFee) : 'Free'}${order.deliveryDistanceBand ? ` · ${escapeHtml(order.deliveryDistanceBand)}` : ''}${order.customer.area ? ` · ${escapeHtml(order.customer.area)}, ${escapeHtml(order.customer.city)}` : ''}`;
    const orderedDate = new Date(order.createdAt).toLocaleDateString('en-IN');
    const deliveryDate = new Date(order.customer.deliveryDate).toLocaleDateString('en-IN');
    const requestedTime = formatTime(order.customer.deliveryTime);
    const badges = `<div class="order-badges"><span class="order-badge">${escapeHtml(orderStatusLabel(order.status))}</span><span class="order-badge">${escapeHtml(paymentStatusLabel(order.paymentStatus))} · ${escapeHtml(paymentMethodLabel(order.paymentMethod))}</span>${order.refundStatus && order.refundStatus !== 'none' ? `<span class="order-badge">refund ${escapeHtml(order.refundStatus)}</span>` : ''}</div>`;
    if (isAdmin) {
      const adminItems = order.items.map((item) => `<li><span>${escapeHtml(item.name)} <small>${escapeHtml(item.flavor)} · ${escapeHtml(item.size)}${item.cakeMessage ? ` · Cake message: “${escapeHtml(item.cakeMessage)}”` : ''}</small></span><strong>× ${item.quantity}</strong><b>${money(item.unitPrice * item.quantity)}</b></li>`).join('');
      const destination = order.customer.deliveryType === 'pickup' ? 'Collect from the bakery' : escapeHtml(order.customer.address || 'Address not provided');
      return `<article class="order-card admin-order-card" data-payment-method="${escapeHtml(order.paymentMethod)}" data-payment-status="${escapeHtml(order.paymentStatus)}"><header class="order-card-top"><div class="admin-order-title"><span class="eyebrow">ORDER ${escapeHtml(order.orderNumber)}</span><h4>${money(order.total)}</h4><p>Placed ${orderedDate} <span>·</span> ${order.customer.deliveryType === 'pickup' ? 'Pickup' : 'Delivery'} on ${deliveryDate}${requestedTime ? ` by ${requestedTime}` : ''}</p></div>${badges}</header><div class="admin-order-details"><section class="admin-order-block"><h5>Customer</h5><strong>${escapeHtml(order.user?.name || order.customer.name || 'Customer')}</strong><span>${escapeHtml(order.user?.email || order.customer.email || 'Email not provided')}</span><span>${escapeHtml(order.customer.phone || 'Phone not provided')}</span></section><section class="admin-order-block admin-order-items"><h5>Items <span>${order.items.length}</span></h5><ul>${adminItems}</ul></section><section class="admin-order-block"><h5>${order.customer.deliveryType === 'pickup' ? 'Pickup' : 'Delivery'}</h5><strong>${destination}</strong><span>${fulfillment}</span>${order.customer.postalCode ? `<span>PIN ${escapeHtml(order.customer.postalCode)}</span>` : ''}${order.customer.notes ? `<p><b>Customer note</b>${escapeHtml(order.customer.notes)}</p>` : ''}</section></div><section class="admin-order-activity"><h5>Order and payment history</h5><ol class="order-timeline">${timeline || '<li>No order updates recorded yet.</li>'}</ol></section>${adminControls}</article>`;
    }
    const shippingDetails = order.status === 'shipped' ? `<p class="order-delivery"><strong>Your cake is on its way.</strong>${order.trackingNumber ? ` Tracking: ${escapeHtml(order.trackingNumber)}` : ''}${order.shippingCarrier ? ` · ${escapeHtml(order.shippingCarrier)}` : ''}${order.estimatedDelivery ? ` · Estimated ${new Date(order.estimatedDelivery).toLocaleDateString('en-IN')}` : ''}</p>` : '';
    return `<article class="order-card"><div class="order-card-top"><div><h4>${escapeHtml(order.orderNumber)} · ${money(order.total)}</h4><span class="order-number">Ordered ${orderedDate} · ${order.customer.deliveryType === 'pickup' ? 'Pickup' : 'Delivery'} ${deliveryDate}${requestedTime ? ` · requested by ${requestedTime}` : ''}</span></div>${badges}</div>${userName}<p class="order-items-text">${items}</p><p class="order-delivery">${fulfillment}</p><p class="order-delivery">${order.customer.deliveryType === 'pickup' ? 'Collect from the bakery' : `Deliver to: ${escapeHtml(order.customer.address)}`} · ${escapeHtml(order.customer.phone)}</p>${order.customer.notes ? `<p class="order-delivery">Note: ${escapeHtml(order.customer.notes)}</p>` : ''}${shippingDetails}${retry}${cancelControl}<ol class="order-timeline">${timeline}</ol></article>`;
  }

  async function loadCustomerOrders() {
    if (getUser()?.role === 'admin') return;
    if (!getToken()) {
      document.getElementById('customerOrders').innerHTML = '<p class="empty-cart">Sign in to see your order tracking and history.</p>';
      setMessage('ordersMessage', '');
      return;
    }
    try {
      const data = await api('/orders/mine');
      document.getElementById('customerOrders').innerHTML = data.orders.length ? data.orders.map((order) => orderCard(order)).join('') : '<p class="empty-cart">Your orders will appear here after checkout.</p>';
      setMessage('ordersMessage', `${data.orders.length} recent order${data.orders.length === 1 ? '' : 's'}`);
    } catch (error) {
      setMessage('ordersMessage', error.message, true);
    }
  }

  async function loadAccount() {
    if (!getToken() || getUser()?.role === 'admin') return;
    try {
      accountData = await api('/auth/account');
      document.getElementById('customerAccount').hidden = false;
      document.getElementById('referralCodeDisplay').textContent = accountData.user.referralCode || '';
      document.getElementById('referralTerms').textContent = `Share your code with a friend. After their first paid order is completed, they receive ${accountData.referralPolicy.referralFriendPoints} bonus points and you receive ${accountData.referralPolicy.referralOwnerPoints} points.`;
      const rewardPoints = Number(accountData.user.loyaltyPoints || 0);
      document.getElementById('loyaltyBalance').textContent = `${rewardPoints.toLocaleString('en-IN')} points · ₹${(rewardPoints / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} value`;
      document.getElementById('loyaltyPointsToRedeem').max = String(accountData.user.loyaltyPoints || 0);
      document.getElementById('loyaltyHistory').innerHTML = accountData.loyaltyHistory.length ? accountData.loyaltyHistory.map((item) => `<p>${escapeHtml(item.kind)} · ${item.kind === 'redeemed' ? '−' : '+'}${item.points} points${item.orderNumber ? ` · ${escapeHtml(item.orderNumber)}` : ''}${item.note ? ` · ${escapeHtml(item.note)}` : ''} · ${new Date(item.createdAt).toLocaleDateString('en-IN')}</p>`).join('') : '<p>No reward activity yet.</p>';
      document.getElementById('savedAddresses').innerHTML = accountData.user.savedAddresses.length ? accountData.user.savedAddresses.map((address) => `<article class="account-row"><span><strong>${escapeHtml(address.label || address.recipientName || 'Saved address')}</strong><small>${escapeHtml(address.address)}, ${escapeHtml(address.area)}, ${escapeHtml(address.city)} ${escapeHtml(address.postalCode)}</small></span><button class="store-secondary" type="button" data-use-address="${escapeHtml(address._id)}">Use</button><button class="store-secondary" type="button" data-delete-address="${escapeHtml(address._id)}">Delete</button></article>`).join('') : '<p>No saved addresses yet.</p>';
      const favorites = accountData.user.favoriteProducts || [];
      document.getElementById('favoriteCakes').innerHTML = favorites.length ? favorites.map((slug) => { const product = productData.find((item) => item.id === slug); return `<p>${escapeHtml(product?.name || slug)} <button class="store-secondary" type="button" data-remove-favorite="${escapeHtml(slug)}">Remove</button></p>`; }).join('') : '<p>Save cakes with the ♡ button in the catalogue.</p>';
      document.getElementById('pastOrders').innerHTML = accountData.orders.length ? accountData.orders.map((order) => `<article class="account-row"><span><strong>${escapeHtml(order.orderNumber)} · ${money(order.total)}</strong><small>${escapeHtml(order.status)} · ${new Date(order.createdAt).toLocaleDateString('en-IN')}</small></span><button class="store-secondary" type="button" data-reorder="${escapeHtml(order.orderNumber)}">Reorder</button></article>`).join('') : '<p>No past orders yet.</p>';
      renderProducts();
      renderCart();
    } catch (error) { document.getElementById('customerAccount').hidden = false; setMessage('accountMessage', error.message, true); }
  }

  document.getElementById('savedAddressForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try { await api('/auth/account/addresses', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); setMessage('accountMessage', 'Address saved.'); await loadAccount(); }
    catch (error) { setMessage('accountMessage', error.message, true); }
  });
  document.getElementById('customerAccount')?.addEventListener('click', async (event) => {
    const use = event.target.closest('[data-use-address]');
    const remove = event.target.closest('[data-delete-address]');
    const removeFavorite = event.target.closest('[data-remove-favorite]');
    const reorder = event.target.closest('[data-reorder]');
    try {
      if (use) {
        const address = accountData.user.savedAddresses.find((item) => item._id === use.dataset.useAddress);
        if (!address) return;
        sessionStorage.setItem('checkoutAddress', JSON.stringify({ ...address, name: address.recipientName || accountData.user.name || '' }));
        window.location.href = 'checkout.html#checkout';
        return;
      } else if (remove) { await api(`/auth/account/addresses/${encodeURIComponent(remove.dataset.deleteAddress)}`, { method: 'DELETE' }); await loadAccount(); }
      else if (removeFavorite) {
        const removedId = removeFavorite.dataset.removeFavorite;
        await api(`/auth/account/favorites/${encodeURIComponent(removedId)}`, { method: 'PUT' });
        saveWishlist(readWishlist().filter((id) => id !== removedId));
        await loadAccount();
      }
      else if (reorder) {
        const order = accountData.orders.find((item) => item.orderNumber === reorder.dataset.reorder);
        if (!order) return;
        const currentCatalog = await api('/catalog?search=&category=All&sort=popular');
        let unavailable = 0;
        for (const item of order.items || []) {
          const product = currentCatalog.products.find((candidate) => candidate.id === item.productId);
          const size = product?.sizes.find((candidate) => candidate.name === item.size);
          if (!product || !size || !product.flavors.includes(item.flavor)) { unavailable += 1; continue; }
          const line = cart.find((candidate) => candidate.productId === product.id && candidate.size === item.size && candidate.flavor === item.flavor && (candidate.cakeMessage || '') === (item.cakeMessage || ''));
          if (line) line.quantity = Math.min(10, line.quantity + item.quantity);
          else cart.push({ productId: product.id, name: product.name, image: item.image || product.image, size: item.size, flavor: item.flavor, cakeMessage: item.cakeMessage || '', price: size.price, quantity: Math.min(10, item.quantity) });
        }
        saveCart(); renderCart(); setMessage('accountMessage', unavailable ? `Available cakes added. ${unavailable} item(s) are no longer available.` : 'Past order added to your cart. Review current prices before checkout.');
      }
    } catch (error) { setMessage('accountMessage', error.message, true); }
  });

  async function loadAdminOrders() {
    if (getUser()?.role !== 'admin') return;
    const filter = document.getElementById('adminOrderFilter').value;
    const list = document.getElementById('adminOrders');
    list.setAttribute('aria-busy', 'true');
    list.classList.add('is-loading');
    try {
      const params = new URLSearchParams({ page: String(adminPage) });
      if (filter) params.set('status', filter);
      const query = `?${params}`;
      const data = await api(`/orders/admin/all${query}`);
      adminPages = Math.max(1, data.pages);
      document.getElementById('adminPageLabel').textContent = `Page ${data.page} of ${adminPages}`;
      document.getElementById('adminOrders').innerHTML = data.orders.length ? data.orders.map((order) => orderCard(order, true)).join('') : '<p class="empty-cart">No orders match this filter.</p>';
      if (adminView === 'overview') renderRecentAdminOrders(data.orders.slice(0, 5));
      setMessage('adminMessage', `${data.count} order${data.count === 1 ? '' : 's'} · page ${data.page} of ${Math.max(1, data.pages)}`);
      return true;
    } catch (error) {
      setMessage('adminMessage', error.message, true);
      return false;
    } finally {
      list.removeAttribute('aria-busy');
      list.classList.remove('is-loading');
    }
  }

  function renderRecentAdminOrders(orders) {
    const host = document.getElementById('recentAdminOrders');
    if (!host) return;
    host.innerHTML = orders.length ? `<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Total</th></tr></thead><tbody>${orders.map((order) => `<tr><td>${escapeHtml(order.orderNumber)}</td><td>${escapeHtml(order.user?.name || order.customer?.name || 'Customer')}</td><td>${new Date(order.createdAt).toLocaleDateString('en-IN')}</td><td><span class="admin-status-badge status-${escapeHtml(order.status)}">${escapeHtml(order.status.replaceAll('-', ' '))}</span></td><td>${money(order.total)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="admin-empty-state"><span aria-hidden="true">▤</span><strong>No orders yet</strong><p>New customer orders will appear here.</p></div>';
  }

  async function loadOverviewRecentOrders() {
    const host = document.getElementById('recentAdminOrders');
    if (!host) return;
    host.setAttribute('aria-busy', 'true');
    try {
      const data = await api('/orders/admin/all?page=1', { cache: 'no-store' });
      renderRecentAdminOrders((data.orders || []).slice(0, 5));
    } catch (error) {
      host.innerHTML = `<div class="admin-empty-state admin-empty-error"><strong>Could not load recent orders</strong><p>${escapeHtml(error.message)}</p></div>`;
    } finally { host.removeAttribute('aria-busy'); }
  }

  async function loadDashboardRecentEnquiries() {
    const host = document.getElementById('dashboardRecentEnquiries');
    if (!host) return;
    host.setAttribute('aria-busy', 'true');
    try {
      const { enquiries = [] } = await api('/admin/enquiries', { cache: 'no-store' });
      host.innerHTML = enquiries.slice(0, 5).map((item) => `<div class="dashboard-enquiry-row"><span class="dashboard-enquiry-dot" aria-hidden="true"></span><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.occasion)}</span><time>${new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</time></div>`).join('') || '<p class="chart-empty">No custom cake enquiries yet.</p>';
    } catch (error) { host.innerHTML = `<p class="chart-empty">${escapeHtml(error.message)}</p>`; }
    finally { host.removeAttribute('aria-busy'); }
  }

  let adminCategoryPage = 1;
  let adminCategoryPages = 1;
  let adminCategorySearch = '';
  let adminCategoryRequest = 0;
  const adminCategoryHost = document.getElementById('adminCategories');
  const adminCategoryHeading = document.querySelector('#admin-category-section .admin-section-heading');
  adminCategoryHeading.querySelector('p').textContent = 'Create and organize cake categories. New categories will be available when you add a product.';
  const adminCategoryMessage = document.createElement('p');
  adminCategoryMessage.id = 'adminCategoriesMessage';
  adminCategoryMessage.className = 'store-message';
  adminCategoryMessage.setAttribute('role', 'status');
  const addCategoryButton = document.createElement('button');
  addCategoryButton.type = 'button';
  addCategoryButton.className = 'btn btn-primary admin-compact-button';
  addCategoryButton.textContent = 'Add category';
  const categoryToolbar = document.createElement('div');
  categoryToolbar.className = 'admin-product-toolbar';
  const categorySearchInput = document.createElement('input');
  categorySearchInput.type = 'search';
  categorySearchInput.className = 'admin-product-search';
  categorySearchInput.placeholder = 'Search categories';
  categorySearchInput.setAttribute('aria-label', 'Search categories');
  const loadMoreCategoriesButton = document.createElement('button');
  loadMoreCategoriesButton.type = 'button';
  loadMoreCategoriesButton.className = 'store-secondary admin-load-more';
  loadMoreCategoriesButton.textContent = 'Load more';
  loadMoreCategoriesButton.hidden = true;
  const refreshCategoriesButton = document.createElement('button');
  refreshCategoriesButton.type = 'button';
  refreshCategoriesButton.className = 'admin-icon-refresh';
  refreshCategoriesButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.8-4L4 9"/><path d="M4 4v5h5M4 13a8 8 0 0 0 14.8 4L20 15"/><path d="M20 20v-5h-5"/></svg><span>Refresh</span>';
  refreshCategoriesButton.title = 'Refresh categories';
  refreshCategoriesButton.setAttribute('aria-label', 'Refresh categories');
  categoryToolbar.append(categorySearchInput, refreshCategoriesButton, addCategoryButton);
  const categoryForm = document.createElement('form');
  categoryForm.className = 'admin-form admin-category-form';
  categoryForm.style.display = 'none';
  categoryForm.innerHTML = '<label class="admin-field">Category name<input name="name" maxlength="40" placeholder="e.g. Seasonal Cakes" required></label><div class="admin-form-actions"><button type="submit" class="btn btn-primary">Save category</button><button type="button" class="store-secondary" data-cancel-category>Cancel</button></div>';
  const categoryPageLabel = document.createElement('p');
  categoryPageLabel.className = 'admin-category-page-label';
  adminCategoryHeading.insertAdjacentElement('afterend', categoryToolbar);
  adminCategoryHeading.parentElement.insertBefore(categoryForm, adminCategoryHost);
  adminCategoryHeading.parentElement.insertBefore(adminCategoryMessage, adminCategoryHost);
  adminCategoryHeading.parentElement.insertBefore(categoryPageLabel, adminCategoryHost);
  adminCategoryHost.insertAdjacentElement('afterend', loadMoreCategoriesButton);
  addCategoryButton.addEventListener('click', () => {
    const isOpen = categoryForm.style.display !== 'none';
    categoryForm.style.display = isOpen ? 'none' : 'grid';
    addCategoryButton.textContent = isOpen ? 'Add category' : 'Close form';
    if (!isOpen) categoryForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  categoryForm.querySelector('[data-cancel-category]').addEventListener('click', () => {
    categoryForm.reset();
    categoryForm.style.display = 'none';
    addCategoryButton.textContent = 'Add category';
  });
  categoryForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = categoryForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
      const result = await api('/catalog/admin/categories', { method: 'POST', body: JSON.stringify({ name: categoryForm.elements.name.value }) });
      const categoryName = result.category.name;
      const productCategorySelect = document.querySelector('#productAdminForm [name="category"]');
      if (![...productCategorySelect.options].some((option) => option.value === categoryName)) productCategorySelect.add(new Option(categoryName, categoryName), productCategorySelect.querySelector('option[value="other"]'));
      categoryForm.reset();
      categoryForm.style.display = 'none';
      addCategoryButton.textContent = 'Add category';
      setMessage('adminCategoriesMessage', 'Category added successfully.');
      await Promise.all([loadAdminCategories(), loadCatalog()]);
    } catch (error) { setMessage('adminCategoriesMessage', error.message, true); }
    finally { submitButton.disabled = false; }
  });
  let categorySearchTimer;
  categorySearchInput.addEventListener('input', () => {
    window.clearTimeout(categorySearchTimer);
    categorySearchTimer = window.setTimeout(() => {
      adminCategorySearch = categorySearchInput.value.trim();
      loadAdminCategories().catch(() => {});
    }, 250);
  });
  loadMoreCategoriesButton.addEventListener('click', () => loadAdminCategories({ append: true }).catch(() => {}));
  refreshCategoriesButton.addEventListener('click', () => loadAdminCategories().catch(() => {}));

  async function loadAdminCategories({ append = false } = {}) {
    if (getUser()?.role !== 'admin') return;
    const requestId = ++adminCategoryRequest;
    const page = append ? adminCategoryPage + 1 : 1;
    const params = new URLSearchParams({ page: String(page), limit: '5' });
    if (adminCategorySearch) params.set('search', adminCategorySearch);
    adminCategoryHost.setAttribute('aria-busy', 'true');
    loadMoreCategoriesButton.disabled = true;
    try {
      const data = await api(`/catalog/admin/categories?${params}`, { cache: 'no-store' });
      if (requestId !== adminCategoryRequest) return;
      adminCategoryPage = data.page;
      adminCategoryPages = data.pages;
      const rows = data.categories.map((category) => `<article class="admin-list-row"><span><strong>${escapeHtml(category.name)}</strong><small>${category.total} cake${category.total === 1 ? '' : 's'} · ${category.available} available</small></span><a class="admin-table-link" href="index.html?adminPage=products">Manage cakes</a></article>`).join('');
      if (append) adminCategoryHost.insertAdjacentHTML('beforeend', rows);
      else adminCategoryHost.innerHTML = rows || `<div class="admin-empty-state"><span aria-hidden="true">▧</span><strong>${adminCategorySearch ? 'No matching categories' : 'No categories yet'}</strong><p>${adminCategorySearch ? 'Try a different search.' : 'Add a category to organize your cakes.'}</p></div>`;
      categoryPageLabel.textContent = `Page ${data.page} of ${data.pages} · ${data.count} categor${data.count === 1 ? 'y' : 'ies'}`;
      loadMoreCategoriesButton.hidden = data.page >= data.pages;
    } catch (error) {
      if (requestId === adminCategoryRequest) adminCategoryHost.innerHTML = `<div class="admin-empty-state admin-empty-error"><strong>Could not load categories</strong><p>${escapeHtml(error.message)}</p></div>`;
    } finally {
      if (requestId === adminCategoryRequest) {
        adminCategoryHost.removeAttribute('aria-busy');
        loadMoreCategoriesButton.disabled = false;
      }
    }
  }

  const completedOrderCard = (order) => {
    const items = (order.items || []).map((item) => `<li>${escapeHtml(item.name)} · ${escapeHtml(item.size)} × ${Number(item.quantity)}${item.cakeMessage ? ` — Cake message: “${escapeHtml(item.cakeMessage)}”` : ''}</li>`).join('');
    const method = order.paymentMethod === 'pay-at-store' ? 'Pay at bakery' : String(order.paymentMethod || '').replaceAll('-', ' ');
    return `<tr><td><strong>${escapeHtml(order.orderNumber)}</strong><div class="admin-table-badges"><span class="admin-status-badge status-completed">Completed</span><span class="admin-status-badge status-paid">Paid</span></div></td><td>${new Date(order.createdAt).toLocaleDateString('en-IN')}</td><td><strong>${escapeHtml(order.user?.name || order.customer?.name || 'Customer')}</strong><small class="admin-table-subtext">${escapeHtml(order.user?.email || order.customer?.email || '')}</small></td><td><ul class="admin-table-items">${items}</ul></td><td><strong>${money(order.total)}</strong></td><td>${escapeHtml(method)}</td></tr>`;
  };

  async function loadCompletedOrders() {
    if (getUser()?.role !== 'admin') return;
    const list = document.getElementById('completedOrders');
    list.setAttribute('aria-busy', 'true');
    list.classList.add('is-loading');
    try {
      const params = new URLSearchParams({ page: String(completedPage) });
      const search = document.getElementById('completedSearch').value.trim();
      const from = document.getElementById('completedFrom').value;
      const to = document.getElementById('completedTo').value;
      if (search) params.set('search', search);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const data = await api(`/orders/admin/completed?${params}`, { cache: 'no-store' });
      completedPages = data.pages;
      document.getElementById('completedPageLabel').textContent = `Page ${data.page} of ${completedPages}`;
      list.innerHTML = data.orders.length ? `<div class="admin-table-scroll"><table class="admin-table completed-orders-table"><thead><tr><th>Order / status</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment method</th></tr></thead><tbody>${data.orders.map(completedOrderCard).join('')}</tbody></table></div>` : '<div class="admin-empty-state"><span aria-hidden="true">✓</span><strong>No completed orders</strong><p>No completed and paid orders match these filters.</p></div>';
      setMessage('completedMessage', `${data.count} completed and paid order${data.count === 1 ? '' : 's'}.`);
      return true;
    } catch (error) {
      setMessage('completedMessage', error.message, true);
      return false;
    } finally {
      list.removeAttribute('aria-busy');
      list.classList.remove('is-loading');
    }
  }

  function setCompletedRange(range) {
    const fromInput = document.getElementById('completedFrom');
    const toInput = document.getElementById('completedTo');
    if (!fromInput || !toInput) return;
    const custom = range === 'custom';
    fromInput.disabled = !custom;
    toInput.disabled = !custom;
    if (custom) return;
    const today = new Date();
    const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let from = '';
    if (range === 'month') from = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
    else if (range !== 'all') { const start = new Date(to); start.setDate(start.getDate() - Number(range) + 1); from = formatDate(start); }
    fromInput.value = from;
    toInput.value = range === 'all' ? '' : formatDate(to);
  }

  async function refreshAdminSales() {
    const kpis = document.getElementById('salesKpis');
    kpis.setAttribute('aria-busy', 'true');
    kpis.classList.add('is-loading');
    try {
      const params = new URLSearchParams();
      if (document.getElementById('reportFrom').value) params.set('from', document.getElementById('reportFrom').value);
      if (document.getElementById('reportTo').value) params.set('to', document.getElementById('reportTo').value);
      if (document.getElementById('topCakesFrom')?.value) params.set('cakesFrom', document.getElementById('topCakesFrom').value);
      if (document.getElementById('topCakesTo')?.value) params.set('cakesTo', document.getElementById('topCakesTo').value);
      const data = await api(`/admin/insights${params.size ? `?${params}` : ''}`, { cache: 'no-store' });
      renderSalesCharts(data);
      renderSalesSupportingData(data);
      return true;
    } catch (error) {
      setMessage('adminMessage', `Order saved, but sales could not refresh: ${error.message}`, true);
      renderTopCakeFallback();
      return false;
    } finally {
      kpis.removeAttribute('aria-busy');
      kpis.classList.remove('is-loading');
    }
  }

  function setTopCakesRange(range) {
    const from = document.getElementById('topCakesFrom');
    const to = document.getElementById('topCakesTo');
    if (!from || !to) return;
    const custom = range === 'custom';
    from.closest('label').hidden = !custom;
    to.closest('label').hidden = !custom;
    from.disabled = !custom;
    to.disabled = !custom;
    if (custom) return;
    const now = new Date();
    const format = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start = '';
    if (range === 'month') start = format(new Date(now.getFullYear(), now.getMonth(), 1));
    else if (range !== 'all') { const date = new Date(end); date.setDate(date.getDate() - Number(range) + 1); start = format(date); }
    from.value = start;
    to.value = range === 'all' ? '' : format(end);
  }

  function renderTopCakeFallback() {
    if (document.getElementById('topCakesRange')?.value !== 'all') { renderTopCakeRows([]); return; }
    renderTopCakeRows(featuredProductData.map((cake) => ({ _id: cake.id || cake.slug, name: cake.name, units: Number(cake.unitsSold) || 0, sales: cake.totalSales === null || cake.totalSales === undefined ? null : Number(cake.totalSales), salesIsEstimated: Boolean(cake.salesIsEstimated) })));
  }

  function renderTopCakeRows(entries = []) {
    const chart = document.getElementById('popularCakesChart');
    if (!chart) return;
    const rows = entries.slice(0, 8).map((cake) => {
      const product = productData.find((item) => item.id === cake._id || item.slug === cake._id || item.name === cake.name)
        || featuredProductData.find((item) => item.id === cake._id || item.slug === cake._id);
      return { cake, product, name: product?.name || cake.name || cake._id };
    });
    displayedTopCakes = rows;
    chart.innerHTML = rows.length
      ? '<div class="top-cake-table" aria-label="Top-selling cakes"><div class="top-cake-table-head" aria-hidden="true"><span>#</span><span>Cake</span><span>Current price</span><span>Units sold</span><span>Total sales</span></div>' + rows.map(({ cake, product, name }, index) => '<button class="top-cake-row" type="button" data-top-cake-index="' + index + '" aria-label="View sales details for ' + escapeHtml(name) + '"><span class="top-cake-rank">' + (index + 1) + '</span><span class="top-cake-name"><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(product?.category || 'Cake') + '</small></span><span>' + (product?.sizes?.[0]?.price ? money(product.sizes[0].price) : '—') + '</span><span>' + Number(cake.units || 0).toLocaleString('en-IN') + '</span><span>' + salesMoney(cake.sales) + (cake.salesIsEstimated ? ' *' : '') + '</span></button>').join('') + '</div>'
      : '<p class="chart-empty">Paid cake sales will appear here.</p>';
    chart.querySelectorAll('[data-top-cake-index]').forEach((row) => {
      row.addEventListener('click', () => openTopCakeDetails(Number(row.dataset.topCakeIndex)));
    });
  }

  function openTopCakeDetails(index) {
    const item = displayedTopCakes[index];
    const dialog = document.getElementById('topCakeDetailsDialog');
    const content = document.getElementById('topCakeDetailsContent');
    if (!item || !dialog || !content) return;
    const { cake, product, name } = item;
    const price = product?.sizes?.[0]?.price;
    const photo = product?.image || '/public/images/products/birthday/birthday-confetti.jpg';
    const salesNote = cake.salesIsEstimated
      ? ' * This total estimates older orders without a saved price using today’s price for the recorded size. New orders use their recorded checkout price.'
      : 'Total sales use recorded prices from completed, paid orders.';
    content.innerHTML = '<div class="top-cake-detail-hero"><img src="' + escapeHtml(photo) + '" alt="' + escapeHtml(name) + '"><div><span class="eyebrow">TOP-SELLING CAKE · #' + (index + 1) + '</span><h2>' + escapeHtml(name) + '</h2><p class="top-cake-detail-category">' + escapeHtml(product?.category || 'Cake') + '</p></div></div><dl class="top-cake-detail-stats"><div><dt>Current starting price</dt><dd>' + (price ? money(price) : 'Not listed') + '</dd></div><div><dt>Units sold</dt><dd>' + Number(cake.units || 0).toLocaleString('en-IN') + '</dd></div><div><dt>Total sales</dt><dd>' + salesMoney(cake.sales) + (cake.salesIsEstimated ? ' *' : '') + '</dd></div></dl><p class="top-cake-detail-note">' + salesNote + '</p>';
    dialog.showModal();
  }

  function renderSalesCharts(insights) {
    latestSalesInsights = insights;
    const summary = insights.summary || { revenue: 0, orders: 0, paidOrders: 0, pendingOrders: 0, completedOrders: 0, cancelledOrders: 0 };
    const dashboardCounts = insights.dashboardCounts || {};
    document.getElementById('salesKpis').innerHTML = [
      ['♧', 'Total products', Number(dashboardCounts.products || 0).toLocaleString('en-IN')],
      ['▤', 'Total orders', Number(summary.orders || 0).toLocaleString('en-IN')],
      ['♙', 'Total customers', Number(insights.customerCount || 0).toLocaleString('en-IN')],
      ['✉', 'New enquiries', Number(dashboardCounts.newEnquiries || 0).toLocaleString('en-IN')],
      ['♡', 'Wishlist items', Number(dashboardCounts.wishlistItems || 0).toLocaleString('en-IN')],
    ].map(([icon, label, value]) => `<article class="admin-kpi"><span class="admin-kpi-icon" aria-hidden="true">${icon}</span><div><strong>${value}</strong><span class="admin-kpi-label">${label}</span></div></article>`).join('');

    const daily = insights.revenueByDay || [];
    const sampled = daily.length > 32 ? daily.filter((_, index) => index % Math.ceil(daily.length / 32) === 0 || index === daily.length - 1) : daily;
    const maxRevenue = Math.max(1, ...sampled.map((day) => Number(day.revenue || 0)));
    document.getElementById('salesRevenueChart').innerHTML = sampled.length
      ? `<div class="bar-chart" role="img" aria-label="Paid revenue by day">${sampled.map((day) => { const height = Math.max(3, (Number(day.revenue || 0) / maxRevenue) * 100); const label = new Date(`${day._id}T12:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); return `<div class="bar-column" title="${label}: ${money(day.revenue)} · ${day.orders} paid orders"><span class="bar-value">${money(day.revenue)}</span><i style="height:${height}%"></i><small>${label}</small></div>`; }).join('')}</div>`
      : '<p class="chart-empty">No paid sales in this date range yet.</p>';

    const statuses = insights.orderStatuses || [];
    const statusColors = { placed: '#d6a1a0', confirmed: '#89947b', preparing: '#9b806b', ready: '#c2a46f', shipped: '#8eaeb0', 'out-for-delivery': '#8eaeb0', completed: '#72886a', cancelled: '#9b929e' };
    const totalStatusCount = statuses.reduce((sum, status) => sum + Number(status.count || 0), 0);
    let angle = 0;
    const slices = statuses.map((status) => {
      const portion = totalStatusCount ? Number(status.count) / totalStatusCount * 360 : 0;
      const part = `${statusColors[status._id] || '#b988a0'} ${angle}deg ${angle + portion}deg`;
      angle += portion;
      return part;
    });
    document.getElementById('orderStatusChart').innerHTML = totalStatusCount
      ? `<div class="status-chart-layout"><div class="status-donut" style="background:conic-gradient(${slices.join(',')})"><span>${totalStatusCount}<small>orders</small></span></div><ul>${statuses.map((status) => `<li><i style="--status-color:${statusColors[status._id] || '#b988a0'}"></i><span>${escapeHtml(status._id.replaceAll('-', ' '))}</span><strong>${status.count}</strong></li>`).join('')}</ul></div>`
      : '<p class="chart-empty">Order statuses will appear here.</p>';

    const recordedTopCakes = insights.topCakes || [];
    if (recordedTopCakes.length) renderTopCakeRows(recordedTopCakes);
    else if (document.getElementById('topCakesRange')?.value === 'all') renderTopCakeFallback();
    else renderTopCakeRows([]);

    const wished = insights.topWishlisted || [];
    const wishCard = (entry, index, top = false) => { const product = productData.find((item) => item.id === entry._id || item.slug === entry._id || item.name === entry._id); return `<article class="admin-wishlist-card${top ? ' admin-wishlist-rank-card' : ''}"${top ? ` data-rank="${index + 1}"` : ''}>${top ? `<span class="admin-wishlist-rank">${index + 1}</span>` : ''}<img src="${escapeHtml(product?.image || '/public/images/products/birthday/birthday-confetti.jpg')}" alt="${escapeHtml(product?.name || entry._id)}"><div><strong>${escapeHtml(product?.name || entry._id)}</strong><small>${escapeHtml(product?.category || 'Saved cake')}</small></div><span>♥ ${Number(entry.count).toLocaleString('en-IN')} wishlists</span></article>`; };
    document.getElementById('adminWishlistProducts').innerHTML = wished.length
      ? `<section class="admin-wishlist-top"><header><h4>Top 3 most wishlisted cakes</h4><p>Customer favourites saved most often.</p></header><div class="admin-wishlist-top-grid">${(wished.length >= 3 ? [1, 0, 2] : wished.slice(0, 3).map((_, index) => index)).map((index) => wished[index] ? wishCard(wished[index], index, true) : '').join('')}</div></section>${wished.length > 3 ? `<section class="admin-wishlist-rest"><h4>More customer favourites</h4><div class="admin-wishlist-rest-list">${wished.slice(3).map((entry, index) => wishCard(entry, index + 3)).join('')}</div></section>` : ''}`
      : '<p class="chart-empty">Customers have not saved any cakes yet.</p>';
  }

  function renderSalesSupportingData(insights) {
    document.getElementById('salesInsights').innerHTML = '';
    if (adminView !== 'orders') return;
    const upcomingTime = (value) => { if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return ''; const [hourText, minute] = value.split(':'); const hour = Number(hourText); return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`; };
    document.getElementById('upcomingDeliveries').innerHTML = insights.upcoming.map((item) => `<p><strong>${new Date(item.customer.deliveryDate).toLocaleDateString('en-IN')}</strong>${upcomingTime(item.customer.deliveryTime) ? ` · by ${upcomingTime(item.customer.deliveryTime)}` : ''} · ${escapeHtml(item.customer.name)} · ${escapeHtml(item.orderNumber)} · ${escapeHtml(item.status)}</p>`).join('') || '<p>No upcoming deliveries in 14 days.</p>';
  }

  async function loadAdminCustomers() {
    if (getUser()?.role !== 'admin') return;
    try {
      const params = new URLSearchParams();
      const search = document.getElementById('adminCustomerSearch')?.value.trim() || '';
      if (search) params.set('search', search);
      const data = await api(`/admin/customers${params.toString() ? `?${params}` : ''}`);
      document.getElementById('adminCustomers').innerHTML = data.customers.length ? data.customers.map((customer) => `<article class="admin-list-row customer-admin-row"><div><strong>${escapeHtml(customer.name)}</strong><small>${escapeHtml(customer.email)}${customer.phone ? ` · ${escapeHtml(customer.phone)}` : ''}</small><small>${Number(customer.orderCount)} orders · ${Number(customer.loyaltyPoints)} points · Joined ${new Date(customer.createdAt).toLocaleDateString('en-IN')}</small></div><button class="store-secondary danger-action" type="button" data-delete-customer="${escapeHtml(customer.id)}" data-customer-name="${escapeHtml(customer.name)}">Delete account</button></article>`).join('') : '<p class="chart-empty">No customer accounts match this search.</p>';
    } catch (error) { setMessage('adminCustomersMessage', error.message, true); }
  }

  const customerCreateForm = document.getElementById('adminCustomerCreateForm');
  document.getElementById('showCustomerCreateForm')?.addEventListener('click', () => {
    customerCreateForm.hidden = false;
    customerCreateForm.querySelector('[name="name"]')?.focus();
  });
  document.getElementById('cancelCustomerCreate')?.addEventListener('click', () => {
    customerCreateForm.reset();
    customerCreateForm.hidden = true;
    setMessage('adminCustomersMessage', '');
  });
  customerCreateForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const result = await api('/admin/customers', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      form.reset();
      form.hidden = true;
      setMessage('adminCustomersMessage', result.message);
      await loadAdminCustomers();
    } catch (error) {
      setMessage('adminCustomersMessage', error.message, true);
    } finally { submit.disabled = false; }
  });

  async function loadAdminEnquiries() {
    if (getUser()?.role !== 'admin') return;
    try {
      const { enquiries } = await api('/admin/enquiries');
      document.getElementById('adminEnquiries').innerHTML = enquiries.length ? enquiries.map((item) => `<article class="admin-list-row enquiry-admin-card"><div class="enquiry-admin-main"><div class="enquiry-admin-heading"><strong>${escapeHtml(item.name)}</strong><span class="enquiry-status-pill ${item.status === 'new' ? 'is-new' : ''}">${escapeHtml(item.status || 'new')}</span><span class="enquiry-email-pill ${item.emailStatus === 'sent' ? 'is-sent' : item.emailStatus === 'failed' ? 'is-failed' : ''}">Email ${item.emailStatus === 'sent' ? 'sent' : item.emailStatus === 'failed' ? 'failed' : 'not configured'}</span></div><p class="enquiry-admin-meta">${escapeHtml(item.occasion)} · ${escapeHtml(item.cakeSize)} · Received ${new Date(item.createdAt).toLocaleString('en-IN')}</p><p class="enquiry-admin-contact"><a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a>${item.phone ? ` <span>·</span> <a href="tel:${escapeHtml(item.phone)}">${escapeHtml(item.phone)}</a>` : ''}</p>${item.details ? `<p class="enquiry-admin-details">${escapeHtml(item.details)}</p>` : ''}${item.referenceImage ? `<a class="enquiry-reference-link" href="${escapeHtml(item.referenceImage)}" target="_blank" rel="noopener"><img src="${escapeHtml(item.referenceImage)}" alt="Cake reference attached by ${escapeHtml(item.name)}"><span>View cake reference image ↗</span></a>` : ''}</div></article>`).join('') : '<p class="chart-empty">No custom cake enquiries yet.</p>';
    } catch (error) { setMessage('adminEnquiriesMessage', error.message, true); }
  }

  
  async function loadAdminInventory() {
    if (getUser()?.role !== 'admin') return;
    const grid = document.getElementById('adminInventoryGrid');
    if (!grid) return;
    const requestId = ++inventoryRequestId;
    grid.setAttribute('aria-busy', 'true');
    try {
      const [{ products = [] }, { items = [] }] = await Promise.all([
        api('/catalog/admin/products', { cache: 'no-store' }),
        api('/inventory/admin/items', { cache: 'no-store' }),
      ]);
      if (requestId !== inventoryRequestId) return;
      inventoryData = [
        ...products.map((product) => ({
          id: `cake:${product.id || product.slug}`, recordId: product.id || product.slug, type: 'cakes',
          name: product.name, category: 'Cakes', subcategory: product.category || 'Cake',
          detail: product.flavors?.[0] || '', unit: product.sizes?.[0]?.name || 'cake', image: product.image,
          stock: Number(product.stock ?? 20), lowStockThreshold: Number(product.lowStockThreshold ?? 5), updatedAt: product.updatedAt || product.createdAt,
        })),
        ...items.map((item) => ({
          id: `item:${item._id}`, recordId: item._id, type: item.category,
          name: item.name, category: item.category === 'ingredients' ? 'Ingredients' : 'Supplies',
          subcategory: item.category === 'ingredients' ? 'Ingredients' : 'Supplies',
          detail: item.detail || '', unit: item.unit || 'unit', image: item.image || '',
          stock: Number(item.stock || 0), lowStockThreshold: Number(item.lowStockThreshold ?? 5), updatedAt: item.updatedAt,
        })),
      ];
      renderAdminInventory();
    } catch (error) {
      if (requestId === inventoryRequestId) grid.innerHTML = `<tr><td colspan="7" class="inventory-loading is-error">Could not load inventory: ${escapeHtml(error.message)}</td></tr>`;
    } finally {
      if (requestId === inventoryRequestId) grid.removeAttribute('aria-busy');
    }
  }

  const getInventoryStatus = (item) => item.stock <= 0 ? 'out' : item.stock <= item.lowStockThreshold ? 'low' : 'in';
  const getInventoryImage = (item) => item.image || (item.type === 'cakes' ? '/public/images/products/birthday/birthday-confetti.jpg' : '');
  const inventoryItemVisual = (item) => getInventoryImage(item)
    ? `<img src="${escapeHtml(getInventoryImage(item))}" alt="">`
    : `<i class="inventory-generic-icon inventory-generic-${item.type}" aria-hidden="true">${item.type === 'ingredients' ? '❧' : '◇'}</i>`;

  function renderAdminInventory() {
    const grid = document.getElementById('adminInventoryGrid');
    if (!grid) return;
    const count = (type) => type === 'all' ? inventoryData.length : inventoryData.filter((item) => item.type === type).length;
    document.getElementById('inventoryCountAll').textContent = count('all');
    document.getElementById('inventoryCountCakes').textContent = count('cakes');
    document.getElementById('inventoryCountIngredients').textContent = count('ingredients');
    document.getElementById('inventoryCountSupplies').textContent = count('supplies');
    const lowItems = inventoryData.filter((item) => getInventoryStatus(item) === 'low');
    const outItems = inventoryData.filter((item) => getInventoryStatus(item) === 'out');
    document.getElementById('lowStockBadge').textContent = `${lowItems.length} Low Stock`;
    document.getElementById('outOfStockBadge').textContent = `${outItems.length} Out of Stock`;
    const summary = [
      ['Total items', count('all'), 'all', '▧'], ['Cakes', count('cakes'), 'cakes', '♧'],
      ['Ingredients', count('ingredients'), 'ingredients', '❧'], ['Supplies', count('supplies'), 'supplies', '◇'],
    ];
    document.getElementById('inventorySummary').innerHTML = summary.map(([label, value, type, icon]) => `<button type="button" class="inventory-summary-card inventory-summary-${type}" data-summary-type="${type}"><span>${label}</span><strong>${value}</strong><i aria-hidden="true">${icon}</i></button>`).join('');
    const alerts = [...lowItems, ...outItems].sort((a, b) => getInventoryStatus(a) === 'out' ? -1 : getInventoryStatus(b) === 'out' ? 1 : a.stock - b.stock).slice(0, 6);
    document.getElementById('inventoryLowAlerts').innerHTML = alerts.length ? alerts.map((item) => `<button type="button" class="inventory-alert-row" data-edit-inventory="${escapeHtml(item.id)}">${inventoryItemVisual(item)}<span><strong>${escapeHtml(item.name)}</strong><small>${item.stock} ${escapeHtml(item.unit)} left</small></span><i aria-hidden="true">›</i></button>`).join('') : '<p class="inventory-empty-note">Everything is stocked beautifully.</p>';

    const search = document.getElementById('inventorySearch').value.trim().toLowerCase();
    const status = document.getElementById('inventoryStatusFilter').value;
    const options = [...new Set(inventoryData.filter((item) => currentInventoryType === 'all' || item.type === currentInventoryType).map((item) => currentInventoryType === 'cakes' ? item.subcategory : item.category))].sort();
    const categorySelect = document.getElementById('inventoryCategoryFilter');
    const previousCategory = categorySelect.value;
    categorySelect.innerHTML = '<option value="all">All categories</option>' + options.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join('');
    categorySelect.value = options.includes(previousCategory) ? previousCategory : 'all';
    const activeCategory = categorySelect.value;
    const filtered = inventoryData.filter((item) => {
      if (currentInventoryType !== 'all' && item.type !== currentInventoryType) return false;
      if (search && !`${item.name} ${item.detail} ${item.subcategory}`.toLowerCase().includes(search)) return false;
      if (activeCategory !== 'all' && (currentInventoryType === 'cakes' ? item.subcategory : item.category) !== activeCategory) return false;
      return status === 'all' || (status === 'attention' ? ['low', 'out'].includes(getInventoryStatus(item)) : getInventoryStatus(item) === status);
    });
    const pages = Math.max(1, Math.ceil(filtered.length / currentInventoryPageSize));
    currentInventoryPage = Math.min(currentInventoryPage, pages);
    const start = (currentInventoryPage - 1) * currentInventoryPageSize;
    const pageItems = filtered.slice(start, start + currentInventoryPageSize);
    const emptyPantryType = ['ingredients', 'supplies'].includes(currentInventoryType) && !inventoryData.some((item) => item.type === currentInventoryType) && !search && status === 'all' && activeCategory === 'all';
    const emptyTableMessage = emptyPantryType ? `No ${currentInventoryType} are tracked yet. Add your first item with “Add new item” above.` : 'No items match these filters.';
    grid.innerHTML = pageItems.length ? pageItems.map((item) => {
      const level = getInventoryStatus(item);
      const statusText = level === 'out' ? 'Out of stock' : level === 'low' ? 'Low stock' : 'In stock';
      const updated = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
      const checked = selectedInventoryRows.has(item.id) ? 'checked' : '';
      return `<tr data-inventory-row="${escapeHtml(item.id)}"><td><input type="checkbox" data-select-inventory="${escapeHtml(item.id)}" aria-label="Select ${escapeHtml(item.name)}" ${checked}></td><td><div class="inventory-item-cell">${inventoryItemVisual(item)}<span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.detail || item.unit)}</small></span></div></td><td><span class="inventory-category-pill inventory-category-${item.type}">${escapeHtml(item.category)}</span></td><td><strong class="inventory-stock-number">${item.stock}</strong> <small>${escapeHtml(item.unit)}</small></td><td><span class="inventory-state inventory-state-${level}">${statusText}</span></td><td>${updated}</td><td><div class="inventory-row-actions"><button type="button" data-edit-inventory="${escapeHtml(item.id)}" aria-label="Edit ${escapeHtml(item.name)}" title="Edit">✎</button>${item.type !== 'cakes' ? `<button type="button" data-delete-inventory="${escapeHtml(item.id)}" aria-label="Remove ${escapeHtml(item.name)}" title="Remove">⌫</button>` : ''}</div></td></tr>`;
    }).join('') : `<tr><td colspan="7" class="inventory-loading">${escapeHtml(emptyTableMessage)}</td></tr>`;
    const end = Math.min(start + pageItems.length, filtered.length);
    document.getElementById('inventoryPageSummary').textContent = filtered.length ? `Showing ${start + 1}–${end} of ${filtered.length} items` : 'No inventory items to show';
    document.getElementById('inventoryPageButtons').innerHTML = Array.from({ length: pages }, (_, index) => `<button type="button" data-inventory-page="${index + 1}" class="${currentInventoryPage === index + 1 ? 'is-current' : ''}" aria-label="Page ${index + 1}" ${currentInventoryPage === index + 1 ? 'aria-current="page"' : ''}>${index + 1}</button>`).join('');
    document.getElementById('inventoryPrevPage').disabled = currentInventoryPage <= 1;
    document.getElementById('inventoryNextPage').disabled = currentInventoryPage >= pages;
    document.getElementById('inventorySelectAll').checked = pageItems.length > 0 && pageItems.every((item) => selectedInventoryRows.has(item.id));
    const bulkRemove = document.getElementById('inventoryBulkRemove');
    const removableCount = [...selectedInventoryRows].filter((id) => inventoryData.some((item) => item.id === id && item.type !== 'cakes')).length;
    bulkRemove.hidden = removableCount === 0;
    bulkRemove.textContent = `Remove ${removableCount} selected`;
  }

  const adminGiftCardList = document.getElementById('adminGiftCardList');
  const giftCardForm = document.getElementById('adminGiftCardForm');
  let giftCardPage = 1;
  let giftCardPages = 1;
  let giftCardRequest = 0;
  let giftCardActivityRequest = 0;
  const giftCardPageSizeSelect = document.getElementById('giftCardPageSize');
  const giftCardDesignNames = { 'sweet-moments': 'Sweet Moments', 'cake-love': 'Cake Love', 'birthday-bliss': 'Birthday Bliss', 'just-because': 'Just Because', 'with-love': 'With Love', 'special-treat': 'Special Treat' };
  const giftCardStatus = (card) => card.expiresAt && new Date(card.expiresAt) < new Date() ? 'expired' : Number(card.balance) <= 0 ? 'used' : card.active ? 'active' : 'inactive';
  const giftCardStatusLabel = (status) => ({ active: 'Active', expired: 'Expired', used: 'Redeemed', inactive: 'Revoked' })[status] || status;
  const giftOfferForm = document.getElementById('giftCardOfferForm');
  const giftOfferDesignNames = giftCardDesignNames;
  const giftOfferTemplateNames = { 'sweet-moments': 'Sweet Moments · Floral', 'cake-love': 'Cake Love · Hearts', 'birthday-bliss': 'Birthday Bliss · Party', 'just-because': 'Just Because · Sparkles', 'with-love': 'With Love · Heartfelt', 'special-treat': 'Special Treat · Golden' };
  const clearGiftOfferForm = () => {
    giftOfferForm.reset();
    giftOfferForm.elements.id.value = '';
    giftOfferForm.querySelector('[type="submit"]').textContent = 'Publish gift card';
    document.getElementById('giftOfferCancelEdit').hidden = true;
  };
  async function loadAdminGiftCardOffers() {
    const host = document.getElementById('giftCardOfferList');
    if (!host || getUser()?.role !== 'admin') return;
    host.setAttribute('aria-busy', 'true');
    try {
      const { offers = [] } = await api('/commerce/admin/gift-card-offers', { cache: 'no-store' });
      host.innerHTML = offers.length ? offers.map((offer) => `<tr><td><strong>${escapeHtml(offer.name)}</strong></td><td>${escapeHtml(giftOfferDesignNames[offer.design] || 'Sweet Moments')}</td><td>${escapeHtml(giftOfferTemplateNames[offer.emailTemplate] || giftOfferTemplateNames['sweet-moments'])}</td><td><strong>${money(offer.price)}</strong></td><td><span class="giftcard-state ${offer.active ? 'giftcard-state-active' : 'giftcard-state-inactive'}">${offer.active ? 'Published' : 'Hidden'}</span></td><td><div class="giftcard-row-actions"><button type="button" data-gift-offer-edit="${escapeHtml(offer._id)}" aria-label="Edit ${escapeHtml(offer.name)}" title="Edit">✎</button><button type="button" data-gift-offer-active="${escapeHtml(offer._id)}" data-active="${!offer.active}" aria-label="${offer.active ? 'Hide' : 'Publish'} ${escapeHtml(offer.name)}" title="${offer.active ? 'Hide from customers' : 'Publish for customers'}">${offer.active ? '⌫' : '↻'}</button></div></td></tr>`).join('') : '<tr><td colspan="6" class="giftcard-empty">No customer offers yet. Add a name, artwork, email template, and price above.</td></tr>';
    } catch (error) {
      host.innerHTML = `<tr><td colspan="5" class="giftcard-empty giftcard-error">Could not load customer offers: ${escapeHtml(error.message)}</td></tr>`;
    } finally { host.removeAttribute('aria-busy'); }
  }
  giftOfferForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const id = form.elements.id.value;
    button.disabled = true;
    try {
      const response = await api(id ? `/commerce/admin/gift-card-offers/${encodeURIComponent(id)}` : '/commerce/admin/gift-card-offers', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify({ name: form.elements.name.value, design: form.elements.design.value, emailTemplate: form.elements.emailTemplate.value, price: Number(form.elements.price.value) }),
      });
      clearGiftOfferForm();
      setMessage('giftOfferAdminMessage', response.message || (id ? 'Gift card offer updated.' : 'Gift card offer published.'));
      await loadAdminGiftCardOffers();
    } catch (error) { setMessage('giftOfferAdminMessage', error.message || 'Could not save this customer offer.', true); }
    finally { button.disabled = false; }
  });
  document.getElementById('giftOfferCancelEdit')?.addEventListener('click', clearGiftOfferForm);
  document.getElementById('giftCardOfferList')?.addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-gift-offer-edit]');
    const status = event.target.closest('[data-gift-offer-active]');
    try {
      if (edit) {
        const { offers = [] } = await api('/commerce/admin/gift-card-offers', { cache: 'no-store' });
        const offer = offers.find((item) => item._id === edit.dataset.giftOfferEdit);
        if (!offer) throw new Error('That gift card offer is no longer available.');
        giftOfferForm.elements.id.value = offer._id;
        giftOfferForm.elements.name.value = offer.name;
        giftOfferForm.elements.design.value = offer.design;
        giftOfferForm.elements.emailTemplate.value = offer.emailTemplate || offer.design || 'sweet-moments';
        giftOfferForm.elements.price.value = offer.price;
        giftOfferForm.querySelector('[type="submit"]').textContent = 'Save changes';
        document.getElementById('giftOfferCancelEdit').hidden = false;
        giftOfferForm.elements.name.focus();
      } else if (status) {
        const active = status.dataset.active === 'true';
        const result = await api(`/commerce/admin/gift-card-offers/${encodeURIComponent(status.dataset.giftOfferActive)}/status`, { method: 'PATCH', body: JSON.stringify({ active }) });
        setMessage('giftOfferAdminMessage', result.message);
        await loadAdminGiftCardOffers();
      }
    } catch (error) { setMessage('giftOfferAdminMessage', error.message || 'Could not update this offer.', true); }
  });

  async function loadGiftCardActivity(limit = 6) {
    const host = document.getElementById('giftCardActivity');
    const requestId = ++giftCardActivityRequest;
    try {
      const { activity = [] } = await api(`/commerce/admin/gift-cards/activity?limit=${limit}`, { cache: 'no-store' });
      if (requestId !== giftCardActivityRequest) return;
      const labels = { issued: 'Gift card created', redeemed: 'Gift card redeemed', refunded: 'Gift card refunded' };
      const icons = { issued: '+', redeemed: '♥', refunded: '↺' };
      host.innerHTML = activity.length ? activity.map((item) => `<article class="giftcard-activity-row"><span class="giftcard-activity-icon activity-${escapeHtml(item.type)}" aria-hidden="true">${icons[item.type] || '·'}</span><span><strong>${labels[item.type] || 'Gift card activity'} · ${item.codeLast4 ? `••${escapeHtml(item.codeLast4)}` : ''}</strong><small>${money(item.amount)}${item.orderNumber ? ` · ${escapeHtml(item.orderNumber)}` : item.recipientName ? ` · ${escapeHtml(item.recipientName)}` : ''}</small></span><time>${new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</time></article>`).join('') : '<p class="giftcard-empty">Gift card activity will appear here.</p>';
    } catch (error) { host.innerHTML = `<p class="giftcard-empty giftcard-error">${escapeHtml(error.message)}</p>`; }
  }

  async function loadAdminGiftCards() {
    if (getUser()?.role !== 'admin') return;
    const listEl = adminGiftCardList;
    if (!listEl) return;
    const requestId = ++giftCardRequest;
    const params = new URLSearchParams({ page: String(giftCardPage), limit: String(Number(giftCardPageSizeSelect.value) || 6), sort: document.getElementById('giftCardSort').value });
    const search = document.getElementById('giftCardSearch').value.trim();
    const statusFilter = document.getElementById('giftCardStatusFilter').value;
    if (search) params.set('search', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    listEl.setAttribute('aria-busy', 'true');
    try {
      const data = await api(`/commerce/admin/gift-cards?${params}`, { cache: 'no-store' });
      if (requestId !== giftCardRequest) return;
      giftCardPage = data.page;
      giftCardPages = data.pages;
      const colors = ['rose', 'sage', 'blue', 'lavender', 'peach', 'butter'];
      listEl.innerHTML = (data.giftCards || []).length ? data.giftCards.map((card, index) => {
        const state = giftCardStatus(card);
        const cardName = card.offerName || giftCardDesignNames[card.design] || 'Sweet Moments';
        const design = card.design || 'sweet-moments';
        const validUntil = card.expiresAt ? new Date(card.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        const revokeAction = state === 'active' ? `<button type="button" data-giftcard-status="${escapeHtml(card._id)}" data-active="false" aria-label="Revoke gift card" title="Revoke">⌫</button>` : state !== 'expired' && state !== 'used' ? `<button type="button" data-giftcard-status="${escapeHtml(card._id)}" data-active="true" aria-label="Reactivate gift card" title="Reactivate">↻</button>` : '';
        const redeemedValue = Math.max(0, Number(card.value || 0) - Number(card.balance || 0));
        return `<tr><td>${(giftCardPage - 1) * Number(giftCardPageSizeSelect.value) + index + 1}</td><td><div class="giftcard-design-swatch giftcard-design-${escapeHtml(design)} ${colors[((giftCardPage - 1) * Number(giftCardPageSizeSelect.value) + index) % colors.length]}"><span aria-hidden="true">♡</span><small>Cakes of Paradise</small></div></td><td><strong class="giftcard-recipient-name">${escapeHtml(cardName)}</strong><small>${escapeHtml(card.recipientName || 'Ready to gift')}</small></td><td><span class="giftcard-code">CAKE-••••${escapeHtml(card.codeLast4)}</span></td><td><strong>${money(card.balance)} remaining</strong><small>${money(card.value)} issued · ${money(redeemedValue)} redeemed</small></td><td><span class="giftcard-state giftcard-state-${state}">${giftCardStatusLabel(state)}</span></td><td>${validUntil}</td><td><div class="giftcard-row-actions"><button type="button" data-giftcard-view="${escapeHtml(card._id)}" aria-label="View gift card" title="View">⌕</button><button type="button" data-giftcard-edit="${escapeHtml(card._id)}" aria-label="Edit gift card" title="Edit">✎</button>${revokeAction}</div></td></tr>`;
      }).join('') : `<tr><td colspan="8" class="giftcard-empty">${search || statusFilter !== 'all' ? 'No gift cards match those filters.' : 'No gift cards have been issued yet. Create your first sweet surprise.'}</td></tr>`;
      const summary = data.summary || { total: data.count || 0, sold: 0, active: 0, expired: 0 };
      document.getElementById('giftCardStats').innerHTML = [
        ['Total gift cards', summary.total, 'rose', '<svg viewBox="0 0 24 24"><path d="M3 10h18v11H3zM2 6h20v4H2zM12 6v15"/><path d="M12 6H7.5a2.5 2.5 0 1 1 2.2-3.7L12 6Zm0 0h4.5a2.5 2.5 0 1 0-2.2-3.7L12 6Z"/></svg>'], ['Total sold', summary.sold, 'sage', '<svg viewBox="0 0 24 24"><path d="M3 7 17 3l4 14-14 4L3 7Z"/><path d="m8 10 8-2M9 14l3-.8"/></svg>'], ['Active cards', summary.active, 'lavender', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'], ['Expired cards', summary.expired, 'blue', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>'],
      ].map(([label, value, color, icon]) => `<article class="giftcard-stat giftcard-stat-${color}"><span>${label}</span><strong>${Number(value || 0).toLocaleString('en-IN')}</strong><small>Gifted with love</small><i aria-hidden="true">${icon}</i></article>`).join('');
      document.getElementById('giftCardPageSummary').textContent = data.count ? `Showing ${(giftCardPage - 1) * data.limit + 1}–${Math.min(giftCardPage * data.limit, data.count)} of ${data.count} gift cards` : 'No gift cards to show';
      document.getElementById('giftCardPageButtons').innerHTML = Array.from({ length: data.pages }, (_, index) => `<button type="button" data-giftcard-page="${index + 1}" class="${giftCardPage === index + 1 ? 'is-current' : ''}" aria-label="Page ${index + 1}">${index + 1}</button>`).join('');
      document.getElementById('giftCardPrevPage').disabled = giftCardPage <= 1;
      document.getElementById('giftCardNextPage').disabled = giftCardPage >= data.pages;
      await loadGiftCardActivity(6);
    } catch (error) {
      if (requestId === giftCardRequest) listEl.innerHTML = `<tr><td colspan="8" class="giftcard-empty giftcard-error">Could not load gift cards: ${escapeHtml(error.message)}</td></tr>`;
    } finally {
      if (requestId === giftCardRequest) {
        listEl.removeAttribute('aria-busy');
      }
    }
  }
  const giftCardDialog = document.getElementById('giftCardDialog');
  const giftCardDetailsDialog = document.getElementById('giftCardDetailsDialog');
  const giftCardEditDialog = document.getElementById('giftCardEditDialog');
  document.getElementById('giftCardCreateButton')?.addEventListener('click', () => { giftCardForm.reset(); setMessage('giftCardFormMessage', ''); giftCardDialog.showModal(); });
  document.querySelectorAll('[data-open-giftcard]').forEach((button) => button.addEventListener('click', () => document.getElementById('giftCardCreateButton').click()));
  document.querySelectorAll('[data-close-giftcard]').forEach((button) => button.addEventListener('click', () => button.closest('dialog')?.close()));
  [giftCardDialog, giftCardDetailsDialog, giftCardEditDialog].forEach((dialog) => dialog?.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }));
  ['giftCardSearch', 'giftCardStatusFilter', 'giftCardSort', 'giftCardPageSize'].forEach((id) => document.getElementById(id)?.addEventListener(id === 'giftCardSearch' ? 'input' : 'change', () => {
    giftCardPage = 1;
    loadAdminGiftCards();
  }));
  document.getElementById('giftCardPrevPage')?.addEventListener('click', () => { giftCardPage = Math.max(1, giftCardPage - 1); loadAdminGiftCards(); });
  document.getElementById('giftCardNextPage')?.addEventListener('click', () => { giftCardPage = Math.min(giftCardPages, giftCardPage + 1); loadAdminGiftCards(); });
  document.getElementById('giftCardPageButtons')?.addEventListener('click', (event) => { const button = event.target.closest('[data-giftcard-page]'); if (button) { giftCardPage = Number(button.dataset.giftcardPage); loadAdminGiftCards(); } });
  document.getElementById('giftCardShowAll')?.addEventListener('click', () => {
    document.getElementById('giftCardSearch').value = '';
    document.getElementById('giftCardStatusFilter').value = 'all';
    giftCardPageSizeSelect.value = '24';
    giftCardPage = 1;
    loadAdminGiftCards();
    document.querySelector('.giftcard-main-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.getElementById('giftCardShowExpired')?.addEventListener('click', () => {
    document.getElementById('giftCardStatusFilter').value = 'expired';
    giftCardPage = 1;
    loadAdminGiftCards();
  });
  document.getElementById('giftCardViewActivity')?.addEventListener('click', () => loadGiftCardActivity(20));
  adminGiftCardList.addEventListener('click', async (event) => {
    const view = event.target.closest('[data-giftcard-view]');
    const edit = event.target.closest('[data-giftcard-edit]');
    const status = event.target.closest('[data-giftcard-status]');
    const id = view?.dataset.giftcardView || edit?.dataset.giftcardEdit || status?.dataset.giftcardStatus;
    if (!id) return;
    try {
      if (view) {
        const { giftCard: card, transactions = [] } = await api(`/commerce/admin/gift-cards/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const state = giftCardStatus(card);
        document.getElementById('giftCardDetailsContent').innerHTML = `<span class="giftcard-state giftcard-state-${state}">${giftCardStatusLabel(state)}</span><h4>${escapeHtml(card.offerName || giftCardDesignNames[card.design] || 'Sweet Moments')}</h4><p class="giftcard-detail-code">CAKE-••••${escapeHtml(card.codeLast4)}</p><div class="giftcard-detail-metrics"><span>Original value<strong>${money(card.value)}</strong></span><span>Remaining balance<strong>${money(card.balance)}</strong></span><span>Valid until<strong>${card.expiresAt ? new Date(card.expiresAt).toLocaleDateString('en-IN') : '—'}</strong></span></div><p class="giftcard-detail-recipient">For <strong>${escapeHtml(card.recipientName || 'A special someone')}</strong>${card.recipientEmail ? ` · ${escapeHtml(card.recipientEmail)}` : ''}</p><p class="giftcard-detail-message">${escapeHtml(card.message || 'A little sweetness, just for you.')}</p><h5>Card activity</h5><div class="giftcard-detail-timeline">${transactions.length ? transactions.map((item) => `<p><span>${escapeHtml(item.type)}</span><strong>${money(item.amount)}</strong><time>${new Date(item.createdAt).toLocaleDateString('en-IN')}</time></p>`).join('') : '<p>No redemption activity yet.</p>'}</div>`;
        giftCardDetailsDialog.showModal();
      } else if (edit) {
        const { giftCard: card } = await api(`/commerce/admin/gift-cards/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const form = document.getElementById('giftCardEditForm');
        form.elements.id.value = id;
        form.elements.recipientName.value = card.recipientName || '';
        form.elements.recipientEmail.value = card.recipientEmail || '';
        form.elements.message.value = card.message || '';
        setMessage('giftCardEditMessage', '');
        giftCardEditDialog.showModal();
      } else if (status) {
        const active = status.dataset.active === 'true';
        if (!window.confirm(`${active ? 'Reactivate' : 'Revoke'} this gift card?`)) return;
        await api(`/commerce/admin/gift-cards/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ active }) });
        setMessage('adminGiftCardMessage', active ? 'Gift card reactivated.' : 'Gift card revoked. Its redemption history is preserved.');
        await loadAdminGiftCards();
      }
    } catch (error) { setMessage('adminGiftCardMessage', error.message || 'Could not complete that gift card action.', true); }
  });
  document.getElementById('giftCardEditForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const id = form.elements.id.value;
      await api(`/commerce/admin/gift-cards/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify({ recipientName: form.elements.recipientName.value, recipientEmail: form.elements.recipientEmail.value, message: form.elements.message.value }) });
      giftCardEditDialog.close();
      setMessage('adminGiftCardMessage', 'Gift card details updated.');
      await loadAdminGiftCards();
    } catch (error) { setMessage('giftCardEditMessage', error.message || 'Could not save gift card details.', true); }
    finally { submit.disabled = false; }
  });

  const adminPromos = document.getElementById('adminPromos');
  const promoAdminForm = document.getElementById('promoAdminForm');
  const promoPageSize = 5;
  let promoPage = 1;
  let promoPages = 1;
  let promoSearch = '';
  let promoRequest = 0;
  const promoArticle = adminPromos.closest('article');
  const promoToolbar = document.createElement('div');
  promoToolbar.className = 'admin-product-toolbar';
  const promoSearchInput = document.createElement('input');
  promoSearchInput.type = 'search';
  promoSearchInput.className = 'admin-product-search';
  promoSearchInput.placeholder = 'Search promotion codes';
  promoSearchInput.setAttribute('aria-label', 'Search promotion codes');
  const refreshPromotionsButton = document.createElement('button');
  refreshPromotionsButton.type = 'button';
  refreshPromotionsButton.className = 'admin-icon-refresh promo-refresh-button';
  refreshPromotionsButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 11.8-2L20 12M4 12l2.6 5a7 7 0 0 0 11.8-2"/></svg><span>Refresh</span>';
  refreshPromotionsButton.title = 'Refresh offers';
  refreshPromotionsButton.setAttribute('aria-label', 'Refresh offers');
  promoToolbar.append(promoSearchInput, refreshPromotionsButton);
  promoArticle.insertBefore(promoToolbar, adminPromos);
  const promoCampaignPanel = document.createElement('article');
  promoCampaignPanel.className = 'admin-subpanel promo-campaign-panel';
  promoCampaignPanel.innerHTML = '<div class="promo-campaign-heading"><div><span class="eyebrow">SEASONAL EMAILS</span><h4>Festival campaigns</h4><p>Schedule a gentle discount for newsletter subscribers who gave email consent. Emails include an unsubscribe link.</p></div></div><form id="promoCampaignForm" class="promo-campaign-form"><label>Festival or campaign<input name="eventName" maxlength="80" placeholder="Diwali, Christmas…" required></label><label>Discount code<input name="code" maxlength="24" pattern="[A-Za-z0-9_-]{3,24}" placeholder="DIWALI10" required></label><label>Discount %<input name="discountPercent" type="number" min="1" max="15" value="10" required></label><label>Minimum order ₹<input name="minimumSubtotal" type="number" min="0" step="1" value="500" required></label><label>Discount cap ₹<input name="maximumDiscount" type="number" min="0" step="1" value="300" required></label><label>Send email at<input name="sendAt" type="datetime-local" required></label><label>Code expires on<input name="endsAt" type="date" required></label><button class="btn btn-primary" type="submit">Schedule festival email</button></form><p class="store-message" id="promoCampaignMessage" role="status"></p><div class="promo-campaign-list" id="promoCampaignList" aria-live="polite"><p class="chart-empty">Loading scheduled campaigns…</p></div>';
  promoArticle.closest('#admin-offer-section')?.querySelector('.admin-offer-layout')?.insertAdjacentElement('afterend', promoCampaignPanel);
  const promoCampaignForm = promoCampaignPanel.querySelector('#promoCampaignForm');
  const promoCampaignList = promoCampaignPanel.querySelector('#promoCampaignList');
  const promoLoadMore = document.createElement('button');
  promoLoadMore.type = 'button';
  promoLoadMore.className = 'store-secondary admin-load-more';
  promoLoadMore.textContent = 'Load more';
  promoLoadMore.hidden = true;
  const addPromoButton = document.createElement('button');
  addPromoButton.type = 'button';
  addPromoButton.className = 'btn btn-primary promo-add-button';
  addPromoButton.textContent = 'Add offer';
  const promoMessage = document.getElementById('promoAdminMessage');
  adminPromos.insertAdjacentElement('afterend', promoLoadMore);
  promoToolbar.append(addPromoButton);
  promoToolbar.insertAdjacentElement('afterend', promoAdminForm);
  promoAdminForm.insertAdjacentElement('afterend', promoMessage);
  promoAdminForm.style.display = 'none';
  const promoOccasionSelect = promoAdminForm.elements.occasionType;
  const promoEmailToggle = promoAdminForm.elements.sendToSubscribers;
  const promoEmailSchedule = promoAdminForm.querySelector('.promo-email-send-at');
  const syncPromoEmailOptions = ({ selectFestival = false } = {}) => {
    const isFestival = promoOccasionSelect.value === 'festival';
    promoEmailToggle.disabled = !isFestival;
    if (selectFestival) promoEmailToggle.checked = isFestival;
    if (!isFestival) promoEmailToggle.checked = false;
    promoEmailSchedule.hidden = !isFestival || !promoEmailToggle.checked;
    promoAdminForm.elements.sendAt.required = !promoEmailSchedule.hidden;
    if (!promoEmailSchedule.hidden && !promoAdminForm.elements.sendAt.value) {
      const soon = new Date(Date.now() + 5 * 60_000);
      soon.setMinutes(soon.getMinutes() - soon.getTimezoneOffset());
      promoAdminForm.elements.sendAt.value = soon.toISOString().slice(0, 16);
    }
  };
  promoOccasionSelect.addEventListener('change', () => syncPromoEmailOptions({ selectFestival: true }));
  promoEmailToggle.addEventListener('change', () => syncPromoEmailOptions());
  syncPromoEmailOptions();
  addPromoButton.addEventListener('click', () => {
    const showForm = promoAdminForm.style.display === 'none';
    promoAdminForm.style.display = showForm ? 'grid' : 'none';
    addPromoButton.textContent = showForm ? 'Close form' : 'Add offer';
    if (showForm) {
      const localToday = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      promoAdminForm.elements.endsAt.min = localToday;
      promoAdminForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  async function loadAdminPromotions({ append = false } = {}) {
    const requestId = ++promoRequest;
    const page = append ? promoPage + 1 : 1;
    const params = new URLSearchParams({ page: String(page), limit: String(promoPageSize) });
    if (promoSearch) params.set('search', promoSearch);
    adminPromos.setAttribute('aria-busy', 'true');
    promoLoadMore.disabled = true;
    try {
      const data = await api(`/commerce/admin/promotions?${params}`, { cache: 'no-store' });
      if (requestId !== promoRequest) return;
      promoPage = data.page;
      promoPages = data.pages;
      const rows = data.promotions.map((promo) => {
        const expiry = promo.endsAt ? new Date(promo.endsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'No expiry';
        const description = promo.description ? `${escapeHtml(promo.description)} · ` : '';
        const occasion = promo.occasionType ? `${escapeHtml(promo.occasionType)} · ` : '';
        const emailState = promo.sendToSubscribers ? ' · festival email scheduled' : '';
        return `<article class="admin-list-row"><span><strong>${escapeHtml(promo.code)}</strong><small>${occasion}${description}${promo.type === 'percent' ? `${promo.value}%` : money(promo.value)} off · Expires ${escapeHtml(expiry)} · ${promo.usedCount} uses · ${promo.active ? 'active' : 'paused'}${emailState}</small></span><button class="store-secondary" type="button" data-promo-id="${escapeHtml(promo._id)}" data-active="${!promo.active}">${promo.active ? 'Pause' : 'Activate'}</button></article>`;
      }).join('');
      if (append) adminPromos.insertAdjacentHTML('beforeend', rows);
      else adminPromos.innerHTML = rows || `<p>${promoSearch ? 'No offers match your search.' : 'No promotions created.'}</p>`;
      promoLoadMore.hidden = data.page >= data.pages;
    } catch (error) {
      if (requestId === promoRequest && !append) adminPromos.innerHTML = `<p class="error-text">Could not load offers: ${escapeHtml(error.message)}</p>`;
    } finally {
      if (requestId === promoRequest) {
        adminPromos.removeAttribute('aria-busy');
        promoLoadMore.disabled = false;
      }
    }
  }
  promoLoadMore.addEventListener('click', () => loadAdminPromotions({ append: true }));
  refreshPromotionsButton.addEventListener('click', () => loadAdminPromotions());
  let promoSearchTimer;
  promoSearchInput.addEventListener('input', () => {
    window.clearTimeout(promoSearchTimer);
    promoSearchTimer = window.setTimeout(() => {
      promoSearch = promoSearchInput.value.trim();
      loadAdminPromotions();
    }, 250);
  });

  async function loadAdminPromoCampaigns() {
    try {
      const { campaigns } = await api('/commerce/admin/promo-campaigns', { cache: 'no-store' });
      promoCampaignList.innerHTML = campaigns.length ? campaigns.map((campaign) => `<article class="promo-campaign-row"><div><strong>${escapeHtml(campaign.eventName)}</strong><small>${escapeHtml(campaign.code)} · ${Number(campaign.discountPercent)}% off · email scheduled ${new Date(campaign.sendAt).toLocaleString('en-IN')}</small>${campaign.sentCount ? `<small>${Number(campaign.sentCount)} subscriber email${Number(campaign.sentCount) === 1 ? '' : 's'} sent</small>` : ''}${campaign.lastError ? `<small class="promo-campaign-error">${escapeHtml(campaign.lastError)}</small>` : ''}</div><span class="promo-campaign-status is-${escapeHtml(campaign.status)}">${escapeHtml(campaign.status)}</span></article>`).join('') : '<p class="chart-empty">No festival emails scheduled yet.</p>';
    } catch (error) { promoCampaignList.innerHTML = `<p class="error-text">Could not load campaigns: ${escapeHtml(error.message)}</p>`; }
  }
  promoCampaignForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    const values = Object.fromEntries(new FormData(form));
    values.sendAt = new Date(values.sendAt).toISOString();
    values.endsAt = new Date(`${values.endsAt}T23:59:59`).toISOString();
    submit.disabled = true;
    try {
      const result = await api('/commerce/admin/promo-campaigns', { method: 'POST', body: JSON.stringify(values) });
      form.reset();
      form.elements.discountPercent.value = 10;
      form.elements.minimumSubtotal.value = 500;
      form.elements.maximumDiscount.value = 300;
      setMessage('promoCampaignMessage', result.message);
      await Promise.all([loadAdminPromoCampaigns(), loadAdminPromotions()]);
    } catch (error) { setMessage('promoCampaignMessage', error.message, true); }
    finally { submit.disabled = false; }
  });
  loadAdminPromoCampaigns();

  async function loadAdminTools() {
    if (getUser()?.role !== 'admin') return;
    try {
      const reportParams = new URLSearchParams();
      if (document.getElementById('reportFrom').value) reportParams.set('from', document.getElementById('reportFrom').value);
      if (document.getElementById('reportTo').value) reportParams.set('to', document.getElementById('reportTo').value);
      const reportQuery = reportParams.toString() ? `?${reportParams}` : '';
      const [catalog, , , insights, deliveryZones, policy, savedCategories] = await Promise.all([loadAdminProductPage(), loadAdminPromotions(), loadAdminPromoCampaigns(), api(`/admin/insights${reportQuery}`), api('/delivery/admin/zones'), api('/policy'), api('/catalog/admin/categories?page=1&limit=50')]);
      const categorySelect = document.querySelector('#productAdminForm [name="category"]');
      const knownCategoryValues = new Set([...categorySelect.options].map((option) => option.value));
      [...savedCategories.categories.map((category) => category.name), ...catalog.products.map((product) => product.category)].forEach((category) => {
        if (!knownCategoryValues.has(category)) {
          categorySelect.add(new Option(category, category), categorySelect.querySelector('option[value="other"]'));
          knownCategoryValues.add(category);
        }
      });
      document.querySelector('[name="cancellationCutoffStatus"]').value = policy.cancellationCutoffStatus;
      document.querySelector('[name="referralFriendPoints"]').value = policy.referralFriendPoints;
      document.querySelector('[name="referralOwnerPoints"]').value = policy.referralOwnerPoints;
      renderSalesCharts(insights);
      renderSalesSupportingData(insights);
      document.getElementById('adminDeliveryZones').innerHTML = deliveryZones.zones.map((zone) => `<article class="admin-list-row"><span><strong>${escapeHtml(zone.minKm)}–${escapeHtml(zone.maxKm)} km · ${money(zone.fee)}</strong><small>${zone.active ? 'active' : 'paused'}</small></span><button class="store-secondary" type="button" data-delivery-zone="${escapeHtml(zone._id)}" data-active="${!zone.active}">${zone.active ? 'Pause' : 'Activate'}</button></article>`).join('') || '<p>No distance fees configured. Surathkal and bakery pickup remain free.</p>';
    } catch (error) { setMessage('productAdminMessage', error.message, true); }
  }

  const productAdminForm = document.getElementById('productAdminForm');
  const productAdminMessage = document.getElementById('productAdminMessage');
  const adminProducts = document.getElementById('adminProducts');
  const productSectionHeading = document.querySelector('#admin-product-section .admin-section-heading');
  const adminProductLimit = 5;
  let adminProductPage = 1;
  let adminProductPages = 1;
  let adminProductSearch = '';
  let adminProductRequest = 0;
  const productToolbar = document.createElement('div');
  productToolbar.className = 'admin-product-toolbar';
  const productSearchInput = document.createElement('input');
  productSearchInput.type = 'search';
  productSearchInput.className = 'admin-product-search';
  productSearchInput.placeholder = 'Search cakes by name, category or description';
  productSearchInput.setAttribute('aria-label', 'Search products');
  const loadMoreProductsButton = document.createElement('button');
  loadMoreProductsButton.type = 'button';
  loadMoreProductsButton.className = 'store-secondary admin-load-more';
  loadMoreProductsButton.textContent = 'Load more';
  loadMoreProductsButton.hidden = true;
  const addProductButton = document.createElement('button');
  addProductButton.type = 'button';
  addProductButton.className = 'btn btn-primary';
  addProductButton.textContent = 'Add product';
  const refreshProductsButton = document.createElement('button');
  refreshProductsButton.type = 'button';
  refreshProductsButton.className = 'admin-icon-refresh';
  refreshProductsButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.8-4L4 9"/><path d="M4 4v5h5M4 13a8 8 0 0 0 14.8 4L20 15"/><path d="M20 20v-5h-5"/></svg><span>Refresh</span>';
  refreshProductsButton.title = 'Refresh products';
  refreshProductsButton.setAttribute('aria-label', 'Refresh products');
  productToolbar.append(productSearchInput, refreshProductsButton, addProductButton);
  productSectionHeading.insertAdjacentElement('afterend', productToolbar);
  const adminProductCard = (product) => `<details class="admin-product-card"><summary><img src="${escapeHtml(product.image)}" alt=""><span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category)} · ${product.available ? 'Available' : 'Hidden'} · from ${money(product.sizes[0]?.price)}</small></span><b aria-hidden="true">⌄</b></summary><div class="admin-product-details"><p>${escapeHtml(product.description)}</p><p><strong>Flavours:</strong> ${escapeHtml(product.flavors.join(', '))}</p><p><strong>Sizes:</strong> ${product.sizes.map((size) => `${escapeHtml(size.name)} ${money(size.price)}`).join(' · ')}</p><p><strong>Allergens:</strong> ${escapeHtml(product.allergens.join(', ') || 'Not specified')}</p><p><strong>Dietary:</strong> ${escapeHtml(product.dietaryTags.join(', ') || 'No verified tags')}</p><button class="store-secondary" type="button" data-edit-product="${escapeHtml(product.slug)}">Edit cake details</button></div></details>`;
  async function loadAdminProductPage({ append = false } = {}) {
    const requestId = ++adminProductRequest;
    const page = append ? adminProductPage + 1 : 1;
    const params = new URLSearchParams({ page: String(page), limit: String(adminProductLimit) });
    if (adminProductSearch) params.set('search', adminProductSearch);
    adminProducts.setAttribute('aria-busy', 'true');
    if (!append) adminProducts.classList.add('is-loading');
    loadMoreProductsButton.disabled = true;
    try {
      const data = await api(`/catalog/admin/products?${params}`, { cache: 'no-store' });
      if (requestId !== adminProductRequest) return data;
      adminProductPage = data.page;
      adminProductPages = data.pages;
      const cards = data.products.map(adminProductCard).join('');
      if (append) adminProducts.insertAdjacentHTML('beforeend', cards);
      else adminProducts.innerHTML = cards || `<p>${adminProductSearch ? 'No cakes match your search.' : 'No cakes yet. Use Add product to create the first one.'}</p>`;
      loadMoreProductsButton.hidden = data.page >= data.pages;
      return data;
    } catch (error) {
      if (requestId === adminProductRequest) setMessage('productAdminMessage', error.message, true);
      throw error;
    } finally {
      if (requestId === adminProductRequest) {
        adminProducts.removeAttribute('aria-busy');
        adminProducts.classList.remove('is-loading');
        loadMoreProductsButton.disabled = false;
      }
    }
  }
  let productSearchTimer;
  productSearchInput.addEventListener('input', () => {
    window.clearTimeout(productSearchTimer);
    productSearchTimer = window.setTimeout(() => {
      adminProductSearch = productSearchInput.value.trim();
      loadAdminProductPage().catch(() => {});
    }, 250);
  });
  loadMoreProductsButton.addEventListener('click', () => loadAdminProductPage({ append: true }).catch(() => {}));
  refreshProductsButton.addEventListener('click', () => loadAdminProductPage().catch(() => {}));
  productSectionHeading.parentElement.insertBefore(adminProducts, productAdminForm);
  productSectionHeading.insertAdjacentElement('afterend', productToolbar);
  adminProducts.insertAdjacentElement('afterend', loadMoreProductsButton);
  productAdminForm.style.display = 'none';
  productAdminMessage.style.display = 'none';
  addProductButton.addEventListener('click', () => {
    const showForm = productAdminForm.style.display === 'none';
    productAdminForm.style.display = showForm ? 'grid' : 'none';
    productAdminMessage.style.display = showForm ? '' : 'none';
    addProductButton.textContent = showForm ? 'Close form' : 'Add product';
    if (showForm) productAdminForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  const photoInput = productAdminForm.elements.photoFile;
  const categorySelect = productAdminForm.elements.category;
  const customCategoryInput = productAdminForm.elements.customCategory;
  let photoProcessing = Promise.resolve();
  const syncCustomCategory = () => {
    const isCustom = categorySelect.value === 'other';
    customCategoryInput.hidden = !isCustom;
    customCategoryInput.required = isCustom;
    if (!isCustom) customCategoryInput.value = '';
  };
  categorySelect.addEventListener('change', syncCustomCategory);
  syncCustomCategory();
  async function compressCakePhoto(file) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP cake photo.');
    if (file.size > 12 * 1024 * 1024) throw new Error('Choose a photo smaller than 12 MB.');
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d', { alpha: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    let dataUrl = canvas.toDataURL('image/webp', 0.82);
    if (dataUrl.length > 1_250_000) dataUrl = canvas.toDataURL('image/jpeg', 0.58);
    if (dataUrl.length > 1_400_000) throw new Error('This photo is still too large after resizing. Choose a smaller image.');
    return dataUrl;
  }
  photoInput.addEventListener('change', () => {
    const files = [...(photoInput.files || [])];
    if (!files.length) return;
    if (files.length > 5) {
      photoInput.value = '';
      delete productAdminForm.dataset.pendingImages;
      setMessage('productAdminMessage', 'Choose up to 5 cake photos.', true);
      return;
    }
    delete productAdminForm.dataset.pendingImages;
    setMessage('productAdminMessage', `Preparing ${files.length} cake photo${files.length === 1 ? '' : 's'}…`);
    photoProcessing = (async () => {
      try {
        const images = await Promise.all(files.map(compressCakePhoto));
        productAdminForm.dataset.pendingImages = JSON.stringify(images);
        document.getElementById('productPhotoPreview').innerHTML = `${images.map((image, index) => `<img src="${image}" alt="Cake photo ${index + 1} preview">`).join('')}<span>${images.length} photos ready to save</span>`;
        document.getElementById('productPhotoPreview').hidden = false;
        setMessage('productAdminMessage', 'Cake photos added. Save the cake to publish them.');
      } catch (error) {
        photoInput.value = '';
        setMessage('productAdminMessage', error.message || 'The photo could not be prepared. Choose another image.', true);
        throw error;
      }
    })();
    // Keep the rejection handled here; the submit handler reports it if Save was pressed meanwhile.
    photoProcessing.catch(() => {});
  });
  const resetProductForm = () => {
    productAdminForm.reset();
    delete productAdminForm.dataset.editSlug;
    delete productAdminForm.dataset.editImage;
    delete productAdminForm.dataset.editImages;
    delete productAdminForm.dataset.pendingImages;
    photoProcessing = Promise.resolve();
    syncCustomCategory();
    photoInput.required = true;
    document.getElementById('productPhotoPreview').hidden = true;
    document.getElementById('productPhotoPreview').innerHTML = '';
  };
  const productAdminPayload = (form) => {
    const fields = new FormData(form);
    const sizes = String(fields.get('sizes') || '').split(',').map((entry) => { const [name, price] = entry.split(':'); return { name: name.trim(), price: Number(price) }; });
    const name = String(fields.get('name') || '').trim();
    const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    const category = fields.get('category') === 'other' ? fields.get('customCategory') : fields.get('category');
    const customAllergens = String(fields.get('customAllergens') || '').split(',').map((item) => item.trim()).filter(Boolean);
    const stock = Number(fields.get('stock') !== null && fields.get('stock') !== '' ? fields.get('stock') : 20);
    const lowStockThreshold = Number(fields.get('lowStockThreshold') !== null && fields.get('lowStockThreshold') !== '' ? fields.get('lowStockThreshold') : 5);
    const images = JSON.parse(form.dataset.pendingImages || form.dataset.editImages || (form.dataset.editImage ? JSON.stringify([form.dataset.editImage]) : '[]'));
    return { slug, name, category, image: images[0] || '', images, description: fields.get('description'), flavors: String(fields.get('flavors')).split(',').map((item) => item.trim()).filter(Boolean), sizes, allergens: [...new Set([...fields.getAll('allergens'), ...customAllergens])], dietaryTags: fields.getAll('dietaryTags'), available: productAdminForm.elements.available.checked, seasonal: productAdminForm.elements.seasonal.checked, stock, lowStockThreshold };
  };
  productAdminForm.addEventListener('invalid', (event) => {
    const firstInvalid = productAdminForm.querySelector(':invalid') || event.target;
    const fieldLabel = firstInvalid.closest('.admin-field,.admin-photo-field');
    const fieldName = fieldLabel?.childNodes[0]?.textContent?.trim() || firstInvalid.getAttribute('aria-label') || 'a required field';
    setMessage('productAdminMessage', `Please complete ${fieldName} before saving.`, true);
  }, true);
  productAdminForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitButton = productAdminForm.querySelector('button[type="submit"]');
    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Saving cake…';
    setMessage('productAdminMessage', 'Saving cake details…');
    try {
      if (photoInput.files?.length && !productAdminForm.dataset.pendingImages) await photoProcessing;
      const payload = productAdminPayload(productAdminForm);
      const editSlug = productAdminForm.dataset.editSlug;
      if (!payload.images.length) { setMessage('productAdminMessage', 'Choose at least one cake photo before saving.', true); photoInput.focus(); return; }
      await api(editSlug ? `/catalog/admin/products/${encodeURIComponent(editSlug)}` : '/catalog/admin/products', { method: editSlug ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      resetProductForm();
      productAdminForm.style.display = 'none';
      productAdminMessage.style.display = 'none';
      addProductButton.textContent = 'Add product';
      setMessage('productAdminMessage', editSlug ? 'Product updated successfully.' : 'Product added successfully.');
      await Promise.all([loadAdminTools(), loadCatalog(), loadAdminInventory()]);
    } catch (error) { setMessage('productAdminMessage', error.message || 'Cake could not be saved. Check the details and try again.', true); }
    finally { submitButton.disabled = false; submitButton.textContent = originalLabel; }
  });
  document.getElementById('adminProducts')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-edit-product]');
    if (!button) return;
    try {
      const { product } = await api(`/catalog/admin/products/${encodeURIComponent(button.dataset.editProduct)}`, { cache: 'no-store' });
      if (!product) return;
      resetProductForm();
      productAdminForm.style.display = 'grid';
      productAdminMessage.style.display = '';
      addProductButton.textContent = 'Close form';
      productAdminForm.dataset.editSlug = product.slug;
      productAdminForm.dataset.editImage = product.image;
      productAdminForm.dataset.editImages = JSON.stringify(product.images?.length ? product.images : [product.image]);
      for (const field of ['name', 'description']) productAdminForm.elements[field].value = product[field] || '';
      if (![...categorySelect.options].some((option) => option.value === product.category)) categorySelect.add(new Option(product.category, product.category));
      categorySelect.value = product.category;
      syncCustomCategory();
      photoInput.required = false;
      productAdminForm.elements.flavors.value = product.flavors.join(', ');
      productAdminForm.elements.sizes.value = product.sizes.map((size) => `${size.name}:${size.price}`).join(', ');
      const allergenOptions = [...productAdminForm.querySelectorAll('[name="allergens"]')];
      allergenOptions.forEach((box) => { box.checked = product.allergens.includes(box.value); });
      productAdminForm.elements.customAllergens.value = product.allergens.filter((allergen) => !allergenOptions.some((box) => box.value === allergen)).join(', ');
      productAdminForm.elements.available.checked = product.available;
      productAdminForm.elements.seasonal.checked = product.seasonal;
      productAdminForm.querySelectorAll('[name="dietaryTags"]').forEach((box) => { box.checked = product.dietaryTags.includes(box.value); });
      if (productAdminForm.elements.stock) productAdminForm.elements.stock.value = product.stock ?? 20;
      if (productAdminForm.elements.lowStockThreshold) productAdminForm.elements.lowStockThreshold.value = product.lowStockThreshold ?? 5;
      const currentImages = product.images?.length ? product.images : [product.image];
      document.getElementById('productPhotoPreview').innerHTML = `${currentImages.map((image, index) => `<img src="${escapeHtml(image)}" alt="Current ${escapeHtml(product.name)} photo ${index + 1}">`).join('')}<span>${currentImages.length} current photo${currentImages.length === 1 ? '' : 's'} · choose photos to replace the gallery</span>`;
      document.getElementById('productPhotoPreview').hidden = false;
      setMessage('productAdminMessage', `Editing ${product.name}. Update any fields and save your changes.`);
      productAdminForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { setMessage('productAdminMessage', error.message, true); }
  });
  document.getElementById('clearProductForm')?.addEventListener('click', resetProductForm);
  document.getElementById('adminCustomers')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-customer]');
    if (!button) return;
    const name = button.dataset.customerName || 'this customer';
    if (!window.confirm(`Remove ${name}'s customer account? Completed order records will remain anonymized.`)) return;
    button.disabled = true;
    try {
      const result = await api(`/admin/customers/${encodeURIComponent(button.dataset.deleteCustomer)}`, { method: 'DELETE' });
      setMessage('adminCustomersMessage', result.message);
      await Promise.all([loadAdminCustomers(), loadAdminTools()]);
    } catch (error) { setMessage('adminCustomersMessage', error.message, true); }
    finally { button.disabled = false; }
  });
  let customerSearchTimer;
  document.getElementById('adminCustomerSearch')?.addEventListener('input', () => { clearTimeout(customerSearchTimer); customerSearchTimer = setTimeout(loadAdminCustomers, 250); });
  document.getElementById('refreshAdminCustomers')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try { await loadAdminCustomers(); }
    finally { button.disabled = false; button.removeAttribute('aria-busy'); }
  });
  promoAdminForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const sendEmail = promoEmailToggle.checked && promoOccasionSelect.value === 'festival';
    values.sendToSubscribers = sendEmail;
    if (sendEmail) values.sendAt = new Date(values.sendAt).toISOString();
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
      const result = await api('/commerce/admin/promotions', { method: 'POST', body: JSON.stringify(values) });
      form.reset();
      syncPromoEmailOptions();
      form.style.display = 'none';
      addPromoButton.textContent = 'Add offer';
      setMessage('promoAdminMessage', sendEmail ? 'Festival offer created. Its email is scheduled for customers who opted into bakery emails.' : 'Offer created successfully. No customer email was sent.');
      await Promise.all([loadAdminPromotions(), sendEmail ? loadAdminPromoCampaigns() : Promise.resolve()]);
    } catch (error) { setMessage('promoAdminMessage', error.message, true); }
    finally { submitButton.disabled = false; }
  });
  document.getElementById('adminPromos')?.addEventListener('click', async (event) => { const button = event.target.closest('[data-promo-id]'); if (!button) return; button.disabled = true; try { await api(`/commerce/admin/promotions/${encodeURIComponent(button.dataset.promoId)}`, { method: 'PATCH', body: JSON.stringify({ active: button.dataset.active === 'true' }) }); await loadAdminPromotions(); } catch (error) { setMessage('promoAdminMessage', error.message, true); } finally { button.disabled = false; } });
  document.getElementById('deliveryZoneForm')?.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; try { await api('/delivery/admin/zones', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); form.reset(); setMessage('deliveryAdminMessage', 'Distance fee band added.'); await loadAdminTools(); } catch (error) { setMessage('deliveryAdminMessage', error.message, true); } });
  document.getElementById('adminDeliveryZones')?.addEventListener('click', async (event) => { const button = event.target.closest('[data-delivery-zone]'); if (!button) return; try { await api(`/delivery/admin/zones/${encodeURIComponent(button.dataset.deliveryZone)}`, { method: 'PATCH', body: JSON.stringify({ active: button.dataset.active === 'true' }) }); await loadAdminTools(); } catch (error) { setMessage('deliveryAdminMessage', error.message, true); } });
  document.getElementById('cancellationPolicyForm')?.addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; try { const result = await api('/policy/admin', { method: 'PUT', body: JSON.stringify({ cancellationCutoffStatus: form.elements.cancellationCutoffStatus.value, referralFriendPoints: Number(form.elements.referralFriendPoints.value), referralOwnerPoints: Number(form.elements.referralOwnerPoints.value) }) }); cancellationCutoff = result.cancellationCutoffStatus; setMessage('cancellationPolicyMessage', result.message); await loadCustomerOrders(); } catch (error) { setMessage('cancellationPolicyMessage', error.message, true); } });

  async function loadCancellationPolicy() {
    try {
      const policy = await api('/policy');
      cancellationCutoff = policy.cancellationCutoffStatus;
      const labels = { placed: 'placed', confirmed: 'confirmed', preparing: 'when preparation starts', ready: 'when the cake is ready' };
      document.getElementById('cancelPolicyHint').textContent = `Cancel at least one day before delivery, while the order is no later than ${labels[cancellationCutoff]}. Same-day cancellations are unavailable; contact the bakery if you need help.`;
      if (getToken()) await loadCustomerOrders();
    } catch { /* The default cancellation rule remains in effect if policy lookup is unavailable. */ }
  }

  productGrid?.addEventListener('error', (event) => {
    const image = event.target.closest('.product-photo');
    if (!image || image.dataset.fallbackApplied || !image.dataset.fallbackSrc) return;
    image.dataset.fallbackApplied = 'true';
    image.src = image.dataset.fallbackSrc;
  }, true);
  function loadCheckoutScript() {
    if (window.Razorpay) return Promise.resolve();
    if (window.razorpayScriptPromise) return window.razorpayScriptPromise;
    window.razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Unable to load the secure payment window.'));
      document.head.appendChild(script);
    });
    return window.razorpayScriptPromise;
  }

  async function launchCheckout(payment, orderNumber) {
    await loadCheckoutScript();
    const user = getUser() || {};
    const checkout = new window.Razorpay({
      key: payment.keyId,
      amount: payment.amount,
      currency: payment.currency,
      name: 'Cakes of Paradise',
      description: `Cake order ${orderNumber}`,
      order_id: payment.orderId,
      prefill: { name: user.name || '', email: user.email || '' },
      theme: { color: '#80503d' },
      handler: async (response) => {
        try {
          await api(`/orders/${encodeURIComponent(orderNumber)}/payment/verify`, { method: 'POST', body: JSON.stringify(response) });
          setMessage('ordersMessage', `Payment confirmed for ${orderNumber}. Your order is now placed.`);
          await loadCustomerOrders();
          if (getUser()?.role === 'admin') await loadAdminOrders();
        } catch (error) {
          setMessage('ordersMessage', `${error.message} Your order ${orderNumber} remains available for tracking.`, true);
          await loadCustomerOrders();
        }
      },
      modal: { ondismiss: () => setMessage('ordersMessage', `Checkout closed. You can finish payment for ${orderNumber} from Your orders.`) },
    });
    checkout.on('payment.failed', (response) => setMessage('ordersMessage', response.error?.description || 'Payment failed. You can try again from Your orders.', true));
    checkout.open();
  }

  productGrid?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    if (button.dataset.action === 'favorite') {
      const productId = button.dataset.product;
      const currentlySaved = button.getAttribute('aria-pressed') === 'true';
      const ids = new Set(wishlistIds());
      currentlySaved ? ids.delete(productId) : ids.add(productId);
      saveWishlist([...ids]);
      renderProducts();
      showWishlistSuccess(productData.find((product) => product.id === productId)?.name || featuredProductData.find((product) => product.id === productId)?.name || 'Your cake', currentlySaved ? 'removed' : 'added');
      try {
        if (hasWishlistAccount()) {
          const result = await api(`/auth/account/favorites/${encodeURIComponent(productId)}`, { method: 'PUT' });
          if (accountData?.user) accountData.user.favoriteProducts = result.favoriteProducts || [];
          saveWishlist([...new Set([...readWishlist(), ...(result.favoriteProducts || [])])]);
        }
        setMessage('catalogMessage', currentlySaved ? 'Removed from your wishlist.' : 'Saved to your wishlist.');
      } catch (error) { setMessage('catalogMessage', `Saved on this device. Account sync failed: ${error.message}`, true); }
      if (document.getElementById('wishlistOnlyToggle')?.getAttribute('aria-pressed') === 'true') loadCatalog(1);
      return;
    }
    if (button.dataset.action === 'open-modal') {
      openProductModal(button.dataset.product);
      return;
    }
    if (button.dataset.action !== 'add') return;
    if (button.disabled) return;
    const card = button.closest('.product-card');
    const product = productData.find((item) => item.id === button.dataset.product);
    if (!product) return;

    button.disabled = true;
    const originalMarkup = button.innerHTML;
    button.innerHTML = `${bagIconMarkup}<span>Adding…</span>`;

    try {
      const sizeSelect = card.querySelector('.product-size');
      const flavorSelect = card.querySelector('.product-flavor');
      const sizeName = sizeSelect?.value || product.sizes[0]?.name;
      const flavor = flavorSelect?.value || product.flavors[0];
      const size = product.sizes.find((item) => item.name === sizeName);
      if (!size) throw new Error('Please choose a valid size');

      const existing = cart.find((item) => item.productId === product.id && item.size === sizeName && item.flavor === flavor && !(item.cakeMessage || ''));
      if (existing) existing.quantity = Math.min(10, existing.quantity + 1);
      else cart.push({ productId: product.id, name: product.name, size: sizeName, flavor, price: size.price, quantity: 1 });
      await saveCart();
      renderCart();
      showAddToCartToast(product.name, flavor, sizeName, product.image);
      setMessage('catalogMessage', `“${product.name}” added to your cart.`);
    } catch (err) {
      showAddToCartError(err.message || 'Could not add cake to cart. Please try again.');
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = originalMarkup;
      }, 350);
    }
  });

  productGrid?.addEventListener('click', (event) => {
    const card = event.target.closest('.shop-product-card');
    if (!card || event.target.closest('button,a,select,summary,input')) return;
    openProductModal(card.dataset.productCard);
  });
  productGrid?.addEventListener('keydown', (event) => {
    const card = event.target.closest('.shop-product-card');
    if (!card || event.target !== card || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openProductModal(card.dataset.productCard);
  });

  document.getElementById('cakesGrid')?.addEventListener('click', (event) => {
    const favorite = event.target.closest('[data-featured-favorite]');
    if (favorite) {
      event.stopPropagation();
      const productId = favorite.dataset.featuredFavorite;
      const wasSaved = favorite.getAttribute('aria-pressed') === 'true';
      const ids = new Set(wishlistIds());
      wasSaved ? ids.delete(productId) : ids.add(productId);
      saveWishlist([...ids]);
      const isSaved = !wasSaved;
      favorite.setAttribute('aria-pressed', String(isSaved));
      favorite.textContent = isSaved ? '♥' : '♡';
      const product = featuredProductData.find((item) => item.id === productId);
      favorite.setAttribute('aria-label', `${isSaved ? 'Remove' : 'Add'} ${product?.name || 'cake'} ${isSaved ? 'from' : 'to'} wishlist`);
      showWishlistSuccess(product?.name || 'Your cake', isSaved ? 'added' : 'removed');
      if (hasWishlistAccount()) {
        api(`/auth/account/favorites/${encodeURIComponent(productId)}`, { method: 'PUT' }).then((result) => {
          if (accountData?.user) accountData.user.favoriteProducts = result.favoriteProducts || [];
          saveWishlist([...new Set([...readWishlist(), ...(result.favoriteProducts || [])])]);
        }).catch((error) => setMessage('catalogMessage', `Saved on this device. Account sync failed: ${error.message}`, true));
      }
      setMessage('catalogMessage', isSaved ? 'Saved to your wishlist.' : 'Removed from your wishlist.');
      return;
    }
    const button = event.target.closest('[data-featured-add]');
    const card = event.target.closest('[data-featured-product]');
    if (button) {
      if (button.disabled) return;
    } else if (card) {
      openProductModal(card.dataset.featuredProduct);
      return;
    } else return;
    const product = featuredProductData.find((item) => item.id === button.dataset.featuredAdd);
    const size = product?.sizes?.[0];
    const flavor = product?.flavors?.[0];
    if (!product || !size || !flavor) return;
    const existing = cart.find((item) => item.productId === product.id && item.size === size.name && item.flavor === flavor && !(item.cakeMessage || ''));
    if (existing) existing.quantity = Math.min(10, existing.quantity + 1);
    else cart.push({ productId: product.id, name: product.name, size: size.name, flavor, price: size.price, quantity: 1 });
    saveCart();
    renderCart();
    showAddToCartToast(product.name, flavor, size.name, product.image);
    setMessage('catalogMessage', `“${product.name}” added to your cart.`);
    button.innerHTML = `${bagIconMarkup}<span>Added</span>`;
    button.disabled = true;
    setTimeout(() => { button.innerHTML = `${bagIconMarkup}<span>Add to bag</span>`; button.disabled = false; }, 800);
  });
  document.getElementById('cakesGrid')?.addEventListener('keydown', (event) => {
    const card = event.target.closest('[data-featured-product]');
    if (!card || event.target !== card || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openProductModal(card.dataset.featuredProduct);
  });

  productGrid?.addEventListener('change', (event) => {
    if (!event.target.matches('.product-size')) return;
    const card = event.target.closest('.product-card');
    const option = event.target.selectedOptions[0];
    card.querySelector('.product-price').textContent = money(option.dataset.price);
  });

  productGrid?.addEventListener('toggle', (event) => {
    const details = event.target;
    if (details.tagName !== 'DETAILS' || !details.open || details.dataset.loaded) return;
    details.dataset.loaded = 'true';
    loadReviews(details.dataset.product, details.closest('.product-card'));
  }, true);

  productGrid?.addEventListener('submit', async (event) => {
    const form = event.target.closest('.review-form');
    if (!form) return;
    event.preventDefault();
    if (!getToken()) return setMessage('catalogMessage', 'Sign in and complete an order before posting a review.', true);
    const button = form.querySelector('button');
    button.disabled = true;
    try {
      await api(`/catalog/${encodeURIComponent(form.dataset.product)}/reviews`, {
        method: 'POST', body: JSON.stringify({ rating: form.elements.rating.value, comment: form.elements.comment.value }),
      });
      form.reset();
      await loadReviews(form.dataset.product, form.closest('.product-card'));
      setMessage('catalogMessage', 'Thanks for sharing your review!');
      await loadCatalog();
    } catch (error) {
      setMessage('catalogMessage', error.message, true);
    } finally { button.disabled = false; }
  });

  document.getElementById('clearCategoryBannerBtn')?.addEventListener('click', () => {
    document.getElementById('catalogCategory').value = 'All';
    syncCollectionCategoryState('All');
    updateCategoryBanner('All');
    loadCatalog(1);
  });

  // Support URL ?category= query parameter or hash #category=
  function checkUrlCategory({ load = true, scroll = true } = {}) {
    const urlParams = new URLSearchParams(window.location.search);
    let catParam = urlParams.get('category');
    if (!catParam && window.location.hash) {
      const match = window.location.hash.match(/(?:category|cat)=([^&]+)/i);
      if (match) catParam = decodeURIComponent(match[1]);
    }
    if (catParam) {
      const canonical = CANONICAL_CATEGORIES[catParam.toLowerCase()] || catParam;
      selectCategoryAndScroll(canonical, { load, scroll });
    }
  }
  window.addEventListener('hashchange', checkUrlCategory);

  initGallery();

  document.getElementById('customerOrders')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-order-action]');
    if (!button) return;
    button.disabled = true;
    try {
      if (button.dataset.orderAction === 'retry') {
        const data = await api(`/orders/${encodeURIComponent(button.dataset.order)}/payment/retry`, { method: 'POST' });
        await launchCheckout(data.payment, button.dataset.order);
      } else if (button.dataset.orderAction === 'cancel') {
        const data = await api(`/orders/${encodeURIComponent(button.dataset.order)}/cancel`, { method: 'POST', body: JSON.stringify({}) });
        await Promise.all([loadCustomerOrders(), loadAccount()]);
        setMessage('ordersMessage', data.message);
      }
    } catch (error) { setMessage('ordersMessage', error.message, true); }
    finally { button.disabled = false; }
  });

  document.getElementById('adminOrders')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-order-action]');
    if (!button) return;
    const orderNumber = button.dataset.order;
    const orderCardNode = button.closest('.admin-order-card');
    const actionType = button.dataset.orderAction;
    const paymentMethod = orderCardNode?.dataset.paymentMethod;
    const unpaid = isOrderUnpaid(orderCardNode?.dataset.paymentStatus);
    let markPaid = false;
    let confirmOfflineRefund = false;
    if (actionType === 'status') {
      const requestedStatus = document.querySelector(`[data-next-status="${CSS.escape(orderNumber)}"]`).value;
      if (requestedStatus === 'completed' && unpaid) {
        if (isOfflinePayment(paymentMethod)) {
          if (!window.confirm('Payment not received. Mark as Paid first?')) return;
          markPaid = true;
        } else {
          setMessage('adminMessage', 'Payment not received. Complete and verify the online payment before marking this order Completed.', true);
          return;
        }
      }
      if (requestedStatus === 'cancelled' && !unpaid && isOfflinePayment(paymentMethod)) {
        if (!window.confirm('This order has been paid offline. Cancel it and set payment to Refund Due?')) return;
        confirmOfflineRefund = true;
      }
    }
    if (actionType === 'refund' && isOfflinePayment(paymentMethod)) {
      if (!window.confirm('Confirm that you have returned this offline payment to the customer.')) return;
      confirmOfflineRefund = true;
    }
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Saving…';
    setMessage('adminMessage', `Saving ${orderNumber}…`);
    try {
      let successMessage = '';
      if (button.dataset.orderAction === 'paid') {
        const result = await api(`/orders/admin/${encodeURIComponent(orderNumber)}/payment/paid`, { method: 'PATCH' });
        successMessage = result.message || `Payment recorded for ${orderNumber}.`;
      } else if (button.dataset.orderAction === 'refund') {
        const result = await api(`/orders/admin/${encodeURIComponent(orderNumber)}/refund`, { method: 'POST', body: JSON.stringify({ confirmOfflineRefund }) });
        successMessage = result.message;
      } else {
        const status = document.querySelector(`[data-next-status="${CSS.escape(orderNumber)}"]`).value;
        const note = document.querySelector(`[data-status-note="${CSS.escape(orderNumber)}"]`).value;
        const trackingNumber = document.querySelector(`[data-tracking-number="${CSS.escape(orderNumber)}"]`).value;
        const carrier = document.querySelector(`[data-shipping-carrier="${CSS.escape(orderNumber)}"]`).value;
        const estimatedDelivery = document.querySelector(`[data-estimated-delivery="${CSS.escape(orderNumber)}"]`).value;
        const result = await api(`/orders/admin/${encodeURIComponent(orderNumber)}/status`, { method: 'PATCH', body: JSON.stringify({ status, note, markPaid, confirmOfflineRefund, trackingNumber, carrier, estimatedDelivery }) });
        successMessage = result.message || `${orderNumber} updated to ${status.replaceAll('-', ' ')}.`;
      }
      const refreshed = await Promise.all([loadAdminOrders(), loadCompletedOrders(), refreshAdminSales(), loadCustomerOrders()]);
      const failed = refreshed.slice(0, 3).some((ok) => ok === false);
      setMessage('adminMessage', failed ? `${successMessage} Some updated data could not refresh; use Refresh data to retry.` : successMessage, failed);
    } catch (error) {
      await Promise.allSettled([loadAdminOrders(), loadCompletedOrders(), refreshAdminSales()]);
      setMessage('adminMessage', error.message, true);
    }
    finally { button.disabled = false; button.textContent = originalLabel; }
  });

  document.getElementById('catalogSearch')?.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadCatalog, 250);
  });
  document.getElementById('catalogCategory')?.addEventListener('change', loadCatalog);
  document.getElementById('catalogSort')?.addEventListener('change', loadCatalog);
  document.getElementById('wishlistOnlyToggle')?.addEventListener('click', (event) => {
    const toggle = event.currentTarget;
    const active = toggle.getAttribute('aria-pressed') !== 'true';
    toggle.setAttribute('aria-pressed', String(active));
    toggle.classList.toggle('is-active', active);
    loadCatalog(1);
  });
  document.getElementById('catalogDietary')?.addEventListener('change', loadCatalog);
  document.getElementById('catalogPriceRange')?.addEventListener('change', () => loadCatalog(1));
  document.getElementById('catalogFlavor')?.addEventListener('change', () => loadCatalog(1));
  document.getElementById('catalogSize')?.addEventListener('change', () => loadCatalog(1));
  document.getElementById('loadMoreCakes')?.addEventListener('click', (event) => {
    if (catalogPage >= catalogTotalPages) return;
    loadCatalog(catalogPage + 1, { append: true });
  });
  document.getElementById('refreshOrders')?.addEventListener('click', loadCustomerOrders);
  document.getElementById('refreshAccount')?.addEventListener('click', loadAccount);
  document.getElementById('copyReferralCode')?.addEventListener('click', async () => {
    const code = document.getElementById('referralCodeDisplay').textContent;
    try { await navigator.clipboard.writeText(code); setMessage('accountMessage', 'Referral code copied.'); }
    catch { setMessage('accountMessage', `Your referral code is ${code}`); }
  });
  const refreshAdminOrdersButton = document.getElementById('refreshAdminOrders');
  if (refreshAdminOrdersButton) {
    refreshAdminOrdersButton.textContent = '↻';
    refreshAdminOrdersButton.setAttribute('aria-label', 'Refresh data');
    refreshAdminOrdersButton.title = 'Refresh data';
    refreshAdminOrdersButton.classList.add('admin-icon-refresh');
    refreshAdminOrdersButton.addEventListener('click', () => { if (adminView === 'overview') { loadOverviewRecentOrders(); loadDashboardRecentEnquiries(); refreshAdminSales(); } else if (adminView === 'completed') loadCompletedOrders(); else if (adminView === 'orders') loadAdminOrders(); else if (adminView === 'inventory') loadAdminInventory(); else if (adminView === 'products' || adminView === 'offers' || adminView === 'settings') loadAdminTools(); else if (adminView === 'categories') loadAdminCategories(); else if (adminView === 'reviews') window.AdminReviewManager?.load(); else if (adminView === 'customers') loadAdminCustomers(); else if (adminView === 'enquiries') loadAdminEnquiries(); else if (adminView === 'gift-cards') { loadAdminGiftCards(); loadAdminGiftCardOffers(); } else if (adminView === 'wishlist') refreshAdminSales(); });
  }
  document.getElementById('refreshInsights')?.addEventListener('click', refreshAdminSales);
  document.getElementById('reportFrom')?.addEventListener('change', refreshAdminSales);
  document.getElementById('reportTo')?.addEventListener('change', refreshAdminSales);
  document.getElementById('topCakesRange')?.addEventListener('change', (event) => {
    setTopCakesRange(event.target.value);
    if (event.target.value !== 'custom') refreshAdminSales();
  });
  document.getElementById('applyTopCakesRange')?.addEventListener('click', refreshAdminSales);
  document.getElementById('closeTopCakeDetails')?.addEventListener('click', () => document.getElementById('topCakeDetailsDialog')?.close());
  document.getElementById('topCakeDetailsDialog')?.addEventListener('click', (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  setTopCakesRange(document.getElementById('topCakesRange')?.value || 'all');
  document.getElementById('adminOrderFilter')?.addEventListener('change', () => { adminPage = 1; loadAdminOrders(); });
  document.getElementById('adminPrevPage')?.addEventListener('click', () => { adminPage = Math.max(1, adminPage - 1); loadAdminOrders(); });
  document.getElementById('adminNextPage')?.addEventListener('click', () => { adminPage = Math.min(adminPages, adminPage + 1); loadAdminOrders(); });
  document.getElementById('completedRange')?.addEventListener('change', (event) => setCompletedRange(event.target.value));
  setCompletedRange(document.getElementById('completedRange')?.value || 'all');
  document.getElementById('refreshCompleted')?.addEventListener('click', () => { completedPage = 1; loadCompletedOrders(); });
  document.getElementById('completedSearch')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { completedPage = 1; loadCompletedOrders(); } });
  document.getElementById('completedPrevPage')?.addEventListener('click', () => { completedPage = Math.max(1, completedPage - 1); loadCompletedOrders(); });
  document.getElementById('completedNextPage')?.addEventListener('click', () => { completedPage = Math.min(completedPages, completedPage + 1); loadCompletedOrders(); });

  const user = getUser();
  if (user?.role === 'admin') {
    api('/admin/test', { cache: 'no-store' }).then(() => {
      document.body.classList.add('admin-mode');
      document.getElementById('adminDashboard').hidden = false;
      document.getElementById('adminWelcomeName').textContent = user.name || 'Admin';
      document.getElementById('adminHeroWelcomeName').textContent = user.name || 'Admin';
      const pageNav = document.getElementById('adminPageNav');
      const pages = [
        ['overview', 'Overview'], ['orders', 'Orders'], ['completed', 'Completed Orders'], ['inventory', 'Inventory'],
        ['products', 'Products'], ['categories', 'Categories'], ['wishlist', 'Wishlist'], ['gift-cards', 'Gift Cards'], ['reviews', 'Reviews'],
        ['customers', 'Customers'], ['enquiries', 'Enquiries'], ['offers', 'Offers'], ['settings', 'Settings'],
      ];
      const currentView = adminViewKeys[adminView] ? adminView : 'overview';
      pageNav.innerHTML = pages.map(([key, label]) => `<a data-admin-view="${key}" href="index.html?adminPage=${encodeURIComponent(key)}" class="${key === currentView ? 'active' : ''}" ${key === currentView ? 'aria-current="page"' : ''}><span class="admin-nav-icon" aria-hidden="true">${key === 'products' ? '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 20h16v-2a8 8 0 0 0-16 0v2Z"/><path d="M7 11a5 5 0 0 1 10 0M12 6V3m0 0-2 2m2-2 2 2"/><path d="M8 17h.01M12 17h.01M16 17h.01"/></svg>' : ({ overview: '⌂', orders: '▤', completed: '✓', inventory: '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 8 12 3l9 5v11H3z"/><path d="m3 8 9 5 9-5M12 13v6"/></svg>', categories: '▧', wishlist: '♡', 'gift-cards': '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 10h18v11H3zM2 6h20v4H2zM12 6v15"/><path d="M12 6H7.5a2.5 2.5 0 1 1 2.2-3.7L12 6Zm0 0h4.5a2.5 2.5 0 1 0-2.2-3.7L12 6Z"/></svg>', reviews: '☆', customers: '♙', enquiries: '✉', offers: '％', settings: '⚙' })[key]}</span>${label}</a>`).join('');
      const updateAdminSections = () => {
        document.querySelectorAll('#adminDashboard > .admin-layout > .admin-main > .admin-tools').forEach((section) => {
          const isActiveSection = section.id === adminViewKeys[adminView];
          section.hidden = !isActiveSection;
          if (isActiveSection) section.style.removeProperty('display');
          else section.style.setProperty('display', 'none', 'important');
        });
        const inventoryActive = adminView === 'inventory';
        const giftCardActive = adminView === 'gift-cards';
        const customersActive = adminView === 'customers';
        document.body.classList.toggle('admin-inventory-view', inventoryActive);
        document.body.classList.toggle('admin-giftcard-view', giftCardActive);
        document.body.classList.toggle('admin-customers-view', customersActive);
        const bannerHeading = document.querySelector('.admin-welcome-banner h1');
        const bannerDescription = document.querySelector('.admin-welcome-banner p');
        if (bannerHeading) bannerHeading.innerHTML = inventoryActive ? 'Inventory Management <span aria-hidden="true">♡</span>' : giftCardActive ? 'Gift Card Management <span aria-hidden="true">♡</span>' : `Welcome back, <span>${escapeHtml(user.name || 'Admin')}</span>! <span aria-hidden="true">♡</span>`;
        if (bannerDescription) bannerDescription.textContent = inventoryActive ? 'Keep track of your stock, ingredients and cake supplies.' : giftCardActive ? 'Create, manage and track gift cards. Spread sweetness, always.' : 'Here’s what’s happening with your bakery today.';
      };
      const navigateAdminView = (requestedView, addHistory = true) => {
        adminView = Object.hasOwn(adminViewKeys, requestedView) ? requestedView : 'overview';
        if (addHistory) history.pushState({ adminView }, '', `index.html?adminPage=${encodeURIComponent(adminView)}`);
        document.querySelectorAll('#adminPageNav a').forEach((item) => {
          const active = new URL(item.href, location.href).searchParams.get('adminPage') === adminView;
          item.classList.toggle('active', active);
          if (active) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
        });
        updateAdminSections();
        document.getElementById('adminSidebar').classList.remove('open');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (adminView === 'overview') { loadOverviewRecentOrders(); loadDashboardRecentEnquiries(); refreshAdminSales(); }
        else if (adminView === 'orders') loadAdminOrders();
        else if (adminView === 'completed') loadCompletedOrders();
        else if (adminView === 'customers') loadAdminCustomers();
        else if (adminView === 'enquiries') loadAdminEnquiries();
        else if (adminView === 'wishlist') refreshAdminSales();
        else if (adminView === 'inventory') loadAdminInventory();
        else if (adminView === 'gift-cards') { loadAdminGiftCards(); loadAdminGiftCardOffers(); }
        else if (adminView === 'reviews') { window.AdminReviewManager?.load(); window.AdminReviewManager?.loadCakes(); }
        else if (adminView === 'categories') loadAdminCategories();
        else if (['products', 'offers', 'settings'].includes(adminView)) loadAdminTools();
      };
      updateAdminSections();
      document.getElementById('adminMenuToggle')?.addEventListener('click', () => {
        const sidebar = document.getElementById('adminSidebar');
        const open = sidebar.classList.toggle('open');
        document.getElementById('adminMenuToggle').setAttribute('aria-expanded', String(open));
      });
      document.getElementById('adminPageNav')?.addEventListener('click', (event) => {
        const link = event.target.closest('a');
        if (!link) return;
        event.preventDefault();
        const nextView = new URL(link.href, location.href).searchParams.get('adminPage') || 'overview';
        navigateAdminView(nextView);
      });
      window.addEventListener('popstate', () => navigateAdminView(new URLSearchParams(location.search).get('adminPage') || 'overview', false));
      document.getElementById('adminLogout')?.addEventListener('click', () => window.handleLogout());

      if (currentView === 'categories') loadAdminCategories();
      if (currentView === 'overview') { loadOverviewRecentOrders(); loadDashboardRecentEnquiries(); }
      if (currentView === 'wishlist') refreshAdminSales();
    }).catch(() => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      location.replace('login.html');
    });
  } else if (new URLSearchParams(location.search).has('adminPage')) {
    sessionStorage.setItem('returnTo', `${location.pathname}${location.search}`);
    location.replace('login.html');
  }
  const reportToday = new Date();
  const reportDateValue = new Date(reportToday.getTime() - reportToday.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const reportToField = document.getElementById('reportTo');
  const reportFromField = document.getElementById('reportFrom');
  if (reportToField && reportFromField) {
    reportToField.value = reportDateValue;
    reportFromField.value = `${reportDateValue.slice(0, 7)}-01`;
  }
  loadCancellationPolicy();
  checkUrlCategory({ load: false, scroll: false });
  loadCatalog(1);
  loadFeaturedCakes();
  loadCustomerOrders();
  loadAccount();
  if (adminView === 'orders') loadAdminOrders();
  if (adminView === 'completed') loadCompletedOrders();
  if (['overview', 'orders', 'products', 'offers', 'settings'].includes(adminView)) loadAdminTools();
  if (adminView === 'customers') loadAdminCustomers();
  if (adminView === 'enquiries') loadAdminEnquiries();
  if (adminView === 'inventory') loadAdminInventory();
  if (adminView === 'gift-cards') { loadAdminGiftCards(); loadAdminGiftCardOffers(); }
  if (adminView === 'reviews') { window.AdminReviewManager?.load(); window.AdminReviewManager?.loadCakes(); }

  document.getElementById('refreshInventory')?.addEventListener('click', loadAdminInventory);
  document.getElementById('refreshGiftCards')?.addEventListener('click', () => { loadAdminGiftCards(); loadAdminGiftCardOffers(); });
  document.getElementById('refreshEnquiries')?.addEventListener('click', loadAdminEnquiries);
  document.getElementById('refreshWishlist')?.addEventListener('click', refreshAdminSales);

  const contactForm = document.getElementById('contactForm');
  const enquiryConfirmation = document.getElementById('enquiryConfirmation');
  const enquiryConfirmationOk = document.getElementById('enquiryConfirmationOk');
  enquiryConfirmationOk?.addEventListener('click', () => enquiryConfirmation.close());
  contactForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (contactForm.dataset.submitting === 'true') return;
    if (!contactForm.reportValidity()) return;
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const formNote = document.getElementById('formNote');
    contactForm.dataset.submitting = 'true';
    submitButton.disabled = true;
    submitButton.textContent = 'Submitting…';
    formNote.textContent = '';
    formNote.classList.remove('error');
    try {
      const enquiry = Object.fromEntries(new FormData(contactForm).entries());
      const result = await api('/enquiries', { method: 'POST', body: JSON.stringify(enquiry) });
      if (!result.enquiry?.id) throw new Error('The server did not confirm that your enquiry was saved. Please try again.');
      contactForm.reset();
      enquiryConfirmation.showModal();
    } catch (error) {
      formNote.textContent = error.message || 'Your enquiry could not be submitted. Please try again.';
      formNote.classList.add('error');
    } finally {
      delete contactForm.dataset.submitting;
      submitButton.disabled = false;
      submitButton.textContent = 'Send Enquiry';
    }
  });

  const inventoryDialog = document.getElementById('inventoryItemDialog');
  const inventoryForm = document.getElementById('inventoryItemForm');
  const openInventoryForm = (item = null) => {
    inventoryForm.reset();
    inventoryForm.dataset.itemId = item?.id || '';
    inventoryForm.dataset.isCake = String(item?.type === 'cakes');
    inventoryForm.elements.name.value = item?.name || '';
    inventoryForm.elements.category.value = item?.type === 'cakes' ? 'ingredients' : (item?.type || 'ingredients');
    inventoryForm.elements.category.disabled = item?.type === 'cakes';
    inventoryForm.elements.unit.value = item?.unit || 'kg';
    inventoryForm.elements.unit.disabled = item?.type === 'cakes';
    inventoryForm.elements.detail.value = item?.detail || '';
    inventoryForm.elements.stock.value = String(item?.stock ?? 0);
    inventoryForm.elements.lowStockThreshold.value = String(item?.lowStockThreshold ?? 5);
    document.getElementById('inventoryDialogTitle').textContent = item ? `Update ${item.name}` : 'Add an inventory item';
    document.getElementById('saveInventoryItem').textContent = item ? 'Save changes' : 'Add item';
    setMessage('inventoryFormMessage', '');
    inventoryDialog.showModal();
    if (!item) inventoryForm.elements.name.focus();
  };

  document.getElementById('addInventoryItem')?.addEventListener('click', () => openInventoryForm());
  document.getElementById('closeInventoryDialog')?.addEventListener('click', () => inventoryDialog.close());
  document.getElementById('cancelInventoryDialog')?.addEventListener('click', () => inventoryDialog.close());
  inventoryDialog?.addEventListener('click', (event) => { if (event.target === inventoryDialog) inventoryDialog.close(); });
  inventoryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = document.getElementById('saveInventoryItem');
    const itemId = inventoryForm.dataset.itemId;
    const isCake = inventoryForm.dataset.isCake === 'true';
    const payload = {
      name: inventoryForm.elements.name.value.trim(), category: inventoryForm.elements.category.value,
      unit: inventoryForm.elements.unit.value.trim(), detail: inventoryForm.elements.detail.value.trim(),
      stock: Number(inventoryForm.elements.stock.value), lowStockThreshold: Number(inventoryForm.elements.lowStockThreshold.value),
    };
    if (!Number.isInteger(payload.stock) || payload.stock < 0 || !Number.isInteger(payload.lowStockThreshold) || payload.lowStockThreshold < 0) {
      setMessage('inventoryFormMessage', 'Enter whole numbers of zero or more for stock and low-stock alert.', true);
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Saving…';
    try {
      if (isCake) {
        const cake = inventoryData.find((item) => item.id === itemId);
        await api(`/catalog/admin/products/${encodeURIComponent(cake.recordId)}/stock`, { method: 'PATCH', body: JSON.stringify({ stock: payload.stock, lowStockThreshold: payload.lowStockThreshold }) });
        await loadCatalog();
      } else if (itemId) {
        await api(`/inventory/admin/items/${encodeURIComponent(itemId.slice(5))}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/inventory/admin/items', { method: 'POST', body: JSON.stringify(payload) });
      }
      inventoryDialog.close();
      selectedInventoryRows.delete(itemId);
      setMessage('adminInventoryMessage', itemId ? 'Inventory item updated.' : 'Inventory item added.');
      await loadAdminInventory();
    } catch (error) {
      setMessage('inventoryFormMessage', error.message || 'Could not save this item.', true);
    } finally {
      submit.disabled = false;
      submit.textContent = itemId ? 'Save changes' : 'Add item';
    }
  });

  document.getElementById('inventoryTabs')?.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-inventory-type]');
    if (!tab) return;
    currentInventoryType = tab.dataset.inventoryType;
    currentInventoryPage = 1;
    document.querySelectorAll('#inventoryTabs [data-inventory-type]').forEach((button) => {
      const active = button === tab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    renderAdminInventory();
  });
  document.getElementById('inventorySummary')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-summary-type]');
    if (!card) return;
    const tab = document.querySelector(`#inventoryTabs [data-inventory-type="${card.dataset.summaryType}"]`);
    tab?.click();
  });
  ['inventorySearch', 'inventoryCategoryFilter', 'inventoryStatusFilter', 'inventoryPageSize'].forEach((id) => {
    document.getElementById(id)?.addEventListener(id === 'inventorySearch' ? 'input' : 'change', () => {
      if (id === 'inventoryPageSize') currentInventoryPageSize = Number(document.getElementById(id).value) || 8;
      currentInventoryPage = 1;
      renderAdminInventory();
    });
  });
  document.getElementById('inventoryPrevPage')?.addEventListener('click', () => { currentInventoryPage = Math.max(1, currentInventoryPage - 1); renderAdminInventory(); });
  document.getElementById('inventoryNextPage')?.addEventListener('click', () => { currentInventoryPage += 1; renderAdminInventory(); });
  document.getElementById('inventoryPageButtons')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-inventory-page]');
    if (button) { currentInventoryPage = Number(button.dataset.inventoryPage); renderAdminInventory(); }
  });
  document.getElementById('inventorySelectAll')?.addEventListener('change', (event) => {
    document.querySelectorAll('#adminInventoryGrid [data-select-inventory]').forEach((checkbox) => {
      const id = checkbox.dataset.selectInventory;
      if (event.target.checked) selectedInventoryRows.add(id); else selectedInventoryRows.delete(id);
    });
    renderAdminInventory();
  });
  document.getElementById('adminInventoryGrid')?.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-select-inventory]');
    if (!checkbox) return;
    if (checkbox.checked) selectedInventoryRows.add(checkbox.dataset.selectInventory);
    else selectedInventoryRows.delete(checkbox.dataset.selectInventory);
    renderAdminInventory();
  });
  document.getElementById('adminInventoryGrid')?.addEventListener('click', async (event) => {
    const edit = event.target.closest('[data-edit-inventory]');
    if (edit) {
      const item = inventoryData.find((entry) => entry.id === edit.dataset.editInventory);
      if (item) openInventoryForm(item);
      return;
    }
    const remove = event.target.closest('[data-delete-inventory]');
    if (!remove) return;
    const item = inventoryData.find((entry) => entry.id === remove.dataset.deleteInventory);
    if (!item || !window.confirm(`Remove ${item.name} from inventory?`)) return;
    remove.disabled = true;
    try {
      await api(`/inventory/admin/items/${encodeURIComponent(item.recordId)}`, { method: 'DELETE' });
      selectedInventoryRows.delete(item.id);
      setMessage('adminInventoryMessage', `${item.name} removed from inventory.`);
      await loadAdminInventory();
    } catch (error) { setMessage('adminInventoryMessage', error.message || 'Could not remove this item.', true); remove.disabled = false; }
  });
  document.getElementById('inventoryLowAlerts')?.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-inventory]');
    const item = edit && inventoryData.find((entry) => entry.id === edit.dataset.editInventory);
    if (item) openInventoryForm(item);
  });
  document.getElementById('inventoryBulkRemove')?.addEventListener('click', async () => {
    const removable = [...selectedInventoryRows].map((id) => inventoryData.find((item) => item.id === id)).filter((item) => item && item.type !== 'cakes');
    if (!removable.length || !window.confirm(`Remove ${removable.length} selected inventory item${removable.length === 1 ? '' : 's'}?`)) return;
    const button = document.getElementById('inventoryBulkRemove');
    button.disabled = true;
    try {
      const results = await Promise.allSettled(removable.map((item) => api(`/inventory/admin/items/${encodeURIComponent(item.recordId)}`, { method: 'DELETE' })));
      const removed = removable.filter((_, index) => results[index].status === 'fulfilled');
      removed.forEach((item) => selectedInventoryRows.delete(item.id));
      const failures = results.length - removed.length;
      setMessage('adminInventoryMessage', failures ? `${removed.length} item${removed.length === 1 ? '' : 's'} removed; ${failures} could not be removed.` : `${removed.length} inventory item${removed.length === 1 ? '' : 's'} removed.`, Boolean(failures));
      await loadAdminInventory();
    } catch (error) { setMessage('adminInventoryMessage', error.message || 'Some selected items could not be removed.', true); }
    finally { button.disabled = false; }
  });
  document.getElementById('inventoryShowAlerts')?.addEventListener('click', () => {
    document.getElementById('inventoryStatusFilter').value = 'attention';
    currentInventoryType = 'all';
    currentInventoryPage = 1;
    document.querySelector('#inventoryTabs [data-inventory-type="all"]')?.click();
    renderAdminInventory();
  });

  document.getElementById('adminGiftCardForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const revealBox = document.getElementById('newGiftCardDisplay');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Generating…';
    setMessage('adminGiftCardMessage', '');
    try {
      const initialBalance = Number(form.elements.value.value);
      const recipientEmail = form.elements.recipientEmail.value.trim() || undefined;
      const recipientName = form.elements.recipientName.value.trim() || undefined;
      const message = form.elements.message.value.trim() || undefined;
      const design = form.elements.design.value;
      const emailTemplate = form.elements.emailTemplate.value;
      const res = await api('/commerce/admin/gift-cards', {
        method: 'POST',
        body: JSON.stringify({ value: initialBalance, recipientEmail, recipientName, message, design, emailTemplate })
      });
      setMessage('adminGiftCardMessage', res.message || 'Gift card created successfully!');
      revealBox.hidden = false;
      revealBox.innerHTML = `<strong>Gift card issued · ${money(res.value)}</strong><span class="copyable-code" title="Click to copy">${escapeHtml(res.code)}</span><small>Copy this code now. The full code is only shown once.</small><button type="button" class="giftcard-reveal-dismiss" aria-label="Dismiss">×</button>`;
      revealBox.querySelector('.giftcard-reveal-dismiss').addEventListener('click', () => { revealBox.hidden = true; });
      giftCardDialog.close();
      form.reset();
      setMessage('giftCardFormMessage', '');
      await loadAdminGiftCards();
    } catch (err) {
      setMessage('giftCardFormMessage', err.message || 'Failed to create gift card', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Issue gift card';
    }
  });

  document.addEventListener('click', (e) => {
    const codeEl = e.target.closest('.copyable-code');
    if (!codeEl) return;
    const text = codeEl.textContent.trim();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        const orig = codeEl.title;
        codeEl.title = 'Copied!';
        setTimeout(() => { codeEl.title = orig; }, 2000);
      });
    }
  });
  // Product Detail & Reviews Modal Logic
  let activeModalGalleryImages = [];
  let activeModalGalleryIndex = 0;
  const modalGalleryViewAt = (index) => index > 0 && activeModalGalleryImages[index] === activeModalGalleryImages[0] ? String(index) : 'native';
  function showModalGalleryImage(index) {
    if (!activeModalGalleryImages.length) return;
    activeModalGalleryIndex = (index + activeModalGalleryImages.length) % activeModalGalleryImages.length;
    const image = document.getElementById('modalProductImg');
    const name = document.getElementById('modalProductTitle')?.textContent || 'Cake';
    if (image) { image.src = activeModalGalleryImages[activeModalGalleryIndex]; image.alt = `${name} cake view ${activeModalGalleryIndex + 1}`; image.dataset.galleryView = modalGalleryViewAt(activeModalGalleryIndex); }
    document.querySelectorAll('#modalProductThumbnails [data-modal-image-index]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === activeModalGalleryIndex)));
    const dots = document.getElementById('modalGalleryDots');
    if (dots) dots.innerHTML = activeModalGalleryImages.map((_, i) => `<span class="${i === activeModalGalleryIndex ? 'is-active' : ''}"></span>`).join('');
  }
  function renderModalProductGallery(images, productName) {
    activeModalGalleryImages = images.filter((image) => typeof image === 'string' && image);
    const baseImage = activeModalGalleryImages[0];
    while (baseImage && activeModalGalleryImages.length < 4) activeModalGalleryImages.push(baseImage);
    activeModalGalleryIndex = 0;
    const mainImage = document.getElementById('modalProductImg');
    const thumbnailRail = document.getElementById('modalProductThumbnails');
    if (mainImage && activeModalGalleryImages.length) {
      mainImage.src = activeModalGalleryImages[0];
      mainImage.alt = `${productName} cake photo 1`;
      mainImage.dataset.galleryView = '0';
    }
    if (!thumbnailRail) return;
    thumbnailRail.replaceChildren();
    activeModalGalleryImages.forEach((image, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'modal-product-thumbnail';
      button.dataset.modalImageIndex = String(index);
      button.setAttribute('aria-label', `Show ${productName} photo ${index + 1}`);
      button.setAttribute('aria-pressed', String(index === 0));
      const thumbnail = document.createElement('img');
      thumbnail.src = image;
      thumbnail.alt = '';
      thumbnail.dataset.galleryView = modalGalleryViewAt(index);
      button.append(thumbnail);
      thumbnailRail.append(button);
    });
    thumbnailRail.hidden = activeModalGalleryImages.length < 2;
    document.querySelectorAll('.modal-gallery-arrow,.modal-gallery-dots').forEach((control) => { control.hidden = activeModalGalleryImages.length < 2; });
    const dots = document.getElementById('modalGalleryDots');
    if (dots) dots.innerHTML = activeModalGalleryImages.map((_, index) => `<span class="${index === 0 ? 'is-active' : ''}"></span>`).join('');
  }

  async function openProductModal(productId) {
    const modal = document.getElementById('productDetailModal');
    if (!modal) return;
    const product = productData.find((p) => p.id === productId)
      || featuredProductData.find((p) => p.id === productId);
    if (!product) return;
    modal.dataset.productId = productId;
    const accentColors = ['#bd8687', '#7d947e', '#709aa5', '#9381aa', '#bc8e67', '#ad788e'];
    const colorIndex = [...productId].reduce((sum, character) => sum + character.charCodeAt(0), 0) % accentColors.length;
    modal.style.setProperty('--modal-cake-accent', accentColors[colorIndex]);

    // Fill product info
    const modalImg = document.getElementById('modalProductImg');
    const matchingCard = [...(productGrid?.querySelectorAll('.product-card') || [])].find((card) => card.dataset.productCard === productId);
    const galleryImages = modalCakePhotoOverrides[productId] || (Array.isArray(product.images) && product.images.length
      ? product.images.filter((image) => typeof image === 'string' && image)
      : [matchingCard?.querySelector('.product-photo')?.src || product.image].filter(Boolean));
    if (modalImg) {
      modalImg.src = galleryImages[0] || product.image;
      modalImg.alt = product.name;
    }
    renderModalProductGallery(galleryImages, product.name);
    const wishlistButtons = document.querySelectorAll('.modal-wishlist-toggle');
    if (wishlistButtons.length) {
      const saved = wishlistIds().includes(productId);
      wishlistButtons.forEach((button) => {
        button.dataset.product = productId;
        button.setAttribute('aria-pressed', String(Boolean(saved)));
        button.setAttribute('aria-label', `${saved ? 'Remove' : 'Add'} ${product.name} ${saved ? 'from' : 'to'} wishlist`);
        button.textContent = saved ? '♥' : '♡';
      });
    }
    document.getElementById('modalProductCategory').textContent = product.category;
    document.getElementById('modalProductTitle').textContent = product.name;
    document.getElementById('modalProductDescription').textContent = product.description;
    const ratingBadge = document.getElementById('modalProductRating');
    ratingBadge.innerHTML = product.reviewCount
      ? `<span class="modal-rating-stars" aria-label="${Number(product.reviewAverage).toFixed(1)} out of 5 stars">${'★'.repeat(Math.max(0, Math.min(5, Math.round(Number(product.reviewAverage)))))}${'☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(Number(product.reviewAverage)))))}</span><small>(${Number(product.reviewAverage).toFixed(1)}) &nbsp; · &nbsp; ${Number(product.reviewCount).toLocaleString('en-IN')} reviews</small>`
      : `<span class="modal-rating-stars">☆☆☆☆☆</span><small>No reviews yet</small>`;
    // Populate flavours
    const flavorSelect = document.getElementById('modalProductFlavor');
    flavorSelect.innerHTML = product.flavors.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');

    // Populate sizes
    const sizeSelect = document.getElementById('modalProductSize');
    sizeSelect.innerHTML = product.sizes.map((s) => `<option value="${escapeHtml(s.name)}" data-price="${s.price}">${escapeHtml(s.name)} · ${money(s.price)}</option>`).join('');
    document.getElementById('modalProductPrice').textContent = money(product.sizes[0].price);
    const sizeChips = document.getElementById('modalSizeChips');
    if (sizeChips) sizeChips.innerHTML = product.sizes.map((size, index) => `<button type="button" class="modal-size-chip" data-size-option="${escapeHtml(size.name)}" aria-pressed="${index === 0}">${escapeHtml(size.name)}</button>`).join('');
    document.getElementById('modalQuantity').textContent = '1';
    document.getElementById('modalCakeMessage').value = '';
    document.getElementById('modalCakeMessageCount').textContent = '0/50';

    sizeSelect.onchange = () => {
      const opt = sizeSelect.selectedOptions[0];
      if (opt) document.getElementById('modalProductPrice').textContent = money(opt.dataset.price);
      sizeChips?.querySelectorAll('[data-size-option]').forEach((chip) => chip.setAttribute('aria-pressed', String(chip.dataset.sizeOption === sizeSelect.value)));
    };

    // Add to cart from modal
    const addBtn = document.getElementById('modalAddToCartBtn');
    addBtn.onclick = () => {
      try {
        const sizeName = sizeSelect.value;
        const flavor = flavorSelect.value;
        const size = product.sizes.find((item) => item.name === sizeName);
        if (!size) throw new Error('Please choose a valid size');

        const quantity = Number(document.getElementById('modalQuantity').textContent || 1);
        const cakeMessage = document.getElementById('modalCakeMessage').value.trim();
        const existing = cart.find((item) => item.productId === product.id && item.size === sizeName && item.flavor === flavor && (item.cakeMessage || '') === cakeMessage);
        if (existing) existing.quantity = Math.min(10, existing.quantity + quantity);
        else cart.push({ productId: product.id, name: product.name, image: product.image, size: sizeName, flavor, price: size.price, quantity, cakeMessage });
        saveCart();
        renderCart();
        showAddToCartToast(product.name, flavor, sizeName, product.image);
        closeProductModal();
      } catch (err) {
        showAddToCartError(err.message);
      }
    };

    modal.hidden = false;
    document.body.style.overflow = 'hidden';

    if (!Array.isArray(product.images) || product.images.length < 2) {
      api(`/catalog/${encodeURIComponent(productId)}`).then(({ product: detail }) => {
        if (modal.hidden || modal.dataset.productId !== productId || !detail) return;
        const images = modalCakePhotoOverrides[productId] || (Array.isArray(detail.images) && detail.images.length ? detail.images : [detail.image || product.image]);
        if (images.length > 1) renderModalProductGallery(images, product.name);
      }).catch(() => {});
    }

  }

  function closeProductModal() {
    const modal = document.getElementById('productDetailModal');
    if (modal) {
      modal.hidden = true;
      document.body.style.overflow = '';
    }
  }

  document.getElementById('closeProductModalBtn')?.addEventListener('click', closeProductModal);
  document.getElementById('productDetailModal')?.addEventListener('click', async (event) => {
    const galleryStep = event.target.closest('[data-gallery-step]');
    if (galleryStep) { showModalGalleryImage(activeModalGalleryIndex + Number(galleryStep.dataset.galleryStep)); return; }
    const sizeChip = event.target.closest('[data-size-option]');
    if (sizeChip) { const select = document.getElementById('modalProductSize'); select.value = sizeChip.dataset.sizeOption; select.dispatchEvent(new Event('change', { bubbles: true })); return; }
    const quantityStep = event.target.closest('[data-quantity-step]');
    if (quantityStep) { const output = document.getElementById('modalQuantity'); output.textContent = String(Math.max(1, Math.min(10, Number(output.textContent || 1) + Number(quantityStep.dataset.quantityStep)))); return; }
    const photoButton = event.target.closest('[data-modal-image-index]');
    if (photoButton) {
      showModalGalleryImage(Number(photoButton.dataset.modalImageIndex));
      return;
    }
    const favorite = event.target.closest('.modal-wishlist-toggle');
    if (favorite) {
      const productId = favorite.dataset.product;
      const wasSaved = wishlistIds().includes(productId);
      const ids = new Set(wishlistIds());
      wasSaved ? ids.delete(productId) : ids.add(productId);
      saveWishlist([...ids]);
      const isSaved = !wasSaved;
      const favoriteProduct = [...productData, ...featuredProductData].find((product) => product.id === productId);
      const favoriteName = favoriteProduct?.name || 'cake';
      document.querySelectorAll('.modal-wishlist-toggle').forEach((button) => {
        button.setAttribute('aria-pressed', String(isSaved));
        button.setAttribute('aria-label', `${isSaved ? 'Remove' : 'Add'} ${favoriteName} ${isSaved ? 'from' : 'to'} wishlist`);
        button.textContent = isSaved ? '♥' : '♡';
      });
      renderProducts();
      showWishlistSuccess(favoriteName === 'cake' ? 'Your cake' : favoriteName, isSaved ? 'added' : 'removed');
      try {
        if (hasWishlistAccount()) {
          const result = await api(`/auth/account/favorites/${encodeURIComponent(productId)}`, { method: 'PUT' });
          if (accountData?.user) accountData.user.favoriteProducts = result.favoriteProducts || [];
          saveWishlist([...new Set([...readWishlist(), ...(result.favoriteProducts || [])])]);
        }
        setMessage('catalogMessage', wasSaved ? 'Removed from your wishlist.' : 'Saved to your wishlist.');
      } catch (error) { setMessage('catalogMessage', `Saved on this device. Account sync failed: ${error.message}`, true); }
      return;
    }
  });
  document.getElementById('modalCakeMessage')?.addEventListener('input', (event) => { document.getElementById('modalCakeMessageCount').textContent = `${event.target.value.length}/50`; });
  document.getElementById('productDetailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'productDetailModal') closeProductModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProductModal();
  });



})();
