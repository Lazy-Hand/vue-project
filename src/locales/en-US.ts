export default {
  common: {
    appName: 'Vue Project',
    console: 'Console',
    user: 'User',
    logout: 'Sign out',
    home: 'Home',
  },
  login: {
    title: 'Vue Project',
    subtitle: 'Sign in with your account to continue',
    username: 'Username',
    password: 'Password',
    usernameRequired: 'Please enter username',
    passwordRequired: 'Please enter password',
    submit: 'Sign in',
    failed: 'Sign in failed',
  },
  home: {
    welcome: 'Welcome, {name}',
    tip: 'Use the sidebar to open features. Admin pages are placeholders; auth and dynamic routes are ready.',
  },
  accountSet: {
    placeholder: 'Account set',
    switchFailed: 'Failed to switch account set',
  },
  placeholder: {
    developing: 'Coming soon. This is a placeholder page.',
  },
} as const
