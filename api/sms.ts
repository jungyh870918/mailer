import type { VercelRequest, VercelResponse } from '@vercel/node';

function setCORS(res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    setCORS(res);

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { phone, message } = req.body || {};

        if (!phone || !/^010\d{7,8}$/.test(phone)) {
            return res.status(400).json({ error: '유효한 휴대폰 번호를 입력해주세요.' });
        }
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: '메시지를 입력해주세요.' });
        }

        // 외부 IP (선택)
        const ipData = await (await fetch('https://api.ipify.org?format=json')).json();

        // 알리고 전송
        const payload = new URLSearchParams({
            key: process.env.ALIGO_API_KEY || '',
            user_id: process.env.ALIGO_USER_ID || '',
            sender: process.env.ALIGO_SENDER_PHONE || '',
            receiver: String(phone),
            msg: String(message),
            msg_type: 'SMS',
            title: '알림',
        });

        const r = await fetch('https://apis.aligo.in/send/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
            body: payload,
        });
        const data = await r.json();

        if (String(data.result_code) === '1') {
            return res.json({ success: true, ip: ipData?.ip });
        }
        return res.status(500).json({ error: data?.message || '문자 전송 실패' });
    } catch (e: any) {
        console.error('❌ /api/sms error:', e);
        return res.status(500).json({ error: '서버 오류 발생' });
    }
}
