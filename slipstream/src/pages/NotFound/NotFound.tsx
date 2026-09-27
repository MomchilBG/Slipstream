import { Link } from 'react-router-dom'
import './NotFound.css'

const NotFound = () => (
  <section id="not-found-page">
    <h1>404</h1>
    <p>This page doesn&apos;t exist.</p>
    <Link to="/" className="button primary">
      Back to home
    </Link>
  </section>
)

export default NotFound
