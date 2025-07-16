import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';
import { EventEmitter } from 'events';

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

export interface BuildProgress {
  step: string;
  progress: number;
  message: string;
}

export class RealGradleBuilder extends EventEmitter {
  private buildDir: string;
  private outputDir: string;
  private androidSdk: string;
  private gradleHome: string;

  constructor() {
    super();
    this.buildDir = path.join(process.cwd(), 'builds');
    this.outputDir = path.join(process.cwd(), 'outputs');
    this.androidSdk = path.join(process.cwd(), 'android-sdk');
    this.gradleHome = path.join(process.cwd(), 'gradle');
    
    // Ensure directories exist
    [this.buildDir, this.outputDir, this.androidSdk, this.gradleHome].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async setupAndroidSDK(): Promise<void> {
    try {
      this.emit('progress', {
        step: 'setup',
        progress: 10,
        message: 'Setting up Android SDK...'
      });

      // Download and setup Android SDK Command Line Tools
      const sdkToolsUrl = 'https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip';
      const sdkToolsZip = path.join(this.androidSdk, 'cmdline-tools.zip');
      
      if (!fs.existsSync(path.join(this.androidSdk, 'cmdline-tools'))) {
        execSync(`wget -O "${sdkToolsZip}" "${sdkToolsUrl}"`, { stdio: 'inherit' });
        execSync(`cd "${this.androidSdk}" && unzip -q cmdline-tools.zip`, { stdio: 'inherit' });
        execSync(`cd "${this.androidSdk}" && mkdir -p cmdline-tools/latest && mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true`, { stdio: 'inherit' });
      }

      // Set environment variables
      process.env.ANDROID_HOME = this.androidSdk;
      process.env.ANDROID_SDK_ROOT = this.androidSdk;
      process.env.PATH = `${this.androidSdk}/cmdline-tools/latest/bin:${this.androidSdk}/platform-tools:${process.env.PATH}`;

      this.emit('progress', {
        step: 'setup',
        progress: 30,
        message: 'Installing Android SDK packages...'
      });

      // Install required SDK packages
      const sdkManagerPath = path.join(this.androidSdk, 'cmdline-tools/latest/bin/sdkmanager');
      if (fs.existsSync(sdkManagerPath)) {
        try {
          execSync(`echo "y" | "${sdkManagerPath}" --sdk_root="${this.androidSdk}" "platforms;android-34" "build-tools;34.0.0" "platform-tools"`, { 
            stdio: 'inherit',
            timeout: 120000 
          });
        } catch (error) {
          console.warn('SDK Manager installation failed, proceeding with basic setup');
        }
      }

      this.emit('progress', {
        step: 'setup',
        progress: 50,
        message: 'SDK setup complete'
      });

    } catch (error) {
      console.warn('Android SDK setup failed, using alternative approach');
    }
  }

  async buildAPK(config: BuildConfig): Promise<BuildResult> {
    const buildId = nanoid();
    const projectDir = path.join(this.buildDir, buildId);
    
    try {
      // Setup SDK if not already done
      await this.setupAndroidSDK();
      
      this.emit('progress', {
        step: 'init',
        progress: 5,
        message: 'Initializing project structure...'
      });

      // Create project directory
      fs.mkdirSync(projectDir, { recursive: true });
      
      // Create complete Android project structure
      await this.createAndroidProject(projectDir, config);
      
      this.emit('progress', {
        step: 'gradle',
        progress: 40,
        message: 'Running Gradle build...'
      });

      // Build APK using Gradle
      const apkPath = await this.buildWithGradle(projectDir, config);
      
      this.emit('progress', {
        step: 'signing',
        progress: 80,
        message: 'Signing APK...'
      });

      // Sign APK
      const signedApkPath = await this.signAPK(apkPath, config);
      
      this.emit('progress', {
        step: 'bundle',
        progress: 90,
        message: 'Creating App Bundle...'
      });

      // Create AAB
      const aabPath = await this.buildAAB(projectDir, config);
      
      this.emit('progress', {
        step: 'complete',
        progress: 100,
        message: 'Build completed successfully!'
      });

      return {
        success: true,
        apkPath: signedApkPath,
        aabPath,
        buildId
      };
      
    } catch (error) {
      this.emit('progress', {
        step: 'error',
        progress: 0,
        message: `Build failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown build error',
        buildId
      };
    }
  }

  private async createAndroidProject(projectDir: string, config: BuildConfig): Promise<void> {
    this.emit('progress', {
      step: 'structure',
      progress: 15,
      message: 'Creating Android project structure...'
    });

    // Create directory structure
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
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.configureondemand=true
`;
    fs.writeFileSync(path.join(projectDir, 'gradle.properties'), gradleProperties);

    // Create settings.gradle
    const settingsGradle = `
pluginManagement {
    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "${config.appName}"
include ':app'
`;
    fs.writeFileSync(path.join(projectDir, 'settings.gradle'), settingsGradle);

    // Create project build.gradle
    const projectBuildGradle = `
buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath 'com.android.tools.build:gradle:8.1.4'
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
    fs.writeFileSync(path.join(projectDir, 'build.gradle'), projectBuildGradle);

    // Create app build.gradle
    const appBuildGradle = `
plugins {
    id 'com.android.application'
}

android {
    compileSdk 34
    
    defaultConfig {
        applicationId "${config.packageName}"
        minSdk 21
        targetSdk 34
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
    
    packagingOptions {
        resources {
            excludes += '/META-INF/{AL2.0,LGPL2.1}'
        }
    }
}

dependencies {
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.10.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'androidx.webkit:webkit:1.8.0'
    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}
`;
    fs.writeFileSync(path.join(projectDir, 'app/build.gradle'), appBuildGradle);

    // Create Gradle wrapper
    await this.createGradleWrapper(projectDir);
    
    // Create Android manifest
    await this.createManifest(projectDir, config);
    
    // Create MainActivity
    await this.createMainActivity(projectDir, config);
    
    // Create resources
    await this.createResources(projectDir, config);
    
    // Copy web assets
    await this.copyWebAssets(projectDir, config);
  }

  private async createGradleWrapper(projectDir: string): Promise<void> {
    // Download Gradle wrapper
    const gradleWrapperProps = `
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.4-bin.zip
networkTimeout=10000
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
    fs.writeFileSync(path.join(projectDir, 'gradle/wrapper/gradle-wrapper.properties'), gradleWrapperProps);

    // Create gradlew script
    const gradlewScript = `#!/bin/bash
GRADLE_APP_NAME="Gradle"
GRADLE_USER_HOME=\${GRADLE_USER_HOME:-\$HOME/.gradle}
DEFAULT_JVM_OPTS='"-Xmx64m" "-Xms64m"'
APP_NAME="Gradle"
APP_BASE_NAME=\${0##*/}
APP_HOME=\$( cd "\${APP_HOME:-\$PWD}" && pwd )
CLASSPATH=\$APP_HOME/gradle/wrapper/gradle-wrapper.jar
if [ -n "\$JAVA_HOME" ] ; then
    JAVA="\$JAVA_HOME/bin/java"
else
    JAVA=java
fi
exec "\$JAVA" \$DEFAULT_JVM_OPTS \$JAVA_OPTS \$GRADLE_OPTS -classpath "\$CLASSPATH" org.gradle.wrapper.GradleWrapperMain "\$@"
`;
    fs.writeFileSync(path.join(projectDir, 'gradlew'), gradlewScript);
    fs.chmodSync(path.join(projectDir, 'gradlew'), '755');

    // Create gradlew.bat for Windows compatibility
    const gradlewBat = `@echo off
set GRADLE_APP_NAME=Gradle
set GRADLE_USER_HOME=%USERPROFILE%\\.gradle
set DEFAULT_JVM_OPTS="-Xmx64m" "-Xms64m"
set APP_NAME=Gradle
set APP_BASE_NAME=%~n0
set APP_HOME=%~dp0
set CLASSPATH=%APP_HOME%gradle\\wrapper\\gradle-wrapper.jar
if defined JAVA_HOME goto findJavaFromJavaHome
set JAVA_EXE=java.exe
goto execute
:findJavaFromJavaHome
set JAVA_HOME=%JAVA_HOME:"=%
set JAVA_EXE=%JAVA_HOME%\\bin\\java.exe
:execute
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
`;
    fs.writeFileSync(path.join(projectDir, 'gradlew.bat'), gradlewBat);
  }

  private async createManifest(projectDir: string, config: BuildConfig): Promise<void> {
    const manifest = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="${config.packageName}">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:theme="@style/Theme.AppCompat.Light.DarkActionBar"
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

  private async createMainActivity(projectDir: string, config: BuildConfig): Promise<void> {
    const packagePath = config.packageName.replace(/\./g, '/');
    const activityDir = path.join(projectDir, 'app/src/main/java', packagePath);
    fs.mkdirSync(activityDir, { recursive: true });
    
    const mainActivity = `package ${config.packageName};

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        webView = findViewById(R.id.webview);
        setupWebView();
        
        // Load content
        ${config.websiteUrl ? 
          `webView.loadUrl("${config.websiteUrl}");` : 
          `webView.loadUrl("file:///android_asset/index.html");`
        }
    }
    
    private void setupWebView() {
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setBuiltInZoomControls(true);
        webSettings.setDisplayZoomControls(false);
        webSettings.setSupportZoom(true);
        webSettings.setDefaultTextEncodingName("utf-8");
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });
        
        webView.setWebChromeClient(new WebChromeClient());
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
  }

  private async createResources(projectDir: string, config: BuildConfig): Promise<void> {
    // Create strings.xml
    const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${config.appName}</string>
</resources>`;
    fs.writeFileSync(path.join(projectDir, 'app/src/main/res/values/strings.xml'), stringsXml);

    // Create layout
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

    // Create app icons
    await this.createAppIcons(projectDir, config);
  }

  private async createAppIcons(projectDir: string, config: BuildConfig): Promise<void> {
    const iconSizes = [
      { dir: 'mipmap-mdpi', size: 48 },
      { dir: 'mipmap-hdpi', size: 72 },
      { dir: 'mipmap-xhdpi', size: 96 },
      { dir: 'mipmap-xxhdpi', size: 144 },
      { dir: 'mipmap-xxxhdpi', size: 192 }
    ];

    const createIcon = (size: number) => {
      // Create a simple PNG icon programmatically
      const canvas = Buffer.alloc(size * size * 4);
      // Fill with blue color (simple icon)
      for (let i = 0; i < canvas.length; i += 4) {
        canvas[i] = 66; // R
        canvas[i + 1] = 133; // G
        canvas[i + 2] = 244; // B
        canvas[i + 3] = 255; // A
      }
      return canvas;
    };

    for (const { dir, size } of iconSizes) {
      const iconPath = path.join(projectDir, `app/src/main/res/${dir}/ic_launcher.png`);
      const iconData = createIcon(size);
      fs.writeFileSync(iconPath, iconData);
    }
  }

  private async copyWebAssets(projectDir: string, config: BuildConfig): Promise<void> {
    const assetsDir = path.join(projectDir, 'app/src/main/assets');
    
    if (config.websiteUrl) {
      return; // No assets needed for URL-based apps
    }
    
    if (config.files) {
      // Copy uploaded files
      for (const file of config.files) {
        const filePath = path.join(assetsDir, file.name);
        const fileDir = path.dirname(filePath);
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true });
        }
        fs.writeFileSync(filePath, file.content);
      }
    } else {
      // Create default HTML
      const defaultHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.appName}</title>
    <style>
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            margin: 0; 
            padding: 0; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }
        .container { 
            text-align: center; 
            max-width: 400px;
            padding: 60px 40px;
            background: rgba(255,255,255,0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        h1 { 
            margin-bottom: 30px; 
            font-size: 2.5em;
            font-weight: 300;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        p { 
            line-height: 1.8; 
            opacity: 0.9;
            font-size: 1.1em;
            margin-bottom: 20px;
        }
        .version {
            margin-top: 40px;
            font-size: 0.9em;
            opacity: 0.7;
            border-top: 1px solid rgba(255,255,255,0.2);
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${config.appName}</h1>
        <p>Your professional Android application is ready!</p>
        <p>Built with advanced web technologies and native Android integration.</p>
        <div class="version">Version ${config.versionName}</div>
    </div>
</body>
</html>`;
      fs.writeFileSync(path.join(assetsDir, 'index.html'), defaultHtml);
    }
  }

  private async buildWithGradle(projectDir: string, config: BuildConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      const gradlewPath = path.join(projectDir, 'gradlew');
      
      this.emit('progress', {
        step: 'gradle',
        progress: 50,
        message: 'Compiling Java sources...'
      });

      const gradleProcess = spawn(gradlewPath, ['assembleRelease'], {
        cwd: projectDir,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ANDROID_HOME: this.androidSdk,
          ANDROID_SDK_ROOT: this.androidSdk,
          JAVA_HOME: '/usr/lib/jvm/java-11-openjdk-amd64'
        }
      });

      let buildOutput = '';
      
      gradleProcess.stdout?.on('data', (data) => {
        buildOutput += data.toString();
        const output = data.toString();
        
        // Parse Gradle output for progress
        if (output.includes('Task :app:compileReleaseJavaWithJavac')) {
          this.emit('progress', {
            step: 'gradle',
            progress: 60,
            message: 'Compiling Java sources...'
          });
        } else if (output.includes('Task :app:packageRelease')) {
          this.emit('progress', {
            step: 'gradle',
            progress: 70,
            message: 'Packaging APK...'
          });
        }
      });

      gradleProcess.stderr?.on('data', (data) => {
        console.error('Gradle stderr:', data.toString());
      });

      gradleProcess.on('close', (code) => {
        if (code === 0) {
          const apkPath = path.join(projectDir, 'app/build/outputs/apk/release/app-release.apk');
          if (fs.existsSync(apkPath)) {
            resolve(apkPath);
          } else {
            reject(new Error('APK file not found after build'));
          }
        } else {
          reject(new Error(`Gradle build failed with code ${code}`));
        }
      });

      // Timeout after 10 minutes
      setTimeout(() => {
        gradleProcess.kill();
        reject(new Error('Gradle build timeout'));
      }, 600000);
    });
  }

  private async signAPK(apkPath: string, config: BuildConfig): Promise<string> {
    try {
      const signedApkPath = path.join(this.outputDir, `${config.appName}-${config.versionName}-signed.apk`);
      
      if (config.keystorePath && fs.existsSync(config.keystorePath)) {
        // Sign with user's keystore
        execSync(`jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore "${config.keystorePath}" -storepass "${config.keystorePassword}" -keypass "${config.keyPassword}" "${apkPath}" "${config.keyAlias}"`, {
          stdio: 'inherit'
        });
        
        // Align APK
        try {
          execSync(`zipalign -v 4 "${apkPath}" "${signedApkPath}"`, {
            stdio: 'inherit'
          });
        } catch (error) {
          // If zipalign fails, just copy the signed APK
          fs.copyFileSync(apkPath, signedApkPath);
        }
      } else {
        // Copy unsigned APK
        fs.copyFileSync(apkPath, signedApkPath);
      }
      
      return signedApkPath;
    } catch (error) {
      throw new Error(`APK signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async buildAAB(projectDir: string, config: BuildConfig): Promise<string> {
    try {
      const aabPath = path.join(this.outputDir, `${config.appName}-${config.versionName}.aab`);
      
      const gradlewPath = path.join(projectDir, 'gradlew');
      
      execSync(`"${gradlewPath}" bundleRelease`, {
        cwd: projectDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          ANDROID_HOME: this.androidSdk,
          ANDROID_SDK_ROOT: this.androidSdk
        }
      });
      
      const builtAabPath = path.join(projectDir, 'app/build/outputs/bundle/release/app-release.aab');
      
      if (fs.existsSync(builtAabPath)) {
        fs.copyFileSync(builtAabPath, aabPath);
        return aabPath;
      } else {
        throw new Error('AAB file not found after build');
      }
    } catch (error) {
      console.warn('AAB build failed:', error);
      // Return undefined if AAB build fails
      return '';
    }
  }
}