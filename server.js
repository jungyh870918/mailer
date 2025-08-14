// sms-server.js
import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import cors from 'cors';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

// ✅ __dirname 대체 (ESM 환경)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 로드
dotenv.config();

const corsOptions = {
  origin: '*',
  methods: ['POST'],
  credentials: true,
};

const app = express();
app.use(bodyParser.json());
app.use(cors(corsOptions));

const PORT = process.env.PORT || 4000;

// ✅ 정적 파일 서빙
// public 폴더 안에 index.html, assets/, css/, js/ 등을 넣으면
// http://localhost:4000/ 으로 바로 접근 가능
app.use(express.static(path.join(__dirname, 'public')));

export const mailer = nodemailer.createTransport({
  host: process.env.SES_SMTP_ENDPOINT,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SES_SMTP_USER,
    pass: process.env.SES_SMTP_PASSWORD,
  },
});

// 문자 전송 함수
async function sendSMS({ phone, message, sender, msg_type = 'SMS', title = '' }) {
  console.log('📨 알리고 API 호출 직전:', phone);
  const res = await fetch('https://apis.aligo.in/send/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({
      key: process.env.ALIGO_API_KEY,
      user_id: process.env.ALIGO_USER_ID,
      sender,
      receiver: phone,
      msg: message,
      msg_type,
      title,
    }),
  });

  const data = await res.json();
  console.log('📨 응답 결과:', data);
  return {
    success: data.result_code === '1',
    error: data.message,
  };
}

app.post('/mail', async (req, res) => {
  try {
    const { email, subject, text } = req.body;

    await mailer.sendMail({
      from: 'support@medipaysolution.co.kr',
      to: 'medipaysolution@naver.com',
      subject: '테스트 메일(API)',
      html: '<p>SES API 경유</p>',
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('❌ 서버 오류:', err);
    return res.status(500).json({ error: '서버 오류 발생' });
  }
});

// 문자 전송 라우터
app.post('/sms', async (req, res) => {
  try {
    const { phone, message } = req.body;

    if (!phone || !/^010\d{7,8}$/.test(phone)) {
      return res.status(400).json({ error: '유효한 휴대폰 번호를 입력해주세요.' });
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '메시지를 입력해주세요.' });
    }

    // 외부 IP 확인
    const ipRes = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipRes.json();
    console.log('🌐 외부 IP:', ipData.ip);

    const result = await sendSMS({
      phone,
      message,
      sender: process.env.ALIGO_SENDER_PHONE,
      msg_type: 'SMS',
      title: '알림',
    });

    if (result.success) {
      return res.json({ success: true, ip: ipData.ip });
    } else {
      return res.status(500).json({ error: result.error || '문자 전송 실패' });
    }
  } catch (err) {
    console.error('❌ 서버 오류:', err);
    return res.status(500).json({ error: '서버 오류 발생' });
  }
});

// ✅ SPA 지원 (public/index.html 기본 제공)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 문자 전송 서버 실행 중: http://localhost:${PORT}`);
});
