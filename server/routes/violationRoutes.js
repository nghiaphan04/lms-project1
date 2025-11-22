import express from 'express';
import { 
    reportViolation, 
    getCourseViolations, 
    getStudentViolations, 
    getAllViolations,
    countViolations,
    syncViolationData 
} from '../controllers/violationController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = express.Router();

router.post('/report', reportViolation);

router.get('/course/:courseId', isAuthenticated, getCourseViolations);

router.get('/student/:studentId', isAuthenticated, getStudentViolations);

router.get('/all', getAllViolations);

// Route để đếm số lượng vi phạm của sinh viên trong khóa học
router.get('/count', isAuthenticated, countViolations);

// Route để đồng bộ dữ liệu vi phạm giữa ViolationCounter và CourseProgress
router.post('/sync', isAuthenticated, syncViolationData);

export default router;
