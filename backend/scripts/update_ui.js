const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// 1. Update Navigation Dropdown
const oldNav = '<li><a href="#shop">Shop</a></li>';
const newNav = `<li class="nav-dropdown">
          <a href="#shop" class="nav-dropdown-toggle" id="shopNavDropdown" aria-haspopup="true" aria-expanded="false">Shop <span class="nav-arrow">▾</span></a>
          <ul class="nav-submenu" aria-labelledby="shopNavDropdown">
            <li><a href="#shop" data-category="All">All Cakes</a></li>
            <li><a href="#shop" data-category="Birthday Cakes">Birthday Cakes</a></li>
            <li><a href="#shop" data-category="Wedding Cakes">Wedding Cakes</a></li>
            <li><a href="#shop" data-category="Anniversary Cakes">Anniversary Cakes</a></li>
            <li><a href="#shop" data-category="Cupcakes & Jars">Cupcakes &amp; Jars</a></li>
            <li><a href="#shop" data-category="Theme Cakes">Theme Cakes</a></li>
            <li><a href="#shop" data-category="Photo Cakes">Photo Cakes</a></li>
          </ul>
        </li>`;

if (html.includes(oldNav)) {
  html = html.replace(oldNav, newNav);
  console.log('✓ Nav dropdown updated');
} else {
  console.log('! Nav dropdown old pattern not found');
}

// 2. Update Hero CTA Buttons
const oldHeroBtn = '<a href="login.html" class="btn btn-primary" id="getStartedBtn">Get Started →</a>';
const newHeroBtn = `<div class="hero-cta-group">
        <a href="#shop" class="btn btn-primary" id="exploreCakesBtn">Explore Cakes →</a>
        <a href="#custom" class="btn btn-outline" id="customiseCakeBtn">Customise Your Cake</a>
        <a href="login.html" id="getStartedBtn" style="display:none;" aria-hidden="true"></a>
      </div>`;

if (html.includes(oldHeroBtn)) {
  html = html.replace(oldHeroBtn, newHeroBtn);
  console.log('✓ Hero CTA buttons updated');
} else {
  console.log('! Hero button old pattern not found');
}

// 3. Update Hero Visual (replace cartoon SVG with real photo)
const heroVisualRegex = /<div class="hero-visual">[\s\S]*?<\/svg>\s*<\/div>/;
const newHeroVisual = `<div class="hero-visual">
        <div class="halo"></div>
        <div class="hero-photo-wrap">
          <img src="/images/hero-cake.jpg" alt="Artisan tiered blush celebration cake handcrafted by Cakes of Paradise" class="hero-cake-photo" loading="eager" width="460">
          <div class="hero-floating-tag">
            <span class="tag-icon">✨</span>
            <div class="tag-text">
              <span class="tag-title">Freshly Handcrafted</span>
              <span class="tag-sub">100% Homemade · Surathkal</span>
            </div>
          </div>
        </div>
      </div>`;

if (heroVisualRegex.test(html)) {
  html = html.replace(heroVisualRegex, newHeroVisual);
  console.log('✓ Hero visual replaced with real photo');
} else {
  console.log('! Hero visual regex did not match');
}

// 4. Add Category Banner to #shop
const shopSectionHeadRegex = /(<section id="shop" class="shop-section">[\s\S]*?<\/div>)\s*(<div class="shop-toolbar">)/;
const newCategoryBanner = `$1
  <div id="categoryBanner" class="category-banner" style="display:none;">
    <div class="category-banner-card">
      <img id="categoryBannerImg" src="/images/hero-cake.jpg" alt="Category banner" class="category-banner-image">
      <div class="category-banner-info">
        <span class="category-banner-eyebrow">Category Collection</span>
        <h3 id="categoryBannerTitle">Cake Category</h3>
        <p id="categoryBannerDesc">Handcrafted cakes made fresh to order.</p>
        <button type="button" id="clearCategoryBannerBtn" class="btn btn-outline" style="align-self:flex-start;padding:8px 18px;font-size:0.85rem;">← View All Cakes</button>
      </div>
    </div>
  </div>
  $2`;

if (shopSectionHeadRegex.test(html)) {
  html = html.replace(shopSectionHeadRegex, newCategoryBanner);
  console.log('✓ Category banner added to #shop');
} else {
  console.log('! Shop section head regex did not match');
}

// 5. Update Gallery Section HTML (filters + grid + lightbox modal)
const oldGallerySection = `<section id="gallery">
  <div class="section-head reveal">
    <span class="eyebrow">📷 Sweet Moments</span>
    <h2>From Our Kitchen to Your Table</h2>
    <p>A little peek at recent bakes — each one shaped around a real celebration.</p>
  </div>
  <div class="gallery-grid" id="galleryGrid"></div>
</section>`;

const newGallerySection = `<!-- ================= GALLERY ================= -->
<section id="gallery">
  <div class="section-head reveal">
    <span class="eyebrow">📷 Sweet Moments</span>
    <h2>From Our Kitchen to Your Table</h2>
    <p>A little peek at recent bakes — each one shaped around a real celebration.</p>
  </div>
  <div class="gallery-filters reveal" id="galleryFilterBar">
    <button type="button" class="gallery-filter-btn active" data-gallery-filter="all">All Bakes</button>
    <button type="button" class="gallery-filter-btn" data-gallery-filter="Birthday">Birthday</button>
    <button type="button" class="gallery-filter-btn" data-gallery-filter="Wedding">Wedding</button>
    <button type="button" class="gallery-filter-btn" data-gallery-filter="Anniversary">Anniversary</button>
    <button type="button" class="gallery-filter-btn" data-gallery-filter="Theme">Theme Cakes</button>
  </div>
  <div class="gallery-grid" id="galleryGrid"></div>
</section>

<!-- Gallery Lightbox Modal -->
<div id="galleryLightbox" class="gallery-lightbox" hidden role="dialog" aria-modal="true" aria-label="Cake photo viewer">
  <div class="lightbox-overlay" id="lightboxOverlay"></div>
  <div class="lightbox-container">
    <button type="button" class="lightbox-close-btn" id="lightboxCloseBtn" aria-label="Close image">&times;</button>
    <div class="lightbox-image-box">
      <img id="lightboxImage" src="" alt="Cake full preview">
    </div>
    <div class="lightbox-caption-box">
      <h4 id="lightboxTitle"></h4>
      <p id="lightboxSubtitle"></p>
    </div>
  </div>
</div>`;

if (html.includes(oldGallerySection)) {
  html = html.replace(oldGallerySection, newGallerySection);
  console.log('✓ Gallery section HTML updated with filters and lightbox');
} else {
  console.log('! Old gallery section not found');
}

// 6. Update Category Cards Script & Gallery Script
const oldScriptBlockRegex = /\/\/ ---- Cake category data ----[\s\S]*?document\.querySelectorAll\('#galleryGrid \.reveal'\)\.forEach\(el => io\.observe\(el\)\);/;

const newScriptBlock = `// ---- Cake category data with real photographs ----
  const cakeIconPaths = {
    birthday: \`<svg class="category-cake-icon" viewBox="0 0 80 80" role="img" aria-label="Birthday cake with candle"><defs><linearGradient id="birthdayIcing" x2="0" y2="1"><stop stop-color="#ffb8ca"/><stop offset="1" stop-color="#e96a8d"/></linearGradient><linearGradient id="birthdayCake" x2="0" y2="1"><stop stop-color="#fffdf9"/><stop offset="1" stop-color="#f4dfd4"/></linearGradient></defs><ellipse cx="40" cy="67" rx="28" ry="5" fill="#7b4c4c" opacity=".12"/><path d="M17 38h46v23a7 7 0 0 1-7 7H24a7 7 0 0 1-7-7Z" fill="url(#birthdayCake)" stroke="#b77c70" stroke-width="1.6"/><path d="M17 39q5 8 10 0t10 0t10 0t10 0t6 0v8q-4 7-8 0t-8 0t-8 0t-8 0t-12 0Z" fill="url(#birthdayIcing)"/><ellipse cx="40" cy="38" rx="23" ry="7" fill="#fff7f1" stroke="#b77c70" stroke-width="1.6"/><path d="M39 13h3v19h-3z" rx="1.5" fill="#e96a8d"/><path d="M40.5 5c7 7 4 11 0 12-4-2-6-6 0-12" fill="#e3a34b"/><circle cx="28" cy="53" r="2" fill="#e3a34b"/><circle cx="40" cy="56" r="2" fill="#c94e72"/><circle cx="52" cy="53" r="2" fill="#e3a34b"/><path d="M22 65h36" stroke="#e3a34b" stroke-width="2" stroke-linecap="round"/></svg>\`,
    wedding: \`<svg class="category-cake-icon" viewBox="0 0 80 80" role="img" aria-label="Elegant tiered wedding cake"><defs><linearGradient id="weddingCream" x2="0" y2="1"><stop stop-color="#fffefa"/><stop offset="1" stop-color="#f1dfd8"/></linearGradient></defs><ellipse cx="40" cy="68" rx="29" ry="5" fill="#7b4c4c" opacity=".12"/><path d="M14 50q26-7 52 0l-3 12q-23 7-46 0Z" fill="url(#weddingCream)" stroke="#a87a70" stroke-width="1.5"/><ellipse cx="40" cy="49" rx="26" ry="6" fill="#fff9f5" stroke="#a87a70" stroke-width="1.5"/><path d="M23 31q17-5 34 0l-2 13q-15 5-30 0Z" fill="url(#weddingCream)" stroke="#a87a70" stroke-width="1.5"/><ellipse cx="40" cy="30" rx="17" ry="5" fill="#fff9f5" stroke="#a87a70" stroke-width="1.5"/><path d="M31 17q9-4 18 0l-1 9q-8 3-16 0Z" fill="url(#weddingCream)" stroke="#a87a70" stroke-width="1.5"/><ellipse cx="40" cy="16" rx="9" ry="3.5" fill="#fff9f5" stroke="#a87a70" stroke-width="1.5"/><path d="M40 12q-6-5 0-9 6 4 0 9Z" fill="#e96a8d"/><circle cx="25" cy="55" r="2" fill="#e3a34b"/><circle cx="40" cy="57" r="2" fill="#e3a34b"/><circle cx="55" cy="55" r="2" fill="#e3a34b"/><path d="M30 40q2 5 4 0t4 0t4 0t4 0t4 0" fill="none" stroke="#e96a8d" stroke-width="2" stroke-linecap="round"/></svg>\`,
    anniversary: \`<svg class="category-cake-icon" viewBox="0 0 80 80" role="img" aria-label="Anniversary cake with heart decoration"><defs><linearGradient id="annivCake" x2="0" y2="1"><stop stop-color="#fffefa"/><stop offset="1" stop-color="#f4e1da"/></linearGradient></defs><ellipse cx="40" cy="68" rx="27" ry="5" fill="#7b4c4c" opacity=".12"/><path d="M17 41q23-7 46 0v20a7 7 0 0 1-7 7H24a7 7 0 0 1-7-7Z" fill="url(#annivCake)" stroke="#b77c70" stroke-width="1.6"/><ellipse cx="40" cy="40" rx="23" ry="7" fill="#fff8f3" stroke="#b77c70" stroke-width="1.6"/><path d="M40 34c-10-7-13-15-7-19 4-3 7 1 7 1s4-4 8-1c6 4 3 12-8 19Z" fill="#e96a8d" stroke="#bd4c6c" stroke-width="1.2"/><circle cx="28" cy="52" r="2" fill="#e3a34b"/><circle cx="40" cy="57" r="2" fill="#c94e72"/><circle cx="52" cy="52" r="2" fill="#e3a34b"/><path d="M20 62q6-4 12 0t12 0t12 0t6 0" fill="none" stroke="#e3a34b" stroke-width="1.8"/></svg>\`,
    cupcake: \`<svg class="category-cake-icon" viewBox="0 0 80 80" role="img" aria-label="Frosted cupcake"><defs><linearGradient id="cupcakeFrosting" x2="0" y2="1"><stop stop-color="#fff9f5"/><stop offset="1" stop-color="#f0c9d3"/></linearGradient><linearGradient id="cupcakeCase" x2="0" y2="1"><stop stop-color="#efb550"/><stop offset="1" stop-color="#cb8735"/></linearGradient></defs><ellipse cx="40" cy="68" rx="23" ry="5" fill="#7b4c4c" opacity=".12"/><path d="M21 40h38l-6 24q-13 6-26 0Z" fill="url(#cupcakeCase)" stroke="#a87331" stroke-width="1.5"/><path d="M26 44v16m9-17v19m10-19v19m9-19-2 17" stroke="#f8d58b" stroke-width="1.5" opacity=".8"/><path d="M21 40c-5-3-3-9 3-10-2-7 4-11 10-8 1-9 13-10 15-2 7-1 11 5 7 11 7 4 3 10-3 10H27Z" fill="url(#cupcakeFrosting)" stroke="#bd8290" stroke-width="1.5"/><circle cx="40" cy="11" r="4" fill="#e96a8d"/><path d="M40 7c2-4 5-4 7-4" fill="none" stroke="#6a8e58" stroke-width="1.8" stroke-linecap="round"/><circle cx="30" cy="34" r="1.5" fill="#e3a34b"/><circle cx="42" cy="29" r="1.5" fill="#e96a8d"/><circle cx="51" cy="36" r="1.5" fill="#e3a34b"/></svg>\`,
    theme: \`<svg class="category-cake-icon" viewBox="0 0 80 80" role="img" aria-label="Decorated custom theme cake"><defs><linearGradient id="themeCake" x2="0" y2="1"><stop stop-color="#fffefa"/><stop offset="1" stop-color="#f1ddd7"/></linearGradient></defs><ellipse cx="40" cy="68" rx="27" ry="5" fill="#7b4c4c" opacity=".12"/><path d="M15 43q25-7 50 0v19a6 6 0 0 1-6 6H21a6 6 0 0 1-6-6Z" fill="url(#themeCake)" stroke="#ae7b72" stroke-width="1.5"/><ellipse cx="40" cy="42" rx="25" ry="7" fill="#fff8f3" stroke="#ae7b72" stroke-width="1.5"/><path d="M25 39 20 27l12 7 8-14 8 14 12-7-5 12" fill="#e96a8d" stroke="#bd4c6c" stroke-width="1.4" stroke-linejoin="round"/><path d="M40 17v-5" stroke="#a67842" stroke-width="1.5"/><path d="M40 8 42 12 47 13 43 16 44 21 40 18 36 21 37 16 33 13 38 12Z" fill="#e3a34b"/><circle cx="27" cy="54" r="2" fill="#e3a34b"/><circle cx="40" cy="59" r="2" fill="#c94e72"/><circle cx="53" cy="54" r="2" fill="#e3a34b"/><path d="M18 63q7-4 14 0t14 0t14 0t4 0" fill="none" stroke="#e3a34b" stroke-width="1.8"/></svg>\`,
    photo: \`<svg class="category-cake-icon" viewBox="0 0 80 80" role="img" aria-label="Photo cake with edible picture"><defs><linearGradient id="photoCake" x2="0" y2="1"><stop stop-color="#fffefa"/><stop offset="1" stop-color="#f1dfd8"/></linearGradient></defs><ellipse cx="40" cy="68" rx="27" ry="5" fill="#7b4c4c" opacity=".12"/><path d="M16 43q24-7 48 0v19a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6Z" fill="url(#photoCake)" stroke="#ae7b72" stroke-width="1.5"/><ellipse cx="40" cy="42" rx="24" ry="7" fill="#fff8f3" stroke="#ae7b72" stroke-width="1.5"/><rect x="28" y="17" width="24" height="18" rx="3" fill="#fff" stroke="#bd8290" stroke-width="1.5" transform="rotate(-4 40 26)"/><circle cx="35" cy="23" r="3" fill="#e3a34b"/><path d="m30 32 7-7 5 5 4-4 5 5" fill="#e96a8d"/><path d="M20 47q4 7 8 0t8 0t8 0t8 0t8 0" fill="none" stroke="#e96a8d" stroke-width="2.5" stroke-linecap="round"/><circle cx="28" cy="57" r="2" fill="#e3a34b"/><circle cx="40" cy="61" r="2" fill="#c94e72"/><circle cx="52" cy="57" r="2" fill="#e3a34b"/></svg>\`
  };

  const categoryDetails = {
    'Birthday Cakes': {
      title: 'Birthday Cakes',
      desc: 'Playful, vibrant and delicious handcrafted birthday cakes made with real butter and rich Belgian chocolate. From confetti treats to fresh fruit bakes.',
      img: '/images/gallery/1.jpeg'
    },
    'Wedding Cakes': {
      title: 'Wedding Cakes',
      desc: 'Grand multi-tiered cakes, delicately frosted in ivory and blush tones with handcrafted floral accents, designed for your most magical day.',
      img: '/images/gallery/4.jpeg'
    },
    'Anniversary Cakes': {
      title: 'Anniversary Cakes',
      desc: 'Romantic flavours, heart accents, and elegant detailing crafted to celebrate your timeless love and sweet milestones.',
      img: '/images/gallery/7.jpeg'
    },
    'Cupcakes & Jars': {
      title: 'Cupcakes & Dessert Jars',
      desc: 'Artisan cupcakes and rich layered dessert jars, perfect for gifts, celebration dessert tables, and sharing happiness.',
      img: '/images/cakes/cupcakes.jpg'
    },
    'Theme Cakes': {
      title: 'Theme Cakes',
      desc: 'Custom character cakes, creative hobby designs, and unique celebration bakes lovingly tailored to your party theme.',
      img: '/images/gallery/5.jpeg'
    },
    'Photo Cakes': {
      title: 'Edible Photo Cakes',
      desc: 'Personalised edible-print photo cakes that turn your treasured family photographs and memories into delicious celebration centerpieces.',
      img: '/images/gallery/8.jpeg'
    }
  };

  const cakes = [
    {key:'birthday', name:'Birthday Cakes', category:'Birthday Cakes', image:'/images/gallery/1.jpeg', desc:'Playful, colourful and just the right amount of sweet.', price:'From ₹599'},
    {key:'wedding', name:'Wedding Cakes', category:'Wedding Cakes', image:'/images/gallery/4.jpeg', desc:'Elegant tiered cakes designed around your big day.', price:'From ₹2,499'},
    {key:'anniversary', name:'Anniversary Cakes', category:'Anniversary Cakes', image:'/images/gallery/7.jpeg', desc:'Romantic flavours and delicate detailing.', price:'From ₹899'},
    {key:'cupcake', name:'Cupcakes & Jars', category:'Cupcakes & Jars', image:'/images/cakes/cupcakes.jpg', desc:'Bite-sized treats perfect for sharing.', price:'From ₹349 / box'},
    {key:'theme', name:'Theme Cakes', category:'Theme Cakes', image:'/images/gallery/5.jpeg', desc:'Custom characters, hobbies and colour palettes.', price:'From ₹999'},
    {key:'photo', name:'Photo Cakes', category:'Photo Cakes', image:'/images/gallery/8.jpeg', desc:'Edible-print cakes for a personal touch.', price:'From ₹799'}
  ];

  const cakesGrid = document.getElementById('cakesGrid');
  cakes.forEach(c => {
    cakesGrid.insertAdjacentHTML('beforeend', \`
      <div class="cake-card reveal" data-category="\${c.category}">
        <div class="cake-card-thumb-wrap">
          <img src="\${c.image}" alt="\${c.name}" class="cake-card-thumb" loading="lazy">
        </div>
        <div class="cake-card-body">
          <h3>\${c.name}</h3>
          <p>\${c.desc}</p>
          <span class="price-tag">\${c.price}</span>
          <button type="button" class="btn btn-outline category-explore-btn" data-category="\${c.category}">Explore \${c.name} →</button>
        </div>
      </div>\`);
  });
  document.querySelectorAll('#cakesGrid .reveal').forEach(el => io.observe(el));

  // Category Banner handling & navigation
  function applyCategoryFilter(catName) {
    const categorySelect = document.getElementById('catalogCategory');
    const banner = document.getElementById('categoryBanner');
    const bannerTitle = document.getElementById('categoryBannerTitle');
    const bannerDesc = document.getElementById('categoryBannerDesc');
    const bannerImg = document.getElementById('categoryBannerImg');

    if (categorySelect) {
      if (catName && catName !== 'All') {
        let exists = false;
        for (let opt of categorySelect.options) {
          if (opt.value === catName) { exists = true; break; }
        }
        if (!exists) {
          const opt = document.createElement('option');
          opt.value = catName;
          opt.textContent = catName;
          categorySelect.appendChild(opt);
        }
        categorySelect.value = catName;
      } else {
        categorySelect.value = 'All';
      }
      categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (banner && categoryDetails[catName]) {
      const details = categoryDetails[catName];
      bannerTitle.textContent = details.title;
      bannerDesc.textContent = details.desc;
      bannerImg.src = details.img;
      bannerImg.alt = details.title;
      banner.style.display = 'block';
    } else if (banner) {
      banner.style.display = 'none';
    }
  }

  // Handle category triggers
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-category]');
    if (!trigger) return;
    const cat = trigger.getAttribute('data-category');
    if (!cat) return;
    e.preventDefault();
    applyCategoryFilter(cat);
    const shopEl = document.getElementById('shop');
    if (shopEl) {
      shopEl.scrollIntoView({ behavior: 'smooth' });
    }
  });

  const clearCategoryBannerBtn = document.getElementById('clearCategoryBannerBtn');
  if (clearCategoryBannerBtn) {
    clearCategoryBannerBtn.addEventListener('click', () => {
      applyCategoryFilter('All');
    });
  }

  // Observe catalog category select changes to sync banner
  const catalogCatSelect = document.getElementById('catalogCategory');
  if (catalogCatSelect) {
    catalogCatSelect.addEventListener('change', () => {
      const val = catalogCatSelect.value;
      const banner = document.getElementById('categoryBanner');
      if (banner && categoryDetails[val]) {
        const details = categoryDetails[val];
        document.getElementById('categoryBannerTitle').textContent = details.title;
        document.getElementById('categoryBannerDesc').textContent = details.desc;
        const bImg = document.getElementById('categoryBannerImg');
        bImg.src = details.img;
        bImg.alt = details.title;
        banner.style.display = 'block';
      } else if (banner) {
        banner.style.display = 'none';
      }
    });
  }

  // ---- Real Gallery Images ----
  const galleryItems = [
    { src: '/images/gallery/1.jpeg', title: 'Purple Birthday Celebration Cake', sub: 'Custom themed birthday with balloon accents', cat: 'Birthday' },
    { src: '/images/gallery/2.jpeg', title: 'Fresh Seasonal Fruit Celebration', sub: 'Topped with kiwi, fresh grapes & strawberries', cat: 'Birthday' },
    { src: '/images/gallery/3.jpeg', title: 'Berry Harvest Celebration Cake', sub: 'Rustic hand-piped vanilla sponge with cherries', cat: 'Birthday' },
    { src: '/images/gallery/4.jpeg', title: 'Tiered Grand Wedding Cake', sub: 'Three tiers with delicate blush and white florals', cat: 'Wedding' },
    { src: '/images/gallery/5.jpeg', title: 'Minnie Mouse Theme Celebration', sub: 'Handcrafted bow and ears character birthday cake', cat: 'Theme' },
    { src: '/images/gallery/6.jpeg', title: 'Royal Baby Shower Celebration', sub: 'Sky blue drip cake with golden crown', cat: 'Theme' },
    { src: '/images/gallery/7.jpeg', title: 'Blush Butterfly Celebration Cake', sub: 'Two-tier pastel blush cake with gold butterflies', cat: 'Anniversary' },
    { src: '/images/gallery/8.jpeg', title: 'Jenitha Sunshine Celebration Cake', sub: 'Warm citrus yellow piping & edible accents', cat: 'Birthday' },
    { src: '/images/gallery/9.jpeg', title: 'Gender Reveal Celebration Cake', sub: 'Pink & blue edible-print milestone cake', cat: 'Theme' }
  ];

  const galleryGrid = document.getElementById('galleryGrid');
  function renderGallery(filter = 'all') {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';
    const filtered = filter === 'all' 
      ? galleryItems 
      : galleryItems.filter(item => item.cat.toLowerCase() === filter.toLowerCase() || (filter === 'Theme' && item.cat === 'Theme'));

    filtered.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'gallery-card reveal in';
      card.innerHTML = \`
        <div class="gallery-card-img-wrap">
          <img src="\${item.src}" alt="\${item.title}" loading="lazy">
          <div class="gallery-card-overlay">
            <span class="gallery-card-tag">\${item.cat}</span>
            <div class="gallery-card-title">\${item.title}</div>
          </div>
        </div>\`;
      card.addEventListener('click', () => openLightbox(item));
      galleryGrid.appendChild(card);
    });
  }
  renderGallery('all');

  // Gallery Filters
  const galleryFilterBar = document.getElementById('galleryFilterBar');
  if (galleryFilterBar) {
    galleryFilterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-gallery-filter]');
      if (!btn) return;
      galleryFilterBar.querySelectorAll('.gallery-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGallery(btn.getAttribute('data-gallery-filter'));
    });
  }

  // Lightbox Modal
  const lightbox = document.getElementById('galleryLightbox');
  const lightboxImg = document.getElementById('lightboxImage');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxSubtitle = document.getElementById('lightboxSubtitle');
  const lightboxClose = document.getElementById('lightboxCloseBtn');
  const lightboxOverlay = document.getElementById('lightboxOverlay');

  function openLightbox(item) {
    if (!lightbox) return;
    lightboxImg.src = item.src;
    lightboxImg.alt = item.title;
    lightboxTitle.textContent = item.title;
    lightboxSubtitle.textContent = item.sub;
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.hidden = true;
    document.body.style.overflow = '';
  }

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxOverlay) lightboxOverlay.addEventListener('click', closeLightbox);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && !lightbox.hidden) {
      closeLightbox();
    }
  });`;

if (oldScriptBlockRegex.test(html)) {
  html = html.replace(oldScriptBlockRegex, newScriptBlock);
  console.log('✓ Script block updated (Categories + Gallery + Lightbox)');
} else {
  console.log('! Script block regex did not match');
}

fs.writeFileSync(indexPath, html, 'utf8');
console.log('✓ index.html successfully updated');
