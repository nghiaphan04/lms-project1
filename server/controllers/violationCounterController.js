import ViolationCounter from '../models/ViolationCounter.js';
import Violation from '../models/Violation.js';

// Tăng số lần vi phạm của người dùng trong một khóa học
export const incrementViolationCount = async (req, res) => {
    try {
        const { studentId, courseId } = req.body;

        if (!studentId || !courseId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID and Course ID are required'
            });
        }

        // Tìm hoặc tạo mới bản ghi đếm vi phạm
        let counter = await ViolationCounter.findOne({ studentId, courseId });
        
        if (!counter) {
            // Nếu chưa có bản ghi, tạo mới với count = 1
            counter = await ViolationCounter.create({
                studentId,
                courseId,
                count: 1,
                isBlocked: false,
                lastUpdated: new Date()
            });
        } else {
            // Nếu đã có bản ghi, tăng count lên 1
            counter.count += 1;
            counter.lastUpdated = new Date();
            
            // Nếu số lần vi phạm >= 2, đánh dấu là bị khóa
            if (counter.count >= 2) {
                counter.isBlocked = true;
            }
            
            await counter.save();
        }

        return res.status(200).json({
            success: true,
            counter,
            message: `Violation count updated to ${counter.count}`
        });
    } catch (error) {
        console.error('Error incrementing violation count:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Lấy số lần vi phạm của người dùng trong một khóa học
export const getViolationCount = async (req, res) => {
    try {
        const { studentId, courseId } = req.query;

        if (!studentId || !courseId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID and Course ID are required'
            });
        }

        // Tìm bản ghi đếm vi phạm
        const counter = await ViolationCounter.findOne({ studentId, courseId });
        
        if (!counter) {
            // Nếu chưa có bản ghi, trả về count = 0
            return res.status(200).json({
                success: true,
                count: 0,
                isBlocked: false
            });
        }

        return res.status(200).json({
            success: true,
            count: counter.count,
            isBlocked: counter.isBlocked
        });
    } catch (error) {
        console.error('Error getting violation count:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Đếm lại số lần vi phạm dựa trên dữ liệu trong bảng Violation
export const recalculateViolationCount = async (req, res) => {
    try {
        const { studentId, courseId } = req.body;

        if (!studentId || !courseId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID and Course ID are required'
            });
        }

        // Đếm số lượng vi phạm trong bảng Violation
        const violationCount = await Violation.countDocuments({ studentId, courseId });
        
        // Cập nhật hoặc tạo mới bản ghi đếm vi phạm
        let counter = await ViolationCounter.findOne({ studentId, courseId });
        
        if (!counter) {
            counter = await ViolationCounter.create({
                studentId,
                courseId,
                count: violationCount,
                isBlocked: violationCount >= 2,
                lastUpdated: new Date()
            });
        } else {
            counter.count = violationCount;
            counter.isBlocked = violationCount >= 2;
            counter.lastUpdated = new Date();
            await counter.save();
        }

        return res.status(200).json({
            success: true,
            counter,
            message: `Violation count recalculated to ${counter.count}`
        });
    } catch (error) {
        console.error('Error recalculating violation count:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Reset số lần vi phạm của người dùng trong một khóa học
export const resetViolationCount = async (req, res) => {
    try {
        const { studentId, courseId } = req.body;

        if (!studentId || !courseId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID and Course ID are required'
            });
        }

        // Tìm bản ghi đếm vi phạm
        const counter = await ViolationCounter.findOne({ studentId, courseId });
        
        if (!counter) {
            return res.status(404).json({
                success: false,
                message: 'Violation counter not found'
            });
        }

        // Reset count về 0 và isBlocked về false
        counter.count = 0;
        counter.isBlocked = false;
        counter.lastUpdated = new Date();
        await counter.save();

        return res.status(200).json({
            success: true,
            counter,
            message: 'Violation count reset to 0'
        });
    } catch (error) {
        console.error('Error resetting violation count:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
