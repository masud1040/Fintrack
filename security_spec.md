# Security Specification & Threat Model (TDD)

## 1. Data Invariants
- Users can only access and modify their own documents (`userId == request.auth.uid` or document ID matches the UID).
- Properties must match standard schemas (defined in the blueprint). No unexpected properties are allowed during creation or update.
- Timestamps must be handled securely (e.g. tracking native request.time).
- Financial figures must be valid numbers (cannot have negative NaN/Infinite amounts).

## 2. The Dirty Dozen Payloads
Below are 12 specific payloads representing threat vectors designed to compromise the system and verify rules reject them:
1. **User Identity Spoofing**: Attempt to update someone else's `/users/attacker` record with an elite status.
2. **Account Injection**: Add an account with a massive, false `currentBalance` belonging to another user.
3. **Category Stealing**: Create a Category document with an arbitrary `userId` field to spoof ownership.
4. **Transaction Inflation**: Add a transaction amount of `-9999999` to break accounting balances.
5. **Orphaned Transaction**: Create a transaction pointing to a nonexistent Category or Account.
6. **Note Poisoning**: Insert an note with a huge 2MB string payload in the `content`.
7. **Bypassing Status Locks**: Try to forcefully mark a paid Debt back to unpaid or manipulate timestamps manually.
8. **Malicious Path Infiltration**: Write a document with a document ID containing malicious directory traversal scripts (`../../hack`).
9. **No-Auth Account Creation**: Attempt to create a user account document when completely unauthenticated.
10. **State Shortcutting in Recurring Transactions**: Create a recurring transaction bypassing required setup keys.
11. **PII Exposure Query**: Query user profiles without ownership limits.
12. **Foreign Device Notification**: Attempting to insert spam alerts into another user's Notification collection.

## 3. Test Runner Definition (Conceptual for local firestore emulator)
```ts
// firestore.rules.test.ts
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

// All Dirty Dozen payloads must return PERMISSION_DENIED under these tests.
```
