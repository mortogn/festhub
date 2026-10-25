"use client";

import { useAuthContext } from "./auth";
import { ImageUpload } from "./image-upload";
import { PageHeading, Section } from "./ui";

export function AvatarSettings() {
  const { user, refreshUser } = useAuthContext();
  if (!user) return null;
  return (
    <Section
      title="Profile image"
      description="Choose the avatar shown with your account."
    >
      <div className="max-w-md">
        <ImageUpload
          key={user.id}
          label="Avatar"
          target={{ type: "avatar" }}
          currentImageId={user.displayImageId}
          onUploaded={refreshUser}
        />
      </div>
    </Section>
  );
}

export function StaffProfilePage() {
  const { user } = useAuthContext();
  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeading
        title="My profile"
        description="Your account information and profile image."
      />
      <Section title="Account">
        <dl className="grid gap-4 sm:grid-cols-2">
          {[
            ["Name", user.name],
            ["Email", user.email],
            ["Role", user.role],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <AvatarSettings />
    </div>
  );
}
