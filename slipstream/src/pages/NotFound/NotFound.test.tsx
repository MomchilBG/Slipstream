import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotFound from './NotFound'

describe('NotFound', () => {
  it('shows a 404 message with a link back home', () => {
    render(<NotFound />, { wrapper: MemoryRouter })

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
  })
})
