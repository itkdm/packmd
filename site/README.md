# PackMD GitHub Pages 展示页面

这是 PackMD uTools 插件的 GitHub Pages 展示页面。

**最后更新**: 2026年1月

## 文件说明

- `index.html` - 主展示页面，包含功能介绍、使用说明等
- `hero-template.html` - 首屏规范模板（参考用）
- `HERO_TEMPLATE_README.md` - 模板说明文档

## 部署到 GitHub Pages

### 方法一：使用 GitHub Actions（推荐）

1. 在仓库根目录创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Pages
        uses: actions/configure-pages@v4
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './site'
      
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

2. 在仓库设置中启用 GitHub Pages，选择 "GitHub Actions" 作为源。

### 方法二：使用 gh-pages 分支

1. 将 `site` 目录的内容推送到 `gh-pages` 分支
2. 在仓库设置中启用 GitHub Pages，选择 `gh-pages` 分支作为源

### 方法三：使用 docs 目录

1. 将 `site` 目录重命名为 `docs`
2. 在仓库设置中启用 GitHub Pages，选择 `docs` 目录作为源

## 本地预览

可以使用任何静态文件服务器预览，例如：

```bash
# 使用 Python
cd site
python -m http.server 8000

# 使用 Node.js http-server
npx http-server site -p 8000

# 使用 VS Code Live Server 插件
```

然后在浏览器中访问 `http://localhost:8000`

## 自定义配置

### 修改 GitHub 链接

在 `index.html` 中搜索并替换：
- `https://github.com/itkdm/packmd` - 实际仓库地址

### 修改 Logo

确保 `../packmd/logo.png` 路径正确，或修改为你的 Logo 路径。

### 修改颜色主题

在 `index.html` 的 `<style>` 标签中修改 CSS 变量：

```css
:root {
  --primary: #0f766e;        /* 主色调 */
  --primary-hover: #0b5f56;  /* 主色调悬停 */
  --bg: #f2f7f8;             /* 背景色 */
  /* ... 其他变量 */
}
```

## SEO 优化

本页面已包含完整的 SEO 优化：

- ✅ Meta 标签（title, description, keywords）
- ✅ Open Graph 标签（社交媒体分享）
- ✅ Twitter Card 标签
- ✅ JSON-LD 结构化数据
- ✅ Sitemap.xml
- ✅ Robots.txt
- ✅ 多语言支持（hreflang）
- ✅ Canonical URL

## 注意事项

1. 确保所有资源路径（如图片）使用相对路径
2. 如果使用 GitHub Pages，确保仓库是公开的（或使用 GitHub Pro）
3. 页面会自动适配移动端，无需额外配置
4. SEO 标签中的 URL 已配置为 `https://itkdm.github.io/packmd/`
5. 如需更新 SEO 信息，请修改 `site/index.html` 中的相关 meta 标签

## 相关链接

- 🌐 在线演示: [https://itkdm.github.io/packmd/](https://itkdm.github.io/packmd/)
- 📦 项目仓库: [https://github.com/itkdm/packmd](https://github.com/itkdm/packmd)
- 📖 项目 README: [../README.md](../README.md)