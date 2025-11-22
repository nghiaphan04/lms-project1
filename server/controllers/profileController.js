import { createUnsignedMintTx } from '../utils/BlockchainUtils.js';
import { createProfileMintTx } from '../utils/ProfileBlockchainUtils.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import { uploadToPinata } from '../utils/PinataUtils.js';
import fs from 'fs';

// Create profile transaction - identical structure to createCourseTx
export const createProfileTx = async (req, res) => {
    try {
        const { profileData, utxos, collateral, address } = req.body;
        const userId = req.auth?.userId;

        // Validate required fields
        if (!profileData || !utxos || !collateral || !address) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'User not found'
            });
        }

        // Only check minting limit if not premium
        if (!user.isPremium) {
            const now = new Date();
            if (user.lastProfileCreatedAt) {
                const diff = now - user.lastProfileCreatedAt;
                const ONE_MIN = 10 * 60 * 1000;
                if (diff < ONE_MIN) {
                    const timeLeft = ONE_MIN - diff;
                    return res.status(400).json({
                        success: false,
                        message: 'You can only mint a profile NFT every 1 minute. Please wait before minting another profile NFT.',
                        timeLeft: timeLeft
                    });
                }
            }
            // Update lastProfileCreatedAt
            user.lastProfileCreatedAt = now;
            await user.save();
        }

        // Validate address format
        if (!address.startsWith('addr_')) {
            return res.status(400).json({
                success: false,
                message: 'Invalid wallet address format'
            });
        }

        // Validate UTXO array
        if (!Array.isArray(utxos) || utxos.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid UTXOs'
            });
        }

        // Validate collateral
        if (!Array.isArray(collateral) || collateral.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid collateral'
            });
        }

        // Create unsigned transaction - sử dụng hàm mới chỉ lưu 3 thông tin cần thiết
        let txResult;
        try {
            // Sử dụng hàm mới createProfileMintTx thay vì createUnsignedMintTx
            txResult = await createProfileMintTx(
                utxos,
                address,
                collateral,
                address,
                profileData
            );
            
            // Kiểm tra kết quả trả về
            if (!txResult || !txResult.unsignedTx) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to create transaction'
                });
            }
            
            // Lấy unsignedTx từ kết quả
            const unsignedTx = txResult.unsignedTx;
            
            // Lưu thêm policyId và assetName để trả về client
            return res.status(200).json({
                success: true,
                unsignedTx,
                policyId: txResult.policyId,
                assetName: txResult.assetName
            });
        } catch (txError) {
            return res.status(400).json({
                success: false,
                message: 'Blockchain transaction failed. Please check your wallet, UTXOs, and try again.',
                error: txError.message || txError
            });
        }

    } catch (error) {
        console.error('Error in createProfileTx:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Add profile with NFT - identical structure to add-course
export const addProfile = async (req, res) => {
    try {
        console.log('addProfile called');
        console.log('Request body:', req.body);
        console.log('Request file:', req.file);
        console.log('Request headers:', req.headers);
        
        const userId = req.auth?.userId;
        console.log('User ID:', userId);
        
        const profileDataString = req.body.profileData;
        console.log('Profile data string:', profileDataString ? 'exists' : 'missing');
        
        if (!profileDataString) {
            return res.status(400).json({
                success: false,
                message: 'Profile data is required'
            });
        }

        // Parse profile data - chỉ lấy 3 thông tin cần thiết
        let profileData;
        try {
            profileData = JSON.parse(profileDataString);
            console.log('Parsed profile data:', profileData);
            
            // Đảm bảo chỉ có 3 thông tin cần thiết
            if (!profileData.cccd || !profileData.walletAddress) {
                return res.status(400).json({
                    success: false,
                    message: 'CCCD và địa chỉ ví là bắt buộc'
                });
            }
        } catch (parseError) {
            console.error('Error parsing profile data:', parseError);
            return res.status(400).json({
                success: false,
                message: 'Invalid profile data format'
            });
        }
        
        // Check if profile image is uploaded
        if (!req.file) {
            console.log('Profile image missing');
            return res.status(400).json({
                success: false,
                message: 'Profile image is required'
            });
        }
        
        console.log('Profile image found:', req.file.originalname);

        // Kiểm tra xem file có buffer hay path
        let result;
        if (req.file.buffer) {
            // Nếu là buffer (memory storage), upload trực tiếp buffer
            console.log('Uploading buffer to IPFS...');
            result = await uploadToPinata(req.file.buffer, `profile_${profileData.profileId || Date.now()}.png`);
        } else if (req.file.path) {
            // Nếu là path (disk storage), upload file path
            console.log('Uploading file path to IPFS...');
            result = await uploadToPinata(req.file.path, `profile_${profileData.profileId || Date.now()}.png`);
            // Xóa file tạm sau khi upload
            fs.unlinkSync(req.file.path);
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid file format'
            });
        }
        
        console.log('IPFS upload result:', result);
        
        // Tạo URL IPFS từ hash
        const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
        const ipfsHash = result.IpfsHash;

        // Chỉ lưu 3 thông tin cần thiết vào cơ sở dữ liệu
        const newProfile = new Profile({
            userId,
            profileId: profileData.profileId,
            // Chỉ lưu 3 thông tin cần thiết
            cccd: profileData.cccd, // Số CCCD
            imageUrl: ipfsUrl, // Đường dẫn ảnh IPFS
            imageHash: ipfsHash, // Hash IPFS của ảnh
            walletAddress: profileData.walletAddress, // Địa chỉ ví
            
            // Thông tin blockchain cần thiết
            txHash: profileData.txHash || '',
            policyId: profileData.policyId || '', // Thêm policyId
            assetName: profileData.assetName || '', // Thêm assetName
            hasNft: !!profileData.txHash,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Save profile to database
        await newProfile.save();

        // Update user with profile reference
        await User.findByIdAndUpdate(userId, { 
            profileId: newProfile._id,
            hasProfileNft: !!profileData.txHash
        });

        return res.status(201).json({
            success: true,
            message: 'Profile created successfully',
            profile: newProfile
        });

    } catch (error) {
        console.error('Error in addProfile:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Update profile without NFT
export const getProfileById = async (req, res) => {
    try {
        const profileId = req.params.id;
        
        const profile = await Profile.findOne({ profileId });
        
        if (!profile) {
            return res.status(404).json({ success: false, message: "Profile not found" });
        }
        
        res.json({ success: true, profile });
    } catch (error) {
        console.error('Error fetching profile by ID:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get profile of current user
export const getUserProfile = async (req, res) => {
    try {
        // Lấy userId từ params hoặc từ user object
        let userId = req.params.userId || req.user?._id;
        
        console.log('Attempting to fetch profile for user:', userId);
        console.log('User object from request:', req.user);
        console.log('Params from request:', req.params);
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized or missing userId" });
        }
        
        // Kiểm tra tất cả profile trong cơ sở dữ liệu
        const allProfiles = await Profile.find({});
        console.log(`Found ${allProfiles.length} profiles in database`);
        if (allProfiles.length > 0) {
            console.log('Sample profile:', allProfiles[0]);
        }
        
        // Tìm profile mới nhất của user dựa trên updatedAt
        const profiles = await Profile.find({ userId: userId }).sort({ updatedAt: -1 }).limit(1);
        console.log(`Found ${profiles.length} profiles for user ${userId}`);
        
        if (!profiles || profiles.length === 0) {
            // Thử tìm với userId là string
            const profilesByString = await Profile.find({ userId: userId.toString() }).sort({ updatedAt: -1 }).limit(1);
            console.log(`Found ${profilesByString.length} profiles for user ${userId.toString()} (as string)`);
            
            if (profilesByString.length > 0) {
                const profile = profilesByString[0];
                console.log('Found profile with string userId:', profile._id);
                return res.json({ success: true, profile });
            }
            
            return res.status(404).json({ success: false, message: "Profile not found" });
        }
        
        const profile = profiles[0];
        
        console.log('Found profile for user:', userId);
        console.log('Profile ID:', profile._id);
        console.log('Profile updated at:', profile.updatedAt);
        console.log('Profile image URL:', profile.imageUrl);
        
        // Kiểm tra xem có các profile khác của cùng user không
        const totalProfiles = await Profile.countDocuments({ userId: userId });
        if (totalProfiles > 1) {
            console.log(`Warning: Found ${totalProfiles} profiles for user ${userId}. Using the most recent one.`);
        }
        
        res.json({ success: true, profile });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update profile without NFT
export const updateProfile = async (req, res) => {
    try {
        const userId = req.auth?.userId;
        const profileDataString = req.body.profileData;
        
        if (!profileDataString) {
            return res.status(400).json({
                success: false,
                message: 'Profile data is required'
            });
        }

        // Parse profile data
        const profileData = JSON.parse(profileDataString);
        
        // Find existing profile
        let profile = await Profile.findOne({ userId });
        
        // Giữ nguyên URL ảnh cũ nếu không có ảnh mới
        let imageUrl = profile?.imageUrl;
        let imageHash = profile?.imageHash;

        // Upload new image if provided
        if (req.file) {
            console.log('Uploading new profile image to IPFS...');
            
            // Đọc file ảnh
            const fileBuffer = fs.readFileSync(req.file.path);
            
            // Upload ảnh lên IPFS qua Pinata
            const formData = new FormData();
            formData.append('file', fileBuffer, {
                filepath: req.file.originalname
            });
            
            const pinataResponse = await axios.post(
                'https://api.pinata.cloud/pinning/pinFileToIPFS',
                formData,
                {
                    maxBodyLength: Infinity,
                    headers: {
                        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`,
                        'pinata_api_key': process.env.PINATA_API_KEY,
                        'pinata_secret_api_key': process.env.PINATA_API_SECRET
                    }
                }
            );
            
            const result = pinataResponse.data;
            console.log('IPFS upload result:', result);
            
            // Tạo URL IPFS từ hash
            imageUrl = `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
            imageHash = result.IpfsHash;
            
            // Remove temporary file
            fs.unlinkSync(req.file.path);
        }

        // Create or update profile
        if (!profile) {
            // Tạo mới profile nếu chưa tồn tại
            profile = new Profile({
                userId,
                profileId: profileData.profileId,
                cccd: profileData.cccd || '',
                bio: profileData.bio || '',
                skills: profileData.skills || [],
                education: profileData.education || '',
                imageUrl, // URL ảnh IPFS để hiển thị
                imageHash, // Hash IPFS thuần túy của ảnh
                walletAddress: profileData.walletAddress || '',
                paypalEmail: profileData.paypalEmail || '',
                hasNft: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('Created new profile for user:', userId);
        } else {
            // Cập nhật profile hiện có
            profile.cccd = profileData.cccd || profile.cccd;
            profile.bio = profileData.bio || profile.bio;
            profile.skills = profileData.skills || profile.skills;
            profile.education = profileData.education || profile.education;
            profile.paypalEmail = profileData.paypalEmail || profile.paypalEmail;
            profile.walletAddress = profileData.walletAddress || profile.walletAddress;
            
            // Chỉ cập nhật ảnh nếu có ảnh mới
            if (req.file) {
                profile.imageUrl = imageUrl;
                profile.imageHash = imageHash;
            }
            
            profile.updatedAt = new Date();
            console.log('Updated existing profile for user:', userId);
        }

        // Save profile to database
        await profile.save();

        // Update user with profile reference
        await User.findByIdAndUpdate(userId, { 
            profileId: profile._id
        });

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            profile
        });

    } catch (error) {
        console.error('Error in updateProfile:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
