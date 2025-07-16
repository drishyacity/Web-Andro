import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { nanoid } from 'nanoid';

export interface BuildConfig {
  appName: string;
  packageName: string;
  versionCode: number;
  versionName: string;
  websiteUrl?: string;
  files?: Array<{ name: string; content: Buffer }>;
  keystorePath?: string;
  keystorePassword?: string;
  keyAlias?: string;
  keyPassword?: string;
}

export interface BuildResult {
  success: boolean;
  apkPath?: string;
  aabPath?: string;
  error?: string;
  buildId: string;
}

export class ProfessionalAndroidBuilder {
  private buildDir: string;
  private templatesDir: string;
  private outputDir: string;

  constructor() {
    this.buildDir = path.join(process.cwd(), 'builds');
    this.templatesDir = path.join(process.cwd(), 'android-templates');
    this.outputDir = path.join(process.cwd(), 'outputs');
    
    // Ensure directories exist
    [this.buildDir, this.templatesDir, this.outputDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async buildAPK(config: BuildConfig): Promise<BuildResult> {
    const buildId = nanoid();
    const projectDir = path.join(this.buildDir, buildId);
    
    try {
      // Create project directory
      fs.mkdirSync(projectDir, { recursive: true });
      
      // Setup Android project structure
      await this.setupAndroidProject(projectDir, config);
      
      // Generate app resources
      await this.generateAppResources(projectDir, config);
      
      // Copy web assets
      await this.copyWebAssets(projectDir, config);
      
      // Generate Android manifest
      await this.generateManifest(projectDir, config);
      
      // Create MainActivity
      await this.generateMainActivity(projectDir, config);
      
      // Build APK
      const apkPath = await this.buildAPKFile(projectDir, config);
      
      // Build AAB if requested
      const aabPath = await this.buildAABFile(projectDir, config);
      
      return {
        success: true,
        apkPath,
        aabPath,
        buildId
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown build error',
        buildId
      };
    }
  }

  private async setupAndroidProject(projectDir: string, config: BuildConfig): Promise<void> {
    // Create Android project structure
    const dirs = [
      'app/src/main/java',
      'app/src/main/res/values',
      'app/src/main/res/layout',
      'app/src/main/res/drawable',
      'app/src/main/res/mipmap-hdpi',
      'app/src/main/res/mipmap-mdpi',
      'app/src/main/res/mipmap-xhdpi',
      'app/src/main/res/mipmap-xxhdpi',
      'app/src/main/res/mipmap-xxxhdpi',
      'app/src/main/assets',
      'gradle/wrapper'
    ];
    
    dirs.forEach(dir => {
      fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
    });
    
    // Create gradle.properties
    const gradleProperties = `
android.useAndroidX=true
android.enableJetifier=true
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
`;
    fs.writeFileSync(path.join(projectDir, 'gradle.properties'), gradleProperties);
    
    // Create settings.gradle
    const settingsGradle = `
include ':app'
rootProject.name = "${config.appName}"
`;
    fs.writeFileSync(path.join(projectDir, 'settings.gradle'), settingsGradle);
    
    // Create main build.gradle
    const mainBuildGradle = `
buildscript {
    ext.kotlin_version = '1.9.0'
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.1.0'
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

task clean(type: Delete) {
    delete rootProject.buildDir
}
`;
    fs.writeFileSync(path.join(projectDir, 'build.gradle'), mainBuildGradle);
    
    // Create app build.gradle
    const appBuildGradle = `
plugins {
    id 'com.android.application'
    id 'kotlin-android'
}

android {
    compileSdkVersion 34
    buildToolsVersion "34.0.0"

    defaultConfig {
        applicationId "${config.packageName}"
        minSdkVersion 21
        targetSdkVersion 34
        versionCode ${config.versionCode}
        versionName "${config.versionName}"
        
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
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
    
    kotlinOptions {
        jvmTarget = '1.8'
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.12.0'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.9.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.webkit:webkit:1.7.0'
    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}
`;
    fs.writeFileSync(path.join(projectDir, 'app/build.gradle'), appBuildGradle);
    
    // Create gradle wrapper
    await this.createGradleWrapper(projectDir);
  }

  private async createGradleWrapper(projectDir: string): Promise<void> {
    const gradleWrapperProps = `
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.1-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
    fs.writeFileSync(path.join(projectDir, 'gradle/wrapper/gradle-wrapper.properties'), gradleWrapperProps);
    
    // Create gradlew script
    const gradlewScript = `#!/usr/bin/env sh
./gradlew "$@"
`;
    fs.writeFileSync(path.join(projectDir, 'gradlew'), gradlewScript);
    fs.chmodSync(path.join(projectDir, 'gradlew'), '755');
  }

  private async generateAppResources(projectDir: string, config: BuildConfig): Promise<void> {
    // Create strings.xml
    const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${config.appName}</string>
</resources>`;
    fs.writeFileSync(path.join(projectDir, 'app/src/main/res/values/strings.xml'), stringsXml);
    
    // Create colors.xml
    const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#6200EE</color>
    <color name="colorPrimaryVariant">#3700B3</color>
    <color name="colorOnPrimary">#FFFFFF</color>
    <color name="colorSecondary">#03DAC6</color>
    <color name="colorSecondaryVariant">#018786</color>
    <color name="colorOnSecondary">#000000</color>
    <color name="colorError">#B00020</color>
    <color name="colorOnError">#FFFFFF</color>
    <color name="colorSurface">#FFFFFF</color>
    <color name="colorOnSurface">#000000</color>
    <color name="colorBackground">#FFFFFF</color>
    <color name="colorOnBackground">#000000</color>
</resources>`;
    fs.writeFileSync(path.join(projectDir, 'app/src/main/res/values/colors.xml'), colorsXml);
    
    // Create themes.xml
    const themesXml = `<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="Theme.App" parent="Theme.MaterialComponents.DayNight.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryVariant">@color/colorPrimaryVariant</item>
        <item name="colorOnPrimary">@color/colorOnPrimary</item>
        <item name="colorSecondary">@color/colorSecondary</item>
        <item name="colorSecondaryVariant">@color/colorSecondaryVariant</item>
        <item name="colorOnSecondary">@color/colorOnSecondary</item>
        <item name="colorError">@color/colorError</item>
        <item name="colorOnError">@color/colorOnError</item>
        <item name="colorSurface">@color/colorSurface</item>
        <item name="colorOnSurface">@color/colorOnSurface</item>
        <item name="android:colorBackground">@color/colorBackground</item>
        <item name="colorOnBackground">@color/colorOnBackground</item>
    </style>
</resources>`;
    fs.writeFileSync(path.join(projectDir, 'app/src/main/res/values/themes.xml'), themesXml);
    
    // Generate app icons
    await this.generateAppIcons(projectDir, config);
  }

  private async generateAppIcons(projectDir: string, config: BuildConfig): Promise<void> {
    const iconSizes = [
      { dir: 'mipmap-mdpi', size: 48 },
      { dir: 'mipmap-hdpi', size: 72 },
      { dir: 'mipmap-xhdpi', size: 96 },
      { dir: 'mipmap-xxhdpi', size: 144 },
      { dir: 'mipmap-xxxhdpi', size: 192 }
    ];
    
    for (const { dir, size } of iconSizes) {
      const iconPath = path.join(projectDir, `app/src/main/res/${dir}/ic_launcher.png`);
      await this.createDefaultIcon(iconPath, size, config.appName);
    }
  }

  private async createDefaultIcon(iconPath: string, size: number, appName: string): Promise<void> {
    // Create a simple colored icon using SVG converted to PNG
    const svgIcon = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#6200EE" rx="12"/>
  <text x="${size/2}" y="${size/2}" text-anchor="middle" dy="0.35em" fill="white" font-size="${size/3}" font-family="Arial, sans-serif">${appName.charAt(0).toUpperCase()}</text>
</svg>`;
    
    // For now, create a simple placeholder file
    const placeholderPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(iconPath, placeholderPng);
  }

  private async copyWebAssets(projectDir: string, config: BuildConfig): Promise<void> {
    const assetsDir = path.join(projectDir, 'app/src/main/assets');
    
    if (config.websiteUrl) {
      // Create a simple HTML file that loads the website
      const webviewHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.appName}</title>
    <style>
        body { margin: 0; padding: 0; }
        iframe { width: 100%; height: 100vh; border: none; }
    </style>
</head>
<body>
    <iframe src="${config.websiteUrl}" allowfullscreen></iframe>
</body>
</html>`;
      fs.writeFileSync(path.join(assetsDir, 'index.html'), webviewHtml);
    } else if (config.files) {
      // Copy uploaded files to assets
      for (const file of config.files) {
        const filePath = path.join(assetsDir, file.name);
        const fileDir = path.dirname(filePath);
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true });
        }
        fs.writeFileSync(filePath, file.content);
      }
    } else {
      // Create default index.html
      const defaultHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.appName}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        h1 { color: #6200EE; margin-bottom: 20px; }
        p { color: #666; line-height: 1.6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to ${config.appName}</h1>
        <p>Your app is ready to use!</p>
    </div>
</body>
</html>`;
      fs.writeFileSync(path.join(assetsDir, 'index.html'), defaultHtml);
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
        android:label="@string/app_name"
        android:theme="@style/Theme.App"
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
    fs.writeFileSync(path.join(projectDir, 'app/src/main/AndroidManifest.xml'), manifest);
  }

  private async generateMainActivity(projectDir: string, config: BuildConfig): Promise<void> {
    const packagePath = config.packageName.replace(/\./g, '/');
    const activityDir = path.join(projectDir, 'app/src/main/java', packagePath);
    fs.mkdirSync(activityDir, { recursive: true });
    
    const mainActivity = `package ${config.packageName};

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
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
        webSettings.setDefaultTextEncodingName("utf-8");
        
        // Set WebView client
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });
        
        // Load the main page
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
    fs.writeFileSync(path.join(activityDir, 'MainActivity.java'), mainActivity);
    
    // Create activity_main.xml layout
    const layoutXml = `<?xml version="1.0" encoding="utf-8"?>
<RelativeLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">
    
    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
        
</RelativeLayout>`;
    fs.writeFileSync(path.join(projectDir, 'app/src/main/res/layout/activity_main.xml'), layoutXml);
  }

  private async buildAPKFile(projectDir: string, config: BuildConfig): Promise<string> {
    try {
      // First, build unsigned APK
      const gradlewPath = path.join(projectDir, 'gradlew');
      
      // Make gradlew executable
      fs.chmodSync(gradlewPath, '755');
      
      // Build unsigned APK
      execSync(`cd "${projectDir}" && ./gradlew assembleRelease`, { 
        stdio: 'inherit',
        timeout: 300000 // 5 minutes timeout
      });
      
      // Find the generated APK
      const unsignedApkPath = path.join(projectDir, 'app/build/outputs/apk/release/app-release.apk');
      
      if (!fs.existsSync(unsignedApkPath)) {
        throw new Error('APK file not generated');
      }
      
      // Sign the APK if keystore is provided
      let finalApkPath = unsignedApkPath;
      
      if (config.keystorePath && fs.existsSync(config.keystorePath)) {
        finalApkPath = await this.signAPK(unsignedApkPath, config);
      }
      
      // Copy to output directory
      const outputApkPath = path.join(this.outputDir, `${config.appName}-${config.versionName}.apk`);
      fs.copyFileSync(finalApkPath, outputApkPath);
      
      return outputApkPath;
    } catch (error) {
      throw new Error(`APK build failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async signAPK(unsignedApkPath: string, config: BuildConfig): Promise<string> {
    try {
      const signedApkPath = unsignedApkPath.replace('.apk', '-signed.apk');
      
      // Sign APK using jarsigner
      const jarsignerCommand = [
        'jarsigner',
        '-verbose',
        '-sigalg', 'SHA1withRSA',
        '-digestalg', 'SHA1',
        '-keystore', config.keystorePath!,
        '-storepass', config.keystorePassword || 'android123',
        '-keypass', config.keyPassword || 'android123',
        unsignedApkPath,
        config.keyAlias || 'app-key'
      ].join(' ');
      
      execSync(jarsignerCommand, { 
        stdio: 'pipe',
        timeout: 60000 // 1 minute timeout
      });
      
      // Align APK using zipalign (if available)
      try {
        const alignedApkPath = unsignedApkPath.replace('.apk', '-aligned.apk');
        execSync(`zipalign -v 4 "${unsignedApkPath}" "${alignedApkPath}"`, { 
          stdio: 'pipe',
          timeout: 60000
        });
        
        if (fs.existsSync(alignedApkPath)) {
          return alignedApkPath;
        }
      } catch (alignError) {
        // zipalign not available, use signed APK as-is
        console.warn('zipalign not available, using signed APK without alignment');
      }
      
      return unsignedApkPath;
    } catch (error) {
      throw new Error(`APK signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async buildAABFile(projectDir: string, config: BuildConfig): Promise<string | undefined> {
    try {
      // Build AAB (Android App Bundle)
      const gradlewPath = path.join(projectDir, 'gradlew');
      
      execSync(`cd "${projectDir}" && ./gradlew bundleRelease`, { 
        stdio: 'inherit',
        timeout: 300000 // 5 minutes timeout
      });
      
      // Find the generated AAB
      const aabPath = path.join(projectDir, 'app/build/outputs/bundle/release/app-release.aab');
      
      if (!fs.existsSync(aabPath)) {
        return undefined;
      }
      
      // Copy to output directory
      const outputAabPath = path.join(this.outputDir, `${config.appName}-${config.versionName}.aab`);
      fs.copyFileSync(aabPath, outputAabPath);
      
      return outputAabPath;
    } catch (error) {
      console.warn('AAB build failed:', error);
      return undefined;
    }
  }
}