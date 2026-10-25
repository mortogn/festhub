"use client";

import { AvatarSettings } from "@festhub/frontend/profile";
import { Input } from "@festhub/ui/components/input";
import { Label } from "@festhub/ui/components/label";
import { useProfileData } from "../_components/profile-data";
import { ProfileSection, ResourceContent } from "../_components/profile-ui";

export default function AccountPage() {
  const { user, student } = useProfileData();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">My profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account information and profile image.
        </p>
      </div>

      <ProfileSection
        title="Account information"
        description="Your account details are read-only."
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { id: "account-name", label: "Name", value: user.name },
              { id: "account-email", label: "Email", value: user.email },
            ].map(({ id, label, value }) => (
              <div key={id} className="min-w-0 space-y-2">
                <Label htmlFor={id}>{label}</Label>
                <Input id={id} value={value} readOnly className="bg-muted/40" />
              </div>
            ))}
          </div>

          <ResourceContent resource={student}>
            {student.data && (
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    id: "account-student-id",
                    label: "Student ID",
                    value: student.data.studentId,
                  },
                  {
                    id: "account-department",
                    label: "Department",
                    value: student.data.department,
                  },
                  {
                    id: "account-batch",
                    label: "Batch",
                    value: student.data.batch,
                  },
                ].map(({ id, label, value }) => (
                  <div key={id} className="min-w-0 space-y-2">
                    <Label htmlFor={id}>{label}</Label>
                    <Input
                      id={id}
                      value={value}
                      readOnly
                      className="bg-muted/40"
                    />
                  </div>
                ))}
              </div>
            )}
          </ResourceContent>
        </div>
      </ProfileSection>

      <AvatarSettings />
    </div>
  );
}
