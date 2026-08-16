# Weekly Report manager field visibility

## Goal

For Weekly Report users with role `SECTION_MANAGER` or higher, hide selected
report fields from both the create/edit form and the detail page:

- Division Issues
- Company Issues
- Milestones
- Next Week Plan
- Team Summary

The role set is `SECTION_MANAGER`, `DIVISION_LEADER`, and `ADMIN`. `PM` and
`MEMBER` keep the current visibility behavior.

## Design

Add one shared role predicate for the Weekly Report visibility rule, backed by
the existing manager role set. Reuse it in `meeting-form.tsx` and the meeting
detail page so both surfaces cannot drift.

On create/edit forms, conditionally omit the five top-level field editors. For
projects with sub-project groups, keep the group, progress, and risk/issue
sections, but omit each group's Milestone and Next Week Plan blocks. On the
detail page, apply the same rule to top-level panels and nested group blocks.

This is a presentation-only change. Hidden values remain in the form state and
database, so editing a report as a manager does not erase existing values.
No Prisma schema or server action payload changes are required.

## Testing

Add a focused unit test for the shared role predicate covering all five roles.
Run that test first and observe the expected failure before implementation,
then run the full relevant test suite and production type/build checks.

## Acceptance criteria

1. `SECTION_MANAGER`, `DIVISION_LEADER`, and `ADMIN` do not see any of the
   listed fields on create, edit, or detail views.
2. Nested sub-project Milestone and Next Week Plan blocks are also absent for
   those roles.
3. `PM` and `MEMBER` retain their current behavior.
4. Existing saved values are not deleted or modified merely because a manager
   opens and saves a report.
