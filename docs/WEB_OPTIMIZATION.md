# CamForge-Next Web 部署优化说明

## Logo 压缩

`public/logo.png` 当前约 996KB，建议压缩至 <100KB。

### 压缩方法

1. 使用在线工具压缩：
   - https://tinypng.com/
   - https://squoosh.app/

2. 或转换为 WebP 格式：
   ```bash
   # 使用 ImageMagick
   convert public/logo.png -quality 80 public/logo.webp
   ```

3. 更新 index.html 使用 WebP：
   ```html
   <picture>
     <source srcset="/logo.webp" type="image/webp">
     <img src="/logo.png" alt="CamForge-Next Logo">
   </picture>
   ```

## 其他优化

- `apple-touch-icon.png` 已添加（180x180）
- `robots.txt` 已添加
- `manifest.json` 已添加（PWA 配置）