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
  minSdkVersion: number;
  targetSdkVersion: number;
  iconPath?: string;
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

export class AndroidBuilder {
  private buildDir: string;
  private sdkPath: string;

  constructor() {
    this.buildDir = path.join(process.cwd(), 'builds');
    this.sdkPath = path.join(process.cwd(), 'android-sdk');
  }

  async setupSDK(): Promise<void> {
    try {
      // Download Android SDK command line tools
      const sdkToolsUrl = 'https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip';
      const sdkToolsPath = path.join(this.sdkPath, 'cmdline-tools.zip');
      
      await fs.mkdir(this.sdkPath, { recursive: true });
      
      // Download SDK tools
      await execAsync(`wget -O ${sdkToolsPath} ${sdkToolsUrl}`);
      await execAsync(`cd ${this.sdkPath} && unzip -q cmdline-tools.zip`);
      
      // Set up SDK directory structure
      await fs.mkdir(path.join(this.sdkPath, 'cmdline-tools', 'latest'), { recursive: true });
      await execAsync(`cd ${this.sdkPath} && mv cmdline-tools/bin cmdline-tools/lib cmdline-tools/NOTICE.txt cmdline-tools/source.properties cmdline-tools/latest/`);
      
      // Set environment variables
      process.env.ANDROID_SDK_ROOT = this.sdkPath;
      process.env.ANDROID_HOME = this.sdkPath;
      process.env.PATH = `${this.sdkPath}/cmdline-tools/latest/bin:${this.sdkPath}/platform-tools:${process.env.PATH}`;
      
      // Accept licenses and install required packages
      await execAsync(`yes | ${this.sdkPath}/cmdline-tools/latest/bin/sdkmanager --licenses`);
      await execAsync(`${this.sdkPath}/cmdline-tools/latest/bin/sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"`);
      
      console.log('Android SDK setup completed');
    } catch (error) {
      console.error('SDK setup failed:', error);
      throw error;
    }
  }

  async buildAPK(config: BuildConfig): Promise<BuildResult> {
    const buildId = nanoid();
    const projectDir = path.join(this.buildDir, buildId);
    
    try {
      // Create project structure
      await this.createProjectStructure(projectDir, config);
      
      // Generate Android manifest
      await this.generateManifest(projectDir, config);
      
      // Copy web assets
      await this.copyWebAssets(projectDir, config);
      
      // Generate Java/Kotlin code
      await this.generateMainActivity(projectDir, config);
      
      // Build APK
      await this.compileAndBuild(projectDir, config);
      
      // Sign APK
      await this.signAPK(projectDir, buildId);
      
      const apkPath = path.join(projectDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
      const aabPath = path.join(projectDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
      
      return {
        success: true,
        apkPath: apkPath,
        aabPath: aabPath,
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
      'app/src/main/java',
      'app/src/main/res/layout',
      'app/src/main/res/values',
      'app/src/main/res/mipmap-hdpi',
      'app/src/main/res/mipmap-mdpi',
      'app/src/main/res/mipmap-xhdpi',
      'app/src/main/res/mipmap-xxhdpi',
      'app/src/main/res/mipmap-xxxhdpi',
      'app/src/main/assets'
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

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="${config.appName}"
        android:theme="@android:style/Theme.Material.Light.NoActionBar">
        
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

    await fs.writeFile(path.join(projectDir, 'app/src/main/AndroidManifest.xml'), manifest);
  }

  private async copyWebAssets(projectDir: string, config: BuildConfig): Promise<void> {
    const assetsDir = path.join(projectDir, 'app/src/main/assets');
    
    if (config.files && config.files.length > 0) {
      // Copy uploaded files
      for (const file of config.files) {
        await fs.writeFile(path.join(assetsDir, file.name), file.content);
      }
    } else if (config.websiteUrl) {
      // Create a simple HTML file that redirects to the website
      const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.appName}</title>
</head>
<body>
    <script>
        window.location.href = '${config.websiteUrl}';
    </script>
</body>
</html>`;
      await fs.writeFile(path.join(assetsDir, 'index.html'), htmlContent);
    }
  }

  private async generateMainActivity(projectDir: string, config: BuildConfig): Promise<void> {
    const packagePath = config.packageName.replace(/\./g, '/');
    const activityDir = path.join(projectDir, 'app/src/main/java', packagePath);
    await fs.mkdir(activityDir, { recursive: true });

    const mainActivity = `package ${config.packageName};

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        webView = new WebView(this);
        setContentView(webView);
        
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setBuiltInZoomControls(true);
        webSettings.setDisplayZoomControls(false);
        
        webView.setWebViewClient(new WebViewClient());
        
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

    await fs.writeFile(path.join(activityDir, 'MainActivity.java'), mainActivity);
  }

  private async compileAndBuild(projectDir: string, config: BuildConfig): Promise<void> {
    // Generate build.gradle files
    const appBuildGradle = `plugins {
    id 'com.android.application'
}

android {
    compileSdk 34
    
    defaultConfig {
        applicationId "${config.packageName}"
        minSdk ${config.minSdkVersion}
        targetSdk ${config.targetSdkVersion}
        versionCode ${config.versionCode}
        versionName "${config.versionName}"
    }
    
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}`;

    const rootBuildGradle = `buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.1.0'
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}`;

    const gradleProperties = `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true`;

    await fs.writeFile(path.join(projectDir, 'app/build.gradle'), appBuildGradle);
    await fs.writeFile(path.join(projectDir, 'build.gradle'), rootBuildGradle);
    await fs.writeFile(path.join(projectDir, 'gradle.properties'), gradleProperties);
    
    // Create default app icon
    await this.createDefaultIcon(projectDir);
    
    // Build the project
    await execAsync(`cd ${projectDir} && gradle assembleRelease bundleRelease`);
  }

  private async signAPK(projectDir: string, buildId: string): Promise<void> {
    // Generate keystore if not exists
    const keystorePath = path.join(projectDir, 'app.keystore');
    await execAsync(`keytool -genkey -v -keystore ${keystorePath} -alias app -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=WebApp, OU=WebApp, O=WebApp, L=City, S=State, C=US"`);
    
    // Sign APK
    const apkPath = path.join(projectDir, 'app/build/outputs/apk/release/app-release-unsigned.apk');
    const signedApkPath = path.join(projectDir, 'app/build/outputs/apk/release/app-release.apk');
    
    await execAsync(`jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore ${keystorePath} -storepass android -keypass android ${apkPath} app`);
    await execAsync(`mv ${apkPath} ${signedApkPath}`);
  }

  private async createDefaultIcon(projectDir: string): Promise<void> {
    // Create a simple SVG icon and convert to PNG for different densities
    const svgIcon = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="8" fill="#4F46E5"/>
      <path d="M24 12L32 20H28V32H20V20H16L24 12Z" fill="white"/>
    </svg>`;
    
    const densities = [
      { folder: 'mipmap-mdpi', size: '48x48' },
      { folder: 'mipmap-hdpi', size: '72x72' },
      { folder: 'mipmap-xhdpi', size: '96x96' },
      { folder: 'mipmap-xxhdpi', size: '144x144' },
      { folder: 'mipmap-xxxhdpi', size: '192x192' }
    ];
    
    for (const density of densities) {
      const iconPath = path.join(projectDir, 'app/src/main/res', density.folder, 'ic_launcher.png');
      // For now, just create a placeholder file - in production you'd convert SVG to PNG
      await fs.writeFile(iconPath, Buffer.from('PNG placeholder'));
    }
  }
}