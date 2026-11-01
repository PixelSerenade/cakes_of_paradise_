const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../../index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const regex = /<section id="gallery">[\s\S]*?<div class="gallery-grid" id="galleryGrid"><\/div>\s*<\/section>/;

const newSection = `<!-- ================= GALLERY ================= -->
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

if (regex.test(html)) {
  html = html.replace(regex, newSection);
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('✓ Gallery section replaced successfully!');
} else {
  console.log('! Regex did not match');
}
