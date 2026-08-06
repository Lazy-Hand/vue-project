export default {
  common: {
    appName: 'Vue Project',
    console: '控制台',
    user: '用户',
    logout: '退出登录',
    home: '首页',
  },
  login: {
    title: 'Vue Project',
    subtitle: '使用账号登录以继续',
    username: '用户名',
    password: '密码',
    usernameRequired: '请输入用户名',
    passwordRequired: '请输入密码',
    submit: '登录',
    failed: '登录失败',
  },
  home: {
    welcome: '欢迎，{name}',
    tip: '从左侧菜单进入系统功能。管理页目前为占位骨架，权限与动态路由已接通。',
  },
  accountSet: {
    placeholder: '选择账套',
    switchFailed: '切换账套失败',
  },
  placeholder: {
    developing: '功能开发中，当前为占位页面。',
  },
} as const
