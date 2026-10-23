"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@festhub/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@festhub/ui/components/dialog";
import client, { readResponse } from "./api";
import { useAuthContext } from "./auth";
import { formatDateTime } from "./dates";
import { useResource } from "./resource";
import {
  Editor,
  EmptyState,
  PageHeading,
  PersonAvatar,
  SearchInput,
  ResourceContent,
  Section,
  StatusBadge,
} from "./ui";

function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <SearchInput
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full sm:max-w-md"
    />
  );
}

export function StaffStudentsPage() {
  const load = useCallback(
    async () => readResponse(await client.students.$get()),
    [],
  );
  const resource = useResource(load);
  const [search, setSearch] = useState("");
  const students = (resource.data ?? []).filter((student) =>
    [
      student.name,
      student.email,
      student.studentId,
      student.department,
      student.batch,
    ].some((value) =>
      value.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  );
  return (
    <div className="space-y-6">
      <PageHeading
        title="Students"
        description="Find students and review their event registrations and volunteering history."
      />
      <Search
        value={search}
        onChange={setSearch}
        placeholder="Search by name, email, student ID, or department"
      />
      <ResourceContent resource={resource}>
        {students.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {students.map((student) => (
              <Link
                key={student.id}
                href={`/dashboard/students/${student.id}`}
                className="group min-w-0 space-y-4 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <PersonAvatar
                    name={student.name}
                    image={student.displayImage}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold break-words group-hover:underline">
                      {student.name}
                    </h2>
                    <p className="text-sm break-all text-muted-foreground">
                      {student.email}
                    </p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-3 border-t pt-3 text-sm">
                  {[
                    ["Student ID", student.studentId],
                    ["Department", student.department],
                    ["Batch", student.batch],
                  ].map(([label, value]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-words">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No students found"
            description="Try a different search, or check back after students sign up."
          />
        )}
      </ResourceContent>
    </div>
  );
}

export function StaffStudentPage({ id }: { id: string }) {
  const load = useCallback(
    async () =>
      readResponse(await client.students[":id"].$get({ param: { id } })),
    [id],
  );
  const resource = useResource(load);
  const student = resource.data;
  return (
    <div className="space-y-6">
      <Button asChild variant="link" className="h-auto px-0">
        <Link href="/dashboard/students">← All students</Link>
      </Button>
      <PageHeading
        title={student?.name ?? "Student details"}
        description={student?.email}
      />
      <ResourceContent resource={resource}>
        {student && (
          <>
            <Section title="Student information">
              <dl className="grid gap-5 sm:grid-cols-3">
                {[
                  ["Student ID", student.studentId],
                  ["Department", student.department],
                  ["Batch", student.batch],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="mt-1 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
            <Section
              title="Event registrations"
              description="Registration records include draft-team memberships; they do not confirm attendance."
            >
              {student.events.length ? (
                <div className="divide-y">
                  {student.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4"
                    >
                      <div>
                        <Link
                          href={`/dashboard/events/${event.id}`}
                          className="font-medium hover:underline"
                        >
                          {event.title}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDateTime(event.startsAt)} –{" "}
                          {formatDateTime(event.endsAt)}
                        </p>
                      </div>
                      <StatusBadge status={event.joinStatus} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No event registrations" />
              )}
            </Section>
            <Section
              title="Volunteering history"
              description="Dates below are event dates. Open the event to view its volunteer duty schedule."
            >
              {student.volunteerEvents.length ? (
                <div className="divide-y">
                  {student.volunteerEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-4"
                    >
                      <div>
                        <Link
                          href={`/dashboard/events/${event.id}`}
                          className="font-medium hover:underline"
                        >
                          {event.title}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {event.volunteerType === "invited"
                            ? "Invitation"
                            : "Application"}{" "}
                          · {formatDateTime(event.startsAt)}
                        </p>
                      </div>
                      <StatusBadge status={event.volunteerStatus} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No volunteering history" />
              )}
            </Section>
          </>
        )}
      </ResourceContent>
    </div>
  );
}

export function StaffTeachersPage() {
  const { user } = useAuthContext();
  const load = useCallback(
    async () => readResponse(await client.teachers.$get()),
    [],
  );
  const resource = useResource(load);
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const teachers = (resource.data ?? []).filter((teacher) =>
    [teacher.email, teacher.teacherId, teacher.department].some((value) =>
      value.toLowerCase().includes(search.trim().toLowerCase()),
    ),
  );
  return (
    <div className="space-y-6">
      <PageHeading
        title="Teachers"
        description="Browse teachers and the events they organize."
        action={
          user?.role === "admin" && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button className="h-11">Invite a teacher</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a teacher</DialogTitle>
                  <DialogDescription>
                    Allow a teacher to sign up with their email address. Share
                    the signup link with them afterward; no email is sent
                    automatically.
                  </DialogDescription>
                </DialogHeader>
                <Editor
                  fields={[
                    {
                      name: "email",
                      label: "Teacher email",
                      type: "email",
                      required: true,
                    },
                  ]}
                  submitLabel="Enable teacher signup"
                  successMessage="Teacher signup enabled. Share the teacher signup link with them."
                  onSubmit={async (values) => {
                    await readResponse(
                      await client.teachers.invite.$post({
                        json: { email: values.email!.trim() },
                      }),
                    );
                    setInviteOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          )
        }
      />
      <Search
        value={search}
        onChange={setSearch}
        placeholder="Search by email, teacher ID, or department"
      />
      <ResourceContent resource={resource}>
        {teachers.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {teachers.map((teacher) => (
              <Link
                key={teacher.id}
                href={`/dashboard/teachers/${teacher.id}`}
                className="group min-w-0 space-y-4 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:p-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <PersonAvatar
                    name={teacher.email}
                    image={teacher.displayImage}
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold break-all group-hover:underline">
                      {teacher.email}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {teacher.teacherId}
                    </p>
                  </div>
                </div>
                <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t pt-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      Department
                    </dt>
                    <dd className="mt-1 break-words">{teacher.department}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Joined</dt>
                    <dd className="mt-1">
                      {formatDateTime(teacher.createdAt)}
                    </dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No teachers found"
            description="Try another search or wait for invited teachers to finish signup."
          />
        )}
      </ResourceContent>
    </div>
  );
}

export function StaffTeacherPage({ id }: { id: string }) {
  const load = useCallback(
    async () =>
      readResponse(await client.teachers[":id"].$get({ param: { id } })),
    [id],
  );
  const resource = useResource(load);
  const teacher = resource.data?.[0];
  return (
    <div className="space-y-6">
      <Button asChild variant="link" className="h-auto px-0">
        <Link href="/dashboard/teachers">← All teachers</Link>
      </Button>
      <PageHeading
        title={teacher?.email ?? "Teacher details"}
        description="Teacher information and organized events."
      />
      <ResourceContent resource={resource}>
        {teacher ? (
          <>
            <Section title="Teacher information">
              <dl className="grid gap-5 sm:grid-cols-3">
                {[
                  ["Teacher ID", teacher.teacherId],
                  ["Department", teacher.department],
                  ["Joined", formatDateTime(teacher.createdAt)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="mt-1 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
            <Section title="Organized events">
              {teacher.organizedEvents.length ? (
                <div className="divide-y">
                  {teacher.organizedEvents.map((event) => (
                    <div key={event.id} className="py-4">
                      <Link
                        href={`/dashboard/events/${event.id}`}
                        className="font-medium hover:underline"
                      >
                        {event.title}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateTime(event.startsAt)} –{" "}
                        {formatDateTime(event.endsAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No organized events"
                  description="Assign this teacher to an event from its organizers tab."
                />
              )}
            </Section>
          </>
        ) : (
          <EmptyState
            title="Teacher not found"
            href="/dashboard/teachers"
            action="View teachers"
          />
        )}
      </ResourceContent>
    </div>
  );
}
