# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Open MiniPay from Regular Browser
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped Approach**: For deterministic bugs, scope the test to the concrete failing case(s) to ensure reproducibility
  - Test that when `isMiniPayEnv = false` and user clicks "Connect MiniPay" button, a deep link should be triggered to open MiniPay app
  - The test assertions should match the Expected Behavior Properties from design: deep link triggered with current URL
  - **Note**: Since project doesn't have testing framework configured, create manual test script or use browser testing tools
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (e.g., "Button click does nothing in regular browser", "No deep link triggered")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation tests (BEFORE implementing fix)
  - **Property 2: Preservation** - MiniPay Wallet Connection
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for MiniPay environment (`isMiniPayEnv = true`)
  - Observe: Wallet connection via `window.ethereum` works correctly
  - Observe: Auto-connection on page load works in MiniPay
  - Observe: Balance displays correctly after connection
  - Write tests capturing observed behavior patterns from Preservation Requirements
  - **Note**: Since project doesn't have property-based testing framework, create comprehensive manual tests
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for MiniPay deep link issue

  - [x] 3.1 Implement the fix in WalletConnect.tsx
    - Change button text logic from `{isMiniPayEnv ? 'Connect MiniPay' : 'Connect Wallet'}` to `{isMiniPayEnv ? 'Connect MiniPay' : 'Open in MiniPay'}`
    - Modify onClick handler to conditionally trigger deep link when `!isMiniPayEnv`
    - Add `openMiniPayDeepLink()` function that constructs and triggers MiniPay deep link URL
    - Implement platform detection (iOS vs Android) for appropriate URL schemes
    - Add fallback handling for when deep link fails (open app store, show instructions)
    - _Bug_Condition: isBugCondition(input) where isMiniPayEnv = false AND buttonClicked = "Connect MiniPay" AND window.ethereum = undefined AND deepLinkNotTriggered = true_
    - _Expected_Behavior: expectedBehavior(result) from design - deep link triggered to open MiniPay app with current website URL_
    - _Preservation: Preservation Requirements from design - when isMiniPayEnv = true, preserve all wallet connection behavior_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Implement the fix in useMiniPay.ts hook
    - Add `openMiniPayDeepLink()` function that returns URL construction logic
    - Enhance environment detection to differentiate between "can connect" vs "needs deep link" states
    - Add utility functions for URL encoding and platform detection
    - _Bug_Condition: isBugCondition(input) from design_
    - _Expected_Behavior: expectedBehavior(result) from design_
    - _Preservation: Preservation Requirements from design_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.3 Create new minipay-deeplink.ts utility file
    - Create `src/lib/minipay-deeplink.ts` file
    - Implement URL construction for MiniPay deep links with current page URL
    - Implement fallback for when deep link fails (open app store, show instructions)
    - Implement platform detection (iOS vs Android) for appropriate URL schemes
    - Add comprehensive error handling and logging
    - _Bug_Condition: isBugCondition(input) from design_
    - _Expected_Behavior: expectedBehavior(result) from design_
    - _Preservation: Preservation Requirements from design_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Open MiniPay from Regular Browser
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - MiniPay Wallet Connection
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: Preservation Requirements from design_

- [-] 4. Checkpoint - Ensure all tests pass
  - Run comprehensive test suite including:
    - Bug condition exploration test (should pass)
    - Preservation tests (should pass)
    - Manual tests for button text changes
    - Manual tests for deep link URL construction
    - Manual tests for click handler branching
    - Integration tests for full flow
  - Ensure all tests pass, ask the user if questions arise.
  - Document any issues or edge cases discovered during testing
