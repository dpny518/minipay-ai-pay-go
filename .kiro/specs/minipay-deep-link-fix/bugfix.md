# Bugfix Requirements Document

## Introduction

The website currently shows a "Connect MiniPay" button when MiniPay environment is detected (`window.ethereum?.isMiniPay` is true), but this button only triggers wallet connection via the injected Ethereum provider. When users visit the website from a regular browser (not already inside MiniPay app) and click "Open in MiniPay", nothing happens - the MiniPay app does not open. This prevents users from accessing the website functionality through the MiniPay app.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN user visits website in regular browser (NOT in MiniPay environment) AND clicks "Connect MiniPay" button THEN the system attempts wallet connection via `window.ethereum` which fails or does nothing

1.2 WHEN user visits website in regular browser AND there is a button intended to open MiniPay app THEN clicking the button does not open the MiniPay app

1.3 WHEN website detects MiniPay is NOT currently active (`!isMiniPayEnv`) THEN the system shows "Connect MiniPay" button instead of "Open in MiniPay" button with proper deep linking

### Expected Behavior (Correct)

2.1 WHEN user visits website in regular browser (NOT in MiniPay environment) AND clicks "Open in MiniPay" button THEN the system SHALL trigger a deep link to open MiniPay app (e.g., using `https://minipay.opera.com/add_cash` or similar URL scheme)

2.2 WHEN MiniPay app opens from deep link THEN the system SHALL load the website URL inside MiniPay app with proper wallet context

2.3 WHEN website detects MiniPay is NOT currently active (`!isMiniPayEnv`) THEN the system SHALL show "Open in MiniPay" button with proper deep linking functionality

### Unchanged Behavior (Regression Prevention)

3.1 WHEN user is already in MiniPay environment (`isMiniPayEnv` is true) THEN the system SHALL CONTINUE TO show "Connect MiniPay" button and auto-connect wallet

3.2 WHEN user clicks "Connect MiniPay" button inside MiniPay app THEN the system SHALL CONTINUE TO successfully connect wallet via `window.ethereum`

3.3 WHEN website loads inside MiniPay app THEN the system SHALL CONTINUE TO detect `window.ethereum?.isMiniPay` and auto-connect wallet

3.4 WHEN wallet is connected THEN the system SHALL CONTINUE TO display wallet address and cUSD balance correctly