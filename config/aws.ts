import dotenv from 'dotenv';
dotenv.config();

export const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

export const transcribeConfig = {
  LanguageCode: process.env.TRANSCRIBE_LANGUAGE_CODE || 'en-US',
  MediaEncoding: 'pcm',
  MediaSampleRateHertz: 16000,
};
