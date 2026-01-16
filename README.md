# Vite Uniapp Template

🚀 **以实用为先的 uni-app 起手模板。** [查看演示](https://vite-uniapp-template.netlify.app/)

该模板为您的 uni-app 项目提供一个强大的起点，集成了现代化工具与清晰的工程约定，简化开发流程。

## 核心特性

- 💪 优化的资源管理：无缝切换本地与远程静态资源，适配小程序包体限制。
- 📦 智能分包：清晰直观的 `pages` 结构，结合配置快速实现功能分包。
- 🧭 类 VueRouter 路由：集成 `uniapp-router-next` 并增强拦截器、中间件与路由别名。
- 📊 Pinia 状态管理：简洁直观的状态管理方案。
- ⚡ 现代请求工作流：集成 Alova，简化数据获取与管理。
- 👇 内置 Z-Paging：高性能下拉刷新/上拉加载组件。
- 💎 Unocss 原子化 CSS：轻量且适配小程序环境。
- 🎨 轻量 UI 与主题化：集成 wot-design-uni，支持主题定制。
- 📝 专注 JavaScript：适合业务场景与团队熟悉度的技术选择。

## 快速上手

> 请使用 `node@20.0` 及以上版本。

推荐使用 `pnpm` 安装依赖（项目默认配置）。

```shell
pnpm install
```

### 运行项目

在项目根目录执行：

```shell
# H5 平台
pnpm dev:h5

# 微信小程序
pnpm dev:mp-weixin

# Android App
pnpm dev:app-android

# 更多平台请参考 package.json 的 scripts
```

### 使用 HBuilderX

- 将项目文件夹拖入 HBuilderX
- 确保已安装依赖（如未安装，请在根目录执行 `pnpm install`）
- 点击 `/src` 目录下任意文件
- 在 HBuilderX 菜单中选择“运行”，并选择目标平台

## 功能示例

### 新的分包结构

传统分包结构：

```
src/
├── pages/           # 主包页面
│   └── index.vue
├── pages-user/      # 用户相关分包
│   ├── profile.vue
│   └── settings.vue
└── pages-shop/      # 商城相关分包
    ├── list.vue
    └── detail.vue
```

vite-uniapp-template 分包结构：

```
src/
└── pages/
    ├── index/           # 主包页面（必需）
    │   ├── index.vue    # 首页（必需）
    │   ├── category.vue # Tab 页面
    │   └── mine.vue     # Tab 页面
    ├── user/            # 用户分包
    │   ├── login.vue
    │   └── profile.vue
    └── shop/            # 商城分包
        ├── list.vue
        └── detail.vue
```

分包配置示例：

```javascript
// pages.config.js
export default {
  pages: [
    {
      path: 'pages/index/index',
      style: {
        navigationBarTitleText: '首页'
      }
    },
    {
      path: 'pages/index/category',
      style: {
        navigationBarTitleText: '分类'
      }
    }
  ],
  subPackages: [
    {
      root: 'pages/user',
      pages: [
        {
          path: 'login',
          style: { navigationBarTitleText: '登录' }
        }
      ]
    }
  ]
}
```

### 静态资源处理

```bash
# 本地开发 (.env.development)
VITE_ASSETS_MODE=local

# 生产环境 (.env.production)
VITE_ASSETS_MODE=remote
VITE_ASSETS_CDN=https://your-cdn.com/assets
```

示例：

```html
<image src="~@assets/images/logo.png" />
<!-- 开发环境: /src/assets/images/logo.png -->
<!-- 生产环境: https://your-cdn.com/assets/images/logo.png -->
```

更多配置参考 `vite.config.plugins.js` 中的 `useAssetPathResolver` 插件。

### 全局主题定制

使用 `unocss-preset-shades`：

```html
<div class="text-primary-500"></div>
<div class="bg-primary-500"></div>

<!-- 仅在小程序中生效 -->
<div class="uni-mp:border uni-mp:border-primary-500"></div>
```

### 页面导航

与 Vue Router 类似，可通过编程式导航：

```javascript
this.$Router.push({
  path: '/login',
  query: {
    id: 'someId',
  },
})

const userId = this.$Route.query.id
this.$Router.replace('/dashboard')
this.$Router.replaceAll('/home')
```

脚本中（支持自动导入）：

```javascript
const router = useRouter()
const route = useRoute()

router.push('/settings')
console.log(route.query)
```

路由别名：

```javascript
const aliasConfig = {
  path: 'pages/login/index',
  aliasPath: '/login',
}
```

### 路由守卫

```javascript
// 示例: src/permission/login/index.js
router.beforeEach((to, from, next) => {
  // 编写权限校验逻辑
  next()
})

router.afterEach((to, from) => {
  // 导航后逻辑
})
```

### 路由中间件

```javascript
// pages.config.js
const pageConfig = {
  path: '/pages/user/index',
  aliasPath: '/user',
  meta: {
    middleware: ['test'],
  },
}
```

定义中间件：

```javascript
import { defineMiddleware } from '$uni-router'
import testMiddlewareLogic from './test/index.js'

export default (app, router) => {
  defineMiddleware('test', testMiddlewareLogic, { router, app })
}
```

## 常见问题

- **依赖安装/启动失败**：
  遇到问题可尝试删除 `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json` 后重新安装。
- **路由守卫陷入循环**：
  守卫中页面跳转请使用实际路径，避免使用别名（aliasPath）。