# @festhub/ui

Shared shadcn/ui components for the student, teacher, and admin Next.js apps.
Components are exported as TypeScript source; Next.js compiles them without a
separate UI build step.

## Use a component

```tsx
import { Button } from "@festhub/ui/components/button"

export function Example() {
  return <Button>Continue</Button>
}
```

Utilities are available from `@festhub/ui/lib/utils`. Each app already depends on
this workspace and imports `@festhub/ui/globals.css` through its global stylesheet.
The app stylesheet registers its own source directory, and the shared stylesheet
registers the UI sources so Tailwind generates both sets of utilities.

## Add components

Run from the repository root:

```sh
pnpm dlx shadcn@latest add card -c apps/student
```

You can also target `apps/teacher` or `apps/admin`. Their `components.json` aliases
route shared UI components into this package. App-specific blocks stay in the
selected app. Commit the generated source, package dependency changes, and lockfile.

## Preset and theme

Initialized from preset `bIkeymG` with Radix and `--pointer`: Vega style, neutral
theme and chart colors, default radius, Lucide icons, and Inter typography with
inherited heading font. The app layouts load Inter using `next/font` and retain
Geist Mono. All three apps use light mode regardless of device color preference,
including native controls and toast notifications. Dark tokens and `dark:`
utilities require an explicit `.dark` class, which the apps do not set;
no theme provider is required.

Keep the style, icon library, and base color aligned across all four
`components.json` files. Shared tokens and pointer cursor rules live in
`src/styles/globals.css`. Tailwind v4 uses an empty config path.

```sh
pnpm --filter @festhub/ui typecheck
```

References: [shadcn monorepos](https://ui.shadcn.com/docs/monorepo),
[CLI and presets](https://ui.shadcn.com/docs/cli), and
[Tailwind source detection](https://tailwindcss.com/docs/detecting-classes-in-source-files).
