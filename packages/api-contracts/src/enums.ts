export const ApplicationStatus = {
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Withdrawn: 'Withdrawn',
  Invalidated: 'Invalidated',
} as const

export type ApplicationStatus =
  (typeof ApplicationStatus)[keyof typeof ApplicationStatus]

export const MembershipStatus = {
  Active: 'Active',
  Ended: 'Ended',
} as const

export type MembershipStatus =
  (typeof MembershipStatus)[keyof typeof MembershipStatus]

export const RecruitmentPublicationStatus = {
  Private: 'Private',
  Pending: 'Pending',
  Published: 'Published',
  Delisted: 'Delisted',
  Rejected: 'Rejected',
} as const

export type RecruitmentPublicationStatus =
  (typeof RecruitmentPublicationStatus)[keyof typeof RecruitmentPublicationStatus]

export const RecruitmentSwitch = {
  Open: 'Open',
  Closed: 'Closed',
} as const

export type RecruitmentSwitch =
  (typeof RecruitmentSwitch)[keyof typeof RecruitmentSwitch]

export const TeamLifecycle = {
  Active: 'Active',
  Dissolved: 'Dissolved',
} as const

export type TeamLifecycle =
  (typeof TeamLifecycle)[keyof typeof TeamLifecycle]

export const CompetitionDeadlineStatus = {
  BeforeDeadline: 'BeforeDeadline',
  AfterDeadline: 'AfterDeadline',
} as const

export type CompetitionDeadlineStatus =
  (typeof CompetitionDeadlineStatus)[keyof typeof CompetitionDeadlineStatus]

