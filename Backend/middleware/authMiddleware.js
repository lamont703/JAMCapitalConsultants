import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const authMiddleware = {
    authenticateToken: (req, res, next) => {
        console.log('🔍 === AUTH MIDDLEWARE DEBUG START ===');
        
        const authHeader = req.headers['authorization'];
        console.log('🔍 Auth header:', authHeader);
        
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        console.log('🔍 Extracted token:', token ? `${token.substring(0, 20)}...` : 'null');

        if (!token) {
            console.log('❌ No token provided');
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) {
                console.log('❌ JWT verification failed:', err.message);
                return res.status(403).json({
                    success: false,
                    error: 'Invalid or expired token'
                });
            }

            console.log('✅ JWT verified successfully');
            console.log('🔍 Decoded user object:', JSON.stringify(user, null, 2));
            
            req.user = user;
            console.log('🔍 === AUTH MIDDLEWARE DEBUG END ===');
            next();
        });
    },
    
    verifyToken: (req, res, next) => {
        // Same function with different name for consistency
        return authMiddleware.authenticateToken(req, res, next);
    }
};

// Export the function directly for named import
export const authenticateToken = authMiddleware.authenticateToken;
export const verifyToken = authMiddleware.verifyToken;

// Export the object as default
export default authMiddleware;