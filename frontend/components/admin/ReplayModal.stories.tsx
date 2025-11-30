// @ts-nocheck - Storybook file (dev only)
/**
 * @file ReplayModal.stories.tsx
 * @description Storybook stories for ReplayModal component
 *
 * These stories demonstrate different states of the Replay modal:
 * - Initial loading (calculating impact)
 * - Impact shown (ready to confirm)
 * - Replay in progress
 * - Large dataset warning
 * - Replay complete
 * - Replay failed
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ReplayModal } from './ReplayModal';

const meta: Meta<typeof ReplayModal> = {
  title: 'Admin/ReplayModal',
  component: ReplayModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Time Machine (Replay) UI component that allows admins to replay transformation operations on historical Bronze batches using current mapping rules.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Controls modal visibility',
    },
    organizationId: {
      control: 'text',
      description: 'Organization ID for the replay operation',
    },
    dateRange: {
      description: 'Date range for replay operation',
    },
    onClose: {
      action: 'closed',
      description: 'Callback when modal is closed',
    },
    onReplayComplete: {
      action: 'replay-complete',
      description: 'Callback when replay operation completes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ReplayModal>;

// Default date range for stories
const defaultDateRange = {
  start: new Date('2025-01-01'),
  end: new Date('2025-01-31'),
};

/**
 * Story 1: Initial Load (Calculating Impact)
 * Shows the modal in its initial state while calculating the impact of the replay
 */
export const CalculatingImpact: Story = {
  args: {
    isOpen: true,
    organizationId: 'org-123',
    dateRange: defaultDateRange,
    onClose: () => console.log('Modal closed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Modal opens and immediately begins calculating the impact of the replay operation. Shows a loading spinner while the calculation is in progress.',
      },
    },
  },
};

/**
 * Story 2: Impact Shown - Small Dataset (Ready to Confirm)
 * Shows the modal after impact calculation with a small dataset
 */
export const SmallDatasetReady: Story = {
  args: {
    isOpen: true,
    organizationId: 'org-123',
    dateRange: defaultDateRange,
    onClose: () => console.log('Modal closed'),
  },
  parameters: {
    mockData: {
      impact: {
        batchCount: 25,
        recordCount: 15400,
        silverRecordCount: 12800,
        dateRange: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      },
    },
    docs: {
      description: {
        story: 'Impact calculation complete. Shows the number of batches and records that will be reprocessed. User can confirm to start the replay.',
      },
    },
  },
};

/**
 * Story 3: Impact Shown - Large Dataset Warning
 * Shows the modal with a large dataset warning
 */
export const LargeDatasetWarning: Story = {
  args: {
    isOpen: true,
    organizationId: 'org-123',
    dateRange: {
      start: new Date('2025-01-01'),
      end: new Date('2025-12-31'),
    },
    onClose: () => console.log('Modal closed'),
  },
  parameters: {
    mockData: {
      impact: {
        batchCount: 150,
        recordCount: 125000,
        silverRecordCount: 98000,
        dateRange: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-12-31T23:59:59Z',
        },
      },
    },
    docs: {
      description: {
        story: 'Large dataset detected (>50,000 records). Shows an orange warning banner advising the user that the operation may take 10+ minutes.',
      },
    },
  },
};

/**
 * Story 4: Replay in Progress (25% complete)
 * Shows the modal during an active replay operation
 */
export const ReplayInProgress25: Story = {
  args: {
    isOpen: true,
    organizationId: 'org-123',
    dateRange: defaultDateRange,
    onClose: () => console.log('Modal closed'),
  },
  parameters: {
    mockData: {
      progress: {
        status: 'running',
        processedBatches: 6,
        totalBatches: 25,
        processedRecords: 3850,
        totalRecords: 15400,
        currentBatchId: 'batch-001',
        startedAt: new Date(Date.now() - 45000).toISOString(), // Started 45s ago
      },
    },
    docs: {
      description: {
        story: 'Replay operation in progress at 25%. Shows progress bar, processed records count, current batch, ETA, and a Cancel button.',
      },
    },
  },
};

/**
 * Story 5: Replay in Progress (75% complete)
 * Shows the modal during an active replay operation nearing completion
 */
export const ReplayInProgress75: Story = {
  args: {
    isOpen: true,
    organizationId: 'org-123',
    dateRange: defaultDateRange,
    onClose: () => console.log('Modal closed'),
  },
  parameters: {
    mockData: {
      progress: {
        status: 'running',
        processedBatches: 19,
        totalBatches: 25,
        processedRecords: 11550,
        totalRecords: 15400,
        currentBatchId: 'batch-019',
        startedAt: new Date(Date.now() - 180000).toISOString(), // Started 3min ago
      },
    },
    docs: {
      description: {
        story: 'Replay operation nearly complete at 75%. ETA calculation should show accurate time remaining based on processing rate.',
      },
    },
  },
};

/**
 * Story 6: Replay Complete (Success)
 * Shows the modal after successful completion
 */
export const ReplayComplete: Story = {
  args: {
    isOpen: true,
    organizationId: 'org-123',
    dateRange: defaultDateRange,
    onClose: () => console.log('Modal closed'),
    onReplayComplete: (result) => console.log('Replay complete:', result),
  },
  parameters: {
    mockData: {
      progress: {
        status: 'completed',
        processedBatches: 25,
        totalBatches: 25,
        processedRecords: 15400,
        totalRecords: 15400,
        startedAt: new Date(Date.now() - 240000).toISOString(),
        completedAt: new Date().toISOString(),
      },
    },
    docs: {
      description: {
        story: 'Replay completed successfully. Shows green success banner with animated checkmark and total records processed. User can click "Done" to close.',
      },
    },
  },
};

/**
 * Story 7: Replay Failed
 * Shows the modal after a failed replay operation
 */
export const ReplayFailed: Story = {
  args: {
    isOpen: true,
    organizationId: 'org-123',
    dateRange: defaultDateRange,
    onClose: () => console.log('Modal closed'),
  },
  parameters: {
    mockData: {
      progress: {
        status: 'failed',
        processedBatches: 12,
        totalBatches: 25,
        processedRecords: 7200,
        totalRecords: 15400,
        error: 'Database connection lost. Unable to complete replay.',
        startedAt: new Date(Date.now() - 90000).toISOString(),
      },
    },
    docs: {
      description: {
        story: 'Replay failed mid-operation. Shows red error banner with failure reason and partial progress.',
      },
    },
  },
};

/**
 * Story 8: Empty Dataset (No Batches)
 * Shows the modal when no batches are found in the date range
 */
export const EmptyDataset: Story = {
  args: {
    isOpen: true,
    organizationId: 'org-123',
    dateRange: {
      start: new Date('2020-01-01'),
      end: new Date('2020-01-31'),
    },
    onClose: () => console.log('Modal closed'),
  },
  parameters: {
    mockData: {
      impact: {
        batchCount: 0,
        recordCount: 0,
        silverRecordCount: 0,
        dateRange: {
          start: '2020-01-01T00:00:00Z',
          end: '2020-01-31T23:59:59Z',
        },
      },
    },
    docs: {
      description: {
        story: 'No batches found in the selected date range. Confirm button is disabled because there is nothing to replay.',
      },
    },
  },
};

/**
 * Story 9: Interactive Demo
 * Allows you to interact with the full flow
 */
export const InteractiveDemo: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(true);

    return (
      <div>
        <button
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Open Replay Modal
        </button>
        <ReplayModal
          isOpen={isOpen}
          organizationId="org-demo"
          dateRange={defaultDateRange}
          onClose={() => setIsOpen(false)}
          onReplayComplete={(result) => {
            console.log('Replay complete:', result);
            alert(`Replay complete! Processed ${result.recordCount} records.`);
          }}
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive demo that allows you to open/close the modal and see the full user flow.',
      },
    },
  },
};

/**
 * Story 10: Dark Mode
 * Shows the modal in dark mode
 */
export const DarkMode: Story = {
  args: {
    isOpen: true,
    organizationId: 'org-123',
    dateRange: defaultDateRange,
    onClose: () => console.log('Modal closed'),
  },
  parameters: {
    mockData: {
      impact: {
        batchCount: 25,
        recordCount: 15400,
        silverRecordCount: 12800,
        dateRange: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-01-31T23:59:59Z',
        },
      },
    },
    backgrounds: {
      default: 'dark',
    },
    docs: {
      description: {
        story: 'Modal appearance in dark mode. All colors and contrast ratios meet WCAG AA accessibility standards.',
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="dark">
        <Story />
      </div>
    ),
  ],
};
