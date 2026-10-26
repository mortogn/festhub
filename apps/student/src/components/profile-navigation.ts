import {
  HandHeartIcon,
  LayoutDashboardIcon,
  MailIcon,
  UserRoundIcon,
  UsersIcon,
} from "@festhub/ui/icons";

export const profileNavigation = [
  { title: "Overview", href: "/profile", icon: LayoutDashboardIcon },
  { title: "Profile", href: "/profile/account", icon: UserRoundIcon },
  { title: "Volunteering", href: "/profile/volunteering", icon: HandHeartIcon },
  { title: "My teams", href: "/profile/teams", icon: UsersIcon },
  { title: "Team invitations", href: "/profile/team-invites", icon: MailIcon },
];
