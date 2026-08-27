INSERT INTO organization_membership_all_project_capability (
    organization_membership_id,
    capability
)
SELECT
    organization_membership.id,
    'conversation_email_update'::organization_membership_all_project_capability_enum
FROM organization_membership
INNER JOIN organization
    ON organization.id = organization_membership.organization_id
INNER JOIN "user"
    ON "user".id = organization_membership.user_id
WHERE organization_membership.deleted_at IS NULL
  AND organization.deleted_at IS NULL
  AND "user".is_deleted = false
  AND NOT EXISTS (
      SELECT 1
      FROM organization_membership_all_project_capability
      WHERE organization_membership_all_project_capability.organization_membership_id = organization_membership.id
        AND organization_membership_all_project_capability.capability = 'conversation_email_update'
        AND organization_membership_all_project_capability.deleted_at IS NULL
  )
ON CONFLICT DO NOTHING;
