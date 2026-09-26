import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ScreeningQuestion from '../pages/ScreeningQuestion';
import { ScreeningProvider, useScreening } from '../context/ScreeningContext';

function TestHarness({ initialScreeningId, hasActiveScreening }) {
  const { startScreening, resetCurrentScreening } = useScreening();

  return (
    <div>
      <button 
        data-testid="start-btn" 
        onClick={() => startScreening({ name: 'Adaeze Obi', fileNumber: 'PHC-001' })}
      >
        Start
      </button>
      <button 
        data-testid="reset-btn" 
        onClick={() => resetCurrentScreening()}
      >
        Reset
      </button>
      <ScreeningQuestion />
    </div>
  );
}

describe('R1: ScreeningQuestion Hook Order Integrity', () => {
  it('renders gracefully with no active screening without throwing React Rules of Hooks errors', () => {
    render(
      <MemoryRouter initialEntries={['/screening/non-existent-id']}>
        <ScreeningProvider>
          <Routes>
            <Route path="/screening/:id" element={<ScreeningQuestion />} />
          </Routes>
        </ScreeningProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('No active screening found')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });

  it('transitions between no-active-screening and active-screening without hook count mismatch errors', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/screening/12345']}>
        <ScreeningProvider>
          <Routes>
            <Route 
              path="/screening/:id" 
              element={<TestHarness initialScreeningId="12345" hasActiveScreening={false} />} 
            />
          </Routes>
        </ScreeningProvider>
      </MemoryRouter>
    );

    // Initial state: No active screening
    expect(screen.getByText('No active screening found')).toBeInTheDocument();

    // Start screening (transitions from no screening to active screening)
    act(() => {
      screen.getByTestId('start-btn').click();
    });

    // Reset screening (transitions back to no active screening)
    act(() => {
      screen.getByTestId('reset-btn').click();
    });

    expect(screen.getByText('No active screening found')).toBeInTheDocument();
    unmount();
  });
});
