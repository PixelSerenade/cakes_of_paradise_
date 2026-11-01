const LEGACY_PRODUCT_IMAGES = new Map([
  ['classic-chocolate-birthday', {
    from: '/images/cakes/chocolate-truffle.jpg',
    to: '/public/images/products/birthday/classic-chocolate-birthday.jpg',
  }],
]);

const normalizePath = (value) => String(value || '').replace(/^\/+/, '/');

function bustLocalImageCache(value) {
  const url = String(value || '');
  if (!url || !/^\/?(?:public\/)?images\//.test(url)) return url;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}v=20261101-real`;
}

function withCategoryMatchedImage(product) {
  if (!product) return product;
  const row = typeof product.toObject === 'function' ? product.toObject() : product;
  const mapping = LEGACY_PRODUCT_IMAGES.get(row.slug || row.id);
  const oldPath = mapping ? normalizePath(mapping.from) : '';
  const imagePath = mapping && normalizePath(row.image) === oldPath ? mapping.to : row.image;
  const image = bustLocalImageCache(imagePath);
  const images = Array.isArray(row.images)
    ? row.images.map((value) => bustLocalImageCache(mapping && normalizePath(value) === oldPath ? mapping.to : value))
    : row.images;
  // Older MongoDB records called stock images bakery photography. Keep the
  // visible credit honest while the stored product path remains unchanged.
  const usesCatalogPhoto = /^\/?public\/images\/products\//.test(normalizePath(image));
  const photoCredit = usesCatalogPhoto && row.photoCredit === 'Cakes of Paradise Bakery'
    ? 'Stock photograph'
    : row.photoCredit;

  if (!mapping && photoCredit === row.photoCredit && image === row.image && images === row.images) return row;

  return { ...row, image, ...(images ? { images } : {}), ...(photoCredit ? { photoCredit } : {}) };
}

module.exports = { withCategoryMatchedImage };
