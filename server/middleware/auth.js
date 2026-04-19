import jwt from 'jsonwebtoken';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET 未设置，生产环境不允许使用默认密钥。请在 .env 中配置 JWT_SECRET');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET || 'deskhub-teamboard-secret';

/**
 * requireAuth — 验证 Bearer token，设置 req.role / req.user / req.auth
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    req.role = payload.role;
    req.user = payload.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

/**
 * requireRole — 在 requireAuth 基础上检查角色
 * 用法: requireRole('admin', 'tester')
 */
export function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.auth) {
      return requireAuth(req, res, () => {
        if (!allowed.includes(req.role)) {
          return res.status(403).json({ error: `角色 ${req.role} 无权执行此操作` });
        }
        next();
      });
    }
    if (!allowed.includes(req.role)) {
      return res.status(403).json({ error: `角色 ${req.role} 无权执行此操作` });
    }
    next();
  };
}

export { JWT_SECRET };
