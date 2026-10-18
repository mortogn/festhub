import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { teacherInviteSchema } from "@festhub/shared/validation";
import { db } from "@festhub/db";
import {
  EventSelect,
  eventsTable,
  organizersTable,
  teacherInvitesTable,
  TeacherSelect,
  teachersTable,
  UserSelect,
  usersTable,
} from "@festhub/db/schema";
import { desc, eq, or } from "drizzle-orm";
import { BadRequestException } from "../exceptions/bad-request-exception.js";
import { InternalServerErrorException } from "../exceptions/internal-server-error-exception.js";
import { enforceAuthMiddleware } from "../middlewares/enforce-auth-middleware.js";
import z from "zod";

export const app = new Hono()
  .post(
    "/invite",
    enforceAuthMiddleware(["admin"]),
    zValidator("json", teacherInviteSchema),
    async (c) => {
      const body = c.req.valid("json");

      const invite = await db.transaction(async (tx) => {
        const [user] = await tx
          .select({ role: usersTable.role })
          .from(usersTable)
          .where(eq(usersTable.email, body.email));

        if (!!user)
          throw new BadRequestException(
            `A user is already using this email address with the role: ${user.role}`,
          );

        const [invite] = await tx
          .insert(teacherInvitesTable)
          .values({
            email: body.email,
          })
          .onConflictDoUpdate({
            target: teacherInvitesTable.email,
            set: { invitedAt: new Date() },
          })
          .returning();

        return invite;
      });

      if (!invite)
        throw new InternalServerErrorException(
          "Unable to retrieve the invite record",
        );

      return c.json(invite);
    },
  )
  .get("/", enforceAuthMiddleware(["admin", "teacher"]), async (c) => {
    const teachers = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        displayImage: usersTable.displayImage,
        createdAt: usersTable.createdAt,
        department: teachersTable.department,
        teacherId: teachersTable.teacherId,
      })
      .from(teachersTable)
      .innerJoin(usersTable, eq(usersTable.id, teachersTable.userId))
      .orderBy(desc(usersTable.createdAt));

    return c.json(teachers);
  })
  .get(
    "/:id",
    enforceAuthMiddleware(["admin", "teacher"]),
    zValidator("param", z.object({ id: z.uuid() })),
    async (c) => {
      const { id } = c.req.valid("param");

      const rows = await db
        .select({
          user: usersTable,
          teacher: teachersTable,
          organizedEvent: eventsTable,
        })
        .from(teachersTable)
        .innerJoin(usersTable, eq(usersTable.id, teachersTable.userId))
        .where(or(eq(usersTable.id, id), eq(teachersTable.teacherId, id)))
        .leftJoin(
          organizersTable,
          eq(organizersTable.teacherId, teachersTable.userId),
        )
        .leftJoin(eventsTable, eq(eventsTable.id, organizersTable.eventId))
        .orderBy(desc(usersTable.createdAt));

      const teacherMap = new Map<
        TeacherSelect["userId"],
        Pick<UserSelect, "email" | "displayImage" | "createdAt"> &
          Pick<TeacherSelect, "department" | "teacherId"> & {
            organizedEvents: Pick<
              EventSelect,
              "id" | "title" | "startsAt" | "endsAt" | "thumbnail"
            >[];
          }
      >();

      rows.filter(({ organizedEvent, user, teacher }) => {
        let item = teacherMap.get(teacher.userId);

        if (!item) {
          item = {
            email: user.email,
            createdAt: user.createdAt,
            displayImage: user.displayImage,
            department: teacher.department,
            teacherId: teacher.teacherId,
            organizedEvents: [],
          };

          teacherMap.set(teacher.userId, item);
        }

        if (organizedEvent) {
          item.organizedEvents.push({
            id: organizedEvent.id,
            title: organizedEvent.title,
            startsAt: organizedEvent.startsAt,
            endsAt: organizedEvent.endsAt,
            thumbnail: organizedEvent.thumbnail,
          });
        }
      });

      return c.json([...teacherMap.values()]);
    },
  );

export default app;

// cat wrote this:  hjf
