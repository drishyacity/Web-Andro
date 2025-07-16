import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { nanoid } from 'nanoid';

const execAsync = promisify(exec);

export interface BuildConfig {
  appName: string;
  packageName: string;
  versionCode: number;
  versionName: string;
  websiteUrl?: string;
  files?: Array<{ name: string; content: Buffer }>;
}

export interface BuildResult {
  success: boolean;
  apkPath?: string;
  aabPath?: string;
  error?: string;
  buildId: string;
}

export class CordovaBuilder {
  private buildDir: string;
  private cordovaInstalled: boolean = false;

  constructor() {
    this.buildDir = path.join(process.cwd(), 'builds');
  }

  async setupCordova(): Promise<void> {
    try {
      // Check if cordova is already installed
      try {
        await execAsync('cordova --version');
        this.cordovaInstalled = true;
        console.log('Cordova is already installed');
        return;
      } catch (error) {
        // Cordova not installed, proceed with installation
      }

      // Install Cordova globally
      await execAsync('npm install -g cordova');
      this.cordovaInstalled = true;
      console.log('Cordova installed successfully');
    } catch (error) {
      console.error('Failed to install Cordova:', error);
      throw error;
    }
  }

  async buildAPK(config: BuildConfig): Promise<BuildResult> {
    const buildId = nanoid();
    const projectDir = path.join(this.buildDir, buildId);
    
    try {
      // Setup Cordova if not already done
      if (!this.cordovaInstalled) {
        await this.setupCordova();
      }

      // Create Cordova project
      await execAsync(`cordova create ${projectDir} ${config.packageName} "${config.appName}"`);
      
      // Navigate to project directory and add Android platform
      process.chdir(projectDir);
      await execAsync('cordova platform add android');
      
      // Configure the app
      await this.configureApp(projectDir, config);
      
      // Copy web assets
      await this.copyWebAssets(projectDir, config);
      
      // Build the APK
      await execAsync('cordova build android');
      
      // Find the generated APK
      const apkPath = await this.findGeneratedAPK(projectDir);
      
      // Create AAB (for now, just copy the APK with different extension)
      const aabPath = apkPath.replace('.apk', '.aab');
      await execAsync(`cp "${apkPath}" "${aabPath}"`);
      
      // Return to original directory
      process.chdir(process.cwd());
      
      return {
        success: true,
        apkPath,
        aabPath,
        buildId
      };
    } catch (error) {
      console.error('Cordova build failed:', error);
      // Return to original directory on error
      try {
        process.chdir(process.cwd());
      } catch (e) {
        // Ignore chdir errors
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        buildId
      };
    }
  }

  private async configureApp(projectDir: string, config: BuildConfig): Promise<void> {
    // Update config.xml
    const configPath = path.join(projectDir, 'config.xml');
    let configContent = await fs.readFile(configPath, 'utf8');
    
    // Replace default values
    configContent = configContent.replace(
      /<name>.*?<\/name>/,
      `<name>${config.appName}</name>`
    );
    
    configContent = configContent.replace(
      /id=".*?"/,
      `id="${config.packageName}"`
    );
    
    configContent = configContent.replace(
      /version=".*?"/,
      `version="${config.versionName}"`
    );
    
    // Add permissions
    const permissions = `
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    `;
    
    configContent = configContent.replace(
      '</widget>',
      `${permissions}</widget>`
    );
    
    await fs.writeFile(configPath, configContent);
  }

  private async copyWebAssets(projectDir: string, config: BuildConfig): Promise<void> {
    const wwwDir = path.join(projectDir, 'www');
    
    // Clear default www content
    await execAsync(`rm -rf ${wwwDir}/*`);
    
    if (config.files && config.files.length > 0) {
      // Copy uploaded files
      for (const file of config.files) {
        await fs.writeFile(path.join(wwwDir, file.name), file.content);
      }
      
      // Ensure there's an index.html
      const indexExists = config.files.some(f => f.name === 'index.html');
      if (!indexExists) {
        await this.createDefaultIndex(wwwDir, config);
      }
    } else if (config.websiteUrl) {
      // Create index.html that loads the website
      await this.createWebsiteIndex(wwwDir, config);
    } else {
      // Create default index.html
      await this.createDefaultIndex(wwwDir, config);
    }
  }

  private async createDefaultIndex(wwwDir: string, config: BuildConfig): Promise<void> {
    const indexContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>${config.appName}</title>
    <style>
        body { 
            margin: 0; 
            padding: 20px; 
            font-family: Arial, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .container {
            text-align: center;
            max-width: 400px;
        }
        h1 {
            font-size: 2.5em;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        p {
            font-size: 1.2em;
            margin-bottom: 30px;
            opacity: 0.9;
        }
        .version {
            font-size: 0.9em;
            opacity: 0.7;
            margin-top: 40px;
        }
        .feature {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            margin: 10px 0;
            border-radius: 8px;
            backdrop-filter: blur(10px);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${config.appName}</h1>
        <p>Welcome to your Android app!</p>
        
        <div class="feature">
            <h3>📱 Native Android App</h3>
            <p>Built with Apache Cordova</p>
        </div>
        
        <div class="feature">
            <h3>🌐 Web Technology</h3>
            <p>HTML, CSS, and JavaScript</p>
        </div>
        
        <div class="feature">
            <h3>🚀 Ready to Use</h3>
            <p>Install and run on any Android device</p>
        </div>
        
        <div class="version">
            Version ${config.versionName} (${config.versionCode})
        </div>
    </div>
    
    <script>
        // App initialization
        document.addEventListener('deviceready', function() {
            console.log('${config.appName} is ready!');
        });
        
        // Web fallback
        if (typeof cordova === 'undefined') {
            console.log('Running in web mode');
        }
    </script>
</body>
</html>`;
    
    await fs.writeFile(path.join(wwwDir, 'index.html'), indexContent);
  }

  private async createWebsiteIndex(wwwDir: string, config: BuildConfig): Promise<void> {
    const indexContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>${config.appName}</title>
    <style>
        body { 
            margin: 0; 
            padding: 0; 
            font-family: Arial, sans-serif; 
            background: #f5f5f5;
            height: 100vh;
            overflow: hidden;
        }
        .loading {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            color: white;
            transition: opacity 0.5s ease;
        }
        .spinner {
            border: 4px solid rgba(255,255,255,0.3);
            border-top: 4px solid white;
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        iframe {
            width: 100%;
            height: 100vh;
            border: none;
            display: none;
        }
        .error {
            color: #ff6b6b;
            text-align: center;
            padding: 20px;
            display: none;
        }
    </style>
</head>
<body>
    <div class="loading" id="loading">
        <div class="spinner"></div>
        <h2>${config.appName}</h2>
        <p>Loading...</p>
    </div>
    
    <iframe id="website" src="${config.websiteUrl}"></iframe>
    
    <div class="error" id="error">
        <h3>Unable to load website</h3>
        <p>Please check your internet connection and try again.</p>
        <button onclick="reload()">Retry</button>
    </div>
    
    <script>
        const iframe = document.getElementById('website');
        const loading = document.getElementById('loading');
        const error = document.getElementById('error');
        
        iframe.onload = function() {
            loading.style.display = 'none';
            iframe.style.display = 'block';
        };
        
        iframe.onerror = function() {
            loading.style.display = 'none';
            error.style.display = 'block';
        };
        
        function reload() {
            error.style.display = 'none';
            loading.style.display = 'flex';
            iframe.src = iframe.src;
        }
        
        // Timeout fallback
        setTimeout(function() {
            if (loading.style.display !== 'none') {
                loading.style.display = 'none';
                iframe.style.display = 'block';
            }
        }, 10000);
    </script>
</body>
</html>`;
    
    await fs.writeFile(path.join(wwwDir, 'index.html'), indexContent);
  }

  private async findGeneratedAPK(projectDir: string): Promise<string> {
    const platformsDir = path.join(projectDir, 'platforms', 'android');
    
    // Common APK locations in Cordova projects
    const possiblePaths = [
      path.join(platformsDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
      path.join(platformsDir, 'build', 'outputs', 'apk', 'debug', 'android-debug.apk'),
      path.join(platformsDir, 'ant-build', 'MainActivity-debug.apk'),
      path.join(platformsDir, 'bin', 'MainActivity-debug.apk')
    ];
    
    for (const apkPath of possiblePaths) {
      try {
        await fs.access(apkPath);
        return apkPath;
      } catch (error) {
        // File doesn't exist, try next path
      }
    }
    
    throw new Error('Generated APK not found in expected locations');
  }
}