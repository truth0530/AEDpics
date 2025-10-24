/**
 * IP Whitelist Middleware
 *
 * Features:
 * - IP address validation against whitelist
 * - Role-based IP restrictions
 * - Admin routes protection
 *
 * NIS Certification: Access Control
 */

import { NextRequest } from 'next/server';

// Admin routes that require IP whitelist check
const ADMIN_ROUTES = [
  '/admin',
  '/api/admin',
];

// IP whitelist for admin access
// In production, this should come from environment variables or database
const ADMIN_IP_WHITELIST = process.env.ADMIN_IP_WHITELIST?.split(',') || [];

// IP whitelist for general access (optional)
const GENERAL_IP_WHITELIST = process.env.IP_WHITELIST?.split(',') || [];

/**
 * Extract client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  // Try X-Forwarded-For header first (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for');

  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  // Try X-Real-IP header (Nginx)
  const realIP = request.headers.get('x-real-ip');

  if (realIP) {
    return realIP.trim();
  }

  // Fallback to remote address (not reliable behind proxies)
  // Note: In Vercel/Edge runtime, this might not be available
  return request.ip || 'unknown';
}

/**
 * Check if IP is in whitelist
 */
export function isIPWhitelisted(ip: string, whitelist: string[]): boolean {
  if (whitelist.length === 0) {
    // No whitelist configured, allow all
    return true;
  }

  // Check exact match
  if (whitelist.includes(ip)) {
    return true;
  }

  // Check CIDR ranges
  for (const entry of whitelist) {
    if (entry.includes('/')) {
      // CIDR notation
      if (isIPInCIDR(ip, entry)) {
        return true;
      }
    } else if (entry.includes('*')) {
      // Wildcard pattern (e.g., 192.168.1.*)
      const pattern = entry.replace(/\*/g, '\\d+');
      const regex = new RegExp(`^${pattern}$`);

      if (regex.test(ip)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if IP is in CIDR range
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);

  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);

  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Convert IP address to number
 */
function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/**
 * Check if request is allowed based on IP whitelist
 */
export function isRequestAllowedByIP(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  const clientIP = getClientIP(request);

  // Check if route is admin route
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  if (isAdminRoute) {
    // Admin route, check admin whitelist
    if (!isIPWhitelisted(clientIP, ADMIN_IP_WHITELIST)) {
      console.warn(`[IP Whitelist] Admin access denied for IP: ${clientIP} on route: ${pathname}`);
      return false;
    }
  } else {
    // General route, check general whitelist (if configured)
    if (GENERAL_IP_WHITELIST.length > 0 && !isIPWhitelisted(clientIP, GENERAL_IP_WHITELIST)) {
      console.warn(`[IP Whitelist] General access denied for IP: ${clientIP} on route: ${pathname}`);
      return false;
    }
  }

  return true;
}

/**
 * Get IP whitelist rejection message
 */
export function getIPWhitelistRejectionMessage(request: NextRequest): string {
  const { pathname } = request.nextUrl;
  const clientIP = getClientIP(request);
  const isAdminRoute = ADMIN_ROUTES.some((route) => pathname.startsWith(route));

  if (isAdminRoute) {
    return `Access denied. Your IP address (${clientIP}) is not authorized to access admin routes. Please contact your system administrator.`;
  }

  return `Access denied. Your IP address (${clientIP}) is not authorized to access this system. Please contact your system administrator.`;
}
