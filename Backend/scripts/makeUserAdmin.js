import { CosmosService } from '../services/cosmosService.js';
import dotenv from 'dotenv';

dotenv.config();

async function makeUserAdmin(email) {
    try {
        const cosmosService = new CosmosService();
        await cosmosService.initialize();
        
        // Find the user
        const user = await cosmosService.getUserByEmail(email);
        if (!user) {
            console.log('❌ User not found:', email);
            return;
        }
        
        console.log('👤 Current user role:', user.role);
        
        // Update user role to admin
        await cosmosService.updateDocument(user.id, 'user', {
            role: 'admin',
            updatedAt: new Date().toISOString()
        });
        
        console.log('✅ User role updated to admin for:', email);
        
        // Verify the update
        const updatedUser = await cosmosService.getUserByEmail(email);
        console.log('🔍 Verified new role:', updatedUser.role);
        
    } catch (error) {
        console.error('❌ Error updating user role:', error);
    }
}

// Run the script
makeUserAdmin('lamont703@gmail.com');
