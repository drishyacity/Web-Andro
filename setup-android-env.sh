#!/bin/bash

# Setup Android development environment
set -e

echo "Setting up Android development environment..."

# Create necessary directories
mkdir -p android-sdk
mkdir -p builds
mkdir -p outputs
mkdir -p keystores

# Set environment variables
export ANDROID_HOME="$(pwd)/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

# Download Android SDK Command Line Tools
if [ ! -d "android-sdk/cmdline-tools" ]; then
    echo "Downloading Android SDK Command Line Tools..."
    wget -O android-sdk/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip"
    cd android-sdk
    unzip -q cmdline-tools.zip
    mkdir -p cmdline-tools/latest
    mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true
    rm cmdline-tools.zip
    cd ..
fi

# Make sdkmanager executable
chmod +x android-sdk/cmdline-tools/latest/bin/sdkmanager

# Install Android SDK packages
echo "Installing Android SDK packages..."
echo "y" | android-sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root="$ANDROID_HOME" \
    "platforms;android-34" \
    "build-tools;34.0.0" \
    "platform-tools" \
    "tools" 2>/dev/null || echo "SDK installation completed with warnings"

# Create gradle-wrapper.jar for projects
echo "Setting up Gradle wrapper..."
mkdir -p gradle-wrapper
if [ ! -f "gradle-wrapper/gradle-wrapper.jar" ]; then
    wget -O gradle-wrapper/gradle-wrapper.jar "https://github.com/gradle/gradle/raw/v8.4.0/gradle/wrapper/gradle-wrapper.jar"
fi

echo "Android development environment setup complete!"
echo "ANDROID_HOME: $ANDROID_HOME"
echo "JAVA_HOME: $JAVA_HOME"

# Test the setup
echo "Testing setup..."
if [ -f "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]; then
    echo "✓ SDK Manager found"
else
    echo "✗ SDK Manager not found"
fi

if [ -f "$ANDROID_HOME/platform-tools/adb" ]; then
    echo "✓ ADB found"
else
    echo "✗ ADB not found"
fi

if [ -f "$ANDROID_HOME/build-tools/34.0.0/aapt" ]; then
    echo "✓ Build tools found"
else
    echo "✗ Build tools not found"
fi

echo "Setup script completed!"