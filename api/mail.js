// api/mail.js
import nodemailer from 'nodemailer';

const FROM = process.env.MAIL_FROM || 'support@medipaysolution.co.kr'; // SES 검증 From
const TO = process.env.MAIL_TO || 'medipaysolution@naver.com';         // 실제 수신처(고정)

// 서버리스에서 매 호출마다 새 커넥션을 피하려 전역에 생성
const transporter = nodemailer.createTransport({
    host: process.env.SES_SMTP_ENDPOINT, // 예: email-smtp.ap-northeast-2.amazonaws.com
    port: 587,
    secure: false, // STARTTLS
    auth: {
        user: process.env.SES_SMTP_USER,
        pass: process.env.SES_SMTP_PASSWORD,
    },
    tls: { minVersion: 'TLSv1.2', servername: process.env.SES_SMTP_ENDPOINT },
    // logger: true,
    // debug: true,
});

// 간단한 CORS
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { email, subject, text } = body;

        // SMTP 연결/인증 확인
        await transporter.verify();

        // 항상 네이버 사서함으로 발송, 클라이언트 email은 Reply-To로만 사용
        const info = await transporter.sendMail({
            from: `"MEDIPAY SOLUTION" <${FROM}>`,
            to: TO,
            subject: subject || '테스트 메일(API)',
            html: text ? `<p>${text}</p>` : '<p>SES API 경유</p>',
            replyTo: (typeof email === 'string' && email.includes('@')) ? email : undefined,
            envelope: { from: FROM, to: TO },
        });

        console.log('SMTP response:', info.response);
        console.log('accepted:', info.accepted, 'rejected:', info.rejected);
        console.log('messageId:', info.messageId);

        return res.status(200).json({ success: true, messageId: info.messageId });
    } catch (e) {
        console.error('mail error', e);
        return res.status(500).json({ error: '서버 오류' });
    }
}
