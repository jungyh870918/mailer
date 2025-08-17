// pages/api/naver-static.js
// 네이버 Static Map 프록시 (서버에서 키 보관 & CORS 처리)

const GEOCODE_URL = 'https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode';
const STATIC_URL = 'https://naveropenapi.apigw.ntruss.com/map-static/v2/raster';

// 기본 주소 (쿼리에 address 없으면 사용)
const DEFAULT_ADDRESS = '서울특별시 서초구 강남대로 359, 907호 (서초동, 대우도씨에빛2)';

// 간단한 CORS
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
            address = DEFAULT_ADDRESS,
            w = '640',
            h = '480',
            level = '16',
            // markers 파라미터를 클라이언트에서 직접 덮어쓸 수도 있게 허용 (선택)
            markers,
            // scale=2 요청 시 레티나 품질 향상 (선택)
            scale,
        } = req.query;

        const width = Math.min(Math.max(parseInt(w, 10) || 640, 100), 2048);
        const height = Math.min(Math.max(parseInt(h, 10) || 480, 100), 2048);
        const zoom = Math.min(Math.max(parseInt(level, 10) || 16, 0), 20);

        // 1) 주소 → 좌표
        const geoRes = await fetch(
            `${GEOCODE_URL}?query=${encodeURIComponent(String(address))}`,
            { headers: authHeaders() }
        );

        if (!geoRes.ok) {
            return res.status(400).json({ error: 'Geocode failed' });
        }

        const geo = await geoRes.json();
        const item = geo?.addresses?.[0];

        // 네이버는 x=lng, y=lat
        const lng = item?.x ?? '127.027621'; // fallback: 강남역 근처
        const lat = item?.y ?? '37.497942';

        // 2) Static Map 이미지 요청
        const params = new URLSearchParams({
            w: String(width),
            h: String(height),
            center: `${lng},${lat}`,
            level: String(zoom),
        });

        if (scale) params.set('scale', String(scale));

        // 기본 마커
        const markerParam =
            markers && String(markers).trim().length > 0
                ? String(markers)
                : `type:d|size:mid|pos:${lng} ${lat}|label:A`;
        // markers 파라미터는 여러 번 사용할 수 있으므로 그대로 추가
        // (여기서는 1개만 넣지만 필요하면 프론트에서 &markers=...를 여러 번 붙이면 됨)
        params.append('markers', markerParam);

        const imgRes = await fetch(`${STATIC_URL}?${params.toString()}`, {
            headers: authHeaders(),
        });

        if (!imgRes.ok) {
            return res.status(400).json({ error: 'Static map fetch failed' });
        }

        const arrayBuffer = await imgRes.arrayBuffer();

        // 이미지 응답
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300'); // 필요시 no-store로
        return res.status(200).send(Buffer.from(arrayBuffer));
    } catch (e) {
        console.error('naver-static error', e);
        return res.status(500).json({ error: '서버 오류' });
    }
}
