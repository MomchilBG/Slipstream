import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import SearchBar from './SearchBar'

const LocationProbe = () => {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

const renderSearchBar = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <SearchBar />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )

describe('SearchBar', () => {
  it('navigates to /posts with no query when submitted empty', async () => {
    const user = userEvent.setup()
    renderSearchBar()

    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/posts')
  })

  it('navigates with the typed query in posts mode', async () => {
    const user = userEvent.setup()
    renderSearchBar()

    await user.type(screen.getByRole('searchbox'), 'disc brakes')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/posts?q=disc%20brakes')
  })

  it('prefixes every token with # when Tags mode is selected', async () => {
    const user = userEvent.setup()
    renderSearchBar()

    await user.click(screen.getByRole('button', { name: 'Search type' }))
    await user.click(screen.getByRole('option', { name: 'Tags' }))
    await user.type(screen.getByRole('searchbox'), 'gravel commuting')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/posts?q=%23gravel%20%23commuting')
  })

  it('prefixes with u/ when Users mode is selected', async () => {
    const user = userEvent.setup()
    renderSearchBar()

    await user.click(screen.getByRole('button', { name: 'Search type' }))
    await user.click(screen.getByRole('option', { name: 'Users' }))
    await user.type(screen.getByRole('searchbox'), 'alice')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/posts?q=u%2Falice')
  })

  it('closes the mode menu on Escape', async () => {
    const user = userEvent.setup()
    renderSearchBar()

    await user.click(screen.getByRole('button', { name: 'Search type' }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
