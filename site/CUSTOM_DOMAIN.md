# 自定义域名配置指南

## 已完成的配置

✅ 已创建 `CNAME` 文件，内容为：`packmd.itkdm.com`
✅ 已更新所有 SEO 标签中的域名为自定义域名
✅ 已更新 sitemap.xml 和 robots.txt 中的域名

## 需要完成的 DNS 配置

### 方法一：CNAME 记录（推荐）

在你的 DNS 提供商（如 Cloudflare、阿里云、腾讯云等）添加以下 CNAME 记录：

```
类型: CNAME
主机记录: packmd
记录值: itkdm.github.io
TTL: 600（或默认值）
```

### 方法二：A 记录

如果使用 A 记录，需要添加以下 IP 地址：

```
类型: A
主机记录: packmd
记录值: 
  185.199.108.153
  185.199.109.153
  185.199.110.153
  185.199.111.153
TTL: 600（或默认值）
```

**注意**：GitHub Pages 的 IP 地址可能会变化，建议使用 CNAME 记录。

## GitHub 仓库设置

1. 进入仓库：https://github.com/itkdm/packmd
2. 打开 **Settings** → **Pages**
3. 在 **Custom domain** 中输入：`packmd.itkdm.com`
4. 勾选 **Enforce HTTPS**（等待 DNS 生效后）
5. 点击 **Save**

## 验证配置

### 1. 检查 DNS 是否生效

在命令行运行：

```bash
# Windows
nslookup packmd.itkdm.com

# Linux/Mac
dig packmd.itkdm.com
```

应该能看到指向 `itkdm.github.io` 的 CNAME 记录。

### 2. 检查 GitHub Pages 设置

在 GitHub 仓库的 Settings → Pages 页面，应该看到：
- ✅ Custom domain: `packmd.itkdm.com`
- ✅ DNS check: ✅ DNS configured correctly
- ✅ HTTPS: ✅ Certificate issued（可能需要等待几分钟到几小时）

### 3. 访问测试

等待 DNS 生效后（通常 5-30 分钟），访问：
- http://packmd.itkdm.com
- https://packmd.itkdm.com（启用 HTTPS 后）

## 常见问题

### 问题：DNS check 一直显示失败

**解决方案**：
1. 确认 DNS 记录已正确添加
2. 等待 DNS 传播（最长可能需要 48 小时）
3. 检查 DNS 记录类型是否正确（CNAME 或 A 记录）
4. 确认主机记录是否正确（应该是 `packmd`，不是 `packmd.itkdm.com`）

### 问题：HTTPS 证书未签发

**解决方案**：
1. 等待 DNS 完全生效
2. 在 GitHub Pages 设置中取消勾选再重新勾选 "Enforce HTTPS"
3. 等待 GitHub 自动签发证书（可能需要几小时）

### 问题：访问显示 404

**解决方案**：
1. 确认 GitHub Actions 部署成功
2. 确认 `site` 目录下有 `CNAME` 文件
3. 检查 GitHub Pages 设置中的 Source 是否为 "GitHub Actions"

## 注意事项

- DNS 传播可能需要时间，请耐心等待
- GitHub 会自动为自定义域名签发 SSL 证书
- 如果修改了域名，需要更新所有文件中的 URL 引用
- 建议同时保留 `itkdm.github.io/packmd` 作为备用访问地址
