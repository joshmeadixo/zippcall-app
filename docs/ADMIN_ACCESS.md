# ZippCall Admin Access

This document provides instructions for setting up admin access in ZippCall.

## Setting Admin Access Manually

1. Register a normal user account in the application.

2. In Firebase Console, navigate to Firestore Database.

3. Find the `users` collection.

4. Locate the document for the user you want to make an admin (it will have the user's UID as the document ID).

5. Edit the document and add a field:
   ```
   isAdmin: true
   ```

6. Save the changes.

7. Log out and log back in to the application for the changes to take effect.

## Admin Dashboard Features

Once admin access is set up, the admin user will see an "Admin Dashboard" link in the header when logged in.

The admin dashboard provides access to:

1. **Pricing Management**
   - View all country rates
   - Configure markup settings
   - Monitor price changes
   - Manually refresh pricing data

2. **User Management**
   - View user accounts
   - Manage user permissions

3. **Call Records**
   - View detailed call history
   - Access call analytics

4. **System Settings**
   - Configure application settings
   - Manage integrations

## Revoking Admin Access

To revoke admin access, simply set `isAdmin` to `false` or remove the field from the user's document in Firestore. 