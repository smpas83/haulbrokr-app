# App Store Review Notes

Updated: 2026-07-01

## iOS 1.0 rejection remediation

Submission ID: `62c990a4-725f-452f-8345-41074addc496`

### Guideline 2.1(a) - Account sign out

- Fixed both Account tab sign-out controls so they execute the same direct sign-out action.
- Removed the native alert confirmation dependency from sign-out because App Review reported the two Account sign-out options were not responsive on iPad Air 11-inch.
- Added accessibility labels and test IDs for both sign-out controls.

Suggested review note:

> The Account tab sign-out controls have been fixed. Both the header icon and bottom "Sign Out" button now call the same direct Clerk sign-out path and return the user to the sign-in screen.

### Guideline 5.1.2(i) - App Tracking Transparency

HaulBrokr does not track users across apps or websites for advertising, does not share user data with data brokers, and does not include ad attribution or third-party tracking SDKs.

The iOS privacy manifest now declares `NSPrivacyTracking` as `false`; collected data is used for app functionality such as authentication, job documentation, location-based job workflows, and payments.

Required App Store Connect action before resubmission:

- Update App Privacy Information so collected data types are not marked as "used for tracking."
- Do not add an ATT prompt unless HaulBrokr later adds actual cross-app/site tracking.

Suggested review note:

> HaulBrokr does not track users under Apple's App Tracking Transparency definition. The App Privacy Information has been corrected so collected data is not marked as used for tracking. The app's privacy manifest declares `NSPrivacyTracking=false`, and no ATT prompt is shown because the app does not perform tracking.
