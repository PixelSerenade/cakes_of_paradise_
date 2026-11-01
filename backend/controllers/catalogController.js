const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Order = require('../models/Order');
const { productSalesPipeline } = require('../utils/orderMetrics');
const { expandCakeSizes } = require('../utils/cakeSizes');
const { withCategoryMatchedImage } = require('../utils/productImages');

const DIETARY_TAGS = ['eggless', 'vegan', 'gluten-free', 'nut-free'];
const productView = (product) => ({ ...withCategoryMatchedImage(product), id: product.slug });

const listProducts = async (req, res) => {
  const search = String(req.query.search || '').trim();
  const category = String(req.query.category || '').trim();
  const dietary = String(req.query.dietary || '').trim().toLowerCase();
  const price = String(req.query.price || '').trim();
  const flavor = String(req.query.flavor || '').trim();
  const size = String(req.query.size || '').trim();
  const sort = String(req.query.sort || 'popular');
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const isAll = req.query.all === 'true';
  const requestedIds = req.query.ids === undefined
    ? null
    : [...new Set(String(req.query.ids).split(',').filter((id) => /^[a-z0-9][a-z0-9-]{0,79}$/i.test(id)))].slice(0, 500);
  const limit = isAll ? 500 : Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const skip = (page - 1) * limit;

  const filter = { available: true };
  if (requestedIds) filter.slug = { $in: requestedIds };
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
    'photo cakes': 'Photo Cakes',
  };
  if (category && category !== 'All' && category !== 'all' && category !== 'All Cakes') {
    filter.category = CANONICAL_CATEGORIES[category.toLowerCase()] || category;
  }
  if (DIETARY_TAGS.includes(dietary)) filter.dietaryTags = dietary;
  const priceRanges = { under1000: [0, 999.99], '1000-1500': [1000, 1499.99], '1500-2500': [1500, 2500], above2500: [2500.01, Number.MAX_SAFE_INTEGER] };
  if (priceRanges[price]) {
    const [min, max] = priceRanges[price];
    // A cake is in a price band when at least one purchasable size is in it.
    // Using $arrayElemAt only checks the first size and misses valid options.
    filter.sizes = { $elemMatch: { price: { $gte: min, $lte: max } } };
  }
  if (flavor) filter.flavors = new RegExp(`^${flavor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
    ];
  }
  const sorting = {
    'price-low': { 'sizes.0.price': 1 },
    'price-high': { 'sizes.0.price': -1 },
    name: { name: 1 },
  }[sort] || { seasonal: -1, name: 1 };

  let products;
  let totalCount;
  let unitsSoldByProduct = new Map();
  let salesByProduct = new Map();
  let estimatedSalesByProduct = new Map();
  if (sort === 'popular') {
    let [matchingProducts, sales] = await Promise.all([
      Product.find(filter).lean(),
      Order.aggregate(productSalesPipeline()),
    ]);
    if (size) matchingProducts = matchingProducts.filter((product) => expandCakeSizes(product).some((option) => option.name === size));
    unitsSoldByProduct = new Map(sales.map((sale) => [sale._id, sale.units]));
    salesByProduct = new Map(sales.map((sale) => [sale._id, sale.sales]));
    estimatedSalesByProduct = new Map(sales.map((sale) => [sale._id, sale.salesIsEstimated]));
    matchingProducts.sort((a, b) =>
      (unitsSoldByProduct.get(b.slug) || 0) - (unitsSoldByProduct.get(a.slug) || 0) ||
      Number(b.seasonal) - Number(a.seasonal) || a.name.localeCompare(b.name)
    );
    totalCount = matchingProducts.length;
    products = matchingProducts.slice(skip, skip + limit);
  } else if (size) {
    const matchingProducts = (await Product.find(filter).lean())
      .filter((product) => expandCakeSizes(product).some((option) => option.name === size));
    matchingProducts.sort((a, b) => {
      if (sort === 'price-low') return Number(a.sizes?.[0]?.price || 0) - Number(b.sizes?.[0]?.price || 0);
      if (sort === 'price-high') return Number(b.sizes?.[0]?.price || 0) - Number(a.sizes?.[0]?.price || 0);
      if (sort === 'name') return a.name.localeCompare(b.name);
      return Number(b.seasonal) - Number(a.seasonal) || a.name.localeCompare(b.name);
    });
    totalCount = matchingProducts.length;
    products = matchingProducts.slice(skip, skip + limit);
  } else {
    [products, totalCount] = await Promise.all([
      Product.find(filter).sort(sorting).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);
  }

  const summaries = await Review.aggregate([
    { $match: { productId: { $in: products.map((product) => product.slug) }, status: { $in: ['published', 'approved'] } } },
    { $group: { _id: '$productId', average: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const byProduct = new Map(summaries.map((item) => [item._id, item]));
  const facetFilter = { available: true };
  const [productCategories, savedCategories, availableFlavors, sizeProducts] = await Promise.all([
    Product.distinct('category', { available: true }),
    Category.find().sort({ name: 1 }).select('name').lean(),
    Product.distinct('flavors', facetFilter),
    Product.find(facetFilter).select('sizes category').lean(),
  ]);
  const availableSizes = sizeProducts.flatMap((product) => expandCakeSizes(product).map((item) => item.name));
  const categories = [...new Map([...productCategories, ...savedCategories.map((category) => category.name)].map((name) => [name.toLocaleLowerCase(), name])).values()];
  res.set('Cache-Control', 'no-store');
  return res.json({
    categories: ['All', ...categories.sort()],
    flavors: [...new Set(availableFlavors.filter((value) => typeof value === 'string' && value.trim()))].sort((a, b) => a.localeCompare(b)),
    sizes: [...new Set(availableSizes.filter((value) => typeof value === 'string' && value.trim()))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    dietaryTags: DIETARY_TAGS,
    total: totalCount,
    page,
    pages: Math.ceil(totalCount / limit) || 1,
    limit,
    products: products.map((product) => {
      const catalogProduct = { ...withCategoryMatchedImage(product) };
      delete catalogProduct.images;
      return {
        ...catalogProduct,
        sizes: expandCakeSizes(product),
        id: product.slug,
        reviewAverage: byProduct.get(product.slug)?.average || 0,
        reviewCount: byProduct.get(product.slug)?.count || 0,
        stock: product.stock ?? 20,
        unitsSold: unitsSoldByProduct.get(product.slug) || 0,
        totalSales: salesByProduct.has(product.slug) ? salesByProduct.get(product.slug) : 0,
        salesIsEstimated: estimatedSalesByProduct.get(product.slug) || false,
      };
    }),
  });
};

const getProductDetail = async (req, res) => {
  const product = withCategoryMatchedImage(await Product.findOne({ slug: req.params.productId, available: true }).lean());
  if (!product) return res.status(404).json({ message: 'Cake not found.' });
  const { image, ...details } = product;
  return res.json({ product: { ...details, sizes: expandCakeSizes(product), id: product.slug, images: product.images?.length ? product.images : [image] } });
};

const listReviews = async (req, res) => {
  const productId = req.params.productId;
  if (!await Product.exists({ slug: productId })) return res.status(404).json({ message: 'Cake not found' });
  const reviews = await Review.find({ productId, status: { $in: ['published', 'approved'] } })
    .sort({ createdAt: -1 }).limit(50).select('customerName rating comment createdAt reviewDate source user');

  let userReview = null;
  let canReview = false;
  
  // Try extracting user if token was sent
  let userId = req.user?._id;
  if (!userId && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch (e) {}
  }

  if (userId) {
    userReview = await Review.findOne({ productId, user: userId, source: 'customer' });
    const hasOrder = await Order.exists({
      user: userId,
      paymentStatus: 'paid',
      status: { $ne: 'cancelled' },
      $or: [{ deliveryStatus: 'delivered' }, { status: 'completed' }],
      'items.productId': productId,
    });
    canReview = Boolean(hasOrder);
  }

  return res.json({ reviews, userReview, canReview });
};

const createReview = async (req, res) => {
  const productId = req.params.productId;
  if (!await Product.exists({ slug: productId, available: true })) return res.status(404).json({ message: 'Cake not found' });
  const rating = Number(req.body.rating);
  const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : '';
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment || comment.length > 600) {
    return res.status(400).json({ message: 'Choose a rating from 1 to 5 and write a review under 600 characters.' });
  }
  const order = await Order.findOne({
    user: req.user._id,
    paymentStatus: 'paid',
    status: { $ne: 'cancelled' },
    $or: [{ deliveryStatus: 'delivered' }, { status: 'completed' }],
    'items.productId': productId,
  });
  if (!order) {
    return res.status(403).json({ message: 'You can review this cake after its order has been paid and delivered.' });
  }

  let review = await Review.findOne({ productId, user: req.user._id, source: 'customer' });
  if (review) {
    review.rating = rating;
    review.comment = comment;
    review.customerName = req.user.name;
    review.status = 'published';
    await review.save();
    return res.status(200).json({ message: 'Your review has been updated!', review });
  }

  review = await Review.create({
    productId,
    user: req.user._id,
    order: order._id,
    customerName: req.user.name,
    customerEmail: req.user.email || '',
    rating,
    comment,
    status: 'published',
    source: 'customer'
  });
  return res.status(201).json({ message: 'Thank you for your review!', review });
};

const validateProduct = (input, { creating = false } = {}) => {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const category = typeof input.category === 'string' ? input.category.trim() : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const image = typeof input.image === 'string' ? input.image.trim() : '';
  const images = Array.isArray(input.images) ? [...new Set(input.images.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean))] : [image];
  const slug = (typeof input.slug === 'string' && input.slug.trim() ? input.slug.trim() : name)
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  const photoCredit = typeof input.photoCredit === 'string' ? input.photoCredit.trim() : '';
  const flavors = Array.isArray(input.flavors) ? [...new Set(input.flavors.filter((v) => typeof v === 'string').map((v) => v.trim()).filter(Boolean))] : [];
  const sizes = Array.isArray(input.sizes) ? input.sizes.map((size) => ({ name: String(size.name || '').trim(), price: Number(size.price) })) : [];
  const allergens = Array.isArray(input.allergens) ? [...new Set(input.allergens.filter((v) => typeof v === 'string').map((v) => v.trim()).filter(Boolean))] : [];
  const dietaryTags = Array.isArray(input.dietaryTags) ? [...new Set(input.dietaryTags)] : [];
  const validImage = (value) => {
    if (/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) return value.length <= 2_600_000;
    if (typeof value === 'string' && (value.startsWith('/images/') || value.startsWith('images/'))) return true;
    try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
  };
  const validPhotoCredit = (value) => {
    if (!value) return true;
    if (typeof value === 'string' && value.length <= 120) return true;
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  };
  const stock = input.stock !== undefined ? Math.max(0, parseInt(input.stock, 10) || 0) : undefined;
  if (!name || name.length > 100 || !category || category.length > 40 || !description || description.length > 500 ||
      images.length < 1 || images.length > 5 || images.some((photo) => !validImage(photo)) ||
      !validImage(images[0] || image) || !validPhotoCredit(photoCredit) || flavors.length < 1 || flavors.length > 12 ||
      sizes.length < 1 || sizes.length > 8 || sizes.some((size) => !size.name || size.name.length > 30 || !Number.isSafeInteger(size.price) || size.price < 1) ||
      allergens.length > 20 || dietaryTags.some((tag) => !DIETARY_TAGS.includes(tag)) ||
      (creating && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
    return { error: 'Check the cake name, category, description, uploaded cake photo, flavour, size prices, allergens, and dietary tags.' };
  }
  return {
    value: {
      name, category, description, image: images[0] || image, images, photoCredit, flavors, sizes, allergens, dietaryTags,
      ...(stock !== undefined ? { stock } : {}),
      ...(creating ? { slug } : {}),
      ...(input.available !== undefined ? { available: Boolean(input.available) } : {}),
      ...(input.seasonal !== undefined ? { seasonal: Boolean(input.seasonal) } : {}),
    },
  };
};

const listAdminProducts = async (req, res) => {
  const search = String(req.query.search || '').trim().slice(0, 80);
  if (req.query.productId) {
    const product = await Product.findOne({ slug: req.query.productId });
    if (!product) return res.status(404).json({ message: 'Cake not found.' });
    return res.json({ product: productView(product) });
  }

  const paginated = req.query.page !== undefined || req.query.limit !== undefined || Boolean(search);
  const filter = {};
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { category: { $regex: escaped, $options: 'i' } },
      { description: { $regex: escaped, $options: 'i' } },
    ];
  }

  if (!paginated) {
    const products = await Product.find(filter).sort({ name: 1 });
    return res.json({ products: products.map(productView) });
  }

  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const [products, count] = await Promise.all([
    Product.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.set('Cache-Control', 'no-store');
  return res.json({ products: products.map(productView), count, page, pages: Math.max(1, Math.ceil(count / limit)), limit });
};

const getAdminProduct = async (req, res) => {
  const product = await Product.findOne({ slug: req.params.productId });
  if (!product) return res.status(404).json({ message: 'Cake not found.' });
  return res.json({ product: productView(product) });
};

const listAdminCategories = async (req, res) => {
  const [productCounts, savedCategories] = await Promise.all([
    Product.aggregate([
      { $group: { _id: '$category', total: { $sum: 1 }, available: { $sum: { $cond: ['$available', 1, 0] } } } },
    ]),
    Category.find().sort({ name: 1 }).select('name normalizedName').lean(),
  ]);
  const categoriesByName = new Map();
  productCounts.forEach((entry) => {
    const normalizedName = String(entry._id || '').trim().toLocaleLowerCase();
    if (normalizedName) categoriesByName.set(normalizedName, { name: entry._id, total: entry.total, available: entry.available });
  });
  savedCategories.forEach((category) => {
    const normalizedName = category.normalizedName || category.name.toLocaleLowerCase();
    if (!categoriesByName.has(normalizedName)) categoriesByName.set(normalizedName, { name: category.name, total: 0, available: 0 });
  });

  const search = String(req.query.search || '').trim().slice(0, 80).toLocaleLowerCase();
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
  const categories = [...categoriesByName.values()]
    .filter((category) => !search || category.name.toLocaleLowerCase().includes(search))
    .sort((a, b) => a.name.localeCompare(b.name));
  const count = categories.length;
  return res.json({ categories: categories.slice((page - 1) * limit, page * limit), count, page, pages: Math.max(1, Math.ceil(count / limit)), limit });
};

const createAdminCategory = async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name || name.length > 40) return res.status(400).json({ message: 'Enter a category name up to 40 characters.' });
  const normalizedName = name.toLocaleLowerCase();
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (await Category.exists({ normalizedName }) || await Product.exists({ category: { $regex: `^${escapedName}$`, $options: 'i' } })) {
    return res.status(409).json({ message: 'That category already exists.' });
  }
  try {
    const category = await Category.create({ name, normalizedName });
    return res.status(201).json({ message: 'Category added successfully.', category: { name: category.name, total: 0, available: 0 } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That category already exists.' });
    throw error;
  }
};

const updateProductStock = async (req, res) => {
  const stock = Number(req.body.stock);
  const lowStockThreshold = req.body.lowStockThreshold === undefined ? undefined : Number(req.body.lowStockThreshold);
  if (!Number.isInteger(stock) || stock < 0 || stock > 10000) {
    return res.status(400).json({ message: 'Stock must be a non-negative integer between 0 and 10,000.' });
  }
  if (lowStockThreshold !== undefined && (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0 || lowStockThreshold > 10000)) {
    return res.status(400).json({ message: 'Low-stock threshold must be a whole number between 0 and 10,000.' });
  }
  const updates = { stock, ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}) };
  if (stock === 0) updates.available = false;
  else if (req.body.available !== undefined) updates.available = Boolean(req.body.available);
  const product = await Product.findOneAndUpdate(
    { slug: req.params.productId },
    { $set: updates },
    { new: true }
  );
  if (!product) return res.status(404).json({ message: 'Cake not found.' });
  return res.json({ message: 'Stock updated successfully.', product: productView(product) });
};

const createProduct = async (req, res) => {
  const { value, error } = validateProduct(req.body, { creating: true });
  if (error) return res.status(400).json({ message: error });
  const baseSlug = value.slug;
  let suffix = 2;
  while (await Product.exists({ slug: value.slug })) {
    const ending = `-${suffix}`;
    value.slug = `${baseSlug.slice(0, 80 - ending.length)}${ending}`;
    suffix += 1;
  }
  try {
    const product = await Product.create(value);
    return res.status(201).json({ message: 'Cake added to catalogue.', product: productView(product) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'A cake with a similar name was added just now. Please save again.' });
    throw error;
  }
};

const updateProduct = async (req, res) => {
  const { value, error } = validateProduct(req.body);
  if (error) return res.status(400).json({ message: error });
  const product = await Product.findOneAndUpdate({ slug: req.params.productId }, value, { new: true, runValidators: true });
  if (!product) return res.status(404).json({ message: 'Cake not found.' });
  return res.json({ message: 'Cake details saved.', product: productView(product) });
};

module.exports = { listProducts, getProductDetail, listReviews, createReview, listAdminProducts, getAdminProduct, listAdminCategories, createAdminCategory, createProduct, updateProduct, updateProductStock };
