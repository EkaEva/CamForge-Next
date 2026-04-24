# CamForge-Next v0.3.2 iOS/Android 应用开发计划

> **项目目标**：完成 Tauri 移动端配置，实现 iOS/Android 应用打包，版本更新到 v0.3.2。
>
> **状态**：✅ 已完成并发布

---

## 当前状态（2026-04-24 更新）

### 已完成 ✅

| 步骤 | 状态 | 说明 |
|------|------|------|
| 检查 Tauri 移动端支持 | ✅ 完成 | Tauri v2.10.3 支持 iOS/Android |
| 更新 tauri.conf.json | ✅ 完成 | 添加 iOS/Android 配置块 |
| 生成移动端图标 | ✅ 完成 | iOS 图标 17 个，Android 图标 15 个 |
| 初始化 Android 项目 | ✅ 完成 | 生成完整 Gradle 构建配置 |
| 配置 Android 权限 | ✅ 完成 | 网络权限、文件存储权限 |
| 安装 Android NDK | ✅ 完成 | NDK 27.0.12077973 |
| 安装 Rust Android 目标 | ✅ 完成 | aarch64, armv7, i686, x86_64 |
| GitHub Actions 自动构建 | ✅ 完成 | 自动构建 APK/IPA |
| Android APK 签名 | ✅ 完成 | 使用 keystore 签名 |
| iOS IPA 构建 | ✅ 完成 | 模拟器版本 |
| v0.3.2 发布 | ✅ 完成 | GitHub Releases 已发布 |

### 待完成 ⏳

| 步骤 | 状态 | 阻塞原因 |
|------|------|---------|
| iOS 真机构建 | ⏳ 待完成 | 需要 macOS + Xcode + Apple Developer 账号 |
| 发布到 Google Play | ⏳ 待完成 | 需要 Google Play 开发者账号 |
| 发布到 App Store | ⏳ 待完成 | 需要 Apple Developer 账号 |

### 环境要求

**iOS 开发**：
- 操作系统：macOS
- Xcode 15+
- Apple Developer 账号（发布需要）

**Android 开发**：
- Android SDK（可通过 Android Studio 安装）
- JDK 17+
- 设置 `ANDROID_HOME` 环境变量

### 安装 Android SDK 步骤

1. 下载 Android Studio：https://developer.android.com/studio
2. 安装后打开 Android Studio
3. 进入 SDK Manager（Tools > SDK Manager）
4. 安装 Android SDK 34+
5. 设置环境变量：
   ```powershell
   # Windows PowerShell
   [Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\<用户名>\AppData\Local\Android\Sdk", "User")
   ```
6. 重启终端后运行：
   ```bash
   pnpm tauri android init
   ```

---

## 一、问题分析

### 1.1 当前状态

| 项目 | 当前状态 | 目标状态 |
|------|---------|---------|
| Tauri 版本 | v2.0.0 | v2.0.0 (已支持移动端) |
| iOS 配置 | 未配置 | 完整配置，可构建 IPA |
| Android 配置 | 未配置 | 完整配置，可构建 APK |
| 移动端图标 | 无 | 完整图标集 |
| 移动端权限 | 无 | 配置必要权限 |
| 文件导出 | Tauri 桌面端 | 移动端分享功能 |

### 1.2 Tauri v2 移动端支持

Tauri v2 已原生支持 iOS 和 Android 平台，主要优势：
- 单一代码库，跨平台共享
- Rust 后端计算，性能优异
- 前端响应式布局已完成（v0.3.0/v0.3.1）
- 触摸手势支持已完成

### 1.3 需要解决的问题

| 问题类型 | 具体描述 | 严重程度 |
|---------|---------|---------|
| iOS 项目未初始化 | 缺少 `src-tauri/gen/apple` 目录 | 🔴 高 |
| Android 项目未初始化 | 缺少 `src-tauri/gen/android` 目录 | 🔴 高 |
| 移动端图标缺失 | 缺少 iOS/Android 专用图标 | 🔴 高 |
| 移动端权限未配置 | 文件访问、分享权限未声明 | 🔴 高 |
| 移动端导出功能 | 需适配移动端文件保存方式 | 🟡 中 |
| 窗口配置 | 移动端需要全屏显示 | 🟡 中 |

---

## 二、优化目标

### 2.1 本次开发目标

| 指标 | 当前状态 | 目标状态 | 衡量方式 |
|------|---------|---------|---------|
| iOS 构建 | 不支持 | 可构建 IPA | `pnpm tauri ios build` 成功 |
| Android 构建 | 不支持 | 可构建 APK | `pnpm tauri android build` 成功 |
| 移动端图标 | 缺失 | 完整图标集 | 图标显示正确 |
| 移动端导出 | 仅桌面端 | 分享功能可用 | 可导出文件 |

### 2.2 分阶段目标

| 阶段 | 目标 | 预期成果 |
|------|------|---------|
| 第一阶段 | 环境准备与配置 | Tauri 移动端配置完成 |
| 第二阶段 | iOS 项目初始化 | 可构建 iOS 应用 |
| 第三阶段 | Android 项目初始化 | 可构建 Android 应用 |
| 第四阶段 | 移动端功能适配 | 导出功能可用 |
| 第五阶段 | 测试与发布 | v0.3.2 发布 |

---

## 三、实施步骤

### 第一阶段：环境准备与配置（预计 0.5 天）

#### 3.1.1 检查开发环境

**前置条件检查**：

| 环境 | iOS 开发 | Android 开发 |
|------|---------|---------|
| 操作系统 | macOS | macOS/Linux/Windows |
| SDK | Xcode 15+ | Android SDK 34+ |
| 其他 | Apple Developer 账号 | JDK 17+ |

**验证命令**：
```bash
# 检查 Tauri CLI 移动端支持
pnpm tauri --help | grep -E "ios|android"

# macOS 检查 Xcode
xcodebuild -version

# 检查 Android SDK（如果已安装）
adb version
```

---

#### 3.1.2 更新 Tauri 配置文件

**文件**：`src-tauri/tauri.conf.json`

**添加移动端配置**：
```json
{
  "productName": "CamForge-Next",
  "version": "0.3.2",
  "identifier": "top.camforge.next",

  "ios": {
    "minimumSystemVersion": "13.0",
    "developmentTeam": "YOUR_TEAM_ID"
  },

  "android": {
    "minSdkVersion": 24
  },

  "app": {
    "windows": [
      {
        "label": "main",
        "title": "CamForge-Next",
        "width": 1400,
        "height": 900,
        "minWidth": 1200,
        "minHeight": 800,
        "decorations": false,
        "visible": false,
        "focus": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws://localhost:*/ http://localhost:*/"
    },
    "withGlobalTauri": true
  },

  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "iOS": {
      "icon": [
        "icons/apple/20x20@1x.png",
        "icons/apple/20x20@2x.png",
        "icons/apple/20x20@3x.png",
        "icons/apple/29x29@1x.png",
        "icons/apple/29x29@2x.png",
        "icons/apple/29x29@3x.png",
        "icons/apple/40x40@1x.png",
        "icons/apple/40x40@2x.png",
        "icons/apple/40x40@3x.png",
        "icons/apple/60x60@2x.png",
        "icons/apple/60x60@3x.png",
        "icons/apple/76x76@1x.png",
        "icons/apple/76x76@2x.png",
        "icons/apple/83.5x83.5@2x.png",
        "icons/apple/1024x1024@1x.png"
      ]
    },
    "android": {
      "icon": [
        "icons/android/36x36.png",
        "icons/android/48x48.png",
        "icons/android/72x72.png",
        "icons/android/96x96.png",
        "icons/android/144x144.png",
        "icons/android/192x192.png",
        "icons/android/512x512.png"
      ]
    },
    "windows": {
      "nsis": {
        "installMode": "currentUser",
        "languages": ["SimpChinese", "English"],
        "installerIcon": "icons/icon.ico",
        "headerImage": null,
        "sidebarImage": null
      }
    }
  }
}
```

**验证方法**：
- [ ] 配置文件语法正确（JSON 格式）
- [ ] iOS/Android 配置块存在
- [ ] 版本号更新为 0.3.2

---

#### 3.1.3 生成移动端图标

**图标规格要求**：

**iOS 图标**（存放于 `src-tauri/icons/apple/`）：
| 尺寸 | 文件名 | 用途 |
|------|--------|------|
| 20x20 | 20x20@1x.png | Notification |
| 40x20 | 20x20@2x.png | Notification @2x |
| 60x20 | 20x20@3x.png | Notification @3x |
| 29x29 | 29x29@1x.png | Settings |
| 58x29 | 29x29@2x.png | Settings @2x |
| 87x29 | 29x29@3x.png | Settings @3x |
| 40x40 | 40x40@1x.png | Spotlight |
| 80x40 | 40x40@2x.png | Spotlight @2x |
| 120x40 | 40x40@3x.png | Spotlight @3x |
| 120x60 | 60x60@2x.png | App Icon @2x |
| 180x60 | 60x60@3x.png | App Icon @3x |
| 76x76 | 76x76@1x.png | iPad |
| 152x76 | 76x76@2x.png | iPad @2x |
| 167x83.5 | 83.5x83.5@2x.png | iPad Pro |
| 1024x1024 | 1024x1024@1x.png | App Store |

**Android 图标**（存放于 `src-tauri/icons/android/`）：
| 尺寸 | 文件名 | 密度 |
|------|--------|------|
| 36x36 | 36x36.png | ldpi |
| 48x48 | 48x48.png | mdpi |
| 72x72 | 72x72.png | hdpi |
| 96x96 | 96x96.png | xhdpi |
| 144x144 | 144x144.png | xxhdpi |
| 192x192 | 192x192.png | xxxhdpi |
| 512x512 | 512x512.png | Play Store |

**生成方法**：
```bash
# 使用 Tauri CLI 生成图标（需要源图标 1024x1024 或 512x512）
pnpm tauri icon src-tauri/icons/icon.png

# 或手动使用 ImageMagick
# 示例：生成 iOS 60x60@2x
convert public/logo.png -resize 120x120 src-tauri/icons/apple/60x60@2x.png
```

**验证方法**：
- [ ] iOS 图标目录存在，包含所有尺寸
- [ ] Android 图标目录存在，包含所有尺寸
- [ ] 图标格式为 PNG，无透明度问题

---

### 第二阶段：iOS 项目初始化（预计 1 天）

#### 3.2.1 初始化 iOS 项目

**执行命令**（需要 macOS）：
```bash
# 初始化 iOS 项目
pnpm tauri ios init

# 或使用 Tauri CLI
cargo tauri ios init
```

**生成的目录结构**：
```
src-tauri/gen/apple/
├── CamForge-Next/
│   ├── CamForge-Next/
│   │   ├── Assets.xcassets/
│   │   ├── AppDelegate.swift
│   │   ├── ViewController.swift
│   │   └── Info.plist
│   ├── CamForge-Next.xcodeproj/
│   └── CamForge-Next.entitlements
└── ExportOptions.plist
```

**验证方法**：
- [ ] `src-tauri/gen/apple` 目录存在
- [ ] Xcode 项目文件存在
- [ ] Info.plist 配置正确

---

#### 3.2.2 配置 iOS 权限

**文件**：`src-tauri/gen/apple/CamForge-Next/CamForge-Next/Info.plist`

**添加权限声明**：
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- 基本配置 -->
    <key>CFBundleDisplayName</key>
    <string>CamForge-Next</string>
    <key>CFBundleIdentifier</key>
    <string>top.camforge.next</string>
    <key>CFBundleVersion</key>
    <string>0.3.2</string>
    <key>CFBundleShortVersionString</key>
    <string>0.3.2</string>

    <!-- 最低系统版本 -->
    <key>MinimumOSVersion</key>
    <string>13.0</string>

    <!-- 支持方向 -->
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>

    <!-- 文件导出支持 -->
    <key>UIFileSharingEnabled</key>
    <true/>
    <key>LSSupportsOpeningDocumentsInPlace</key>
    <true/>

    <!-- 安全配置 -->
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <false/>
    </dict>
</dict>
</plist>
```

**验证方法**：
- [ ] Info.plist 包含必要权限
- [ ] 文件导出权限已启用
- [ ] 支持横竖屏方向

---

#### 3.2.3 配置 iOS Entitlements

**文件**：`src-tauri/gen/apple/CamForge-Next/CamForge-Next.entitlements`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- App Groups（用于文件共享） -->
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.top.camforge.next</string>
    </array>
</dict>
</plist>
```

---

#### 3.2.4 构建 iOS 应用

**执行命令**：
```bash
# 开发构建（模拟器）
pnpm tauri ios build --debug

# 生产构建
pnpm tauri ios build --release

# 指定目标
pnpm tauri ios build --target aarch64-apple-ios
```

**构建产物**：
- Debug: `src-tauri/target/aarch64-apple-ios/debug/`
- Release: `src-tauri/target/aarch64-apple-ios/release/`
- IPA: `src-tauri/target/aarch64-apple-ios/release/bundle/ios/`

**验证方法**：
- [ ] 构建命令执行成功
- [ ] IPA 文件生成
- [ ] 可在模拟器运行

---

### 第三阶段：Android 项目初始化（预计 1 天）

#### 3.3.1 初始化 Android 项目

**执行命令**：
```bash
# 初始化 Android 项目
pnpm tauri android init

# 或使用 Tauri CLI
cargo tauri android init
```

**生成的目录结构**：
```
src-tauri/gen/android/
├── app/
│   ├── src/
│   │   └── main/
│   │       ├── java/top/camforge/next/
│   │       ├── res/
│   │       │   ├── drawable/
│   │       │   ├── mipmap-ldpi/
│   │       │   ├── mipmap-mdpi/
│   │       │   ├── mipmap-hdpi/
│   │       │   ├── mipmap-xhdpi/
│   │       │   ├── mipmap-xxhdpi/
│   │       │   ├── mipmap-xxxhdpi/
│   │       │   └── values/
│   │       └── AndroidManifest.xml
│   ├── build.gradle.kts
│   └── proguard-rules.pro
├── build.gradle.kts
├── gradle.properties
└── settings.gradle.kts
```

**验证方法**：
- [ ] `src-tauri/gen/android` 目录存在
- [ ] Gradle 配置文件存在
- [ ] AndroidManifest.xml 配置正确

---

#### 3.3.2 配置 Android 权限

**文件**：`src-tauri/gen/android/app/src/main/AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- 基本权限 -->
    <uses-permission android:name="android.permission.INTERNET"/>

    <!-- 文件存储权限 -->
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
        android:maxSdkVersion="28"/>
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
        android:maxSdkVersion="32"/>

    <!-- 应用配置 -->
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:usesCleartextTraffic="false">

        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|keyboardHidden|screenSize"
            android:exported="true"
            android:launchMode="singleTask"
            android:screenOrientation="fullSensor"
            android:windowSoftInputMode="adjustResize">

            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>
    </application>
</manifest>
```

**验证方法**：
- [ ] AndroidManifest.xml 包含必要权限
- [ ] 支持全屏方向
- [ ] Activity 配置正确

---

#### 3.3.3 配置 Gradle 构建

**文件**：`src-tauri/gen/android/app/build.gradle.kts`

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "top.camforge.next"
    compileSdk = 34

    defaultConfig {
        applicationId = "top.camforge.next"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "0.3.2"

        ndk {
            abiFilters += listOf("armeabi-v7a", "arm64-v8a", "x86", "x86_64")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
}
```

**验证方法**：
- [ ] Gradle 配置语法正确
- [ ] SDK 版本设置正确
- [ ] ABI 过滤器包含所有架构

---

#### 3.3.4 构建 Android 应用

**执行命令**：
```bash
# 开发构建
pnpm tauri android build --debug

# 生产构建
pnpm tauri android build --release

# 生成 APK
pnpm tauri android build --release --apk

# 生成 AAB（用于 Play Store）
pnpm tauri android build --release --aab
```

**构建产物**：
- APK: `src-tauri/gen/android/app/build/outputs/apk/`
- AAB: `src-tauri/gen/android/app/build/outputs/bundle/`

**验证方法**：
- [ ] 构建命令执行成功
- [ ] APK 文件生成
- [ ] 可在模拟器/真机运行

---

### 第四阶段：移动端功能适配（预计 1 天）

#### 3.4.1 移动端文件导出适配

**问题分析**：
移动端没有传统文件系统访问方式，需要使用系统分享功能。

**解决方案**：使用 `@tauri-apps/plugin-share` 插件

**安装依赖**：
```bash
pnpm add @tauri-apps/plugin-share
```

**更新 Cargo.toml**：
```toml
[dependencies]
tauri-plugin-share = "2"
```

**修改文件**：`src/api/tauri.ts`

```typescript
import { share } from '@tauri-apps/plugin-share';

// 检测是否为移动端
function isMobilePlatform(): boolean {
  const platform = navigator.platform || navigator.userAgent;
  return /Android|iPhone|iPad|iPod/i.test(platform);
}

// 移动端文件保存（使用分享功能）
export async function saveFileMobile(
  data: Blob | string,
  filename: string,
  mimeType: string
): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    // 将数据转换为 Uint8Array
    let uint8Array: Uint8Array;
    if (typeof data === 'string') {
      uint8Array = new TextEncoder().encode(data);
    } else {
      uint8Array = new Uint8Array(await data.arrayBuffer());
    }

    // 使用分享功能
    await share({
      files: [{
        name: filename,
        mimeType: mimeType,
        data: uint8Array
      }]
    });

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// 统一文件保存接口（自动检测平台）
export async function saveFileUniversal(
  data: Blob | string,
  filename: string,
  mimeType: string,
  options?: { saveDir?: string }
): Promise<{ success: boolean; path?: string; error?: string }> {
  if (isMobilePlatform()) {
    return saveFileMobile(data, filename, mimeType);
  } else {
    // 桌面端使用原有逻辑
    return saveFile(data, filename, mimeType, options);
  }
}
```

**验证方法**：
- [ ] 移动端可调用分享功能
- [ ] 文件可保存到相册/文件 App
- [ ] 桌面端功能不受影响

---

#### 3.4.2 移动端窗口配置

**问题分析**：
移动端应用需要全屏显示，不需要窗口装饰。

**解决方案**：在 tauri.conf.json 中配置移动端窗口

```json
{
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "CamForge-Next",
        // 桌面端配置
        "width": 1400,
        "height": 900,
        "minWidth": 1200,
        "minHeight": 800,
        "decorations": false,
        // 移动端自动全屏
        "fullscreen": false,
        "visible": false,
        "focus": true
      }
    ]
  }
}
```

**注意**：Tauri v2 移动端会自动处理窗口全屏，无需额外配置。

---

#### 3.4.3 移动端性能优化

**优化点**：

1. **动画帧率自适应**
```typescript
// src/components/animation/CamAnimation.tsx
function getOptimalFrameRate(): number {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isLowEnd = navigator.hardwareConcurrency <= 4;

  if (isMobile || isLowEnd) {
    return 30;  // 移动端/低端设备降低帧率
  }
  return 60;
}
```

2. **Canvas 渲染优化**
```typescript
// 使用 requestAnimationFrame 控制渲染频率
let lastFrameTime = 0;
const frameInterval = 1000 / getOptimalFrameRate();

function animate(timestamp: number) {
  if (timestamp - lastFrameTime >= frameInterval) {
    // 渲染帧
    lastFrameTime = timestamp;
  }
  requestAnimationFrame(animate);
}
```

**验证方法**：
- [ ] 移动端帧率稳定在 30fps
- [ ] 动画流畅度可接受
- [ ] 内存占用合理

---

### 第五阶段：测试与发布（预计 0.5 天）

#### 3.5.1 测试清单

| 测试项 | iOS | Android | 测试方法 |
|--------|-----|---------|---------|
| 应用启动 | ✓ | ✓ | 模拟器/真机 |
| 参数调整 | ✓ | ✓ | 触摸操作 |
| 动画播放 | ✓ | ✓ | 播放控制 |
| 图表显示 | ✓ | ✓ | 各 Tab 页 |
| 文件导出 | ✓ | ✓ | 分享功能 |
| 横竖屏切换 | ✓ | ✓ | 旋转设备 |
| 深色模式 | ✓ | ✓ | 系统设置 |

---

#### 3.5.2 版本更新清单

| 文件 | 更新内容 | 状态 |
|------|---------|------|
| `package.json` | version: 0.3.2 | [ ] |
| `Cargo.toml` | version: 0.3.2 | [ ] |
| `src-tauri/Cargo.toml` | 添加 tauri-plugin-share | [ ] |
| `src-tauri/tauri.conf.json` | iOS/Android 配置 + version: 0.3.2 | [ ] |
| `src/components/layout/StatusBar.tsx` | 版本号显示: v0.3.2 | [ ] |
| `README.md` | 版本徽章 + 开发路线更新 | [ ] |
| `CHANGELOG.md` | 添加 v0.3.2 更新日志 | [ ] |

---

#### 3.5.3 发布流程

```bash
# 1. 提交代码
git add .
git commit -m "feat: iOS/Android mobile app support (v0.3.2)"

# 2. 推送到 GitHub
git push origin master

# 3. 创建并推送 tag
git tag v0.3.2
git push origin v0.3.2

# 4. 等待 GitHub Actions 构建

# 5. 发布 Release（Draft → Published）
gh release edit v0.3.2 --draft=false
```

---

## 四、验证方法总览

### 4.1 自动化验证

| 验证项 | 命令 | 通过标准 |
|--------|------|---------|
| iOS 构建 | `pnpm tauri ios build --release` | IPA 生成成功 |
| Android 构建 | `pnpm tauri android build --release` | APK 生成成功 |
| 前端测试 | `pnpm test:run` | 所有测试通过 |
| Rust 测试 | `cargo test --workspace` | 所有测试通过 |

### 4.2 手动验证

| 验证项 | 平台 | 测试方法 |
|--------|------|---------|
| 应用启动 | iOS/Android | 模拟器启动测试 |
| 功能完整性 | iOS/Android | 真机功能测试 |
| 导出功能 | iOS/Android | 分享导出测试 |
| 性能表现 | iOS/Android | 帧率/内存监控 |

---

## 五、时间规划

| 阶段 | 预计时间 | 开始日期 | 结束日期 |
|------|---------|---------|---------|
| 第一阶段：环境准备与配置 | 0.5 天 | - | - |
| 第二阶段：iOS 项目初始化 | 1 天 | - | - |
| 第三阶段：Android 项目初始化 | 1 天 | - | - |
| 第四阶段：移动端功能适配 | 1 天 | - | - |
| 第五阶段：测试与发布 | 0.5 天 | - | - |
| **总计** | **4 天** | - | - |

---

## 六、风险评估

| 集险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| iOS 构建环境问题 | 高 | 高 | 需 macOS + Xcode，可使用 CI 构建 |
| Android SDK 配置问题 | 中 | 中 | 使用 Android Studio 自动配置 |
| 签名证书问题 | 高 | 高 | 使用 Apple Developer 账号 |
| 移动端性能不足 | 中 | 中 | 帧率自适应 + 渲染优化 |
| 分享功能兼容性 | 低 | 中 | 使用 Tauri 官方插件 |

---

## 七、相关文件清单

```
需要修改的文件：
├── package.json                         # 版本号 + share 插件
├── Cargo.toml                           # 版本号
├── README.md                            # 版本徽章和开发路线
├── CHANGELOG.md                         # 更新日志
├── src-tauri/
│   ├── Cargo.toml                       # share 插件依赖
│   ├── tauri.conf.json                  # iOS/Android 配置
│   └── icons/
│       ├── apple/                       # iOS 图标目录（新建）
│       └── android/                     # Android 图标目录（新建）
├── src-tauri/gen/                       # 移动端生成目录（新建）
│   ├── apple/                           # iOS 项目
│   └── android/                         # Android 项目
├── src/
│   ├── api/tauri.ts                     # 移动端文件保存适配
│   └── components/layout/StatusBar.tsx  # 版本号显示
```

---

## 八、注意事项

### 8.1 iOS 开发要求

- **必须使用 macOS**：iOS 构建只能在 macOS 上进行
- **Xcode 版本**：需要 Xcode 15 或更高版本
- **Apple Developer 账号**：发布到 App Store 需要付费账号
- **签名证书**：需要配置开发证书和发布证书

### 8.2 Android 开发要求

- **JDK 版本**：需要 JDK 17 或更高版本
- **Android SDK**：需要 SDK 34 或更高版本
- **签名**：发布版 APK 需要签名
- **Play Store**：发布到 Play Store 需要 Google Play 开发者账号

### 8.3 CI/CD 构建

GitHub Actions 可以自动构建移动端应用：
- iOS 构建：使用 `macos-latest` runner
- Android 构建：使用 `ubuntu-latest` runner

---

**文档版本**：v1.0
**创建日期**：2026-04-24
**最后更新**：2026-04-24