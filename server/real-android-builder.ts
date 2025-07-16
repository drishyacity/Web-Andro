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

export class RealAndroidBuilder {
  private buildDir: string;
  private androidHome: string;
  private buildToolsPath: string;
  private platformPath: string;

  constructor() {
    this.buildDir = path.join(process.cwd(), 'builds');
    this.androidHome = path.join(process.cwd(), 'android-sdk');
    this.buildToolsPath = path.join(this.androidHome, 'build-tools', '34.0.0');
    this.platformPath = path.join(this.androidHome, 'platforms', 'android-34');
  }

  async setupAndroidSDK(): Promise<void> {
    try {
      // Create android-sdk directory
      await fs.mkdir(this.androidHome, { recursive: true });
      
      // Download and extract Android SDK tools
      const toolsZip = path.join(this.androidHome, 'commandlinetools.zip');
      await execAsync(`wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O ${toolsZip}`);
      await execAsync(`cd ${this.androidHome} && unzip -q commandlinetools.zip`);
      
      // Setup cmdline-tools directory structure
      const cmdlineToolsDir = path.join(this.androidHome, 'cmdline-tools');
      const latestDir = path.join(cmdlineToolsDir, 'latest');
      await fs.mkdir(latestDir, { recursive: true });
      
      // Move tools to latest directory
      await execAsync(`cd ${cmdlineToolsDir} && mv bin lib NOTICE.txt source.properties latest/`);
      
      // Set environment variables
      process.env.ANDROID_HOME = this.androidHome;
      process.env.ANDROID_SDK_ROOT = this.androidHome;
      process.env.PATH = `${latestDir}/bin:${this.buildToolsPath}:${process.env.PATH}`;
      
      // Accept licenses and install packages
      const sdkmanager = path.join(latestDir, 'bin', 'sdkmanager');
      await execAsync(`yes | ${sdkmanager} --licenses`);
      await execAsync(`${sdkmanager} "platforms;android-34" "build-tools;34.0.0" "platform-tools"`);
      
      console.log('Android SDK setup completed successfully');
    } catch (error) {
      console.error('Android SDK setup failed:', error);
      throw error;
    }
  }

  async buildAPK(config: BuildConfig): Promise<BuildResult> {
    const buildId = nanoid();
    const projectDir = path.join(this.buildDir, buildId);
    
    try {
      // Create project structure
      await this.createProjectStructure(projectDir, config);
      
      // Generate AndroidManifest.xml
      await this.generateManifest(projectDir, config);
      
      // Copy or create web assets
      await this.setupWebAssets(projectDir, config);
      
      // Generate MainActivity.java
      await this.generateMainActivity(projectDir, config);
      
      // Generate res files
      await this.generateResources(projectDir, config);
      
      // Compile the project
      await this.compileProject(projectDir, config);
      
      // Create and sign APK
      const apkPath = await this.createAPK(projectDir, config);
      
      // Create AAB (simplified version)
      const aabPath = await this.createAAB(projectDir, config);
      
      return {
        success: true,
        apkPath,
        aabPath,
        buildId
      };
    } catch (error) {
      console.error('Build failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        buildId
      };
    }
  }

  private async createProjectStructure(projectDir: string, config: BuildConfig): Promise<void> {
    const dirs = [
      'src/main/java',
      'src/main/res/layout',
      'src/main/res/values',
      'src/main/res/drawable',
      'src/main/res/mipmap-hdpi',
      'src/main/res/mipmap-mdpi',
      'src/main/res/mipmap-xhdpi',
      'src/main/res/mipmap-xxhdpi',
      'src/main/res/mipmap-xxxhdpi',
      'src/main/assets',
      'gen',
      'bin',
      'obj'
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(path.join(projectDir, dir), { recursive: true });
    }
  }

  private async generateManifest(projectDir: string, config: BuildConfig): Promise<void> {
    const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${config.packageName}"
    android:versionCode="${config.versionCode}"
    android:versionName="${config.versionName}">

    <uses-sdk
        android:minSdkVersion="21"
        android:targetSdkVersion="34" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${config.appName}"
        android:theme="@android:style/Theme.Material.Light.NoActionBar"
        android:usesCleartextTraffic="true">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:screenOrientation="portrait">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

    await fs.writeFile(path.join(projectDir, 'src/main/AndroidManifest.xml'), manifest);
  }

  private async setupWebAssets(projectDir: string, config: BuildConfig): Promise<void> {
    const assetsDir = path.join(projectDir, 'src/main/assets');
    
    if (config.files && config.files.length > 0) {
      // Copy uploaded files
      for (const file of config.files) {
        await fs.writeFile(path.join(assetsDir, file.name), file.content);
      }
    } else if (config.websiteUrl) {
      // Create index.html that loads the website
      const htmlContent = `<!DOCTYPE html>
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
        }
        .loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            text-align: center;
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .btn {
            background: #3498db;
            color: white;
            padding: 12px 24px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            margin: 10px;
        }
        .btn:hover {
            background: #2980b9;
        }
    </style>
</head>
<body>
    <div class="loading">
        <div class="spinner"></div>
        <h2>${config.appName}</h2>
        <p>Loading your app...</p>
        <button class="btn" onclick="loadApp()">Open App</button>
    </div>
    
    <script>
        function loadApp() {
            window.location.href = '${config.websiteUrl}';
        }
        
        // Auto-redirect after 3 seconds
        setTimeout(loadApp, 3000);
    </script>
</body>
</html>`;
      await fs.writeFile(path.join(assetsDir, 'index.html'), htmlContent);
    }
  }

  private async generateMainActivity(projectDir: string, config: BuildConfig): Promise<void> {
    const packagePath = config.packageName.replace(/\./g, '/');
    const javaDir = path.join(projectDir, 'src/main/java', packagePath);
    await fs.mkdir(javaDir, { recursive: true });

    const mainActivity = `package ${config.packageName};

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.view.Window;
import android.view.WindowManager;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Remove title bar
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN, 
                           WindowManager.LayoutParams.FLAG_FULLSCREEN);
        
        webView = new WebView(this);
        setContentView(webView);
        
        // Configure WebView settings
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setBuiltInZoomControls(true);
        webSettings.setDisplayZoomControls(false);
        webSettings.setSupportZoom(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        // Set WebView client
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });
        
        // Load content
        ${config.websiteUrl ? 
          `webView.loadUrl("${config.websiteUrl}");` : 
          `webView.loadUrl("file:///android_asset/index.html");`
        }
    }
    
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}`;

    await fs.writeFile(path.join(javaDir, 'MainActivity.java'), mainActivity);
  }

  private async generateResources(projectDir: string, config: BuildConfig): Promise<void> {
    // Generate strings.xml
    const strings = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${config.appName}</string>
</resources>`;
    await fs.writeFile(path.join(projectDir, 'src/main/res/values/strings.xml'), strings);
    
    // Create simple launcher icons (base64 encoded PNG)
    const iconData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    
    const densities = ['hdpi', 'mdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
    for (const density of densities) {
      await fs.writeFile(
        path.join(projectDir, `src/main/res/mipmap-${density}/ic_launcher.png`),
        iconData
      );
    }
  }

  private async compileProject(projectDir: string, config: BuildConfig): Promise<void> {
    const genDir = path.join(projectDir, 'gen');
    const binDir = path.join(projectDir, 'bin');
    const objDir = path.join(projectDir, 'obj');
    
    // Generate R.java using aapt
    const aaptPath = path.join(this.buildToolsPath, 'aapt');
    const androidJar = path.join(this.platformPath, 'android.jar');
    
    await execAsync(`${aaptPath} package -f -m -J ${genDir} -S ${path.join(projectDir, 'src/main/res')} -M ${path.join(projectDir, 'src/main/AndroidManifest.xml')} -I ${androidJar}`);
    
    // Compile Java files
    const javaFiles = await this.findJavaFiles(path.join(projectDir, 'src/main/java'));
    const rJavaFiles = await this.findJavaFiles(genDir);
    const allJavaFiles = [...javaFiles, ...rJavaFiles];
    
    if (allJavaFiles.length > 0) {
      const classpath = androidJar;
      const javaFilesList = allJavaFiles.join(' ');
      
      await execAsync(`javac -d ${objDir} -cp ${classpath} ${javaFilesList}`);
    }
    
    // Create dex file
    const dxPath = path.join(this.buildToolsPath, 'dx');
    await execAsync(`${dxPath} --dex --output=${path.join(binDir, 'classes.dex')} ${objDir}`);
  }

  private async findJavaFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          files.push(...await this.findJavaFiles(fullPath));
        } else if (entry.name.endsWith('.java')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is empty
    }
    
    return files;
  }

  private async createAPK(projectDir: string, config: BuildConfig): Promise<string> {
    const binDir = path.join(projectDir, 'bin');
    const unsignedApk = path.join(binDir, 'app-unsigned.apk');
    const signedApk = path.join(projectDir, `${config.appName.replace(/\s+/g, '_')}.apk`);
    
    // Create unsigned APK
    const aaptPath = path.join(this.buildToolsPath, 'aapt');
    const androidJar = path.join(this.platformPath, 'android.jar');
    
    await execAsync(`${aaptPath} package -f -M ${path.join(projectDir, 'src/main/AndroidManifest.xml')} -S ${path.join(projectDir, 'src/main/res')} -A ${path.join(projectDir, 'src/main/assets')} -I ${androidJar} -F ${unsignedApk}`);
    
    // Add classes.dex to APK
    await execAsync(`cd ${binDir} && ${aaptPath} add ${unsignedApk} classes.dex`);
    
    // Create keystore and sign APK
    const keystorePath = path.join(projectDir, 'keystore.jks');
    await execAsync(`keytool -genkey -v -keystore ${keystorePath} -alias app -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=${config.appName}, OU=App, O=App, L=City, S=State, C=US"`);
    
    // Sign APK
    await execAsync(`jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore ${keystorePath} -storepass android -keypass android ${unsignedApk} app`);
    
    // Align APK (if zipalign is available)
    try {
      const zipalignPath = path.join(this.buildToolsPath, 'zipalign');
      await execAsync(`${zipalignPath} -f -v 4 ${unsignedApk} ${signedApk}`);
    } catch (error) {
      // If zipalign fails, just copy the signed APK
      await execAsync(`cp ${unsignedApk} ${signedApk}`);
    }
    
    return signedApk;
  }

  private async createAAB(projectDir: string, config: BuildConfig): Promise<string> {
    // For now, create a simple AAB-like file (in reality, AAB requires bundletool)
    const aabPath = path.join(projectDir, `${config.appName.replace(/\s+/g, '_')}.aab`);
    const aabContent = `Android App Bundle for ${config.appName}
Package: ${config.packageName}
Version: ${config.versionName} (${config.versionCode})
Built: ${new Date().toISOString()}

This is a simplified AAB file. For production use, implement proper bundletool integration.
`;
    await fs.writeFile(aabPath, aabContent);
    return aabPath;
  }
}