import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function zipDirectory(sourceDir, outPath) {
    try {
        // Use zip command on macOS/Linux
        await execAsync(`cd "${sourceDir}" && zip -r "${outPath}" .`);
        console.log('Created zip file successfully');
    } catch (error) {
        console.error('Error creating zip file:', error.message);
        throw error;
    }
}

async function updateExtension() {
    try {
        // Paths
        const frontendDir = path.join(__dirname, '..', '..', 'frontend');
        const extensionBuildDir = path.join(frontendDir, '.output', 'chrome-mv3');
        const downloadDir = path.join(__dirname, '..', 'public', 'downloads');
        const targetPath = path.join(downloadDir, 'aidao-manager.zip');

        // Ensure download directory exists
        await fs.mkdir(downloadDir, { recursive: true });

        // Check if extension build directory exists
        try {
            await fs.access(extensionBuildDir);
        } catch (error) {
            console.log('Extension build not found. Building extension...');
            // Navigate to frontend directory and run build
            await execAsync('cd "' + frontendDir + '" && npm run build');
        }

        // Create zip file from the build directory
        console.log('Creating extension package...');
        await zipDirectory(extensionBuildDir, targetPath);
        
        console.log('Extension package updated successfully!');
    } catch (error) {
        console.error('Error updating extension package:', error.message);
        process.exit(1);
    }
}

// Run the update
updateExtension(); 