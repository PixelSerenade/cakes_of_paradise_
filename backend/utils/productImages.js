const LEGACY_PRODUCT_IMAGES = new Map([
  ['classic-chocolate-birthday', {
    from: '/images/cakes/chocolate-truffle.jpg',
    to: '/public/images/products/birthday/classic-chocolate-birthday.jpg',
  }],
]);

const normalizePath = (value) => String(value || '').replace(/^\/+/, '/');

function withCategoryMatchedImage(product) {
  if (!product) return product;
  const row = typeof product.toObject === 'function' ? product.toObject() : product;
  const mapping = LEGACY_PRODUCT_IMAGES.get(row.slug || row.id);
  if (!mapping) return row;

  const oldPath = normalizePath(mapping.from);
  const nextPath = mapping.to;
  const image = normalizePath(row.image) === oldPath ? nextPath : row.image;
  const images = Array.isArray(row.images)
    ? row.images.map((value) => normalizePath(value) === oldPath ? nextPath : value)
    : row.images;

  return { ...row, image, ...(images ? { images } : {}) };
}

module.exports = { withCategoryMatchedImage };
