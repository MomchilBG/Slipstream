import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MentionText from './MentionText'

const renderText = (text: string) => render(<MentionText text={text} />, { wrapper: MemoryRouter })

describe('MentionText', () => {
  it('renders plain text with no mentions unchanged', () => {
    const { container } = renderText('Nice writeup, thanks for sharing!')

    expect(container).toHaveTextContent('Nice writeup, thanks for sharing!')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('turns an @username token into a link to that profile', () => {
    renderText('Thanks @alexr for the tips')

    const link = screen.getByRole('link', { name: '@alexr' })
    expect(link).toHaveAttribute('href', '/users/alexr')
  })

  it('links every mention when there are several', () => {
    renderText('@alexr and @bob both helped')

    expect(screen.getByRole('link', { name: '@alexr' })).toHaveAttribute('href', '/users/alexr')
    expect(screen.getByRole('link', { name: '@bob' })).toHaveAttribute('href', '/users/bob')
  })

  it('lowercases the username in the href even if typed with different casing', () => {
    renderText('@AlexR thanks!')

    expect(screen.getByRole('link', { name: '@AlexR' })).toHaveAttribute('href', '/users/alexr')
  })

  it('preserves surrounding text around a mention', () => {
    const { container } = renderText('cc @alexr please review')

    expect(container).toHaveTextContent('cc @alexr please review')
  })

  it('does not linkify a mention shorter than 3 characters', () => {
    renderText('see @ab over there')

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('does not linkify the domain part of an email address', () => {
    renderText('email me at bob@example.com for details')

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('still linkifies a real mention that follows an email in the same message', () => {
    renderText('email bob@example.com or ping @alexr directly')

    expect(screen.queryByRole('link', { name: '@example' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '@alexr' })).toHaveAttribute('href', '/users/alexr')
  })
})
