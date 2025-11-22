import { stringToHex, BlockfrostProvider, MeshTxBuilder, ForgeScript, Transaction } from '@meshsdk/core';
import CustomInitiator from './CustomInitiator.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Tạo giao dịch mint NFT cho profile với chỉ 3 thông tin cần thiết
 * @param {Array} utxos - UTXOs của người dùng
 * @param {String} changeAddress - Địa chỉ thay đổi
 * @param {Array} collateral - Collateral
 * @param {String} getAddress - Địa chỉ ví
 * @param {Object} profileData - Dữ liệu profile
 * @returns {Object} Giao dịch chưa ký
 */
async function createProfileMintTx(utxos, changeAddress, collateral, getAddress, profileData) {
    try {
        // Tạo asset name độc nhất cho profile
        const profileId = profileData.courseId || profileData.profileId || Date.now().toString();
        const shortProfileId = profileId.toString().substring(0, 2);
        const timestamp = Date.now().toString().substring(10, 13);
        const randomCode = Math.floor(100 + Math.random() * 900);
        
        // Kết hợp thành asset name ngắn và độc nhất cho profile
        const assetName = `P${shortProfileId}${timestamp}${randomCode}`;
        const assetNameHex = stringToHex(assetName);

        console.log('Generated profile asset name:', {
            assetName,
            length: assetName.length,
            hexLength: assetNameHex.length
        });

        // Create forging script with minter's address
        console.log('Creating forging script with address:', getAddress); 
        const forgingScript = ForgeScript.withOneSignature(getAddress);
    
        // Rút ngắn địa chỉ ví để không vượt quá 64 bytes trong metadata
        const shortAddress = getAddress.slice(0, 8) + '...' + getAddress.slice(-8);

        // Sử dụng hash IPFS từ profile data nếu có, hoặc dùng hash mặc định
        let ipfsHash = profileData.ipfsHash || profileData.imageHash || "bafkreiealuh6skgbomi77dczcpgacemtr3xxbctsjgvhecbqhx636gx7um";
        console.log('Profile image IPFS hash:', ipfsHash);
        
        // Kiểm tra độ dài của IPFS hash để đảm bảo không vượt quá giới hạn 64 bytes
        // Sử dụng một trong hai cách sau:
        // 1. Chỉ lưu hash không có tiền tố (ví sẽ tự động thêm ipfs://)
        // 2. Sử dụng gateway URL thay vì ipfs://
        
        // Chỉ sử dụng hash IPFS thuần túy để tránh vượt quá giới hạn 64 bytes của Cardano
        // Ví Cardano sẽ tự động thêm tiền tố ipfs:// khi hiển thị
        console.log('Using raw IPFS hash for metadata to avoid exceeding 64 bytes limit:', ipfsHash);
        
        const assetMetadata = {
            // Metadata cơ bản cho Eternal Wallet
            name: "Profile NFT",
            image: ipfsHash,  // Chỉ sử dụng hash IPFS thuần túy, không có tiền tố ipfs://
            mediaType: "image/png",
            
            // Chỉ lưu 3 thông tin cần thiết
            properties: {
                cccd: profileData.cccd || "",
                walletAddress: shortAddress,
                created: Math.floor(new Date().getTime() / 1000)
            },
            
            // CIP-721 metadata cho tiêu chuẩn Cardano
            "721": {
                [forgingScript.hash]: {
                    [assetName]: {
                        name: "Profile NFT",
                        image: ipfsHash,  // Chỉ lưu hash, không có tiền tố ipfs://
                        mediaType: "image/png",
                        cccd: profileData.cccd || "",
                        walletAddress: shortAddress,
                        created: String(Math.floor(new Date().getTime() / 1000))
                    }
                }
            }
        };

        console.log('Asset being minted:', {
            assetName,
            assetNameHex,
            metadata: assetMetadata
        });

        // Prepare asset for minting
        const asset = {
            assetName: assetNameHex,
            assetQuantity: '1',
            metadata: assetMetadata,
            label: '721',
            recipient: getAddress
        };

        // Create and build transaction
        const tx = new Transaction({ initiator: new CustomInitiator(changeAddress, collateral, utxos) });
        tx.mintAsset(
            forgingScript,
            asset
        );

        const unsignedTx = await tx.build();
        
        // Trả về thông tin giao dịch
        return {
            success: true,
            unsignedTx,
            metadata: assetMetadata,
            policyId: forgingScript, // Trả về policyId giống như trong các phần khác của dự án
            assetName: assetName
        };
        
    } catch (error) {
        console.error('Error in createProfileMintTx:', error);
        throw error;
    }
}

export { createProfileMintTx };
