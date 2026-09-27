// Small 16px line icons for the mobile nav drawer, drawn in the same spirit as
// GitHub's Octicons. They inherit the link's text color via currentColor.

import type { ReactNode } from 'react'

type IconProps = { className?: string }

const Icon = ({ className, children }: IconProps & { children: ReactNode }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
)

export const HomeIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2 7.2 8 2l6 5.2" />
    <path d="M3.75 6v7.25h3v-4h2.5v4h3V6" />
  </Icon>
)

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3.5 3.5" />
  </Icon>
)

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2.75v10.5M2.75 8h10.5" />
  </Icon>
)

export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 1.75 2.75 3.5v4.25c0 3 2.25 5.25 5.25 6.5 3-1.25 5.25-3.5 5.25-6.5V3.5z" />
  </Icon>
)

export const SignInIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9.5 2.75h3.25v10.5H9.5" />
    <path d="M2.25 8h7.5M7 5.25 9.75 8 7 10.75" />
  </Icon>
)

export const PersonAddIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="6.5" cy="5" r="2.75" />
    <path d="M1.75 14c0-2.75 2.1-4.5 4.75-4.5s4.75 1.75 4.75 4.5" />
    <path d="M13 4.5v4M11 6.5h4" />
  </Icon>
)

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />
  </Icon>
)
