/**
 * XSS Sanitization Utilities
 *
 * P0-5: XSS Protection
 * Sanitizes user-generated content to prevent Cross-Site Scripting (XSS) attacks.
 * Uses DOMPurify to strip malicious HTML/JavaScript from strings.
 *
 * Security Principle: Never trust user input.
 * All data from external sources (API responses, user input) should be sanitized
 * before rendering in the UI.
 */

import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML string to prevent XSS attacks
 *
 * Strips ALL HTML tags and JavaScript by default.
 * Use this for text that should never contain HTML.
 *
 * @param dirty - Potentially malicious string
 * @returns Sanitized string with no HTML tags
 *
 * @example
 * sanitizeHtml('<script>alert("XSS")</script>Hello')
 * // Returns: 'Hello'
 *
 * sanitizeHtml('<img src=x onerror=alert(1)>')
 * // Returns: ''
 */
export function sanitizeHtml(dirty: string): string {
  if (typeof dirty !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep text content, strip tags
  });
}

/**
 * Sanitizes HTML allowing safe formatting tags (bold, italic, links)
 *
 * Use this for rich text content where basic formatting is needed.
 * Still strips dangerous tags like <script>, <iframe>, <object>.
 *
 * @param dirty - HTML string with formatting
 * @returns Sanitized HTML with safe tags only
 *
 * @example
 * sanitizeRichText('<b>Bold</b> <script>alert(1)</script>')
 * // Returns: '<b>Bold</b> '
 */
export function sanitizeRichText(dirty: string): string {
  if (typeof dirty !== 'string') {
    return '';
  }

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitizes object recursively
 *
 * Applies sanitizeHtml to all string values in an object.
 * Useful for sanitizing API responses before displaying.
 *
 * @param obj - Object with potentially malicious strings
 * @returns Sanitized object
 *
 * @example
 * sanitizeObject({
 *   name: '<script>alert(1)</script>John',
 *   role: 'Admin'
 * })
 * // Returns: { name: 'John', role: 'Admin' }
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  const sanitized = {} as T;

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeHtml(value) as any;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key as keyof T] = sanitizeObject(value);
    } else {
      sanitized[key as keyof T] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitizes array of objects
 *
 * Applies sanitizeObject to each item in an array.
 *
 * @param arr - Array of objects
 * @returns Sanitized array
 */
export function sanitizeArray<T extends Record<string, any>>(arr: T[]): T[] {
  if (!Array.isArray(arr)) {
    return [];
  }

  return arr.map((item) => sanitizeObject(item));
}

/**
 * Escapes HTML entities
 *
 * Converts <, >, &, ", ' to HTML entities.
 * Use this when displaying user input as plain text in HTML.
 *
 * @param unsafe - String with potentially dangerous characters
 * @returns String with escaped HTML entities
 *
 * @example
 * escapeHtml('<script>alert(1)</script>')
 * // Returns: '&lt;script&gt;alert(1)&lt;/script&gt;'
 */
export function escapeHtml(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return '';
  }

  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitizes URL to prevent javascript: and data: URIs
 *
 * Use this for href attributes to prevent XSS via URL schemes.
 *
 * @param url - Potentially malicious URL
 * @returns Safe URL or empty string
 *
 * @example
 * sanitizeUrl('javascript:alert(1)')
 * // Returns: ''
 *
 * sanitizeUrl('https://example.com')
 * // Returns: 'https://example.com'
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim().toLowerCase();

  // Block dangerous URL schemes
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('file:')
  ) {
    return '';
  }

  // Allow relative URLs, http, https, mailto
  return url;
}

/**
 * Sanitizes conflict data specifically for ConflictResolutionModal
 *
 * Handles both localData and pemsData objects from PfaSyncConflict.
 * Preserves non-string data types (numbers, booleans, dates).
 *
 * @param conflictData - Conflict data object
 * @returns Sanitized conflict data
 */
export function sanitizeConflictData<T extends Record<string, any>>(
  conflictData: T
): T {
  if (typeof conflictData !== 'object' || conflictData === null) {
    return conflictData;
  }

  const sanitized = {} as T;

  for (const [key, value] of Object.entries(conflictData)) {
    // Only sanitize string values
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeHtml(value) as any;
    } else if (value instanceof Date) {
      // Preserve dates
      sanitized[key as keyof T] = value as T[keyof T];
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key as keyof T] = sanitizeConflictData(value);
    } else {
      // Preserve numbers, booleans, null
      sanitized[key as keyof T] = value;
    }
  }

  return sanitized;
}

/**
 * React-safe sanitized HTML renderer
 *
 * Returns sanitized HTML that can be used with dangerouslySetInnerHTML.
 * Use this ONLY when you absolutely need to render HTML.
 * Prefer plain text rendering with React's default escaping.
 *
 * @param html - HTML string to sanitize
 * @returns Object for dangerouslySetInnerHTML prop
 *
 * @example
 * <div dangerouslySetInnerHTML={renderSanitizedHtml(userHtml)} />
 */
export function renderSanitizedHtml(html: string): { __html: string } {
  return {
    __html: sanitizeRichText(html),
  };
}
