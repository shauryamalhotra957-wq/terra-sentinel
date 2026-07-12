import { fireEvent, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the command center and switches scenario presets', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /Humanitarian Risk Command Center/i })).toBeInTheDocument()
    expect(screen.getByText(/City risk/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Heat Health/i }))

    expect(screen.getByRole('slider', { name: /Heat index/i })).toHaveValue('47')
  })

  it('updates controls and exposes briefing actions', () => {
    render(<App />)

    fireEvent.change(screen.getByRole('slider', { name: /Rainfall/i }), { target: { value: '222' } })

    expect(screen.getByRole('slider', { name: /Rainfall/i })).toHaveValue('222')
    expect(screen.getByRole('button', { name: /Export packet/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download district CSV/i })).toBeInTheDocument()
  })

  it('has no obvious accessibility violations in the loaded dashboard', async () => {
    const { container } = render(<App />)
    const results = await axe.run(container, {
      rules: {
        'color-contrast': { enabled: false },
      },
    })

    expect(results.violations).toEqual([])
  })
})
