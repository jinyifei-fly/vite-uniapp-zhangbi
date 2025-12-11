import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages'
import { appName, primaryColor } from './src/settings/index.mjs'

const navBarBg = '#FFFFFF'
const navBarTextColor = '#3b82f6'
const pageBg = '#f8fafc'

export default defineUniPages({
  easycom: {
    autoscan: true,
    custom: {
      '^wd-(.*)': 'wot-design-uni/components/wd-$1/wd-$1.vue',
      '^(?!z-paging-refresh|z-paging-load-more)z-paging(.*)': 'z-paging/components/z-paging$1/z-paging$1.vue',
    },
  },
  pages: [
    // 1. 态势 (Tab 1)
    {
      path: 'pages/index/index',
      aliasPath: '/index',
      name: 'index',
      style: {
        navigationStyle: 'custom',
        navigationBarTitleText: '态势',
        navigationBarBackgroundColor: navBarBg,
        navigationBarTextStyle: navBarTextColor,
      },
    },
    // 2. 剧本 (Tab 2)
    {
      path: 'pages/task/index',
      aliasPath: '/task',
      name: 'goodsIndex',
      style: {
        navigationStyle: 'custom',
        navigationBarTitleText: '剧本',
        navigationBarBackgroundColor: navBarBg,
        navigationBarTextStyle: navBarTextColor,
      },
    },
    // 3. 商品/资产 (Tab 3) - 【新增：必须放在主包】
    {
      path: 'pages/goods/index',
      aliasPath: '/goods',
      name: 'goods',
      style: {
        navigationStyle: 'custom',
        navigationBarTitleText: '商品',
        navigationBarBackgroundColor: navBarBg,
        navigationBarTextStyle: navBarTextColor,
      },
    },
    // 4. 我的 (Tab 4)
    {
      path: 'pages/user/index',
      aliasPath: '/user',
      name: 'user',
      style: {
        navigationStyle: 'custom',
        navigationBarTitleText: '我的',
        navigationBarBackgroundColor: navBarBg,
        navigationBarTextStyle: navBarTextColor,
      },
    },
    // 其他普通页面
    {
      path: 'pages/task/index',
      aliasPath: '/task',
      name: 'taskIndex',
      style: {
        navigationStyle: 'custom',
        navigationBarTitleText: '剧本任务',
        navigationBarBackgroundColor: navBarBg,
        navigationBarTextStyle: navBarTextColor,
      },
    },
    {
      path: 'pages/login/index',
      aliasPath: '/login',
      name: 'login',
      style: {
        navigationStyle: 'custom',
        navigationBarTitleText: '登录',
        navigationBarBackgroundColor: navBarBg,
        navigationBarTextStyle: navBarTextColor,
      },
    },
  ],
  // 底部导航栏配置 (逻辑路由，视觉上被 CustomTabBar 覆盖)
  tabBar: {
    color: '#9ca3af',
    selectedColor: primaryColor || '#3b82f6',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '态势',
      },
      {
        pagePath: 'pages/goods/index',
        text: '剧本',
      },
      {
        pagePath: 'pages/goods/stock/index',
        text: '商品',
      },
      {
        pagePath: 'pages/user/index',
        text: '我的',
      },
    ],
  },
  globalStyle: {
    navigationBarTitleText: appName,
    navigationBarBackgroundColor: navBarBg,
    navigationBarTextStyle: navBarTextColor,
    backgroundColor: pageBg,
  },
})
