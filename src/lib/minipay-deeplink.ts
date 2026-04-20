/**
 * MiniPay Deep Link Utility
 * 
 * Provides functions to construct and trigger deep links to open the MiniPay app
 * from a regular browser environment.
 */

// MiniPay deep link URLs
const MINIPAY_DEEPLINKS = {
  ANDROID: 'intent://minipay.opera.com/#Intent;scheme=https;package=com.opera.mini.nightly;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.opera.mini.nightly;end',
  IOS: 'https://minipay.opera.com/open?url={url}',
  WEB: 'https://minipay.opera.com/add_cash',
};

/**
 * Detect the user's platform
 * @returns 'ios', 'android', or 'web' based on user agent
 */
export function detectPlatform(): 'ios' | 'android' | 'web' {
  if (typeof window === 'undefined') return 'web';
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  
  if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
    return 'ios';
  }
  
  if (userAgent.includes('android')) {
    return 'android';
  }
  
  return 'web';
}

/**
 * Encode a URL for use in a deep link query parameter
 * @param url - The URL to encode
 * @returns The encoded URL
 */
export function encodeUrlForDeepLink(url: string): string {
  try {
    return encodeURIComponent(url);
  } catch (error) {
    console.error('Failed to encode URL:', error);
    return url;
  }
}

/**
 * Construct a MiniPay deep link URL with the current page URL
 * @param currentUrl - The current page URL to pass to MiniPay
 * @returns The constructed deep link URL
 */
export function constructDeepLinkUrl(currentUrl: string): string {
  const platform = detectPlatform();
  
  switch (platform) {
    case 'ios':
      return MINIPAY_DEEPLINKS.IOS.replace('{url}', encodeUrlForDeepLink(currentUrl));
    case 'android':
      return MINIPAY_DEEPLINKS.ANDROID;
    default:
      // For web/desktop, use the web fallback
      return `${MINIPAY_DEEPLINKS.WEB}?url=${encodeUrlForDeepLink(currentUrl)}`;
  }
}

/**
 * Open the MiniPay app with the current page URL
 * @param currentUrl - The current page URL to pass to MiniPay
 * @param fallbackUrl - Optional fallback URL if deep link fails
 */
export function openMiniPayDeepLink(currentUrl?: string, fallbackUrl?: string): void {
  if (typeof window === 'undefined') return;
  
  const url = currentUrl || window.location.href;
  const deepLinkUrl = constructDeepLinkUrl(url);
  
  console.log('Opening MiniPay deep link:', deepLinkUrl);
  
  // Try to open the deep link
  window.location.href = deepLinkUrl;
  
  // Set up a timeout to show fallback if app doesn't open
  setTimeout(() => {
    // If we're still here, the app didn't open
    // This is a heuristic - if the page is still visible, the app likely didn't open
    console.log('Deep link may not have opened, showing fallback');
    
    // Show a message to the user
    alert('MiniPay app not found. Please install MiniPay from the app store.');
  }, 1000);
}

/**
 * Check if MiniPay app is likely installed
 * @returns true if MiniPay app is likely installed, false otherwise
 */
export function isMiniPayInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  
  const platform = detectPlatform();
  
  try {
    if (platform === 'android') {
      // Try to detect via intent scheme
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = MINIPAY_DEEPLINKS.ANDROID;
      document.body.appendChild(iframe);
      
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
      
      return true; // Assume installed if no error
    }
    
    if (platform === 'ios') {
      // iOS doesn't provide a direct way to check if app is installed
      // We can only try to open and see if it works
      return true; // Assume installed
    }
    
    return false;
  } catch (error) {
    console.error('Error checking MiniPay installation:', error);
    return false;
  }
}
