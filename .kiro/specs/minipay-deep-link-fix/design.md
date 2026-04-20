# MiniPay Deep Link Fix Design

## Overview

The bug prevents users from opening the website in the MiniPay app from regular browsers. Currently, when users visit the website in a regular browser and click "Open in MiniPay", nothing happens because the button attempts to connect via `window.ethereum` which doesn't exist outside MiniPay. The fix involves implementing proper deep linking to open the MiniPay app with the website URL, while preserving existing wallet connection behavior inside MiniPay.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when a user is in a regular browser (not MiniPay environment) and clicks a button intended to open MiniPay
- **Property (P)**: The desired behavior when the bug condition holds - the MiniPay app should open with the website URL loaded inside it
- **Preservation**: Existing wallet connection behavior inside MiniPay that must remain unchanged
- **isMiniPayEnv**: Boolean detection of MiniPay environment via `window.ethereum?.isMiniPay`
- **deepLinkToMiniPay**: Function that constructs and triggers a deep link URL to open MiniPay app
- **currentUrl**: The current website URL that should be passed to MiniPay via deep link

## Bug Details

### Bug Condition

The bug manifests when a user visits the website in a regular browser (not inside MiniPay app) and clicks a button that should open the MiniPay app. The `useMiniPay` hook correctly detects the non-MiniPay environment, but the UI shows "Connect MiniPay" button which attempts to connect via `window.ethereum` (which doesn't exist in regular browsers) instead of triggering a deep link to open the MiniPay app.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type UserInteraction
  OUTPUT: boolean
  
  RETURN isMiniPayEnv = false
         AND buttonClicked = "Connect MiniPay" 
         AND window.ethereum = undefined
         AND deepLinkNotTriggered = true
END FUNCTION
```

### Examples

- **Example 1**: User visits `https://minipay-ai.example.com` in Chrome browser, sees "Connect MiniPay" button, clicks it → nothing happens (expected: MiniPay app opens with website loaded)
- **Example 2**: User visits site in Safari, clicks "Connect MiniPay" → browser shows "Cannot connect to wallet" error (expected: MiniPay app opens)
- **Example 3**: User visits site in Firefox, clicks button → no response (expected: prompts to open MiniPay app)
- **Edge Case**: User has MiniPay app installed but not set as default browser handler → should show app chooser dialog

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When already in MiniPay environment (`isMiniPayEnv = true`), the "Connect MiniPay" button must continue to connect wallet via `window.ethereum`
- Auto-connection inside MiniPay must continue to work when website loads
- Wallet address display and cUSD balance must continue to work correctly
- Chain switching functionality must remain unchanged

**Scope:**
All inputs where `isMiniPayEnv = true` should be completely unaffected by this fix. This includes:
- Wallet connection via injected provider
- Auto-connection on page load
- Balance fetching and display
- Network switching

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Incorrect Button Logic**: The `WalletConnect` component shows "Connect MiniPay" button for both MiniPay and non-MiniPay environments, but the button only works in MiniPay environment
   - In MiniPay: Button calls `connect()` which uses `window.ethereum`
   - Outside MiniPay: `window.ethereum` is undefined, so connection fails

2. **Missing Deep Link Implementation**: No code exists to construct and trigger a MiniPay deep link URL when outside MiniPay environment

3. **Incorrect Environment Detection**: While `isMiniPayEnv` detection works correctly, the UI doesn't differentiate between "connect inside MiniPay" vs "open MiniPay from browser"

4. **Missing Fallback Logic**: No fallback mechanism when `window.ethereum` is not available

## Correctness Properties

Property 1: Bug Condition - Open MiniPay from Regular Browser

_For any_ user interaction where the user is in a regular browser (`isMiniPayEnv = false`) and clicks a button intended to open MiniPay, the fixed system SHALL trigger a deep link to open the MiniPay app with the current website URL loaded inside it, providing proper wallet context.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - MiniPay Wallet Connection

_For any_ user interaction where the user is already in MiniPay environment (`isMiniPayEnv = true`), the fixed system SHALL produce exactly the same behavior as the original system, preserving all wallet connection, auto-connection, and balance display functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/components/WalletConnect.tsx`

**Function**: `WalletConnect` component

**Specific Changes**:
1. **Button Text Logic**: Change button text from `{isMiniPayEnv ? 'Connect MiniPay' : 'Connect Wallet'}` to `{isMiniPayEnv ? 'Connect MiniPay' : 'Open in MiniPay'}`
2. **Click Handler Logic**: Modify `onClick` handler to conditionally trigger deep link when `!isMiniPayEnv`
3. **Deep Link Function**: Add `openMiniPayDeepLink()` function that constructs and triggers MiniPay deep link URL

**File**: `src/hooks/useMiniPay.ts`

**Function**: `useMiniPay` hook

**Specific Changes**:
1. **Deep Link Utility**: Add `openMiniPayDeepLink()` function that returns URL construction logic
2. **Environment Detection**: Enhance detection to differentiate between "can connect" vs "needs deep link" states

**File**: New utility file

**Function**: `src/lib/minipay-deeplink.ts`

**Specific Changes**:
1. **URL Construction**: Create function to build MiniPay deep link URL with current page URL
2. **Fallback Handling**: Implement fallback for when deep link fails (open app store, show instructions)
3. **Platform Detection**: Detect iOS vs Android for appropriate URL schemes

### Deep Link URL Research

Based on MiniPay documentation and common patterns:
- **Android**: `intent://minipay.opera.com/#Intent;scheme=https;package=com.opera.mini.nightly;S.browser_fallback_url=https://play.google.com/store/apps/details?id=com.opera.mini.nightly;end`
- **iOS**: `https://minipay.opera.com/open?url={encoded_current_url}`
- **Fallback**: `https://minipay.opera.com/add_cash` (known working URL)

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate user interactions in non-MiniPay environment and assert that deep links are triggered. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Regular Browser Test**: Simulate clicking "Connect MiniPay" in non-MiniPay environment (will fail on unfixed code)
2. **Missing Ethereum Test**: Verify `window.ethereum` is undefined in test environment (will fail on unfixed code)
3. **Button Text Test**: Check button shows "Connect MiniPay" instead of "Open in MiniPay" (will fail on unfixed code)
4. **Deep Link Test**: Verify no deep link URL is constructed (will fail on unfixed code)

**Expected Counterexamples**:
- Button click does nothing in regular browser
- Connection attempt fails with "Cannot connect to wallet" error
- No deep link is triggered
- Button text is misleading for non-MiniPay users

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleWalletButtonClick_fixed(input)
  ASSERT deepLinkTriggered(result) AND deepLinkUrlContains(currentUrl)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT WalletConnect_original(input) = WalletConnect_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for MiniPay environment interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **MiniPay Connection Preservation**: Verify wallet connection works in MiniPay environment
2. **Auto-Connection Preservation**: Verify auto-connection on page load works in MiniPay
3. **Balance Display Preservation**: Verify cUSD balance displays correctly after connection
4. **Network Switching Preservation**: Verify chain switching works in MiniPay

### Unit Tests

- Test button text changes based on `isMiniPayEnv`
- Test deep link URL construction with various current URLs
- Test click handler branches correctly for MiniPay vs non-MiniPay
- Test fallback behavior when deep link fails

### Property-Based Tests

- Generate random URL paths and verify they are properly encoded in deep links
- Test button behavior across simulated MiniPay/non-MiniPay environments
- Verify preservation of wallet connection across many simulated states
- Test edge cases like special characters in URLs, very long URLs

### Integration Tests

- Test full flow: regular browser → click button → MiniPay opens (simulated)
- Test inside MiniPay: page loads → auto-connects → displays balance
- Test URL parameter passing: verify current page URL is preserved in MiniPay
- Test fallback flows: when MiniPay not installed, appropriate instructions shown

### Manual Testing Checklist

1. **Regular Browser Testing**:
   - Visit site in Chrome/Safari/Firefox
   - Verify button says "Open in MiniPay"
   - Click button → MiniPay app should open (if installed)
   - If MiniPay not installed → appropriate fallback

2. **MiniPay Environment Testing**:
   - Open site inside MiniPay
   - Verify button says "Connect MiniPay"
   - Click button → wallet connects
   - Verify auto-connection works on page load
   - Verify balance displays correctly

3. **URL Preservation Testing**:
   - Visit site with query parameters
   - Open in MiniPay → verify parameters preserved
   - Test with different paths and fragments

4. **Cross-Platform Testing**:
   - Test on Android device
   - Test on iOS device
   - Test deep link behavior on each platform