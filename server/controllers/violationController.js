import Violation from "../models/Violation.js";
import ViolationCounter from "../models/ViolationCounter.js";
import { CourseProgress } from "../models/CourseProgress.js";
import mongoose from "mongoose";

export const reportViolation = async (req, res) => {
    try {
        const { 
            studentId, 
            courseId, 
            testId, 
            violationType, 
            message,
            imageData,
            walletAddress,
            educatorId 
        } = req.body;

        if (!studentId || !courseId || !testId || !violationType || !imageData) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields for violation report' 
            });
        }

        // Nếu không có educatorId, tìm giáo viên từ khóa học
        let courseEducatorId = educatorId;
        
        if (!courseEducatorId) {
            try {
                const Course = mongoose.model('Course');
                const course = await Course.findById(courseId);
                if (course && course.educator) {
                    courseEducatorId = course.educator;
                    console.log(`Found educator ${courseEducatorId} for course ${courseId}`);
                }
            } catch (error) {
                console.error(`Error finding educator for course ${courseId}:`, error);
            }
        }

        // Tạo một testId duy nhất cho mỗi vi phạm dựa trên thời gian hiện tại
        const uniqueTestId = testId + "_" + Date.now().toString();
        console.log(`Creating new violation with unique testId: ${uniqueTestId}`);
        
        // Luôn tạo mới vi phạm thay vì cập nhật vi phạm cũ
        const violation = await Violation.create({
            studentId,
            walletAddress: walletAddress || "",
            courseId,
            educatorId: courseEducatorId || "",
            testId: uniqueTestId,
            violationType,
            message,
            imageData,
            timestamp: new Date()
        });
        
        console.log(`Created new violation with ID: ${violation._id}, wallet: ${walletAddress || 'not provided'}`);

        // Cập nhật số lần vi phạm trong ViolationCounter
        try {
            console.log(`Updating violation counter for studentId: ${studentId}, courseId: ${courseId}`);
            
            // Tìm hoặc tạo mới bản ghi đếm vi phạm
            let counter = await ViolationCounter.findOne({ 
                studentId, 
                courseId 
            });
            
            console.log('Existing counter:', counter);
            
            if (!counter) {
                // Nếu chưa có bản ghi, tạo mới với count = 1
                counter = new ViolationCounter({
                    studentId,
                    courseId,
                    count: 1,
                    isBlocked: false,
                    lastUpdated: new Date()
                });
                
                await counter.save();
                console.log('Created new violation counter:', counter);
            } else {
                // Nếu đã có bản ghi, tăng count lên 1
                counter.count += 1;
                counter.lastUpdated = new Date();
                
                // Nếu số lần vi phạm >= 2, đánh dấu là bị khóa
                if (counter.count >= 2) {
                    counter.isBlocked = true;
                }
                
                await counter.save();
                console.log('Updated existing violation counter:', counter);
            }
            
            console.log(`Successfully updated violation count for student ${studentId} in course ${courseId} to ${counter.count}`);
            
            // Cập nhật số lần vi phạm trong CourseProgress
            try {
                // Tìm CourseProgress của người dùng trong khóa học
                let progress = await CourseProgress.findOne({ userId: studentId, courseId });
                
                if (progress) {
                    // Nếu đã có CourseProgress, cập nhật trường violations
                    if (!progress.violations) {
                        progress.violations = {
                            count: 1,
                            isBlocked: counter.count >= 2,
                            lastUpdated: new Date(),
                            records: [{
                                timestamp: new Date(),
                                violationType,
                                message
                            }]
                        };
                    } else {
                        // Tăng count lên 1
                        progress.violations.count = (progress.violations.count || 0) + 1;
                        progress.violations.isBlocked = counter.count >= 2;
                        progress.violations.lastUpdated = new Date();
                        
                        // Thêm vi phạm mới vào records
                        if (!progress.violations.records) {
                            progress.violations.records = [];
                        }
                        
                        progress.violations.records.push({
                            timestamp: new Date(),
                            violationType,
                            message
                        });
                    }
                    
                    await progress.save();
                    console.log(`Updated violations in CourseProgress for student ${studentId} in course ${courseId}`);
                } else {
                    console.log(`CourseProgress not found for student ${studentId} in course ${courseId}`);
                }
            } catch (progressError) {
                console.error('Error updating violations in CourseProgress:', progressError);
                console.error('Error details:', progressError.stack);
                // Không trả về lỗi, vẫn tiếp tục trả về thông tin vi phạm
            }
        } catch (counterError) {
            console.error('Error updating violation counter:', counterError);
            console.error('Error details:', counterError.stack);
            // Không trả về lỗi, vẫn tiếp tục trả về thông tin vi phạm
        }

        return res.status(201).json({ 
            success: true, 
            violation: {
                _id: violation._id,
                violationType: violation.violationType,
                timestamp: violation.timestamp
            }
        });
    } catch (error) {
        console.error("Error reporting violation:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const getCourseViolations = async (req, res) => {
    try {
        const { courseId } = req.params;
        
        if (!courseId) {
            return res.status(400).json({ success: false, message: 'Course ID is required' });
        }

        const violations = await Violation.find({ courseId })
            .sort({ createdAt: -1 });
        
        console.log(`Found ${violations.length} violations for course ${courseId}`);

        return res.status(200).json({ success: true, violations });
    } catch (error) {
        console.error("Error fetching course violations:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const getStudentViolations = async (req, res) => {
    try {
        const { studentId } = req.params;
        
        if (!studentId) {
            return res.status(400).json({ success: false, message: 'Student ID is required' });
        }

        const violations = await Violation.find({ studentId })
            .populate({
                path: 'courseId',
                select: 'courseTitle'
            })
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, violations });
    } catch (error) {
        console.error("Error fetching student violations:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};


export const getAllViolations = async (req, res) => {
    try {
        const { educatorId } = req.query;
        
        // Nếu có educatorId trong query, lọc theo educatorId
        let filter = {};
        if (educatorId) {
            filter = { educatorId };
            console.log(`Filtering violations for educator: ${educatorId}`);
        }
        
        const violations = await Violation.find(filter)
            .populate({
                path: 'courseId',
                select: 'courseTitle educatorId courseDescription creatorAddress createdAt modules students'
            })
            .populate({
                path: 'studentId',
                select: 'name firstName email walletAddress'
            })
            .sort({ createdAt: -1 });
        
        console.log(`Found ${violations.length} violations for filter:`, filter);

        return res.status(200).json({ success: true, violations });
    } catch (error) {
        console.error("Error fetching all violations:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Đếm số lượng vi phạm của một sinh viên trong một khóa học
// Đồng bộ dữ liệu vi phạm giữa ViolationCounter và CourseProgress
export const syncViolationData = async (req, res) => {
    try {
        const { studentId, courseId } = req.body;
        
        if (!studentId || !courseId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID and Course ID are required'
            });
        }
        
        console.log(`Syncing violation data for student ${studentId} in course ${courseId}`);
        
        // Lấy dữ liệu từ ViolationCounter
        const counter = await ViolationCounter.findOne({
            studentId,
            courseId
        });
        
        // Lấy dữ liệu từ CourseProgress
        const progress = await CourseProgress.findOne({
            userId: studentId,
            courseId
        });
        
        if (!counter && !progress) {
            return res.status(404).json({
                success: false,
                message: 'No violation data found for this student in this course'
            });
        }
        
        // Lấy tất cả vi phạm của sinh viên trong khóa học
        const violations = await Violation.find({
            studentId,
            courseId
        }).sort({ timestamp: 1 });
        
        const violationCount = violations.length;
        const isBlocked = violationCount >= 2;
        
        // Cập nhật ViolationCounter
        if (counter) {
            counter.count = violationCount;
            counter.isBlocked = isBlocked;
            counter.lastUpdated = new Date();
            await counter.save();
            console.log(`Updated ViolationCounter: count=${violationCount}, isBlocked=${isBlocked}`);
        } else {
            const newCounter = new ViolationCounter({
                studentId,
                courseId,
                count: violationCount,
                isBlocked,
                lastUpdated: new Date()
            });
            await newCounter.save();
            console.log(`Created new ViolationCounter: count=${violationCount}, isBlocked=${isBlocked}`);
        }
        
        // Cập nhật CourseProgress
        if (progress) {
            // Tạo records từ các vi phạm
            const violationRecords = violations.map(v => ({
                timestamp: v.timestamp,
                violationType: v.violationType,
                message: v.message
            }));
            
            progress.violations = {
                count: violationCount,
                isBlocked,
                lastUpdated: new Date(),
                records: violationRecords
            };
            
            await progress.save();
            console.log(`Updated CourseProgress violations: count=${violationCount}, isBlocked=${isBlocked}`);
        } else {
            console.log(`CourseProgress not found for student ${studentId} in course ${courseId}`);
        }
        
        return res.status(200).json({
            success: true,
            message: 'Violation data synchronized successfully',
            count: violationCount,
            isBlocked
        });
    } catch (error) {
        console.error('Error syncing violation data:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

export const countViolations = async (req, res) => {
    try {
        const { studentId, courseId } = req.query;
        
        if (!studentId || !courseId) {
            return res.status(400).json({
                success: false,
                message: 'Student ID and Course ID are required'
            });
        }
        
        console.log(`Counting violations for student ${studentId} in course ${courseId}`);
        
        // Đầu tiên, kiểm tra trong CourseProgress
        const progress = await CourseProgress.findOne({
            userId: studentId,
            courseId
        });
        
        if (progress && progress.violations && progress.violations.count > 0) {
            console.log(`Found violations in CourseProgress for student ${studentId} in course ${courseId}: count=${progress.violations.count}, isBlocked=${progress.violations.isBlocked}`);
            return res.status(200).json({
                success: true,
                count: progress.violations.count,
                isBlocked: progress.violations.isBlocked,
                source: 'courseProgress'
            });
        }
        
        // Nếu không có trong CourseProgress, kiểm tra trong ViolationCounter
        const counter = await ViolationCounter.findOne({
            studentId,
            courseId
        });
        
        if (!counter) {
            // Nếu chưa có bản ghi, trả về count = 0
            console.log(`No violation counter found for student ${studentId} in course ${courseId}, returning count 0`);
            return res.status(200).json({
                success: true,
                count: 0,
                isBlocked: false,
                source: 'none'
            });
        }
        
        console.log(`Found violation counter for student ${studentId} in course ${courseId}: count=${counter.count}, isBlocked=${counter.isBlocked}`);
        
        return res.status(200).json({
            success: true,
            count: counter.count,
            isBlocked: counter.isBlocked,
            source: 'violationCounter'
        });
    } catch (error) {
        console.error('Error counting violations:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
