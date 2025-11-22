import mongoose from 'mongoose';

const violationCounterSchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true
    },
    courseId: {
        type: String,
        required: true
    },
    count: {
        type: Number,
        default: 0
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Tạo index phức hợp để đảm bảo mỗi cặp studentId-courseId là duy nhất
violationCounterSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

const ViolationCounter = mongoose.model('ViolationCounter', violationCounterSchema);

export default ViolationCounter;
