process.env.JWT_SECRET ||= 'test-jwt-secret-not-for-production-use';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-not-for-production-use';
process.env.JWT_EXPIRES_IN ||= '1h';
process.env.JWT_REFRESH_EXPIRES_IN ||= '7d';
process.env.CORS_ORIGIN ||= 'http://localhost:5173';
