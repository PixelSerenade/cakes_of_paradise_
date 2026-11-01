const path = require('path');
const fs = require('fs/promises');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Product = require('../models/Product');

const products = [
  { slug:'flower-letter-birthday', name:'Buttercream Flower Birthday Cake', category:'Birthday Cakes', description:'Soft vanilla sponge layered with strawberry cream and finished with bright buttercream flowers for a cheerful birthday table.', image:'/public/images/products/birthday/flower-letter-birthday.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1557803056-4acbacad87d2', flavors:['Vanilla Strawberry','Chocolate Cream'], sizes:[{name:'0.5 kg',price:649},{name:'1 kg',price:1199},{name:'2 kg',price:2299}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'woodland-vanilla-birthday', name:'Woodland Vanilla Celebration Cake', category:'Birthday Cakes', description:'A tender vanilla celebration cake with smooth white frosting, colorful sprinkles, and a rustic woodland-inspired presentation.', image:'/public/images/products/birthday/woodland-vanilla-birthday.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1585850317977-6b2188fd377c', flavors:['Vanilla Bean','Chocolate Truffle'], sizes:[{name:'0.5 kg',price:599},{name:'1 kg',price:1099},{name:'2 kg',price:2099}], allergens:['Wheat','Milk','Eggs','Soy'] },

  { slug:'ivory-pink-rose-wedding', name:'Ivory & Blush Rose Wedding Cake', category:'Wedding Cakes', description:'Smooth ivory buttercream tiers decorated with soft pink roses and delicate pearl details for a graceful wedding centerpiece.', image:'/public/images/products/wedding/ivory-pink-rose-wedding.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1559373098-e1caaccae791', flavors:['Vanilla Bean','White Chocolate Rose'], sizes:[{name:'2 kg',price:2799},{name:'3 kg',price:3999},{name:'5 kg',price:6499}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'white-garden-rose-wedding', name:'White Garden Rose Wedding Cake', category:'Wedding Cakes', description:'Classic white sponge finished in smooth frosting and fresh-looking blush florals, layered for a refined garden reception.', image:'/public/images/products/wedding/white-garden-rose-wedding.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1503525642560-ecca5e2e49e9', flavors:['Vanilla Orchid','Strawberry Mascarpone'], sizes:[{name:'2 kg',price:2899},{name:'3 kg',price:4199},{name:'5 kg',price:6699}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'red-ribbon-tier-wedding', name:'Red Ribbon Tiered Wedding Cake', category:'Wedding Cakes', description:'A three-tier vanilla cake wrapped in elegant red accents with floral details and a smooth buttercream finish.', image:'/public/images/products/wedding/red-ribbon-tier-wedding.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1653936392747-cbbf97f8d45c', flavors:['Vanilla Buttercream','Belgian Truffle'], sizes:[{name:'2 kg',price:2999},{name:'3 kg',price:4299},{name:'5 kg',price:6999}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'gold-pedestal-wedding', name:'Gold Pedestal White Rose Wedding Cake', category:'Wedding Cakes', description:'A softly ridged white wedding cake dressed with white roses and greenery, presented in a warm gold-accented style.', image:'/public/images/products/wedding/gold-pedestal-wedding.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1683016629908-ad08b8334276', flavors:['Vanilla Orchid','Salted Caramel'], sizes:[{name:'2 kg',price:2899},{name:'3 kg',price:4199},{name:'4 kg',price:5599}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'botanical-gold-wedding', name:'Botanical Gold Wedding Cake', category:'Wedding Cakes', description:'Hand-finished white frosting with botanical greenery, airy white blossoms, and understated gold details.', image:'/public/images/products/wedding/botanical-gold-wedding.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1683435844308-b757f5ca64b1', flavors:['Vanilla Bean','White Chocolate'], sizes:[{name:'2 kg',price:2799},{name:'3 kg',price:4099},{name:'5 kg',price:6799}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'floral-vow-wedding-cake', name:'Floral Vow Celebration Cake', category:'Wedding Cakes', description:'A white tiered cake finished with delicate sugar flowers, fine piping, and romantic floral accents for a wedding reception.', image:'/public/images/products/wedding/floral-vow-wedding-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1625224702752-60f72390a588', flavors:['Vanilla Rose','Belgian Chocolate'], sizes:[{name:'2 kg',price:2999},{name:'3 kg',price:4299},{name:'5 kg',price:6999}], allergens:['Wheat','Milk','Eggs'] },

  { slug:'blush-drip-anniversary', name:'Blush Chocolate Drip Anniversary Cake', category:'Anniversary Cakes', description:'A soft pink frosted cake with glossy chocolate drips and a light vanilla sponge, made for a sweet anniversary toast.', image:'/public/images/products/anniversary/blush-drip-anniversary.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1554163328-61681c4f303f', flavors:['Vanilla Chocolate Drip','Strawberry Cream'], sizes:[{name:'0.5 kg',price:699},{name:'1 kg',price:1299},{name:'2 kg',price:2399}], allergens:['Wheat','Milk','Eggs','Soy'] },
  { slug:'berry-layer-anniversary', name:'Berry Layer Anniversary Cake', category:'Anniversary Cakes', description:'Light vanilla layers with whipped cream and fresh berries, finished in a clean celebration style for a shared milestone.', image:'/public/images/products/anniversary/berry-layer-anniversary.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1593452332413-1166af193985', flavors:['Vanilla Berry','Strawberry Cream'], sizes:[{name:'0.5 kg',price:749},{name:'1 kg',price:1399},{name:'2 kg',price:2599}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'strawberry-cream-anniversary', name:'Strawberry Cream Anniversary Cake', category:'Anniversary Cakes', description:'A delicate sponge-and-cream cake with ripe strawberry accents, made for a bright and romantic celebration.', image:'/public/images/products/anniversary/strawberry-cream-anniversary.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1675430288973-daa53702a5ac', flavors:['Strawberry Cream','Vanilla Bean'], sizes:[{name:'0.5 kg',price:699},{name:'1 kg',price:1299},{name:'2 kg',price:2399}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'raspberry-cocoa-anniversary', name:'Raspberry Cocoa Anniversary Cake', category:'Anniversary Cakes', description:'Rich cocoa layers with glossy chocolate frosting and a bright raspberry finish for a memorable anniversary dessert.', image:'/public/images/products/anniversary/raspberry-cocoa-anniversary.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1695649912819-67853082a240', flavors:['Dark Chocolate Raspberry','Mocha'], sizes:[{name:'0.5 kg',price:749},{name:'1 kg',price:1399},{name:'2 kg',price:2599}], allergens:['Wheat','Milk','Eggs','Soy'] },
  { slug:'tropical-fruit-anniversary', name:'Tropical Fruit Anniversary Cake', category:'Anniversary Cakes', description:'A light vanilla sponge topped with juicy kiwi, strawberry, blueberry and peach slices over airy cream for a fresh shared celebration.', image:'/public/images/products/anniversary/tropical-fruit-anniversary.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1508736375612-66c03035c629', flavors:['Vanilla Fruit','Pineapple Cream'], sizes:[{name:'0.5 kg',price:649},{name:'1 kg',price:1199},{name:'2 kg',price:2299}], allergens:['Wheat','Milk','Eggs'] },

  { slug:'rustic-mini-cupcake-box', name:'Rustic Vanilla Cupcake Box', category:'Cupcakes & Jars', description:'A sharing box of tender vanilla cupcakes topped with soft buttercream swirls and a light botanical finish.', image:'/public/images/products/cupcakes-jars/rustic-mini-cupcake-box.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1666961019206-0699bea25ef3', flavors:['Vanilla Buttercream','Lemon Cream'], sizes:[{name:'Box of 4',price:299},{name:'Box of 6',price:429},{name:'Box of 12',price:799}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'blueberry-swirl-cupcake-box', name:'Blueberry Swirl Cupcake Box', category:'Cupcakes & Jars', description:'Fluffy vanilla cupcakes crowned with smooth cream and fresh blueberries in a neat little party box.', image:'/public/images/products/cupcakes-jars/blueberry-swirl-cupcake-box.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1658980356668-058f9cb4d828', flavors:['Blueberry Vanilla','Classic Vanilla'], sizes:[{name:'Box of 4',price:299},{name:'Box of 6',price:429},{name:'Box of 12',price:799}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'chocolate-curl-cupcake-pack', name:'Chocolate Curl Cupcake Pack', category:'Cupcakes & Jars', description:'Moist chocolate cupcakes finished with a creamy white icing swirl and delicate chocolate curls.', image:'/public/images/products/cupcakes-jars/chocolate-curl-cupcake-pack.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1498458555718-c60a99aa4ddc', flavors:['Chocolate Truffle','Chocolate Vanilla'], sizes:[{name:'Box of 4',price:329},{name:'Box of 6',price:469},{name:'Box of 12',price:879}], allergens:['Wheat','Milk','Eggs','Soy'] },
  { slug:'raspberry-cloud-cupcake-pack', name:'Raspberry Cloud Cupcake Pack', category:'Cupcakes & Jars', description:'Golden cupcakes topped with airy vanilla frosting and ripe raspberries for a fresh, fruity finish.', image:'/public/images/products/cupcakes-jars/raspberry-cloud-cupcake-pack.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1727233431462-624910319104', flavors:['Raspberry Cream','Vanilla Berry'], sizes:[{name:'Box of 4',price:329},{name:'Box of 6',price:469},{name:'Box of 12',price:879}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'pink-sprinkle-cupcake-box', name:'Pink Sprinkle Cupcake Box', category:'Cupcakes & Jars', description:'Vanilla cupcakes with a rose-pink buttercream crown, rainbow sprinkles, and a playful cherry accent.', image:'/public/images/products/cupcakes-jars/pink-sprinkle-cupcake-box.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1599785209796-786432b228bc', flavors:['Strawberry Buttercream','Vanilla Sprinkle'], sizes:[{name:'Box of 4',price:299},{name:'Box of 6',price:429},{name:'Box of 12',price:799}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'birthday-candle-cupcake-set', name:'Birthday Candle Cupcake Set', category:'Cupcakes & Jars', description:'Chocolate cupcakes with creamy frosting and bright candle decorations, packed for a small birthday gathering.', image:'/public/images/products/cupcakes-jars/birthday-candle-cupcake-set.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1532669329646-9eedd9da2040', flavors:['Chocolate Cream','Vanilla Swirl'], sizes:[{name:'Box of 4',price:329},{name:'Box of 6',price:469},{name:'Box of 12',price:879}], allergens:['Wheat','Milk','Eggs','Soy'] },

  { slug:'chocolate-velvet-theme-cake', name:'Chocolate Velvet Theme Cake', category:'Theme Cakes', description:'Deep chocolate sponge with glossy ganache and piped cream details, designed as a dramatic centerpiece for a themed party.', image:'/public/images/products/theme/chocolate-velvet-theme-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1629386531011-8301c726f65e', flavors:['Belgian Chocolate','Mocha Cream'], sizes:[{name:'1 kg',price:1299},{name:'1.5 kg',price:1799},{name:'2 kg',price:2399}], allergens:['Wheat','Milk','Eggs','Soy'] },
  { slug:'caramel-shard-theme-cake', name:'Caramel Shard Celebration Cake', category:'Theme Cakes', description:'A single-serving chocolate celebration cake dressed with caramel shards and piped accents for a polished custom design.', image:'/public/images/products/theme/caramel-shard-theme-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1629121005308-d3a96ee3386b', flavors:['Chocolate Caramel','Vanilla Orchid'], sizes:[{name:'1 kg',price:1299},{name:'1.5 kg',price:1799},{name:'2 kg',price:2399}], allergens:['Wheat','Milk','Eggs','Tree Nuts'] },
  { slug:'dark-cocoa-theme-cake', name:'Dark Cocoa Celebration Cake', category:'Theme Cakes', description:'Velvety dark cocoa sponge with smooth chocolate cream, styled with an elegant minimalist finish for custom occasions.', image:'/public/images/products/theme/dark-cocoa-theme-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1621292390735-3dc96a6d4b1a', flavors:['Dark Chocolate','Chocolate Orange'], sizes:[{name:'1 kg',price:1299},{name:'1.5 kg',price:1799},{name:'2 kg',price:2399}], allergens:['Wheat','Milk','Eggs','Soy'] },
  { slug:'pistachio-gold-theme-cake', name:'Pistachio Gold Theme Cake', category:'Theme Cakes', description:'A petite green-glazed cake finished with a smooth cream swirl and fine nut accents for a modern custom celebration.', image:'/public/images/products/theme/pistachio-gold-theme-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1694837493756-b8b04cae5d3f', flavors:['Pistachio Cream','Vanilla Bean'], sizes:[{name:'1 kg',price:1399},{name:'1.5 kg',price:1899},{name:'2 kg',price:2499}], allergens:['Wheat','Milk','Eggs','Tree Nuts'] },
  { slug:'golden-pedestal-theme-cake', name:'Golden Pedestal Theme Cake', category:'Theme Cakes', description:'Soft vanilla cake dressed in a semi-naked buttercream style with botanical accents and a bright gold presentation.', image:'/public/images/products/theme/golden-pedestal-theme-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1706370883615-52830fed4e98', flavors:['Vanilla Rose','White Chocolate'], sizes:[{name:'1 kg',price:1299},{name:'1.5 kg',price:1799},{name:'2 kg',price:2399}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'rustic-flower-theme-cake', name:'Rustic Flower Theme Cake', category:'Theme Cakes', description:'A lightly frosted vanilla sponge crowned with delicate blooms and natural textures for a garden-inspired celebration theme.', image:'/public/images/products/theme/rustic-flower-theme-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1701353180809-a7783244c976', flavors:['Vanilla Garden','Lemon Cream'], sizes:[{name:'1 kg',price:1299},{name:'1.5 kg',price:1799},{name:'2 kg',price:2399}], allergens:['Wheat','Milk','Eggs'] },

  { slug:'raspberry-cream-photo-cake', name:'Raspberry Cream Photo Cake', category:'Photo Cakes', description:'A soft vanilla cake with whipped cream and raspberry accents, finished with a customizable edible image panel for a personal celebration.', image:'/public/images/products/photo/raspberry-cream-photo-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1768236360396-0f131beb3028', flavors:['Vanilla Raspberry','White Chocolate'], sizes:[{name:'0.5 kg',price:799},{name:'1 kg',price:1499},{name:'2 kg',price:2799}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'fruit-garden-photo-cake', name:'Lavender Garden Photo Cake', category:'Photo Cakes', description:'A light vanilla cake with lavender-style floral accents and a customizable edible image panel for a keepsake celebration design.', image:'/public/images/products/photo/fruit-garden-photo-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1669837126643-d4162e8d0ff4', flavors:['Vanilla Lavender','White Chocolate'], sizes:[{name:'0.5 kg',price:799},{name:'1 kg',price:1499},{name:'2 kg',price:2799}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'strawberry-keepsake-photo-cake', name:'Strawberry Keepsake Photo Cake', category:'Photo Cakes', description:'Vanilla sponge layered with cream and strawberry pieces, topped with a customer-selected edible keepsake image.', image:'/public/images/products/photo/strawberry-keepsake-photo-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1641848421644-a1603f016f51', flavors:['Strawberry Cream','Vanilla Bean'], sizes:[{name:'0.5 kg',price:799},{name:'1 kg',price:1499},{name:'2 kg',price:2799}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'berry-frame-photo-cake', name:'Berry Frame Photo Cake', category:'Photo Cakes', description:'A fresh cream cake with berry tones and a smooth edible-photo surface, customizable with a favorite image or short message.', image:'/public/images/products/photo/berry-frame-photo-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1717677737586-99affb851595', flavors:['Blueberry Cream','Vanilla Berry'], sizes:[{name:'0.5 kg',price:799},{name:'1 kg',price:1499},{name:'2 kg',price:2799}], allergens:['Wheat','Milk','Eggs'] },
  { slug:'chocolate-floral-photo-cake', name:'Chocolate Floral Photo Cake', category:'Photo Cakes', description:'A delicate chocolate sponge finished with floral-inspired color and a personalized edible image panel for a thoughtful gift.', image:'/public/images/products/photo/chocolate-floral-photo-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1567009349827-ab242f2c96e6', flavors:['Chocolate Raspberry','Mocha Cream'], sizes:[{name:'0.5 kg',price:849},{name:'1 kg',price:1599},{name:'2 kg',price:2899}], allergens:['Wheat','Milk','Eggs','Soy'] },
  { slug:'citrus-memory-photo-cake', name:'Citrus Memory Photo Cake', category:'Photo Cakes', description:'A bright vanilla cream cake with citrus accents and a custom edible picture panel, made to mark a favorite shared memory.', image:'/public/images/products/photo/citrus-memory-photo-cake.jpg', photoCredit:'Cakes of Paradise Bakery', source:'https://images.unsplash.com/photo-1659651224506-74b8ef51fc6a', flavors:['Orange Cream','Lemon Vanilla'], sizes:[{name:'0.5 kg',price:799},{name:'1 kg',price:1499},{name:'2 kg',price:2799}], allergens:['Wheat','Milk','Eggs'] },
];

function jpegSize(buffer) {
  for (let i = 2; i < buffer.length - 9;) {
    if (buffer[i] !== 0xff) { i += 1; continue; }
    const marker = buffer[i + 1];
    const length = buffer.readUInt16BE(i + 2);
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
    }
    if (length < 2) break;
    i += 2 + length;
  }
  return null;
}

async function ensureImage(product) {
  const localPath = path.resolve(__dirname, '../..', product.image.replace(/^\//, ''));
  try {
    const current = await fs.stat(localPath);
    if (current.size > 0 && current.size < 300000) {
      const currentBytes = await fs.readFile(localPath);
      const currentDimensions = jpegSize(currentBytes);
      // Preserve the locally curated bakery catalog photography. Re-downloading
      // the placeholder source image here would silently undo product refreshes.
      if (currentDimensions?.width >= 1000) return;
    }
  } catch {}
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  for (const quality of [72, 60, 48, 40, 32, 24]) {
    const response = await fetch(`${product.source}?fit=max&auto=format&fm=jpg&w=1200&q=${quality}`);
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
      throw new Error(`Image download failed for ${product.slug}: HTTP ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const size = jpegSize(bytes);
    if (bytes.length < 300000 && size?.width === 1200) {
      await fs.writeFile(localPath, bytes);
      return;
    }
  }
  throw new Error(`Could not compress ${product.slug} to an image <=300 KB and about 1200 px wide (last file ${localPath}).`);
}

async function seedMissingCatalog() {
  await connectDB();
  const categories = ['Birthday Cakes','Wedding Cakes','Anniversary Cakes','Cupcakes & Jars','Theme Cakes','Photo Cakes'];
  for (const category of categories) {
    const existing = await Product.find({ category }).select('slug name').lean();
    const normalizedNames = new Set(existing.map((item) => item.name.trim().toLocaleLowerCase()));
    const slugs = new Set(existing.map((item) => item.slug));
    const target = Math.max(0, 10 - existing.length);
    const additions = products.filter((item) => item.category === category && !slugs.has(item.slug) && !normalizedNames.has(item.name.trim().toLocaleLowerCase())).slice(0, target);
    const managedItems = products.filter((item) => item.category === category && (
      additions.some((addition) => addition.slug === item.slug) ||
      existing.some((record) => record.slug === item.slug && record.name.trim().toLocaleLowerCase() === item.name.trim().toLocaleLowerCase())
    ));
    for (const item of managedItems) await ensureImage(item);
    if (additions.length) {
      await Product.insertMany(additions.map(({ source, ...item }) => ({ ...item, dietaryTags: [], available: true, seasonal: false })), { ordered: true });
    }
    console.log(`${category}: ${existing.length} before, ${existing.length + additions.length} after`);
  }
}

seedMissingCatalog().then(() => mongoose.disconnect()).catch(async (error) => {
  console.error('Catalog seed failed:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
});
