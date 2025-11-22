import express from 'express';
import { createProfileTx, addProfile, updateProfile, getUserProfile } from '../controllers/profileController.js';
import upload from '../configs/multer.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// Create profile transaction for NFT minting - no auth middleware like original API
router.post('/create-profile-tx', createProfileTx);

// Add profile with NFT - no auth middleware like original API
router.post('/create-profile-nft', upload.single('profileImage'), addProfile);

// Update profile without NFT - no auth middleware like original API
router.post('/update-profile', upload.single('profileImage'), updateProfile);

// Get profile of current user - yêu cầu xác thực
router.get('/user/current', isAuthenticated, getUserProfile);

// Get profile by userId - không yêu cầu xác thực
router.get('/user/:userId', getUserProfile);

export default router;
