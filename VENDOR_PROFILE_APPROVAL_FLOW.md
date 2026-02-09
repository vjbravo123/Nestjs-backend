# Vendor Profile Update Approval System

## Overview
This system implements a dual-state approach for vendor profile updates that require admin approval before being visible to customers.

## Architecture Flow

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vendor        │    │   Admin          │    │   Customer      │
│   (Updates)     │    │   (Approves)     │    │   (Views)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │ 1. Submit Update      │                       │
         ├──────────────────────►│                       │
         │                       │                       │
         │ 2. Status: Pending    │                       │
         │◄──────────────────────┤                       │
         │                       │                       │
         │                       │ 3. Review Changes     │
         │                       │◄──────────────────────┤
         │                       │                       │
         │                       │ 4a. Approve           │  
         │                       │ 4b. Reject            │
         │                       │                       │
         │ 5a. Status: Approved  │                       │
         │◄──────────────────────┤                       │
         │                       │                       │
         │                       │                       │ 6. View Updated Profile
         │                       │                       │◄──────────────────────┤
```

## Database Schema Changes

### New Fields Added to Vendor Schema:
- `pendingChanges`: Object storing unapproved profile updates
- `profileUpdateStatus`: Enum ['none', 'pending', 'approved', 'rejected']
- `profileUpdateReason`: String for admin feedback

## API Endpoints

### Vendor Endpoints:
1. **PATCH /vendors/profile/update** - Submit profile updates for approval
2. **GET /vendors/profile/status** - Check update approval status

### Admin Endpoints:
3. **GET /vendors/pending-updates** - List vendors with pending updates
4. **PATCH /vendors/:vendorId/profile/approve** - Approve/reject profile updates

### Public Endpoints:
5. **GET /vendors/:vendorId/public** - Get approved vendor profile (customer view)

## Workflow States

### 1. Initial State
- Vendor profile is approved and visible to customers
- `profileUpdateStatus`: 'none'
- `pendingChanges`: null

### 2. Update Submitted
- Vendor submits profile changes
- Changes stored in `pendingChanges`
- `profileUpdateStatus`: 'pending'
- Customers still see old approved profile

### 3. Admin Review
- Admin can view pending changes
- Admin can approve or reject changes
- `profileUpdateStatus`: 'approved' or 'rejected'

### 4. Approval
- Pending changes applied to main profile
- `pendingChanges` cleared
- `profileUpdateStatus`: 'approved'
- Customers now see updated profile

### 5. Rejection
- Pending changes discarded
- `pendingChanges` cleared
- `profileUpdateStatus`: 'rejected'
- Customers continue seeing old profile

## Key Benefits

1. **Data Integrity**: Customers never see unapproved content
2. **Admin Control**: Full oversight of vendor profile changes
3. **Audit Trail**: Track who made changes and when
4. **Flexible**: Supports partial updates (only changed fields)
5. **Scalable**: Efficient database queries for pending updates

## Usage Examples

### Vendor Submits Update:
```bash
PATCH /vendors/profile/update
{
  "businessName": "New Business Name",
  "businessDescription": "Updated description"
}
```

### Admin Approves Update:
```bash
PATCH /vendors/123/profile/approve
{
  "action": "approved",
  "reason": "Changes look good"
}
```

### Customer Views Profile:
```bash
GET /vendors/123/public
# Returns only approved profile data
```

## Implementation Details

- **File Uploads**: New images are uploaded to S3 and stored in pendingChanges
- **Validation**: All updates go through DTO validation
- **Security**: Role-based access control for all endpoints
- **Error Handling**: Comprehensive error messages and status codes
- **Performance**: Optimized queries with pagination for admin views
