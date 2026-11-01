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
  const oldPath = mapping ? normalizePath(mapping.from) : '';
  const image = mapping && normalizePath(row.image) === oldPath ? mapping.to : row.image;
  const images = Array.isArray(row.images)
    ? row.images.map((value) => mapping && normalizePath(value) === oldPath ? mapping.to : value)
    : row.images;
  // Older MongoDB records called stock images bakery photography. Keep the
  // visible credit honest while the stored product path remains unchanged.
  const usesCatalogPhoto = /^\/?public\/images\/products\//.test(normalizePath(image));
  const photoCredit = usesCatalogPhoto && row.photoCredit === 'Cakes of Paradise Bakery'
    ? 'Stock photograph'
    : row.photoCredit;

  if (!mapping && photoCredit === row.photoCredit) return row;

  return { ...row, image, ...(images ? { images } : {}), ...(photoCredit ? { photoCredit } : {}) };
}

module.exports = { withCategoryMatchedImage };
