# Migration Validation Report

Generated: 2026-03-09T00:37:25.940Z

## Table counts
| Table | Count |
|-------|-------|
| institutions | 1 |
| academic_periods | 1 |
| users | 1124 |
| sections | 1 |
| subjects | 7 |
| groups | 84 |
| group_subjects | 0 |
| enrollments | 2090 |
| assignments | 0 |
| submissions | 0 |
| grades | 0 |
| grade_events | 0 |
| attendance | 0 |
| conversations | 0 |
| messages | 0 |
| notifications | 7343 |
| events | 33 |
| chat_sessions | 119 |
| chat_messages | 72 |
| announcements | 0 |
| announcement_messages | 0 |
| analytics.performance_snapshots | 0 |
| analytics.ai_action_logs | 1890 |

## FK checks (sample)
- Enrollments: each student_id and group_id should exist in users and groups.
- Submissions: each assignment_id and student_id should exist.
- Grade events: each assignment_id, user_id, group_id should exist.

✅ No orphan FKs found in sample checks.

## Summary
Validation passed (counts and sample FK checks).
