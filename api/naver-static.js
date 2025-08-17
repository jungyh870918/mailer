// pages/api/naver-static.js
const GEOCODE_URL = 'https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode';
const STATIC_URL = 'https://naveropenapi.apigw.ntruss.com/map-static/v2/raster';

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function authHeaders() {
    return {
        'X-NCP-APIGW-API-KEY-ID': process.env.NAVER_MAP_CLIENT_ID || '',
        'X-NCP-APIGW-API-KEY': process.env.NAVER_MAP_CLIENT_SECRET || '',
    };
}

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const {
            lat, lng,          // 둘 다 있으면 좌표 우선
            address,           // 없으면 지오코딩
            w = '720', h = '480',
            level = '17',
            scale = '2',       // 레티나 선명도
            markers            // 커스텀 마커 원하면 직접 전달 가능
        } = req.query;

        const width = Math.min(Math.max(parseInt(w, 10) || 720, 100), 2048);
        const height = Math.min(Math.max(parseInt(h, 10) || 480, 100), 2048);
        const zoom = Math.min(Math.max(parseInt(level, 10) || 17, 0), 20);

        let centerLat = null;
        let centerLng = null;

        if (lat && lng) {
            centerLat = String(lat);
            centerLng = String(lng);
        } else {
            const DEFAULT_ADDRESS = '서울특별시 서초구 강남대로 359, 907호 (서초동, 대우도씨에빛2)';
            const q = address || DEFAULT_ADDRESS;
            const geoRes = await fetch(`${GEOCODE_URL}?query=${encodeURIComponent(q)}`, {
                headers: authHeaders(),
            });
            if (!geoRes.ok) return res.status(400).json({ error: 'Geocode failed' });
            const geo = await geoRes.json();
            const item = geo?.addresses?.[0];
            // 네이버: x=lng, y=lat
            centerLng = item?.x ?? '127.027621';
            centerLat = item?.y ?? '37.497942';
        }

        const params = new URLSearchParams({
            w: String(width),
            h: String(height),
            center: `${centerLng},${centerLat}`,
            level: String(zoom),
            scale: String(scale),
        });

        const markerParam =
            markers && String(markers).trim()
                ? String(markers)
                : `type:d|size:mid|pos:${centerLng} ${centerLat}|label:A`;
        params.append('markers', markerParam);

        const imgRes = await fetch(`${STATIC_URL}?${params.toString()}`, {
            headers: authHeaders(),
        });
        if (!imgRes.ok) return res.status(400).json({ error: 'Static map fetch failed' });

        const buf = Buffer.from(await imgRes.arrayBuffer());
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.status(200).send(buf);
    } catch (e) {
        console.error('naver-static error', e);
        return res.status(500).json({ error: '서버 오류' });
    }
}
