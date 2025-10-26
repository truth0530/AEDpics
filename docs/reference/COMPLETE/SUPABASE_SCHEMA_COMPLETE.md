# Supabase Database Schema - Complete Reference

Last Updated: 2025-10-25
Database Version: Based on Migration 69

## Table of Contents
1. [Core Tables](#core-tables)
   - [organizations](#1-organizations)
   - [user_profiles](#2-user_profiles)
   - [aed_data](#3-aed_data)
2. [Inspection System](#inspection-system)
   - [inspections](#4-inspections)
   - [inspection_sessions](#5-inspection_sessions)
   - [inspection_assignments](#6-inspection_assignments)
   - [inspection_schedule_entries](#7-inspection_schedule_entries)
3. [Team Management](#team-management)
   - [team_members](#8-team_members)
   - [team_permissions](#9-team_permissions)
   - [task_assignments](#10-task_assignments)
   - [inspection_schedules](#11-inspection_schedules)
   - [schedule_instances](#12-schedule_instances)
   - [team_activity_logs](#13-team_activity_logs)
4. [Notification & Logging](#notification--logging)
   - [notifications](#14-notifications)
   - [notification_templates](#15-notification_templates)
   - [audit_logs](#16-audit_logs)
   - [login_history](#17-login_history)
5. [Security & Rate Limiting](#security--rate-limiting)
   - [otp_rate_limits](#18-otp_rate_limits)
6. [Target Institutions & Matching](#target-institutions--matching)
   - [target_list_2024](#19-target_list_2024)
   - [target_list_devices](#20-target_list_devices)
7. [GPS Analysis](#gps-analysis)
   - [gps_issues](#21-gps_issues)
   - [gps_analysis_logs](#22-gps_analysis_logs)
8. [Important Notes](#important-notes)

---

## Core Tables

### 1. organizations

**Purpose**: Store organizational hierarchy (ministries, emergency centers, provinces, cities, health centers)

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique organization ID |
| name | TEXT | NOT NULL | Organization name |
| type | TEXT | NOT NULL, CHECK (ministry/emergency_center/province/city/health_center) | Organization type |
| parent_id | UUID | REFERENCES organizations(id) | Parent organization |
| region_code | TEXT | | Region code (e.g., SEO, BUS) |
| address | TEXT | | Physical address |
| contact | TEXT | | Contact information |
| latitude | NUMERIC(10,8) | | GPS latitude |
| longitude | NUMERIC(11,8) | | GPS longitude |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_organizations_region` ON (region_code)
- `idx_organizations_type` ON (type)

**Foreign Keys**:
- `parent_id` → organizations(id)

**Triggers**:
- `update_organizations_updated_at` - Auto-update updated_at

**RLS Policies**: Enabled

---

### 2. user_profiles

**Purpose**: User account profiles with roles and permissions

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, REFERENCES auth.users(id) ON DELETE CASCADE | User ID from Supabase Auth |
| email | TEXT | UNIQUE, NOT NULL | User email address |
| full_name | TEXT | NOT NULL | Full name |
| phone | TEXT | | Phone number |
| organization_id | UUID | REFERENCES organizations(id) | Associated organization |
| role | TEXT | NOT NULL, CHECK (master/emergency_center_admin/ministry_admin/regional_admin/local_admin/pending_approval/email_verified) | User role |
| is_active | BOOLEAN | DEFAULT true | Account active status |
| approved_by | UUID | REFERENCES user_profiles(id) | Approver user ID |
| approved_at | TIMESTAMPTZ | | Approval timestamp |
| region | TEXT | | User's region |
| organization_name | TEXT | | Organization name (text) |
| remarks | TEXT | | Additional notes |
| region_code | TEXT | | Region code |
| district | TEXT | | District |
| department | TEXT | | Department |
| position | TEXT | | Position/title |
| can_approve_users | BOOLEAN | DEFAULT false | User approval permission |
| can_manage_devices | BOOLEAN | DEFAULT true | Device management permission |
| can_view_reports | BOOLEAN | DEFAULT true | Report viewing permission |
| can_export_data | BOOLEAN | DEFAULT false | Data export permission |
| last_login_at | TIMESTAMPTZ | | Last login timestamp |
| account_locked | BOOLEAN | DEFAULT false | Account locked status |
| lock_reason | TEXT | | Reason for locking |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_user_profiles_email` ON (email)
- `idx_user_profiles_role` ON (role)
- `idx_user_profiles_organization_name` ON (organization_name)

**Foreign Keys**:
- `id` → auth.users(id) ON DELETE CASCADE
- `organization_id` → organizations(id)
- `approved_by` → user_profiles(id)

**Triggers**:
- `update_user_profiles_updated_at` - Auto-update updated_at

**RLS Policies**: Enabled

---

### 3. aed_data

**Purpose**: Main AED device data table (renamed from aed_devices, 81,331 records in production)

**Primary Key**: `id` (INTEGER or UUID - check actual schema)

**Important Note**: This table is referenced throughout the system using `equipment_serial` (which has a UNIQUE constraint) rather than the primary key `id`.

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER/UUID | PRIMARY KEY | Unique device ID |
| equipment_serial | VARCHAR(255) | UNIQUE, NOT NULL | Equipment serial number (key field) |
| management_number | VARCHAR | | Management number |
| model_name | VARCHAR | | Model name |
| manufacturer | VARCHAR | | Manufacturer |
| manufacturing_country | VARCHAR | | Manufacturing country |
| manufacturing_date | DATE | | Manufacturing date |
| serial_number | VARCHAR | | Serial number |
| installation_date | DATE | | Installation date |
| first_installation_date | DATE | | First installation date |
| installation_institution | VARCHAR | NOT NULL | Installation institution name |
| installation_address | VARCHAR | | Installation institution address |
| installation_position | VARCHAR | NOT NULL | Installation location/position |
| installation_method | VARCHAR | | Installation method |
| jurisdiction_health_center | VARCHAR | | Jurisdiction health center name |
| manager | VARCHAR | | Manager name |
| institution_contact | VARCHAR | | Institution contact info |
| establisher | VARCHAR | | Establisher |
| purchase_institution | VARCHAR | | Purchasing institution |
| sido | VARCHAR | NOT NULL | Province (시/도) |
| gugun | VARCHAR | NOT NULL | District (구/군) |
| longitude | NUMERIC(11,8) | | GPS longitude |
| latitude | NUMERIC(10,8) | | GPS latitude |
| operation_status | VARCHAR | | Operation status |
| display_allowed | VARCHAR | | Display allowed flag |
| external_display | VARCHAR | | External display flag (Y/N) |
| external_non_display_reason | VARCHAR | | Reason for non-display |
| government_support | VARCHAR | | Government support flag |
| battery_expiry_date | DATE | | Battery expiration date |
| patch_available | VARCHAR | | Patch availability |
| patch_expiry_date | DATE | | Patch expiration date |
| last_inspection_date | DATE | | Last inspection date |
| last_use_date | NUMERIC | | Last usage date |
| replacement_date | DATE | | Replacement scheduled date |
| category_1 | VARCHAR | | Category level 1 |
| category_2 | VARCHAR | | Category level 2 |
| category_3 | VARCHAR | | Category level 3 |
| registration_date | DATE | | Registration date |
| remarks | VARCHAR | | Additional remarks |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_aed_data_equipment_serial` ON (equipment_serial) - CRITICAL for joins
- `idx_aed_data_sido_manufacturer` ON (sido, manufacturer)
- `idx_aed_data_expiry_dates` ON (battery_expiry_date, patch_expiry_date)
- Additional indexes on province, district, operation_status

**Unique Constraints**:
- `uk_aed_data_equipment_serial` UNIQUE (equipment_serial)

**Triggers**:
- Auto-update updated_at timestamp

**RLS Policies**: Enabled
- All users can SELECT
- Admins can modify

**Important Views**:
- `inspection_status` - Latest inspection status per device
- `aed_with_target_2024` - Devices matched to target institutions
- `aed_priority_with_gps` - Priority calculation including GPS issues

---

## Inspection System

### 4. inspections

**Purpose**: Record actual inspection activities (renamed from aed_inspections via migration 51)

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Inspection record ID |
| aed_data_id | UUID/INTEGER | REFERENCES aed_data(id) | AED device reference |
| equipment_serial | VARCHAR(255) | NOT NULL, FK to aed_data(equipment_serial) | Equipment serial (key field) |
| inspector_id | UUID | REFERENCES user_profiles(id) | Inspector user ID |
| inspector_name | VARCHAR(100) | | Inspector name |
| inspection_date | DATE | NOT NULL, DEFAULT CURRENT_DATE | Inspection date |
| inspection_type | TEXT | DEFAULT 'monthly', CHECK (monthly/emergency/installation/annual/special/routine/maintenance) | Inspection type |
| inspection_duration_minutes | INTEGER | | Duration in minutes |
| confirmed_manufacturer | VARCHAR(255) | | Confirmed manufacturer |
| confirmed_model_name | VARCHAR(255) | | Confirmed model name |
| confirmed_serial_number | VARCHAR(255) | | Confirmed serial number |
| confirmed_location | TEXT | | Confirmed location |
| confirmed_installation_position | TEXT | | Confirmed installation position |
| battery_status | VARCHAR(50) | NOT NULL, DEFAULT 'not_checked', CHECK (normal/warning/expired/missing/damaged/not_checked) | Battery status |
| battery_expiry_checked | DATE | | Checked battery expiry |
| battery_level_percentage | INTEGER | CHECK (0-100) | Battery level % |
| battery_visual_condition | VARCHAR(50) | DEFAULT 'good', CHECK (good/swollen/corroded/damaged) | Battery condition |
| pad_status | VARCHAR(50) | NOT NULL, DEFAULT 'not_checked', CHECK (normal/warning/expired/missing/damaged/not_checked) | Pad status |
| pad_expiry_checked | DATE | | Checked pad expiry |
| pad_package_intact | BOOLEAN | DEFAULT true | Pad package intact |
| pad_expiry_readable | BOOLEAN | DEFAULT true | Pad expiry readable |
| device_status | VARCHAR(50) | NOT NULL, DEFAULT 'not_checked', CHECK (normal/warning/malfunction/damaged/not_checked) | Device status |
| indicator_status | VARCHAR(50) | DEFAULT 'not_checked', CHECK (green/red/blinking/off/not_checked) | Indicator status |
| device_expiry_checked | DATE | | Device expiry checked |
| visual_status | TEXT | DEFAULT 'not_checked' | Visual inspection status |
| operation_status | TEXT | | Operational status |
| location_appropriate | BOOLEAN | | Location appropriate |
| signage_visible | BOOLEAN | | Signage visible |
| accessibility_clear | BOOLEAN | | Accessibility clear |
| temperature_appropriate | BOOLEAN | | Temperature appropriate |
| overall_status | VARCHAR(50) | DEFAULT 'pending', CHECK (pass/fail/pending/partial/requires_attention) | Overall status |
| priority_level | VARCHAR(20) | DEFAULT 'normal', CHECK (critical/urgent/high/medium/normal/low) | Priority level |
| issues_found | TEXT or TEXT[] | | Issues found during inspection |
| action_taken | TEXT | | Actions taken |
| recommendations | TEXT | | Recommendations |
| requires_replacement | BOOLEAN | DEFAULT false | Replacement required |
| replacement_parts | TEXT[] | | List of parts needing replacement |
| photos | TEXT[] | | Photo URLs |
| photo_urls | TEXT[] | | Alternative photo URLs |
| signature_data | TEXT | | Digital signature |
| notes | TEXT | | Additional notes |
| inspection_latitude | NUMERIC(10,8) | | Inspection GPS latitude |
| inspection_longitude | NUMERIC(11,8) | | Inspection GPS longitude |
| confirmed_by | UUID | REFERENCES user_profiles(id) | Confirming user ID |
| confirmed_at | TIMESTAMPTZ | | Confirmation timestamp |
| review_status | VARCHAR(20) | DEFAULT 'pending', CHECK (pending/approved/rejected/requires_revision) | Review status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_aed_inspections_equipment_serial` ON (equipment_serial)
- `idx_aed_inspections_equipment_date` ON (equipment_serial, inspection_date DESC)
- `idx_aed_inspections_date_status` ON (inspection_date DESC, overall_status)
- `idx_aed_inspections_inspector_date` ON (inspector_id, inspection_date DESC)
- `idx_aed_inspections_priority_status` ON (priority_level, overall_status, inspection_date DESC)

**Foreign Keys**:
- `equipment_serial` → aed_data(equipment_serial) ON DELETE RESTRICT
- `inspector_id` → user_profiles(id)
- `confirmed_by` → user_profiles(id)

**Triggers**:
- `update_aed_inspections_updated_at` - Auto-update updated_at

**RLS Policies**: Enabled
- Inspectors can view/edit own records
- Same organization users can view
- Admins have full access
- Approvers can review

---

### 5. inspection_sessions

**Purpose**: Track active inspection progress with step-by-step state management

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Session ID |
| equipment_serial | VARCHAR(255) | NOT NULL | Equipment serial (references aed_data) |
| inspector_id | UUID | NOT NULL, REFERENCES user_profiles(id) | Inspector user ID |
| status | TEXT | NOT NULL, DEFAULT 'active', CHECK (active/completed/cancelled/paused) | Session status |
| current_step | INTEGER | DEFAULT 0, CHECK (0-7) | Current inspection step |
| step_data | JSONB | DEFAULT '{}' | Step-by-step data |
| overall_status | TEXT | | Overall inspection status |
| started_at | TIMESTAMPTZ | DEFAULT NOW() | Session start time |
| paused_at | TIMESTAMPTZ | | Pause timestamp |
| resumed_at | TIMESTAMPTZ | | Resume timestamp |
| completed_at | TIMESTAMPTZ | | Completion timestamp |
| cancelled_at | TIMESTAMPTZ | | Cancellation timestamp |
| device_info | JSONB | | Device info snapshot |
| notes | TEXT | | Session notes |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_inspection_sessions_equipment` ON (equipment_serial)
- `idx_inspection_sessions_inspector` ON (inspector_id)
- `idx_inspection_sessions_status` ON (status)
- `idx_inspection_sessions_created` ON (created_at DESC)
- `idx_inspection_sessions_active` ON (status, inspector_id) WHERE status = 'active'

**Foreign Keys**:
- `inspector_id` → user_profiles(id)

**Triggers**:
- `trigger_update_inspection_sessions_updated_at` - Auto-update updated_at
- `validate_equipment_serial_exists()` - Validate equipment_serial exists in aed_data

**RLS Policies**: Enabled
- Inspectors view/edit own active sessions
- Admins view all sessions

**Key Functions**:
- `get_active_session(p_inspector_id)` - Get active session for inspector
- `complete_inspection_session(p_session_id, p_final_data)` - Complete session and create inspection record

---

### 6. inspection_assignments

**Purpose**: Schedule and assign inspections to specific inspectors

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Assignment ID |
| equipment_serial | VARCHAR(255) | NOT NULL | Equipment serial (no FK constraint) |
| assigned_to | UUID | NOT NULL, REFERENCES user_profiles(id) ON DELETE CASCADE | Assigned inspector |
| assigned_by | UUID | NOT NULL, REFERENCES user_profiles(id) ON DELETE CASCADE | Assigning user |
| assignment_type | TEXT | NOT NULL, DEFAULT 'scheduled', CHECK (scheduled/urgent/follow_up) | Assignment type |
| scheduled_date | DATE | | Scheduled inspection date |
| scheduled_time | TIME | | Scheduled inspection time |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK (pending/in_progress/completed/cancelled) | Assignment status |
| priority_level | INTEGER | DEFAULT 0, CHECK (0-3) | Priority level (0-3) |
| notes | TEXT | | Assignment notes |
| unavailable_reason | VARCHAR(20) | CHECK (disposed/broken/other) | Unavailable reason |
| unavailable_note | TEXT | | Unavailable details |
| unavailable_at | TIMESTAMPTZ | | Marked unavailable time |
| created_at | TIMESTAMPTZ | DEFAULT NOW(), NOT NULL | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| started_at | TIMESTAMPTZ | | Inspection started time |
| completed_at | TIMESTAMPTZ | | Completion timestamp |
| cancelled_at | TIMESTAMPTZ | | Cancellation timestamp |

**Unique Constraints**:
- `unique_active_assignment` EXCLUDE (equipment_serial, assigned_to) WHERE status IN ('pending', 'in_progress')

**Indexes**:
- `idx_assignments_assigned_to_status` ON (assigned_to, status, scheduled_date DESC) WHERE status IN ('pending', 'in_progress')
- `idx_assignments_equipment_status` ON (equipment_serial, status, created_at DESC)
- `idx_assignments_scheduled_date` ON (scheduled_date DESC, status) WHERE status = 'pending'
- `idx_assignments_assigned_by` ON (assigned_by, created_at DESC)
- `idx_inspection_assignments_unavailable` ON (equipment_serial, status) WHERE status = 'unavailable'
- `idx_inspection_assignments_equipment_serial` ON (equipment_serial) WHERE status IN ('pending', 'in_progress')

**Foreign Keys**:
- `assigned_to` → user_profiles(id) ON DELETE CASCADE
- `assigned_by` → user_profiles(id) ON DELETE CASCADE
- Equipment serial validated via trigger (not FK due to aed_data.equipment_serial not being PK)

**Triggers**:
- `trigger_update_inspection_assignments_updated_at` - Auto-update updated_at
- `trigger_assignment_status_timestamps` - Auto-set started_at/completed_at/cancelled_at
- `trigger_validate_equipment_serial` - Validate equipment_serial exists

**RLS Policies**: Enabled
- View own assignments (assigned_to or assigned_by)
- Update/delete own created assignments
- Admins can insert and view all

**Important Views**:
- `assigned_aed_list` - Join assignments with aed_data and latest sessions

---

### 7. inspection_schedule_entries

**Purpose**: Simple single-entry scheduling (Stage 1 MVP)

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Schedule entry ID |
| device_equipment_serial | VARCHAR(255) | NOT NULL, REFERENCES aed_data(equipment_serial) ON DELETE CASCADE | Equipment serial |
| scheduled_for | TIMESTAMPTZ | NOT NULL | Scheduled date/time |
| assignee_identifier | TEXT | NOT NULL | Assignee email or identifier |
| priority | TEXT | NOT NULL, DEFAULT 'normal', CHECK (urgent/high/normal/low) | Priority |
| status | TEXT | NOT NULL, DEFAULT 'scheduled', CHECK (scheduled/in_progress/completed/cancelled) | Status |
| notes | TEXT | | Notes |
| created_by | UUID | NOT NULL, REFERENCES user_profiles(id) | Creator user ID |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_inspection_schedule_entries_device` ON (device_equipment_serial)
- `idx_inspection_schedule_entries_scheduled_for` ON (scheduled_for DESC)
- `idx_inspection_schedule_entries_created_by` ON (created_by)

**Foreign Keys**:
- `device_equipment_serial` → aed_data(equipment_serial) ON DELETE CASCADE
- `created_by` → user_profiles(id)

**Triggers**:
- `trg_inspection_schedule_entries_updated_at` - Auto-update updated_at

**RLS Policies**: Enabled
- View/edit own schedules
- Admins have full access

---

## Team Management

### 8. team_members

**Purpose**: Team member management including temporary inspectors

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Team member ID |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) | Organization |
| name | TEXT | NOT NULL | Member name |
| email | TEXT | | Email address |
| phone | TEXT | | Phone number |
| position | TEXT | | Position/role |
| member_type | TEXT | NOT NULL, CHECK (permanent/temporary/volunteer) | Member type |
| user_profile_id | UUID | REFERENCES user_profiles(id) | Linked user profile |
| added_by | UUID | NOT NULL, REFERENCES user_profiles(id) | Added by user |
| is_active | BOOLEAN | DEFAULT true | Active status |
| notes | TEXT | | Notes |
| temporary_period_start | DATE | | Temp period start |
| temporary_period_end | DATE | | Temp period end |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_team_members_organization` ON (organization_id)
- `idx_team_members_user_profile` ON (user_profile_id)
- `idx_team_members_active` ON (is_active)

**Foreign Keys**:
- `organization_id` → organizations(id)
- `user_profile_id` → user_profiles(id)
- `added_by` → user_profiles(id)

**Triggers**:
- `update_team_members_updated_at` - Auto-update updated_at

**RLS Policies**: Enabled
- View own organization members
- Admins can manage

---

### 9. team_permissions

**Purpose**: Granular permissions for team members

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Permission ID |
| team_member_id | UUID | NOT NULL, REFERENCES team_members(id) ON DELETE CASCADE | Team member |
| can_view_team_members | BOOLEAN | DEFAULT false | View team members |
| can_manage_team_members | BOOLEAN | DEFAULT false | Manage team members |
| can_assign_tasks | BOOLEAN | DEFAULT false | Assign tasks |
| can_view_all_tasks | BOOLEAN | DEFAULT false | View all tasks |
| can_manage_schedules | BOOLEAN | DEFAULT false | Manage schedules |
| can_perform_inspections | BOOLEAN | DEFAULT true | Perform inspections |
| can_view_reports | BOOLEAN | DEFAULT false | View reports |
| can_export_data | BOOLEAN | DEFAULT false | Export data |
| access_scope | TEXT | CHECK (all/assigned_only/department/custom) | Access scope |
| custom_access_list | TEXT[] | | Custom AED IDs |
| granted_by | UUID | NOT NULL, REFERENCES user_profiles(id) | Granted by user |
| granted_at | TIMESTAMPTZ | DEFAULT NOW() | Grant timestamp |

**Foreign Keys**:
- `team_member_id` → team_members(id) ON DELETE CASCADE
- `granted_by` → user_profiles(id)

---

### 10. task_assignments

**Purpose**: General task assignment system

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Task ID |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) | Organization |
| task_type | TEXT | NOT NULL, CHECK (inspection/maintenance/training/report/other) | Task type |
| title | TEXT | NOT NULL | Task title |
| description | TEXT | | Task description |
| priority | TEXT | CHECK (urgent/high/normal/low) | Priority |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK (pending/in_progress/completed/cancelled) | Status |
| assigned_to | UUID | REFERENCES team_members(id) | Assigned member |
| assigned_by | UUID | NOT NULL, REFERENCES user_profiles(id) | Assigner |
| aed_device_id | UUID | REFERENCES aed_devices(id) | Related AED |
| scheduled_date | DATE | | Scheduled date |
| scheduled_time | TIME | | Scheduled time |
| deadline | TIMESTAMPTZ | | Deadline |
| completed_at | TIMESTAMPTZ | | Completion time |
| notes | TEXT | | Notes |
| attachments | JSONB | | Attachments metadata |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_task_assignments_organization` ON (organization_id)
- `idx_task_assignments_assigned_to` ON (assigned_to)
- `idx_task_assignments_status` ON (status)
- `idx_task_assignments_scheduled_date` ON (scheduled_date)

**Foreign Keys**:
- `organization_id` → organizations(id)
- `assigned_to` → team_members(id)
- `assigned_by` → user_profiles(id)

**Triggers**:
- `update_task_assignments_updated_at` - Auto-update updated_at

**RLS Policies**: Enabled

---

### 11. inspection_schedules

**Purpose**: Recurring inspection schedules

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Schedule ID |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) | Organization |
| schedule_type | TEXT | CHECK (daily/weekly/monthly/quarterly/annual/custom) | Schedule type |
| title | TEXT | NOT NULL | Schedule title |
| description | TEXT | | Description |
| is_recurring | BOOLEAN | DEFAULT false | Recurring flag |
| recurrence_pattern | JSONB | | Recurrence pattern JSON |
| primary_inspector | UUID | REFERENCES team_members(id) | Primary inspector |
| backup_inspector | UUID | REFERENCES team_members(id) | Backup inspector |
| aed_group_criteria | JSONB | | AED group criteria |
| aed_device_ids | UUID[] | | Specific AED IDs |
| start_date | DATE | NOT NULL | Start date |
| end_date | DATE | | End date |
| reminder_days_before | INTEGER | DEFAULT 3 | Reminder days |
| created_by | UUID | NOT NULL, REFERENCES user_profiles(id) | Creator |
| is_active | BOOLEAN | DEFAULT true | Active status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_inspection_schedules_organization` ON (organization_id)
- `idx_inspection_schedules_primary_inspector` ON (primary_inspector)
- `idx_inspection_schedules_active` ON (is_active)

**Foreign Keys**:
- `organization_id` → organizations(id)
- `primary_inspector` → team_members(id)
- `backup_inspector` → team_members(id)
- `created_by` → user_profiles(id)

**Triggers**:
- `update_inspection_schedules_updated_at` - Auto-update updated_at

**RLS Policies**: Enabled

---

### 12. schedule_instances

**Purpose**: Individual instances of recurring schedules

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Instance ID |
| schedule_id | UUID | NOT NULL, REFERENCES inspection_schedules(id) ON DELETE CASCADE | Parent schedule |
| scheduled_date | DATE | NOT NULL | Scheduled date |
| scheduled_time | TIME | | Scheduled time |
| assigned_inspector | UUID | REFERENCES team_members(id) | Assigned inspector |
| status | TEXT | DEFAULT 'scheduled', CHECK (scheduled/in_progress/completed/missed/rescheduled) | Status |
| started_at | TIMESTAMPTZ | | Start time |
| completed_at | TIMESTAMPTZ | | Completion time |
| inspection_id | UUID | REFERENCES inspections(id) | Linked inspection |
| rescheduled_to | DATE | | Rescheduled date |
| rescheduled_reason | TEXT | | Reschedule reason |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_schedule_instances_schedule` ON (schedule_id)
- `idx_schedule_instances_date` ON (scheduled_date)
- `idx_schedule_instances_status` ON (status)

**Foreign Keys**:
- `schedule_id` → inspection_schedules(id) ON DELETE CASCADE
- `assigned_inspector` → team_members(id)
- `inspection_id` → inspections(id)

**Triggers**:
- `update_schedule_instances_updated_at` - Auto-update updated_at

**RLS Policies**: Enabled

---

### 13. team_activity_logs

**Purpose**: Log team activities

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Log ID |
| organization_id | UUID | NOT NULL, REFERENCES organizations(id) | Organization |
| activity_type | TEXT | NOT NULL | Activity type |
| activity_description | TEXT | NOT NULL | Description |
| performed_by | UUID | REFERENCES user_profiles(id) | Performer |
| team_member_id | UUID | REFERENCES team_members(id) | Related member |
| task_id | UUID | REFERENCES task_assignments(id) | Related task |
| schedule_id | UUID | REFERENCES inspection_schedules(id) | Related schedule |
| metadata | JSONB | | Additional metadata |
| ip_address | INET | | IP address |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Indexes**:
- `idx_team_activity_logs_organization` ON (organization_id)
- `idx_team_activity_logs_performed_by` ON (performed_by)
- `idx_team_activity_logs_created_at` ON (created_at)

**Foreign Keys**:
- `organization_id` → organizations(id)
- `performed_by` → user_profiles(id)
- `team_member_id` → team_members(id)
- `task_id` → task_assignments(id)
- `schedule_id` → inspection_schedules(id)

---

## Notification & Logging

### 14. notifications

**Purpose**: User notifications system

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Notification ID |
| recipient_id | UUID | REFERENCES user_profiles(id) ON DELETE CASCADE | Recipient user |
| sender_id | UUID | REFERENCES user_profiles(id) ON DELETE SET NULL | Sender user |
| type | VARCHAR(50) | NOT NULL, CHECK (new_signup/approval_completed/approval_rejected/system_update/organization_change_request/role_updated) | Notification type |
| title | VARCHAR(255) | NOT NULL | Title |
| message | TEXT | NOT NULL | Message content |
| data | JSONB | DEFAULT '{}' | Additional data |
| is_read | BOOLEAN | DEFAULT false | Read status |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| expires_at | TIMESTAMPTZ | | Expiration timestamp |

**Indexes**:
- `idx_notifications_recipient_unread` ON (recipient_id, is_read, created_at DESC)
- `idx_notifications_type` ON (type)
- `idx_notifications_created_at` ON (created_at DESC)
- `idx_notifications_expires_at` ON (expires_at) WHERE expires_at IS NOT NULL

**Foreign Keys**:
- `recipient_id` → user_profiles(id) ON DELETE CASCADE
- `sender_id` → user_profiles(id) ON DELETE SET NULL

**RLS Policies**: Enabled
- Users view/update own notifications
- Authenticated users can create
- Users can delete own notifications

**Functions**:
- `cleanup_expired_notifications()` - Clean up old notifications
- `get_unread_notification_count(user_id)` - Get unread count

---

### 15. notification_templates

**Purpose**: Notification templates

**Primary Key**: `type` (VARCHAR(50))

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| type | VARCHAR(50) | PRIMARY KEY | Notification type |
| title_template | VARCHAR(255) | NOT NULL | Title template |
| message_template | TEXT | NOT NULL | Message template |
| default_expiry_hours | INTEGER | | Default expiry hours |
| email_enabled | BOOLEAN | DEFAULT true | Email enabled |
| push_enabled | BOOLEAN | DEFAULT true | Push enabled |
| priority | VARCHAR(10) | DEFAULT 'medium', CHECK (low/medium/high) | Priority |

**RLS Policies**: Enabled
- All users can view
- Only admins can modify

---

### 16. audit_logs

**Purpose**: Audit trail for user actions

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Log ID |
| user_id | UUID | REFERENCES auth.users(id) ON DELETE SET NULL | User ID |
| action | TEXT | NOT NULL | Action performed |
| entity_type | TEXT | | Entity type affected |
| entity_id | UUID | | Entity ID |
| metadata | JSONB | DEFAULT '{}' | Additional metadata |
| ip_address | TEXT | | IP address |
| user_agent | TEXT | | User agent |
| created_at | TIMESTAMPTZ | DEFAULT timezone('utc', now()), NOT NULL | Creation timestamp |

**Indexes**:
- `idx_audit_logs_user_id` ON (user_id)
- `idx_audit_logs_action` ON (action)
- `idx_audit_logs_created_at` ON (created_at DESC)
- `idx_audit_logs_entity` ON (entity_type, entity_id) WHERE entity_type IS NOT NULL

**Foreign Keys**:
- `user_id` → auth.users(id) ON DELETE SET NULL

**RLS Policies**: Enabled
- Admins can read all
- Users can read own logs
- Authenticated users can insert

---

### 17. login_history

**Purpose**: User login tracking

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Log ID |
| user_id | UUID | REFERENCES auth.users(id) ON DELETE CASCADE | User ID |
| login_time | TIMESTAMPTZ | DEFAULT NOW() | Login timestamp |
| ip_address | TEXT | | IP address |
| user_agent | TEXT | | User agent |
| success | BOOLEAN | DEFAULT true | Login success |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**Indexes**:
- `idx_login_history_user_id` ON (user_id)
- `idx_login_history_created_at` ON (created_at DESC)

**Foreign Keys**:
- `user_id` → auth.users(id) ON DELETE CASCADE

**RLS Policies**: Enabled
- Users view own history
- Admins view all
- System can insert

**Functions**:
- `record_user_login(p_user_id, p_ip_address, p_user_agent, p_success)` - Record login

---

## Security & Rate Limiting

### 18. otp_rate_limits

**Purpose**: OTP request rate limiting

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Rate limit ID |
| email | TEXT | NOT NULL | Email address |
| request_count | INTEGER | NOT NULL, DEFAULT 1 | Request count |
| first_request_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | First request time |
| last_request_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last request time |
| window_expires_at | TIMESTAMPTZ | NOT NULL | Window expiry time |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_otp_rate_limits_email` ON (email)
- `idx_otp_rate_limits_window_expires` ON (window_expires_at)

**Functions**:
- `cleanup_expired_otp_rate_limits()` - Clean expired records

---

## Target Institutions & Matching

### 19. target_list_2024

**Purpose**: 2024 AED mandatory institution list

**Primary Key**: `id` (VARCHAR(50))

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(50) | PRIMARY KEY | Unique key (e.g., TL2024-001) |
| sido | VARCHAR(50) | NOT NULL | Province |
| gugun | VARCHAR(100) | NOT NULL | District |
| institution_name | VARCHAR(255) | NOT NULL | Institution name |
| address | TEXT | NOT NULL | Address |
| institution_type | VARCHAR(100) | | Institution type |
| category_1 | VARCHAR(100) | | Category 1 |
| category_2 | VARCHAR(100) | | Category 2 |
| category_3 | VARCHAR(100) | | Category 3 |
| contact_phone | VARCHAR(50) | | Contact phone |
| manager_name | VARCHAR(100) | | Manager name |
| data_year | INTEGER | DEFAULT 2024 | Data year |
| imported_at | TIMESTAMPTZ | DEFAULT NOW() | Import timestamp |
| imported_by | UUID | REFERENCES user_profiles(id) | Importer |
| last_verified_at | TIMESTAMPTZ | | Last verification time |
| verified_by | UUID | REFERENCES user_profiles(id) | Verifier |
| notes | TEXT | | Notes |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_target_list_2024_location` ON (sido, gugun)
- `idx_target_list_2024_type` ON (institution_type)
- `idx_target_list_2024_name` ON (institution_name)

**Foreign Keys**:
- `imported_by` → user_profiles(id)
- `verified_by` → user_profiles(id)

**Triggers**:
- `update_target_list_2024_updated_at` - Auto-update updated_at

**RLS Policies**: Enabled
- All users can SELECT
- Admins can INSERT/UPDATE

---

### 20. target_list_devices

**Purpose**: Matching between AED devices and target institutions

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Matching ID |
| target_list_year | INTEGER | NOT NULL, CHECK (2024/2025) | Target list year |
| target_institution_id | VARCHAR(50) | NOT NULL | Target institution ID |
| equipment_serial | VARCHAR(255) | NOT NULL | Equipment serial |
| matching_method | VARCHAR(50) | DEFAULT 'manual', CHECK (manual/auto/verified/suggested) | Matching method |
| matching_confidence | NUMERIC(5,2) | CHECK (0-100) | Confidence score |
| matching_reason | JSONB | | Matching reason details |
| matched_by | UUID | REFERENCES user_profiles(id) | Matcher user |
| matched_at | TIMESTAMPTZ | DEFAULT NOW() | Match timestamp |
| verified_by | UUID | REFERENCES user_profiles(id) | Verifier user |
| verified_at | TIMESTAMPTZ | | Verification timestamp |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Unique Constraints**:
- UNIQUE (target_list_year, equipment_serial)

**Indexes**:
- `idx_target_devices_year_institution` ON (target_list_year, target_institution_id)
- `idx_target_devices_equipment` ON (equipment_serial)
- `idx_target_devices_year` ON (target_list_year)
- `idx_target_devices_method` ON (matching_method)

**Foreign Keys**:
- `matched_by` → user_profiles(id)
- `verified_by` → user_profiles(id)
- Note: No FK to target_list_YYYY or aed_data (dynamic references)

**Triggers**:
- `update_target_list_devices_updated_at` - Auto-update updated_at

**RLS Policies**: Enabled
- All can SELECT
- Admins/regional admins can INSERT
- Own matches can UPDATE

**Functions**:
- `check_orphaned_target_matches(p_year)` - Find orphaned matches
- `check_invalid_target_institutions(p_year)` - Find invalid references

---

## GPS Analysis

### 21. gps_issues

**Purpose**: Track GPS coordinate anomalies

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Issue ID |
| aed_data_id | INTEGER | REFERENCES aed_data(id) ON DELETE CASCADE | AED device |
| management_number | VARCHAR(255) | NOT NULL | Management number |
| issue_type | VARCHAR(50) | NOT NULL | Issue type (default_coord/address_mismatch/outlier/duplicate/cluster) |
| severity | VARCHAR(20) | NOT NULL | Severity (critical/high/medium/low) |
| description | TEXT | | Description |
| detected_lat | DECIMAL(10,8) | | Detected latitude |
| detected_lng | DECIMAL(11,8) | | Detected longitude |
| expected_lat | DECIMAL(10,8) | | Expected latitude |
| expected_lng | DECIMAL(11,8) | | Expected longitude |
| distance_km | DECIMAL(10,2) | | Distance in km |
| metadata | JSONB | | Additional metadata |
| is_resolved | BOOLEAN | DEFAULT false | Resolved flag |
| resolved_at | TIMESTAMP | | Resolution timestamp |
| resolved_by | VARCHAR(255) | | Resolver |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- `idx_gps_issues_aed_id` ON (aed_data_id)
- `idx_gps_issues_management_number` ON (management_number)
- `idx_gps_issues_issue_type` ON (issue_type)
- `idx_gps_issues_severity` ON (severity)
- `idx_gps_issues_is_resolved` ON (is_resolved)
- `idx_gps_issues_created_at` ON (created_at DESC)

**Foreign Keys**:
- `aed_data_id` → aed_data(id) ON DELETE CASCADE

**RLS Policies**: Enabled
- Authenticated can read
- Admins can write
- Inspectors/admins can update

**Important Views**:
- `aed_with_gps_issues` - AED devices with unresolved GPS issues
- `aed_priority_with_gps` - Priority calculation including GPS issues

---

### 22. gps_analysis_logs

**Purpose**: GPS analysis execution logs

**Primary Key**: `id` (UUID)

**Columns**:
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Log ID |
| analysis_date | DATE | NOT NULL, UNIQUE | Analysis date |
| total_records | INTEGER | | Total records analyzed |
| issues_found | INTEGER | | Issues found |
| default_coordinates | INTEGER | | Default coord issues |
| address_mismatch | INTEGER | | Address mismatches |
| outliers | INTEGER | | Outliers |
| duplicate_coordinates | INTEGER | | Duplicate coords |
| clusters | INTEGER | | Cluster issues |
| execution_time_ms | INTEGER | | Execution time (ms) |
| status | VARCHAR(20) | | Status (success/failed/partial) |
| error_message | TEXT | | Error message |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Unique Indexes**:
- `idx_gps_analysis_date` UNIQUE ON (analysis_date)

**RLS Policies**: Enabled
- Authenticated can read

---

## Important Notes

### Schema Migration History

The database schema has evolved through 69 migrations. Key changes include:

1. **Migration 04**: Initial AED tables creation as `aed_devices`
2. **Migration 06**: Restructure to use `equipment_serial` as the key field instead of UUID
3. **Migration 51**: Rename `aed_inspections_v2` → `inspections` and `aed_inspection_status` → `inspection_status`
4. **Migration 69**: Add FK validation trigger for `inspection_assignments.equipment_serial`

### Critical Relationships

#### AED Data Linking
- **aed_data.equipment_serial** is the PRIMARY linking field (NOT the PK `id`)
- All inspection and assignment tables use `equipment_serial` to reference AED devices
- `equipment_serial` has a UNIQUE constraint on aed_data
- Foreign key constraints cannot be used because `equipment_serial` is not the primary key
- Data integrity is enforced via triggers: `validate_equipment_serial_exists()`

#### Inspection Workflow
1. User creates `inspection_assignments` (assignment)
2. Inspector starts `inspection_sessions` (active session)
3. Inspector completes session → creates `inspections` record (final result)
4. Views like `assigned_aed_list` join all three for comprehensive status

### Naming Conventions

- Tables use snake_case
- Boolean columns often prefixed with `is_`, `can_`, `has_`
- Timestamp columns suffixed with `_at` (e.g., `created_at`, `completed_at`)
- Status columns use CHECK constraints with predefined values

### Performance Considerations

- All major tables have indexes on foreign keys
- Composite indexes exist for common query patterns
- JSONB columns used for flexible metadata
- Partial indexes on filtered queries (e.g., WHERE status IN ('pending', 'in_progress'))

### Security (RLS)

All tables have Row Level Security (RLS) enabled with policies for:
- User-level access (own records)
- Organization-level access (same org)
- Role-based access (admins, inspectors)
- System-level access (service role)

### Data Volumes (Production)

- **aed_data**: 81,331 records (as of 2025-09)
- **user_profiles**: 261 health centers + admin users
- Tables designed to scale to support all Korean health centers

---

## Schema Validation Queries

### Check Table Existence
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Check Foreign Key Relationships
```sql
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
```

### Check Indexes
```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Check RLS Policies
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

**Document Metadata**
- **Created**: 2025-10-25
- **Migration Base**: Migration 69
- **Production Data**: 81,331 AED devices
- **Source**: /Users/kwangsunglee/Projects/AED_check2025/aed-check-system/supabase/migrations/
