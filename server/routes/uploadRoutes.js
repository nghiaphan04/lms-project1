import express from 'express';
import { uploadToIPFS } from '../controllers/uploadController.js';
import upload from '../configs/multer.js';
import { clerkMiddleware } from '@clerk/express';

const router = express.Router();

// Upload file to IPFS
router.post('/ipfs', clerkMiddleware(), upload.single('profileImage'), uploadToIPFS);

export default router;
