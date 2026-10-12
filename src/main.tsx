import './react-app/styles/tailwind.css'

const path = window.location.pathname

if (path === '/admin' || path.startsWith('/admin/')) {
  void import('./react-app/entry-admin')
} else if (path === '/' || /^\/produtos\/[^/]+\/[^/]+$/.test(path)) {
  void import('./react-app/entry-public')
}
