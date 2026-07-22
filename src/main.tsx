import './react-app/styles/index.css'
import './react-app/modules/public-menu/public-menu.css'

if (window.location.pathname.startsWith('/admin')) {
  void import('./react-app/entry-admin')
} else if (window.location.pathname === '/') {
  void import('./react-app/entry-public')
} else {
  window.location.replace('/')
}
