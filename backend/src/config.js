import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT || 5000),
  mock: (process.env.MOCK ?? 'true').toLowerCase() !== 'false',
  mlUrl: process.env.ML_URL || 'http://localhost:8000',
};
