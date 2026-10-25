"use client";

import { useAuthContext, type AuthUser } from "@/context/auth-user-context";
import { Button } from "@festhub/ui/components/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@festhub/ui/components/sidebar";
import { Skeleton } from "@festhub/ui/components/skeleton";
import { TooltipProvider } from "@festhub/ui/components/tooltip";
import {
  ArrowLeft,
  LayoutDashboardIcon,
  HandHeartIcon,
  MailIcon,
  UserRoundIcon,
  UsersIcon,
} from "@festhub/ui/icons";
import Link from "next/link";
import { SignOutButton } from "@festhub/frontend/auth";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect } from "react";
import { ProfileDataProvider } from "./profile-data";
import { useStudentData } from "@/context/student-data-context";
import InvitationNotifications from "@/components/invitation-notifications";
import { UploadedAvatar } from "@festhub/frontend/uploaded-image";

const navigation = [
  { title: "Overview", href: "/profile", icon: LayoutDashboardIcon },
  { title: "Profile", href: "/profile/account", icon: UserRoundIcon },
  { title: "Volunteering", href: "/profile/volunteering", icon: HandHeartIcon },
  { title: "My teams", href: "/profile/teams", icon: UsersIcon },
  { title: "Team invitations", href: "/profile/team-invites", icon: MailIcon },
];

function ProfileSidebar({ user }: { user: AuthUser }) {
  const pathname = usePathname();
  const { setOpenMobile, state, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isMobile;
  const { pendingTeams, pendingVolunteering } = useStudentData();
  const counts: Record<string, number> = {
    "/profile/team-invites": pendingTeams.length,
    "/profile/volunteering": pendingVolunteering.length,
  };

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader
        className={isCollapsed ? "items-center p-2" : "items-center p-3"}
      >
        <Link
          href="/"
          aria-label="FestHub home"
          onClick={() => setOpenMobile(false)}
          className={
            isCollapsed
              ? "flex size-8 shrink-0 items-center justify-center rounded-md"
              : "flex w-fit items-center justify-center rounded-md p-2"
          }
        >
          {isCollapsed ? (
            <span className="block h-8 w-6 overflow-hidden" aria-hidden="true">
              <Image
                src="/logo.svg"
                alt=""
                width={123}
                height={58}
                className="h-8 w-auto max-w-none"
              />
            </span>
          ) : (
            <Image src="/logo.svg" alt="PUB FestHub" width={123} height={58} />
          )}
        </Link>
        {!isCollapsed && (
          <p className="px-2 text-xs text-muted-foreground">
            Student dashboard
          </p>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.href ||
                      (item.href !== "/profile" &&
                        pathname.startsWith(item.href + "/"))
                    }
                    tooltip={item.title}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpenMobile(false)}
                      aria-current={pathname === item.href ? "page" : undefined}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                  {!!counts[item.href] && (
                    <SidebarMenuBadge
                      aria-label={`${counts[item.href]} pending invitations`}
                    >
                      {counts[item.href] > 99 ? "99+" : counts[item.href]}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Browse events">
                  <Link href="/" onClick={() => setOpenMobile(false)}>
                    <ArrowLeft />
                    <span>Browse events</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="My profile">
              <Link
                href="/profile/account"
                onClick={() => setOpenMobile(false)}
              >
                <UploadedAvatar
                  imageId={user.displayImageId}
                  name={user.name}
                  className="size-8"
                />
                <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function DashboardFrame({
  user,
  children,
}: PropsWithChildren<{ user: AuthUser }>) {
  const pathname = usePathname();
  const title =
    navigation.find((item) => item.href === pathname)?.title ?? "Profile";

  return (
    <TooltipProvider>
      <SidebarProvider>
        <ProfileSidebar user={user} />
        <SidebarInset className="min-w-0">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
            <SidebarTrigger />
            <div className="h-4 w-px bg-border" />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Dashboard
            </span>
            <span className="hidden text-muted-foreground/50 sm:inline">/</span>
            <span className="min-w-0 truncate text-sm font-medium">
              {title}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <InvitationNotifications />
              <SignOutButton />
            </div>
          </header>
          <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default function ProfileShell({ children }: PropsWithChildren) {
  const { user, status, error, retry } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/sign-in");
  }, [status, router]);

  if (status === "error") {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4 rounded-md border border-border p-6">
          <h1 className="text-xl font-semibold">Unable to open your profile</h1>
          <p role="alert" className="text-sm text-muted-foreground">
            {error}
          </p>
          <Button onClick={retry}>Try again</Button>
        </div>
      </main>
    );
  }

  if (status !== "authenticated" || !user) {
    return (
      <main
        role="status"
        className="mx-auto flex min-h-svh w-full max-w-6xl flex-col justify-center gap-6 p-6"
      >
        <span className="sr-only">
          {status === "unauthenticated"
            ? "Redirecting to sign in"
            : "Loading your profile"}
        </span>
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  if (user.role !== "student") {
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <div className="max-w-md space-y-4 rounded-md border border-border p-6">
          <h1 className="text-xl font-semibold">Student profiles</h1>
          <p className="text-sm text-muted-foreground">
            This dashboard is available to student accounts.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Browse events</Link>
          </Button>
          <SignOutButton />
        </div>
      </main>
    );
  }

  return (
    <ProfileDataProvider key={user.id} user={user}>
      <DashboardFrame user={user}>{children}</DashboardFrame>
    </ProfileDataProvider>
  );
}
