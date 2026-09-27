import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PostSummaryCard from '../../components/PostSummaryCard/PostSummaryCard'
import { useAuth } from '../../auth/AuthContext'
import { getMostCommentedPosts, getMostRecentPosts, getPlatformStats } from '../../lib/posts'
import type { PlatformStats, PostSummary } from '../../lib/posts'
import './Home.css'

const features = [
  { title: 'Post & discuss', description: 'Share posts and reply to other riders — from bike builds to route reports.' },
  { title: 'Tags & search', description: 'Find posts fast by searching tags like "gravel" or "maintenance".' },
  { title: 'Reputation & badges', description: 'Earn reputation from upvotes and unlock badges as you contribute.' },
  { title: 'Light & dark mode', description: 'Switch themes any time with the toggle in the navbar.' },
]

const Home = () => {
  const { user } = useAuth()
  const [stats, setStats] = useState<PlatformStats>({ userCount: 0, postCount: 0 })
  const [mostCommented, setMostCommented] = useState<PostSummary[]>([])
  const [mostRecent, setMostRecent] = useState<PostSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([getPlatformStats(), getMostCommentedPosts(), getMostRecentPosts()]).then(
      ([statsResult, mostCommentedResult, mostRecentResult]) => {
        if (cancelled) return
        setStats(statsResult)
        setMostCommented(mostCommentedResult)
        setMostRecent(mostRecentResult)
        setLoading(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <section id="hero">
        <h1>Welcome to Slipstream</h1>
        <p>A place for cyclists to share builds, routes, and advice.</p>
        <div id="hero-stats">
          <div>
            <strong>{stats.userCount.toLocaleString()}</strong>
            <span>riders joined</span>
          </div>
          <div>
            <strong>{stats.postCount.toLocaleString()}</strong>
            <span>posts created</span>
          </div>
        </div>
        {!user && (
          <div id="hero-cta">
            <Link to="/register" className="button primary">
              Join the forum
            </Link>
            <Link to="/login" className="button">
              Log in
            </Link>
          </div>
        )}
      </section>

      <section id="features">
        {features.map((feature) => (
          <div key={feature.title} className="feature-card">
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </div>
        ))}
      </section>

      <section id="post-lists">
        <div>
          <h2>Most commented</h2>
          {loading ? (
            <p>Loading…</p>
          ) : mostCommented.length === 0 ? (
            <p>No posts yet — be the first to create one.</p>
          ) : (
            <ul>
              {mostCommented.map((post) => (
                <PostSummaryCard key={post.id} post={post} />
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2>Most recent</h2>
          {loading ? (
            <p>Loading…</p>
          ) : mostRecent.length === 0 ? (
            <p>No posts yet — be the first to create one.</p>
          ) : (
            <ul>
              {mostRecent.map((post) => (
                <PostSummaryCard key={post.id} post={post} />
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  )
}

export default Home
