// Local static previews use the Express backend on port 5000. The dedicated
// storefront preview on port 5001 calls that backend directly.
// For an S3 hosted frontend, replace the public-site fallback with the deployed
// backend URL, including '/api', e.g. 'https://your-backend.example.com/api'.
const localPage = ['localhost', '127.0.0.1', ''].includes(window.location.hostname);
const sameLocalBackend = localPage && (!window.location.port || window.location.port === '5000');
const localApi = sameLocalBackend ? '/api' : `http://${window.location.hostname || 'localhost'}:5000/api`;
window.CAKES_API_BASE = window.CAKES_API_BASE || (localPage ? localApi : '/api');
window.CAKES_API_BASE = window.CAKES_API_BASE.replace(/\/+$/, '');
