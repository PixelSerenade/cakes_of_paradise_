# Cake image inventory

## Counts

- Starter catalog: **24 cakes**, each with **1 primary image**.
- `public/images/products/`: **63 image files** across the six category folders. This includes the catalog photos and additional photos used around the site.
- The gender reveal cake has **3 extra detail photos** in addition to its primary photo: `gender-reveal-detail-2.png`, `gender-reveal-detail-3.png`, and `gender-reveal-detail-4.png`.
- `public/images/`: **96 image files** total, including product, editorial, gallery, account, and contact imagery.
- Whole project: **178 raster image files**. This total also includes 45 in the older root `images/` folder, 35 loose root-level candidate/test files, and 2 scratch images. Some of these duplicate the public assets; they are not 178 unique active cake photos.

The starter catalog is in `backend/data/products.js`. The admin database can contain more products than these 24 starter entries; I could not read the live database during this inventory, so database-only products are not included below.

## Starter cakes and primary image paths

| Category | Cake | Primary image |
|---|---|---|
| Birthday Cakes | Birthday Confetti Celebration Cake | `public/images/products/birthday/birthday-confetti.jpg` |
| Birthday Cakes | Fresh Fruit Crown Birthday Cake | `public/images/products/birthday/fresh-fruit-birthday.jpg` |
| Birthday Cakes | Classic Chocolate Truffle Birthday Cake | `public/images/products/birthday/classic-chocolate-birthday.jpg` |
| Birthday Cakes | Fresh Harvest Berry Celebration Cake | `public/images/products/birthday/berry-harvest-birthday.jpg` |
| Wedding Cakes | Grand 3-Tier Floral Wedding Cake | `public/images/products/wedding/luxury-tiered-wedding.jpg` |
| Wedding Cakes | Royal Ivory & Gold Leaf Wedding Cake | `public/images/products/wedding/ivory-gold-wedding.jpg` |
| Wedding Cakes | Blush Bloom 2-Tier Wedding Cake | `public/images/products/wedding/blush-bloom-wedding.jpg` |
| Wedding Cakes | Pearl Elegance Floral Wedding Cake | `public/images/products/wedding/pearl-elegance-wedding.jpg` |
| Anniversary Cakes | Rose Gold & Blush Celebration Cake | `public/images/products/anniversary/liana-blush-anniversary.jpg` |
| Anniversary Cakes | Red Velvet Romance Heart Cake | `public/images/products/anniversary/red-velvet-anniversary.jpg` |
| Anniversary Cakes | Chocolate Ganache Royal Crown | `public/images/products/anniversary/chocolate-ganache-anniversary.jpg` |
| Anniversary Cakes | Citrus Cream Romance Cake | `public/images/products/anniversary/citrus-cream-anniversary.jpg` |
| Cupcakes & Jars | Gourmet Cupcake Collection (Box of 6) | `public/images/products/cupcakes-jars/gourmet-cupcake-box.jpg` |
| Cupcakes & Jars | Belgian Chocolate Truffle Dessert Jar | `public/images/products/cupcakes-jars/chocolate-truffle-jar.jpg` |
| Cupcakes & Jars | Red Velvet & Cream Cheese Jar | `public/images/products/cupcakes-jars/red-velvet-cream-jar.jpg` |
| Cupcakes & Jars | Berry Blossom Cupcake Pack (Box of 4) | `public/images/products/cupcakes-jars/berry-cloud-cupcake-pack.jpg` |
| Theme Cakes | Pink Bow Character Theme Cake | `public/images/products/theme/minnie-mouse-theme.jpg` |
| Theme Cakes | Pastel Cloud Baby Shower Theme Cake | `public/images/products/theme/baby-shower-celebration.jpg` |
| Theme Cakes | Boy or Girl Gender Reveal Cake | `public/images/products/theme/gender-reveal-celebration.jpg` |
| Theme Cakes | Butterfly Garden Theme Celebration | `public/images/products/theme/butterfly-garden-theme.jpg` |
| Photo Cakes | Custom Edible Photo Print Cake | `public/images/products/photo/custom-edible-photo-cake.jpg` |
| Photo Cakes | Golden Frame Edible Photo Cake | `public/images/products/photo/golden-frame-photo-cake.jpg` |
| Photo Cakes | Sweet Memories Celebration Photo Cake | `public/images/products/photo/sweet-memories-photo-cake.jpg` |
| Photo Cakes | Classic Portrait Edible Picture Cake | `public/images/products/photo/classic-portrait-photo-cake.jpg` |

## Folder for replacement photos

The public asset folder already exists at `public/images/`, with cake catalog images organized by category under `public/images/products/`. When you provide real photos, keep originals together in a separate incoming folder first; then each approved photo can replace the matching primary image above without disturbing the other site artwork.

This inventory identifies file locations; it does not certify whether an image is AI-generated or a real bakery photo. The files do not contain reliable provenance metadata for that determination.
