const adminAuth = {
    async requireAdmin(req, res, next) {
        try {
            console.log('🔍 === ADMIN AUTH DEBUG START ===');
            console.log('🔍 Request headers:', req.headers);
            console.log('🔍 Authorization header:', req.headers.authorization);
            
            // Check if user is authenticated (should be done by auth middleware first)
            if (!req.user) {
                console.log('❌ No req.user found - authentication failed');
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required'
                });
            }

            console.log('🔍 req.user object:', JSON.stringify(req.user, null, 2));
            console.log('🔍 req.user.email:', req.user.email);
            console.log('🔍 req.user.userId:', req.user.userId);
            console.log('🔍 req.user.role:', req.user.role);

            // Get CosmosDB service
            const cosmosService = req.app.locals.cosmosService;
            console.log('🔍 CosmosDB service available:', !!cosmosService);
            
            // Check if user has admin role using CosmosDB
            console.log('🔍 Looking up user by email:', req.user.email);
            const user = await cosmosService.getUserByEmail(req.user.email);
            
            if (!user) {
                console.log('❌ User not found in CosmosDB:', req.user.email);
                console.log('🔍 Available users in database:');
                // Let's see what users exist
                try {
                    const allUsers = await cosmosService.getAllUsers(); // You might need to implement this
                    console.log('🔍 All users:', allUsers.map(u => ({ email: u.email, role: u.role })));
                } catch (e) {
                    console.log('🔍 Could not fetch all users:', e.message);
                }
                
                return res.status(401).json({
                    success: false,
                    message: 'User not found'
                });
            }

            console.log('👤 User found in database:');
            console.log('   - Email:', user.email);
            console.log('   - Role:', user.role);
            console.log('   - ID:', user.id);
            console.log('   - Full user object:', JSON.stringify(user, null, 2));

            if (user.role !== 'admin' && user.role !== 'super_admin') {
                console.log('❌ Access denied - User role is:', user.role);
                console.log('❌ Expected roles: admin or super_admin');
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            console.log(`✅ Admin access granted for user: ${user.email}`);
            console.log('🔍 === ADMIN AUTH DEBUG END ===');
            next();

        } catch (error) {
            console.error('❌ Admin auth error:', error);
            console.error('❌ Error stack:', error.stack);
            res.status(500).json({
                success: false,
                message: 'Internal server error during authorization'
            });
        }
    }
};

export default adminAuth;