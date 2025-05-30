import User from '../models/User.js';

const adminAuth = {
    async requireAdmin(req, res, next) {
        try {
            // Check if user is authenticated (should be done by auth middleware first)
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            // Check if user has admin role
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }

            if (user.role !== 'admin' && user.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            console.log(`✅ Admin access granted for user: ${user.email}`);
            next();

        } catch (error) {
            console.error('❌ Admin auth error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during authorization'
            });
        }
    }
};

export default adminAuth;