/**
 * Migration Script: Add Role Field to Existing Users
 * 
 * This script adds a 'role' field to all existing user documents in CosmosDB.
 * It sets the default role to 'user' for all existing users.
 * 
 * To make a user an admin, you can run:
 * await updateUserRole('user_email@example.com', 'admin');
 */

import { CosmosService } from '../services/cosmosService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class RoleMigration {
    constructor() {
        this.cosmosService = new CosmosService();
    }

    async initialize() {
        console.log('🚀 Starting Role Migration...');
        await this.cosmosService.initialize();
        console.log('✅ CosmosDB connection established');
    }

    async migrateAllUsers() {
        try {
            console.log('📋 Fetching all users...');
            
            // Get all users
            const query = 'SELECT * FROM c WHERE c.type = @type';
            const parameters = [{ name: '@type', value: 'user' }];
            const users = await this.cosmosService.queryDocuments(query, parameters);
            
            console.log(`📊 Found ${users.length} users to migrate`);

            let migratedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            for (const user of users) {
                try {
                    if (user.role) {
                        console.log(`⏭️ Skipping ${user.email} - already has role: ${user.role}`);
                        skippedCount++;
                        continue;
                    }

                    // Add role field
                    const updateData = {
                        role: 'user',
                        updatedAt: new Date().toISOString()
                    };

                    await this.cosmosService.updateDocument(user.id, 'user', updateData);
                    console.log(`✅ Migrated ${user.email} - added role: user`);
                    migratedCount++;

                } catch (error) {
                    console.error(`❌ Error migrating user ${user.email}:`, error.message);
                    errorCount++;
                }
            }

            console.log('\n📊 Migration Summary:');
            console.log(`✅ Migrated: ${migratedCount} users`);
            console.log(`⏭️ Skipped: ${skippedCount} users (already had role)`);
            console.log(`❌ Errors: ${errorCount} users`);
            console.log('🎉 Migration completed!');

            return {
                total: users.length,
                migrated: migratedCount,
                skipped: skippedCount,
                errors: errorCount
            };

        } catch (error) {
            console.error('❌ Migration failed:', error);
            throw error;
        }
    }

    async updateUserRole(email, newRole) {
        try {
            console.log(`🔄 Updating role for ${email} to ${newRole}...`);

            const user = await this.cosmosService.getUserByEmail(email);
            if (!user) {
                throw new Error(`User not found: ${email}`);
            }

            const updateData = {
                role: newRole,
                updatedAt: new Date().toISOString()
            };

            await this.cosmosService.updateDocument(user.id, 'user', updateData);
            console.log(`✅ Updated ${email} role to: ${newRole}`);

            return { success: true, message: `Role updated to ${newRole}` };

        } catch (error) {
            console.error(`❌ Error updating role for ${email}:`, error.message);
            throw error;
        }
    }

    async listUserRoles() {
        try {
            console.log('📋 Listing all user roles...');
            
            const query = 'SELECT c.email, c.role, c.name FROM c WHERE c.type = @type ORDER BY c.email';
            const parameters = [{ name: '@type', value: 'user' }];
            const users = await this.cosmosService.queryDocuments(query, parameters);

            console.log('\n👥 User Roles:');
            console.log('─'.repeat(60));
            users.forEach(user => {
                const role = user.role || 'NO ROLE';
                console.log(`${user.email.padEnd(35)} | ${role.padEnd(10)} | ${user.name}`);
            });
            console.log('─'.repeat(60));
            console.log(`Total users: ${users.length}`);

            return users;

        } catch (error) {
            console.error('❌ Error listing user roles:', error);
            throw error;
        }
    }
}

// CLI functions for easy use
async function runMigration() {
    const migration = new RoleMigration();
    await migration.initialize();
    return await migration.migrateAllUsers();
}

async function updateUserRole(email, role) {
    const migration = new RoleMigration();
    await migration.initialize();
    return await migration.updateUserRole(email, role);
}

async function listUserRoles() {
    const migration = new RoleMigration();
    await migration.initialize();
    return await migration.listUserRoles();
}

// Export functions for use in other scripts
export { RoleMigration, runMigration, updateUserRole, listUserRoles };

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const command = process.argv[2];
    const email = process.argv[3];
    const role = process.argv[4];

    try {
        switch (command) {
            case 'migrate':
                await runMigration();
                break;
            
            case 'update-role':
                if (!email || !role) {
                    console.error('Usage: node migrate-add-roles.js update-role <email> <role>');
                    process.exit(1);
                }
                await updateUserRole(email, role);
                break;
            
            case 'list':
                await listUserRoles();
                break;
            
            case 'make-admin':
                if (!email) {
                    console.error('Usage: node migrate-add-roles.js make-admin <email>');
                    process.exit(1);
                }
                await updateUserRole(email, 'admin');
                break;
            
            default:
                console.log('Available commands:');
                console.log('  migrate              - Add role field to all users');
                console.log('  list                 - List all users and their roles');
                console.log('  update-role <email> <role> - Update specific user role');
                console.log('  make-admin <email>   - Make user an admin');
                console.log('\nExamples:');
                console.log('  node migrate-add-roles.js migrate');
                console.log('  node migrate-add-roles.js make-admin lamont703@gmail.com');
                console.log('  node migrate-add-roles.js list');
                break;
        }
    } catch (error) {
        console.error('❌ Command failed:', error.message);
        process.exit(1);
    }
} 