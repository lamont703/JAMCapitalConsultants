import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const authController = {
    async register(req, res) {
        try {
            const { name, email, phone, password } = req.body;
            
            // Validate input
            if (!name || !email || !phone || !password) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'All fields are required' 
                });
            }

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Invalid email format' 
                });
            }

            // Password validation
            if (password.length < 6) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Password must be at least 6 characters long' 
                });
            }

            const cosmosService = req.app.locals.cosmosService;
            
            // Check if user already exists
            const existingUser = await cosmosService.getUserByEmail(email);
            if (existingUser) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'User with this email already exists' 
                });
            }

            // Hash password
            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Create user document
            const userData = {
                name: name.trim(),
                email: email.toLowerCase().trim(),
                phone: phone.trim(),
                password: hashedPassword,
                createdAt: new Date().toISOString(),
                isActive: true,
                role: 'user'
            };

            // Save user to CosmosDB
            const newUser = await cosmosService.createUser(userData);

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: newUser.id, 
                    email: newUser.email,
                    role: newUser.role 
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            // Remove password from response
            const { password: _, ...userResponse } = newUser;

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: userResponse,
                token: token
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Registration failed. Please try again.' 
            });
        }
    },

    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Validate input
            if (!email || !password) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Email and password are required' 
                });
            }

            const cosmosService = req.app.locals.cosmosService;

            // Find user by email
            const user = await cosmosService.getUserByEmail(email.toLowerCase().trim());
            if (!user) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Invalid email or password' 
                });
            }

            // Check if user is active
            if (!user.isActive) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Account is deactivated. Please contact support.' 
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({ 
                    success: false, 
                    error: 'Invalid email or password' 
                });
            }

            // Generate JWT token
            const token = jwt.sign(
                { 
                    userId: user.id, 
                    email: user.email,
                    role: user.role 
                },
                process.env.JWT_SECRET || 'your-secret-key',
                { expiresIn: '24h' }
            );

            // Update last login
            await cosmosService.updateUserLastLogin(user.id);

            // Remove password from response
            const { password: _, ...userResponse } = user;

            res.json({
                success: true,
                message: 'Login successful',
                user: userResponse,
                token: token
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ 
                success: false, 
                error: 'Login failed. Please try again.' 
            });
        }
    },

    async logout(req, res) {
        try {
            // In a more advanced setup, you might:
            // 1. Add the token to a blacklist in CosmosDB
            // 2. Log the logout event for security auditing
            // 3. Clear any server-side session data
            console.log('Logout request received');

            const token = req.headers.authorization?.replace('Bearer ', '');
            const cosmosService = req.app.locals.cosmosService;

            if (token && cosmosService) {
                // Optional: Log the logout event for security auditing
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    await cosmosService.logUserActivity(decoded.userId, 'logout', {
                        timestamp: new Date().toISOString(),
                        userAgent: req.headers['user-agent'],
                        ip: req.ip
                    });
                } catch (jwtError) {
                    // Token might be expired or invalid, but that's okay for logout
                    console.log('Token verification failed during logout (expected if expired)');
                }
            }

            console.log('Logout successful');
            res.json({
                success: true,
                message: 'Logged out successfully'
            });

        } catch (error) {
            console.error('Logout error:', error);
            // Even if there's an error, we should still return success
            // because the client will clear local storage anyway
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        }
    }
}; 