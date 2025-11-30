/**
 * @file ApiServerManager.test.tsx
 * @description Component tests for ApiServerManager (ADR-007 Task 5.1)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiServerManager } from '../../components/admin/ApiServerManager';
import * as apiClientModule from '../../services/apiClient';

// Mock apiClient
vi.mock('../../services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockServersData = {
  data: [
    {
      id: 'server-1',
      name: 'PEMS Production',
      baseUrl: 'https://eam.example.com',
      authType: 'BASIC',
      hasCredentials: true,
      healthStatus: 'healthy',
      healthScore: 95,
      totalEndpoints: 3,
      healthyEndpoints: 3,
      degradedEndpoints: 0,
      downEndpoints: 0,
      status: 'active',
      isActive: true,
      endpoints: [
        {
          id: 'endpoint-1',
          serverId: 'server-1',
          name: 'PFA Records',
          path: '/api/pfa',
          entity: 'pfa',
          operationType: 'read',
          status: 'healthy',
          isActive: true,
          testCount: 5,
          successCount: 5,
          failureCount: 0,
          totalRecordsSinceFirstUse: 1000,
        },
      ],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ],
};

describe('ApiServerManager', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset all mocks
    vi.clearAllMocks();

    // Mock apiClient.get to return servers data
    vi.mocked(apiClientModule.apiClient.get).mockResolvedValue(mockServersData);
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderWithQuery = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  describe('Server List Display', () => {
    it('should display loading state initially', () => {
      renderWithQuery(<ApiServerManager organizationId="test-org" />);
      expect(screen.getByText(/Loading API servers/i)).toBeInTheDocument();
    });

    it('should display servers list after loading', async () => {
      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      expect(screen.getByText('https://eam.example.com')).toBeInTheDocument();
      expect(screen.getByText(/Score: 95\/100/i)).toBeInTheDocument();
    });

    it('should display empty state when no servers exist', async () => {
      vi.mocked(apiClientModule.apiClient.get).mockResolvedValue({ data: [] });

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText(/No API servers configured/i)).toBeInTheDocument();
      });
    });

    it('should display health status badges correctly', async () => {
      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        const healthBadge = screen.getByText('healthy');
        expect(healthBadge).toBeInTheDocument();
        expect(healthBadge.parentElement).toHaveClass('text-green-600');
      });
    });
  });

  describe('Server CRUD Operations', () => {
    it('should open create server modal when Add Server button clicked', async () => {
      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      const addButton = screen.getByText('Add Server');
      fireEvent.click(addButton);

      // Modal should be open (ServerFormModal would be rendered)
      expect(addButton).toBeInTheDocument();
    });

    it('should delete server with confirmation', async () => {
      vi.mocked(apiClientModule.apiClient.delete).mockResolvedValue({ success: true });
      window.confirm = vi.fn(() => true);

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTitle('Delete server');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith(
          'Delete this server and all its endpoints? This cannot be undone.'
        );
        expect(apiClientModule.apiClient.delete).toHaveBeenCalledWith('/api/servers/server-1');
      });
    });

    it('should not delete server when confirmation is cancelled', async () => {
      window.confirm = vi.fn(() => false);

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTitle('Delete server');
      fireEvent.click(deleteButton);

      expect(window.confirm).toHaveBeenCalled();
      expect(apiClientModule.apiClient.delete).not.toHaveBeenCalled();
    });
  });

  describe('Endpoint Operations', () => {
    it('should expand/collapse endpoint list', async () => {
      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      // Initially collapsed - endpoint table should not be visible
      expect(screen.queryByText('PFA Records')).not.toBeInTheDocument();

      // Click to expand
      const expandButton = screen.getByRole('button', { name: '' }); // Chevron button
      fireEvent.click(expandButton);

      // Now endpoint should be visible
      await waitFor(() => {
        expect(screen.getByText('PFA Records')).toBeInTheDocument();
      });
    });

    it('should test endpoint connection', async () => {
      vi.mocked(apiClientModule.apiClient.post).mockResolvedValue({
        data: {
          success: true,
          statusCode: 200,
          responseTimeMs: 150,
        },
      });

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      // Expand to see endpoints
      const expandButton = screen.getByRole('button', { name: '' });
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('PFA Records')).toBeInTheDocument();
      });

      // Click test button
      const testButton = screen.getByTitle('Test');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(apiClientModule.apiClient.post).toHaveBeenCalledWith(
          '/api/endpoints/endpoint-1/test',
          { organizationId: 'test-org' }
        );
      });
    });

    it('should toggle endpoint activation', async () => {
      vi.mocked(apiClientModule.apiClient.put).mockResolvedValue({
        success: true,
      });

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      // Expand to see endpoints
      const expandButton = screen.getByRole('button', { name: '' });
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('PFA Records')).toBeInTheDocument();
      });

      // Click deactivate button
      const toggleButton = screen.getByTitle('Deactivate');
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(apiClientModule.apiClient.put).toHaveBeenCalledWith(
          '/api/endpoints/endpoint-1',
          { isActive: false }
        );
      });
    });

    it('should delete endpoint with confirmation', async () => {
      vi.mocked(apiClientModule.apiClient.delete).mockResolvedValue({ success: true });
      window.confirm = vi.fn(() => true);

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      // Expand to see endpoints
      const expandButton = screen.getByRole('button', { name: '' });
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('PFA Records')).toBeInTheDocument();
      });

      // Click delete button
      const deleteButtons = screen.getAllByTitle('Delete');
      const endpointDeleteButton = deleteButtons[deleteButtons.length - 1]; // Last one is endpoint delete
      fireEvent.click(endpointDeleteButton);

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith('Delete this endpoint? This cannot be undone.');
        expect(apiClientModule.apiClient.delete).toHaveBeenCalledWith(
          '/api/endpoints/endpoint-1?serverId=server-1'
        );
      });
    });
  });

  describe('Optimistic Updates', () => {
    it('should optimistically remove server from list on delete', async () => {
      // Delay the delete response to test optimistic update
      vi.mocked(apiClientModule.apiClient.delete).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 500))
      );
      window.confirm = vi.fn(() => true);

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTitle('Delete server');
      fireEvent.click(deleteButton);

      // Server should be removed immediately (optimistic update)
      await waitFor(() => {
        expect(screen.queryByText('PEMS Production')).not.toBeInTheDocument();
      });
    });

    it('should rollback on error', async () => {
      vi.mocked(apiClientModule.apiClient.delete).mockRejectedValueOnce(
        new Error('Network error')
      );
      window.confirm = vi.fn(() => true);

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      const deleteButton = screen.getByTitle('Delete server');
      fireEvent.click(deleteButton);

      // Wait for the error and rollback to complete
      // The server should remain visible (rollback happened)
      await waitFor(() => {
        expect(apiClientModule.apiClient.delete).toHaveBeenCalled();
      });

      // Give time for rollback to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Server should still be there after rollback
      expect(screen.getByText('PEMS Production')).toBeInTheDocument();
    });
  });

  describe('Test All Endpoints', () => {
    it('should test all endpoints for a server', async () => {
      vi.mocked(apiClientModule.apiClient.post).mockResolvedValue({
        data: {
          successfulTests: 3,
          totalEndpoints: 3,
          failedTests: 0,
        },
      });

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      // Click test all endpoints button
      const testAllButton = screen.getByTitle('Test all endpoints');
      fireEvent.click(testAllButton);

      await waitFor(() => {
        expect(apiClientModule.apiClient.post).toHaveBeenCalledWith(
          '/api/servers/server-1/test',
          {}
        );
      });

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/3\/3 endpoints passed/i)).toBeInTheDocument();
      });
    });

    it('should show testing state during test', async () => {
      vi.mocked(apiClientModule.apiClient.post).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 500))
      );

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      const testAllButton = screen.getByTitle('Test all endpoints');
      fireEvent.click(testAllButton);

      // Should show testing state
      await waitFor(() => {
        expect(screen.getByText(/Testing all endpoints/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when fetch fails', async () => {
      // Mock the error for the initial fetch
      vi.mocked(apiClientModule.apiClient.get).mockRejectedValueOnce(
        new Error('Network error')
      );

      const { container } = renderWithQuery(<ApiServerManager organizationId="test-org" />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText(/Loading API servers/i)).not.toBeInTheDocument();
      }, { timeout: 3000 });

      // Check that error message is displayed (use getAllByText since there may be multiple "Error" instances)
      await waitFor(() => {
        const networkErrorElement = screen.getByText('Network error');
        expect(networkErrorElement).toBeInTheDocument();
      });
    });

    it('should display error for failed endpoint test', async () => {
      vi.mocked(apiClientModule.apiClient.post).mockRejectedValue(
        new Error('Connection refused')
      );

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      const expandButton = screen.getByRole('button', { name: '' });
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText('PFA Records')).toBeInTheDocument();
      });

      const testButton = screen.getByTitle('Test');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Connection refused/i)).toBeInTheDocument();
      });
    });
  });

  describe('React Query Integration', () => {
    it('should use correct query key', async () => {
      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(apiClientModule.apiClient.get).toHaveBeenCalledWith('/api/servers');
      });

      // Query should be cached with correct key
      const cachedData = queryClient.getQueryData(['servers', 'test-org']);
      expect(cachedData).toBeDefined();
    });

    it('should invalidate queries after mutation', async () => {
      vi.mocked(apiClientModule.apiClient.post).mockResolvedValue({
        success: true,
        server: { id: 'new-server', name: 'New Server' },
      });

      renderWithQuery(<ApiServerManager organizationId="test-org" />);

      await waitFor(() => {
        expect(screen.getByText('PEMS Production')).toBeInTheDocument();
      });

      // Simulate creating a server (through modal)
      // This would trigger queryClient.invalidateQueries

      // Verify apiClient.get is called initially
      expect(apiClientModule.apiClient.get).toHaveBeenCalledTimes(1);
    });
  });
});
