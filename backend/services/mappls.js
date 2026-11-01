const cache = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

async function mapplsJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Mappls location service returned ${response.status}.`);
  return response.json();
}

async function getPinLocation(pinCode) {
  const cached = cache.get(pinCode);
  if (cached && cached.expiresAt > Date.now()) return cached.eloc;
  const key = process.env.MAPPLS_API_KEY;
  if (!key) throw new Error('Automatic delivery distance is not configured. Please contact the bakery.');
  const url = new URL('https://search.mappls.com/search/address/geocode');
  url.searchParams.set('address', `${pinCode}, Karnataka, India`);
  url.searchParams.set('podFilter', 'pincode');
  url.searchParams.set('itemCount', '1');
  url.searchParams.set('access_token', key);
  const data = await mapplsJson(url);
  const result = Array.isArray(data.copResults) ? data.copResults[0] : data.copResults;
  const eloc = result?.eLoc || result?.eloc;
  if (!eloc || String(result.pincode || '') !== pinCode) throw new Error(`We couldn't locate PIN code ${pinCode}. Check the PIN code or contact the bakery.`);
  cache.set(pinCode, { eloc, expiresAt: Date.now() + CACHE_TTL_MS });
  return eloc;
}

exports.drivingDistanceKm = async (originPin, destinationPin) => {
  if (originPin === destinationPin) return 0;
  const key = process.env.MAPPLS_API_KEY;
  if (!key) throw new Error('Automatic delivery distance is not configured. Please contact the bakery.');
  const [origin, destination] = await Promise.all([getPinLocation(originPin), getPinLocation(destinationPin)]);
  const routeUrl = new URL(`https://route.mappls.com/route/direction/route_adv/driving/${encodeURIComponent(origin)};${encodeURIComponent(destination)}`);
  routeUrl.searchParams.set('access_token', key);
  const data = await mapplsJson(routeUrl);
  const meters = Number(data.routes?.[0]?.distance);
  if (data.code !== 'Ok' || !Number.isFinite(meters) || meters < 0) throw new Error('We could not calculate a driving route to this PIN code. Please contact the bakery.');
  return Math.round((meters / 1000) * 10) / 10;
};
