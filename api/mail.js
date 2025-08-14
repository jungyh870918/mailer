import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SES_SMTP_ENDPOINT,
    port: 587,
    secure: false,
    auth: { user: process.env.SES_SMTP_USER, pass: process.env.SES_SMTP_PASSWORD },
});

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    console.log('mail request', req.body);
    try {
        const { email, subject, text } = req.body || {};
        await transporter.sendMail({
            from: 'support@medipaysolution.co.kr',
            to: email || 'medipaysolution@naver.com',
            subject: subject || '테스트 메일(API)',
            html: text ? `<p>${text}</p>` : '<p>SES API 경유</p>'
        });
        res.json({ success: true });
    } catch (e) {
        console.error('mail error', e);
        res.status(500).json({ error: '서버 오류' });
    }
}
