'use strict';

const { verifyToken } = require('../utils/jwt');

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
console.log("HEADERS:", req.headers);
console.log("AUTH:", req.headers.authorization);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    req.user = {
      id: decoded.id,
      phone: decoded.phone,
      email: decoded.email,
      role: decoded.role,
      tokenId: decoded.tokenId,
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
