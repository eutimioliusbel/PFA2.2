/**
 * @file FormulaBuilder.test.tsx
 * @description Component tests for FormulaBuilder
 * ADR-007 Task 5.3: Formula Builder Component Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormulaBuilder from '../../components/admin/FormulaBuilder';

// Mock kpiCalculator
vi.mock('../../services/kpiCalculator', () => ({
  kpiCalculator: {
    getAvailableFields: () => [
      { name: 'cost', description: 'Total cost' },
      { name: 'monthlyRate', description: 'Monthly rental rate' },
      { name: 'quantity', description: 'Quantity' }
    ],
    getExampleFormulas: () => [
      { name: 'Cost with Tax', formula: '{cost} * 1.15' },
      { name: 'Annual Cost', formula: '{monthlyRate} * 12' }
    ],
    validateFormula: (formula: string) => {
      // Check if formula contains valid field patterns
      const fieldPattern = /\{(cost|monthlyRate|quantity|forecastStart|forecastEnd)\}/;
      if (fieldPattern.test(formula)) {
        const variables = formula.match(/\{(\w+)\}/g) || [];
        return {
          valid: true,
          variables: variables.map((v) => v.replace(/[{}]/g, ''))
        };
      }
      return {
        valid: false,
        error: 'Invalid formula syntax'
      };
    },
    testFormula: (formula: string, record: any) => {
      try {
        // Simple formula evaluation for test purposes
        const cleanFormula = formula.replace(/\{cost\}/g, record.cost.toString())
          .replace(/\{monthlyRate\}/g, record.monthlyRate.toString())
          .replace(/\{quantity\}/g, record.quantity.toString());

        // Use eval for simple arithmetic (test environment only)
        const result = eval(cleanFormula);
        return { success: true, value: result };
      } catch (err) {
        return { success: false, error: 'Test failed' };
      }
    },
    formatValue: (value: number, format: string) => {
      if (format === 'currency') return `$${value}`;
      if (format === 'percent') return `${value}%`;
      return value.toString();
    }
  }
}));

// Mock fetch
global.fetch = vi.fn();

describe('FormulaBuilder', () => {
  const mockOrganizationId = 'test-org-123';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('pfa_auth_token', 'test-token-123');

    // Default mock for fetching KPIs
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ kpis: [] })
    });
  });

  describe('Component Rendering', () => {
    it('renders formula builder header', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByText('Formula Builder')).toBeInTheDocument();
      });
    });

    it('renders create new KPI form', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByText('Create New KPI')).toBeInTheDocument();
        expect(screen.getByLabelText(/KPI Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);
      // Check for the spinner element by class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Formula Validation', () => {
    it('validates formula in real-time with debounce', async () => {
      const user = userEvent.setup();
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/KPI Formula/i);
      await user.type(input, '{cost} * 1.15');

      // Wait for debounce and validation
      await waitFor(() => {
        const validationDiv = document.getElementById('formula-validation');
        expect(validationDiv).toHaveTextContent(/Valid formula/i);
      }, { timeout: 500 });
    });

    it('shows error for invalid formula', async () => {
      const user = userEvent.setup();
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/KPI Formula/i);
      await user.type(input, 'invalid formula');

      await waitFor(() => {
        const validationDiv = document.getElementById('formula-validation');
        expect(validationDiv).toHaveTextContent(/Invalid formula syntax/i);
      }, { timeout: 500 });
    });

    it('displays validation timing', async () => {
      const user = userEvent.setup();
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/KPI Formula/i);
      await user.type(input, '{cost} * 2');

      await waitFor(() => {
        expect(screen.getByText(/ms\)/i)).toBeInTheDocument();
      }, { timeout: 500 });
    });
  });

  describe('Autocomplete Functionality', () => {
    it('shows autocomplete on { key press', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/KPI Formula/i);
      fireEvent.keyDown(input, { key: '{' });

      await waitFor(() => {
        expect(screen.getByText('AVAILABLE FIELDS')).toBeInTheDocument();
        expect(screen.getByText('{cost}')).toBeInTheDocument();
        expect(screen.getByText('{monthlyRate}')).toBeInTheDocument();
      });
    });

    it('closes autocomplete on Escape key', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/KPI Formula/i);
      fireEvent.keyDown(input, { key: '{' });

      await waitFor(() => {
        expect(screen.getByText('AVAILABLE FIELDS')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('AVAILABLE FIELDS')).not.toBeInTheDocument();
      });
    });

    it('navigates autocomplete with arrow keys', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/KPI Formula/i);
      fireEvent.keyDown(input, { key: '{' });

      await waitFor(() => {
        expect(screen.getByText('{cost}')).toBeInTheDocument();
      });

      // ArrowDown should highlight next item
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      // First item should lose selection, second should gain it
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'false');
      expect(options[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('inserts field on Enter key', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/KPI Formula/i) as HTMLInputElement;
      fireEvent.keyDown(input, { key: '{' });

      await waitFor(() => {
        expect(screen.getByText('{cost}')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(input.value).toContain('{cost}');
      });
    });
  });

  describe('Test Formula', () => {
    it('tests formula with sample data', async () => {
      const user = userEvent.setup({ delay: null });
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/KPI Formula/i);
      await user.type(input, '{cost} * 2');

      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Wait for validation to complete
      await waitFor(() => {
        const validationDiv = document.getElementById('formula-validation');
        expect(validationDiv).toHaveTextContent(/Valid formula/i);
      }, { timeout: 500 });

      const testButton = screen.getByText('Test Formula');
      await user.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Test Result:/i)).toBeInTheDocument();
      }, { timeout: 500 });

      // Check the result value is shown
      const resultText = screen.getByText(/Test Result:/i).parentElement?.textContent;
      expect(resultText).toContain('2000');
    });

    it('disables test button when formula is empty', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByText('Test Formula')).toBeInTheDocument();
      });

      const testButton = screen.getByText('Test Formula');
      expect(testButton).toBeDisabled();
    });
  });

  describe('KPI Creation', () => {
    it('creates KPI successfully', async () => {
      const user = userEvent.setup({ delay: null });

      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/kpis') && !url.includes('?')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, kpi: { id: '1' } })
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ kpis: [] })
        });
      });

      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Name/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/KPI Name/i);
      const formulaInput = screen.getByLabelText(/KPI Formula/i);

      await user.type(nameInput, 'Test KPI');
      await user.type(formulaInput, '{cost} * 1.15');

      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Wait for validation
      await waitFor(() => {
        const validationDiv = document.getElementById('formula-validation');
        expect(validationDiv).toHaveTextContent(/Valid formula/i);
      }, { timeout: 500 });

      // Ensure save button becomes enabled
      const saveButton = await screen.findByText('Save KPI');
      expect(saveButton).not.toBeDisabled();

      await user.click(saveButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/kpis'),
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test KPI')
          })
        );
      }, { timeout: 1000 });
    });

    it('shows saving state during save', async () => {
      const user = userEvent.setup({ delay: null }); // Remove typing delay

      // Mock slow API
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/kpis') && !url.includes('?')) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ success: true })
              });
            }, 200); // Longer delay to catch saving state
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ kpis: [] })
        });
      });

      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Name/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/KPI Name/i);
      const formulaInput = screen.getByLabelText(/KPI Formula/i);

      await user.type(nameInput, 'Test KPI');
      await user.type(formulaInput, '{cost}');

      // Wait explicitly for debounce + validation
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      // Wait for validation
      await waitFor(() => {
        const validationDiv = document.getElementById('formula-validation');
        expect(validationDiv).toHaveTextContent(/Valid formula/i);
      }, { timeout: 500 });

      // Ensure save button becomes enabled
      const saveButton = await screen.findByText('Save KPI');
      expect(saveButton).not.toBeDisabled();

      await user.click(saveButton);

      // Check for saving state immediately
      expect(await screen.findByText('Saving...')).toBeInTheDocument();
    });

    it('disables save button when validation fails', async () => {
      const user = userEvent.setup();
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Name/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/KPI Name/i), 'Test KPI');
      await user.type(screen.getByLabelText(/KPI Formula/i), 'invalid');

      await waitFor(() => {
        const validationDiv = document.getElementById('formula-validation');
        expect(validationDiv).toHaveTextContent(/Invalid formula/i);
      }, { timeout: 500 });

      const saveButton = screen.getByText('Save KPI');
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels on inputs', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Name/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/KPI Name/i)).toHaveAttribute('aria-label', 'KPI Name');
      expect(screen.getByLabelText(/KPI Formula/i)).toHaveAttribute('aria-label', 'KPI Formula');
      expect(screen.getByLabelText(/KPI Description/i)).toHaveAttribute('aria-label', 'KPI Description');
    });

    it('marks required fields with aria-required', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Name/i)).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/KPI Name/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/KPI Formula/i)).toHaveAttribute('aria-required', 'true');
    });

    it('sets aria-invalid on validation failure', async () => {
      const user = userEvent.setup();
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/KPI Formula/i);
      await user.type(input, 'invalid');

      await waitFor(() => {
        expect(input).toHaveAttribute('aria-invalid', 'true');
      }, { timeout: 500 });
    });

    it('has live region for validation announcements', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
    });

    it('autocomplete has proper ARIA roles', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/KPI Formula/i);
      fireEvent.keyDown(input, { key: '{' });

      await waitFor(() => {
        const listbox = screen.getByRole('listbox');
        expect(listbox).toBeInTheDocument();
        expect(listbox).toHaveAttribute('aria-label', 'Formula field suggestions');
      });
    });
  });

  describe('Performance', () => {
    it('validation completes under 100ms', async () => {
      const user = userEvent.setup();
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByLabelText(/KPI Formula/i)).toBeInTheDocument();
      });

      const input = screen.getByLabelText(/KPI Formula/i);

      const start = performance.now();
      await user.type(input, '{cost} * 1.15');

      await waitFor(() => {
        const validationDiv = document.getElementById('formula-validation');
        expect(validationDiv).toHaveTextContent(/Valid formula/i);
      }, { timeout: 500 });

      const duration = performance.now() - start;

      // Validation should be under 100ms (plus debounce delay and user typing time)
      expect(duration).toBeLessThan(400); // 150ms debounce + 100ms validation + typing time + margin
    });
  });

  describe('Existing KPIs', () => {
    it('displays existing KPIs', async () => {
      const mockKpis = [
        {
          id: '1',
          name: 'Cost with Tax',
          formula: '{cost} * 1.15',
          formulaType: 'dynamic',
          format: 'currency',
          colorScale: false,
          sortOrder: 1,
          executionCount: 42,
          avgExecutionTime: 5.2
        }
      ];

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ kpis: mockKpis })
      });

      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByText('Cost with Tax')).toBeInTheDocument();
        expect(screen.getByText('{cost} * 1.15')).toBeInTheDocument();
        expect(screen.getByText('42 runs')).toBeInTheDocument();
        expect(screen.getByText('5.2ms avg')).toBeInTheDocument();
      });
    });

    it('shows empty state when no KPIs exist', async () => {
      render(<FormulaBuilder organizationId={mockOrganizationId} />);

      await waitFor(() => {
        expect(screen.getByText('No custom KPIs defined. Create one below.')).toBeInTheDocument();
      });
    });
  });
});
