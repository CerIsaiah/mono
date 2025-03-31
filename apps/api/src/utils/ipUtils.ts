/**
 * Normalizes an IP address by removing IPv6 prefix if present
 * @param ip The IP address to normalize
 * @returns The normalized IP address
 */
export function normalizeIP(ip: string): string {
  if (!ip) return 'unknown';
  
  // If it's an IPv6-mapped IPv4 address, extract just the IPv4 part
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7); // Remove the ::ffff: prefix
  }
  
  return ip;
}

/**
 * Gets the real client IP address from the request
 * @param req The Express request object
 * @returns The real client IP address
 */
export function getClientIP(req: any): string {
  // Try to get IP from x-forwarded-for header first
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Get the first IP in the chain (original client IP)
    const ips = forwardedFor.split(',').map((ip: string) => ip.trim());
    return ips[0];
  }
  
  // Fallback to req.ip if no forwarded header
  if (!req.ip) return 'unknown';
  
  // If it's an IPv6-mapped IPv4 address, extract just the IPv4 part
  if (req.ip.startsWith('::ffff:')) {
    return req.ip.substring(7); // Remove the ::ffff: prefix
  }
  
  return req.ip;
} 