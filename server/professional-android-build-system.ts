import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { nanoid } from 'nanoid';

export interface BuildConfig {
  appName: string;
  packageName: string;
  versionCode: number;
  versionName: string;
  websiteUrl?: string;
  files?: Array<{ name: string; content: Buffer }>;
  keystoreValidity?: number;
  keystorePassword?: string;
  keyAlias?: string;
  developerName?: string;
  organizationName?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface BuildResult {
  success: boolean;
  apkPath?: string;
  aabPath?: string;
  keystorePath?: string;
  error?: string;
  buildId: string;
  progress?: number;
}

export interface BuildProgress {
  step: string;
  progress: number;
  message: string;
}

export class ProfessionalAndroidBuildSystem {
  private buildDir: string;
  private outputDir: string;
  private androidSdkPath: string;
  private buildToolsVersion: string = '34.0.0';
  private compileSdkVersion: string = '34';
  private targetSdkVersion: string = '34';
  private minSdkVersion: string = '21';

  constructor() {
    this.buildDir = path.join(process.cwd(), 'android-builds');
    this.outputDir = path.join(process.cwd(), 'build-outputs');
    this.androidSdkPath = path.join(process.cwd(), 'android-sdk');
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.buildDir, { recursive: true });
    await fs.mkdir(this.outputDir, { recursive: true });
    await fs.mkdir(this.androidSdkPath, { recursive: true });
  }

  private async setupAndroidSDK(): Promise<void> {
    try {
      // Check if Android SDK is already set up
      const sdkManager = path.join(this.androidSdkPath, 'cmdline-tools', 'latest', 'bin', 'sdkmanager');
      if (await this.fileExists(sdkManager)) {
        console.log('Android SDK already set up');
        return;
      }

      console.log('Setting up Android SDK...');
      
      // Download and setup Android command line tools
      const cmdlineToolsUrl = 'https://dl.google.com/android/repository/commandlinetools-linux-8512546_latest.zip';
      const cmdlineToolsZip = path.join(this.androidSdkPath, 'cmdline-tools.zip');
      
      execSync(`curl -o "${cmdlineToolsZip}" "${cmdlineToolsUrl}"`, { stdio: 'inherit' });
      execSync(`cd "${this.androidSdkPath}" && unzip -q cmdline-tools.zip`, { stdio: 'inherit' });
      
      // Move cmdline-tools to correct location
      await fs.mkdir(path.join(this.androidSdkPath, 'cmdline-tools', 'latest'), { recursive: true });
      execSync(`mv "${path.join(this.androidSdkPath, 'cmdline-tools')}"/* "${path.join(this.androidSdkPath, 'cmdline-tools', 'latest')}"`, { stdio: 'inherit' });
      
      // Set environment variables
      process.env.ANDROID_HOME = this.androidSdkPath;
      process.env.ANDROID_SDK_ROOT = this.androidSdkPath;
      process.env.PATH = `${process.env.PATH}:${path.join(this.androidSdkPath, 'cmdline-tools', 'latest', 'bin')}:${path.join(this.androidSdkPath, 'platform-tools')}`;
      
      // Install required SDK components
      const sdkManagerPath = path.join(this.androidSdkPath, 'cmdline-tools', 'latest', 'bin', 'sdkmanager');
      execSync(`yes | "${sdkManagerPath}" --install "platform-tools"`, { stdio: 'inherit' });
      execSync(`yes | "${sdkManagerPath}" --install "platforms;android-${this.compileSdkVersion}"`, { stdio: 'inherit' });
      execSync(`yes | "${sdkManagerPath}" --install "build-tools;${this.buildToolsVersion}"`, { stdio: 'inherit' });
      
      console.log('Android SDK setup complete');
    } catch (error) {
      console.error('Failed to setup Android SDK:', error);
      throw error;
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async buildAPK(config: BuildConfig, onProgress?: (progress: BuildProgress) => void): Promise<BuildResult> {
    const buildId = nanoid();
    
    try {
      onProgress?.({ step: 'Initializing', progress: 5, message: 'Setting up build environment...' });
      
      // Setup Android SDK
      await this.setupAndroidSDK();
      
      onProgress?.({ step: 'Creating project', progress: 15, message: 'Creating Android project structure...' });
      
      const projectDir = path.join(this.buildDir, buildId);
      await this.createAndroidProject(projectDir, config);
      
      onProgress?.({ step: 'Generating keystore', progress: 30, message: 'Generating keystore for signing...' });
      
      // Generate keystore
      const keystorePath = await this.generateKeystore(projectDir, config);
      
      onProgress?.({ step: 'Compiling resources', progress: 45, message: 'Compiling Android resources...' });
      
      // Compile resources
      await this.compileResources(projectDir, config);
      
      onProgress?.({ step: 'Compiling java', progress: 60, message: 'Compiling Java sources...' });
      
      // Compile Java sources
      await this.compileJava(projectDir, config);
      
      onProgress?.({ step: 'Creating APK', progress: 75, message: 'Creating APK package...' });
      
      // Create APK
      const unsignedApkPath = await this.createUnsignedAPK(projectDir, config);
      
      onProgress?.({ step: 'Signing APK', progress: 85, message: 'Signing APK with keystore...' });
      
      // Sign APK
      const signedApkPath = await this.signAPK(unsignedApkPath, keystorePath, config);
      
      onProgress?.({ step: 'Creating AAB', progress: 90, message: 'Creating App Bundle...' });
      
      // Create AAB
      const aabPath = await this.createAAB(projectDir, config);
      
      onProgress?.({ step: 'Finalizing', progress: 95, message: 'Finalizing build outputs...' });
      
      // Copy outputs to final location
      const finalApkPath = path.join(this.outputDir, `${buildId}-signed.apk`);
      const finalAabPath = path.join(this.outputDir, `${buildId}-bundle.aab`);
      const finalKeystorePath = path.join(this.outputDir, `${buildId}-keystore.jks`);
      
      await fs.copyFile(signedApkPath, finalApkPath);
      await fs.copyFile(aabPath, finalAabPath);
      await fs.copyFile(keystorePath, finalKeystorePath);
      
      onProgress?.({ step: 'Complete', progress: 100, message: 'Build completed successfully!' });
      
      return {
        success: true,
        apkPath: finalApkPath,
        aabPath: finalAabPath,
        keystorePath: finalKeystorePath,
        buildId,
        progress: 100
      };
      
    } catch (error) {
      console.error('Build failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        buildId,
        progress: 0
      };
    }
  }

  private async createAndroidProject(projectDir: string, config: BuildConfig): Promise<void> {
    await fs.mkdir(projectDir, { recursive: true });
    
    // Create standard Android project structure
    const packagePath = config.packageName.replace(/\./g, '/');
    const srcDir = path.join(projectDir, 'src', 'main');
    const javaDir = path.join(srcDir, 'java', packagePath);
    const resDir = path.join(srcDir, 'res');
    
    await fs.mkdir(javaDir, { recursive: true });
    await fs.mkdir(path.join(resDir, 'layout'), { recursive: true });
    await fs.mkdir(path.join(resDir, 'values'), { recursive: true });
    await fs.mkdir(path.join(resDir, 'drawable'), { recursive: true });
    await fs.mkdir(path.join(resDir, 'mipmap-hdpi'), { recursive: true });
    await fs.mkdir(path.join(resDir, 'mipmap-mdpi'), { recursive: true });
    await fs.mkdir(path.join(resDir, 'mipmap-xhdpi'), { recursive: true });
    await fs.mkdir(path.join(resDir, 'mipmap-xxhdpi'), { recursive: true });
    await fs.mkdir(path.join(resDir, 'mipmap-xxxhdpi'), { recursive: true });
    await fs.mkdir(path.join(srcDir, 'assets'), { recursive: true });
    
    // Generate AndroidManifest.xml
    await this.generateManifest(srcDir, config);
    
    // Generate MainActivity.java
    await this.generateMainActivity(javaDir, config);
    
    // Generate resources
    await this.generateResources(resDir, config);
    
    // Generate app icons
    await this.generateAppIcons(resDir, config);
    
    // Copy web assets
    if (config.files && config.files.length > 0) {
      await this.copyWebAssets(srcDir, config);
    }
  }

  private async generateManifest(srcDir: string, config: BuildConfig): Promise<void> {
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
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="true">
        
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:theme="@style/AppTheme.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

    await fs.writeFile(path.join(srcDir, 'AndroidManifest.xml'), manifest);
  }

  private async generateMainActivity(javaDir: string, config: BuildConfig): Promise<void> {
    const className = config.packageName.split('.').pop() || 'MainActivity';
    const websiteUrl = config.websiteUrl || 'https://example.com';
    
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
        webSettings.setSupportZoom(true);
        webSettings.setDefaultTextEncodingName("utf-8");
        
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });
        
        // Load the website or local assets
        ${config.files && config.files.length > 0 ? 
          'webView.loadUrl("file:///android_asset/index.html");' : 
          `webView.loadUrl("${websiteUrl}");`
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

  private async generateResources(resDir: string, config: BuildConfig): Promise<void> {
    // strings.xml
    const strings = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${config.appName}</string>
</resources>`;
    
    await fs.writeFile(path.join(resDir, 'values', 'strings.xml'), strings);
    
    // colors.xml
    const colors = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#3F51B5</color>
    <color name="colorPrimaryDark">#303F9F</color>
    <color name="colorAccent">#FF4081</color>
</resources>`;
    
    await fs.writeFile(path.join(resDir, 'values', 'colors.xml'), colors);
    
    // styles.xml
    const styles = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="android:Theme.Material.Light.DarkActionBar">
        <item name="android:colorPrimary">@color/colorPrimary</item>
        <item name="android:colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="android:colorAccent">@color/colorAccent</item>
    </style>
    
    <style name="AppTheme.NoActionBar">
        <item name="android:windowActionBar">false</item>
        <item name="android:windowNoTitle">true</item>
    </style>
</resources>`;
    
    await fs.writeFile(path.join(resDir, 'values', 'styles.xml'), styles);
  }

  private async generateAppIcons(resDir: string, config: BuildConfig): Promise<void> {
    const iconSizes = [
      { dir: 'mipmap-hdpi', size: 72 },
      { dir: 'mipmap-mdpi', size: 48 },
      { dir: 'mipmap-xhdpi', size: 96 },
      { dir: 'mipmap-xxhdpi', size: 144 },
      { dir: 'mipmap-xxxhdpi', size: 192 }
    ];

    for (const iconSize of iconSizes) {
      const iconPath = path.join(resDir, iconSize.dir, 'ic_launcher.png');
      await this.createAppIcon(iconPath, iconSize.size, config.appName);
    }
  }

  private async createAppIcon(iconPath: string, size: number, appName: string): Promise<void> {
    // Create a simple PNG icon using Canvas or similar
    // For now, we'll create a placeholder icon
    const iconSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#3F51B5"/>
      <text x="50%" y="50%" text-anchor="middle" dy="0.35em" fill="white" font-size="${size/4}" font-family="Arial">
        ${appName.charAt(0).toUpperCase()}
      </text>
    </svg>`;
    
    // Convert SVG to PNG (simplified for now)
    await fs.writeFile(iconPath.replace('.png', '.svg'), iconSvg);
  }

  private async copyWebAssets(srcDir: string, config: BuildConfig): Promise<void> {
    const assetsDir = path.join(srcDir, 'assets');
    
    if (config.files && config.files.length > 0) {
      for (const file of config.files) {
        const filePath = path.join(assetsDir, file.name);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content);
      }
    }
  }

  private async generateKeystore(projectDir: string, config: BuildConfig): Promise<string> {
    const keystorePath = path.join(projectDir, 'app.jks');
    const validity = config.keystoreValidity || 10000;
    const password = config.keystorePassword || 'android123';
    const alias = config.keyAlias || 'appkey';
    
    const dname = `CN=${config.developerName || 'Developer'},O=${config.organizationName || 'Organization'},L=${config.city || 'City'},S=${config.state || 'State'},C=${config.country || 'US'}`;
    
    const keytoolCmd = `keytool -genkey -v -keystore "${keystorePath}" -keyalg RSA -keysize 2048 -validity ${validity} -alias "${alias}" -storepass "${password}" -keypass "${password}" -dname "${dname}"`;
    
    execSync(keytoolCmd, { stdio: 'inherit' });
    return keystorePath;
  }

  private async compileResources(projectDir: string, config: BuildConfig): Promise<void> {
    const aaptPath = path.join(this.androidSdkPath, 'build-tools', this.buildToolsVersion, 'aapt');
    const androidJarPath = path.join(this.androidSdkPath, 'platforms', `android-${this.compileSdkVersion}`, 'android.jar');
    const srcDir = path.join(projectDir, 'src', 'main');
    const resDir = path.join(srcDir, 'res');
    const manifestPath = path.join(srcDir, 'AndroidManifest.xml');
    const rJavaPath = path.join(projectDir, 'R.java');
    
    const aaptCmd = `"${aaptPath}" package -f -m -J "${projectDir}" -M "${manifestPath}" -S "${resDir}" -I "${androidJarPath}"`;
    
    execSync(aaptCmd, { stdio: 'inherit' });
  }

  private async compileJava(projectDir: string, config: BuildConfig): Promise<void> {
    const packagePath = config.packageName.replace(/\./g, '/');
    const javaDir = path.join(projectDir, 'src', 'main', 'java', packagePath);
    const androidJarPath = path.join(this.androidSdkPath, 'platforms', `android-${this.compileSdkVersion}`, 'android.jar');
    const classesDir = path.join(projectDir, 'classes');
    
    await fs.mkdir(classesDir, { recursive: true });
    
    const javacCmd = `javac -d "${classesDir}" -cp "${androidJarPath}" "${path.join(javaDir, 'MainActivity.java')}" "${path.join(projectDir, 'R.java')}"`;
    
    execSync(javacCmd, { stdio: 'inherit' });
    
    // Create classes.dex
    const dxPath = path.join(this.androidSdkPath, 'build-tools', this.buildToolsVersion, 'dx');
    const dxCmd = `"${dxPath}" --dex --output="${path.join(projectDir, 'classes.dex')}" "${classesDir}"`;
    
    execSync(dxCmd, { stdio: 'inherit' });
  }

  private async createUnsignedAPK(projectDir: string, config: BuildConfig): Promise<string> {
    const aaptPath = path.join(this.androidSdkPath, 'build-tools', this.buildToolsVersion, 'aapt');
    const androidJarPath = path.join(this.androidSdkPath, 'platforms', `android-${this.compileSdkVersion}`, 'android.jar');
    const srcDir = path.join(projectDir, 'src', 'main');
    const resDir = path.join(srcDir, 'res');
    const assetsDir = path.join(srcDir, 'assets');
    const manifestPath = path.join(srcDir, 'AndroidManifest.xml');
    const unsignedApkPath = path.join(projectDir, 'app-unsigned.apk');
    
    let aaptCmd = `"${aaptPath}" package -f -M "${manifestPath}" -S "${resDir}" -I "${androidJarPath}" -F "${unsignedApkPath}"`;
    
    // Add assets if they exist
    if (await this.fileExists(assetsDir)) {
      aaptCmd += ` -A "${assetsDir}"`;
    }
    
    execSync(aaptCmd, { stdio: 'inherit' });
    
    // Add classes.dex to the APK
    const classesDexPath = path.join(projectDir, 'classes.dex');
    execSync(`cd "${projectDir}" && zip -u app-unsigned.apk classes.dex`, { stdio: 'inherit' });
    
    return unsignedApkPath;
  }

  private async signAPK(unsignedApkPath: string, keystorePath: string, config: BuildConfig): Promise<string> {
    const password = config.keystorePassword || 'android123';
    const alias = config.keyAlias || 'appkey';
    const signedApkPath = unsignedApkPath.replace('-unsigned.apk', '-signed.apk');
    
    // Use jarsigner to sign the APK
    const jarsignerCmd = `jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore "${keystorePath}" -storepass "${password}" -keypass "${password}" "${unsignedApkPath}" "${alias}"`;
    
    execSync(jarsignerCmd, { stdio: 'inherit' });
    
    // Copy to signed APK path
    await fs.copyFile(unsignedApkPath, signedApkPath);
    
    // Align the APK
    const zipalignPath = path.join(this.androidSdkPath, 'build-tools', this.buildToolsVersion, 'zipalign');
    const alignedApkPath = signedApkPath.replace('-signed.apk', '-aligned.apk');
    
    execSync(`"${zipalignPath}" -f -p 4 "${signedApkPath}" "${alignedApkPath}"`, { stdio: 'inherit' });
    
    return alignedApkPath;
  }

  private async createAAB(projectDir: string, config: BuildConfig): Promise<string> {
    // For AAB, we need to create a proper bundle structure
    // This is a simplified implementation
    const aabPath = path.join(projectDir, 'app.aab');
    const baseDir = path.join(projectDir, 'base');
    
    await fs.mkdir(baseDir, { recursive: true });
    
    // Copy resources to base module
    const srcDir = path.join(projectDir, 'src', 'main');
    execSync(`cp -r "${srcDir}"/* "${baseDir}/"`, { stdio: 'inherit' });
    
    // Create a simple AAB structure
    execSync(`cd "${projectDir}" && zip -r app.aab base/`, { stdio: 'inherit' });
    
    return aabPath;
  }

  async createDeliveryZip(apkPath: string, aabPath: string, keystorePath: string, buildId: string): Promise<string> {
    const deliveryZipPath = path.join(this.outputDir, `${buildId}-complete.zip`);
    
    execSync(`cd "${this.outputDir}" && zip -j "${deliveryZipPath}" "${apkPath}" "${aabPath}" "${keystorePath}"`, { stdio: 'inherit' });
    
    return deliveryZipPath;
  }
}