import express from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { requireActiveSubscription, requireDisputeLetterCredit, logUsageAfterSuccess } from '../middleware/subscriptionMiddleware.js';

const router = express.Router();

// Generate dispute letter with subscription checking
router.post('/generate-letter', 
    authenticateToken, 
    requireActiveSubscription, 
    requireDisputeLetterCredit,
    logUsageAfterSuccess('dispute_letter'),
    async (req, res) => {
        try {
            const {
                disputeType,
                selectedItems,
                userInfo,
                customInstructions
            } = req.body;

            // Validate required fields
            if (!disputeType || !selectedItems || !userInfo) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: disputeType, selectedItems, userInfo'
                });
            }

            // Here you would integrate with your AI letter generation service
            // For now, this is a placeholder response
            const generatedLetter = {
                id: `letter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                disputeType,
                content: `Generated dispute letter for ${disputeType}...`,
                createdAt: new Date().toISOString(),
                userId: req.user.id,
                status: 'generated'
            };

            // TODO: Save letter to database
            // await letterService.saveLetter(generatedLetter);

            res.json({
                success: true,
                message: 'Dispute letter generated successfully',
                data: {
                    letter: generatedLetter,
                    remainingCredits: req.subscription.remainingCredits,
                    currentUsage: req.subscription.currentUsage
                }
            });

        } catch (error) {
            console.error('Error generating dispute letter:', error);
            res.status(500).json({
                success: false,
                message: 'Error generating dispute letter'
            });
        }
    }
);

// Get user's generated letters
router.get('/letters', authenticateToken, requireActiveSubscription, async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 10, offset = 0 } = req.query;

        // TODO: Implement letter retrieval from database
        // For now, return placeholder data
        const letters = [
            {
                id: 'letter_sample_1',
                disputeType: 'inaccurate_info',
                content: 'Sample dispute letter content...',
                createdAt: new Date().toISOString(),
                status: 'generated'
            }
        ];

        res.json({
            success: true,
            data: {
                letters,
                total: letters.length,
                hasMore: false
            }
        });

    } catch (error) {
        console.error('Error retrieving letters:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving letters'
        });
    }
});

// Download letter as PDF
router.get('/letters/:letterId/download', authenticateToken, requireActiveSubscription, async (req, res) => {
    try {
        const { letterId } = req.params;
        const userId = req.user.id;

        // TODO: Implement letter retrieval and PDF generation
        // For now, return placeholder response
        res.json({
            success: true,
            message: 'Letter download would be generated here',
            data: {
                letterId,
                downloadUrl: `/api/dispute/letters/${letterId}/pdf`
            }
        });

    } catch (error) {
        console.error('Error downloading letter:', error);
        res.status(500).json({
            success: false,
            message: 'Error downloading letter'
        });
    }
});

// Check if user can generate dispute letters
router.get('/can-generate', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Use the subscription middleware endpoint
        const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/api/subscriptions/can-generate-dispute`, {
            headers: {
                'Authorization': req.headers.authorization
            }
        });

        if (response.ok) {
            const result = await response.json();
            res.json(result);
        } else {
            throw new Error('Failed to check generation capability');
        }

    } catch (error) {
        console.error('Error checking generation capability:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking dispute generation capability'
        });
    }
});

export default router; 