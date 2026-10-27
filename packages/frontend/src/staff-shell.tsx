"use client";

import { useEffect, type PropsWithChildren } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@festhub/ui/components/button";
import { Skeleton } from "@festhub/ui/components/skeleton";
import { TooltipProvider } from "@festhub/ui/components/tooltip";
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@festhub/ui/components/sidebar";
import {
  CalendarClockIcon,
  CodeIcon,
  GraduationCapIcon,
  HandHeartIcon,
  LayoutDashboardIcon,
  MapPinIcon,
  UsersIcon,
} from "@festhub/ui/icons";
import { SignOutButton, useAuthContext, type AuthUser } from "./auth";
import { UploadedAvatar } from "./uploaded-image";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/dashboard/events", label: "Events", icon: CalendarClockIcon },
  { href: "/dashboard/contests", label: "Contests", icon: CodeIcon },
  { href: "/dashboard/volunteers", label: "Volunteers", icon: HandHeartIcon },
  { href: "/dashboard/venues", label: "Venues", icon: MapPinIcon },
  { href: "/dashboard/students", label: "Students", icon: UsersIcon },
  { href: "/dashboard/teachers", label: "Teachers", icon: GraduationCapIcon },
];

export function StaffPageGuard({
  role,
  children,
}: PropsWithChildren<{ role: "teacher" | "admin" }>) {
  const auth = useAuthContext();
  const router = useRouter();
  useEffect(() => {
    if (auth.status === "unauthenticated") router.replace("/sign-in");
  }, [auth.status, router]);
  if (auth.status === "loading" || auth.status === "unauthenticated")
    return (
      <div
        className="mx-auto w-full max-w-7xl space-y-6 p-8"
        aria-label="Loading dashboard"
      >
        <p role="status" className="text-sm text-muted-foreground">
          Loading dashboard…
        </p>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  if (auth.status === "error")
    return (
      <div className="m-auto max-w-md space-y-4 rounded-md border p-8">
        <h1 className="text-2xl font-bold">Unable to load your account</h1>
        <p className="text-sm text-muted-foreground">{auth.error}</p>
        <Button onClick={auth.retry}>Try again</Button>
      </div>
    );
  if (!auth.user || auth.user.role !== role)
    return (
      <div className="m-auto max-w-md space-y-4 rounded-md border p-8">
        <h1 className="text-2xl font-bold">
          {role === "admin" ? "Administrator" : "Teacher"} access required
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign out and use your {role} account to access this dashboard.
        </p>
        <SignOutButton />
      </div>
    );
  return children;
}

export function StaffShell({
  role,
  children,
}: PropsWithChildren<{ role: "teacher" | "admin" }>) {
  const auth = useAuthContext();
  if (auth.status !== "authenticated" || !auth.user || auth.user.role !== role)
    return children;
  return (
    <TooltipProvider>
      <SidebarProvider key={auth.user.id}>
        <StaffNavigation role={role} user={auth.user} />
        <SidebarInset className="min-w-0 bg-muted/15">
          <DashboardHeader role={role} />
          <div className="mx-auto w-full max-w-7xl min-w-0 px-4 py-6 sm:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function DashboardHeader({ role }: { role: "teacher" | "admin" }) {
  const pathname = usePathname();
  const item = [...navigation]
    .reverse()
    .find(
      (entry) =>
        pathname === entry.href || pathname.startsWith(`${entry.href}/`),
    );
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <SidebarTrigger />
      <span className="h-4 border-r" />
      <p className="min-w-0 truncate text-sm text-muted-foreground">
        <span className="hidden capitalize sm:inline">{role}</span>{" "}
        <span className="hidden px-2 sm:inline">/</span>
        <span className="font-medium text-foreground">
          {pathname === "/dashboard/profile"
            ? "My profile"
            : (item?.label ?? "Dashboard")}
        </span>
      </p>
      <div className="ml-auto">
        <SignOutButton />
      </div>
    </header>
  );
}

function StaffNavigation({
  role,
  user,
}: {
  role: "teacher" | "admin";
  user: AuthUser;
}) {
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const closeMobile = () => setOpenMobile(false);
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader
        className={collapsed ? "items-center p-2" : "items-center p-3"}
      >
        <Link
          href="/dashboard"
          aria-label="FestHub dashboard"
          onClick={closeMobile}
          className={
            collapsed
              ? "flex size-8 shrink-0 items-center justify-center rounded-md"
              : "flex w-fit items-center justify-center rounded-md p-2"
          }
        >
          {collapsed ? (
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
        {!collapsed && (
          <p className="text-xs capitalize text-muted-foreground">
            {role} dashboard
          </p>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(`${item.href}/`));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link
                        href={item.href}
                        onClick={closeMobile}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="My profile"
              isActive={pathname === "/dashboard/profile"}
            >
              <Link
                href="/dashboard/profile"
                onClick={closeMobile}
                aria-label="My profile"
              >
                <UploadedAvatar
                  imageId={user.displayImageId}
                  name={user.name}
                  className="size-8"
                />
                <span className="grid min-w-0 gap-0.5 group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
