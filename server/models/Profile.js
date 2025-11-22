import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
    // Thông tin cơ bản
    userId: {
        type: String,
        required: true,
        description: 'Clerk user ID'
    },
    profileId: {
        type: String,
        required: true,
        unique: true
    },
    
    // Chỉ lưu 3 thông tin cần thiết
    cccd: {
        type: String,
        required: true,
    },
    imageUrl: {
        type: String,
        required: true,
        description: 'URL IPFS theo định dạng ipfs://hash'
    },
    imageGatewayUrl: {
        type: String,
        description: 'URL gateway Pinata để hiển thị trên web'
    },
    imageHash: {
        type: String,
        description: 'Hash IPFS thuần túy của ảnh'
    },
    walletAddress: {
        type: String,
        required: true,
    },
    
    txHash: {
        type: String,
        default: '',
    },
   
    assetName: {
        type: String,
        default: '',
    },
    hasNft: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const Profile = mongoose.model('Profile', profileSchema);

export default Profile;
