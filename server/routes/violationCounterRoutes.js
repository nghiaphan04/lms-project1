import express from 'express';
import { 
    incrementViolationCount, 
    getViolationCount, 
    recalculateViolationCount, 
    resetViolationCount 
} from '../controllers/violationCounterController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

// Route để tăng số lần vi phạm
router.post('/increment', isAuthenticated, incrementViolationCount);

// Route để lấy số lần vi phạm
router.get('/count', isAuthenticated, getViolationCount);

// Route để tính lại số lần vi phạm từ bảng Violation
router.post('/recalculate', isAuthenticated, recalculateViolationCount);

// Route để reset số lần vi phạm
router.post('/reset', isAuthenticated, resetViolationCount);

export default router;
